// Os dados ficam só neste aparelho (armazenamento do navegador). Nada vai para servidor.
import { reactive, watch, computed } from 'vue'
import { dataISO, minDe, horaDe } from './tempo.js'
import { CATEGORIAS_PADRAO } from './formas.js'

const CHAVE = 'airmed-teste:v1'

const vazio = () => ({
  versao: 1, iniciado: false, demo: false,
  remedios: [], rotinas: [], registros: [],
  adiados: {}, avisados: {},
  categorias: [...CATEGORIAS_PADRAO],
  prefs: { modo: 'sistema', nomeNaNotificacao: false, vista: 'periodo' },
  backup: { ultimo: null, ultimoDestino: null, intervalo: 'semanal', desde: null },
})

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE))
    // Quem estava com dados fictícios (versões de teste antigas) começa limpo.
    if (salvo?.versao === 1 && !salvo.demo) return { ...vazio(), ...salvo, prefs: { ...vazio().prefs, ...salvo.prefs }, backup: { ...vazio().backup, ...salvo.backup } }
  } catch { /* começa do zero */ }
  return vazio()
}

export const estado = reactive(carregar())
watch(estado, () => {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)) } catch { /* sem espaço: segue em memória */ }
}, { deep: true })

export const relogio = reactive({ agora: new Date() })
export const hoje = computed(() => dataISO(relogio.agora))
export const agoraMin = computed(() => minDe(relogio.agora))

export const novoId = () => Math.random().toString(36).slice(2, 10)
export const remedioPor = (id) => estado.remedios.find((r) => r.id === id)
export const rotinaPor = (id) => estado.rotinas.find((r) => r.id === id)
export const registroDe = (chave) => estado.registros.find((g) => g.chave === chave) || null

// em: hora real em que foi feito (Date). Guarda a hora real, não a marcada.
export function marcar(oc, comoFoi, em = new Date()) {
  desfazer(oc.chave)
  estado.registros.push({
    chave: oc.chave, tipo: oc.tipo, refId: oc.refId, data: oc.data, hora: oc.hora,
    estado: comoFoi, em: em.toISOString(), horaReal: horaDe(em), qtd: oc.qtd ?? null,
  })
  if (oc.tipo === 'rem' && comoFoi === 'feito') mexerEstoque(oc.refId, -(oc.qtd ?? 1))
  delete estado.adiados[`${oc.data}:${oc.hora}`]
}

export function desfazer(chave) {
  const i = estado.registros.findIndex((g) => g.chave === chave)
  if (i < 0) return
  const [g] = estado.registros.splice(i, 1)
  if ((g.tipo === 'rem' || g.tipo === 'sos') && g.estado === 'feito') mexerEstoque(g.refId, g.qtd ?? 1)
}

function mexerEstoque(id, delta) {
  const r = remedioPor(id)
  if (r?.estoque?.tipo === 'contado') r.estoque.qtd = Math.max(Math.round((r.estoque.qtd + delta) * 100) / 100, 0)
}

export function tomarSOS(r, em = new Date()) {
  const g = {
    chave: `sos:${r.id}:${em.getTime()}`, tipo: 'sos', refId: r.id, data: dataISO(em), hora: null,
    estado: 'feito', em: em.toISOString(), horaReal: horaDe(em), qtd: r.dose ?? 1,
  }
  estado.registros.push(g)
  mexerEstoque(r.id, -(r.dose ?? 1))
  return g
}

export function salvarRemedio(r) {
  const i = estado.remedios.findIndex((x) => x.id === r.id)
  if (i >= 0) estado.remedios[i] = r
  else estado.remedios.push({ ...r, id: novoId(), paraQuem: 'eu', criadoEm: new Date().toISOString() })
}
export function apagarRemedio(id) {
  estado.remedios = estado.remedios.filter((r) => r.id !== id)
  estado.registros = estado.registros.filter((g) => !(g.refId === id && g.tipo !== 'rot'))
}
export function salvarRotina(t) {
  if (t.categoria && !estado.categorias.includes(t.categoria)) estado.categorias.push(t.categoria)
  const i = estado.rotinas.findIndex((x) => x.id === t.id)
  if (i >= 0) estado.rotinas[i] = t
  else estado.rotinas.push({ ...t, id: novoId(), criadoEm: new Date().toISOString() })
}
export function apagarRotina(id) {
  estado.rotinas = estado.rotinas.filter((r) => r.id !== id)
  estado.registros = estado.registros.filter((g) => !(g.refId === id && g.tipo === 'rot'))
}

export function adiar(data, hora, min = 10) {
  estado.adiados[`${data}:${hora}`] = Date.now() + min * 60000
}

export function comecar() {
  Object.assign(estado, vazio(), { iniciado: true, prefs: estado.prefs })
  estado.backup.desde = new Date().toISOString()
}
export function apagarTudo() {
  Object.assign(estado, vazio(), { prefs: estado.prefs })
}

// O que vai para o arquivo de backup: tudo, menos o que é só deste momento (adiados e avisos do dia).
// O apelido viaja DENTRO do conteúdo trancado, nunca por fora.
export function paraBackup(apelido = '') {
  const { adiados, avisados, backup, ...resto } = JSON.parse(JSON.stringify(estado))
  return { ...resto, perfil: { apelido } }
}
export function backupFeito(destino, quando = new Date()) {
  estado.backup = { ...estado.backup, ultimo: quando.toISOString(), ultimoDestino: destino }
}
// Troca o que está no aparelho pelo conteúdo do backup.
export function restaurar(dados, feitoEm) {
  const { perfil, ...resto } = dados
  Object.assign(estado, vazio(), resto, {
    iniciado: true, demo: false, adiados: {}, avisados: {},
    prefs: { ...vazio().prefs, ...(dados.prefs || {}) },
    backup: { ...estado.backup, ultimo: feitoEm || null, desde: estado.backup.desde || new Date().toISOString() },
  })
}
export const temDados = () => estado.remedios.length + estado.rotinas.length > 0
