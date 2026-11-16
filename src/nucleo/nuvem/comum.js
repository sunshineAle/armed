// Peças comuns do backup em nuvem (portadas do Dagda Capital). O arquivo já chega aqui trancado: nada sai em claro.
export class ErroNuvem extends Error {
  constructor(codigo, mensagem) { super(mensagem); this.name = 'ErroNuvem'; this.codigo = codigo }
}
// codigo: 'config' | 'auth' | 'permissao' | 'rede' | 'cota' | 'servidor' | 'cancelado' | 'outro'

// Chama a API com o token do provedor. 401: renova uma vez e repete. Os outros erros viram texto em português.
export async function chamar(prov, url, opcoes = {}) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const headers = { ...(opcoes.headers || {}), Authorization: 'Bearer ' + (await prov.token()) }
    let r
    try { r = await fetch(url, { ...opcoes, headers }) } catch { throw new ErroNuvem('rede', `Sem conexão com ${prov.nome}. Verifique a internet e tente de novo.`) }
    if (r.status === 401) {
      if (tentativa === 0) { await prov.renovar(true); continue }
      throw new ErroNuvem('auth', `A sessão com ${prov.nome} expirou. Conecte a conta de novo.`)
    }
    if (r.ok) return r
    let corpo = ''
    try { corpo = await r.text() } catch { /* sem corpo */ }
    if (r.status === 403 || r.status === 429 || r.status === 507) {
      if (/quota|storageQuota|insufficientStorage|quotaLimitReached/i.test(corpo) || r.status === 507) throw new ErroNuvem('cota', `Sem espaço livre no ${prov.nome}. Libere espaço e tente de novo.`)
      if (r.status === 429 || /rateLimit|throttl|too ?many/i.test(corpo)) throw new ErroNuvem('servidor', `${prov.nome} pediu para esperar um pouco. Tente de novo em alguns minutos.`)
      throw new ErroNuvem('permissao', `${prov.nome} negou a permissão. Reconecte a conta e aceite o acesso à área do app.`)
    }
    if (r.status === 404) throw new ErroNuvem('outro', `Arquivo não encontrado no ${prov.nome}.`)
    if (r.status >= 500) throw new ErroNuvem('servidor', `${prov.nome} está indisponível agora (erro ${r.status}). Tente mais tarde.`)
    throw new ErroNuvem('outro', `${prov.nome} recusou o pedido (erro ${r.status}).`)
  }
  throw new ErroNuvem('auth', `A sessão com ${prov.nome} expirou. Conecte a conta de novo.`)
}
