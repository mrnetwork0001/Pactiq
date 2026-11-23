// Pactiq service worker: makes the app installable and shows check-in reminders.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.startsWith(self.registration.scope));
      return existing ? existing.focus() : self.clients.openWindow(event.notification.data?.url || "/app");
    })
  );
});

// Reminders pushed by the server while the app is closed (see /api/push/cron).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    /* not JSON: show the generic reminder below */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Your Pactiq check-in is still open", {
      body: data.body || "Snap today's proof to keep your streak and your stake.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/app" },
    })
  );
});
