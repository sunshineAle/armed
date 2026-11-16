<script setup>
// Mostra a chave de recuperação recém-criada. Ela só aparece inteira aqui e em Ajustes (com a senha).
import { ref } from 'vue'
import { confirmarCodigoGuardado } from '../nucleo/acesso.js'
import { ui, avisar } from '../nucleo/ui.js'
import Icone from '../componentes/Icone.vue'

const guardei = ref(false)
const copiado = ref(false)
async function copiar() {
  try { await navigator.clipboard.writeText(ui.codigoNovo); copiado.value = true } catch { copiado.value = false; avisar('Não deu para copiar. Anote a chave à mão.') }
}
function continuar() { confirmarCodigoGuardado(); ui.codigoNovo = null }
function depois() { ui.codigoNovo = null }
</script>

<template>
  <main class="chave">
    <span class="rotulo" style="padding:0">Chave de recuperação</span>
    <h1>Guarde esta chave</h1>
    <p class="apoio">Se você esquecer a senha, é esta chave que abre o app e os seus backups. Ninguém mais tem uma cópia dela.</p>
    <div class="cartao codigo num" aria-label="Chave de recuperação">
      <span v-for="(g, i) in ui.codigoNovo.split('-')" :key="i">{{ g }}</span>
    </div>
    <button type="button" class="botao contorno" @click="copiar">{{ copiado ? 'Copiada' : 'Copiar a chave' }}</button>
    <div class="faixa info solta"><Icone nome="info" :tam="16" :traco="1.6" /><span>Guarde num cofre de senhas ou anote em papel, longe do celular. Não guarde só neste aparelho.</span></div>
    <label class="guardei"><input v-model="guardei" type="checkbox"> Guardei a chave num lugar seguro</label>
    <button type="button" class="botao cheio grande" :disabled="!guardei" @click="continuar">Continuar</button>
    <button type="button" class="link" @click="depois">Guardar depois</button>
  </main>
</template>

<style scoped>
.chave { min-height: 100dvh; max-width: 420px; margin: 0 auto; padding: 32px 24px; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
h1 { font-size: 26px; line-height: 32px; font-weight: 800; letter-spacing: -0.3px; }
.codigo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 8px; padding: 18px 14px; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 1.5px; user-select: all; }
.guardei { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 15px; font-weight: 700; }
.guardei input { width: 22px; height: 22px; accent-color: var(--primaria); flex-shrink: 0; }
.link { min-height: 44px; text-align: center; font-weight: 700; color: var(--apoio); }
</style>
