// Gaveta simples no IndexedDB (guarda o que o localStorage não aceita, como chaves que o app não consegue exportar).
const abrir = () => new Promise((ok, falha) => {
  const r = indexedDB.open('airmed', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('kv')
  r.onsuccess = () => ok(r.result)
  r.onerror = () => falha(r.error)
})
const pedido = (modo, fn) => abrir().then((db) => new Promise((ok, falha) => {
  const r = fn(db.transaction('kv', modo).objectStore('kv'))
  r.onsuccess = () => ok(r.result ?? null)
  r.onerror = () => falha(r.error)
}))
export const kvGet = (k) => pedido('readonly', (s) => s.get(k))
export const kvSet = (k, v) => pedido('readwrite', (s) => (v === null || v === undefined ? s.delete(k) : s.put(v, k)))
