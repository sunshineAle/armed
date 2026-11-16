<script setup>
import { computed, ref } from 'vue'
import { estado, relogio, hoje, agoraMin, marcar, desfazer, adiar, remedioPor } from '../nucleo/dados.js'
import { diaComSituacao, resumoSemana, fimDaJanela } from '../nucleo/motor.js'
import { minutos, deMin, dataLonga, diaSemana, horaDe, horaReal, duracao } from '../nucleo/tempo.js'
import { forma } from '../nucleo/formas.js'
import { abrir, avisar } from '../nucleo/ui.js'
import { diasSemBackup, backupDevido } from '../nucleo/backup.js'
import { acesso } from '../nucleo/acesso.js'
import Icone from '../componentes/Icone.vue'
import Anel from '../componentes/Anel.vue'

const feitosAbertos = ref(false)
// Lembrete de backup: depois de uma semana sem (ou nunca), para quem tem dados de verdade.
const lembreteBackup = computed(() => {
  if (!(estado.remedios.length + estado.rotinas.length)) return ''
  if (!backupDevido(estado.backup, relogio.agora)) return ''
  const d = diasSemBackup(estado.backup?.ultimo, relogio.agora)
  return d === null ? 'Hora do primeiro backup. Se este aparelho se perder, os dados vão junto.' : `Faz ${d} dias que você não faz backup.`
})
const chavePendente = computed(() => acesso.recPendente)
const itens = computed(() => diaComSituacao(estado, hoje.value, hoje.value, agoraMin.value))
const resolvido = (s) => s === 'feito' || s === 'pulado'
const total = computed(() => itens.value.length)
const nFeitos = computed(() => itens.value.filter((i) => i.sit === 'feito').length)
const nAtrasados = computed(() => itens.value.filter((i) => i.sit === 'atrasado').length)
const nAtencao = computed(() => itens.value.filter((i) => i.sit === 'atencao').length)
const semana = computed(() => resumoSemana(estado, hoje.value))

// Remédios do mesmo horário e na mesma situação viram uma linha só.
const linhas = computed(() => {
  const saida = []
  for (const it of itens.value.filter((i) => !resolvido(i.sit))) {
    const ant = saida[saida.length - 1]
    if (it.tipo === 'rem' && ant?.tipo === 'rem' && ant.hora === it.hora && ant.sit === it.sit) ant.itens.push(it)
    else saida.push({ ...it, itens: [it] })
  }
  const proximo = saida.find((l) => l.sit === 'futuro' && l.hora)
  return saida.map((l) => ({
    ...l,
    grupo: l.itens.length > 1,
    proximo: l === proximo,
    t: l.itens.length > 1 ? `${l.itens.length} remédios` : l.titulo,
    d: l.itens.length > 1 ? l.itens.map((i) => i.titulo).join(' · ') : l.detalhe,
  }))
})

const faltam = (hora) => duracao(Math.max(minutos(hora) - agoraMin.value, 0))
// Card do topo: o que precisa de você agora; sem urgência, o próximo.
const topo = computed(() => {
  const L = linhas.value
  const alvo = L.find((l) => l.sit === 'atencao')
    || L.find((l) => l.sit === 'aberto' && (l.tipo === 'rem' || l.nivel === 'cobrar'))
    || L.find((l) => l.proximo)
  if (!alvo) return null
  const fim = fimDaJanela(alvo)
  const depois = L.find((l) => l !== alvo && l.hora && minutos(l.hora) > agoraMin.value)
  return { ...alvo, fim, urgente: alvo.sit === 'atencao', naHora: alvo.sit === 'aberto', depois }
})

const PERIODOS = [['Manhã', 0, 720], ['Tarde', 720, 1080], ['Noite', 1080, 1440]]
const grupos = computed(() => {
  const L = linhas.value
  if (estado.prefs.vista === 'categoria') {
    const nomes = [...new Set(L.map((l) => l.categoria))]
    return nomes.map((nome) => ({ nome, itens: L.filter((l) => l.categoria === nome) }))
  }
  const saida = PERIODOS.map(([nome, de, ate]) => {
    const doPeriodo = L.filter((l) => l.hora && minutos(l.hora) >= de && minutos(l.hora) < ate)
    const agoraAqui = agoraMin.value >= de && agoraMin.value < ate
    if (agoraAqui && doPeriodo.length) {
      const pos = doPeriodo.findIndex((l) => minutos(l.hora) > agoraMin.value)
      doPeriodo.splice(pos < 0 ? doPeriodo.length : pos, 0, { agora: true, chave: 'agora' })
    }
    return { nome, itens: doPeriodo }
  })
  saida.push({ nome: 'A qualquer hora', itens: L.filter((l) => !l.hora) })
  return saida.filter((g) => g.itens.length)
})

const feitos = computed(() => {
  const doDia = itens.value.filter((i) => resolvido(i.sit)).map((i) => ({
    chave: i.chave, h: i.hora || '—', t: i.titulo, feito: i.sit === 'feito',
    d: i.sit === 'feito' ? `${i.tipo === 'rem' ? i.verbo.toLowerCase() : 'feito'} às ${horaReal(i.registro.horaReal)}` : 'Pulado',
  }))
  const sos = estado.registros.filter((g) => g.tipo === 'sos' && g.data === hoje.value).map((g) => {
    const r = remedioPor(g.refId)
    return { chave: g.chave, h: 'SOS', t: r?.nome || 'SOS', feito: true, sos: true, d: `${forma(r?.forma).verbo.toLowerCase()} às ${horaReal(g.horaReal)}` }
  })
  return [...doDia, ...sos]
})
const resumoFeitos = computed(() => {
  const f = feitos.value
  const p = f.filter((x) => !x.feito).length
  const s = f.filter((x) => x.sos).length
  return [p ? `${p} ${p === 1 ? 'pulado' : 'pulados'}` : '', s ? `${s} SOS` : ''].filter(Boolean).join(' · ')
})

function feito(linha) {
  for (const it of linha.itens) marcar(it, 'feito')
  const nome = linha.grupo ? `${linha.itens.length} remédios` : linha.titulo
  const verbo = linha.tipo === 'rem' ? linha.itens[0].verbo.toLowerCase() : 'feito'
  avisar(`${nome}: ${verbo} às ${horaReal(horaDe(new Date()))}`, { nome: 'Desfazer', fazer: () => linha.itens.forEach((it) => desfazer(it.chave)) })
}
function pular(linha) {
  for (const it of linha.itens) marcar(it, 'pulado')
  avisar(`${linha.t}: pulado`, { nome: 'Desfazer', fazer: () => linha.itens.forEach((it) => desfazer(it.chave)) })
}
function adiar10(linha) {
  adiar(linha.data, linha.hora, 10)
  avisar('Adiado: lembro de novo em 10 min')
}
const detalhe = (linha) => abrir('detalhe', { chaves: linha.itens.map((i) => i.chave) })
const icone = (l) => (l.tipo === 'rem' ? 'capsula' : 'rotina')
</script>

<template>
  <header class="cabeca">
    <div><small>{{ dataLonga(hoje) }}</small><h1>Hoje</h1></div>
    <span class="num apoio hora-agora">{{ horaReal(horaDe(relogio.agora)) }}</span>
  </header>

  <div v-if="chavePendente" class="faixa info solta lembrete-backup">
    <Icone nome="info" :tam="16" :traco="1.6" />
    <span style="flex:1">Você ainda não guardou a chave de recuperação.</span>
    <button type="button" @click="abrir('seguranca', { modo: 'chave' })">Ver a chave</button>
  </div>
  <div v-if="lembreteBackup" class="faixa info solta lembrete-backup">
    <Icone nome="info" :tam="16" :traco="1.6" />
    <span style="flex:1">{{ lembreteBackup }}</span>
    <button type="button" @click="abrir('backup', { modo: 'fazer' })">Fazer backup</button>
  </div>

  <div v-if="!total && !feitos.length" class="cartao vazio">
    <strong>Nada marcado para hoje</strong>
    <span>Toque no + para cadastrar um remédio ou uma rotina.</span>
    <button type="button" class="botao cheio" @click="abrir('mais')">Adicionar</button>
  </div>

  <div v-else class="hoje-grade">
    <div>
      <section class="cartao resumo" aria-label="Resumo do dia">
        <Anel :semana="semana" :hoje-idx="diaSemana(hoje)" />
        <div class="resumo-texto">
          <div><strong class="num">{{ nFeitos }} de {{ total }}</strong><span class="apoio">feitos hoje</span></div>
          <div v-if="nAtrasados || nAtencao" class="resumo-sit">
            <span v-if="nAtrasados" class="sit atrasado"><Icone nome="atrasado" :tam="16" :traco="1.8" />{{ nAtrasados }} {{ nAtrasados === 1 ? 'atrasado' : 'atrasados' }}</span>
            <span v-if="nAtencao" class="sit atencao"><Icone nome="atencao" :tam="16" :traco="1.8" />{{ nAtencao }} em atenção</span>
          </div>
          <span class="legenda">Folha de fora: remédios<br>Folha de dentro: rotinas</span>
        </div>
      </section>

      <section v-if="topo" class="topo" :class="{ urgente: topo.urgente }" aria-live="polite">
        <div class="topo-linha">
          <span class="topo-rotulo">
            <Icone :nome="topo.urgente ? 'atencao' : icone(topo)" :tam="18" :traco="1.6" />
            {{ topo.urgente ? 'Precisa de você agora' : (topo.naHora ? 'Na hora' : 'Próximo') }}
          </span>
          <span class="num topo-rotulo">
            <template v-if="topo.urgente">fecha em {{ duracao(topo.fim - agoraMin) }}</template>
            <template v-else-if="topo.naHora">desde {{ topo.hora }}</template>
            <template v-else>em {{ faltam(topo.hora) }}</template>
          </span>
        </div>
        <div class="topo-nome">
          <strong>{{ topo.t }} <template v-if="!topo.grupo">{{ topo.d }}</template></strong>
          <span class="num">
            <template v-if="topo.urgente || topo.naHora">Era às {{ topo.hora }}<template v-if="topo.fim"> · você anotou: até {{ topo.fim >= 1440 ? 'o fim do dia' : deMin(topo.fim) }}</template></template>
            <template v-else>{{ topo.hora }}<template v-if="topo.grupo"> · {{ topo.d }}</template></template>
          </span>
        </div>
        <div class="linha-botoes">
          <button type="button" class="botao cresce principal" @click="feito(topo)">{{ topo.grupo ? 'Tomei todos' : (topo.tipo === 'rem' ? topo.verbo : 'Fiz') }}</button>
          <button v-if="topo.urgente" type="button" class="botao lado" @click="pular(topo)">Pular</button>
          <button v-else-if="topo.naHora" type="button" class="botao lado" @click="adiar10(topo)">Adiar</button>
          <button v-else type="button" class="botao lado" @click="detalhe(topo)">Detalhes</button>
        </div>
        <span v-if="topo.depois" class="num topo-depois">Depois: {{ topo.depois.hora }} · {{ topo.depois.t }}</span>
      </section>

      <section v-if="feitos.length" class="grupo">
        <button type="button" class="recolhe" :aria-expanded="feitosAbertos" @click="feitosAbertos = !feitosAbertos">
          <span class="selo feito"><Icone nome="feito" :tam="14" :traco="3" /></span>
          <span>{{ nFeitos }} {{ nFeitos === 1 ? 'feito' : 'feitos' }}<span v-if="resumoFeitos" class="apoio" style="font-weight:500"> · {{ resumoFeitos }}</span></span>
          <span class="ver">{{ feitosAbertos ? 'Ocultar' : 'Ver' }}<Icone nome="baixo" :tam="18" :traco="1.8" :style="{ transform: feitosAbertos ? 'rotate(180deg)' : 'none' }" /></span>
        </button>
        <div v-if="feitosAbertos">
          <button v-for="f in feitos" :key="f.chave" type="button" class="feito-linha" :aria-label="`${f.t}, ${f.d}. Abrir para desfazer`" @click="abrir('detalhe', { chaves: [f.chave] })">
            <span class="num hora">{{ f.h }}</span>
            <span class="nome"><span :class="{ riscado: f.feito && !f.sos }">{{ f.t }}</span> <small>{{ f.d }}</small></span>
            <span v-if="f.feito" class="selo feito pequeno"><Icone nome="feito" :tam="12" :traco="3" /></span>
            <span v-else class="selo pulado pequeno"><Icone nome="pulado" :tam="12" :traco="3" /></span>
          </button>
        </div>
      </section>
    </div>

    <div>
      <div class="linha-titulo">
        <h2>Linha do dia</h2>
        <div class="segmento pequeno" role="group" aria-label="Ver o dia por">
          <button type="button" :aria-pressed="estado.prefs.vista === 'periodo'" @click="estado.prefs.vista = 'periodo'">Período</button>
          <button type="button" :aria-pressed="estado.prefs.vista === 'categoria'" @click="estado.prefs.vista = 'categoria'">Categoria</button>
        </div>
      </div>

      <p v-if="!linhas.length" class="apoio tudo-feito">Tudo em dia por hoje.</p>

      <section v-for="g in grupos" :key="g.nome" class="periodo">
        <span class="rotulo">{{ g.nome }}</span>
        <template v-for="l in g.itens" :key="l.chave">
          <div v-if="l.agora" class="agora"><span class="num">agora · {{ horaReal(horaDe(relogio.agora)) }}</span><i></i></div>
          <div v-else class="item" :class="[l.sit, { proximo: l.proximo }]">
            <button type="button" class="item-corpo" :aria-label="`Abrir detalhes: ${l.hora || 'sem horário'}, ${l.t} ${l.d}`" @click="detalhe(l)">
              <span class="num hora">{{ l.hora || '—' }}</span>
              <span class="item-icone"><Icone :nome="icone(l)" :tam="20" /></span>
              <span class="nome">{{ l.t }} <small>{{ l.d }}</small></span>
            </button>
            <span v-if="l.sit === 'atrasado'" class="sit atrasado"><Icone nome="atrasado" :tam="16" :traco="1.8" />Atrasado</span>
            <span v-else-if="l.sit === 'atencao'" class="sit atencao"><Icone nome="atencao" :tam="16" :traco="1.8" />Atenção</span>
            <span v-else-if="l.proximo" class="num em">em {{ faltam(l.hora) }}</span>
            <span v-else-if="l.tipo === 'rot' && l.nivel !== 'marcar'" class="nivel" role="img" :aria-label="l.nivel === 'cobrar' ? 'Lembrar e cobrar' : 'Lembrar'"><Icone :nome="l.nivel" :tam="16" :traco="1.6" /></span>
            <button v-if="l.grupo" type="button" class="todos" :aria-label="`Tomei todos: ${l.d}`" @click="feito(l)">Tomei todos</button>
            <button v-else type="button" class="marcar" :aria-label="`Marcar como feito: ${l.t}`" @click="feito(l)"><Icone nome="circulo" :tam="24" :traco="1.6" /></button>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hora-agora { font-size: 13px; font-weight: 600; }
.lembrete-backup { align-items: center; }
.lembrete-backup button { min-height: 36px; padding: 0 4px; font-weight: 800; color: var(--primaria); flex-shrink: 0; }
.resumo { display: flex; align-items: center; gap: 12px; padding: 14px 16px 14px 8px; border-radius: 20px; }
.resumo-texto { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.resumo-texto strong { display: block; font-size: 34px; line-height: 40px; font-weight: 800; letter-spacing: -0.5px; }
.resumo-texto strong + span { font-size: 14px; font-weight: 500; }
.resumo-sit { display: flex; flex-direction: column; gap: 6px; }
.sit { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; flex-shrink: 0; }
.sit.atrasado { color: var(--atrasado); }
.sit.atencao { color: var(--atencao); }
.legenda { font-size: 11px; line-height: 15px; color: var(--apoio); }

.topo { display: flex; flex-direction: column; gap: 14px; padding: 18px; border-radius: 20px; background: var(--primaria); color: var(--sobre-primaria); }
.topo-linha { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.topo-rotulo { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; }
.topo-nome { display: flex; flex-direction: column; gap: 2px; }
.topo-nome strong { font-size: 22px; line-height: 28px; font-weight: 800; }
.topo-nome span { font-size: 14px; font-weight: 500; }
.topo .principal { background: var(--sobre-primaria); color: var(--primaria); }
.topo .lado { min-width: 112px; border: 1.5px solid var(--sobre-primaria); color: var(--sobre-primaria); font-weight: 700; }
.topo-depois { font-size: 13px; font-weight: 500; padding-top: 10px; border-top: 1px solid color-mix(in srgb, currentColor 30%, transparent); }
.topo.urgente { background: var(--atencao-fundo); color: var(--texto); }
.topo.urgente .topo-rotulo { color: var(--atencao); }
.topo.urgente .principal { background: var(--primaria); color: var(--sobre-primaria); }
.topo.urgente .lado { border-color: var(--texto); color: var(--texto); }
.topo.urgente .topo-depois { border-top-color: var(--atencao-linha); }

.feito-linha { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 0 14px; color: var(--apoio); }
.feito-linha .hora { width: 40px; flex-shrink: 0; font-size: 13px; font-weight: 600; }
.feito-linha .nome { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px; }
.feito-linha small { font-size: 12px; font-weight: 600; }
.riscado { text-decoration: line-through; }
.selo.pequeno { width: 20px; height: 20px; }

.linha-titulo { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; }
.linha-titulo h2 { font-size: 17px; font-weight: 800; }
.linha-titulo .segmento { flex-shrink: 0; }
.tudo-feito { padding: 12px 4px; }
.periodo { display: flex; flex-direction: column; gap: 2px; }
.periodo .rotulo { padding: 6px 4px; }
.agora { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.agora span { font-size: 12px; font-weight: 800; color: var(--primaria); padding: 2px 8px; border-radius: 8px; border: 1.5px solid var(--primaria); }
.agora i { flex: 1; height: 2px; border-radius: 1px; background: var(--primaria); }
.item { display: flex; align-items: center; gap: 4px; min-height: 52px; padding: 0 4px 0 12px; border-radius: 14px; }
.item.atrasado { background: var(--atrasado-fundo); }
.item.atencao { background: var(--atencao-fundo); }
.item.proximo { background: var(--chip); }
.item-corpo { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; min-height: 52px; }
.item .hora { width: 40px; flex-shrink: 0; font-size: 13px; font-weight: 700; }
.item-icone { display: flex; flex-shrink: 0; color: var(--primaria); }
.item.atrasado .item-icone { color: var(--atrasado); }
.item.atencao .item-icone { color: var(--atencao); }
.item .nome { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 15px; font-weight: 650; }
.item .nome small { font-size: 13px; font-weight: 500; color: var(--apoio); }
.item .em { padding: 0 6px 0 4px; font-size: 13px; font-weight: 800; color: var(--sobre-chip); flex-shrink: 0; }
.item .nivel { display: flex; color: var(--apoio); flex-shrink: 0; }
.marcar { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--apoio); }
.todos { min-height: 36px; padding: 0 12px; margin-right: 4px; border-radius: 10px; border: 1.5px solid var(--primaria); color: var(--primaria); font-size: 13px; font-weight: 800; flex-shrink: 0; }
</style>
