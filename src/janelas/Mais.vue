<script setup>
// Janela do "+" (provisória: a tela definitiva ainda vai ser desenhada).
import { computed } from 'vue'
import { estado, tomarSOS, desfazer } from '../nucleo/dados.js'
import { sosInfo } from '../nucleo/motor.js'
import { relogio } from '../nucleo/dados.js'
import { abrir, fechar, avisar } from '../nucleo/ui.js'
import { horaReal } from '../nucleo/tempo.js'
import { forma, doseTexto } from '../nucleo/formas.js'
import Janela from '../componentes/Janela.vue'
import Icone from '../componentes/Icone.vue'

const sos = computed(() => estado.remedios.filter((r) => r.tipo === 'sos'))
const trocar = (nome, props) => { fechar(); abrir(nome, props) }
function tomei(r) {
  const g = tomarSOS(r)
  fechar()
  avisar(`${r.nome}: ${forma(r.forma).verbo.toLowerCase()} às ${horaReal(g.horaReal)}`, { nome: 'Desfazer', fazer: () => desfazer(g.chave) })
}
</script>

<template>
  <Janela titulo="Adicionar">
    <div class="cartao lista-linhas">
      <button type="button" class="linha-escolha" @click="trocar('remedio', { modo: 'tratamento' })">
        <span class="quadro-icone"><Icone nome="capsula" /></span>Remédio<Icone nome="direita" :tam="18" style="margin-left:auto" />
      </button>
      <button type="button" class="linha-escolha" @click="trocar('rotina')">
        <span class="quadro-icone"><Icone nome="rotina" /></span>Rotina<Icone nome="direita" :tam="18" style="margin-left:auto" />
      </button>
      <button type="button" class="linha-escolha" @click="trocar('remedio', { modo: 'sos' })">
        <span class="quadro-icone"><Icone nome="sos" /></span>Remédio "se precisar" (SOS)<Icone nome="direita" :tam="18" style="margin-left:auto" />
      </button>
    </div>
    <div v-if="sos.length" class="grupo">
      <span class="rotulo">Tomei um SOS agora</span>
      <div v-for="r in sos" :key="r.id" class="cartao">
        <div class="sos-linha">
          <span class="quadro-icone"><Icone :nome="r.forma" /></span>
          <span class="sos-texto"><strong>{{ r.nome }}</strong><small class="apoio num">{{ doseTexto(r.dose ?? 1, r.forma) }}<template v-if="r.estoque?.tipo === 'contado'"> · {{ r.estoque.qtd }} no estoque</template></small></span>
          <button type="button" class="botao contorno" @click="tomei(r)">{{ forma(r.forma).verbo }} agora</button>
        </div>
        <div class="faixa info"><Icone nome="info" :tam="16" :traco="1.6" /><span class="num">{{ sosInfo(estado, r, relogio.agora).texto }}</span></div>
      </div>
    </div>
  </Janela>
</template>

<style scoped>
.linha-escolha { padding: 8px 14px; font-weight: 700; }
.sos-linha { display: flex; align-items: center; gap: 12px; padding: 14px; }
.sos-texto { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.sos-texto strong { font-size: 16px; font-weight: 800; }
.sos-texto small { font-size: 12px; font-weight: 600; }
</style>
