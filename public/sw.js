// Airmed: deixa o app abrir sem internet e mostra as notificações no celular.
// Só guarda os arquivos do próprio app. Nada do Google nem dados da pessoa passam por aqui.
const CACHE = 'airmed-app-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Depois de baixar a página nova, tira do cache os arquivos de versões antigas.
async function guardarPagina(pedido, resposta) {
  const cache = await caches.open(CACHE)
  await cache.put(pedido, resposta.clone())
  const html = await resposta.clone().text()
  const usados = new Set([...html.matchAll(/assets\/[^"'()\s]+/g)].map((m) => m[0]))
  for (const k of await cache.keys()) {
    const nome = (/assets\/[^?#]+/.exec(new URL(k.url).pathname) || [])[0]
    if (nome && !usados.has(nome) && !/\.woff2$/.test(nome)) await cache.delete(k)
  }
}

self.addEventListener('fetch', (e) => {
  const pedido = e.request
  const url = new URL(pedido.url)
  if (pedido.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return
  // A página: primeiro a internet (pega a versão nova); sem internet, a que está guardada.
  if (pedido.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(pedido)
        if (r.ok) e.waitUntil(guardarPagina(self.registration.scope, r.clone()))
        return r
      } catch {
        return (await caches.match(self.registration.scope)) || Response.error()
      }
    })())
    return
  }
  // Arquivos do app (têm o nome trocado a cada versão): primeiro o guardado.
  e.respondWith((async () => {
    const guardado = await caches.match(pedido)
    if (guardado) return guardado
    const r = await fetch(pedido)
    if (r.ok) { const c = await caches.open(CACHE); c.put(pedido, r.clone()) }
    return r
  })())
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const aberta = lista.find((c) => c.url.startsWith(self.registration.scope))
      return aberta ? aberta.focus() : self.clients.openWindow(self.registration.scope)
    }),
  )
})
