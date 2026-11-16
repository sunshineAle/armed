// Lembretes do web app: com o Airmed aberto, alarme na tela com som e vibração, e notificação.
// Com o app fechado ou o celular bloqueado o navegador não deixa tocar: isso fica para a capa Android.
import { estado, relogio, hoje, agoraMin } from './dados.js'
import { diaComSituacao } from './motor.js'
import { minutos, horaCurta } from './tempo.js'
import { ui, avisar } from './ui.js'
import { acesso } from './acesso.js'
import { verificarLembrete } from './backupRapido.js'
import { tocarLembrete } from './som.js'

const RECENTE = 10 // minutos: mais velho que isso não abre alarme ao entrar no app

export function iniciarRelogio() {
  const bate = () => { relogio.agora = new Date(); verificar() }
  setInterval(bate, 15000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bate() })
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {})
  bate()
}

// Marcas do dia (em estado.avisados):
//   chave         -> a notificação já saiu
//   chave + #tela -> o alarme já apareceu na tela
//   chave + #fim  -> o reforço "falta pouco" já saiu
export function verificar() {
  if (!estado.iniciado) return
  verificarLembrete()
  const dia = hoje.value
  for (const k of Object.keys(estado.avisados)) if (!k.includes(`:${dia}:`)) delete estado.avisados[k]
  const aberto = acesso.desbloqueado && ui.liberado
  const pendentes = diaComSituacao(estado, dia, dia, agoraMin.value)
    .filter((o) => o.hora && ['aberto', 'atencao'].includes(o.sit) && !(o.tipo === 'rot' && o.nivel === 'marcar'))
  const porHora = new Map()
  for (const o of pendentes) porHora.set(o.hora, [...(porHora.get(o.hora) || []), o])
  for (const [hora, itens] of porHora) {
    const chaveAdiado = `${dia}:${hora}`
    const adiadoAte = estado.adiados[chaveAdiado]
    if (adiadoAte && Date.now() < adiadoAte) continue
    const voltou = !!adiadoAte
    if (voltou) {
      delete estado.adiados[chaveAdiado]
      for (const o of itens) { delete estado.avisados[o.chave]; delete estado.avisados[o.chave + '#tela'] }
    }
    // Remédio e rotina "lembrar e cobrar" valem enquanto a janela estiver aberta, mesmo se o app foi aberto depois.
    // Rotina em "lembrar" avisa uma vez, só na hora.
    const fortes = itens.filter((o) => o.tipo === 'rem' || o.nivel === 'cobrar')
    const recente = agoraMin.value - minutos(hora) <= RECENTE
    const novos = itens.filter((o) => !estado.avisados[o.chave] && (fortes.includes(o) || recente || voltou))
    const reforco = fortes.filter((o) => o.sit === 'atencao' && estado.avisados[o.chave] && !estado.avisados[o.chave + '#fim'])
    for (const o of itens) estado.avisados[o.chave] = 1
    for (const o of fortes) if (o.sit === 'atencao') estado.avisados[o.chave + '#fim'] = 1
    if (novos.length || reforco.length) notificar(hora, itens, reforco.length > 0)
    if (!aberto) continue // bloqueado: só a notificação discreta; o alarme aparece ao desbloquear
    const paraTela = fortes.filter((o) => !estado.avisados[o.chave + '#tela'] || reforco.includes(o))
    if (paraTela.length) {
      if (ui.alarme) continue // já há um alarme na tela: este entra quando o outro fechar
      for (const o of fortes) estado.avisados[o.chave + '#tela'] = 1
      ui.alarme = { data: dia, hora }
    } else if (novos.length) {
      avisar(`${horaCurta(hora)} · ${itens.map((o) => o.titulo).join(', ')}`)
      if (estado.prefs.som) tocarLembrete()
    }
  }
}

export const podeNotificar = () => 'Notification' in window
export const permissao = () => (podeNotificar() ? Notification.permission : 'unsupported')
export async function pedirPermissao() {
  if (!podeNotificar()) return 'unsupported'
  return Notification.requestPermission()
}

// Notificação discreta por padrão: sem o nome do remédio na tela bloqueada.
export async function notificar(hora, itens, faltaPouco = false) {
  if (permissao() !== 'granted') return
  const temRemedio = itens.some((o) => o.tipo === 'rem')
  const titulo = `${temRemedio ? '💊' : '🔔'} Lembrete ${horaCurta(hora)}${faltaPouco ? ' · falta pouco' : ''}`
  const nomes = itens
    .filter((o) => o.tipo === 'rot' || estado.prefs.nomeNaNotificacao)
    .map((o) => o.titulo)
  const corpo = nomes.length === itens.length ? nomes.join(', ') : (itens.length > 1 ? `${itens.length} itens` : '')
  // Fica na tela até a pessoa responder, vibra e toca de novo no reforço.
  const opcoes = { body: corpo, tag: `airmed-${hora}`, icon: './icone-192.png', badge: './icone-192.png', requireInteraction: true, renotify: true, vibrate: [400, 200, 400, 200, 600] }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(titulo, opcoes)
    else new Notification(titulo, opcoes)
  } catch { /* sem notificação: o aviso dentro do app continua valendo */ }
}
