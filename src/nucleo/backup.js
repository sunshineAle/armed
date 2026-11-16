// Backup: um arquivo criptografado com uma senha que só a pessoa sabe.
// A senha nunca é guardada. Sem ela, o arquivo não abre (não existe recuperação).
const FORMATO = 'airmed-backup'
export const ITERACOES = 600000
export const SENHA_MINIMA = 8

const b64 = (bytes) => {
  let s = ''
  const u = new Uint8Array(bytes)
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
const deB64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))

async function chave(senha, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

// Devolve o texto do arquivo. Por fora só ficam a data e os parâmetros da criptografia.
export async function cifrar(dados, senha, { iteracoes = ITERACOES, agora = new Date() } = {}) {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const k = await chave(senha, sal, iteracoes)
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(dados)))
  return JSON.stringify({
    formato: FORMATO, versao: 1, criadoEm: agora.toISOString(),
    kdf: { nome: 'PBKDF2', hash: 'SHA-256', iteracoes, sal: b64(sal) },
    cifra: { nome: 'AES-GCM', iv: b64(iv) },
    dados: b64(cifrado),
  })
}

export class ErroBackup extends Error {}

export function lerCabecalho(texto) {
  let arq
  try { arq = JSON.parse(texto) } catch { throw new ErroBackup('Este arquivo não é um backup do Airmed.') }
  if (arq?.formato !== FORMATO || !arq.dados || !arq.kdf?.sal || !arq.cifra?.iv) throw new ErroBackup('Este arquivo não é um backup do Airmed.')
  if (arq.versao !== 1) throw new ErroBackup('Este backup foi feito por uma versão mais nova do Airmed.')
  return arq
}

export async function decifrar(texto, senha) {
  const arq = lerCabecalho(texto)
  let claro
  try {
    const k = await chave(senha, deB64(arq.kdf.sal), arq.kdf.iteracoes)
    claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(arq.cifra.iv) }, k, deB64(arq.dados))
  } catch { throw new ErroBackup('Senha errada ou arquivo danificado.') }
  const dados = JSON.parse(new TextDecoder().decode(claro))
  if (!validar(dados)) throw new ErroBackup('O conteúdo deste backup não está no formato esperado.')
  return { dados, criadoEm: arq.criadoEm }
}

export const validar = (d) => d?.versao === 1 && [d.remedios, d.rotinas, d.registros].every(Array.isArray)

export const nomeDoArquivo = (agora = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `airmed-backup-${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}.txt`
}

// Dias desde o último backup (null = nunca fez).
export const diasSemBackup = (ultimo, agora = new Date()) =>
  (ultimo ? Math.max(Math.floor((agora - new Date(ultimo)) / 864e5), 0) : null)
