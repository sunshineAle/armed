<script setup>
// Ajustes (provisório: a tela definitiva ainda vai ser desenhada).
import { ref } from 'vue'
import { computed } from 'vue'
import { estado, comecar, apagarTudo, hoje, agoraMin, relogio } from '../nucleo/dados.js'
import { diasSemBackup, INTERVALOS } from '../nucleo/backup.js'
import { acesso, apagarAcesso, bloquear, minutosAutoBloqueio, definirAutoBloqueio } from '../nucleo/acesso.js'
import { diaComSituacao } from '../nucleo/motor.js'
import { permissao, pedirPermissao, notificar } from '../nucleo/avisos.js'
import { ui, avisar, irPara, abrir } from '../nucleo/ui.js'
import { horaDe } from '../nucleo/tempo.js'
import Icone from '../componentes/Icone.vue'

const perm = ref(permissao())
const confirma = ref('')
const auto = ref(minutosAutoBloqueio())
const mudarAuto = (m) => { auto.value = m; definirAutoBloqueio(m) }
const DESTINO = { arquivo: 'baixado no aparelho', compartilhado: 'enviado para outro app' }
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
function demo() { apagarAcesso(); comecar(true); confirma.value = ''; irPara('hoje'); avisar('Dados fictícios carregados') }
function zerar() { apagarAcesso(); apagarTudo(); confirma.value = '' }
</script>

<template>
  <header class="cabeca"><div><small>Versão de teste 0.3</small><h1>Ajustes</h1></div></header>

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

  <section v-if="estado.demo" class="grupo">
    <span class="rotulo">Acesso e backup</span>
    <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Com dados fictícios não há senha nem backup. Para usar de verdade, toque em "Apagar tudo e começar do zero" e crie o seu acesso.</span></div>
  </section>

  <section v-if="!estado.demo" class="grupo">
    <span class="rotulo">Acesso e segurança</span>
    <div class="cartao lista-linhas">
      <button type="button" class="linha-escolha" @click="abrir('seguranca', { modo: 'apelido' })">Apelido<b>{{ acesso.apelido || 'Sem apelido' }}</b><Icone nome="direita" :tam="18" /></button>
      <button type="button" class="linha-escolha" @click="abrir('seguranca', { modo: 'senha' })">Trocar {{ acesso.pin ? 'PIN ou senha' : 'senha ou PIN' }}<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
      <button type="button" class="linha-escolha" @click="abrir('seguranca', { modo: 'chave' })">Chave de recuperação<b :style="{ color: acesso.recPendente ? 'var(--apoio)' : 'var(--primaria)' }">{{ acesso.recPendente ? 'Falta guardar' : 'Guardada' }}</b><Icone nome="direita" :tam="18" /></button>
    </div>
    <span class="nota" style="font-weight:700">Bloquear sozinho depois de ficar fora do app por</span>
    <div class="segmento" role="radiogroup" aria-label="Bloqueio automático">
      <button v-for="o in [[1, '1 min'], [5, '5 min'], [15, '15 min'], [0, 'Nunca']]" :key="o[0]" type="button" role="radio" :aria-checked="auto === o[0]" @click="mudarAuto(o[0])">{{ o[1] }}</button>
    </div>
    <button type="button" class="botao neutro" @click="bloquear()"><Icone nome="cadeado" :tam="18" />Bloquear agora</button>
  </section>

  <section v-if="!estado.demo" class="grupo">
    <span class="rotulo">Backup</span>
    <div class="cartao lista-linhas">
      <div class="linha-escolha">Último backup<b :style="{ color: ultimoBackup === 'Nunca' ? 'var(--apoio)' : 'var(--primaria)' }">{{ ultimoBackup }}{{ estado.backup.ultimoDestino && DESTINO[estado.backup.ultimoDestino] ? ` · ${DESTINO[estado.backup.ultimoDestino]}` : '' }}</b></div>
      <label class="linha-escolha">
        <span style="flex:1">Lembrar de fazer backup</span>
        <select v-model="estado.backup.intervalo" class="escolha" aria-label="Lembrar de fazer backup">
          <option v-for="i in INTERVALOS" :key="i.id" :value="i.id">{{ i.rotulo }}</option>
        </select>
      </label>
    </div>
    <div class="linha-botoes">
      <button type="button" class="botao cheio cresce" @click="abrir('backup', { modo: 'fazer' })">Fazer backup</button>
      <button type="button" class="botao contorno cresce" @click="abrir('backup', { modo: 'restaurar' })">Restaurar</button>
    </div>
    <p class="nota">O backup é um arquivo trancado. Ele abre com a sua senha de acesso ou com a chave de recuperação. Google Drive chega na próxima etapa.</p>
  </section>

  <section class="grupo">
    <span class="rotulo">Dados deste aparelho</span>
    <div class="cartao lista-linhas">
      <button type="button" class="linha-escolha" @click="confirma = 'demo'">Trocar tudo por dados fictícios<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
      <button type="button" class="linha-escolha" style="color:var(--atrasado)" @click="confirma = 'zerar'">Apagar tudo e começar do zero<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
    </div>
    <div v-if="confirma" class="cartao confirma">
      <p><strong>{{ confirma === 'demo' ? 'Trocar por dados fictícios?' : 'Apagar tudo?' }}</strong> O que está cadastrado neste aparelho será apagado, junto com a senha e a chave de recuperação. Se quiser guardar, faça um backup antes.</p>
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
.escolha { border: 0; background: transparent; font-weight: 800; color: var(--primaria); text-align: right; max-width: 55%; }
.chave { width: 22px; height: 22px; accent-color: var(--primaria); flex-shrink: 0; }
.confirma { padding: 14px; display: flex; flex-direction: column; gap: 12px; font-size: 14px; }
</style>
