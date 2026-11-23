/**
 * Small key-value store shared by every server instance: rate limits and push subscribers.
 *
 * Uses Upstash Redis over its REST API when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are set (Vercel's KV_REST_API_URL / KV_REST_API_TOKEN work too). Without them it falls back to
 * process memory, which is fine for local development but is per-instance and lost on restart.
 */

const URL_ = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export const storeIsShared = Boolean(URL_ && TOKEN);

type Arg = string | number;

async function redis<T>(...command: Arg[]): Promise<T> {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || data.error) throw new Error(`Store error: ${data.error ?? res.status}`);
  return data.result as T;
}

// ---------------------------------------------------------------------------
// In-memory fallback. One instance per process, even when Next bundles routes separately.
// ---------------------------------------------------------------------------

interface Memory {
  values: Map<string, { value: string; expiresAt: number }>;
  hashes: Map<string, Map<string, string>>;
}
const g = globalThis as typeof globalThis & { __pactiqStore?: Memory };
const memory: Memory = (g.__pactiqStore ??= { values: new Map(), hashes: new Map() });

function memGet(key: string): string | null {
  const hit = memory.values.get(key);
  if (!hit) return null;
  if (hit.expiresAt && hit.expiresAt <= Date.now()) {
    memory.values.delete(key);
    return null;
  }
  return hit.value;
}

function memSet(key: string, value: string, ttlSeconds: number) {
  if (memory.values.size > 20_000) memory.values.clear();
  memory.values.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Add one to a counter that expires `windowSeconds` after its first hit. Returns the new count. */
export async function incrementWindow(key: string, windowSeconds: number): Promise<number> {
  if (storeIsShared) {
    const count = await redis<number>("INCR", key);
    if (count === 1) await redis<number>("EXPIRE", key, windowSeconds);
    return count;
  }
  const count = Number(memGet(key) ?? 0) + 1;
  const existing = memory.values.get(key);
  memory.values.set(key, { value: String(count), expiresAt: existing?.expiresAt || Date.now() + windowSeconds * 1000 });
  return count;
}

/** Set a key only if it is free. True when this call claimed it. Used to send each reminder once. */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  if (storeIsShared) return (await redis<string | null>("SET", key, "1", "NX", "EX", ttlSeconds)) === "OK";
  if (memGet(key) !== null) return false;
  memSet(key, "1", ttlSeconds);
  return true;
}

export async function release(key: string): Promise<void> {
  if (storeIsShared) await redis<number>("DEL", key);
  else memory.values.delete(key);
}

export async function hashSet(key: string, field: string, value: string): Promise<void> {
  if (storeIsShared) {
    await redis<number>("HSET", key, field, value);
    return;
  }
  if (!memory.hashes.has(key)) memory.hashes.set(key, new Map());
  memory.hashes.get(key)!.set(field, value);
}

export async function hashDelete(key: string, field: string): Promise<void> {
  if (storeIsShared) await redis<number>("HDEL", key, field);
  else memory.hashes.get(key)?.delete(field);
}

export async function hashSize(key: string): Promise<number> {
  if (storeIsShared) return redis<number>("HLEN", key);
  return memory.hashes.get(key)?.size ?? 0;
}

export async function hashAll(key: string): Promise<Record<string, string>> {
  if (storeIsShared) {
    // Upstash returns HGETALL as a flat [field, value, field, value, …] array.
    const flat = (await redis<string[] | null>("HGETALL", key)) ?? [];
    const out: Record<string, string> = {};
    for (let i = 0; i + 1 < flat.length; i += 2) out[flat[i]] = flat[i + 1];
    return out;
  }
  return Object.fromEntries(memory.hashes.get(key) ?? []);
}
