<script setup>
import { computed, ref } from 'vue'
import { estado, hoje, agoraMin } from '../nucleo/dados.js'
import { diaComSituacao, diasTexto } from '../nucleo/motor.js'
import { horaCurta, somaDias, inicioSemana, diaSemana, DIAS_LETRA, DIAS_NOME } from '../nucleo/tempo.js'
import { NIVEIS_ROTINA } from '../nucleo/formas.js'
import { abrir } from '../nucleo/ui.js'
import { iconeCategoria } from '../componentes/icones.js'
import Icone from '../componentes/Icone.vue'

const aba = ref('lista')
const doDia = computed(() => diaComSituacao(estado, hoje.value, hoje.value, agoraMin.value).filter((o) => o.tipo === 'rot'))
const hojeIdx = computed(() => diaSemana(hoje.value))

function hojeTexto(t) {
  const oc = doDia.value.find((o) => o.refId === t.id)
  if (!oc) return { texto: 'Não tem hoje' }
  if (oc.sit === 'feito') return { texto: 'Feito hoje', feito: true }
  if (oc.sit === 'pulado') return { texto: 'Pulada hoje' }
  if (oc.sit === 'atrasado') return { texto: `Atrasada · era às ${horaCurta(t.hora)}`, atrasado: true }
  return { texto: t.hora ? `Hoje, às ${horaCurta(t.hora)}` : 'Ainda hoje' }
}
const grupos = computed(() => {
  const nomes = [...new Set(estado.rotinas.map((t) => t.categoria || 'Sem categoria'))]
  const ordem = (n) => { const i = estado.categorias.indexOf(n); return i < 0 ? 99 : i }
  return nomes.sort((a, b) => ordem(a) - ordem(b)).map((nome) => ({
    nome,
    itens: estado.rotinas.filter((t) => (t.categoria || 'Sem categoria') === nome).map((t) => ({ t, hoje: hojeTexto(t), freq: diasTexto(t.dias), n: NIVEIS_ROTINA[t.nivel] })),
  }))
})

const dias = computed(() => {
  const seg = inicioSemana(hoje.value)
  return DIAS_LETRA.map((l, i) => ({ l, data: somaDias(seg, i), n: Number(somaDias(seg, i).slice(8)), hoje: i === hojeIdx.value }))
})
const semana = computed(() => {
  const feitos = new Set(estado.registros.filter((g) => g.tipo === 'rot' && g.estado === 'feito').map((g) => `${g.refId}:${g.data}`))
  return estado.rotinas.map((t) => ({
    t,
    cel: dias.value.map((d, i) => {
      const tem = t.dias.includes(i)
      const feito = tem && feitos.has(`${t.id}:${d.data}`)
      return { tem, feito, hoje: d.hoje, aria: `${DIAS_NOME[i]}: ${!tem ? 'não repete' : feito ? 'feito' : 'tem neste dia'}` }
    }),
  }))
})
const nFeitas = computed(() => doDia.value.filter((o) => o.sit === 'feito').length)
</script>

<template>
  <header class="cabeca"><div><small>{{ estado.rotinas.length }} {{ estado.rotinas.length === 1 ? 'rotina' : 'rotinas' }} · {{ nFeitas }} {{ nFeitas === 1 ? 'feita' : 'feitas' }} hoje</small><h1>Rotinas</h1></div></header>

  <div class="segmento" role="tablist" aria-label="Ver rotinas">
    <button type="button" role="tab" :aria-selected="aba === 'lista'" @click="aba = 'lista'">Lista</button>
    <button type="button" role="tab" :aria-selected="aba === 'semana'" @click="aba = 'semana'">Semana</button>
  </div>

  <div v-if="!estado.rotinas.length" class="cartao vazio">
    <strong>Nenhuma rotina ainda</strong>
    <span>Rotina é tudo que você faz no dia a dia e quer acompanhar.</span>
    <button type="button" class="botao cheio" @click="abrir('rotina')">Nova rotina</button>
  </div>

  <div v-else-if="aba === 'lista'" class="pilha">
    <section v-for="g in grupos" :key="g.nome" class="grupo">
      <span class="rotulo">{{ g.nome }}</span>
      <div class="duas-colunas">
        <button v-for="r in g.itens" :key="r.t.id" type="button" class="cartao rot" :aria-label="`${r.t.nome}, ${r.freq}, ${r.t.hora || 'sem horário'}. ${r.n.nome}`" @click="abrir('rotina', { id: r.t.id })">
          <span class="quadro-icone"><Icone :nome="iconeCategoria(r.t.categoria)" /></span>
          <span class="rot-andares">
            <span class="andar"><strong>{{ r.t.nome }}</strong><span class="chip">{{ r.freq }}</span></span>
            <span class="andar meio">
              <span class="bloco-hora num">{{ r.t.hora ? horaCurta(r.t.hora) : 'Sem horário' }}</span>
              <span v-if="r.t.meta" class="bloco-hora" style="font-weight:600;color:var(--apoio)">{{ r.t.meta }}</span>
              <span style="flex:1"></span>
              <span class="rot-hoje" :class="{ feito: r.hoje.feito, atrasado: r.hoje.atrasado }">{{ r.hoje.texto }}</span>
            </span>
            <span class="rot-pe"><Icone :nome="r.t.nivel" :tam="15" :traco="1.8" />{{ r.n.nome }} · {{ r.n.texto }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>

  <div v-else class="grupo" style="gap:12px">
    <div class="cartao">
      <div class="sem-linha sem-topo">
        <span class="apoio" style="font-size:12px;font-weight:700">Esta semana</span>
        <span v-for="d in dias" :key="d.data" class="sem-dia" :class="{ hoje: d.hoje }"><b>{{ d.l }}</b><span class="num">{{ d.n }}</span></span>
      </div>
      <div v-for="r in semana" :key="r.t.id" class="sem-linha">
        <button type="button" class="sem-nome" @click="abrir('rotina', { id: r.t.id })"><strong>{{ r.t.nome }}</strong><small class="apoio num">{{ r.t.hora ? horaCurta(r.t.hora) : 'Sem horário' }}</small></button>
        <span v-for="(x, i) in r.cel" :key="i" class="sem-cel" :class="{ hoje: x.hoje }" role="img" :aria-label="x.aria">
          <span v-if="x.feito" class="selo feito mini"><Icone nome="feito" :tam="11" :traco="3.5" /></span>
          <span v-else-if="x.tem" class="aro"></span>
        </span>
      </div>
    </div>
    <div class="legenda apoio">
      <span><i class="ponto cheio"></i>Feito</span>
      <span><i class="ponto"></i>Tem neste dia</span>
      <span>Vazio: não repete</span>
    </div>
  </div>
</template>

<style scoped>
.rot { display: flex; gap: 12px; padding: 14px; width: 100%; }
.rot-andares { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
.andar { display: flex; align-items: flex-start; gap: 8px; }
.andar.meio { align-items: center; gap: 6px; flex-wrap: wrap; }
.andar strong { flex: 1; min-width: 0; font-size: 16px; line-height: 21px; font-weight: 800; overflow-wrap: anywhere; }
.rot-hoje { font-size: 12px; font-weight: 700; color: var(--apoio); }
.rot-hoje.feito { color: var(--primaria); }
.rot-hoje.atrasado { color: var(--atrasado); }
.rot-pe { display: flex; align-items: center; gap: 6px; padding-top: 8px; border-top: 1px solid var(--borda); font-size: 12px; font-weight: 600; color: var(--apoio); }
.sem-linha { display: grid; grid-template-columns: minmax(96px, 128px) repeat(7, minmax(0, 1fr)); align-items: center; min-height: 46px; padding: 0 8px 0 12px; border-top: 1px solid var(--borda); }
.sem-topo { min-height: 44px; border-top: 0; }
.sem-dia { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 3px 0; border-radius: 8px; color: var(--apoio); }
.sem-dia b { font-size: 11px; font-weight: 800; }
.sem-dia span { font-size: 10px; font-weight: 600; }
.sem-dia.hoje { background: var(--chip); color: var(--sobre-chip); }
.sem-nome { display: flex; flex-direction: column; min-width: 0; min-height: 46px; justify-content: center; }
.sem-nome strong { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sem-nome small { font-size: 11px; font-weight: 600; }
.sem-cel { display: flex; align-items: center; justify-content: center; height: 46px; }
.sem-cel.hoje { background: var(--cartao-2); }
.selo.mini { width: 18px; height: 18px; }
.aro { width: 18px; height: 18px; border-radius: 9px; border: 1.5px solid var(--apoio); }
.legenda { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 0 4px; font-size: 12px; font-weight: 600; }
.legenda span { display: flex; align-items: center; gap: 6px; }
.ponto { width: 14px; height: 14px; border-radius: 7px; border: 1.5px solid var(--apoio); }
.ponto.cheio { background: var(--primaria); border-color: var(--primaria); }
</style>
