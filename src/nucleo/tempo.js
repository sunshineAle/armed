// Datas e horas sempre pelo relógio do aparelho (nunca GPS), em texto local.
export const pad = (n) => String(n).padStart(2, '0')
export const dataISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const deISO = (s) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}
export const somaDias = (s, n) => {
  const d = deISO(s)
  d.setDate(d.getDate() + n)
  return dataISO(d)
}
export const difDias = (a, b) => Math.round((deISO(b) - deISO(a)) / 864e5)
export const minutos = (h) => {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + b
}
export const deMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
export const minDe = (d) => d.getHours() * 60 + d.getMinutes()
export const horaDe = (d) => deMin(minDe(d))
// "07:30" -> "7h30"; "15:00" -> "15h"
export const horaCurta = (h) => {
  const [a, b] = h.split(':')
  return b === '00' ? `${+a}h` : `${+a}h${b}`
}
// "07:04" -> "7:04"
export const horaReal = (h) => `${+h.split(':')[0]}:${h.split(':')[1]}`
// 0 = segunda ... 6 = domingo
export const diaSemana = (s) => (deISO(s).getDay() + 6) % 7
export const inicioSemana = (s) => somaDias(s, -diaSemana(s))
export const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export const DIAS_LETRA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
export const DIAS_NOME = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
export const duracao = (min) => {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
export const dataLonga = (s) =>
  deISO(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
export const dataCurta = (s) => {
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}
