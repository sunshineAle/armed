<script setup>
// Tela de acesso no Padrão Alt Design (o mesmo do Dagda Capital). Uma tela só, com modos:
// escolher (aparelho sem acesso) | entrar | criar | redefinir (depois de restaurar) | restaurar (lista de cópias) |
// codigo (esqueci a senha) | nova-senha | chave (mostra o código novo) | oferta (depois de restaurar pela nuvem).
// Padrão escrito em: cerebro-central/05-recursos/padroes-alt-design/padrao-acesso-e-backup.md
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  acesso, criarSenha, verificarSenha, validarNovaSenha, validarApelido, esperaAteTentar, gerarNovoCodigo,
  confirmarCodigoGuardado, entrarComCodigo, redefinirSenhaComCodigo, adotarMestra, aplicarRecAdotado, codigoValido,
  apagarAcesso, biometriaMarcada, biometriaSuportada, desbloquearComBiometria, ativarBiometria,
} from '../nucleo/acesso.js'
import { estado, restaurar, apagarTudo, temDados } from '../nucleo/dados.js'
import { abrirBackup, lerEnvelope } from '../nucleo/backup.js'
import { nuvemDisponivel, prepararNuvem, conectarNuvem, listarNuvem, baixarDaNuvem, esquecerNuvem, temSessaoNuvem } from '../nucleo/nuvem/index.js'
import { fazerBackupEm } from '../nucleo/backupRapido.js'
import { instalacao, instalarApp, ehApple, orientacaoInstalacao } from '../nucleo/instalacao.js'
import { ui, avisar } from '../nucleo/ui.js'
import { verificar } from '../nucleo/avisos.js'
import Icone from '../componentes/Icone.vue'
import Janela from '../componentes/Janela.vue'
import CodigoRecuperacao from '../componentes/CodigoRecuperacao.vue'

// O Google exige toque direto para abrir a janela: a biblioteca é preparada quando a pessoa encosta no botão.
const migrando = !acesso.configurada && temDados() // quem usava uma versão sem senha: mantém os dados e cria o acesso
const modo = ref(acesso.configurada ? 'entrar' : (migrando ? 'criar' : 'escolher'))
const apelido = ref(acesso.apelido || '')
const senha = ref('')
const confirmacao = ref('')
const erro = ref('')
const carregando = ref(false)
const espera = ref(0)
let relogio = null
function iniciarEspera() {
  espera.value = esperaAteTentar()
  clearInterval(relogio)
  if (espera.value > 0) relogio = setInterval(() => { espera.value = esperaAteTentar(); if (espera.value <= 0) clearInterval(relogio) }, 1000)
}
onMounted(iniciarEspera)
onBeforeUnmount(() => clearInterval(relogio))

const boasVindas = computed(() => ['criar', 'escolher'].includes(modo.value))
const orientacao = orientacaoInstalacao()

// Biometria: chamada sozinha ao abrir (se ativada); a senha continua valendo.
const bioDisponivel = ref(false)
const ehPin = computed(() => acesso.pin)
onMounted(async () => {
  bioDisponivel.value = biometriaMarcada() && await biometriaSuportada()
  if (bioDisponivel.value && modo.value === 'entrar') entrarComBiometria(true)
})
async function entrarComBiometria(automatico = false) {
  erro.value = ''; carregando.value = true
  try { await desbloquearComBiometria(); liberar() } catch (e) { if (!automatico) erro.value = e.message } finally { carregando.value = false }
}
// Teclado de PIN na tela (também aceita o teclado físico).
const DIGITOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
function tecla(d) { if (senha.value.length < 12) senha.value += d; erro.value = '' }
function apagarTecla() { senha.value = senha.value.slice(0, -1) }
function teclaFisica(e) {
  if (modo.value !== 'entrar' || !ehPin.value || folha.value || copia.value) return
  if (/^\d$/.test(e.key)) { tecla(e.key); e.preventDefault() }
  else if (e.key === 'Backspace') { apagarTecla(); e.preventDefault() }
  else if (e.key === 'Enter' && senha.value.length >= 4) { enviar(); e.preventDefault() }
}
onMounted(() => window.addEventListener('keydown', teclaFisica))
onBeforeUnmount(() => window.removeEventListener('keydown', teclaFisica))

function liberar() {
  estado.iniciado = true
  if (!estado.backup.desde) estado.backup.desde = new Date().toISOString()
  ui.liberado = true
  if (avisoAoEntrar) avisar(avisoAoEntrar)
  verificar()
}
let avisoAoEntrar = ''

const titulo = computed(() => ({
  escolher: 'Bem-vindo de volta', entrar: acesso.apelido ? `Olá, ${acesso.apelido}` : 'Entrar', criar: 'Novo acesso',
  redefinir: 'Proteja este aparelho', restaurar: 'Restaurar backup', codigo: 'Esqueci a senha', 'nova-senha': 'Nova senha',
  chave: 'Código de recuperação', oferta: 'Restaurado!',
}[modo.value]))
const subtitulo = computed(() => ({
  entrar: ehPin.value ? 'Digite seu PIN.' : 'Digite sua senha ou PIN.',
  codigo: 'Digite o código de recuperação que você guardou no cadastro.',
  'nova-senha': 'Código aceito. Crie a nova senha.',
  chave: 'Guarde este código. Sem ele e sem a senha, não há como recuperar os dados.',
  criar: recomecoGoogle.value ? 'Crie seu acesso novo: o primeiro backup vai para esta conta Google.'
    : fluxoGoogle.value ? 'Sem backup nesta conta Google. Crie seu acesso: o primeiro backup vai para ela.'
      : migrando ? 'O que você já cadastrou continua aqui. Falta só proteger a entrada.' : '',
  redefinir: 'Dados restaurados. Crie a senha deste aparelho.',
  restaurar: 'Escolha uma cópia para continuar.',
  oferta: 'Seu acesso foi criado. Quer deixar o app mais prático neste aparelho?',
}[modo.value] || ''))
const ajudaCadastro = computed(() => [
  ...(recomecoGoogle.value ? ['Os backups antigos continuam na conta, fechados com a senha antiga. Eles saem sozinhos conforme os novos chegam.'] : []),
  fluxoGoogle.value
    ? 'A senha pode ser um PIN de 4 a 12 números ou uma senha com 6 ou mais caracteres. Ela protege o app e também o backup: prefira um PIN de 6 números ou mais.'
    : 'A senha pode ser um PIN de 4 a 12 números ou uma senha com 6 ou mais caracteres. Ela protege o app neste aparelho. Um PIN de 6 números ou mais é mais seguro.',
  fluxoGoogle.value ? 'Seus dados ficam no aparelho e, criptografados, no seu backup.' : 'Seus dados ficam só no aparelho.',
  'Guarde a senha e o código de recuperação em um cofre. Se perder os dois, não será possível recuperar os dados.',
])
const ajuda = ref(null) // { titulo, texto: [] }

const conferirNova = () => {
  const e = validarNovaSenha(senha.value)
  if (e) throw new Error(e)
  if (senha.value !== confirmacao.value) throw new Error('A confirmação não é igual à senha ou PIN.')
}
async function enviar() {
  erro.value = ''; carregando.value = true
  try {
    if (modo.value === 'entrar') {
      if (!(await verificarSenha(senha.value))) { erro.value = ehPin.value ? 'PIN incorreto.' : 'Senha incorreta.'; senha.value = ''; iniciarEspera(); return }
      // Cadastro sem código de recuperação: gera agora e mostra antes de entrar.
      if (acesso.recPendente) { codigoNovo.value = await gerarNovoCodigo(); modo.value = 'chave'; return }
    } else if (modo.value === 'codigo') {
      await entrarComCodigo(codigoDigitado.value)
      senha.value = ''; confirmacao.value = ''; modo.value = 'nova-senha'; return
    } else if (modo.value === 'nova-senha') {
      conferirNova()
      await redefinirSenhaComCodigo(senha.value)
    } else {
      // criar | redefinir
      if (modo.value === 'criar') { const ea = validarApelido(apelido.value); if (ea) throw new Error(ea) }
      conferirNova()
      const restaurado = modo.value === 'redefinir'
      if (restaurado && pendente) { apagarAcesso(); if (pendente.mestra) adotarMestra(pendente.mestra, pendente.rec) }
      await criarSenha(senha.value, restaurado ? (pendente?.dados.perfil?.apelido || 'Eu') : apelido.value.trim())
      if (restaurado) aplicarRecAdotado()
      if (await depoisDoAcesso()) return
    }
    liberar()
  } catch (e) { erro.value = e.message || 'Não foi possível continuar.'; iniciarEspera() } finally { carregando.value = false }
}
// Depois de criar o acesso: oferta (se veio da nuvem) -> código de recuperação (se falta) -> primeiro backup.
// Devolve true quando ainda há uma tela para mostrar antes de entrar.
async function depoisDoAcesso() {
  if (veioDaNuvem.value && !oferta.value && !ofertaFeita) {
    oferta.value = { bioOk: await biometriaSuportada(), bio: true, auto: true }; modo.value = 'oferta'; return true
  }
  if (acesso.recPendente) { codigoNovo.value = await gerarNovoCodigo(); modo.value = 'chave'; return true }
  await primeiroBackupGoogle()
  return false
}

// Código de recuperação recém-gerado
const codigoNovo = ref('')
const codigoDigitado = ref('')
let entrando = false
async function codigoGuardado() {
  if (entrando) return // toque duplo em "Entrar no app"
  entrando = true
  try { confirmarCodigoGuardado(); await primeiroBackupGoogle(); liberar() } catch (e) { entrando = false; throw e }
}

// Depois de restaurar pela nuvem: oferece biometria e backup automático nessa nuvem.
const oferta = ref(null)
let ofertaFeita = false
async function concluirOferta() {
  const o = oferta.value; erro.value = ''; carregando.value = true
  try {
    if (o.bioOk && o.bio) { try { await ativarBiometria() } catch (e) { avisoAoEntrar = e.message + ' Você pode ativar depois em Ajustes.' } }
    if (o.auto) { estado.backup.ultimoDestino = 'google'; estado.backup.automatico = true; if (estado.backup.intervalo === 'desligado') estado.backup.intervalo = 'semanal' }
    ofertaFeita = true; oferta.value = null
    if (await depoisDoAcesso()) return
    liberar()
  } finally { carregando.value = false }
}

// ---- Restaurar backup ----
const folha = ref(false) // folha "Restaurar Backup": Deste aparelho | Conectar nuvem
const nuvensAbertas = ref(false)
const copia = ref(null) // { texto, nome }: cópia escolhida, esperando a senha
const origemRestauro = ref('')
const backups = ref([])
const verTodas = ref(false)
const veioDaNuvem = ref(false)
const googleSemBackup = ref(false) // falta enviar o primeiro backup para a conta conectada
const fluxoGoogle = ref(false)
const recomecoGoogle = ref(false)
let pendente = null // backup aberto com o código (ou senha que não serve): espera a senha nova do aparelho
const fmtData = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

async function entrarGoogle() {
  erro.value = ''; carregando.value = true; copia.value = null
  try {
    await conectarNuvem()
    const itens = await listarNuvem()
    // Primeiro acesso pelo Google sem backup na conta: cadastro, e o primeiro backup vai para essa conta.
    if (!itens.length && !acesso.configurada) {
      googleSemBackup.value = true; fluxoGoogle.value = true; folha.value = false; senha.value = ''; confirmacao.value = ''; modo.value = 'criar'
      return
    }
    if (!itens.length) throw new Error('Não encontramos backups do app na sua conta Google Drive. Confira se entrou na conta certa.')
    backups.value = itens; veioDaNuvem.value = true; verTodas.value = false
    folha.value = false; modo.value = 'restaurar'; origemRestauro.value = 'Google Drive'
  } catch (e) { if (e?.codigo !== 'cancelado') { erro.value = e.message; folha.value = false } } finally { carregando.value = false }
}
async function selecionarBackup(item) {
  erro.value = ''; carregando.value = true
  try { copia.value = { texto: await baixarDaNuvem(item), nome: `Cópia de ${fmtData(item.data)}` } } catch (e) { erro.value = e.message } finally { carregando.value = false }
}
async function escolherArquivo(ev) {
  const f = ev.target.files?.[0]; ev.target.value = ''
  erro.value = ''
  if (!f) return
  folha.value = false; veioDaNuvem.value = false; backups.value = []
  try {
    if (f.size > 20 * 1024 * 1024) throw new Error('Arquivo grande demais para ser um backup do Airmed.')
    const texto = await f.text()
    lerEnvelope(texto)
    copia.value = { texto, nome: f.name }; modo.value = 'restaurar'; origemRestauro.value = 'Arquivo local'
  } catch (e) { erro.value = e.message; modo.value = 'restaurar'; origemRestauro.value = '' }
}

// Janela "Restaurar backup": confere sozinha depois de uma pausa na digitação e mostra o conteúdo antes de mudar algo.
const segredo = ref('')
const resultado = ref(null)
const erroCopia = ref('')
const conferindo = ref(false)
let pausa = null; let versao = 0
watch([segredo, copia], () => {
  versao++; clearTimeout(pausa); resultado.value = null; erroCopia.value = ''; conferindo.value = false
  if (copia.value && segredo.value) pausa = setTimeout(conferir, 700)
})
async function conferir() {
  clearTimeout(pausa)
  const atual = versao; const c = copia.value; const s = segredo.value
  if (!c || !s) return
  conferindo.value = true
  try { const r = await abrirBackup(c.texto, s.trim()); if (atual === versao) resultado.value = r }
  catch (e) { if (atual === versao) erroCopia.value = e.message } finally { if (atual === versao) conferindo.value = false }
}
const conteudo = computed(() => {
  const d = resultado.value?.dados
  if (!d) return []
  const pl = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
  return [pl(d.remedios.length, 'remédio', 'remédios'), pl(d.rotinas.length, 'rotina', 'rotinas'), pl(d.registros.length, 'registro', 'registros')]
})
function fecharCopia() { if (!carregando.value) { copia.value = null; segredo.value = '' } }
async function restaurarAgora() {
  const r = resultado.value; const s = segredo.value.trim()
  if (!r || carregando.value) return
  erroCopia.value = ''; carregando.value = true
  try {
    // Um código de recuperação não vira senha de acesso. Senha que não serve também pede uma nova.
    const podeReusar = !r.pelaChave && !codigoValido(s) && !validarNovaSenha(s)
    restaurar(r.dados, r.criadoEm)
    copia.value = null; segredo.value = ''
    if (podeReusar) {
      apagarAcesso()
      if (r.mestra) adotarMestra(r.mestra, r.rec)
      await criarSenha(s, r.dados.perfil?.apelido || 'Eu')
      aplicarRecAdotado()
      if (await depoisDoAcesso()) return
      liberar()
    } else {
      pendente = r; senha.value = ''; confirmacao.value = ''; modo.value = 'redefinir'
    }
  } catch (e) { erroCopia.value = e.message || 'Não deu para restaurar.' } finally { carregando.value = false }
}

// O primeiro backup vai para a conta Google já conectada. Se falhar, a entrada não trava: o destino fica marcado
// e o lembrete de backup oferece de novo.
const enviandoPrimeiro = ref(false)
async function primeiroBackupGoogle() {
  if (!googleSemBackup.value || enviandoPrimeiro.value) return
  googleSemBackup.value = false
  enviandoPrimeiro.value = true
  try {
    if (!temSessaoNuvem()) throw new Error('sessão Google expirada')
    await Promise.race([fazerBackupEm('google'), new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), 45000))])
    avisoAoEntrar = 'Primeiro backup guardado no Google Drive.'
  } catch {
    estado.backup.ultimoDestino = 'google'
    avisoAoEntrar = 'Não deu para enviar o primeiro backup agora. O lembrete de backup oferece de novo.'
  } finally { enviandoPrimeiro.value = false }
}

// Começar do zero: perdeu a senha E o código. Alerta grave e confirmação digitando APAGAR.
const zerarAberto = ref(false)
const zerarGoogle = ref(false)
const textoZerar = ref('')
const podeZerar = computed(() => textoZerar.value.trim().toUpperCase() === 'APAGAR')
function abrirZerar(google = false) { zerarGoogle.value = google; textoZerar.value = ''; zerarAberto.value = true }
function confirmarZerar() {
  if (!podeZerar.value) return
  zerarAberto.value = false
  // Aparelho sem acesso vindo do Google: não há dado local para apagar. Segue para o cadastro novo;
  // o primeiro backup vai para a conta já conectada.
  if (zerarGoogle.value && !acesso.configurada) {
    backups.value = []; copia.value = null; origemRestauro.value = ''; erro.value = ''; veioDaNuvem.value = false
    googleSemBackup.value = true; fluxoGoogle.value = true; recomecoGoogle.value = true; senha.value = ''; confirmacao.value = ''; modo.value = 'criar'
    return
  }
  apagarAcesso(); esquecerNuvem(); apagarTudo()
  limparFluxo(); apelido.value = ''; modo.value = 'escolher'
}
function limparFluxo() {
  googleSemBackup.value = false; fluxoGoogle.value = false; recomecoGoogle.value = false; veioDaNuvem.value = false
  senha.value = ''; confirmacao.value = ''; backups.value = []; copia.value = null; origemRestauro.value = ''; erro.value = ''; pendente = null
}
function voltar() { limparFluxo(); modo.value = acesso.configurada ? 'entrar' : 'escolher' }
function irCodigo() { erro.value = ''; codigoDigitado.value = ''; modo.value = 'codigo' }
</script>

<template>
  <main class="acesso">
    <section class="topo">
      <div class="marca"><Icone nome="marca" :tam="40" :traco="1.6" /></div>
      <strong class="nome-app">Airmed</strong>
      <button v-if="boasVindas && !instalacao.instalado" type="button" class="instalar" @click="instalarApp()">
        <Icone nome="baixar" :tam="18" :traco="2" />{{ ehApple() ? 'Como instalar' : 'Instalar aplicativo' }}
      </button>
    </section>

    <section class="bloco">
      <!-- Aparelho sem acesso -->
      <template v-if="modo === 'escolher'">
        <h1>{{ titulo }}</h1>
        <template v-if="nuvemDisponivel()">
          <button type="button" class="botao cheio grande" :disabled="carregando" @pointerdown="prepararNuvem()" @click="entrarGoogle">{{ carregando ? 'Buscando backups…' : 'Entrar com Google' }}</button>
          <p class="nota centro">Com a senha do seu backup.<button type="button" class="interroga" aria-label="Ajuda: restaurar pelo Google" @click="ajuda = { titulo: 'Restaurar pelo Google', texto: ['O Google localiza suas cópias na área oculta do app no Drive. Isso não substitui a senha do backup.', 'Nenhum novo cadastro é necessário para restaurar.'] }">?</button></p>
        </template>
        <button type="button" class="botao contorno grande" @click="folha = true">Restaurar meu Airmed</button>
        <button type="button" class="link" @click="modo = 'criar'">Criar acesso novo</button>
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
      </template>

      <!-- Entrar: PIN na tela ou senha; biometria chamada sozinha -->
      <form v-else-if="modo === 'entrar'" class="formulario" @submit.prevent="enviar">
        <h1>{{ titulo }}</h1>
        <p class="apoio">{{ subtitulo }}</p>
        <template v-if="ehPin">
          <div class="pontos" :class="{ falhou: !!erro }" aria-live="polite" :aria-label="`${senha.length} dígitos digitados`">
            <span v-for="n in Math.max(4, senha.length)" :key="n" :class="{ cheio: n <= senha.length }"></span>
          </div>
          <div class="teclado" role="group" aria-label="Teclado do PIN">
            <button v-for="d in DIGITOS" :key="d" type="button" class="tecla num" :disabled="carregando || espera > 0" @click="tecla(d)">{{ d }}</button>
            <button v-if="bioDisponivel" type="button" class="tecla" aria-label="Entrar com biometria" :disabled="carregando" @click="entrarComBiometria()"><Icone nome="digital" :tam="24" :traco="1.8" /></button>
            <span v-else></span>
            <button type="button" class="tecla num" :disabled="carregando || espera > 0" @click="tecla('0')">0</button>
            <button type="button" class="tecla" aria-label="Apagar" :disabled="!senha" @click="apagarTecla"><Icone nome="apagar" :tam="22" :traco="1.8" /></button>
          </div>
        </template>
        <div v-else class="com-bio">
          <label class="entrada"><span class="so-leitor">Senha ou PIN</span><input v-model="senha" type="password" autocomplete="current-password" placeholder="Senha ou PIN" autofocus></label>
          <button v-if="bioDisponivel" type="button" class="bio-mini" aria-label="Entrar com biometria" :disabled="carregando" @click="entrarComBiometria()"><Icone nome="digital" :tam="22" :traco="1.8" /></button>
        </div>
        <p v-if="espera > 0" class="erro">Muitas tentativas. Aguarde {{ espera }}s.</p>
        <p v-else-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button type="submit" class="botao cheio grande" :disabled="carregando || espera > 0 || (ehPin && senha.length < 4)">{{ carregando ? 'Aguarde…' : 'Entrar' }}</button>
        <div class="links">
          <button type="button" class="link" @click="irCodigo">Esqueci a senha</button><span aria-hidden="true">·</span>
          <button type="button" class="link" @click="folha = true">Restaurar backup</button>
        </div>
      </form>

      <!-- Criar / redefinir depois de restaurar / nova senha pelo código -->
      <form v-else-if="['criar', 'redefinir', 'nova-senha'].includes(modo)" class="formulario" @submit.prevent="enviar">
        <h1>{{ titulo }}<button type="button" class="interroga" aria-label="Ajuda: sobre a senha" @click="ajuda = { titulo: 'Sobre a senha', texto: ajudaCadastro }">?</button></h1>
        <p v-if="subtitulo" class="apoio">{{ subtitulo }}</p>
        <div v-if="modo === 'criar'" class="campo"><label for="ac-apelido">Apelido</label><div class="entrada"><input id="ac-apelido" v-model="apelido" autocomplete="nickname" maxlength="30" placeholder="Seu nome no app" autofocus></div></div>
        <div class="campo"><label for="ac-senha">Senha ou PIN</label><div class="entrada"><input id="ac-senha" v-model="senha" type="password" autocomplete="new-password" placeholder="4+ números ou 6+ caracteres"></div></div>
        <div class="campo"><label for="ac-repete">Repita a senha ou PIN</label><div class="entrada"><input id="ac-repete" v-model="confirmacao" type="password" autocomplete="new-password" placeholder="••••••••"></div></div>
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button type="submit" class="botao cheio grande" :disabled="carregando">{{ carregando ? 'Aguarde…' : 'Salvar senha e entrar' }}</button>
        <button v-if="modo === 'criar' && !migrando" type="button" class="link" @click="voltar">Voltar</button>
        <button v-if="modo === 'nova-senha'" type="button" class="link" @click="voltar">Cancelar</button>
      </form>

      <!-- Esqueci a senha: código de recuperação -->
      <form v-else-if="modo === 'codigo'" class="formulario" @submit.prevent="enviar">
        <h1>{{ titulo }}</h1>
        <p class="apoio">{{ subtitulo }}</p>
        <div class="campo"><label for="ac-codigo">Código de recuperação</label><div class="entrada"><input id="ac-codigo" v-model="codigoDigitado" class="num" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JKLM-NPQR-STUV-WXYZ" autofocus></div></div>
        <p v-if="espera > 0" class="erro">Muitas tentativas. Aguarde {{ espera }}s.</p>
        <p v-else-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button type="submit" class="botao cheio grande" :disabled="carregando || espera > 0 || !codigoDigitado">{{ carregando ? 'Conferindo…' : 'Continuar' }}</button>
        <p class="nota centro">Não tem o código? Restaure um backup.<button type="button" class="interroga" aria-label="Ajuda: sem senha e sem código" @click="ajuda = { titulo: 'Sem senha e sem código', texto: ['O backup abre com a senha da época ou com o código de recuperação.', 'Se você não tem nenhum dos dois, só resta começar do zero: os dados deste aparelho são apagados. O Airmed não guarda cópia em servidor.'] }">?</button></p>
        <div class="links">
          <button type="button" class="link" @click="voltar">Voltar</button><span aria-hidden="true">·</span>
          <button type="button" class="link" @click="folha = true">Restaurar backup</button>
        </div>
        <button type="button" class="link perigo" @click="abrirZerar(false)">Começar do zero</button>
      </form>

      <!-- Código de recuperação recém-gerado -->
      <template v-else-if="modo === 'chave'">
        <h1>{{ titulo }}</h1>
        <CodigoRecuperacao :codigo="codigoNovo" rotulo-continuar="Entrar no app" @guardado="codigoGuardado" />
        <p v-if="enviandoPrimeiro" class="nota centro" role="status">Guardando o primeiro backup na sua conta Google…</p>
      </template>

      <template v-else-if="modo === 'oferta' && oferta">
        <h1>{{ titulo }}</h1>
        <p class="apoio">{{ subtitulo }}</p>
        <label v-if="oferta.bioOk" class="oferta"><input v-model="oferta.bio" type="checkbox"><span><b>Desbloquear com biometria</b><small>digital, rosto ou PIN do celular; a senha continua valendo</small></span></label>
        <label class="oferta"><input v-model="oferta.auto" type="checkbox"><span><b>Backup automático no Google Drive</b><small>o lembrete abre sozinho quando passar o prazo e você confirma com um toque</small></span></label>
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button type="button" class="botao cheio grande" :disabled="carregando" @click="concluirOferta">Continuar</button>
      </template>

      <!-- Restaurar: lista de cópias da nuvem ou arquivo -->
      <template v-else>
        <h1>{{ titulo }}</h1>
        <p class="apoio">{{ subtitulo }}</p>
        <p v-if="origemRestauro" class="nota">Origem: {{ origemRestauro }}</p>
        <div v-if="backups.length" class="copias" aria-label="Cópias de backup disponíveis">
          <p class="nota">Para gerenciar ou excluir cópias, entre no app e abra Ajustes. Antes de excluir, o Airmed precisa comprovar que outra cópia é recuperável com seu acesso.</p>
          <span class="rotulo">Cópias recentes</span>
          <div class="cartao lista-linhas">
            <button v-for="i in (verTodas ? backups : backups.slice(0, 4))" :key="i.id" type="button" class="copia" :disabled="carregando" @click="selecionarBackup(i)"><b class="num">{{ fmtData(i.data) }}</b><small class="apoio num">{{ Math.ceil(i.tamanho / 1024) }} KB</small></button>
          </div>
          <button v-if="backups.length > 4 && !verTodas" type="button" class="link" @click="verTodas = true">Ver outras cópias</button>
        </div>
        <label v-if="!veioDaNuvem" class="botao tracejado arquivo">Escolher o arquivo de backup<input type="file" class="so-leitor" @change="escolherArquivo"></label>
        <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
        <button v-if="veioDaNuvem && backups.length" type="button" class="link perigo" :disabled="carregando" @click="abrirZerar(true)">Não lembro a senha deste backup</button>
        <button type="button" class="link" @click="voltar">Voltar</button>
      </template>
    </section>

    <p class="assinatura">Airmed · um projeto <strong>Alt Design Creative</strong></p>

    <!-- Folha "Restaurar Backup": os mesmos dois botões do app -->
    <Janela v-if="folha" titulo="Restaurar Backup" :ao-fechar="() => (folha = false)">
      <label class="origem">
        <span class="quadro-icone"><Icone nome="celular" /></span>
        <span class="origem-texto"><b>Deste aparelho</b><small class="apoio">escolha o arquivo de backup em qualquer pasta</small></span>
        <!-- Sem "accept": em iPhone e em vários Android, tipo desconhecido deixa o arquivo cinza. O conteúdo é conferido depois. -->
        <input type="file" class="so-leitor" :disabled="carregando" @change="escolherArquivo">
      </label>
      <template v-if="nuvemDisponivel()">
        <button type="button" class="origem" :aria-expanded="nuvensAbertas" @click="nuvensAbertas = !nuvensAbertas">
          <span class="quadro-icone"><Icone nome="nuvem" /></span>
          <span class="origem-texto"><b>Conectar nuvem</b><small class="apoio">Google Drive</small></span>
          <Icone nome="baixo" :tam="18" :traco="2" :style="{ transform: nuvensAbertas ? 'rotate(180deg)' : 'none' }" />
        </button>
        <button v-if="nuvensAbertas" type="button" class="origem dentro-nuvem" :disabled="carregando" @pointerdown="prepararNuvem()" @click="entrarGoogle">
          <span class="quadro-icone"><Icone nome="nuvem" /></span>
          <span class="origem-texto"><b>Google Drive</b><small class="apoio">{{ carregando ? 'buscando…' : 'entrar e buscar o backup' }}</small></span>
        </button>
      </template>
      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    </Janela>

    <!-- Janela "Restaurar backup": senha, conferência e conteúdo -->
    <Janela v-if="copia" titulo="Restaurar backup" sair="Voltar" :ao-fechar="fecharCopia">
      <p class="texto">Digite a senha desta cópia.</p>
      <div class="campo"><label for="ac-segredo">Senha do backup ou código de recuperação</label><div class="entrada"><input id="ac-segredo" v-model="segredo" type="password" autocomplete="off" placeholder="Senha da época do backup ou o código" :disabled="carregando" @keyup.enter="conferir"></div></div>
      <p v-if="conferindo" class="apoio" role="status" aria-live="polite">Conferindo backup…</p>
      <div v-if="resultado" class="cartao conteudo">
        <b>Conteúdo do backup</b>
        <ul><li v-for="c in conteudo" :key="c" class="num">{{ c }}</li></ul>
        <small class="apoio">Feito em {{ fmtData(resultado.criadoEm) }}. Seus dados só serão alterados quando você confirmar a restauração.</small>
      </div>
      <p v-if="erroCopia" class="erro" role="alert">{{ erroCopia }}</p>
      <template v-if="resultado" #pe>
        <button type="button" class="botao cheio grande cresce" :disabled="carregando || conferindo" @click="restaurarAgora">{{ carregando ? 'Restaurando…' : 'Restaurar e continuar' }}</button>
      </template>
    </Janela>

    <!-- Começar do zero -->
    <Janela v-if="zerarAberto" titulo="Começar do zero" sair="Cancelar" :ao-fechar="() => (zerarAberto = false)">
      <div class="alerta-grave" role="alert"><Icone nome="atencao" :tam="40" :traco="2" /><b>Você vai perder todos os seus dados.</b><span>Não dá para desfazer.</span></div>
      <p class="texto">O Airmed guarda tudo <b>só neste aparelho</b>. Não existe cópia em servidor.</p>
      <p v-if="zerarGoogle" class="texto">Sem a senha ou o código, os <b>backups desta conta Google não abrem mais</b>. Você começa um cadastro novo.</p>
      <p v-else class="texto">Sem a senha ou o código, os <b>backups que você já fez também não abrem</b>.</p>
      <div class="campo"><label for="ac-apagar">Digite <b>APAGAR</b> para confirmar</label><div class="entrada"><input id="ac-apagar" v-model="textoZerar" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="APAGAR" @keyup.enter="confirmarZerar"></div></div>
      <template #pe>
        <button type="button" class="botao suave grande cresce" @click="zerarAberto = false">Cancelar</button>
        <button type="button" class="botao perigo grande cresce" :disabled="!podeZerar" @click="confirmarZerar">Apagar tudo</button>
      </template>
    </Janela>

    <!-- Passos de instalação por aparelho -->
    <Janela v-if="instalacao.instrucoes" :titulo="orientacao.titulo" :ao-fechar="() => (instalacao.instrucoes = false)">
      <p class="texto">Para deixar o Airmed {{ orientacao.onde }} e acessá-lo como aplicativo, siga os passos abaixo usando o recurso do seu navegador.</p>
      <ol class="passos"><li v-for="p in orientacao.passos" :key="p">{{ p }}</li></ol>
      <template #pe><button type="button" class="botao cheio grande cresce" @click="instalacao.instrucoes = false">Entendi</button></template>
    </Janela>

    <Janela v-if="ajuda" :titulo="ajuda.titulo" :ao-fechar="() => (ajuda = null)">
      <p v-for="t in ajuda.texto" :key="t" class="texto">{{ t }}</p>
    </Janela>
  </main>
</template>

<style scoped>
.acesso { min-height: 100dvh; max-width: 440px; margin: 0 auto; padding: 28px 24px 20px; display: flex; flex-direction: column; gap: 22px; }
.topo { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 12px; }
.marca { width: 72px; height: 72px; border-radius: 24px; background: var(--primaria); color: var(--sobre-primaria); display: flex; align-items: center; justify-content: center; }
.nome-app { font-size: 20px; font-weight: 800; letter-spacing: -0.2px; }
.instalar { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 18px; border-radius: 999px; background: var(--chip); color: var(--sobre-chip); font-size: 14px; font-weight: 800; }
.bloco, .formulario { display: flex; flex-direction: column; gap: 14px; }
.bloco { flex: 1; justify-content: center; }
h1 { display: flex; align-items: center; gap: 8px; font-size: 26px; line-height: 32px; font-weight: 800; letter-spacing: -0.3px; }
.centro { text-align: center; }
.interroga { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; margin-left: 6px; border-radius: 12px; border: 1.5px solid var(--apoio); color: var(--apoio); font-size: 13px; font-weight: 800; flex-shrink: 0; vertical-align: middle; }
.link { min-height: 44px; text-align: center; font-weight: 700; color: var(--primaria); }
.link.perigo { color: var(--atrasado); }
.links { display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--apoio); }
.pontos { display: flex; justify-content: center; gap: 14px; padding: 6px 0; }
.pontos span { width: 14px; height: 14px; border-radius: 7px; border: 1.5px solid var(--apoio); }
.pontos span.cheio { background: var(--primaria); border-color: var(--primaria); }
.pontos.falhou span { border-color: var(--atrasado); }
.teclado { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 300px; width: 100%; margin: 0 auto; }
.tecla { height: 60px; border-radius: 18px; background: var(--cartao); border: 1px solid var(--borda); display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: var(--texto); }
.tecla:disabled { opacity: 0.5; }
.com-bio { display: flex; gap: 8px; }
.com-bio .entrada { flex: 1; }
.bio-mini { width: 52px; height: 52px; border-radius: 14px; border: 1px solid var(--borda); background: var(--cartao); display: flex; align-items: center; justify-content: center; color: var(--primaria); }
.oferta { display: flex; gap: 12px; padding: 14px; border-radius: 16px; background: var(--cartao); border: 1px solid var(--borda); }
.oferta input { width: 22px; height: 22px; accent-color: var(--primaria); flex-shrink: 0; margin-top: 2px; }
.oferta span { display: flex; flex-direction: column; gap: 2px; }
.oferta small { font-size: 13px; color: var(--apoio); }
.copias { display: flex; flex-direction: column; gap: 8px; }
.copia { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 56px; padding: 0 14px; }
.copia b { font-size: 15px; font-weight: 750; }
.copia small { font-size: 12px; font-weight: 600; }
.arquivo { cursor: pointer; }
.assinatura { text-align: center; font-size: 12px; color: var(--apoio); }
.origem { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 68px; padding: 10px 14px; border-radius: 16px; background: var(--cartao); border: 1px solid var(--borda); cursor: pointer; }
.origem:focus-within { outline: 2px solid var(--primaria); outline-offset: 2px; }
.origem-texto { display: flex; flex-direction: column; gap: 2px; flex: 1; text-align: left; }
.origem-texto b { font-size: 15px; font-weight: 800; }
.origem-texto small { font-size: 12px; }
.dentro-nuvem { margin-left: 16px; width: auto; }
.texto { font-size: 15px; line-height: 21px; }
.conteudo { padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.conteudo ul { margin: 0; padding-left: 18px; font-weight: 700; }
.conteudo small { font-size: 12px; line-height: 17px; }
.alerta-grave { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px; border-radius: 16px; border: 2px solid var(--atrasado); background: var(--atrasado-fundo); color: var(--atrasado); text-align: center; }
.alerta-grave b { font-size: 17px; }
.passos { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; font-size: 15px; line-height: 21px; }
</style>
