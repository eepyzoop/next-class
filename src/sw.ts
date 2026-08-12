/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
};

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
// generateSW sets this up automatically; injectManifest requires it explicitly so that
// navigating to routes like "/next-class/classes" resolves from the cached index.html offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

self.addEventListener("push", (event: PushEvent) => {
  let title = "NextClass";
  let body = "";
  try {
    const data = event.data?.json() as { title?: string; body?: string } | undefined;
    if (data?.title) title = data.title;
    if (data?.body) body = data.body;
  } catch {
    body = event.data?.text() ?? "";
  }
  event.waitUntil(self.registration.showNotification(title, { body, icon: `${self.registration.scope}icon-192.png` }));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => "focus" in c) as WindowClient | undefined;
      if (existing) return existing.focus();
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
