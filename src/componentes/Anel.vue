<script setup>
// Semana no anel de ervas. Folha de fora: remédios; de dentro: rotinas.
// O estado vem pela forma (cheia, metade, contorno, tracejado), nunca pela cor.
import { computed } from 'vue'
import { DIAS_LETRA, DIAS_NOME } from '../nucleo/tempo.js'

const props = defineProps({ semana: Array, hojeIdx: Number })
const FORA = ['M75 15 C84 23 84 33 75 41 C66 33 66 23 75 15 Z', 'M75 15 C66 23 66 33 75 41 Z']
const DENTRO = ['M75 44 C81 49 81 55 75 60 C69 55 69 49 75 44 Z', 'M75 44 C69 49 69 55 75 60 Z']
const NOME = { cheio: 'tudo feito', metade: 'pela metade', vazio: 'nada feito', futuro: 'ainda não chegou' }

const folhas = computed(() => props.semana.flatMap((dia, i) => {
  const ang = Math.round((i * 360 / 7) * 100) / 100
  return [FORA, DENTRO].map((p, k) => ({ ang, d: p[0], metade: p[1], estado: dia[k] }))
}))
const letras = computed(() => DIAS_LETRA.map((l, i) => {
  const rad = (i * 360 / 7) * Math.PI / 180
  return { l, x: (75 + 68 * Math.sin(rad)).toFixed(1), y: (75 - 68 * Math.cos(rad) + 3.5).toFixed(1), hoje: i === props.hojeIdx }
}))
const descricao = computed(() => 'Semana no anel de ervas: ' + props.semana
  .map((d, i) => `${DIAS_NOME[i]}, remédios ${NOME[d[0]]}, rotinas ${NOME[d[1]]}`).join('; '))
</script>

<template>
  <svg width="150" height="150" viewBox="0 0 150 150" role="img" :aria-label="descricao">
    <g v-for="(f, i) in folhas" :key="i" :transform="`rotate(${f.ang} 75 75)`">
      <path :d="f.d" :fill="f.estado === 'cheio' ? 'var(--primaria)' : 'none'"
        :stroke="f.estado === 'cheio' || f.estado === 'metade' ? 'var(--primaria)' : 'var(--apoio)'"
        stroke-width="1.5" :stroke-dasharray="f.estado === 'futuro' ? '2 2.5' : 'none'" stroke-linejoin="round" />
      <path v-if="f.estado === 'metade'" :d="f.metade" fill="var(--primaria)" />
    </g>
    <text v-for="(d, i) in letras" :key="'l' + i" :x="d.x" :y="d.y" text-anchor="middle" font-size="10"
      :font-weight="d.hoje ? 800 : 500" :fill="d.hoje ? 'var(--primaria)' : 'var(--apoio)'">{{ d.l }}</text>
    <path d="M75 84 V71 M75 75 C71 75 68.5 72.5 68.5 68.5 C72.5 68.5 75 71 75 75 M75 72 C79 72 81.5 69.5 81.5 65.5 C77.5 65.5 75 68 75 72"
      fill="none" stroke="var(--primaria)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
