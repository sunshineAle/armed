// Ícone automático pelo nome da categoria.
const MAPA = [
  [/sa[uú]de|corpo|treino/i, 'saude'], [/casa|lar/i, 'casa'], [/estud|curso|aula/i, 'estudos'],
  [/pessoal|eu/i, 'pessoal'], [/lazer|m[uú]sica|divers/i, 'lazer'], [/trabalho|servi/i, 'trabalho'],
  [/organiza/i, 'organizacao'],
]
export const iconeCategoria = (nome = '') => (MAPA.find(([r]) => r.test(nome)) || [, 'etiqueta'])[1]
export const iconeForma = (id) => (id === 'capsula' ? 'capsula' : id)
