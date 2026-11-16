// Proteção das cópias na nuvem (portada do Dagda Capital). Regras:
// 1. Toda cópia enviada é baixada de volta, comparada e aberta antes de valer.
// 2. Ficam até 4 cópias. Uma cópia antiga só sai se outra, mais nova, abrir de verdade.
// 3. A última cópia que abre nunca é apagada. Na dúvida, sobram mais de 4.
// `validar(texto)` precisa abrir o backup com o acesso atual e rejeitar se não conseguir.
export const MANTER = 4
const ordem = (a, b) => b.data - a.data || b.nome.localeCompare(a.nome)

export async function conferirEnvio(provedor, enviado, texto, validar) {
  if (!enviado?.id) throw new Error('A nuvem não confirmou o arquivo. As cópias anteriores foram preservadas.')
  const recebido = await provedor.baixar({ id: enviado.id })
  if (recebido !== texto) throw new Error('O arquivo recebido da nuvem é diferente do enviado. Nenhuma cópia anterior foi descartada.')
  await validar(recebido)
}

export async function excluirCopiaSegura(provedor, item, validar) {
  // A lista real da nuvem é a autoridade: só sai o que está nela.
  const itens = await provedor.listar()
  const alvo = itens.find((i) => i.id === item.id)
  if (!alvo) throw new Error('Esta cópia não está mais na nuvem.')
  let outraValida = false
  for (const outra of itens.filter((i) => i.id !== alvo.id).sort(ordem)) {
    try { await validar(await provedor.baixar(outra)); outraValida = true; break } catch { /* não é prova de recuperação */ }
  }
  if (!outraValida) throw new Error('Exclusão bloqueada: não foi possível abrir outra cópia com segurança. A última cópia que abre precisa ficar.')
  await provedor.apagar(alvo)
}

export async function manterCopias(provedor, validar, manter = MANTER) {
  const itens = (await provedor.listar()).sort(ordem)
  for (const antiga of itens.slice(manter)) await excluirCopiaSegura(provedor, antiga, validar)
}
