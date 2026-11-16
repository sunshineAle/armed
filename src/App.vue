<script setup>
import { computed, watchEffect, ref, onMounted } from 'vue'
import { estado } from './nucleo/dados.js'
import { ui, irPara, abrir } from './nucleo/ui.js'
import Icone from './componentes/Icone.vue'
import Hoje from './telas/Hoje.vue'
import Remedios from './telas/Remedios.vue'
import Rotinas from './telas/Rotinas.vue'
import Ajustes from './telas/Ajustes.vue'
import Entrada from './telas/Entrada.vue'
import Mais from './janelas/Mais.vue'
import CadastroRemedio from './janelas/CadastroRemedio.vue'
import CadastroRotina from './janelas/CadastroRotina.vue'
import Detalhe from './janelas/Detalhe.vue'
import Alarme from './janelas/Alarme.vue'

const TELAS = { hoje: Hoje, remedios: Remedios, rotinas: Rotinas, ajustes: Ajustes }
const JANELAS = { mais: Mais, remedio: CadastroRemedio, rotina: CadastroRotina, detalhe: Detalhe }
const itens = [
  { id: 'hoje', nome: 'Hoje', icone: 'hoje' },
  { id: 'remedios', nome: 'Remédios', icone: 'capsula' },
  { id: 'rotinas', nome: 'Rotinas', icone: 'rotina' },
  { id: 'ajustes', nome: 'Ajustes', icone: 'ajustes' },
]

// Tema: segue o que a pessoa escolheu; "sistema" acompanha o aparelho.
const sistemaEscuro = ref(false)
onMounted(() => {
  const m = window.matchMedia('(prefers-color-scheme: dark)')
  sistemaEscuro.value = m.matches
  m.addEventListener('change', (e) => { sistemaEscuro.value = e.matches })
})
const modo = computed(() => (estado.prefs.modo === 'sistema' ? (sistemaEscuro.value ? 'escuro' : 'claro') : estado.prefs.modo))
watchEffect(() => {
  document.documentElement.dataset.modo = modo.value
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', modo.value === 'escuro' ? '#111915' : '#F5F8F2')
})
</script>

<template>
  <Entrada v-if="!estado.iniciado" />
  <div v-else class="casca">
    <div class="faixa-teste">Versão de teste{{ estado.demo ? ' · dados fictícios' : '' }}</div>
    <main class="conteudo">
      <component :is="TELAS[ui.tela]" />
    </main>
    <nav class="barra" aria-label="Navegação principal">
      <div class="barra-marca"><Icone nome="marca" :tam="24" :traco="1.8" /> Airmed</div>
      <template v-for="(it, i) in itens" :key="it.id">
        <button v-if="i === 2" type="button" class="barra-mais" aria-label="Adicionar remédio, rotina ou SOS" @click="abrir('mais')">
          <Icone nome="mais" :tam="26" :traco="2" />
        </button>
        <button type="button" class="barra-item" :aria-current="ui.tela === it.id ? 'page' : undefined" @click="irPara(it.id)">
          <span><Icone :nome="it.icone" /></span>{{ it.nome }}
        </button>
      </template>
    </nav>
    <component :is="JANELAS[j.nome]" v-for="j in ui.janelas" :key="j.id" v-bind="j.props" />
    <Alarme v-if="ui.alarme" :data="ui.alarme.data" :hora="ui.alarme.hora" />
    <div v-if="ui.aviso" class="aviso" role="status">
      <span>{{ ui.aviso.texto }}</span>
      <button v-if="ui.aviso.acao" type="button" @click="ui.aviso.acao.fazer(); ui.aviso = null">{{ ui.aviso.acao.nome }}</button>
    </div>
  </div>
</template>
