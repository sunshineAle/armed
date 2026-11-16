<script setup>
// Cópias guardadas na área oculta do Google Drive: ver e excluir (com a proteção da última cópia que abre).
import { ref, onMounted } from 'vue'
import { listarNuvem, excluirDaNuvem, nuvem } from '../nucleo/nuvem/index.js'
import { avisar } from '../nucleo/ui.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'

const itens = ref(null)
const erro = ref('')
const confirmar = ref(null)
const quando = (ms) => { const d = new Date(ms); return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` }
const tamanho = (b) => (b < 1024 ? `${b} B` : `${Math.round(b / 1024)} KB`)
async function carregar() {
  erro.value = ''
  try { itens.value = await listarNuvem() } catch (e) { erro.value = e.message; itens.value = itens.value || [] }
}
onMounted(carregar)
async function excluir(item) {
  erro.value = ''
  try { await excluirDaNuvem(item); confirmar.value = null; avisar('Cópia excluída'); await carregar() }
  catch (e) { erro.value = e.message; confirmar.value = null }
}
</script>

<template>
  <Janela titulo="Cópias no Google Drive" sair="Fechar">
    <p v-if="itens === null" class="apoio">Buscando as cópias…</p>
    <p v-else-if="!itens.length && !erro" class="apoio">Ainda não há cópias do Airmed no seu Google Drive.</p>
    <div v-else-if="itens.length" class="cartao lista-linhas">
      <div v-for="i in itens" :key="i.id" class="copia">
        <span class="copia-texto"><strong class="num">{{ quando(i.data) }}</strong><small class="apoio num">{{ tamanho(i.tamanho) }}</small></span>
        <template v-if="confirmar === i.id">
          <button type="button" class="botao suave pequeno" @click="confirmar = null">Manter</button>
          <button type="button" class="botao perigo pequeno" :disabled="nuvem.ocupado" @click="excluir(i)">{{ nuvem.ocupado ? 'Conferindo…' : 'Excluir' }}</button>
        </template>
        <button v-else type="button" class="lixo" :aria-label="`Excluir a cópia de ${quando(i.data)}`" @click="confirmar = i.id"><Icone nome="lixeira" :tam="20" /></button>
      </div>
    </div>
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Ficam até 4 cópias. Antes de excluir, o Airmed abre outra cópia para ter certeza de que ela funciona. A última cópia que abre nunca é apagada por aqui.</span></div>
  </Janela>
</template>

<style scoped>
.copia { display: flex; align-items: center; gap: 8px; min-height: 60px; padding: 8px 8px 8px 14px; }
.copia-texto { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.copia-texto strong { font-size: 15px; font-weight: 750; }
.copia-texto small { font-size: 12px; font-weight: 600; }
.lixo { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; color: var(--apoio); }
.pequeno { min-height: 40px; padding: 0 12px; font-size: 14px; }
</style>
