// A forma define o verbo do alarme e o jeito de contar o estoque.
export const FORMAS = [
  { id: 'comprimido', nome: 'Comprimido', um: 'comprimido', varios: 'comprimidos', verbo: 'Tomei', contagem: 'contado', meio: true },
  { id: 'capsula', nome: 'Cápsula', um: 'cápsula', varios: 'cápsulas', verbo: 'Tomei', contagem: 'contado' },
  { id: 'gotas', nome: 'Gotas', um: 'gota', varios: 'gotas', verbo: 'Tomei', contagem: 'nivel' },
  { id: 'xarope', nome: 'Xarope', um: 'ml', varios: 'ml', verbo: 'Tomei', contagem: 'nivel' },
  { id: 'pomada', nome: 'Pomada', um: 'aplicação', varios: 'aplicações', verbo: 'Apliquei', contagem: 'nivel' },
  { id: 'colirio', nome: 'Colírio', um: 'gota', varios: 'gotas', verbo: 'Pinguei', contagem: 'nivel' },
  { id: 'adesivo', nome: 'Adesivo', um: 'adesivo', varios: 'adesivos', verbo: 'Troquei', contagem: 'contado' },
  { id: 'injecao', nome: 'Injeção', um: 'aplicação', varios: 'aplicações', verbo: 'Apliquei', contagem: 'contado' },
  { id: 'inalador', nome: 'Inalador', um: 'jato', varios: 'jatos', verbo: 'Inalei', contagem: 'nivel' },
  { id: 'outro', nome: 'Outro', um: 'dose', varios: 'doses', verbo: 'Tomei', contagem: 'contado' },
]
export const forma = (id) => FORMAS.find((f) => f.id === id) || FORMAS[FORMAS.length - 1]
export const numero = (n) => String(Math.round(n * 100) / 100).replace('.', ',')
export const doseTexto = (qtd, formaId) => {
  const f = forma(formaId)
  if (qtd === 0.5 && f.meio) return `meio ${f.um}`
  return `${numero(qtd)} ${qtd === 1 ? f.um : f.varios}`
}
export const NIVEIS_ESTOQUE = [
  { id: 'cheio', nome: 'Cheio' },
  { id: 'metade', nome: 'Metade' },
  { id: 'acabando', nome: 'Acabando' },
]
export const NIVEIS_ROTINA = {
  marcar: { nome: 'Só marcar', texto: 'não lembra nem cobra' },
  lembrar: { nome: 'Lembrar', texto: 'avisa uma vez' },
  cobrar: { nome: 'Lembrar e cobrar', texto: 'insiste como alarme' },
}
export const JANELAS = [
  { v: 30, nome: '30 min' },
  { v: 60, nome: '1 hora' },
  { v: 120, nome: '2 horas' },
  { v: 'dia', nome: 'No mesmo dia' },
]
export const CATEGORIAS_PADRAO = ['Saúde', 'Casa', 'Organização', 'Estudos', 'Trabalho', 'Pessoal', 'Lazer']
