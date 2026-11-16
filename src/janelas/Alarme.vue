<script setup>
// Alarme dentro do app, no tema que a pessoa escolheu.
// O alarme em tela cheia com o celular bloqueado só existe na capa Android.
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { tocarAlarme, pararAlarme, somPronto, destravarSom } from '../nucleo/som.js'
import { estado, hoje, agoraMin, marcar, desfazer, adiar } from '../nucleo/dados.js'
import { diaComSituacao, fimDaJanela } from '../nucleo/motor.js'
import { deMin, horaCurta, horaReal } from '../nucleo/tempo.js'
import { ui, avisar } from '../nucleo/ui.js'
import { iconeCategoria } from '../componentes/icones.js'
import Icone from '../componentes/Icone.vue'

const props = defineProps({ data: String, hora: String })
const itens = computed(() => diaComSituacao(estado, props.data, hoje.value, agoraMin.value)
  .filter((i) => i.hora === props.hora && !(i.tipo === 'rot' && i.nivel === 'marcar')))
const pendentes = computed(() => itens.value.filter((i) => !i.registro))
const soRemedios = computed(() => itens.value.every((i) => i.tipo === 'rem'))
const janela = computed(() => {
  const fins = pendentes.value.map(fimDaJanela).filter((f) => f !== null)
  if (!fins.length) return ''
  const f = Math.min(...fins)
  return f >= 1440 ? 'o fim do dia' : deMin(f)
})
// Toca e vibra até a primeira resposta. Sem toque anterior na tela, o navegador não deixa sair som: aí aparece o aviso.
const mudo = ref(false)
onMounted(() => { if (estado.prefs.som) { tocarAlarme(); mudo.value = !somPronto() } })
onBeforeUnmount(pararAlarme)
function calar() { if (mudo.value) { destravarSom(); mudo.value = false } pararAlarme() }
const fechar = () => { ui.alarme = null }
function todos() { pendentes.value.forEach((i) => marcar(i, 'feito')) }
function adiar10() { adiar(props.data, props.hora, 10); fechar(); avisar('Adiado: lembro de novo em 10 min') }
function pular() { pendentes.value.forEach((i) => marcar(i, 'pulado')); fechar() }
const icone = (i) => (i.tipo === 'rot' ? iconeCategoria(i.categoria) : i.forma)
const verbo = (i) => (i.tipo === 'rot' ? 'Fiz' : i.verbo)
</script>

<template>
  <div class="alarme" role="alertdialog" aria-modal="true" :aria-label="`Lembrete das ${horaCurta(hora)}`" @pointerdown="calar">
    <div class="alarme-caixa">
      <div class="alarme-topo">
        <span class="marca"><Icone nome="marca" :tam="18" :traco="1.6" />Airmed</span>
        <span class="num relogio">{{ hora }}</span>
        <strong>{{ soRemedios ? 'Remédios' : 'Lembretes' }} das {{ horaCurta(hora) }}</strong>
      </div>

      <div class="cartao lista-linhas">
        <div v-for="i in itens" :key="i.chave" class="al-item">
          <span class="quadro-icone"><Icone :nome="icone(i)" /></span>
          <span class="al-nome">
            <strong :class="{ riscado: i.registro?.estado === 'feito' }">{{ i.titulo }}</strong>
            <small class="apoio num">{{ i.registro ? (i.registro.estado === 'pulado' ? 'Pulado' : `${verbo(i)} às ${horaReal(i.registro.horaReal)}`) : i.detalhe }}</small>
          </span>
          <button v-if="!i.registro" type="button" class="botao contorno" @click="marcar(i, 'feito')">{{ verbo(i) }}</button>
          <button v-else type="button" class="desfazer" @click="desfazer(i.chave)">Desfazer</button>
        </div>
      </div>

      <div v-if="janela" class="faixa info solta">
        <Icone nome="info" :tam="16" :traco="1.6" />
        <span class="num">Você anotou: dá para fazer até {{ janela }}. Depois disso, o Airmed ainda deixa marcar mais tarde.</span>
      </div>

      <span style="flex:1"></span>
      <button v-if="pendentes.length" type="button" class="botao cheio enorme" @click="todos">
        {{ pendentes.length === itens.length ? (itens.length > 1 ? (soRemedios ? 'Tomei todos' : 'Fiz todos') : verbo(itens[0])) : `Marcar os outros ${pendentes.length}` }}
      </button>
      <button v-else type="button" class="botao enorme pronto" @click="fechar"><Icone nome="feito" :tam="20" :traco="2.4" />Tudo certo nas {{ horaCurta(hora) }}</button>
      <div v-if="pendentes.length" class="linha-botoes">
        <button type="button" class="botao neutro grande cresce" @click="adiar10">Adiar 10 min</button>
        <button type="button" class="botao suave grande cresce" @click="pular">Pular</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alarme { position: fixed; inset: 0; z-index: 80; background: var(--fundo); overflow-y: auto; }
.alarme-caixa { min-height: 100dvh; max-width: 480px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; padding: 40px 20px 28px; }
.alarme-topo { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.marca { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--apoio); }
.marca svg { color: var(--primaria); }
.relogio { font-size: 72px; line-height: 80px; font-weight: 800; letter-spacing: -2px; }
.alarme-topo strong { font-size: 17px; font-weight: 700; }
.al-item { display: flex; align-items: center; gap: 12px; min-height: 72px; padding: 10px 12px 10px 14px; }
.al-nome { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.al-nome strong { font-size: 16px; font-weight: 800; }
.al-nome small { font-size: 13px; font-weight: 600; }
.riscado { text-decoration: line-through; color: var(--apoio); }
.desfazer { min-height: 44px; padding: 0 12px; font-size: 14px; font-weight: 800; color: var(--primaria); }
.enorme { min-height: 64px; border-radius: 20px; font-size: 19px; }
.pronto { background: var(--chip); color: var(--sobre-chip); font-size: 17px; }
</style>
