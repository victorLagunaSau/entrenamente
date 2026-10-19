// Service worker de la WebApp (instalable en Android/iOS). No guarda nada en caché: cada visita pide la versión
// publicada, así un deploy nunca deja a nadie con una app vieja. Solo existe para instalar la app y recibir push.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Push (fase 2): el despachador manda { title, body, url }. Si llega sin datos, muestra un aviso genérico.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Entrena Mente", {
      body: data.body || "Tienes un aviso nuevo.",
      icon: "/pwa/estudiante/icon-192.png",
      badge: "/favicon/estudiante/android-icon-96x96.png",
      data: { url: data.url || "/login" },
    })
  );
});

// Al tocar el aviso: enfoca la app si ya está abierta y la lleva a la página del aviso; si no, la abre ahí.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/login", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    })
  );
});
