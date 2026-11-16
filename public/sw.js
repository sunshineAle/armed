// Airmed (teste): só permite mostrar notificações no celular. Não guarda nada em cache.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const aberta = lista.find((c) => c.url.startsWith(self.registration.scope))
      return aberta ? aberta.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})
