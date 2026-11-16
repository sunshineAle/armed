// Google Drive (portado do Dagda Capital). O vínculo local não é uma credencial: o token e as permissões ficam só na
// memória. O app usa só a ÁREA OCULTA do próprio app no Drive (drive.appdata): não enxerga nenhum outro arquivo seu.
import { ErroNuvem, chamar } from './comum.js'
import { GOOGLE_CLIENT_ID } from '../../config.js'

const ESCOPO = 'https://www.googleapis.com/auth/drive.appdata'
const VINCULO = 'airmed:google:vinculo'
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
// A área oculta é dividida com o Dagda Capital (mesma conexão). O Airmed só lista, baixa e apaga arquivos com este nome.
export const EH_DO_AIRMED = /^airmed-backup-[\d-]+\.airmed$/
let gisCarregando = null
let tokenAtual = null // { valor, expira, escopos }: nunca persistido
let requisicaoAtual = null
let cancelarPedido = null
let interacaoPendente = null // só depois de o Google informar que precisa de interação
const escoposDe = (e) => String(e || '').split(/\s+/).filter(Boolean)
const tokenServe = () => !!(tokenAtual && tokenAtual.expira - 60000 > Date.now() && tokenAtual.escopos.includes(ESCOPO))
function vinculado() {
  try { const v = JSON.parse(localStorage.getItem(VINCULO) || 'null'); return v?.clientId === GOOGLE_CLIENT_ID && v.escopos?.includes(ESCOPO) } catch { return false }
}
function carregarGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisCarregando) return gisCarregando
  gisCarregando = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true
    s.onload = () => resolve()
    s.onerror = () => { gisCarregando = null; s.remove(); reject(new ErroNuvem('rede', 'Não foi possível carregar o login do Google. Verifique a internet.')) }
    document.head.appendChild(s)
  })
  return gisCarregando
}
function erroDeAutorizacao(r) {
  const codigo = r?.error
  if (codigo === 'consent_required' || codigo === 'invalid_scope') interacaoPendente = 'consent'
  else if (codigo === 'login_required' || codigo === 'interaction_required') interacaoPendente = 'select_account'
  if (codigo === 'access_denied') return new ErroNuvem('cancelado', 'Conexão cancelada.')
  return new ErroNuvem('auth', 'A sessão Google precisa de uma nova confirmação. Toque em conectar novamente.')
}
async function pedirToken(prompt) {
  if (!GOOGLE_CLIENT_ID) throw new ErroNuvem('config', 'Google Drive ainda não foi configurado neste app.')
  await carregarGis()
  if (requisicaoAtual) {
    await requisicaoAtual.catch(() => {})
    if (tokenServe()) return
    return pedirToken(prompt)
  }
  const atual = new Promise((resolve, reject) => {
    let encerrado = false
    const concluir = (erro) => { if (encerrado) return; encerrado = true; clearTimeout(limite); erro ? reject(erro) : resolve() }
    cancelarPedido = () => concluir(new ErroNuvem('cancelado', 'Conexão cancelada.'))
    const limite = setTimeout(() => concluir(new ErroNuvem('auth', 'O Google não respondeu. Toque em conectar para tentar novamente.')), prompt === '' ? 20000 : 180000)
    try {
      const cliente = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: ESCOPO, include_granted_scopes: true,
        callback: (r) => {
          if (encerrado) return
          if (!r || r.error || !r.access_token) { concluir(erroDeAutorizacao(r)); return }
          // O pedido não prova a concessão: valem só os escopos e a validade da resposta real.
          const recebidos = escoposDe(r.scope)
          const segundos = Number(r.expires_in)
          if (!recebidos.length || !Number.isFinite(segundos) || segundos <= 0) { concluir(new ErroNuvem('auth', 'O Google não confirmou as permissões e a validade da sessão. Conecte novamente.')); return }
          if (!recebidos.includes(ESCOPO)) { interacaoPendente = 'consent'; concluir(new ErroNuvem('permissao', 'O Google não autorizou a área do app. Conecte de novo e aceite a permissão.')); return }
          tokenAtual = { valor: r.access_token, expira: Date.now() + segundos * 1000, escopos: recebidos }
          // Só metadados públicos: nem token, nem senha, nem a identidade da conta vão para o aparelho.
          try { localStorage.setItem(VINCULO, JSON.stringify({ clientId: GOOGLE_CLIENT_ID, escopos: [ESCOPO] })) } catch { /* segue só na memória */ }
          interacaoPendente = null
          concluir()
        },
        error_callback: (e) => {
          if (encerrado) return
          const fechou = e?.type === 'popup_closed'
          if (!fechou) interacaoPendente = 'select_account'
          concluir(new ErroNuvem(fechou ? 'cancelado' : 'auth', fechou ? 'Conexão cancelada.' : 'Não foi possível abrir o login do Google. Toque em conectar e permita a janela.'))
        },
      })
      cliente.requestAccessToken({ prompt })
    } catch { concluir(new ErroNuvem('auth', 'Não foi possível iniciar a conexão Google. Tente novamente.')) }
  })
  requisicaoAtual = atual
  try { await atual } finally { if (requisicaoAtual === atual) { requisicaoAtual = null; cancelarPedido = null } }
}

export const google = {
  id: 'google', nome: 'Google Drive',
  preparar: () => carregarGis().catch(() => {}),
  configurado: () => !!GOOGLE_CLIENT_ID,
  // Conectar reutiliza a sessão quando dá; só abre a tela do Google quando é preciso.
  async conectar() { if (!tokenServe()) await pedirToken(interacaoPendente || (vinculado() ? '' : 'consent')) },
  // Renovação silenciosa durante as chamadas: nunca força uma tela nova. Se falhar, um toque em conectar resolve.
  async renovar(forcar = false) { if (forcar) tokenAtual = null; await pedirToken('') },
  async token() { if (!tokenServe()) await this.renovar(); return tokenAtual.valor },
  async desconectar() {
    cancelarPedido?.()
    const t = tokenAtual?.valor; tokenAtual = null; interacaoPendente = null
    try { localStorage.removeItem(VINCULO) } catch { /* sem marca local */ }
    try { if (t) window.google?.accounts?.oauth2?.revoke(t, () => {}) } catch { /* ignora */ }
  },
  async enviar(nome, texto) {
    const limite = '----airmed' + Math.random().toString(16).slice(2)
    const corpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nome, parents: ['appDataFolder'], mimeType: 'application/octet-stream' })}\r\n--${limite}\r\nContent-Type: application/octet-stream\r\n\r\n${texto}\r\n--${limite}--`
    const r = await chamar(this, `${UPLOAD}?uploadType=multipart&fields=id,name`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: corpo })
    return r.json()
  },
  async listar() {
    const arquivos = []
    let pagina
    do {
      const q = new URLSearchParams({ spaces: 'appDataFolder', orderBy: 'createdTime desc', pageSize: '100', fields: 'nextPageToken,files(id,name,size,createdTime)', q: "trashed = false and name contains 'airmed-backup-'" })
      if (pagina) q.set('pageToken', pagina)
      const j = await (await chamar(this, `${API}/files?${q}`)).json()
      arquivos.push(...(j.files || []))
      pagina = j.nextPageToken
    } while (pagina)
    return arquivos.filter((f) => EH_DO_AIRMED.test(f.name)).map((f) => ({ id: f.id, nome: f.name, tamanho: Number(f.size) || 0, data: Date.parse(f.createdTime) || 0 }))
  },
  async baixar(item) { return (await chamar(this, `${API}/files/${encodeURIComponent(item.id)}?alt=media`)).text() },
  async apagar(item) { await chamar(this, `${API}/files/${encodeURIComponent(item.id)}`, { method: 'DELETE' }) },
}
