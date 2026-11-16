// Acesso no aparelho, na mesma lógica do Dagda Capital. Não existe servidor: fica só um hash da senha (PBKDF2 + sal).
// No cadastro o app cria uma CHAVE MESTRA aleatória (é ela que tranca os backups) e uma CHAVE DE RECUPERAÇÃO de
// 24 caracteres. A chave mestra fica guardada embrulhada duas vezes: pela senha e pela chave de recuperação.
// Trocar a senha não invalida os backups; a chave de recuperação substitui a senha esquecida.
import { reactive } from 'vue'
import { kvGet, kvSet } from './idb.js'

const CHAVE = 'airmed:acesso'
const FALHAS = 'airmed:acesso:falhas'
const AUTO = 'airmed:acesso:auto'
export const ajuste = { iteracoes: 250000 } // os testes baixam este número
const enc = new TextEncoder()

export const b64 = (bytes) => { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
export const deB64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0))
const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n))
const iguais = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0 }
const guarda = {
  ler: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } },
  por: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* segue em memória */ } },
  tirar: (k) => { try { localStorage.removeItem(k) } catch { /* ignora */ } },
}

async function derivar(senha, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, base, 256))
}

let registro = null
let senhaMemoria = null // só durante a sessão
let mestraMemoria = null // Uint8Array(32), só durante a sessão
export const acesso = reactive({ configurada: false, desbloqueado: false, apelido: '', pin: false, recPendente: false, biometria: false })

function espelhar() {
  acesso.configurada = !!registro
  acesso.apelido = registro?.apelido || ''
  acesso.pin = !!registro?.pin
  acesso.recPendente = !!registro && !registro.rec_confirmada
}
function gravarRegistro(r) { registro = r; guarda.por(CHAVE, r); espelhar() }
export function carregarAcesso() {
  const r = guarda.ler(CHAVE)
  registro = r?.hash && r?.sal ? r : null
  espelhar()
  return !!registro
}
export const chaveMestraDaSessao = () => mestraMemoria
export const embrulhoSenha = () => registro?.ms || null
export const embrulhoRecuperacao = () => registro?.rec || null

// Senha (6+ caracteres) ou PIN numérico (4 a 12 números).
export const ehPin = (s) => /^\d+$/.test(s || '')
export function validarNovaSenha(s) {
  if (!s) return 'Informe a senha ou o PIN.'
  if (ehPin(s)) {
    if (s.length < 4) return 'O PIN precisa ter pelo menos 4 números.'
    if (s.length > 12) return 'O PIN pode ter até 12 números.'
    return ''
  }
  if (s.length < 6) return 'Use uma senha com pelo menos 6 caracteres ou um PIN de 4 a 12 números.'
  return ''
}
export function validarApelido(a) {
  const t = String(a || '').trim()
  if (!t) return 'Informe um apelido.'
  if (t.length > 30) return 'O apelido pode ter até 30 caracteres.'
  return ''
}

// ---- Chave mestra embrulhada por um segredo (senha ou chave de recuperação) ----
async function chaveAes(segredo, sal, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(segredo), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function embrulharMestra(mestra, segredo, iter = ajuste.iteracoes) {
  const sal = aleatorio(16); const iv = aleatorio(12)
  const k = await chaveAes(segredo, sal, iter)
  return { sal: b64(sal), iv: b64(iv), iter, ct: b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, mestra))) }
}
export async function desembrulharMestra(emb, segredo) {
  if (!emb) return null
  try {
    const k = await chaveAes(segredo, deB64(emb.sal), emb.iter || ajuste.iteracoes)
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(emb.iv) }, k, deB64(emb.ct)))
  } catch { return null }
}

// Cria ou troca a senha. Mantém a chave mestra que já existe (troca de senha, recuperação, restauração).
export async function criarSenha(senha, apelido) {
  const erro = validarNovaSenha(senha)
  if (erro) throw new Error(erro)
  const nome = apelido !== undefined ? String(apelido || '').trim() : acesso.apelido
  if (nome) { const e2 = validarApelido(nome); if (e2) throw new Error(e2) }
  const sal = aleatorio(16)
  const hash = await derivar(senha, sal, ajuste.iteracoes)
  const nova = mestraMemoria === null
  const mestra = mestraMemoria || aleatorio(32)
  const base = registro && !nova ? { rec: registro.rec, rec_confirmada: registro.rec_confirmada, rec_cod: registro.rec_cod } : {}
  gravarRegistro({
    v: 2, iter: ajuste.iteracoes, sal: b64(sal), hash: b64(hash), apelido: nome || undefined, pin: ehPin(senha),
    criada_em: registro?.criada_em || new Date().toISOString(), ...base, ms: await embrulharMestra(mestra, senha),
  })
  mestraMemoria = mestra
  senhaMemoria = senha
  acesso.desbloqueado = true
  await reembrulharBiometria()
}
export function definirApelido(a) {
  const e = validarApelido(a)
  if (e) throw new Error(e)
  if (registro) gravarRegistro({ ...registro, apelido: String(a).trim() })
}

// Tentativas erradas: a partir da quinta, espera crescente (até 5 minutos).
export function esperaAteTentar() {
  const t = guarda.ler(FALHAS)
  return t ? Math.max(0, Math.ceil((t.ate - Date.now()) / 1000)) : 0
}
function registrarFalha() {
  const t = guarda.ler(FALHAS) || { n: 0, ate: 0 }
  t.n += 1
  const seg = t.n >= 5 ? Math.min(300, 2 ** (t.n - 4) * 5) : 0
  t.ate = Date.now() + seg * 1000
  guarda.por(FALHAS, t)
}
const zerarFalhas = () => guarda.tirar(FALHAS)

export async function conferirSenha(senha) {
  if (!registro) return false
  return iguais(await derivar(senha, deB64(registro.sal), registro.iter || ajuste.iteracoes), deB64(registro.hash))
}
export async function verificarSenha(senha) {
  const espera = esperaAteTentar()
  if (espera > 0) throw new Error(`Muitas tentativas. Aguarde ${espera}s.`)
  if (!(await conferirSenha(senha))) { registrarFalha(); return false }
  zerarFalhas()
  senhaMemoria = senha
  mestraMemoria = await desembrulharMestra(registro.ms, senha)
  acesso.desbloqueado = true
  return true
}
export async function alterarSenha(atual, nova) {
  if (!(await conferirSenha(atual))) throw new Error('A senha atual não confere.')
  const erro = validarNovaSenha(nova)
  if (erro) throw new Error(erro)
  await criarSenha(nova)
}

// Bloquear = recarregar o app: a senha e a chave somem da memória e a tela de acesso volta.
export function bloquear() { location.reload() }
export const minutosAutoBloqueio = () => { const v = guarda.ler(AUTO); return v === null ? 5 : Number(v) }
export const definirAutoBloqueio = (min) => guarda.por(AUTO, min)
let autoLigado = false
export function iniciarAutoBloqueio() {
  if (autoLigado) return
  autoLigado = true
  let saiu = 0
  const voltar = () => {
    const min = minutosAutoBloqueio(); const t = saiu; saiu = 0
    if (acesso.desbloqueado && min > 0 && t && Date.now() - t > min * 60000) bloquear()
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { if (!saiu) saiu = Date.now() } else voltar() })
}

// ---- Desbloqueio por digital, rosto ou PIN do celular (WebAuthn) ----
// A biometria só AUTORIZA a tela de entrada. Ao ativar (com o app já aberto pela senha), o app cria uma chave que ele
// mesmo não consegue exportar e guarda a senha trancada por ela. Biometria aprovada -> abre a senha -> passa pela
// mesma conferência da senha. A senha continua valendo sempre; trocar a senha reembrulha.
const CHAVE_BIO = 'airmed:bio'
let registroBio = null
export async function biometriaSuportada() {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials || !crypto.subtle) return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}
export async function carregarBiometria() {
  try { registroBio = (await kvGet(CHAVE_BIO)) || null } catch { registroBio = null }
  if (registroBio && !(registroBio.chave && registroBio.ct && registroBio.cred)) registroBio = null
  acesso.biometria = !!registroBio
  return !!registroBio
}
// Espelho rápido: a tela de entrada decide o botão antes de o IndexedDB responder.
export const biometriaMarcada = () => { try { return localStorage.getItem(CHAVE_BIO) === '1' } catch { return false } }
const trancar = async (senha, chave, iv) => new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(senha)))
async function marcarBio(reg) {
  registroBio = reg
  try { reg ? localStorage.setItem(CHAVE_BIO, '1') : localStorage.removeItem(CHAVE_BIO) } catch { /* ignora */ }
  try { await kvSet(CHAVE_BIO, reg) } catch { /* sem IndexedDB */ }
  acesso.biometria = !!reg
}
async function reembrulharBiometria() {
  if (!registroBio || senhaMemoria === null) return
  try { const iv = aleatorio(12); await marcarBio({ ...registroBio, iv, ct: await trancar(senhaMemoria, registroBio.chave, iv) }) } catch { await desativarBiometria() }
}
export async function ativarBiometria() {
  if (senhaMemoria === null) throw new Error('Desbloqueie o app com a senha antes de ativar.')
  if (!(await biometriaSuportada())) throw new Error('Este aparelho não oferece desbloqueio por biometria.')
  let cred
  try {
    cred = await navigator.credentials.create({ publicKey: {
      challenge: aleatorio(32),
      rp: { name: 'Airmed' },
      user: { id: aleatorio(16), name: acesso.apelido || 'usuario', displayName: acesso.apelido || 'Usuário' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none',
    } })
  } catch (e) { throw new Error(e?.name === 'NotAllowedError' ? 'Ativação cancelada.' : 'Não foi possível ativar a biometria neste aparelho.') }
  if (!cred) throw new Error('Não foi possível ativar a biometria.')
  const chave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const iv = aleatorio(12)
  await marcarBio({ v: 1, cred: new Uint8Array(cred.rawId), chave, iv, ct: await trancar(senhaMemoria, chave, iv), criada_em: new Date().toISOString() })
}
export async function desativarBiometria() { await marcarBio(null) }
export async function desbloquearComBiometria() {
  if (!registroBio) await carregarBiometria()
  if (!registroBio) throw new Error('A biometria não está ativada neste aparelho.')
  try {
    await navigator.credentials.get({ publicKey: {
      challenge: aleatorio(32), timeout: 60000, userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: registroBio.cred, transports: ['internal'] }],
    } })
  } catch (e) { throw new Error(e?.name === 'NotAllowedError' ? 'Desbloqueio cancelado. Use a senha ou PIN.' : 'Não foi possível usar a biometria. Use a senha ou PIN.') }
  let senha
  try { senha = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: registroBio.iv }, registroBio.chave, registroBio.ct)) }
  catch { await desativarBiometria(); throw new Error('A biometria precisa ser ativada de novo. Use a senha ou PIN.') }
  if (!(await conferirSenha(senha))) { await desativarBiometria(); throw new Error('A senha mudou. Use a senha ou PIN e ative a biometria de novo.') }
  zerarFalhas()
  senhaMemoria = senha
  mestraMemoria = await desembrulharMestra(registro.ms, senha)
  acesso.desbloqueado = true
  return true
}

// ---- Chave de recuperação (24 caracteres, sem 0/O nem 1/I) ----
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function gerarCodigo() {
  const b = aleatorio(24)
  let t = ''
  for (let i = 0; i < 24; i++) t += ALFABETO[b[i] % 32]
  return t.match(/.{4}/g).join('-')
}
export const normalizarCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const codigoValido = (c) => { const n = normalizarCodigo(c); return n.length === 24 && [...n].every((x) => ALFABETO.includes(x)) }

const chaveDaMestra = (uso) => crypto.subtle.importKey('raw', mestraMemoria, { name: 'AES-GCM' }, false, uso)
// Gera uma chave NOVA. A anterior deixa de abrir os backups futuros; os antigos continuam abrindo com a antiga.
export async function gerarNovoCodigo() {
  if (!mestraMemoria) throw new Error('Desbloqueie o app com a senha antes.')
  const codigo = gerarCodigo()
  const rec = await embrulharMestra(mestraMemoria, normalizarCodigo(codigo))
  const teste = await desembrulharMestra(rec, normalizarCodigo(codigo))
  if (!teste || !iguais(teste, mestraMemoria)) throw new Error('Não foi possível gerar a chave. Tente de novo.')
  const iv = aleatorio(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveDaMestra(['encrypt']), enc.encode(codigo))
  gravarRegistro({ ...registro, rec, rec_cod: { iv: b64(iv), ct: b64(new Uint8Array(ct)) }, rec_confirmada: false })
  return codigo
}
export const temCodigoVisivel = () => !!(registro?.rec && registro?.rec_cod)
export async function verCodigoAtual(senha) {
  if (!(await verificarSenha(senha))) throw new Error('Senha ou PIN incorreto.')
  if (!registro.rec) throw new Error('Ainda não há código de recuperação. Gere um novo.')
  if (!registro.rec_cod || !mestraMemoria) throw new Error('A chave atual não pode ser mostrada neste aparelho. Gere uma nova.')
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(registro.rec_cod.iv) }, await chaveDaMestra(['decrypt']), deB64(registro.rec_cod.ct))
    return new TextDecoder().decode(pt)
  } catch { throw new Error('Não foi possível abrir a chave atual. Gere uma nova.') }
}
export function confirmarCodigoGuardado() { if (registro) gravarRegistro({ ...registro, rec_confirmada: true }) }

// "Esqueci a senha": a chave de recuperação abre a chave mestra deste aparelho e libera criar uma senha nova.
export async function entrarComCodigo(codigo) {
  if (!codigoValido(codigo)) throw new Error('Confira o código: são 24 letras e números (ex.: ABCD-EFGH-…).')
  const espera = esperaAteTentar()
  if (espera > 0) throw new Error(`Muitas tentativas. Aguarde ${espera}s.`)
  const m = registro?.rec ? await desembrulharMestra(registro.rec, normalizarCodigo(codigo)) : null
  if (!m) { registrarFalha(); throw new Error(registro && !registro.rec ? 'Este aparelho ainda não tem código de recuperação. Restaure um backup com o código.' : 'Código de recuperação incorreto.') }
  zerarFalhas()
  mestraMemoria = m
  return true
}
export async function redefinirSenhaComCodigo(nova) {
  if (!mestraMemoria) throw new Error('Entre com o código de recuperação primeiro.')
  await criarSenha(nova)
}

// Restauração num aparelho novo: adota a chave mestra e o embrulho da chave de recuperação vindos do backup
// (a mesma chave de recuperação continua valendo).
let adotarRec
export function adotarMestra(mestra, rec) { mestraMemoria = mestra; adotarRec = rec || null }
export function aplicarRecAdotado() {
  if (adotarRec === undefined || !registro) return
  gravarRegistro({ ...registro, rec: adotarRec, rec_cod: null, rec_confirmada: !!adotarRec })
  adotarRec = undefined
}

// Apaga a senha, a chave de recuperação e o que estava em memória (os dados são apagados em dados.js).
export function apagarAcesso() {
  for (const k of [CHAVE, FALHAS, AUTO]) guarda.tirar(k)
  registro = null; senhaMemoria = null; mestraMemoria = null; adotarRec = undefined
  marcarBio(null).catch(() => {})
  acesso.desbloqueado = false
  espelhar()
}
export const senhaDaSessao = () => senhaMemoria
