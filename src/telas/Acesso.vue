<script setup>
// Tela de acesso (mesma lógica do Dagda Capital): criar apelido e senha ou PIN, entrar, e "esqueci a senha".
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  acesso, criarSenha, verificarSenha, validarNovaSenha, validarApelido, gerarNovoCodigo,
  entrarComCodigo, redefinirSenhaComCodigo, esperaAteTentar,
} from '../nucleo/acesso.js'
import { estado, temDados } from '../nucleo/dados.js'
import { ui } from '../nucleo/ui.js'
import Icone from '../componentes/Icone.vue'

const passo = ref(acesso.configurada ? 'entrar' : 'criar') // criar | entrar | esqueci | nova
const apelido = ref('')
const senha = ref('')
const repete = ref('')
const codigo = ref('')
const mostra = ref(false)
const erro = ref('')
const ocupado = ref(false)
const espera = ref(esperaAteTentar())
const relogio = setInterval(() => { espera.value = esperaAteTentar() }, 1000)
onBeforeUnmount(() => clearInterval(relogio))
const campo = ref(null)
onMounted(() => campo.value?.focus())
const tipo = computed(() => (mostra.value ? 'text' : 'password'))
const limpar = () => { senha.value = ''; repete.value = ''; erro.value = '' }
const ir = (p) => { passo.value = p; limpar() }

async function fazer(acao) {
  erro.value = ''; ocupado.value = true
  try { await acao() } catch (e) { erro.value = e.message || 'Não deu certo. Tente de novo.' }
  ocupado.value = false
}
const novaSenhaOk = () => {
  const e = validarNovaSenha(senha.value)
  if (e) throw new Error(e)
  if (senha.value !== repete.value) throw new Error('As duas senhas não são iguais.')
}
const criar = () => fazer(async () => {
  const e = validarApelido(apelido.value)
  if (e) throw new Error(e)
  novaSenhaOk()
  await criarSenha(senha.value, apelido.value)
  if (!estado.backup.desde) estado.backup.desde = new Date().toISOString()
  ui.codigoNovo = await gerarNovoCodigo()
})
const entrar = () => fazer(async () => {
  if (!(await verificarSenha(senha.value))) { espera.value = esperaAteTentar(); throw new Error(acesso.pin ? 'PIN incorreto.' : 'Senha incorreta.') }
})
const usarChave = () => fazer(async () => { await entrarComCodigo(codigo.value); ir('nova') })
const redefinir = () => fazer(async () => { novaSenhaOk(); await redefinirSenhaComCodigo(senha.value) })
</script>

<template>
  <main class="acesso">
    <div class="marca"><Icone nome="marca" :tam="40" :traco="1.6" /></div>

    <form v-if="passo === 'criar'" class="bloco" @submit.prevent="criar">
      <h1>Crie seu acesso</h1>
      <p class="apoio">{{ temDados() ? 'O que você já cadastrou continua aqui. Falta só proteger a entrada.' : 'Só um apelido e uma senha ou PIN. Fica tudo neste aparelho: sem e-mail e sem servidor.' }}</p>
      <div class="campo"><label for="ac-apelido">Como quer ser chamado</label><div class="entrada"><input id="ac-apelido" ref="campo" v-model="apelido" maxlength="30" autocomplete="nickname"></div></div>
      <div class="campo"><label for="ac-senha">Senha ou PIN</label><div class="entrada"><input id="ac-senha" v-model="senha" :type="tipo" autocomplete="new-password"></div></div>
      <div class="campo"><label for="ac-repete">Repita</label><div class="entrada"><input id="ac-repete" v-model="repete" :type="tipo" autocomplete="new-password"></div></div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar</label>
      <p class="nota">Senha com 6 caracteres ou mais, ou PIN de 4 a 12 números. O PIN é mais prático; a senha longa protege melhor os backups.</p>
      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
      <button type="submit" class="botao cheio grande" :disabled="ocupado">{{ ocupado ? 'Criando…' : 'Criar acesso' }}</button>
    </form>

    <form v-else-if="passo === 'entrar'" class="bloco" @submit.prevent="entrar">
      <h1>Bem-vindo de volta{{ acesso.apelido ? `, ${acesso.apelido}` : '' }}</h1>
      <div class="campo"><label for="ac-entra">{{ acesso.pin ? 'PIN' : 'Senha' }}</label><div class="entrada"><input id="ac-entra" ref="campo" v-model="senha" :type="tipo" :inputmode="acesso.pin ? 'numeric' : 'text'" autocomplete="current-password"></div></div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar</label>
      <p v-if="espera" class="erro" role="alert">Muitas tentativas. Aguarde {{ espera }}s.</p>
      <p v-else-if="erro" class="erro" role="alert">{{ erro }}</p>
      <button type="submit" class="botao cheio grande" :disabled="ocupado || espera > 0">{{ ocupado ? 'Entrando…' : 'Entrar' }}</button>
      <button type="button" class="link" @click="ir('esqueci')">Esqueci a senha</button>
    </form>

    <form v-else-if="passo === 'esqueci'" class="bloco" @submit.prevent="usarChave">
      <h1>Esqueci a senha</h1>
      <p class="apoio">Digite a chave de recuperação de 24 caracteres que você guardou quando criou o acesso.</p>
      <div class="campo"><label for="ac-chave">Chave de recuperação</label><div class="entrada"><input id="ac-chave" v-model="codigo" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD-EFGH-…" class="num"></div></div>
      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
      <button type="submit" class="botao cheio grande" :disabled="ocupado">Continuar</button>
      <button type="button" class="link" @click="ir('entrar')">Voltar</button>
      <p class="nota">Sem a senha e sem a chave, não há como abrir os dados deste aparelho. Se você tiver um backup e a chave dele, apague tudo em Ajustes e restaure.</p>
    </form>

    <form v-else class="bloco" @submit.prevent="redefinir">
      <h1>Crie uma senha nova</h1>
      <p class="apoio">A chave conferiu. Seus dados e seus backups continuam os mesmos.</p>
      <div class="campo"><label for="ac-nova">Senha ou PIN</label><div class="entrada"><input id="ac-nova" v-model="senha" :type="tipo" autocomplete="new-password"></div></div>
      <div class="campo"><label for="ac-nova2">Repita</label><div class="entrada"><input id="ac-nova2" v-model="repete" :type="tipo" autocomplete="new-password"></div></div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar</label>
      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
      <button type="submit" class="botao cheio grande" :disabled="ocupado">Salvar e entrar</button>
    </form>
  </main>
</template>

<style scoped>
.acesso { min-height: 100dvh; max-width: 420px; margin: 0 auto; padding: 32px 24px; display: flex; flex-direction: column; justify-content: center; gap: 20px; }
.marca { width: 72px; height: 72px; border-radius: 24px; background: var(--primaria); color: var(--sobre-primaria); display: flex; align-items: center; justify-content: center; }
.bloco { display: flex; flex-direction: column; gap: 14px; }
h1 { font-size: 26px; line-height: 32px; font-weight: 800; letter-spacing: -0.3px; }
.mostrar { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--apoio); }
.mostrar input { width: 20px; height: 20px; accent-color: var(--primaria); }
.link { min-height: 44px; text-align: center; font-weight: 700; color: var(--primaria); }
</style>
