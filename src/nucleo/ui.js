import { reactive } from 'vue'

export const ui = reactive({ tela: 'hoje', janelas: [], alarme: null, aviso: null })

export function irPara(tela) {
  ui.tela = tela
  window.scrollTo(0, 0)
}
// Janela por cima (sobe de baixo). Aceita uma janela sobre a outra.
export function abrir(nome, props = {}) {
  ui.aviso = null
  ui.janelas.push({ nome, props, id: Date.now() + Math.random() })
}
export function fechar() {
  ui.janelas.pop()
}
let relogioAviso
export function avisar(texto, acao = null) {
  clearTimeout(relogioAviso)
  ui.aviso = { texto, acao }
  relogioAviso = setTimeout(() => { ui.aviso = null }, 6000)
}
