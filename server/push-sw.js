/* GatorVault - verified visit push notifications (D3). */
self.addEventListener("push", (event) => {
  let payload = { title: "GatorVault Visit Intel", body: "Verified UF official visit update.", url: "/vault/futurecast#visits" };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || "GatorVault Visit Intel", {
    body: payload.body || "", tag: payload.tag || "gv-visit-intel", data: { url: payload.url || "/vault/futurecast#visits" },
    icon: "/brand/logos/gv-monogram.svg", badge: "/brand/logos/gv-monogram.svg",
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification?.data?.url || "/vault/futurecast#visits";
  const target = raw.startsWith("http") ? raw : new URL(raw, self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if ("focus" in client) {
        try {
          if ("navigate" in client) {
            client.navigate(target);
            return client.focus();
          }
        } catch {}
        client.focus();
        return undefined;
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
    return undefined;
  }));
});
