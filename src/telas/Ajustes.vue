<script setup>
// Ajustes (provisório: a tela definitiva ainda vai ser desenhada).
import { ref, onMounted } from 'vue'
import { computed } from 'vue'
import { estado, apagarTudo, hoje, agoraMin, relogio } from '../nucleo/dados.js'
import { diasSemBackup, INTERVALOS } from '../nucleo/backup.js'
import { nuvem, nuvemDisponivel, prepararNuvem, conectarNuvem, desconectarNuvem, esquecerNuvem } from '../nucleo/nuvem/index.js'
import { acesso, apagarAcesso, bloquear, minutosAutoBloqueio, definirAutoBloqueio, biometriaSuportada, ativarBiometria, desativarBiometria } from '../nucleo/acesso.js'
import { diaComSituacao } from '../nucleo/motor.js'
import { permissao, pedirPermissao, notificar } from '../nucleo/avisos.js'
import { ui, avisar, irPara, abrir } from '../nucleo/ui.js'
import { horaDe } from '../nucleo/tempo.js'
import { instalacao, instalarApp, ehApple } from '../nucleo/instalacao.js'
import Icone from '../componentes/Icone.vue'

const perm = ref(permissao())
const confirma = ref('')
const auto = ref(minutosAutoBloqueio())
const mudarAuto = (m) => { auto.value = m; definirAutoBloqueio(m) }
const DESTINO = { arquivo: 'baixado no aparelho', compartilhado: 'enviado para outro app', google: 'no Google Drive' }
const erroNuvem = ref('')
const bioOk = ref(false)
const erroBio = ref('')
onMounted(async () => { bioOk.value = await biometriaSuportada() })
async function alternarBio() {
  erroBio.value = ''
  try { acesso.biometria ? await desativarBiometria() : await ativarBiometria() } catch (e) { erroBio.value = e.message }
}
onMounted(() => { if (nuvemDisponivel() && nuvem.conectado) prepararNuvem() })
async function conectar() {
  erroNuvem.value = ''
  try { await conectarNuvem(); avisar('Google Drive conectado') } catch (e) { if (e.codigo !== 'cancelado') erroNuvem.value = e.message }
}
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
function zerar() { apagarAcesso(); esquecerNuvem(); apagarTudo(); confirma.value = ''; ui.janelas = []; ui.liberado = false }
</script>

<template>
  <header class="cabeca"><div><small>Versão de teste 0.7</small><h1>Ajustes</h1></div></header>

  <section v-if="!instalacao.instalado" class="grupo">
    <span class="rotulo">Instalar o app</span>
    <button type="button" class="botao cheio" @click="instalarApp()"><Icone nome="baixar" :tam="18" :traco="2" />{{ ehApple() ? 'Como instalar' : 'Instalar aplicativo' }}</button>
    <p class="nota">Instalado, o Airmed abre em tela cheia, com ícone próprio, e funciona sem internet.</p>
  </section>

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
        <span style="flex:1">Som e vibração do alarme</span>
        <input v-model="estado.prefs.som" type="checkbox" class="chave">
      </label>
      <label class="linha-escolha" style="cursor:pointer">
        <span style="flex:1">Mostrar o nome do remédio na notificação</span>
        <input v-model="estado.prefs.nomeNaNotificacao" type="checkbox" class="chave">
      </label>
    </div>
    <div class="linha-botoes">
      <button v-if="perm === 'default'" type="button" class="botao cheio cresce" @click="ligar">Ligar notificações</button>
      <button type="button" class="botao contorno cresce" @click="testarAlarme">Ver como é o alarme</button>
    </div>
    <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>O alarme toca e vibra com o Airmed aberto na tela. Com o app fechado ou o celular bloqueado, o navegador não deixa tocar: sai só a notificação, e só se o app ainda estiver aberto em segundo plano. O alarme de verdade, com o celular bloqueado, vem com o app Android.</span></div>
  </section>

  <section class="grupo">
    <span class="rotulo">Acesso e segurança</span>
    <div class="cartao lista-linhas">
      <button type="button" class="linha-escolha" @click="abrir('seguranca', { modo: 'apelido' })">Apelido<b>{{ acesso.apelido || 'Sem apelido' }}</b><Icone nome="direita" :tam="18" /></button>
      <button type="button" class="linha-escolha" @click="abrir('seguranca', { modo: 'senha' })">Trocar {{ acesso.pin ? 'PIN ou senha' : 'senha ou PIN' }}<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
      <button type="button" class="linha-escolha" @click="abrir('seguranca', { modo: 'chave' })">Código de recuperação<b :style="{ color: acesso.recPendente ? 'var(--apoio)' : 'var(--primaria)' }">{{ acesso.recPendente ? 'Falta guardar' : 'Guardado' }}</b><Icone nome="direita" :tam="18" /></button>
      <label v-if="bioOk" class="linha-escolha" style="cursor:pointer">
        <span style="flex:1">Desbloquear com biometria</span>
        <input type="checkbox" class="chave" :checked="acesso.biometria" @click.prevent="alternarBio">
      </label>
    </div>
    <p v-if="erroBio" class="erro" role="alert">{{ erroBio }}</p>
    <span class="nota" style="font-weight:700">Bloquear sozinho depois de ficar fora do app por</span>
    <div class="segmento" role="radiogroup" aria-label="Bloqueio automático">
      <button v-for="o in [[1, '1 min'], [5, '5 min'], [15, '15 min'], [0, 'Nunca']]" :key="o[0]" type="button" role="radio" :aria-checked="auto === o[0]" @click="mudarAuto(o[0])">{{ o[1] }}</button>
    </div>
    <button type="button" class="botao neutro" @click="bloquear()"><Icone nome="cadeado" :tam="18" />Bloquear agora</button>
  </section>

  <section class="grupo">
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
    <p class="nota">O backup é um arquivo trancado. Ele abre com a sua senha de acesso ou com o código de recuperação.</p>

    <template v-if="nuvemDisponivel()">
      <div class="cartao lista-linhas">
        <div class="linha-escolha">Google Drive<b :style="{ color: nuvem.conectado && !nuvem.precisaReconectar ? 'var(--primaria)' : 'var(--apoio)' }">{{ nuvem.conectado ? (nuvem.precisaReconectar ? 'Precisa reconectar' : 'Conectado') : 'Não conectado' }}</b></div>
        <button v-if="nuvem.conectado" type="button" class="linha-escolha" @click="abrir('copias')">Ver as cópias guardadas<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
      </div>
      <div class="linha-botoes">
        <button v-if="!nuvem.conectado || nuvem.precisaReconectar" type="button" class="botao contorno cresce" :disabled="nuvem.ocupado" @pointerdown="prepararNuvem()" @click="conectar">{{ nuvem.ocupado ? 'Conectando…' : (nuvem.conectado ? 'Reconectar' : 'Conectar o Google Drive') }}</button>
        <button v-if="nuvem.conectado" type="button" class="botao suave cresce" @click="desconectarNuvem()">Desconectar</button>
      </div>
      <p v-if="erroNuvem" class="erro" role="alert">{{ erroNuvem }}</p>
      <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>As cópias ficam numa área oculta do seu Drive, que só este app enxerga. Ficam até 4, e cada envio é baixado de volta e conferido. Por enquanto a conexão é a mesma do Dagda Capital, então a tela do Google mostra esse nome.</span></div>
    </template>
  </section>

  <section class="grupo">
    <span class="rotulo">Dados deste aparelho</span>
    <div class="cartao lista-linhas">
      <button type="button" class="linha-escolha" style="color:var(--atrasado)" @click="confirma = 'zerar'">Apagar tudo e começar do zero<Icone nome="direita" :tam="18" style="margin-left:auto" /></button>
    </div>
    <div v-if="confirma" class="cartao confirma">
      <p><strong>Apagar tudo?</strong> O que está cadastrado neste aparelho será apagado, junto com a senha, a biometria e o código de recuperação. Se quiser guardar, faça um backup antes.</p>
      <div class="linha-botoes">
        <button type="button" class="botao suave cresce" @click="confirma = ''">Manter</button>
        <button type="button" class="botao perigo cresce" @click="zerar()">Apagar</button>
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
