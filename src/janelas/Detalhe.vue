<script setup>
import { computed, reactive } from 'vue'
import { estado, hoje, agoraMin, marcar, desfazer, adiar, remedioPor } from '../nucleo/dados.js'
import { diaComSituacao, fimDaJanela } from '../nucleo/motor.js'
import { deMin, horaReal, minutos } from '../nucleo/tempo.js'
import { forma, doseTexto } from '../nucleo/formas.js'
import { abrir, fechar, avisar } from '../nucleo/ui.js'
import { iconeCategoria } from '../componentes/icones.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'

const props = defineProps({ chaves: Array })
const outraHora = reactive({})

const itens = computed(() => {
  const doDia = diaComSituacao(estado, hoje.value, hoje.value, agoraMin.value).filter((i) => props.chaves.includes(i.chave))
  const sos = estado.registros.filter((g) => g.tipo === 'sos' && props.chaves.includes(g.chave)).map((g) => {
    const r = remedioPor(g.refId)
    return { chave: g.chave, tipo: 'sos', refId: g.refId, titulo: r?.nome || 'SOS', detalhe: doseTexto(g.qtd ?? 1, r?.forma), forma: r?.forma, verbo: forma(r?.forma).verbo, registro: g, sit: 'feito', hora: null }
  })
  return [...doDia, ...sos].map((i) => {
    const fim = fimDaJanela(i)
    return { ...i, fim, fimTexto: fim === null ? '' : (fim >= 1440 ? 'o fim do dia' : deMin(fim)), chegou: i.hora && agoraMin.value >= minutos(i.hora) }
  })
})
const pendentes = computed(() => itens.value.filter((i) => !i.registro))
const titulo = computed(() => (itens.value.length > 1 ? `Remédios das ${itens.value[0].hora}` : (itens.value[0]?.titulo || 'Detalhes')))
const icone = (i) => (i.tipo === 'rot' ? iconeCategoria(i.categoria) : (i.forma || 'capsula'))
const verbo = (i) => (i.tipo === 'rot' ? 'Fiz' : i.verbo)
const feitoTexto = (i) => (i.registro.estado === 'pulado' ? 'Pulado' : `${i.tipo === 'rot' ? 'Feito' : i.verbo} às ${horaReal(i.registro.horaReal)}`)

function agora(i) { marcar(i, 'feito'); seAcabou() }
function emOutraHora(i) {
  const [h, m] = (outraHora[i.chave] || '').split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return
  const d = new Date(); d.setHours(h, m, 0, 0)
  marcar(i, 'feito', d); delete outraHora[i.chave]; seAcabou()
}
function pular(i) { marcar(i, 'pulado'); seAcabou() }
function todos() { pendentes.value.forEach((i) => marcar(i, 'feito')); fechar() }
function adiar10(i) { adiar(i.data, i.hora, 10); fechar(); avisar('Adiado: lembro de novo em 10 min') }
function seAcabou() { if (!pendentes.value.length && itens.value.length === 1) fechar() }
function editar(i) {
  fechar()
  if (i.tipo === 'rot') abrir('rotina', { id: i.refId })
  else abrir('remedio', { id: i.refId })
}
</script>

<template>
  <Janela :titulo="titulo">
    <p v-if="!itens.length" class="apoio">Este item não está mais no dia de hoje.</p>
    <article v-for="i in itens" :key="i.chave" class="cartao">
      <div class="det-topo">
        <span class="quadro-icone"><Icone :nome="icone(i)" /></span>
        <span class="det-nome">
          <strong :class="{ riscado: i.registro?.estado === 'feito' && i.tipo !== 'sos' }">{{ i.titulo }}</strong>
          <small class="apoio num">{{ [i.hora || (i.tipo === 'sos' ? 'Se precisar' : 'Sem horário'), i.detalhe].filter(Boolean).join(' · ') }}</small>
        </span>
        <span v-if="i.sit === 'atrasado'" class="estado atrasado"><Icone nome="atrasado" :tam="16" :traco="1.8" />Atrasado</span>
        <span v-else-if="i.sit === 'atencao'" class="estado atencao"><Icone nome="atencao" :tam="16" :traco="1.8" />Atenção</span>
      </div>

      <div v-if="i.registro" class="faixa info">
        <Icone :nome="i.registro.estado === 'pulado' ? 'pulado' : 'feito'" :tam="16" :traco="2.2" />
        <span class="num" style="flex:1">Hoje: {{ feitoTexto(i) }}</span>
        <button type="button" class="desfazer" @click="desfazer(i.chave)">Desfazer</button>
      </div>
      <div v-else-if="i.sit === 'atrasado' && i.tipo === 'rem'" class="faixa info">
        <Icone nome="info" :tam="16" :traco="1.6" />
        <span>Era às {{ i.hora }}. Siga a orientação do seu médico ou da bula sobre dose esquecida.</span>
      </div>
      <div v-else-if="i.tipo === 'rem' && i.fimTexto && i.chegou" class="faixa info">
        <Icone nome="info" :tam="16" :traco="1.6" />
        <span class="num">Você anotou: dá para tomar até {{ i.fimTexto }}. Depois disso, o Airmed ainda deixa marcar "{{ verbo(i) }} mais tarde".</span>
      </div>
      <div v-if="i.obs" class="faixa info"><Icone nome="info" :tam="16" :traco="1.6" /><span>{{ i.obs }}</span></div>

      <div v-if="!i.registro" class="det-acoes">
        <div class="linha-botoes">
          <button type="button" class="botao cheio cresce" @click="agora(i)">{{ verbo(i) }} agora</button>
          <button type="button" class="botao suave" @click="pular(i)">Pular</button>
        </div>
        <div class="linha-botoes">
          <label class="entrada fundo-2 outra">
            <span class="apoio">{{ verbo(i) }} às</span>
            <input v-model="outraHora[i.chave]" type="time" class="num" :aria-label="`${verbo(i)} em outra hora`">
          </label>
          <button type="button" class="botao contorno" :disabled="!outraHora[i.chave]" @click="emOutraHora(i)">Guardar</button>
        </div>
        <button v-if="i.chegou && itens.length === 1" type="button" class="botao neutro" @click="adiar10(i)">Adiar 10 min</button>
      </div>
      <button v-if="i.tipo !== 'sos'" type="button" class="editar" @click="editar(i)">Editar {{ i.tipo === 'rot' ? 'rotina' : 'remédio' }}</button>
    </article>
    <template v-if="pendentes.length > 1" #pe>
      <button type="button" class="botao cheio grande cresce" @click="todos">{{ pendentes.length === itens.length ? 'Tomei todos' : `Marcar os outros ${pendentes.length}` }}</button>
    </template>
  </Janela>
</template>

<style scoped>
.det-topo { display: flex; align-items: center; gap: 12px; padding: 14px; }
.det-nome { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.det-nome strong { font-size: 17px; font-weight: 800; }
.det-nome small { font-size: 13px; font-weight: 600; }
.riscado { text-decoration: line-through; color: var(--apoio); }
.estado { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 800; }
.estado.atrasado { color: var(--atrasado); }
.estado.atencao { color: var(--atencao); }
.det-acoes { display: flex; flex-direction: column; gap: 10px; padding: 14px; }
.outra { flex: 1; min-width: 0; }
.desfazer { min-height: 32px; font-weight: 800; color: var(--primaria); }
.editar { width: 100%; min-height: 44px; padding: 0 14px; border-top: 1px solid var(--borda); font-size: 14px; font-weight: 700; color: var(--primaria); text-align: center; }
</style>
