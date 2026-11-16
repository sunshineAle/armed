// Confirmação curta do backup (padrão Alt Design): usa só o último destino que recebeu um backup com sucesso.
// Nada sai sem a pessoa confirmar. A data do último backup só muda depois de a operação terminar sem erro.
import { estado, paraBackup, backupFeito } from './dados.js'
import { acesso } from './acesso.js'
import { empacotar, nomeDoArquivo, nomeNaNuvem, backupDevido } from './backup.js'
import { nuvem, nuvemDisponivel, enviarParaNuvem } from './nuvem/index.js'
import { ui, abrir, avisar } from './ui.js'

export const nomeDestino = (d) => ({ google: 'Google Drive', arquivo: 'arquivo neste aparelho', compartilhado: 'compartilhamento do aparelho' }[d] || '')
export const podeCompartilhar = () => { try { return !!navigator.canShare?.({ files: [new File(['x'], 'a.txt', { type: 'text/plain' })] }) } catch { return false } }

export async function fazerBackupEm(destino) {
  const texto = await empacotar(paraBackup(acesso.apelido))
  if (destino === 'google') {
    if (!nuvemDisponivel()) throw new Error('Este destino não está configurado. Escolha outro em Ajustes.')
    if (navigator.onLine === false) throw new Error('Sem internet. O backup não foi enviado. Tente novamente quando a conexão voltar.')
    await enviarParaNuvem(nomeNaNuvem(), texto)
  } else {
    const arquivo = new File([texto], nomeDoArquivo(), { type: 'text/plain' })
    if (destino === 'compartilhado') {
      if (!navigator.canShare?.({ files: [arquivo] })) throw new Error('Este navegador não oferece o compartilhamento de arquivos. Escolha outro destino.')
      await navigator.share({ files: [arquivo], title: 'Backup do Airmed' })
    } else {
      const url = URL.createObjectURL(arquivo)
      const a = Object.assign(document.createElement('a'), { href: url, download: arquivo.name })
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    }
  }
  backupFeito(destino)
  return destino === 'google' ? 'Backup enviado ao Google Drive.'
    : destino === 'arquivo' ? 'Arquivo de backup gerado. Confira os downloads do navegador.'
      : 'Backup entregue ao compartilhamento do aparelho. Confira o destino escolhido.'
}

// Lembrete: quando vence o prazo, abre a confirmação uma vez por ciclo. Com outra janela aberta, só avisa.
let cicloMostrado = null
export function verificarLembrete() {
  if (!ui.liberado || !acesso.desbloqueado || nuvem.ocupado) return
  if (!(estado.remedios.length + estado.rotinas.length)) return
  const b = estado.backup
  const ciclo = `${b.ultimo || b.desde}|${b.intervalo}`
  if (cicloMostrado === ciclo || !backupDevido(b)) return
  cicloMostrado = ciclo
  if (ui.janelas.length || ui.alarme) avisar('Hora do backup. Confirme quando puder.', { nome: 'Fazer backup', fazer: () => abrir('backupRapido') })
  else abrir('backupRapido')
}
