import './apoio.js'
import { describe, it, expect, beforeEach } from 'vitest'
import * as A from '../src/nucleo/acesso.js'
import { empacotar, validarComSessao, nomeNaNuvem } from '../src/nucleo/backup.js'
import { conferirEnvio, manterCopias, excluirCopiaSegura } from '../src/nucleo/nuvem/protecao.js'
import { EH_DO_AIRMED } from '../src/nucleo/nuvem/google.js'

A.ajuste.iteracoes = 1000
const dados = (n) => ({ versao: 1, remedios: [{ id: 'r' + n }], rotinas: [], registros: [] })

// Drive de mentira, na memória.
function driveFalso() {
  const arquivos = []
  let seq = 0
  return {
    arquivos,
    estraga: null, // id cujo download volta diferente
    async enviar(nome, texto) { const f = { id: 'id' + (++seq), nome, texto, data: seq }; arquivos.push(f); return { id: f.id, name: nome } },
    async listar() { return arquivos.map(({ id, nome, data }) => ({ id, nome, data })) },
    async baixar({ id }) { const f = arquivos.find((x) => x.id === id); if (!f) throw new Error('sumiu'); return this.estraga === id ? f.texto + ' ' : f.texto },
    async apagar({ id }) { const i = arquivos.findIndex((x) => x.id === id); if (i >= 0) arquivos.splice(i, 1) },
  }
}
const mandar = async (drive, n) => {
  const texto = await empacotar(dados(n))
  const enviado = await drive.enviar(`airmed-backup-${n}.airmed`, texto)
  await conferirEnvio(drive, enviado, texto, validarComSessao)
  await manterCopias(drive, validarComSessao)
}

beforeEach(async () => { A.apagarAcesso(); await A.criarSenha('senha-de-acesso', 'Ale') })

describe('cópias no Google Drive', () => {
  it('ficam só as 4 mais novas', async () => {
    const drive = driveFalso()
    for (let n = 1; n <= 6; n++) await mandar(drive, n)
    expect(drive.arquivos.map((f) => f.nome)).toEqual([3, 4, 5, 6].map((n) => `airmed-backup-${n}.airmed`))
  })
  it('cópia que volta diferente da nuvem não vale e nada antigo é apagado', async () => {
    const drive = driveFalso()
    for (let n = 1; n <= 4; n++) await mandar(drive, n)
    const texto = await empacotar(dados(5))
    const enviado = await drive.enviar('airmed-backup-5.airmed', texto)
    drive.estraga = enviado.id
    await expect(conferirEnvio(drive, enviado, texto, validarComSessao)).rejects.toThrow('diferente do enviado')
    expect(drive.arquivos.length).toBe(5)
  })
  it('se as cópias novas não abrem, a antiga que abre fica (podem sobrar mais de 4)', async () => {
    const drive = driveFalso()
    await mandar(drive, 1) // feita com o acesso atual: abre
    A.apagarAcesso(); await A.criarSenha('outro-acesso', 'Ale') // outro aparelho, outra chave mestra
    for (let n = 2; n <= 5; n++) { const t = await empacotar(dados(n)); await drive.enviar(`airmed-backup-${n}.airmed`, t) }
    // de volta ao primeiro acesso não dá (chave perdida); com o acesso atual a cópia 1 não abre, as 2 a 5 abrem
    await manterCopias(drive, validarComSessao)
    expect(drive.arquivos.length).toBe(4)
    expect(drive.arquivos.some((f) => f.nome === 'airmed-backup-1.airmed')).toBe(false)
    // agora o contrário: só a mais antiga abre
    const drive2 = driveFalso()
    const boa = await empacotar(dados(1)); await drive2.enviar('airmed-backup-1.airmed', boa)
    for (let n = 2; n <= 5; n++) await drive2.enviar(`airmed-backup-${n}.airmed`, 'lixo')
    await expect(manterCopias(drive2, validarComSessao)).rejects.toThrow('Exclusão bloqueada')
    expect(drive2.arquivos.length).toBe(5)
  })
  it('não deixa apagar a última cópia que abre', async () => {
    const drive = driveFalso()
    await mandar(drive, 1)
    await expect(excluirCopiaSegura(drive, drive.arquivos[0], validarComSessao)).rejects.toThrow('Exclusão bloqueada')
    await mandar(drive, 2)
    await excluirCopiaSegura(drive, drive.arquivos[0], validarComSessao)
    expect(drive.arquivos.map((f) => f.nome)).toEqual(['airmed-backup-2.airmed'])
  })
  it('só reconhece os arquivos do Airmed na área dividida com o Dagda', () => {
    expect(EH_DO_AIRMED.test(nomeNaNuvem(new Date('2026-11-16T10:05:09')))).toBe(true)
    expect(nomeNaNuvem(new Date('2026-11-16T10:05:09'))).toBe('airmed-backup-2026-11-16-100509.airmed')
    expect(EH_DO_AIRMED.test('sistema-financeiro-2026-11-16-1005.sfin')).toBe(false)
    expect(EH_DO_AIRMED.test('previa-sistema-financeiro-2026-11-16-1005.sfin')).toBe(false)
    expect(nomeNaNuvem()).not.toContain('.sfin')
  })
})
