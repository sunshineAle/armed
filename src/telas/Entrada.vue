<script setup>
// Primeira abertura (provisória): a tela definitiva, com "Restaurar meu Airmed", ainda vai ser desenhada.
import { comecar } from '../nucleo/dados.js'
import Icone from '../componentes/Icone.vue'
</script>

<template>
  <main class="entrada-tela">
    <div class="entrada-marca"><Icone nome="marca" :tam="44" :traco="1.6" /></div>
    <h1>Airmed</h1>
    <p class="apoio">Versão de teste. Remédios e rotinas num lugar só, com lembretes. Os dados ficam só neste aparelho.</p>
    <div class="entrada-botoes">
      <button type="button" class="botao cheio grande" @click="comecar(true)">Testar com dados fictícios</button>
      <button type="button" class="botao neutro grande" @click="comecar(false)">Começar do zero</button>
    </div>
    <p class="nota">O Airmed organiza e lembra. Ele não indica nem calcula dose: siga sempre a orientação do seu médico ou da bula.</p>
  </main>
</template>

<style scoped>
.entrada-tela { min-height: 100dvh; max-width: 420px; margin: 0 auto; padding: 32px 24px; display: flex; flex-direction: column; justify-content: center; gap: 16px; text-align: center; }
.entrada-marca { width: 84px; height: 84px; border-radius: 28px; margin: 0 auto 4px; background: var(--primaria); color: var(--sobre-primaria); display: flex; align-items: center; justify-content: center; }
h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.5px; }
.entrada-botoes { display: flex; flex-direction: column; gap: 10px; margin: 12px 0; }
</style>
