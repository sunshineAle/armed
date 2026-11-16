<script setup>
import { reactive, ref } from 'vue'
import { estado, rotinaPor, salvarRotina, apagarRotina } from '../nucleo/dados.js'
import { diasTexto } from '../nucleo/motor.js'
import { DIAS_LETRA, DIAS_NOME } from '../nucleo/tempo.js'
import { NIVEIS_ROTINA } from '../nucleo/formas.js'
import { fechar, avisar } from '../nucleo/ui.js'
import { iconeCategoria } from '../componentes/icones.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'

const props = defineProps({ id: String })
const original = props.id ? rotinaPor(props.id) : null
const f = reactive({
  nome: original?.nome || '',
  categoria: original?.categoria || '',
  dias: [...(original?.dias || [0, 1, 2, 3, 4, 5, 6])],
  temHora: original ? !!original.hora : true,
  hora: original?.hora || '08:00',
  meta: original?.meta || '',
  nivel: original?.nivel || 'lembrar',
})
const nova = ref('')
const erro = ref('')
const confirmaApagar = ref(false)
const alternaDia = (i) => { f.dias = f.dias.includes(i) ? f.dias.filter((d) => d !== i) : [...f.dias, i] }
function criarCategoria() {
  const n = nova.value.trim()
  if (!n) return
  if (!estado.categorias.includes(n)) estado.categorias.push(n)
  f.categoria = n
  nova.value = ''
}
function salvar() {
  erro.value = ''
  if (!f.nome.trim()) { erro.value = 'Escreva o nome da rotina.'; return }
  if (!f.dias.length) { erro.value = 'Escolha pelo menos um dia.'; return }
  const semHora = !f.temHora || !f.hora
  salvarRotina({
    ...(original || {}), nome: f.nome.trim(), categoria: f.categoria, dias: [...f.dias].sort(),
    hora: semHora ? null : f.hora, meta: f.meta.trim(),
    nivel: semHora ? 'marcar' : f.nivel,
  })
  fechar()
  avisar(`${f.nome.trim()} ${original ? 'atualizada' : 'guardada'}`)
}
function apagar() { apagarRotina(original.id); fechar(); avisar(`${original.nome} apagada`) }
</script>

<template>
  <Janela :titulo="original ? 'Editar rotina' : 'Nova rotina'" sair="Cancelar">
    <div class="campo">
      <label for="rot-nome">O que você quer acompanhar</label>
      <div class="entrada"><input id="rot-nome" v-model="f.nome" autocomplete="off" maxlength="60" placeholder="Ex.: Alongar"></div>
    </div>
    <div class="campo">
      <label for="rot-meta">Quanto (opcional)</label>
      <div class="entrada"><input id="rot-meta" v-model="f.meta" maxlength="30" placeholder="Ex.: 10 min, 10 páginas" style="font-weight:500"></div>
    </div>

    <div class="campo">
      <span class="titulo">Categoria (opcional)</span>
      <div class="opcoes" role="radiogroup" aria-label="Categoria">
        <button v-for="c in estado.categorias" :key="c" type="button" role="radio" class="opcao com-icone" :aria-checked="f.categoria === c" @click="f.categoria = f.categoria === c ? '' : c"><Icone :nome="iconeCategoria(c)" :tam="18" />{{ c }}</button>
      </div>
      <div class="linha-botoes">
        <label class="entrada fundo-2" style="flex:1"><input v-model="nova" maxlength="24" placeholder="Outra categoria" aria-label="Nova categoria" style="font-weight:500" @keyup.enter="criarCategoria"></label>
        <button type="button" class="botao contorno" :disabled="!nova.trim()" @click="criarCategoria">Criar</button>
      </div>
    </div>

    <div class="campo">
      <span class="titulo">Em quais dias · {{ f.dias.length ? diasTexto(f.dias) : 'nenhum' }}</span>
      <div class="opcoes" role="group" aria-label="Dias da semana">
        <button v-for="(l, i) in DIAS_LETRA" :key="i" type="button" class="opcao dia" :aria-pressed="f.dias.includes(i)" :aria-label="DIAS_NOME[i]" @click="alternaDia(i)">{{ l }}</button>
      </div>
    </div>

    <div class="campo">
      <span class="titulo">Horário</span>
      <div class="segmento" role="radiogroup" aria-label="Horário">
        <button type="button" role="radio" :aria-checked="f.temHora" @click="f.temHora = true">Com horário</button>
        <button type="button" role="radio" :aria-checked="!f.temHora" @click="f.temHora = false">A qualquer hora</button>
      </div>
      <label v-if="f.temHora" class="entrada"><input v-model="f.hora" type="time" class="num" aria-label="Horário da rotina"></label>
    </div>

    <div v-if="f.temHora" class="campo">
      <span class="titulo">Como o Airmed cuida disso?</span>
      <div class="cartao lista-linhas" role="radiogroup" aria-label="Como o Airmed cuida disso">
        <button v-for="(n, id) in NIVEIS_ROTINA" :key="id" type="button" role="radio" class="nivel" :aria-checked="f.nivel === id" @click="f.nivel = id">
          <Icone :nome="id" :tam="20" :traco="1.6" />
          <span><strong>{{ n.nome }}</strong><small class="apoio">{{ n.texto }}</small></span>
          <span class="bolinha" :class="{ on: f.nivel === id }"></span>
        </button>
      </div>
    </div>
    <p v-else class="nota">Sem horário, a rotina aparece no dia só para marcar "fiz". O Airmed não lembra nem cobra.</p>

    <template v-if="original">
      <button v-if="!confirmaApagar" type="button" class="botao perigo" @click="confirmaApagar = true"><Icone nome="lixeira" :tam="18" />Apagar esta rotina</button>
      <div v-else class="cartao apagar">
        <p><strong>Apagar {{ original.nome }}?</strong> O histórico dela também sai. Não dá para desfazer.</p>
        <div class="linha-botoes"><button type="button" class="botao suave cresce" @click="confirmaApagar = false">Manter</button><button type="button" class="botao perigo cresce" @click="apagar">Apagar</button></div>
      </div>
    </template>

    <template #pe>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button type="button" class="botao cheio grande" @click="salvar">Salvar rotina</button>
      </div>
    </template>
  </Janela>
</template>

<style scoped>
.com-icone { display: flex; align-items: center; gap: 6px; }
.nivel { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 8px 14px; color: var(--texto); }
.nivel > span:nth-child(2) { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.nivel strong { font-size: 15px; font-weight: 800; }
.nivel small { font-size: 12px; }
.bolinha { width: 20px; height: 20px; border-radius: 10px; border: 1.5px solid var(--apoio); flex-shrink: 0; }
.bolinha.on { border: 6px solid var(--primaria); }
.apagar { padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 14px; }
</style>
