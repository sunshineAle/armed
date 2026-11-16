<script setup>
import { computed, ref } from 'vue'
import { estado, relogio, hoje, agoraMin, tomarSOS, desfazer } from '../nucleo/dados.js'
import { diaComSituacao, terminado, frequenciaTexto, duracaoTexto, estoqueInfo, sosInfo } from '../nucleo/motor.js'
import { horaCurta, horaReal, dataCurta } from '../nucleo/tempo.js'
import { forma, doseTexto, numero, NIVEIS_ESTOQUE } from '../nucleo/formas.js'
import { abrir, avisar } from '../nucleo/ui.js'
import Icone from '../componentes/Icone.vue'

const aba = ref('tratamentos')
const terminadosAbertos = ref(false)
const doDia = computed(() => diaComSituacao(estado, hoje.value, hoje.value, agoraMin.value))

function cartao(r) {
  const ocs = doDia.value.filter((o) => o.tipo === 'rem' && o.refId === r.id)
  const est = estoqueInfo(estado, r, hoje.value)
  return {
    r, est,
    freq: frequenciaTexto(r),
    horas: r.horarios.map((h) => ({ h: horaCurta(h.h), dose: h.dose !== undefined && h.dose !== (r.dose ?? 1) ? (h.dose === 0.5 ? 'meio' : numero(h.dose)) : '' })),
    hoje: ocs.length ? `${ocs.filter((o) => o.sit === 'feito').length} de ${ocs.length} hoje` : 'Não tem hoje',
    pe: `${doseTexto(r.dose ?? 1, r.forma)} por dose · ${duracaoTexto(estado, r, hoje.value)}`,
  }
}
const tratamentos = computed(() => estado.remedios.filter((r) => r.tipo === 'tratamento'))
const ativos = computed(() => tratamentos.value.filter((r) => !terminado(estado, r, hoje.value)))
const grupos = computed(() => [
  { nome: 'Uso contínuo', itens: ativos.value.filter((r) => (r.duracao?.tipo || 'continuo') === 'continuo').map(cartao) },
  { nome: 'Com data para acabar', itens: ativos.value.filter((r) => ['dias', 'doses'].includes(r.duracao?.tipo)).map(cartao) },
].filter((g) => g.itens.length))
const terminados = computed(() => tratamentos.value.filter((r) => terminado(estado, r, hoje.value)))
const sos = computed(() => estado.remedios.filter((r) => r.tipo === 'sos'))

const comEstoque = computed(() => estado.remedios.filter((r) => r.estoque && !(r.tipo === 'tratamento' && terminado(estado, r, hoje.value))))
const sub = (r) => `${forma(r.forma).nome.toLowerCase()} · ${r.tipo === 'sos' ? 'se precisar' : r.tipo === 'guardado' ? 'guardado, sem tratamento' : duracaoTexto(estado, r, hoje.value).toLowerCase()}`
const contados = computed(() => comEstoque.value.filter((r) => r.estoque.tipo === 'contado').map((r) => {
  const est = estoqueInfo(estado, r, hoje.value)
  const unid = r.tipo === 'tratamento'
    ? (est.texto.includes('até o fim') ? 'dá até o fim' : (est.dias !== null && est.dias !== undefined ? `uns ${est.dias} dias` : forma(r.forma).varios))
    : forma(r.forma).varios
  return { r, sub: sub(r), qtd: numero(r.estoque.qtd), unid, repor: est.repor }
}))
const niveis = computed(() => comEstoque.value.filter((r) => r.estoque.tipo === 'nivel').map((r) => ({ r, sub: sub(r) })))

function tomei(r) {
  const g = tomarSOS(r)
  avisar(`${r.nome}: ${forma(r.forma).verbo.toLowerCase()} às ${horaReal(g.horaReal)}`, { nome: 'Desfazer', fazer: () => desfazer(g.chave) })
}
const resumo = computed(() => {
  const t = ativos.value.length
  const s = sos.value.length
  return [`${t} ${t === 1 ? 'tratamento' : 'tratamentos'}`, s ? `${s} se precisar` : ''].filter(Boolean).join(' · ')
})
</script>

<template>
  <header class="cabeca"><div><small>{{ resumo }}</small><h1>Remédios</h1></div></header>

  <div class="segmento" role="tablist" aria-label="Partes de Remédios">
    <button type="button" role="tab" :aria-selected="aba === 'tratamentos'" @click="aba = 'tratamentos'">Tratamentos</button>
    <button type="button" role="tab" :aria-selected="aba === 'estoque'" @click="aba = 'estoque'">Estoque</button>
  </div>

  <div v-if="aba === 'tratamentos'" class="pilha">
    <div v-if="!tratamentos.length && !sos.length" class="cartao vazio">
      <strong>Nenhum remédio ainda</strong>
      <span>Cadastre o primeiro: nome, horários e por quanto tempo.</span>
      <button type="button" class="botao cheio" @click="abrir('remedio', { modo: 'tratamento' })">Novo remédio</button>
    </div>

    <section v-for="g in grupos" :key="g.nome" class="grupo">
      <span class="rotulo">{{ g.nome }}</span>
      <div class="duas-colunas">
        <article v-for="c in g.itens" :key="c.r.id" class="cartao">
          <button type="button" class="rem" :aria-label="`Abrir ${c.r.nome}: ${c.freq}, ${c.hoje}`" @click="abrir('remedio', { id: c.r.id })">
            <span class="quadro-icone"><Icone :nome="c.r.forma" /></span>
            <span class="rem-andares">
              <span class="andar">
                <strong class="rem-nome">{{ c.r.nome }}</strong>
                <span class="chip">{{ c.freq }}</span>
              </span>
              <span class="andar meio">
                <span class="horas"><span v-for="h in c.horas" :key="h.h" class="bloco-hora num">{{ h.h }}<i v-if="h.dose">· {{ h.dose }}</i></span></span>
                <span class="num rem-hoje">{{ c.hoje }}</span>
              </span>
              <span class="rem-pe num">
                <span>{{ c.pe }}</span>
                <span v-if="c.est.texto">{{ c.est.texto }}</span>
              </span>
            </span>
          </button>
          <div v-if="c.est.repor" class="faixa atencao"><Icone nome="atencao" :tam="16" :traco="1.8" /><span class="num">Atenção · {{ c.est.repor }}</span></div>
          <div v-else-if="c.est.acabando" class="faixa info"><Icone nome="info" :tam="16" :traco="1.6" /><span>Você marcou o frasco como "acabando"</span></div>
        </article>
      </div>
    </section>

    <section v-if="sos.length" class="grupo">
      <span class="rotulo">Se precisar (SOS)</span>
      <div class="duas-colunas">
        <article v-for="r in sos" :key="r.id" class="cartao">
          <div class="sos-linha">
            <button type="button" class="sos-abre" :aria-label="`Abrir ${r.nome}`" @click="abrir('remedio', { id: r.id })">
              <span class="quadro-icone"><Icone :nome="r.forma" /></span>
              <span class="sos-texto">
                <strong>{{ r.nome }}</strong>
                <small class="apoio num">Sem horário · {{ doseTexto(r.dose ?? 1, r.forma) }}<template v-if="r.estoque?.tipo === 'contado'"> · {{ numero(r.estoque.qtd) }} no estoque</template></small>
              </span>
            </button>
            <button type="button" class="botao contorno" @click="tomei(r)">{{ forma(r.forma).verbo }} agora</button>
          </div>
          <div class="faixa info"><Icone nome="info" :tam="16" :traco="1.6" /><span class="num">{{ sosInfo(estado, r, relogio.agora).texto }}</span></div>
        </article>
      </div>
    </section>

    <section v-if="terminados.length" class="grupo">
      <button type="button" class="recolhe" :aria-expanded="terminadosAbertos" @click="terminadosAbertos = !terminadosAbertos">
        <span>{{ terminados.length }} {{ terminados.length === 1 ? 'terminado' : 'terminados' }}<span class="apoio" style="font-weight:500"> · ficam guardados para consulta</span></span>
        <span class="ver">{{ terminadosAbertos ? 'Ocultar' : 'Ver' }}<Icone nome="baixo" :tam="18" :traco="1.8" :style="{ transform: terminadosAbertos ? 'rotate(180deg)' : 'none' }" /></span>
      </button>
      <div v-if="terminadosAbertos" class="cartao lista-linhas">
        <button v-for="r in terminados" :key="r.id" type="button" class="linha-escolha" @click="abrir('remedio', { id: r.id })">
          {{ r.nome }}<b class="apoio num" style="color:var(--apoio);font-weight:600">começou em {{ dataCurta(r.inicio) }}</b>
        </button>
      </div>
    </section>
  </div>

  <div v-else class="pilha">
    <p class="nota" style="font-size:13px;line-height:19px">Comprimidos e cápsulas descontam sozinhos a cada dose. Gotas, xarope e colírio: você marca o nível.</p>

    <section v-if="contados.length" class="grupo">
      <span class="rotulo">Contados</span>
      <div class="cartao lista-linhas">
        <div v-for="e in contados" :key="e.r.id">
          <button type="button" class="est-linha" :aria-label="`${e.r.nome}: ${e.qtd}, ${e.unid}`" @click="abrir('remedio', { id: e.r.id })">
            <span class="est-nome"><strong>{{ e.r.nome }}</strong><small class="apoio">{{ e.sub }}</small></span>
            <span class="est-qtd"><strong class="num">{{ e.qtd }}</strong><small class="apoio num">{{ e.unid }}</small></span>
          </button>
          <div v-if="e.repor" class="faixa atencao solta" style="margin:0 10px 10px"><Icone nome="atencao" :tam="16" :traco="1.8" /><span class="num">Atenção · {{ e.repor }}</span></div>
        </div>
      </div>
    </section>

    <section v-if="niveis.length" class="grupo">
      <span class="rotulo">Por nível</span>
      <div class="cartao lista-linhas">
        <div v-for="n in niveis" :key="n.r.id" class="nivel">
          <span class="est-nome"><strong>{{ n.r.nome }}</strong><small class="apoio">{{ n.sub }}</small></span>
          <div class="opcoes" role="radiogroup" :aria-label="`Nível de ${n.r.nome}`">
            <button v-for="o in NIVEIS_ESTOQUE" :key="o.id" type="button" role="radio" class="opcao" style="flex:1" :aria-checked="n.r.estoque.nivel === o.id" @click="n.r.estoque.nivel = o.id">{{ o.nome }}</button>
          </div>
        </div>
      </div>
    </section>

    <button type="button" class="botao tracejado" @click="abrir('remedio', { modo: 'guardado' })"><Icone nome="mais" :tam="18" :traco="2" />Guardar um remédio sem tratamento</button>
  </div>
</template>

<style scoped>
.rem { display: flex; gap: 12px; width: 100%; padding: 14px; }
.rem-andares { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
.andar { display: flex; align-items: flex-start; gap: 8px; }
.andar.meio { align-items: center; }
.rem-nome { flex: 1; min-width: 0; font-size: 16px; line-height: 21px; font-weight: 800; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.horas { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; min-width: 0; }
.rem-hoje { font-size: 12px; font-weight: 700; color: var(--apoio); flex-shrink: 0; }
.rem-pe { display: flex; flex-direction: column; gap: 2px; padding-top: 8px; border-top: 1px solid var(--borda); font-size: 12px; font-weight: 600; color: var(--apoio); }
.sos-linha { display: flex; align-items: center; gap: 12px; padding: 14px; }
.sos-abre { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.sos-texto { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.sos-texto strong { font-size: 16px; font-weight: 800; }
.sos-texto small { font-size: 12px; font-weight: 600; }
.est-linha { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 8px 14px; }
.est-nome { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.est-nome strong { font-size: 15px; font-weight: 750; }
.est-nome small { font-size: 12px; font-weight: 500; }
.est-qtd { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
.est-qtd strong { font-size: 18px; font-weight: 800; }
.est-qtd small { font-size: 12px; font-weight: 600; }
.nivel { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; }
</style>
