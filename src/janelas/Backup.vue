<script setup>
// Backup em arquivo criptografado. A senha só existe na cabeça (e no cofre) da pessoa.
import { ref, computed } from 'vue'
import { estado, paraBackup, backupFeito, restaurar, temDados } from '../nucleo/dados.js'
import { cifrar, decifrar, nomeDoArquivo, SENHA_MINIMA } from '../nucleo/backup.js'
import { ui, irPara, avisar } from '../nucleo/ui.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'

const props = defineProps({ modo: { type: String, default: 'fazer' } })
const senha = ref('')
const repete = ref('')
const mostra = ref(false)
const erro = ref('')
const ocupado = ref(false)

// --- fazer ---
const arquivo = ref(null) // File pronto para guardar
const guardado = ref(false)
const podeEnviar = computed(() => !!arquivo.value && !!navigator.canShare?.({ files: [arquivo.value] }))
async function criar() {
  erro.value = ''
  if (senha.value.length < SENHA_MINIMA) { erro.value = `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`; return }
  if (senha.value !== repete.value) { erro.value = 'As duas senhas não são iguais.'; return }
  ocupado.value = true
  try {
    const texto = await cifrar(paraBackup(), senha.value)
    arquivo.value = new File([texto], nomeDoArquivo(), { type: 'text/plain' })
    senha.value = ''; repete.value = ''
  } catch { erro.value = 'Não deu para criar o backup neste navegador.' }
  ocupado.value = false
}
function concluir() { guardado.value = true; backupFeito() }
function baixar() {
  const url = URL.createObjectURL(arquivo.value)
  const a = Object.assign(document.createElement('a'), { href: url, download: arquivo.value.name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  concluir()
}
async function enviar() {
  try {
    await navigator.share({ files: [arquivo.value], title: 'Backup do Airmed' })
    concluir()
  } catch (e) { if (e?.name !== 'AbortError') erro.value = 'Não deu para enviar. Use "Baixar no aparelho".' }
}

// --- restaurar ---
const textoArquivo = ref('')
const nomeArquivo = ref('')
const aberto = ref(null) // { dados, criadoEm }
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
  try { aberto.value = await decifrar(textoArquivo.value, senha.value) } catch (e) { erro.value = e.message || 'Não deu para abrir este backup.' }
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
  }
})
function aplicar() {
  restaurar(aberto.value.dados, aberto.value.criadoEm)
  ui.janelas = []
  irPara('hoje')
  avisar('Backup restaurado')
}
</script>

<template>
  <Janela :titulo="modo === 'fazer' ? 'Fazer backup' : 'Restaurar backup'" :sair="arquivo || aberto ? 'Fechar' : 'Cancelar'">
    <!-- FAZER -->
    <template v-if="modo === 'fazer' && !arquivo">
      <p class="texto">O backup é um arquivo com tudo que está no Airmed deste aparelho, trancado com uma senha que só você sabe.</p>
      <div class="campo">
        <label for="bk-senha">Senha do backup</label>
        <div class="entrada"><input id="bk-senha" v-model="senha" :type="mostra ? 'text' : 'password'" autocomplete="new-password" :minlength="SENHA_MINIMA"></div>
      </div>
      <div class="campo">
        <label for="bk-repete">Repita a senha</label>
        <div class="entrada"><input id="bk-repete" v-model="repete" :type="mostra ? 'text' : 'password'" autocomplete="new-password" @keyup.enter="criar"></div>
      </div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar a senha</label>
      <div class="faixa atencao solta"><Icone nome="atencao" :tam="16" :traco="1.8" /><span>Guarde esta senha num cofre de senhas. Sem ela, ninguém abre o backup, nem você. Não existe "esqueci a senha".</span></div>
    </template>

    <template v-else-if="modo === 'fazer'">
      <div class="pronto">
        <span class="selo feito grande"><Icone nome="feito" :tam="26" :traco="2.6" /></span>
        <strong>{{ guardado ? 'Backup guardado' : 'Backup pronto' }}</strong>
        <span class="apoio num">{{ arquivo.name }}</span>
      </div>
      <p class="texto">{{ guardado ? 'Confira se o arquivo chegou onde você queria. Pode guardar em mais de um lugar.' : 'Agora escolha onde guardar o arquivo. Sem guardar, o backup não existe.' }}</p>
      <button v-if="podeEnviar" type="button" class="botao cheio grande" @click="enviar">Guardar no Drive, arquivos ou outro app</button>
      <button type="button" class="botao grande" :class="podeEnviar ? 'contorno' : 'cheio'" @click="baixar">Baixar no aparelho</button>
      <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Guarde fora deste aparelho (Google Drive, OneDrive, pen drive). Quem pegar o arquivo sem a senha não consegue ler nada.</span></div>
    </template>

    <!-- RESTAURAR -->
    <template v-else-if="!aberto">
      <p class="texto">Escolha o arquivo do backup e digite a senha que você criou para ele.</p>
      <div class="campo">
        <span class="titulo">Arquivo do backup</span>
        <label class="botao tracejado arquivo">
          <Icone nome="mais" :tam="18" :traco="2" />{{ nomeArquivo || 'Escolher arquivo' }}
          <input type="file" accept=".txt,.json,text/plain,application/json" class="so-leitor" @change="escolher">
        </label>
      </div>
      <div class="campo">
        <label for="bk-abre">Senha do backup</label>
        <div class="entrada"><input id="bk-abre" v-model="senha" :type="mostra ? 'text' : 'password'" autocomplete="current-password" @keyup.enter="abrir"></div>
      </div>
      <label class="mostrar"><input v-model="mostra" type="checkbox"> Mostrar a senha</label>
    </template>

    <template v-else>
      <div class="cartao resumo">
        <span class="rotulo" style="padding:0">Backup aberto</span>
        <strong class="num">{{ resumo.itens }}</strong>
        <span class="apoio num">Feito em {{ resumo.quando }}</span>
      </div>
      <div v-if="estado.iniciado && temDados()" class="faixa atencao solta"><Icone nome="atencao" :tam="16" :traco="1.8" /><span>Tudo que está neste aparelho agora será trocado pelo conteúdo do backup. Não dá para desfazer.</span></div>
      <p v-else class="texto">O Airmed deste aparelho vai ficar igual ao do backup.</p>
    </template>

    <template #pe>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button v-if="modo === 'fazer' && !arquivo" type="button" class="botao cheio grande" :disabled="ocupado" @click="criar">{{ ocupado ? 'Trancando…' : 'Criar backup' }}</button>
        <button v-else-if="modo === 'fazer'" type="button" class="botao grande" :class="guardado ? 'cheio' : 'suave'" @click="ui.janelas.pop()">{{ guardado ? 'Pronto' : 'Fechar sem guardar' }}</button>
        <button v-else-if="!aberto" type="button" class="botao cheio grande" :disabled="ocupado" @click="abrir">{{ ocupado ? 'Abrindo…' : 'Abrir backup' }}</button>
        <button v-else type="button" class="botao cheio grande" @click="aplicar">Restaurar neste aparelho</button>
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
