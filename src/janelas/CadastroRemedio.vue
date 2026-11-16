<script setup>
// Cadastro enxuto: o obrigatório numa tela; o resto em "Mais detalhes".
// O Airmed só guarda o que a pessoa informa. Não sugere dose, horário nem janela.
import { reactive, computed, ref } from 'vue'
import { estado, hoje, remedioPor, salvarRemedio, apagarRemedio } from '../nucleo/dados.js'
import { horariosACada, caiDeMadrugada, consumoDiario, faltaUsar, frequenciaTexto } from '../nucleo/motor.js'
import { horaCurta, dataCurta, DIAS_LETRA, DIAS_NOME, minutos } from '../nucleo/tempo.js'
import { FORMAS, forma, doseTexto, JANELAS, NIVEIS_ESTOQUE } from '../nucleo/formas.js'
import { fechar, avisar } from '../nucleo/ui.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'

const props = defineProps({ id: String, modo: { type: String, default: 'tratamento' } })
const original = props.id ? remedioPor(props.id) : null
const tipo = original?.tipo || props.modo
const ehTratamento = tipo === 'tratamento'

const f = reactive({
  nome: original?.nome || '',
  forma: original?.forma || 'comprimido',
  rep: original?.repete?.tipo || 'diario',
  dias: [...(original?.repete?.dias || [0, 1, 2, 3, 4])],
  cada: original?.repete?.cada || 8,
  sim: original?.repete?.sim || 1,
  nao: original?.repete?.nao || 1,
  inicio: original?.inicio || hoje.value,
  horarios: (original?.horarios || []).map((h) => ({ h: h.h, dose: h.dose ?? null })),
  dur: original?.duracao?.tipo || 'continuo',
  durN: original?.duracao?.n || 10,
  dose: original?.dose ?? 1,
  temEstoque: !!original?.estoque || tipo === 'guardado',
  qtd: original?.estoque?.tipo === 'contado' ? original.estoque.qtd : null,
  nivel: original?.estoque?.tipo === 'nivel' ? original.estoque.nivel : 'cheio',
  janela: original?.janela ?? null,
  obs: original?.obs || '',
  intervalo: original?.sos?.intervalo ?? null,
  maximo: original?.sos?.maximo ?? null,
})
const aberta = ref(null)
const detalhes = ref(false)
const novaHora = ref('')
const erro = ref('')
const confirmaApagar = ref(false)

const fm = computed(() => forma(f.forma))
const contado = computed(() => fm.value.contagem === 'contado')
const titulo = computed(() => (original ? 'Editar remédio' : tipo === 'sos' ? 'Novo SOS' : tipo === 'guardado' ? 'Guardar remédio' : 'Novo remédio'))
const repete = computed(() => ({
  tipo: f.rep,
  ...(f.rep === 'semana' ? { dias: [...f.dias].sort() } : {}),
  ...(f.rep === 'horas' ? { cada: Number(f.cada) } : {}),
  ...(f.rep === 'ciclo' ? { sim: Number(f.sim), nao: Number(f.nao) } : {}),
}))
const horariosFinais = computed(() => (f.rep === 'horas' && f.horarios[0]
  ? horariosACada(f.horarios[0].h, Math.max(Number(f.cada) || 1, 1)).map((h) => ({ h, dose: null }))
  : f.horarios))
const madrugada = computed(() => f.rep === 'horas' && caiDeMadrugada(horariosFinais.value.map((h) => h.h)))
const rascunho = computed(() => ({
  ...(original || {}), tipo, nome: f.nome.trim(), forma: f.forma, dose: Number(f.dose) || 1, inicio: f.inicio,
  repete: repete.value,
  horarios: ehTratamento ? horariosFinais.value.map((h) => ({ h: h.h, ...(h.dose !== null && h.dose !== '' && Number(h.dose) !== (Number(f.dose) || 1) ? { dose: Number(h.dose) } : {}) })) : [],
  duracao: ehTratamento ? (f.dur === 'continuo' ? { tipo: 'continuo' } : { tipo: f.dur, n: Math.max(Number(f.durN) || 1, 1) }) : undefined,
  janela: f.janela ?? 60,
  obs: f.obs.trim(),
  estoque: !f.temEstoque ? null : (contado.value ? (f.qtd === null || f.qtd === '' ? null : { tipo: 'contado', qtd: Number(f.qtd) }) : { tipo: 'nivel', nivel: f.nivel }),
  sos: tipo === 'sos' ? { intervalo: Number(f.intervalo) || null, maximo: Number(f.maximo) || null } : undefined,
}))
const estoqueNota = computed(() => {
  const r = rascunho.value
  if (!ehTratamento || r.estoque?.tipo !== 'contado' || !r.horarios.length) return ''
  const consumo = consumoDiario(r)
  const dias = consumo > 0 ? Math.floor(r.estoque.qtd / consumo) : 0
  const falta = faltaUsar(estado, r, hoje.value)
  if (falta !== null) return r.estoque.qtd >= falta ? 'dá até o fim do tratamento' : `não dá até o fim: faltariam ${Math.ceil(falta - r.estoque.qtd)}`
  return `dá para uns ${dias} dias`
})
const estoqueFalta = computed(() => estoqueNota.value.startsWith('não dá'))

function addHora() {
  if (!novaHora.value) return
  if (!f.horarios.some((h) => h.h === novaHora.value)) f.horarios.push({ h: novaHora.value, dose: null })
  f.horarios.sort((a, b) => minutos(a.h) - minutos(b.h))
  novaHora.value = ''
}
const tirarHora = (h) => { f.horarios = f.horarios.filter((x) => x !== h) }
function atalho(a) {
  if (a === 'alternado') Object.assign(f, { rep: 'ciclo', sim: 1, nao: 1 })
  if (a === 'semanal') Object.assign(f, { rep: 'semana', dias: [(new Date(f.inicio + 'T12:00').getDay() + 6) % 7] })
  if (a === '21') Object.assign(f, { rep: 'ciclo', sim: 21, nao: 7 })
}
const alternaDia = (i) => { f.dias = f.dias.includes(i) ? f.dias.filter((d) => d !== i) : [...f.dias, i] }

function salvar() {
  erro.value = ''
  if (!f.nome.trim()) { erro.value = 'Escreva o nome do remédio.'; return }
  if (ehTratamento && !horariosFinais.value.length) { erro.value = 'Coloque pelo menos um horário.'; return }
  if (ehTratamento && f.rep === 'semana' && !f.dias.length) { erro.value = 'Escolha pelo menos um dia da semana.'; return }
  salvarRemedio(rascunho.value)
  fechar()
  avisar(`${f.nome.trim()} ${original ? 'atualizado' : 'guardado'}`)
}
function apagar() {
  apagarRemedio(original.id)
  fechar()
  avisar(`${original.nome} apagado`)
}
</script>

<template>
  <Janela :titulo="titulo" sair="Cancelar">
    <div class="campo">
      <label for="rem-nome">Nome do remédio</label>
      <div class="entrada"><input id="rem-nome" v-model="f.nome" autocomplete="off" maxlength="60" placeholder="Como está na caixa"></div>
    </div>

    <div class="campo">
      <span class="titulo">{{ ehTratamento ? 'Como é e quando toma' : 'Como é' }}</span>
      <div class="cartao lista-linhas">
        <div>
          <button type="button" class="linha-escolha" :aria-expanded="aberta === 'forma'" @click="aberta = aberta === 'forma' ? null : 'forma'">Forma<b>{{ fm.nome }}</b><Icone nome="direita" :tam="18" :traco="1.8" /></button>
          <div v-if="aberta === 'forma'" class="dentro">
            <div class="opcoes" role="radiogroup" aria-label="Forma">
              <button v-for="o in FORMAS" :key="o.id" type="button" role="radio" class="opcao com-icone" :aria-checked="f.forma === o.id" @click="f.forma = o.id; aberta = null"><Icone :nome="o.id" :tam="18" />{{ o.nome }}</button>
            </div>
          </div>
        </div>
        <div v-if="ehTratamento">
          <button type="button" class="linha-escolha" :aria-expanded="aberta === 'repete'" @click="aberta = aberta === 'repete' ? null : 'repete'">Repete<b>{{ frequenciaTexto({ repete }) }}</b><Icone nome="direita" :tam="18" :traco="1.8" /></button>
          <div v-if="aberta === 'repete'" class="dentro">
            <div class="opcoes" role="radiogroup" aria-label="Repete">
              <button v-for="o in [['diario', 'Todo dia'], ['semana', 'Dias da semana'], ['horas', 'A cada X horas'], ['ciclo', 'Ciclo']]" :key="o[0]" type="button" role="radio" class="opcao" :aria-checked="f.rep === o[0]" @click="f.rep = o[0]">{{ o[1] }}</button>
            </div>
            <div v-if="f.rep === 'semana'" class="opcoes" role="group" aria-label="Dias da semana">
              <button v-for="(l, i) in DIAS_LETRA" :key="i" type="button" class="opcao dia" :aria-pressed="f.dias.includes(i)" :aria-label="DIAS_NOME[i]" @click="alternaDia(i)">{{ l }}</button>
            </div>
            <label v-if="f.rep === 'horas'" class="entrada fundo-2"><span class="apoio">A cada</span><input v-model.number="f.cada" type="number" min="1" max="24" class="curto num" aria-label="Intervalo em horas"><span class="apoio">horas</span></label>
            <div v-if="f.rep === 'ciclo'" class="linha-botoes">
              <label class="entrada fundo-2" style="flex:1"><input v-model.number="f.sim" type="number" min="1" class="curto num" aria-label="Dias sim"><span class="apoio">dias sim</span></label>
              <label class="entrada fundo-2" style="flex:1"><input v-model.number="f.nao" type="number" min="1" class="curto num" aria-label="Dias não"><span class="apoio">dias não</span></label>
            </div>
            <div class="opcoes" aria-label="Atalhos">
              <button type="button" class="opcao" @click="atalho('alternado')">Dia sim, dia não</button>
              <button type="button" class="opcao" @click="atalho('semanal')">1 vez por semana</button>
              <button type="button" class="opcao" @click="atalho('21')">21 + 7</button>
            </div>
          </div>
        </div>
        <div v-if="ehTratamento">
          <button type="button" class="linha-escolha" :aria-expanded="aberta === 'comeca'" @click="aberta = aberta === 'comeca' ? null : 'comeca'">Começa<b class="num">{{ f.inicio === hoje ? 'Hoje, ' : '' }}{{ dataCurta(f.inicio) }}</b><Icone nome="direita" :tam="18" :traco="1.8" /></button>
          <div v-if="aberta === 'comeca'" class="dentro">
            <label class="entrada fundo-2"><input v-model="f.inicio" type="date" class="num" aria-label="Data de início"></label>
          </div>
        </div>
      </div>
    </div>

    <div v-if="ehTratamento" class="campo">
      <span class="titulo">{{ f.rep === 'horas' ? 'Primeiro horário' : 'Horários' }}</span>
      <div class="opcoes">
        <button v-for="h in (f.rep === 'horas' ? f.horarios.slice(0, 1) : f.horarios)" :key="h.h" type="button" class="hora-chip num" :aria-label="`Tirar o horário ${h.h}`" @click="tirarHora(h)">{{ horaCurta(h.h) }}<Icone nome="mais" :tam="14" :traco="2" style="transform:rotate(45deg)" /></button>
        <label v-if="f.rep !== 'horas' || !f.horarios.length" class="hora-nova">
          <Icone nome="mais" :tam="16" :traco="2" />
          <input v-model="novaHora" type="time" class="num" aria-label="Novo horário" @change="addHora">
        </label>
      </div>
      <p v-if="f.rep === 'horas' && horariosFinais.length" class="nota num">No dia fica assim: {{ horariosFinais.map((h) => horaCurta(h.h)).join(' · ') }}</p>
      <div v-if="madrugada" class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Um dos horários cai de madrugada. Se for isso mesmo, pode salvar.</span></div>
    </div>

    <div v-if="ehTratamento" class="campo">
      <span class="titulo">Por quanto tempo</span>
      <div class="segmento" role="radiogroup" aria-label="Por quanto tempo">
        <button v-for="o in [['continuo', 'Uso contínuo'], ['dias', 'Dias'], ['doses', 'Doses']]" :key="o[0]" type="button" role="radio" :aria-checked="f.dur === o[0]" @click="f.dur = o[0]">{{ o[1] }}</button>
      </div>
      <label v-if="f.dur !== 'continuo'" class="entrada"><input v-model.number="f.durN" type="number" min="1" class="curto num" :aria-label="f.dur === 'dias' ? 'Número de dias' : 'Número de doses'"><span class="apoio">{{ f.dur === 'dias' ? 'dias, a partir do começo' : 'doses no total' }}</span></label>
    </div>

    <div v-if="tipo === 'sos'" class="campo">
      <span class="titulo">O que você quer ver na hora de tomar (opcional)</span>
      <label class="entrada"><span class="apoio">Intervalo de</span><input v-model.number="f.intervalo" type="number" min="0" step="0.5" class="curto num" aria-label="Intervalo mínimo em horas"><span class="apoio">horas</span></label>
      <label class="entrada"><span class="apoio">No máximo</span><input v-model.number="f.maximo" type="number" min="0" class="curto num" aria-label="Máximo de vezes por dia"><span class="apoio">vezes por dia</span></label>
      <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Preencha conforme a orientação do seu médico ou da bula. O Airmed só mostra o que você anotou e a última vez que tomou. Ele nunca bloqueia.</span></div>
    </div>

    <div class="cartao">
      <button type="button" class="mais-detalhes" :aria-expanded="detalhes" @click="detalhes = !detalhes">
        <span><strong>Mais detalhes</strong><small class="apoio">Opcional: dose, estoque, observação{{ ehTratamento ? ' e até quando pode tomar' : '' }}</small></span>
        <Icone nome="baixo" :tam="20" :traco="1.8" :style="{ color: 'var(--primaria)', transform: detalhes ? 'rotate(180deg)' : 'none' }" />
      </button>
      <div v-if="detalhes" class="detalhes">
        <div class="campo">
          <span class="titulo">Dose de cada vez</span>
          <label class="entrada fundo-2"><input v-model.number="f.dose" type="number" min="0" step="0.5" class="curto num" aria-label="Dose de cada vez"><span class="apoio">{{ fm.varios }}</span></label>
        </div>
        <div v-if="ehTratamento && f.rep !== 'horas' && f.horarios.length > 1" class="campo">
          <span class="titulo">Dose diferente em algum horário</span>
          <label v-for="h in f.horarios" :key="h.h" class="dose-linha">
            <span class="num">{{ horaCurta(h.h) }}</span>
            <span class="entrada fundo-2"><input v-model="h.dose" type="number" min="0" step="0.5" class="curto num" :placeholder="String(f.dose)" :aria-label="`Dose das ${h.h}`"><span class="apoio">{{ doseTexto(h.dose === null || h.dose === '' ? Number(f.dose) || 1 : Number(h.dose), f.forma) }}</span></span>
          </label>
        </div>
        <div class="campo">
          <span class="titulo">{{ contado ? 'Quantos você tem em casa' : 'Como está o frasco' }}</span>
          <label v-if="contado" class="entrada fundo-2"><input v-model="f.qtd" type="number" min="0" step="0.5" class="curto num" aria-label="Quantidade em casa" @input="f.temEstoque = true"><span class="apoio num">{{ fm.varios }}{{ estoqueNota && !estoqueFalta ? ` · ${estoqueNota}` : '' }}</span></label>
          <div v-else class="opcoes" role="radiogroup" aria-label="Nível do frasco">
            <button type="button" role="radio" class="opcao" :aria-checked="!f.temEstoque" @click="f.temEstoque = false">Não controlar</button>
            <button v-for="o in NIVEIS_ESTOQUE" :key="o.id" type="button" role="radio" class="opcao" :aria-checked="f.temEstoque && f.nivel === o.id" @click="f.temEstoque = true; f.nivel = o.id">{{ o.nome }}</button>
          </div>
          <div v-if="estoqueFalta" class="faixa atencao solta"><Icone nome="atencao" :tam="16" :traco="1.8" /><span class="num">Atenção · {{ estoqueNota }}</span></div>
        </div>
        <div v-if="ehTratamento" class="campo">
          <span class="titulo">Até quando posso tomar depois do horário</span>
          <div class="opcoes" role="radiogroup" aria-label="Até quando posso tomar">
            <button v-for="j in JANELAS" :key="j.v" type="button" role="radio" class="opcao" :aria-checked="f.janela === j.v" @click="f.janela = f.janela === j.v ? null : j.v">{{ j.nome }}</button>
          </div>
          <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Conforme a orientação do seu médico ou da bula. Se deixar em branco, o Airmed lembra por 1 hora.</span></div>
        </div>
        <div class="campo">
          <label for="rem-obs">Observação</label>
          <div class="entrada fundo-2"><input id="rem-obs" v-model="f.obs" maxlength="120" placeholder="Ex.: tomar com comida" style="font-weight:500"></div>
        </div>
      </div>
    </div>

    <template v-if="original">
      <button v-if="!confirmaApagar" type="button" class="botao perigo" @click="confirmaApagar = true"><Icone nome="lixeira" :tam="18" />Apagar este remédio</button>
      <div v-else class="cartao apagar">
        <p><strong>Apagar {{ original.nome }}?</strong> O histórico dele também sai. Não dá para desfazer.</p>
        <div class="linha-botoes"><button type="button" class="botao suave cresce" @click="confirmaApagar = false">Manter</button><button type="button" class="botao perigo cresce" @click="apagar">Apagar</button></div>
      </div>
    </template>

    <template #pe>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button type="button" class="botao cheio grande" @click="salvar">Salvar remédio</button>
      </div>
    </template>
  </Janela>
</template>

<style scoped>
.com-icone { display: flex; align-items: center; gap: 6px; }
.hora-chip { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px 0 14px; border-radius: 12px; background: var(--chip); color: var(--sobre-chip); font-size: 16px; font-weight: 800; }
.hora-nova { display: flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1.5px dashed var(--apoio); font-size: 14px; font-weight: 700; }
.hora-nova input { border: 0; outline: 0; background: transparent; font-weight: 700; }
.mais-detalhes { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 8px 14px; }
.mais-detalhes span { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.mais-detalhes strong { font-size: 15px; font-weight: 800; }
.mais-detalhes small { font-size: 12px; }
.detalhes { display: flex; flex-direction: column; gap: 18px; padding: 16px 14px; border-top: 1px solid var(--borda); }
.dose-linha { display: flex; align-items: center; gap: 10px; }
.dose-linha > .num { width: 52px; font-size: 15px; font-weight: 800; }
.dose-linha .entrada { flex: 1; }
.apagar { padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 14px; }
</style>
