// Backup no Google Drive sem servidor: conexão, envio conferido, lista, download e exclusão protegida.
import { reactive } from 'vue'
import { google } from './google.js'
import { ErroNuvem } from './comum.js'
import { conferirEnvio, manterCopias, excluirCopiaSegura } from './protecao.js'
import { validarComSessao } from '../backup.js'

export { ErroNuvem }
const CHAVE = 'airmed:nuvem:estado'
// Vínculo escolhido neste aparelho (só marcas e datas). Não é prova de token ativo.
function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null') || {} } catch { return {} } }
export const nuvem = reactive({ conectado: false, ultimoEnvio: null, ultimoErro: null, precisaReconectar: false, avisoRetencao: null, ...ler(), ocupado: false })
function gravar() {
  const { ocupado, ...resto } = nuvem
  try { localStorage.setItem(CHAVE, JSON.stringify(resto)) } catch { /* ignora */ }
}
export const nuvemDisponivel = () => google.configurado()
export const prepararNuvem = () => google.preparar()
export const temSessaoNuvem = () => google.temSessao()

async function operar(fn, { marcarErro = true } = {}) {
  nuvem.ocupado = true
  try { return await fn() } catch (e) {
    const erro = e instanceof ErroNuvem ? e : new ErroNuvem('outro', e?.message || 'Não foi possível falar com o Google Drive.')
    if (marcarErro && erro.codigo !== 'cancelado' && erro.codigo !== 'config') {
      nuvem.ultimoErro = { codigo: erro.codigo, mensagem: erro.message, em: new Date().toISOString() }
      if (erro.codigo === 'auth' || erro.codigo === 'permissao') nuvem.precisaReconectar = true
      gravar()
    }
    throw erro
  } finally { nuvem.ocupado = false }
}

export function conectarNuvem() {
  return operar(async () => {
    await google.conectar()
    await google.listar() // confirma o acesso de verdade
    Object.assign(nuvem, { conectado: true, ultimoErro: null, precisaReconectar: false })
    gravar()
  })
}
export async function desconectarNuvem() {
  try { await google.desconectar() } catch { /* ignora */ }
  Object.assign(nuvem, { conectado: false, ultimoErro: null, precisaReconectar: false, avisoRetencao: null })
  gravar()
}
export function esquecerNuvem() {
  try { localStorage.removeItem(CHAVE) } catch { /* ignora */ }
  Object.assign(nuvem, { conectado: false, ultimoEnvio: null, ultimoErro: null, precisaReconectar: false, avisoRetencao: null })
  return google.desconectar().catch(() => {})
}

// Envia o texto já trancado, confere a cópia e só então cuida das antigas. Falha na limpeza não invalida o envio.
export function enviarParaNuvem(nome, texto) {
  return operar(async () => {
    await google.conectar()
    const enviado = await google.enviar(nome, texto)
    await conferirEnvio(google, enviado, texto, validarComSessao)
    nuvem.avisoRetencao = null
    try { await manterCopias(google, validarComSessao) } catch (e) { nuvem.avisoRetencao = e.message }
    Object.assign(nuvem, { conectado: true, ultimoEnvio: new Date().toISOString(), ultimoErro: null, precisaReconectar: false })
    gravar()
    return nome
  })
}
export const listarNuvem = () => operar(async () => { await google.conectar(); return (await google.listar()).sort((a, b) => b.data - a.data) }, { marcarErro: false })
export const baixarDaNuvem = (item) => operar(() => google.baixar(item), { marcarErro: false })
export const excluirDaNuvem = (item) => operar(() => excluirCopiaSegura(google, item, validarComSessao), { marcarErro: false })
