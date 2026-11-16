<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { fechar } from '../nucleo/ui.js'

const props = defineProps({ titulo: String, sair: { type: String, default: 'Fechar' }, aoFechar: Function })
const sai = () => (props.aoFechar ? props.aoFechar() : fechar())
const caixa = ref(null)
const tecla = (e) => { if (e.key === 'Escape') sai() }
onMounted(() => { document.addEventListener('keydown', tecla); caixa.value?.focus() })
onBeforeUnmount(() => document.removeEventListener('keydown', tecla))
</script>

<template>
  <div class="veu" @click.self="sai()">
    <div ref="caixa" class="janela" role="dialog" aria-modal="true" :aria-label="titulo" tabindex="-1">
      <div class="janela-topo">
        <button type="button" @click="sai()">{{ sair }}</button>
        <h2>{{ titulo }}</h2>
        <span></span>
      </div>
      <div class="janela-corpo"><slot /></div>
      <div v-if="$slots.pe" class="janela-pe"><slot name="pe" /></div>
    </div>
  </div>
</template>
