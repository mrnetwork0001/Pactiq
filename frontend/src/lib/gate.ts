import { createHash, timingSafeEqual } from "node:crypto";

/*
 * Optional site-wide password. Set SITE_PASSWORD in the host's environment to turn it on; leave it
 * unset and the site is open. The password is never in the repo.
 */

export const GATE_COOKIE = "pactiq_gate";

export function gatePassword(): string | null {
  return process.env.SITE_PASSWORD?.trim() || null;
}

/** What the cookie holds: a hash, so the password itself never sits in the browser. */
export function gateToken(password: string): string {
  return createHash("sha256").update(`pactiq-gate:${password}`).digest("hex");
}

export function sameText(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

/** Only ever send people back to a path on this site. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
