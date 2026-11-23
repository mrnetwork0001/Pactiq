"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { dayWindow, openCheckInDay, formatDuration } from "@/lib/pactTime";
import { PactStatus, type PactWithDays } from "@/lib/types";

const REMIND_BEFORE = 4 * 3600; // remind when the window closes within 4 hours
type Permission = NotificationPermission | "unsupported";

const currentPermission = (): Permission =>
  typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission;

/** VAPID keys travel as URL-safe base64; the Push API wants bytes. */
function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Subscribe this device to server-sent reminders for `wallet`. Quietly does nothing if unsupported. */
async function subscribeToPush(wallet: Address) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const config = (await fetch("/api/push").then((r) => r.json())) as { enabled: boolean; publicKey: string | null };
  if (!config.enabled || !config.publicKey) return;
  const reg = await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) }));
  await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, subscription: subscription.toJSON() }),
  });
}

/**
 * Check-in reminders, once per pact-day, when today's check-in is still open and closes within
 * 4 hours. Two sources share one notification tag, so the user only ever sees one:
 *   - the server pushes it to this device even when the app is closed (/api/push/cron);
 *   - while the app is open, it is also raised locally, in case the push is late or unavailable.
 */
export function useReminders(pacts: PactWithDays[], now: number, wallet: Address | null) {
  const [permission, setPermission] = useState<Permission>(currentPermission);

  // Register the service worker (installable app + notifications).
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const enable = useCallback(async () => {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  }, []);

  // Once notifications are allowed, keep this device subscribed for the connected wallet.
  const subscribed = useRef<Address | null>(null);
  useEffect(() => {
    if (permission !== "granted" || !wallet || subscribed.current === wallet) return;
    subscribed.current = wallet;
    subscribeToPush(wallet).catch(() => {
      subscribed.current = null;
    });
  }, [permission, wallet]);

  useEffect(() => {
    if (permission !== "granted" || !now) return;
    for (const pact of pacts) {
      if (pact.status !== PactStatus.ACTIVE) continue;
      const day = openCheckInDay(pact, pact.days, now);
      if (day === null) continue;
      const left = dayWindow(pact, day).closesAt - now;
      if (left > REMIND_BEFORE) continue;
      const key = `pactiq:reminded:${pact.id}:${day}`;
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, "1");
      const title = `Day ${day} check-in closes in ${formatDuration(left)}`;
      const body = `"${pact.title}" — snap your proof now to keep your streak and your stake.`;
      navigator.serviceWorker?.ready
        .then((reg) => reg.showNotification(title, { body, icon: "/icon-192.png", tag: key }))
        .catch(() => new Notification(title, { body, icon: "/icon-192.png" }));
    }
  }, [pacts, now, permission]);

  return { permission, enable };
}
