// Dados fictícios para teste. Nomes inventados: nenhum remédio real entra no repositório.
import { dataISO, somaDias, inicioSemana, minutos, minDe, diaSemana } from './tempo.js'
import { ocorrenciasDoDia } from './motor.js'

export function montarDemo(agora) {
  const hoje = dataISO(agora)
  const todos = [0, 1, 2, 3, 4, 5, 6]
  const remedios = [
    { id: 'ervalina', nome: 'Ervalina', forma: 'comprimido', tipo: 'tratamento', dose: 1, inicio: somaDias(hoje, -40),
      repete: { tipo: 'diario' }, horarios: [{ h: '07:00' }, { h: '15:00' }, { h: '20:00', dose: 0.5 }],
      duracao: { tipo: 'continuo' }, janela: 60, estoque: { tipo: 'contado', qtd: 30 }, obs: 'Tomar com comida' },
    { id: 'musgolin', nome: 'Musgolin', forma: 'gotas', tipo: 'tratamento', dose: 10, inicio: somaDias(hoje, -25),
      repete: { tipo: 'diario' }, horarios: [{ h: '14:00' }, { h: '20:00' }],
      duracao: { tipo: 'continuo' }, janela: 60, estoque: { tipo: 'nivel', nivel: 'metade' } },
    { id: 'brotomel', nome: 'Brotomel', forma: 'comprimido', tipo: 'tratamento', dose: 1, inicio: somaDias(hoje, -3),
      repete: { tipo: 'diario' }, horarios: [{ h: '12:00' }],
      duracao: { tipo: 'dias', n: 10 }, janela: 120, estoque: { tipo: 'contado', qtd: 7 } },
    { id: 'folhamina', nome: 'Folhamina D', forma: 'capsula', tipo: 'tratamento', dose: 1, inicio: somaDias(hoje, -6),
      repete: { tipo: 'ciclo', sim: 1, nao: 1 }, horarios: [{ h: '08:00' }, { h: '17:00' }],
      duracao: { tipo: 'doses', n: 20 }, janela: 'dia', estoque: { tipo: 'contado', qtd: 3 } },
    { id: 'lumive', nome: 'Lumivê', forma: 'colirio', tipo: 'tratamento', dose: 1, inicio: somaDias(hoje, -1),
      repete: { tipo: 'diario' }, horarios: [{ h: '10:00' }, { h: '16:00' }],
      duracao: { tipo: 'dias', n: 7 }, janela: 60, estoque: { tipo: 'nivel', nivel: 'acabando' } },
    { id: 'raizil', nome: 'Raizil', forma: 'xarope', tipo: 'tratamento', dose: 5, inicio: somaDias(hoje, -20),
      repete: { tipo: 'diario' }, horarios: [{ h: '09:00' }, { h: '21:00' }],
      duracao: { tipo: 'dias', n: 5 }, janela: 60, estoque: null },
    { id: 'orvalix', nome: 'Orvalix', forma: 'comprimido', tipo: 'sos', dose: 1, inicio: somaDias(hoje, -30),
      horarios: [], sos: { intervalo: 6, maximo: 3 }, estoque: { tipo: 'contado', qtd: 8 } },
    { id: 'dorliv', nome: 'Dorliv', forma: 'comprimido', tipo: 'guardado', dose: 1, inicio: hoje,
      horarios: [], estoque: { tipo: 'contado', qtd: 10 } },
    { id: 'guaco', nome: 'Xarope de guaco', forma: 'xarope', tipo: 'guardado', dose: 5, inicio: hoje,
      horarios: [], estoque: { tipo: 'nivel', nivel: 'cheio' } },
  ].map((r) => ({ paraQuem: 'eu', ...r }))

  const rotinas = [
    { id: 'alongar', nome: 'Alongar', categoria: 'Saúde', dias: todos, hora: '07:30', meta: '10 min', nivel: 'lembrar' },
    { id: 'caminhar', nome: 'Caminhar', categoria: 'Saúde', dias: [0, 2, 4], hora: '18:00', meta: '20 min', nivel: 'cobrar' },
    { id: 'plantas', nome: 'Regar as plantas', categoria: 'Casa', dias: [0, 2, 5], hora: '13:00', meta: '', nivel: 'cobrar' },
    { id: 'lixo', nome: 'Tirar o lixo', categoria: 'Casa', dias: [1, 3, 5], hora: '21:00', meta: '', nivel: 'lembrar' },
    { id: 'curso', nome: 'Estudar o curso', categoria: 'Estudos', dias: [0, 1, 2, 3, 4], hora: '20:30', meta: '40 min', nivel: 'lembrar' },
    { id: 'ler', nome: 'Ler', categoria: 'Pessoal', dias: todos, hora: null, meta: '10 páginas', nivel: 'marcar' },
    { id: 'meditar', nome: 'Meditar', categoria: 'Pessoal', dias: todos, hora: null, meta: '5 min', nivel: 'marcar' },
    { id: 'telas', nome: 'Desligar as telas', categoria: 'Pessoal', dias: todos, hora: '22:30', meta: '', nivel: 'cobrar' },
    { id: 'musica', nome: 'Aula de música', categoria: 'Lazer', dias: [5], hora: '10:00', meta: '', nivel: 'lembrar' },
  ]

  // Histórico da semana: dias passados quase todos feitos; hoje, o que já passou há mais de 3 horas.
  const base = { remedios, rotinas, registros: [] }
  const registros = []
  const reg = (oc, minutoReal) => registros.push({
    chave: oc.chave, tipo: oc.tipo, refId: oc.refId, data: oc.data, hora: oc.hora, estado: 'feito',
    em: new Date(`${oc.data}T${oc.hora || '12:00'}:00`).toISOString(),
    horaReal: horaMais(oc.hora || '12:00', minutoReal), qtd: oc.qtd ?? null,
  })
  const horaMais = (h, m) => {
    const t = minutos(h) + m
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }
  const seg = inicioSemana(hoje)
  let n = 0
  for (let d = seg; d < hoje; d = somaDias(d, 1)) {
    for (const oc of ocorrenciasDoDia(base, d)) {
      n++
      const falha = oc.tipo === 'rot' && (n + diaSemana(d)) % 4 === 0
      if (!falha) reg(oc, n % 9)
    }
  }
  const agoraM = minDe(agora)
  for (const oc of ocorrenciasDoDia(base, hoje)) {
    n++
    if (oc.hora && minutos(oc.hora) <= agoraM - 180) reg(oc, n % 9)
  }
  return { remedios, rotinas, registros }
}
