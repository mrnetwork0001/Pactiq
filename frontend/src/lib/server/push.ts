/**
 * Web push reminders: who is subscribed, and sending "your check-in is closing" to their devices,
 * including when the app is closed. Server-only (reads VAPID_PRIVATE_KEY).
 */
import { createHash } from "node:crypto";
import { sendNotification, setVapidDetails } from "web-push";
import { getAddress, isAddress, type Address } from "viem";
import { fetchUserPacts } from "@/lib/pactiq";
import { dayWindow, formatDuration, openCheckInDay } from "@/lib/pactTime";
import { appUrl } from "@/lib/share";
import { claimOnce, hashAll, hashDelete, hashSet, hashSize, release } from "./store";

const SUBSCRIBERS = "push:subs";
const MAX_SUBSCRIBERS = 20_000;
/** Real push services only, so a forged subscription can't make the server call arbitrary hosts. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /\.push\.apple\.com$/];

export interface StoredSubscription {
  wallet: Address;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: number;
}

export const vapidPublicKey = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function pushConfigured() {
  return Boolean(vapidPublicKey() && process.env.VAPID_PRIVATE_KEY);
}

const idOf = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

/** Validate what a browser sent us. Returns null when it isn't a usable push subscription. */
export function parseSubscription(wallet: unknown, sub: unknown): StoredSubscription | null {
  const s = sub as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (typeof wallet !== "string" || !isAddress(wallet)) return null;
  if (!s || typeof s.endpoint !== "string" || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return null;
  if (s.endpoint.length > 1024 || s.keys.p256dh.length > 256 || s.keys.auth.length > 128) return null;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((h) => h.test(url.hostname))) return null;
  return { wallet: getAddress(wallet), endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, createdAt: Math.floor(Date.now() / 1000) };
}

export async function saveSubscription(sub: StoredSubscription) {
  if ((await hashSize(SUBSCRIBERS)) >= MAX_SUBSCRIBERS) throw new Error("Reminder list is full.");
  await hashSet(SUBSCRIBERS, idOf(sub.endpoint), JSON.stringify(sub));
}

export async function removeSubscription(endpoint: string) {
  await hashDelete(SUBSCRIBERS, idOf(endpoint));
}

async function allSubscriptions(): Promise<StoredSubscription[]> {
  const out: StoredSubscription[] = [];
  for (const raw of Object.values(await hashAll(SUBSCRIBERS))) {
    try {
      out.push(JSON.parse(raw) as StoredSubscription);
    } catch {
      /* skip a corrupt row */
    }
  }
  return out;
}

export interface ReminderRun {
  subscribers: number;
  wallets: number;
  due: number;
  sent: number;
  expired: number;
  failed: number;
}

/**
 * For every subscribed wallet, find pacts whose open check-in closes within `withinHours` and
 * push one reminder per pact-day. Safe to call as often as you like: each pact-day is claimed
 * once in the store, and subscriptions the push service reports gone are deleted.
 */
export async function sendDueReminders(withinHours: number): Promise<ReminderRun> {
  if (!pushConfigured()) throw new Error("Push is not configured (VAPID keys missing).");
  // Push services want a contact they can reach: an https: or mailto: URL (a local http URL is refused).
  const subject = process.env.VAPID_SUBJECT || (appUrl().startsWith("https:") ? appUrl() : "https://pactiq.local");
  setVapidDetails(subject, vapidPublicKey(), process.env.VAPID_PRIVATE_KEY!);

  const subs = await allSubscriptions();
  const byWallet = new Map<Address, StoredSubscription[]>();
  for (const s of subs) byWallet.set(s.wallet, [...(byWallet.get(s.wallet) ?? []), s]);

  const run: ReminderRun = { subscribers: subs.length, wallets: byWallet.size, due: 0, sent: 0, expired: 0, failed: 0 };
  const now = Math.floor(Date.now() / 1000);

  for (const [wallet, devices] of byWallet) {
    let pacts;
    try {
      pacts = await fetchUserPacts(wallet);
    } catch (e) {
      console.error("Reminder run: couldn't read pacts for", wallet, e);
      continue;
    }
    for (const pact of pacts) {
      const day = openCheckInDay(pact, pact.days, now);
      if (day === null) continue;
      const left = dayWindow(pact, day).closesAt - now;
      if (left <= 0 || left > withinHours * 3600) continue;
      run.due++;

      const tag = `pactiq:reminded:${pact.id}:${day}`;
      const claim = `push:sent:${pact.id}:${day}`;
      if (!(await claimOnce(claim, 3 * 24 * 3600))) continue;

      const payload = JSON.stringify({
        title: `Day ${day} check-in closes in ${formatDuration(left)}`,
        body: `"${pact.title}": snap your proof now to keep your streak and your stake.`,
        tag,
        url: `${appUrl()}/app`,
      });
      let delivered = 0;
      for (const device of devices) {
        try {
          await sendNotification({ endpoint: device.endpoint, keys: device.keys }, payload, { TTL: Math.min(left, 6 * 3600), urgency: "high" });
          delivered++;
          run.sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await removeSubscription(device.endpoint);
            run.expired++;
          } else {
            console.error("Reminder push failed", status ?? e);
            run.failed++;
          }
        }
      }
      // Nothing got through: let the next run try this pact-day again.
      if (delivered === 0) await release(claim);
    }
  }
  return run;
}
