<script setup>
// Backup em arquivo, trancado pela chave mestra do aparelho (mesma lógica do Dagda Capital).
// Abre com a senha de acesso da época ou com a chave de recuperação. Não existe senha separada do backup.
import { ref, computed, onMounted } from 'vue'
import { estado, paraBackup, backupFeito, restaurar, temDados } from '../nucleo/dados.js'
import { empacotar, abrirBackup, nomeDoArquivo } from '../nucleo/backup.js'
import { acesso, adotarMestra, criarSenha, aplicarRecAdotado, gerarNovoCodigo, validarNovaSenha } from '../nucleo/acesso.js'
import { ui, irPara, avisar } from '../nucleo/ui.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'

const props = defineProps({ modo: { type: String, default: 'fazer' } })
const erro = ref('')
const ocupado = ref(false)
const mostra = ref(false)

// --- fazer ---
const arquivo = ref(null)
const guardado = ref(false)
const podeEnviar = computed(() => !!arquivo.value && !!navigator.canShare?.({ files: [arquivo.value] }))
onMounted(async () => {
  if (props.modo !== 'fazer') return
  ocupado.value = true
  try { arquivo.value = new File([await empacotar(paraBackup(acesso.apelido))], nomeDoArquivo(), { type: 'text/plain' }) }
  catch (e) { erro.value = e.message || 'Não deu para criar o backup neste navegador.' }
  ocupado.value = false
})
function concluir(destino) { guardado.value = true; backupFeito(destino) }
function baixar() {
  const url = URL.createObjectURL(arquivo.value)
  const a = Object.assign(document.createElement('a'), { href: url, download: arquivo.value.name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
  concluir('arquivo')
}
async function enviar() {
  try { await navigator.share({ files: [arquivo.value], title: 'Backup do Airmed' }); concluir('compartilhado') }
  catch (e) { if (e?.name !== 'AbortError') erro.value = 'Não deu para enviar. Use "Baixar no aparelho".' }
}

// --- restaurar ---
const textoArquivo = ref('')
const nomeArquivo = ref('')
const segredo = ref('')
const aberto = ref(null) // { dados, criadoEm, mestra, rec, pelaChave }
const passo = ref('abrir') // abrir | resumo | senha
const nova = ref('')
const repete = ref('')
async function escolher(e) {
  const f = e.target.files?.[0]
  erro.value = ''; aberto.value = null
  if (!f) return
  if (f.size > 20 * 1024 * 1024) { erro.value = 'Arquivo grande demais para ser um backup do Airmed.'; return }
  nomeArquivo.value = f.name
  textoArquivo.value = await f.text()
}
async function abrir() {
  erro.value = ''
  if (!textoArquivo.value) { erro.value = 'Escolha o arquivo do backup.'; return }
  ocupado.value = true
  try { aberto.value = await abrirBackup(textoArquivo.value, segredo.value.trim()); passo.value = 'resumo' }
  catch (e) { erro.value = e.message || 'Não deu para abrir este backup.' }
  ocupado.value = false
}
const resumo = computed(() => {
  if (!aberto.value) return null
  const d = aberto.value.dados
  const quando = new Date(aberto.value.criadoEm)
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
  return {
    quando: `${quando.toLocaleDateString('pt-BR')} às ${quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    itens: [plural(d.remedios.length, 'remédio', 'remédios'), plural(d.rotinas.length, 'rotina', 'rotinas'), plural(d.registros.length, 'registro', 'registros')].join(' · '),
    apelido: d.perfil?.apelido || '',
  }
})
// Aparelho sem acesso: precisa nascer um. Se o backup abriu com a senha, ela vira a senha deste aparelho.
const precisaSenhaNova = computed(() => !acesso.configurada && (aberto.value?.pelaChave || !!validarNovaSenha(segredo.value)))
async function aplicar() {
  erro.value = ''
  const r = aberto.value
  if (acesso.configurada) { restaurar(r.dados, r.criadoEm); return terminar() }
  if (precisaSenhaNova.value && passo.value !== 'senha') { passo.value = 'senha'; return }
  const senha = precisaSenhaNova.value ? nova.value : segredo.value
  if (precisaSenhaNova.value) {
    const e = validarNovaSenha(nova.value)
    if (e) { erro.value = e; return }
    if (nova.value !== repete.value) { erro.value = 'As duas senhas não são iguais.'; return }
  }
  ocupado.value = true
  try {
    if (r.mestra) adotarMestra(r.mestra, r.rec)
    await criarSenha(senha, r.dados.perfil?.apelido || '')
    aplicarRecAdotado()
    restaurar(r.dados, r.criadoEm)
    if (acesso.recPendente) ui.codigoNovo = await gerarNovoCodigo()
    terminar()
  } catch (e) { erro.value = e.message || 'Não deu para restaurar.' }
  ocupado.value = false
}
function terminar() { ui.janelas = []; irPara('hoje'); avisar('Backup restaurado') }
</script>

<template>
  <Janela :titulo="modo === 'fazer' ? 'Fazer backup' : 'Restaurar backup'" :sair="arquivo || aberto ? 'Fechar' : 'Cancelar'">
    <!-- FAZER -->
    <template v-if="modo === 'fazer'">
      <p v-if="ocupado" class="texto apoio">Trancando o backup…</p>
      <template v-else-if="arquivo">
        <div class="pronto">
          <span class="selo feito grande"><Icone nome="feito" :tam="26" :traco="2.6" /></span>
          <strong>{{ guardado ? 'Backup guardado' : 'Backup pronto' }}</strong>
          <span class="apoio num">{{ arquivo.name }}</span>
        </div>
        <p class="texto">{{ guardado ? 'Confira se o arquivo chegou onde você queria. Pode guardar em mais de um lugar.' : 'Agora escolha onde guardar o arquivo. Sem guardar, o backup não existe.' }}</p>
        <button v-if="podeEnviar" type="button" class="botao cheio grande" @click="enviar">Guardar no Drive, arquivos ou outro app</button>
        <button type="button" class="botao grande" :class="podeEnviar ? 'contorno' : 'cheio'" @click="baixar">Baixar no aparelho</button>
        <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>O arquivo abre com a sua senha de acesso de hoje ou com a chave de recuperação. Guarde fora deste aparelho.</span></div>
      </template>
    </template>

    <!-- RESTAURAR -->
    <template v-else-if="passo === 'abrir'">
      <p class="texto">Escolha o arquivo do backup e digite a senha de acesso da época em que ele foi feito, ou a chave de recuperação.</p>
      <div class="campo">
        <span class="titulo">Arquivo do backup</span>
        <label class="botao tracejado arquivo">
          <Icone nome="mais" :tam="18" :traco="2" />{{ nomeArquivo || 'Escolher arquivo' }}
          <input type="file" accept=".txt,.json,text/plain,application/json" class="so-leitor" @change="escolher">
        </label>
      </div>
      <div class="campo">
        <label for="bk-abre">Senha do backup ou chave de recuperação</label>
        <div class="entrada"><input id="bk-abre" v-model="segredo" :type="mostra ? 'text' : 'password'" autocomplete="off" @keyup.enter="abrir"></div>
      </div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar</label>
    </template>

    <template v-else-if="passo === 'resumo'">
      <div class="cartao resumo">
        <span class="rotulo" style="padding:0">Backup aberto{{ resumo.apelido ? ` · ${resumo.apelido}` : '' }}</span>
        <strong class="num">{{ resumo.itens }}</strong>
        <span class="apoio num">Feito em {{ resumo.quando }}</span>
      </div>
      <div v-if="estado.iniciado && temDados()" class="faixa atencao solta"><Icone nome="atencao" :tam="16" :traco="1.8" /><span>Tudo que está neste aparelho agora será trocado pelo conteúdo do backup. Não dá para desfazer.</span></div>
      <p v-else class="texto">O Airmed deste aparelho vai ficar igual ao do backup{{ acesso.configurada ? '' : (precisaSenhaNova ? '. No próximo passo você cria a senha deste aparelho' : ', com a mesma senha de acesso') }}.</p>
    </template>

    <template v-else>
      <p class="texto">Crie a senha ou o PIN deste aparelho. A chave de recuperação continua a mesma.</p>
      <div class="campo"><label for="bk-nova">Senha ou PIN</label><div class="entrada"><input id="bk-nova" v-model="nova" :type="mostra ? 'text' : 'password'" autocomplete="new-password"></div></div>
      <div class="campo"><label for="bk-nova2">Repita</label><div class="entrada"><input id="bk-nova2" v-model="repete" :type="mostra ? 'text' : 'password'" autocomplete="new-password" @keyup.enter="aplicar"></div></div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar</label>
    </template>

    <template #pe>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button v-if="modo === 'fazer'" type="button" class="botao grande" :class="guardado ? 'cheio' : 'suave'" @click="ui.janelas.pop()">{{ guardado ? 'Pronto' : (arquivo ? 'Fechar sem guardar' : 'Fechar') }}</button>
        <button v-else-if="passo === 'abrir'" type="button" class="botao cheio grande" :disabled="ocupado" @click="abrir">{{ ocupado ? 'Abrindo…' : 'Abrir backup' }}</button>
        <button v-else type="button" class="botao cheio grande" :disabled="ocupado" @click="aplicar">{{ ocupado ? 'Restaurando…' : (passo === 'resumo' && precisaSenhaNova ? 'Continuar' : 'Restaurar neste aparelho') }}</button>
      </div>
    </template>
  </Janela>
</template>

<style scoped>
.texto { font-size: 15px; line-height: 21px; }
.mostrar { display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: 14px; font-weight: 600; color: var(--apoio); }
.mostrar input { width: 20px; height: 20px; accent-color: var(--primaria); }
.pronto { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 0; text-align: center; }
.pronto strong { font-size: 20px; font-weight: 800; }
.pronto span:last-child { font-size: 13px; font-weight: 600; }
.selo.grande { width: 52px; height: 52px; border-radius: 26px; }
.arquivo { cursor: pointer; overflow-wrap: anywhere; padding: 8px 14px; }
.arquivo:focus-within { outline: 2px solid var(--primaria); outline-offset: 2px; }
.resumo { padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.resumo strong { font-size: 17px; font-weight: 800; }
.resumo span:last-child { font-size: 13px; font-weight: 600; }
</style>
