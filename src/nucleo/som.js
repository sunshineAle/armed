// Som e vibração do alarme, feitos pelo próprio navegador (sem arquivo de áudio).
// O navegador só deixa tocar depois de um toque da pessoa na tela: por isso o som é "destravado" no primeiro toque.
let ctx = null
export function destravarSom() {
  try {
    const Classe = window.AudioContext || window.webkitAudioContext
    if (!Classe) return
    ctx = ctx || new Classe()
    if (ctx.state === 'suspended') ctx.resume()
  } catch { /* sem áudio neste navegador */ }
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, destravarSom, { passive: true })
}
export const somPronto = () => ctx?.state === 'running'

function nota(freq, inicio, dur, volume) {
  const osc = ctx.createOscillator(); const ganho = ctx.createGain()
  osc.type = 'sine'; osc.frequency.value = freq
  ganho.gain.setValueAtTime(0.0001, inicio)
  ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.03)
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dur)
  osc.connect(ganho).connect(ctx.destination)
  osc.start(inicio); osc.stop(inicio + dur + 0.05)
}
// Três notas subindo. Devolve false se o navegador ainda não deixou tocar.
export function toque(volume = 0.5) {
  if (!somPronto()) return false
  const t = ctx.currentTime
  nota(784, t, 0.4, volume); nota(988, t + 0.42, 0.4, volume); nota(1319, t + 0.84, 0.8, volume)
  return true
}
const vibrar = (padrao) => { try { navigator.vibrate?.(padrao) } catch { /* sem vibração */ } }

// Alarme: repete o toque e a vibração até a pessoa responder, por no máximo 3 minutos.
let laco = null
export const alarmeTocando = () => !!laco
export function tocarAlarme() {
  pararAlarme()
  const ate = Date.now() + 180000
  const um = () => { toque(); vibrar([400, 200, 400, 200, 600]) }
  um()
  laco = setInterval(() => { if (Date.now() > ate) pararAlarme(); else um() }, 3200)
}
export function pararAlarme() {
  if (laco) clearInterval(laco)
  laco = null
  vibrar(0)
}
// Lembrete leve (rotina em "lembrar"): um toque só.
export function tocarLembrete() { toque(0.35); vibrar([250]) }
