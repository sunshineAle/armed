<script setup>
// Segurança: trocar senha ou PIN, ver ou gerar a chave de recuperação, trocar o apelido.
import { ref } from 'vue'
import { acesso, alterarSenha, validarNovaSenha, verCodigoAtual, gerarNovoCodigo, confirmarCodigoGuardado, conferirSenha, definirApelido, temCodigoVisivel } from '../nucleo/acesso.js'
import { fechar, avisar } from '../nucleo/ui.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'
import CodigoRecuperacao from '../componentes/CodigoRecuperacao.vue'

const props = defineProps({ modo: { type: String, default: 'senha' } })
const TITULO = { senha: acesso.pin ? 'Trocar PIN ou senha' : 'Trocar senha ou PIN', chave: 'Código de recuperação', apelido: 'Apelido' }
const atual = ref('')
const nova = ref('')
const repete = ref('')
const apelido = ref(acesso.apelido)
const codigo = ref('')
const ehNova = ref(false)
const mostra = ref(false)
const erro = ref('')
const ocupado = ref(false)

async function fazer(acao) {
  erro.value = ''; ocupado.value = true
  try { await acao() } catch (e) { erro.value = e.message || 'Não deu certo. Tente de novo.' }
  ocupado.value = false
}
const trocar = () => fazer(async () => {
  const e = validarNovaSenha(nova.value)
  if (e) throw new Error(e)
  if (nova.value !== repete.value) throw new Error('As duas senhas não são iguais.')
  await alterarSenha(atual.value, nova.value)
  fechar(); avisar('Senha trocada. Os backups antigos continuam abrindo com a senha da época ou com o código.')
})
const ver = () => fazer(async () => { codigo.value = await verCodigoAtual(atual.value); ehNova.value = false })
const gerar = () => fazer(async () => {
  if (!(await conferirSenha(atual.value))) throw new Error(acesso.pin ? 'PIN incorreto.' : 'Senha incorreta.')
  codigo.value = await gerarNovoCodigo(); ehNova.value = true
})
function guardei() { confirmarCodigoGuardado(); fechar(); avisar('Código de recuperação guardado') }
async function copiar() { try { await navigator.clipboard.writeText(codigo.value); avisar('Chave copiada') } catch { avisar('Não deu para copiar. Anote a chave à mão.') } }
const salvarApelido = () => fazer(async () => { definirApelido(apelido.value); fechar(); avisar('Apelido atualizado') })
</script>

<template>
  <Janela :titulo="TITULO[modo]" sair="Fechar">
    <template v-if="modo === 'senha'">
      <div class="campo"><label for="sg-atual">{{ acesso.pin ? 'PIN atual' : 'Senha atual' }}</label><div class="entrada"><input id="sg-atual" v-model="atual" :type="mostra ? 'text' : 'password'" autocomplete="current-password"></div></div>
      <div class="campo"><label for="sg-nova">Nova senha ou PIN</label><div class="entrada"><input id="sg-nova" v-model="nova" :type="mostra ? 'text' : 'password'" autocomplete="new-password"></div></div>
      <div class="campo"><label for="sg-rep">Repita</label><div class="entrada"><input id="sg-rep" v-model="repete" :type="mostra ? 'text' : 'password'" autocomplete="new-password" @keyup.enter="trocar"></div></div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar</label>
      <p class="nota">Trocar a senha não estraga os backups já feitos: eles continuam abrindo com a senha da época ou com o código de recuperação.</p>
    </template>

    <template v-else-if="modo === 'chave' && !codigo">
      <p class="texto">O código de recuperação abre o app e os backups se você esquecer a senha. Para ver ou trocar o código, confirme quem é você.</p>
      <div v-if="acesso.recPendente" class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Você ainda não confirmou que guardou o código.</span></div>
      <div class="campo"><label for="sg-conf">{{ acesso.pin ? 'PIN' : 'Senha' }}</label><div class="entrada"><input id="sg-conf" v-model="atual" :type="mostra ? 'text' : 'password'" autocomplete="current-password"></div></div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar</label>
    </template>

    <template v-else-if="modo === 'chave'">
      <p v-if="ehNova" class="texto">Este é o código novo. O anterior não abre os backups feitos daqui para frente.</p>
      <CodigoRecuperacao :codigo="codigo" rotulo-continuar="Guardei o código" @guardado="guardei" />
    </template>

    <template v-else>
      <div class="campo"><label for="sg-ap">Como quer ser chamado</label><div class="entrada"><input id="sg-ap" v-model="apelido" maxlength="30" @keyup.enter="salvarApelido"></div></div>
    </template>

    <template #pe>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button v-if="modo === 'senha'" type="button" class="botao cheio grande" :disabled="ocupado" @click="trocar">Trocar</button>
        <template v-else-if="modo === 'chave' && !codigo">
          <button v-if="temCodigoVisivel()" type="button" class="botao cheio grande" :disabled="ocupado" @click="ver">Ver o código atual</button>
          <button type="button" class="botao grande" :class="temCodigoVisivel() ? 'contorno' : 'cheio'" :disabled="ocupado" @click="gerar">Gerar um código novo</button>
        </template>
        <button v-else type="button" class="botao cheio grande" :disabled="ocupado" @click="salvarApelido">Salvar</button>
      </div>
    </template>
  </Janela>
</template>

<style scoped>
.texto { font-size: 15px; line-height: 21px; }
.mostrar { display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: 14px; font-weight: 600; color: var(--apoio); }
.mostrar input { width: 20px; height: 20px; accent-color: var(--primaria); }
.codigo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 8px; padding: 18px 14px; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; user-select: all; }
</style>
