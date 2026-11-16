// Backup do Airmed, na mesma lógica do Dagda Capital: o conteúdo é compactado e trancado pela CHAVE MESTRA do aparelho.
// A chave mestra viaja dentro do arquivo embrulhada duas vezes: pela senha de acesso e pela chave de recuperação.
// Quem abre: a senha de acesso da época do backup ou a chave de recuperação. Por fora só ficam data e parâmetros.
import {
  b64, deB64, chaveMestraDaSessao, embrulhoSenha, embrulhoRecuperacao, desembrulharMestra,
  normalizarCodigo, codigoValido,
} from './acesso.js'

export const INTERVALOS = [
  { id: 'desligado', rotulo: 'Sem lembrete', dias: 0 },
  { id: 'diario', rotulo: 'Todo dia', dias: 1 },
  { id: 'semanal', rotulo: 'Toda semana', dias: 7 },
  { id: 'quinzenal', rotulo: 'A cada 15 dias', dias: 15 },
  { id: 'mensal', rotulo: 'Todo mês', dias: 30 },
]
export class ErroBackup extends Error {}

async function fluxo(bytes, Transform) {
  const t = new Transform('gzip')
  const w = t.writable.getWriter()
  w.write(bytes); w.close()
  return new Uint8Array(await new Response(t.readable).arrayBuffer())
}
const temGzip = () => typeof CompressionStream !== 'undefined'

export async function empacotar(dados, agora = new Date()) {
  const mestra = chaveMestraDaSessao()
  if (!mestra || !embrulhoSenha()) throw new ErroBackup('Desbloqueie o app com a senha de acesso para fazer o backup.')
  const env = { airmed: 1, criado_em: agora.toISOString(), compressao: null, criptografia: null, dados: null }
  let bytes = new TextEncoder().encode(JSON.stringify(dados))
  if (temGzip()) { bytes = await fluxo(bytes, CompressionStream); env.compressao = 'gzip' }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const k = await crypto.subtle.importKey('raw', mestra, 'AES-GCM', false, ['encrypt'])
  bytes = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes))
  env.criptografia = { alg: 'AES-GCM-256', chave: 'mestra', iv: b64(iv), chaves: { senha: embrulhoSenha(), recuperacao: embrulhoRecuperacao() } }
  env.dados = b64(bytes)
  return JSON.stringify(env)
}

export function lerEnvelope(texto) {
  let env
  try { env = JSON.parse(texto) } catch { throw new ErroBackup('Este arquivo não é um backup do Airmed.') }
  if (env?.formato === 'airmed-backup' && env.dados && env.kdf?.sal && env.cifra?.iv) return { ...env, antigo: true }
  if (env?.airmed !== 1 || typeof env.dados !== 'string' || env.criptografia?.chave !== 'mestra') {
    if (env?.airmed > 1) throw new ErroBackup('Este backup foi feito por uma versão mais nova do Airmed.')
    throw new ErroBackup('Este arquivo não é um backup do Airmed.')
  }
  return env
}

export const validar = (d) => d?.versao === 1 && [d.remedios, d.rotinas, d.registros].every(Array.isArray)

// Abre com a senha de acesso da época ou com a chave de recuperação.
// Devolve { dados, criadoEm, mestra, rec, pelaChave } (mestra e rec servem para o aparelho novo adotar o mesmo acesso).
export async function abrirBackup(texto, segredo) {
  const env = lerEnvelope(texto)
  if (!segredo) throw new ErroBackup('Informe a senha do backup ou a chave de recuperação.')
  if (env.antigo) return abrirAntigo(env, segredo)
  const c = env.criptografia
  let pelaChave = false
  let mestra = await desembrulharMestra(c.chaves?.senha, segredo)
  if (!mestra && codigoValido(segredo)) { mestra = await desembrulharMestra(c.chaves?.recuperacao, normalizarCodigo(segredo)); pelaChave = !!mestra }
  if (!mestra) throw new ErroBackup('Senha ou chave de recuperação incorreta para este backup.')
  let bytes
  try {
    const k = await crypto.subtle.importKey('raw', mestra, 'AES-GCM', false, ['decrypt'])
    bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(c.iv) }, k, deB64(env.dados)))
    if (env.compressao === 'gzip') bytes = await fluxo(bytes, DecompressionStream)
  } catch { throw new ErroBackup('O conteúdo do backup está corrompido.') }
  return conferir(bytes, { criadoEm: env.criado_em, mestra, rec: c.chaves?.recuperacao || null, pelaChave })
}

// Formato da versão de teste 0.2 (senha própria do backup). Continua abrindo.
async function abrirAntigo(env, senha) {
  let bytes
  try {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey'])
    const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: deB64(env.kdf.sal), iterations: env.kdf.iteracoes }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt'])
    bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(env.cifra.iv) }, k, deB64(env.dados)))
  } catch { throw new ErroBackup('Senha errada ou arquivo danificado.') }
  return conferir(bytes, { criadoEm: env.criadoEm, mestra: null, rec: null, pelaChave: false })
}

function conferir(bytes, resto) {
  let dados
  try { dados = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new ErroBackup('O conteúdo do backup está corrompido.') }
  if (!validar(dados)) throw new ErroBackup('O conteúdo deste backup não está no formato esperado.')
  return { dados, ...resto }
}

export const nomeDoArquivo = (agora = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `airmed-backup-${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}-${p(agora.getHours())}${p(agora.getMinutes())}.txt`
}

// Dias desde o último backup (null = nunca fez).
export const diasSemBackup = (ultimo, agora = new Date()) =>
  (ultimo ? Math.max(Math.floor((agora - new Date(ultimo)) / 864e5), 0) : null)

// O lembrete conta do último backup ou, se nunca fez, do dia em que o acesso foi criado.
export function backupDevido(cfg, agora = new Date()) {
  const it = INTERVALOS.find((i) => i.id === (cfg?.intervalo || 'semanal'))
  if (!it?.dias) return false
  const desde = cfg?.ultimo || cfg?.desde
  return !desde || (agora - new Date(desde)) / 864e5 >= it.dias
}
