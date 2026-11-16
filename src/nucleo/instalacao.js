// Instalação como app (PWA): guarda o convite do navegador para oferecer o botão em Ajustes.
import { reactive } from 'vue'

const emTelaCheia = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
export const instalacao = reactive({
  podePedir: false,
  instalado: emTelaCheia(),
  apple: /iphone|ipad|ipod/i.test(navigator.userAgent),
})
let convite = null
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); convite = e; instalacao.podePedir = true })
window.addEventListener('appinstalled', () => { convite = null; instalacao.podePedir = false; instalacao.instalado = true })
export async function instalar() {
  if (!convite) return
  convite.prompt()
  try { await convite.userChoice } catch { /* fechou o convite */ }
  convite = null; instalacao.podePedir = false
}
