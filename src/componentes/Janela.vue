<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { fechar } from '../nucleo/ui.js'

defineProps({ titulo: String, sair: { type: String, default: 'Fechar' } })
const caixa = ref(null)
const tecla = (e) => { if (e.key === 'Escape') fechar() }
onMounted(() => { document.addEventListener('keydown', tecla); caixa.value?.focus() })
onBeforeUnmount(() => document.removeEventListener('keydown', tecla))
</script>

<template>
  <div class="veu" @click.self="fechar()">
    <div ref="caixa" class="janela" role="dialog" aria-modal="true" :aria-label="titulo" tabindex="-1">
      <div class="janela-topo">
        <button type="button" @click="fechar()">{{ sair }}</button>
        <h2>{{ titulo }}</h2>
        <span></span>
      </div>
      <div class="janela-corpo"><slot /></div>
      <div v-if="$slots.pe" class="janela-pe"><slot name="pe" /></div>
    </div>
  </div>
</template>
