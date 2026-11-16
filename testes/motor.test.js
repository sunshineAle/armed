import { describe, it, expect } from 'vitest'
import {
  ocorrenciasDoDia, situacao, remedioTemNoDia, horariosACada, caiDeMadrugada, resumoSemana,
  frequenciaTexto, duracaoTexto, estoqueInfo, terminado, diasTexto, sosInfo,
} from '../src/nucleo/motor.js'
import { doseTexto } from '../src/nucleo/formas.js'
import { diaSemana, inicioSemana, horaCurta, somaDias } from '../src/nucleo/tempo.js'

const rem = (o) => ({
  id: 'r1', nome: 'Ervalina', forma: 'comprimido', tipo: 'tratamento', dose: 1, inicio: '2026-11-09',
  repete: { tipo: 'diario' }, horarios: [{ h: '07:00' }, { h: '20:00', dose: 0.5 }],
  duracao: { tipo: 'continuo' }, janela: 60, ...o,
})
const base = (o = {}) => ({ remedios: [], rotinas: [], registros: [], ...o })

describe('tempo', () => {
  it('semana começa na segunda', () => {
    expect(diaSemana('2026-11-16')).toBe(0)
    expect(diaSemana('2026-11-22')).toBe(6)
    expect(inicioSemana('2026-11-18')).toBe('2026-11-16')
  })
  it('hora curta', () => {
    expect(horaCurta('07:00')).toBe('7h')
    expect(horaCurta('20:30')).toBe('20h30')
  })
})

describe('dose', () => {
  it('escreve meio comprimido e plural', () => {
    expect(doseTexto(0.5, 'comprimido')).toBe('meio comprimido')
    expect(doseTexto(1, 'capsula')).toBe('1 cápsula')
    expect(doseTexto(10, 'gotas')).toBe('10 gotas')
    expect(doseTexto(2.5, 'xarope')).toBe('2,5 ml')
  })
})

describe('repetição', () => {
  it('ciclo dia sim, dia não', () => {
    const r = rem({ repete: { tipo: 'ciclo', sim: 1, nao: 1 } })
    const e = base({ remedios: [r] })
    expect(remedioTemNoDia(e, r, '2026-11-09')).toBe(true)
    expect(remedioTemNoDia(e, r, '2026-11-10')).toBe(false)
    expect(remedioTemNoDia(e, r, '2026-11-11')).toBe(true)
  })
  it('ciclo 21 + 7', () => {
    const r = rem({ repete: { tipo: 'ciclo', sim: 21, nao: 7 } })
    const e = base({ remedios: [r] })
    expect(remedioTemNoDia(e, r, somaDias('2026-11-09', 20))).toBe(true)
    expect(remedioTemNoDia(e, r, somaDias('2026-11-09', 21))).toBe(false)
    expect(remedioTemNoDia(e, r, somaDias('2026-11-09', 28))).toBe(true)
  })
  it('dias da semana e antes do começo', () => {
    const r = rem({ repete: { tipo: 'semana', dias: [0, 2] } })
    const e = base({ remedios: [r] })
    expect(remedioTemNoDia(e, r, '2026-11-16')).toBe(true)
    expect(remedioTemNoDia(e, r, '2026-11-17')).toBe(false)
    expect(remedioTemNoDia(e, r, '2026-11-02')).toBe(false)
  })
  it('tratamento por dias termina', () => {
    const r = rem({ duracao: { tipo: 'dias', n: 3 } })
    const e = base({ remedios: [r] })
    expect(remedioTemNoDia(e, r, '2026-11-11')).toBe(true)
    expect(remedioTemNoDia(e, r, '2026-11-12')).toBe(false)
    expect(terminado(e, r, '2026-11-12')).toBe(true)
  })
  it('tratamento por doses termina quando as doses acabam', () => {
    const r = rem({ duracao: { tipo: 'doses', n: 2 } })
    const registros = [
      { chave: 'a', tipo: 'rem', refId: 'r1', data: '2026-11-09', estado: 'feito' },
      { chave: 'b', tipo: 'rem', refId: 'r1', data: '2026-11-09', estado: 'feito' },
    ]
    const e = base({ remedios: [r], registros })
    expect(remedioTemNoDia(e, r, '2026-11-09')).toBe(true)
    expect(remedioTemNoDia(e, r, '2026-11-10')).toBe(false)
    expect(duracaoTexto(e, r, '2026-11-10')).toBe('Faltam 0 doses')
  })
  it('a cada X horas mostra a lista e avisa madrugada', () => {
    expect(horariosACada('06:00', 8)).toEqual(['06:00', '14:00', '22:00'])
    expect(caiDeMadrugada(horariosACada('02:00', 8))).toBe(true)
    expect(caiDeMadrugada(['06:00', '22:00'])).toBe(false)
  })
})

describe('situação', () => {
  const e = base({ remedios: [rem()] })
  const [manha] = ocorrenciasDoDia(e, '2026-11-16')
  it('antes da hora é futuro; na janela é aberto; perto do fim é atenção; depois é atrasado', () => {
    expect(situacao(manha, null, '2026-11-16', 6 * 60)).toBe('futuro')
    expect(situacao(manha, null, '2026-11-16', 7 * 60 + 10)).toBe('aberto')
    expect(situacao(manha, null, '2026-11-16', 7 * 60 + 47)).toBe('atencao')
    expect(situacao(manha, null, '2026-11-16', 8 * 60)).toBe('atrasado')
  })
  it('registro vale mais que o relógio', () => {
    expect(situacao(manha, { estado: 'feito' }, '2026-11-16', 9 * 60)).toBe('feito')
    expect(situacao(manha, { estado: 'pulado' }, '2026-11-16', 9 * 60)).toBe('pulado')
  })
  it('janela "no mesmo dia" só atrasa no dia seguinte', () => {
    const d = { ...manha, janela: 'dia' }
    expect(situacao(d, null, '2026-11-16', 22 * 60)).toBe('aberto')
    expect(situacao(d, null, '2026-11-17', 60)).toBe('atrasado')
  })
  it('rotina: só "lembrar e cobrar" fica atrasada', () => {
    const rot = (nivel) => ({ tipo: 'rot', data: '2026-11-16', hora: '13:00', nivel })
    expect(situacao(rot('lembrar'), null, '2026-11-16', 20 * 60)).toBe('aberto')
    expect(situacao(rot('marcar'), null, '2026-11-17', 60)).toBe('passou')
    expect(situacao(rot('cobrar'), null, '2026-11-16', 13 * 60 + 20)).toBe('aberto')
    expect(situacao(rot('cobrar'), null, '2026-11-16', 14 * 60)).toBe('atrasado')
  })
  it('rotina sem horário fica livre', () => {
    expect(situacao({ tipo: 'rot', data: '2026-11-16', hora: null }, null, '2026-11-16', 600)).toBe('livre')
  })
})

describe('dia e semana', () => {
  const rotina = { id: 't1', nome: 'Alongar', dias: [0, 1, 2, 3, 4, 5, 6], hora: '07:30', nivel: 'lembrar', categoria: 'Saúde' }
  const e = base({ remedios: [rem()], rotinas: [rotina] })
  it('junta remédios e rotinas em ordem de horário, com a dose de cada horário', () => {
    const ocs = ocorrenciasDoDia(e, '2026-11-16')
    expect(ocs.map((o) => o.hora)).toEqual(['07:00', '07:30', '20:00'])
    expect(ocs[2].detalhe).toBe('meio comprimido')
    expect(ocs[0].verbo).toBe('Tomei')
  })
  it('anel da semana separa remédios e rotinas', () => {
    const registros = [
      { chave: 'rem:r1:2026-11-16:07:00', estado: 'feito' },
      { chave: 'rem:r1:2026-11-16:20:00', estado: 'feito' },
      { chave: 'rem:r1:2026-11-17:07:00', estado: 'feito' },
      { chave: 'rot:t1:2026-11-17:07:30', estado: 'pulado' },
    ]
    const s = resumoSemana({ ...e, registros }, '2026-11-17')
    expect(s[0]).toEqual(['cheio', 'vazio'])
    expect(s[1]).toEqual(['metade', 'vazio'])
    expect(s[2]).toEqual(['futuro', 'futuro'])
  })
})

describe('dia do cadastro', () => {
  it('horário que já passou quando o remédio foi cadastrado não nasce atrasado', () => {
    const r = rem({ inicio: '2026-11-16', criadoEm: new Date('2026-11-16T15:10:00').toISOString(), horarios: [{ h: '06:00' }, { h: '14:00' }, { h: '22:00' }] })
    const e = base({ remedios: [r] })
    expect(ocorrenciasDoDia(e, '2026-11-16').map((o) => o.hora)).toEqual(['22:00'])
    expect(ocorrenciasDoDia(e, '2026-11-17').map((o) => o.hora)).toEqual(['06:00', '14:00', '22:00'])
  })
})

describe('textos do cartão', () => {
  it('frequência', () => {
    expect(frequenciaTexto(rem())).toBe('Todo dia')
    expect(frequenciaTexto(rem({ repete: { tipo: 'ciclo', sim: 1, nao: 1 } }))).toBe('Dia sim, dia não')
    expect(frequenciaTexto(rem({ repete: { tipo: 'horas', cada: 8 } }))).toBe('A cada 8 h')
    expect(diasTexto([0, 2, 4])).toBe('Seg, Qua, Sex')
    expect(diasTexto([5])).toBe('Sábado')
  })
  it('estoque por extenso e aviso de reposição', () => {
    const r = rem({ estoque: { tipo: 'contado', qtd: 30 } })
    expect(estoqueInfo(base(), r, '2026-11-16').texto).toBe('Estoque: 30, dá para uns 20 dias')
    const pouco = rem({ estoque: { tipo: 'contado', qtd: 3 } })
    expect(estoqueInfo(base(), pouco, '2026-11-16').repor).toBe('acaba em uns 2 dias · hora de repor')
    const curto = rem({ duracao: { tipo: 'dias', n: 10 }, estoque: { tipo: 'contado', qtd: 6 }, horarios: [{ h: '12:00' }] })
    expect(estoqueInfo(base(), curto, '2026-11-15').texto).toBe('Estoque: 6, dá até o fim')
    // dia 4 de 10, dose de hoje já tomada: faltam 6 dias e há 6 no estoque
    const hojeFeito = base({ registros: [{ chave: 'rem:r1:2026-11-12:12:00', tipo: 'rem', refId: 'r1', estado: 'feito' }] })
    expect(estoqueInfo(hojeFeito, curto, '2026-11-12').texto).toBe('Estoque: 6, dá até o fim')
    expect(estoqueInfo(base(), curto, '2026-11-12').repor).toBe('acaba em uns 6 dias · hora de repor')
  })
  it('SOS só mostra o que foi anotado', () => {
    const r = { id: 's1', sos: { intervalo: 6 } }
    const agora = new Date('2026-11-16T15:00:00')
    const e = base({ registros: [{ tipo: 'sos', refId: 's1', em: new Date('2026-11-16T10:25:00').toISOString() }] })
    expect(sosInfo(e, r, agora).texto).toBe('Última vez: há 4 h 35 min · você anotou intervalo de 6 h')
    expect(sosInfo(base(), r, agora).texto).toBe('Ainda sem registro')
  })
})
