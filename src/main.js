import { createApp } from 'vue'
import '@fontsource-variable/plus-jakarta-sans'
import './estilo.css'
import App from './App.vue'
import { iniciarRelogio } from './nucleo/avisos.js'
import './nucleo/instalacao.js'
import { carregarAcesso, iniciarAutoBloqueio } from './nucleo/acesso.js'

carregarAcesso()
iniciarAutoBloqueio()

createApp(App).mount('#app')
iniciarRelogio()
