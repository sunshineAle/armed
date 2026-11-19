// Motor de lembrete compartilhado por remédios e rotinas.
// Regra da casa: o Airmed organiza e lembra. Nunca calcula, sugere nem bloqueia dose.
import { minutos, deMin, somaDias, difDias, diaSemana, inicioSemana, DIAS_CURTOS, dataISO, minDe } from './tempo.js'
import { doseTexto, forma, numero } from './formas.js'

export const MARGEM_ROTINA = 60 // minutos de margem no "lembrar e cobrar"
export const PERTO_DO_FIM = 15 // minutos antes de a janela fechar

const feitasDe = (estado, r) =>
  estado.registros.filter((g) => g.tipo === 'rem' && g.refId === r.id && g.estado === 'feito')

export function fimDoTratamento(r) {
  return r.duracao?.tipo === 'dias' ? somaDias(r.inicio, r.duracao.n - 1) : null
}

export function terminado(estado, r, hoje) {
  if (r.tipo !== 'tratamento') return false
  if (r.duracao?.tipo === 'dias') return hoje > fimDoTratamento(r)
  if (r.duracao?.tipo === 'doses') return feitasDe(estado, r).length >= r.duracao.n
  return false
}

export function remedioTemNoDia(estado, r, data) {
  if (r.tipo !== 'tratamento' || data < r.inicio) return false
  if (r.duracao?.tipo === 'dias' && data > fimDoTratamento(r)) return false
  if (r.duracao?.tipo === 'doses') {
    const feitas = feitasDe(estado, r)
    if (feitas.length >= r.duracao.n) {
      const ultima = feitas.reduce((m, g) => (g.data > m ? g.data : m), '')
      if (data > ultima) return false
    }
  }
  const rep = r.repete || { tipo: 'diario' }
  if (rep.tipo === 'semana') return rep.dias.includes(diaSemana(data))
  if (rep.tipo === 'ciclo') return difDias(r.inicio, data) % (rep.sim + rep.nao) < rep.sim
  return true
}

// Lista do "a cada X horas" dentro de um dia, a partir do primeiro horário.
export function horariosACada(primeiro, cada) {
  const lista = []
  for (let m = minutos(primeiro); m < 1440; m += cada * 60) lista.push(deMin(m))
  return lista
}
export const caiDeMadrugada = (horas) => horas.some((h) => minutos(h) < 360)

// No dia do cadastro, o que já tinha passado da hora não entra (não nasce "atrasado").
function antesDeExistir(item, data, hora) {
  if (!item.criadoEm) return false
  const d = new Date(item.criadoEm)
  const dia = dataISO(d)
  if (data < dia) return true // dias antes de o item existir
  return !!hora && data === dia && minutos(hora) < minDe(d)
}

export function ocorrenciasDoDia(estado, data) {
  const lista = []
  for (const r of estado.remedios) {
    if (!remedioTemNoDia(estado, r, data)) continue
    for (const h of r.horarios) {
      if (antesDeExistir(r, data, h.h)) continue
      const qtd = h.dose ?? r.dose ?? 1
      lista.push({
        chave: `rem:${r.id}:${data}:${h.h}`, tipo: 'rem', refId: r.id, data, hora: h.h,
        titulo: r.nome, detalhe: doseTexto(qtd, r.forma), qtd, forma: r.forma,
        verbo: forma(r.forma).verbo, janela: r.janela ?? 60, obs: r.obs || '', categoria: 'Remédios',
      })
    }
  }
  const ds = diaSemana(data)
  for (const t of estado.rotinas) {
    if (!t.dias.includes(ds) || (t.inicio && data < t.inicio) || antesDeExistir(t, data, t.hora)) continue
    lista.push({
      chave: `rot:${t.id}:${data}:${t.hora || 'livre'}`, tipo: 'rot', refId: t.id, data, hora: t.hora || null,
      titulo: t.nome, detalhe: t.meta || '', nivel: t.nivel, verbo: 'Fiz', categoria: t.categoria || 'Sem categoria',
    })
  }
  return lista.sort((a, b) => (a.hora ? minutos(a.hora) : 9999) - (b.hora ? minutos(b.hora) : 9999))
}

// Até quando a pessoa anotou que pode fazer (minutos do dia). null = sem prazo.
export function fimDaJanela(oc) {
  if (!oc.hora) return null
  const m = minutos(oc.hora)
  if (oc.tipo === 'rem') return oc.janela === 'dia' ? 1440 : m + oc.janela
  return oc.nivel === 'cobrar' ? m + MARGEM_ROTINA : null
}

// feito | pulado | futuro | livre | aberto | atencao | atrasado | passou
export function situacao(oc, registro, hoje, agoraMin) {
  if (registro) return registro.estado
  if (oc.data > hoje) return 'futuro'
  const passado = oc.data < hoje
  if (!oc.hora) return passado ? 'passou' : 'livre'
  if (!passado && agoraMin < minutos(oc.hora)) return 'futuro'
  const fim = fimDaJanela(oc)
  // "Só marcar" e "Lembrar" nunca ficam vermelhos.
  if (fim === null) return passado ? 'passou' : 'aberto'
  if (passado || agoraMin >= fim) return 'atrasado'
  return fim - agoraMin <= PERTO_DO_FIM ? 'atencao' : 'aberto'
}

// O que ficou sem resposta nos dias anteriores (até `dias` atrás), do mais recente para o mais antigo.
// Entram remédios e rotinas que lembram ou cobram; "só marcar" não cobra, então não entra.
export function pendentesAnteriores(estado, hoje, dias = 7) {
  const lista = []
  for (let n = 1; n <= dias; n++) {
    const data = somaDias(hoje, -n)
    for (const oc of diaComSituacao(estado, data, hoje, 0)) {
      if (oc.registro || (oc.tipo === 'rot' && oc.nivel === 'marcar')) continue
      lista.push(oc)
    }
  }
  return lista
}

export function diaComSituacao(estado, data, hoje, agoraMin) {
  const reg = new Map(estado.registros.map((g) => [g.chave, g]))
  return ocorrenciasDoDia(estado, data).map((oc) => {
    const registro = reg.get(oc.chave) || null
    return { ...oc, registro, sit: situacao(oc, registro, hoje, agoraMin) }
  })
}

// Semana no anel: por dia, [remédios, rotinas] em cheio | metade | vazio | futuro.
export function resumoSemana(estado, hoje) {
  const reg = new Map(estado.registros.map((g) => [g.chave, g]))
  const seg = inicioSemana(hoje)
  return Array.from({ length: 7 }, (_, i) => {
    const data = somaDias(seg, i)
    if (data > hoje) return ['futuro', 'futuro']
    const ocs = ocorrenciasDoDia(estado, data)
    return ['rem', 'rot'].map((tipo) => {
      const doTipo = ocs.filter((o) => o.tipo === tipo)
      const feitos = doTipo.filter((o) => reg.get(o.chave)?.estado === 'feito').length
      if (!doTipo.length || !feitos) return 'vazio'
      return feitos === doTipo.length ? 'cheio' : 'metade'
    })
  })
}

export function frequenciaTexto(r) {
  const rep = r.repete || { tipo: 'diario' }
  if (rep.tipo === 'semana') return diasTexto(rep.dias)
  if (rep.tipo === 'horas') return `A cada ${rep.cada} h`
  if (rep.tipo === 'ciclo') {
    if (rep.sim === 1 && rep.nao === 1) return 'Dia sim, dia não'
    return `${rep.sim} dias sim, ${rep.nao} não`
  }
  return 'Todo dia'
}

export function diasTexto(dias) {
  const d = [...dias].sort((a, b) => a - b)
  if (d.length === 7) return 'Todo dia'
  if (d.join() === '0,1,2,3,4') return 'Seg a Sex'
  if (d.length === 1) return ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][d[0]]
  if (d.length === 2) return `${DIAS_CURTOS[d[0]]} e ${DIAS_CURTOS[d[1]]}`
  return d.map((i) => DIAS_CURTOS[i]).join(', ')
}

export function duracaoTexto(estado, r, hoje) {
  const d = r.duracao || { tipo: 'continuo' }
  if (d.tipo === 'dias') {
    const dia = Math.min(Math.max(difDias(r.inicio, hoje) + 1, 1), d.n)
    return hoje < r.inicio ? `Começa em ${difDias(hoje, r.inicio)} dias` : `Dia ${dia} de ${d.n}`
  }
  if (d.tipo === 'doses') {
    const falta = Math.max(d.n - feitasDe(estado, r).length, 0)
    return falta === 1 ? 'Falta 1 dose' : `Faltam ${falta} doses`
  }
  return 'Uso contínuo'
}

// Consumo médio por dia, só para estimar "dá para uns N dias". É conta de estoque, não de dose.
export function consumoDiario(r) {
  const porDia = r.horarios.reduce((s, h) => s + (h.dose ?? r.dose ?? 1), 0)
  const rep = r.repete || { tipo: 'diario' }
  if (rep.tipo === 'semana') return (porDia * rep.dias.length) / 7
  if (rep.tipo === 'ciclo') return (porDia * rep.sim) / (rep.sim + rep.nao)
  return porDia
}

// Quanto ainda falta usar até o fim do tratamento (null = uso contínuo).
export function faltaUsar(estado, r, hoje) {
  const d = r.duracao || { tipo: 'continuo' }
  const dose = r.dose ?? 1
  if (d.tipo === 'doses') return Math.max(d.n - feitasDe(estado, r).length, 0) * dose
  if (d.tipo === 'dias') {
    // Hoje conta só o que ainda não foi registrado; depois, os dias que restam.
    const fim = fimDoTratamento(r)
    if (hoje < r.inicio) return (difDias(r.inicio, fim) + 1) * consumoDiario(r)
    if (hoje > fim) return 0
    const reg = new Set(estado.registros.map((g) => g.chave))
    const deHoje = remedioTemNoDia(estado, r, hoje)
      ? r.horarios.filter((h) => !reg.has(`rem:${r.id}:${hoje}:${h.h}`)).reduce((s, h) => s + (h.dose ?? dose), 0)
      : 0
    return deHoje + difDias(hoje, fim) * consumoDiario(r)
  }
  return null
}

// { texto, repor } para o cartão e para a aba Estoque.
export function estoqueInfo(estado, r, hoje) {
  const e = r.estoque
  if (!e) return { texto: '', repor: '' }
  if (e.tipo === 'nivel') {
    const nome = { cheio: 'cheio', metade: 'pela metade', acabando: 'acabando' }[e.nivel]
    return { texto: `Estoque: ${nome}`, repor: '', acabando: e.nivel === 'acabando' }
  }
  const qtd = numero(e.qtd)
  if (r.tipo !== 'tratamento' || !r.horarios?.length) return { texto: `Estoque: ${qtd}`, repor: '', dias: null }
  const consumo = consumoDiario(r)
  const dias = consumo > 0 ? Math.floor(e.qtd / consumo) : null
  const falta = faltaUsar(estado, r, hoje)
  if (falta !== null && e.qtd >= falta) return { texto: `Estoque: ${qtd}, dá até o fim`, repor: '', dias }
  const texto = dias === null ? `Estoque: ${qtd}` : `Estoque: ${qtd}, dá para uns ${dias} dias`
  const aviso = r.avisoReposicao ?? 7
  const repor = dias !== null && dias <= aviso
    ? (dias <= 0 ? 'acabou · hora de repor' : `acaba em uns ${dias} dias · hora de repor`)
    : ''
  return { texto, repor, dias }
}

// SOS: só mostra o que a pessoa anotou. Nunca "liberado", nunca bloqueia.
export function sosInfo(estado, r, agora) {
  const usos = estado.registros
    .filter((g) => g.tipo === 'sos' && g.refId === r.id)
    .sort((a, b) => (a.em < b.em ? 1 : -1))
  if (!usos.length) return { ultima: null, texto: 'Ainda sem registro' }
  const min = Math.max(Math.round((agora - new Date(usos[0].em)) / 60000), 0)
  const h = Math.floor(min / 60)
  const ha = min < 60 ? `há ${min} min` : (min % 60 ? `há ${h} h ${min % 60} min` : `há ${h} h`)
  const partes = [`Última vez: ${min >= 2880 ? `há ${Math.floor(min / 1440)} dias` : ha}`]
  if (r.sos?.intervalo) partes.push(`você anotou intervalo de ${numero(r.sos.intervalo)} h`)
  return { ultima: usos[0], texto: partes.join(' · ') }
}
