<script setup>
// "Fazer backup agora?": confirmação curta com o destino do último backup.
import { ref, computed } from 'vue'
import { estado } from '../nucleo/dados.js'
import { fazerBackupEm, nomeDestino } from '../nucleo/backupRapido.js'
import { abrir, fechar, avisar } from '../nucleo/ui.js'
import Janela from '../componentes/Janela.vue'

const destino = estado.backup.ultimoDestino // o destino mostrado é o único autorizado por este toque
const nome = computed(() => nomeDestino(destino))
const fazendo = ref(false)
const erro = ref('')
async function fazer() {
  if (fazendo.value) return
  erro.value = ''
  if (estado.backup.ultimoDestino !== destino) { erro.value = 'O destino mudou. Feche e confirme novamente.'; return }
  fazendo.value = true
  try { const msg = await fazerBackupEm(destino); fechar(); avisar(msg) }
  catch (e) { erro.value = e?.name === 'AbortError' || e?.codigo === 'cancelado' ? 'Operação cancelada. Nenhum backup foi confirmado.' : (e?.message || 'Não foi possível concluir o backup. Tente novamente.') }
  fazendo.value = false
}
const escolher = () => { fechar(); abrir('backup', { modo: 'fazer' }) }
</script>

<template>
  <Janela titulo="Fazer backup agora?" sair="Fechar">
    <p v-if="nome" class="texto">Usar {{ nome }}, o destino do seu último backup.</p>
    <p v-else class="texto">Escolha um destino e faça o primeiro backup uma vez. Nos próximos lembretes, você confirma por aqui.</p>
    <p v-if="fazendo" class="apoio" role="status">Fazendo backup… aguarde a confirmação.</p>
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    <button v-if="erro" type="button" class="link" @click="escolher">Revisar destino e permissões</button>
    <template #pe>
      <button type="button" class="botao suave grande cresce" :disabled="fazendo" @click="fechar()">Agora não</button>
      <button v-if="nome" type="button" class="botao cheio grande cresce" :disabled="fazendo" @click="fazer">{{ fazendo ? 'Fazendo backup…' : 'Fazer backup' }}</button>
      <button v-else type="button" class="botao cheio grande cresce" @click="escolher">Escolher destino</button>
    </template>
  </Janela>
</template>

<style scoped>
.texto { font-size: 15px; line-height: 21px; }
.link { min-height: 44px; font-weight: 700; color: var(--primaria); text-align: center; }
</style>
