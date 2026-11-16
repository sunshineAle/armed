<script setup>
// Mostra o código de recuperação: anotar, copiar, baixar ou imprimir e confirmar que foi guardado.
import { ref } from 'vue'
import Icone from './Icone.vue'

const props = defineProps({ codigo: { type: String, required: true }, rotuloContinuar: { type: String, default: 'Continuar' }, somenteVer: Boolean })
const emit = defineEmits(['guardado'])
const confirmou = ref(false)
const copiado = ref(false)
const texto = () => `Airmed — código de recuperação\n\n${props.codigo}\n\nEste código substitui a senha: abre o app e os backups e permite criar uma senha nova.\nSem a senha e sem este código, ninguém consegue recuperar os dados.\nGerado em ${new Date().toLocaleString('pt-BR')}.\n`
async function copiar() {
  try { await navigator.clipboard.writeText(props.codigo); copiado.value = true; setTimeout(() => { copiado.value = false }, 2000) } catch { /* sem área de transferência */ }
}
function baixar() {
  const url = URL.createObjectURL(new Blob([texto()], { type: 'text/plain;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'airmed-codigo-de-recuperacao.txt' })
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 20000)
}
function imprimir() {
  const w = window.open('', '_blank', 'width=520,height=420')
  if (!w) return
  w.document.write(`<pre style="font:16px/1.6 ui-monospace,monospace;padding:24px;white-space:pre-wrap">${texto().replace(/</g, '&lt;')}</pre>`)
  w.document.close(); w.focus(); w.print()
}
</script>

<template>
  <div class="cod">
    <p class="explica">Anote este <b>código de recuperação</b>. Ele substitui a senha: abre o app e os backups e permite criar uma senha nova.</p>
    <output class="cartao codigo num" :aria-label="'Código de recuperação: ' + codigo"><span v-for="(g, i) in codigo.split('-')" :key="i">{{ g }}</span></output>
    <div class="acoes">
      <button type="button" class="botao contorno" @click="copiar">{{ copiado ? 'Copiado' : 'Copiar' }}</button>
      <button type="button" class="botao contorno" @click="baixar">Baixar</button>
      <button type="button" class="botao contorno" @click="imprimir">Imprimir</button>
    </div>
    <div class="faixa atencao solta"><Icone nome="atencao" :tam="16" :traco="1.8" /><span>Sem a senha e sem a chave de recuperação, ninguém consegue recuperar os dados.</span></div>
    <template v-if="!somenteVer">
      <label class="confirma"><input v-model="confirmou" type="checkbox"> Guardei a chave em local seguro</label>
      <button type="button" class="botao cheio grande" :disabled="!confirmou" @click="emit('guardado')">{{ rotuloContinuar }}</button>
    </template>
  </div>
</template>

<style scoped>
.cod { display: flex; flex-direction: column; gap: 14px; }
.explica { font-size: 15px; line-height: 21px; }
.codigo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 8px; padding: 18px 14px; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; user-select: all; }
.acoes { display: flex; gap: 8px; }
.acoes .botao { flex: 1; min-height: 44px; padding: 0 8px; font-size: 14px; }
.confirma { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; font-weight: 700; }
.confirma input { width: 22px; height: 22px; accent-color: var(--primaria); flex-shrink: 0; }
</style>
