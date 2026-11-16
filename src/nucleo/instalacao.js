// Instalação como app (padrão Alt Design): convite do navegador onde existe; Apple e navegadores sem convite
// recebem os passos numa janela. Todo toque no botão dá uma resposta visível.
import { reactive } from 'vue'

const ambiente = () => (typeof navigator === 'undefined' ? {} : navigator)
export function ehAppleMovel(a = ambiente()) {
  return /iPhone|iPad|iPod/.test(a.userAgent || '') || (a.platform === 'MacIntel' && a.maxTouchPoints > 1)
}
export function ehApple(a = ambiente()) {
  return ehAppleMovel(a) || /Macintosh|Mac OS X/.test(a.userAgent || '') || a.platform === 'MacIntel'
}
export function orientacaoInstalacao(a = ambiente()) {
  const ua = a.userAgent || ''
  if (ehAppleMovel(a)) {
    const outroNavegador = /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/.test(ua) || !/Safari/.test(ua)
    return {
      titulo: 'Instalar no iPhone ou iPad', onde: 'na Tela de Início',
      passos: [
        ...(outroNavegador ? ['Para seguir estas instruções no Safari, abra este endereço nele. Se estiver dentro de outro aplicativo, copie o endereço e cole no Safari.'] : []),
        'No Safari, toque em Compartilhar (quadrado com uma seta para cima).',
        'Role as opções e toque em Adicionar à Tela de Início. Se necessário, toque em Editar Ações para encontrar essa opção.',
        'Confirme em Adicionar. Depois, abra o Airmed pelo ícone na Tela de Início.',
      ],
    }
  }
  if (/Macintosh|Mac OS X/.test(ua) || a.platform === 'MacIntel') {
    return {
      titulo: 'Instalar no Mac', onde: 'no Dock',
      passos: ['No Safari, abra o menu Arquivo e escolha Adicionar ao Dock.', 'Confirme o nome Airmed e clique em Adicionar.', 'Se essa opção não aparecer, confira a atualização do Safari ou abra no Chrome ou Edge e procure Instalar no menu do navegador.'],
    }
  }
  return {
    titulo: 'Instalar o Airmed', onde: 'na Tela de Início',
    passos: ['Abra o menu do navegador (três pontos ou três linhas).', 'Procure Instalar app ou Adicionar à Tela de Início e confirme.', 'Se a opção não aparecer, abra este endereço no Chrome, Edge ou, no iPhone e iPad, no Safari.'],
  }
}

const emTelaCheia = () => { try { return !!window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true } catch { return false } }
export const instalacao = reactive({ instalado: emTelaCheia(), convite: false, instrucoes: false })
let convite = null
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); convite = e; instalacao.convite = true })
window.addEventListener('appinstalled', () => { convite = null; instalacao.convite = false; instalacao.instalado = true })

// Abre o convite; sem convite (ou convite que falhou), mostra os passos.
export async function instalarApp() {
  const e = convite
  if (!e || typeof e.prompt !== 'function') { instalacao.instrucoes = true; return 'instrucoes' }
  try {
    await e.prompt()
    const r = await e.userChoice
    if (!r || !['accepted', 'dismissed'].includes(r.outcome)) { instalacao.instrucoes = true; return 'instrucoes' }
    return r.outcome === 'accepted' ? 'aceito' : 'recusado'
  } catch { instalacao.instrucoes = true; return 'instrucoes' } finally { convite = null; instalacao.convite = false }
}
