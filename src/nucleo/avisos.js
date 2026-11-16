// Lembretes do web app: notificação comum, só com o Airmed aberto.
// O alarme em tela cheia de verdade fica para a capa Android.
import { estado, relogio, hoje, agoraMin } from './dados.js'
import { diaComSituacao } from './motor.js'
import { minutos, horaCurta } from './tempo.js'
import { ui, avisar } from './ui.js'
import { acesso } from './acesso.js'

const RECENTE = 10 // minutos: mais velho que isso não abre alarme ao entrar no app

export function iniciarRelogio() {
  const bate = () => { relogio.agora = new Date(); verificar() }
  setInterval(bate, 15000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bate() })
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {})
  bate()
}

export function verificar() {
  if (!estado.iniciado) return
  const dia = hoje.value
  for (const k of Object.keys(estado.avisados)) if (!k.includes(`:${dia}:`)) delete estado.avisados[k]
  const pendentes = diaComSituacao(estado, dia, dia, agoraMin.value)
    .filter((o) => o.hora && ['aberto', 'atencao'].includes(o.sit) && !(o.tipo === 'rot' && o.nivel === 'marcar'))
  const porHora = new Map()
  for (const o of pendentes) porHora.set(o.hora, [...(porHora.get(o.hora) || []), o])
  for (const [hora, itens] of porHora) {
    const chaveAdiado = `${dia}:${hora}`
    const adiadoAte = estado.adiados[chaveAdiado]
    if (adiadoAte && Date.now() < adiadoAte) continue
    const voltou = !!adiadoAte
    if (voltou) delete estado.adiados[chaveAdiado]
    const novos = voltou ? itens : itens.filter((o) => !estado.avisados[o.chave])
    if (!novos.length) continue
    for (const o of novos) estado.avisados[o.chave] = 1
    if (!voltou && agoraMin.value - minutos(hora) > RECENTE) continue
    const comAlarme = itens.filter((o) => o.tipo === 'rem' || o.nivel === 'cobrar')
    notificar(hora, itens)
    if (!acesso.desbloqueado) continue
    if (comAlarme.length) { if (!ui.alarme) ui.alarme = { data: dia, hora } }
    else avisar(`${horaCurta(hora)} · ${itens.map((o) => o.titulo).join(', ')}`)
  }
}

export const podeNotificar = () => 'Notification' in window
export const permissao = () => (podeNotificar() ? Notification.permission : 'unsupported')
export async function pedirPermissao() {
  if (!podeNotificar()) return 'unsupported'
  return Notification.requestPermission()
}

// Notificação discreta por padrão: sem o nome do remédio na tela bloqueada.
export async function notificar(hora, itens) {
  if (permissao() !== 'granted') return
  const temRemedio = itens.some((o) => o.tipo === 'rem')
  const titulo = `${temRemedio ? '💊' : '🔔'} Lembrete ${horaCurta(hora)}`
  const nomes = itens
    .filter((o) => o.tipo === 'rot' || estado.prefs.nomeNaNotificacao)
    .map((o) => o.titulo)
  const corpo = nomes.length === itens.length ? nomes.join(', ') : (itens.length > 1 ? `${itens.length} itens` : '')
  const opcoes = { body: corpo, tag: `airmed-${hora}`, icon: './icone.svg' }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(titulo, opcoes)
    else new Notification(titulo, opcoes)
  } catch { /* sem notificação: o aviso dentro do app continua valendo */ }
}
