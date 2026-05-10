/* HourCounter — service worker
 *
 * Handles:
 *   - install / activate (claim immediately, no offline cache for now)
 *   - push events (renders a notification with the payload from the server)
 *   - notification click (opens or focuses the URL passed in the payload)
 *
 * Pure vanilla JS so it can be served as a static asset from /public.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "HourCounter", body: event.data.text() };
  }

  const title = payload.title || "HourCounter";
  const body = payload.body || "";
  const url = payload.url || "/app";
  const tag = payload.tag || title;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icon1",
      badge: "/icon0",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === url || clientUrl.pathname.startsWith(url)) {
          if ("focus" in client) return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
