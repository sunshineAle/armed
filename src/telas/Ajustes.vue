<script setup>
// Ajustes (provisório: a tela definitiva ainda vai ser desenhada).
import { ref } from 'vue'
import { computed } from 'vue'
import { estado, comecar, apagarTudo, hoje, agoraMin, relogio } from '../nucleo/dados.js'
import { diasSemBackup } from '../nucleo/backup.js'
import { diaComSituacao } from '../nucleo/motor.js'
import { permissao, pedirPermissao, notificar } from '../nucleo/avisos.js'
import { ui, avisar, irPara, abrir } from '../nucleo/ui.js'
import { horaDe } from '../nucleo/tempo.js'
import Icone from '../componentes/Icone.vue'

const perm = ref(permissao())
const confirma = ref('')
const ultimoBackup = computed(() => {
  const d = diasSemBackup(estado.backup?.ultimo, relogio.agora)
  if (d === null) return 'Nunca'
  return d === 0 ? 'Hoje' : d === 1 ? 'Ontem' : `Há ${d} dias`
})
const TEXTO = { granted: 'Ligadas', denied: 'Bloqueadas no navegador', default: 'Desligadas', unsupported: 'Este navegador não tem notificações' }
async function ligar() {
  perm.value = await pedirPermissao()
  if (perm.value === 'granted') notificar(horaDe(new Date()), [{ tipo: 'rot', titulo: 'Notificações ligadas' }])
}
function testarAlarme() {
  const doDia = diaComSituacao(estado, hoje.value, hoje.value, agoraMin.value).filter((o) => o.tipo === 'rem')
  const item = doDia.find((o) => !o.registro) || doDia[0]
  if (!item) { avisar('Cadastre um remédio com horário para hoje e teste de novo'); return }
  ui.alarme = { data: hoje.value, hora: item.hora }
}
function demo() { comecar(true); confirma.value = ''; irPara('hoje'); avisar('Dados fictícios carregados') }
function zerar() { apagarTudo(); confirma.value = '' }
</script>

<template>
  <header class="cabeca"><div><small>Versão de teste 0.2</small><h1>Ajustes</h1></div></header>

  <section class="grupo">
    <span class="rotulo">Aparência · tema Ervas</span>
    <div class="segmento" role="radiogroup" aria-label="Aparência">
      <button v-for="o in [['sistema', 'Do aparelho'], ['claro', 'Claro'], ['escuro', 'Escuro']]" :key="o[0]" type="button" role="radio" :aria-checked="estado.prefs.modo === o[0]" @click="estado.prefs.modo = o[0]">{{ o[1] }}</button>
    </div>
    <p class="nota">Os temas Manto, Poço de Sláine e Flores chegam depois.</p>
  </section>

  <section class="grupo">
    <span class="rotulo">Lembretes</span>
    <div class="cartao lista-linhas">
      <div class="linha-escolha">Notificações<b :style="{ color: perm === 'granted' ? 'var(--primaria)' : 'var(--apoio)' }">{{ TEXTO[perm] }}</b></div>
      <label class="linha-escolha" style="cursor:pointer">
        <span style="flex:1">Mostrar o nome do remédio na notificação</span>
        <input v-model="estado.prefs.nomeNaNotificacao" type="checkbox" class="chave">
      </label>
    </div>
    <div class="linha-botoes">
      <button v-if="perm === 'default'" type="button" class="botao cheio cresce" @click="ligar">Ligar notificações</button>
      <button type="button" class="botao contorno cresce" @click="testarAlarme">Ver como é o alarme</button>
    </div>
    <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Nesta versão de teste, o lembrete só toca com o Airmed aberto no navegador. O alarme de verdade, com o celular bloqueado, vem com o app Android.</span></div>
  </section>

  <section class="grupo">
    <span class="rotulo">Backup</span>
    <div class="cartao lista-linhas">
      <div class="linha-escolha">Último backup<b :style="{ color: ultimoBackup === 'Nunca' ? 'var(--apoio)' : 'var(--primaria)' }">{{ ultimoBackup }}</b></div>
    </div>
    <div class="linha-botoes">
      <button type="button" class="botao cheio cresce" @click="abrir('backup', { modo: 'fazer' })">Fazer backup</button>
      <button type="button" class="botao contorno cresce" @click="abrir('backup', { modo: 'restaurar' })">Restaurar</button>
    </div>
    <p class="nota">O backup é um arquivo trancado com a sua senha. O Airmed lembra quando passar uma semana sem backup.</p>
  </section>

  <section class="grupo">
    <span class="rotulo">Dados deste aparelho</span>
    <div class="cartao lista-linhas">
      <button type="button" class="linha-escolha" @click="confirma = 'demo'">Trocar tudo por dados fictícios<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
      <button type="button" class="linha-escolha" style="color:var(--atrasado)" @click="confirma = 'zerar'">Apagar tudo e começar do zero<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
    </div>
    <div v-if="confirma" class="cartao confirma">
      <p><strong>{{ confirma === 'demo' ? 'Trocar por dados fictícios?' : 'Apagar tudo?' }}</strong> O que está cadastrado neste aparelho será apagado. Se quiser guardar, faça um backup antes.</p>
      <div class="linha-botoes">
        <button type="button" class="botao suave cresce" @click="confirma = ''">Manter</button>
        <button type="button" class="botao perigo cresce" @click="confirma === 'demo' ? demo() : zerar()">{{ confirma === 'demo' ? 'Trocar' : 'Apagar' }}</button>
      </div>
    </div>
    <p class="nota">Tudo fica guardado só neste navegador. Nada é enviado para servidor.</p>
  </section>

  <section class="grupo">
    <span class="rotulo">Sobre</span>
    <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>O Airmed é um organizador e lembrete. Ele não indica, não calcula e não bloqueia dose, e não substitui a orientação do seu médico ou da bula.</span></div>
    <p class="nota" style="text-align:center;padding-top:8px">Airmed · um projeto <strong>Alt Design Creative</strong></p>
  </section>
</template>

<style scoped>
.chave { width: 22px; height: 22px; accent-color: var(--primaria); flex-shrink: 0; }
.confirma { padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 14px; }
</style>
