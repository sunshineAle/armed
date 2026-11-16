import { describe, it, expect } from 'vitest'
import { cifrar, decifrar, lerCabecalho, validar, nomeDoArquivo, diasSemBackup } from '../src/nucleo/backup.js'

const dados = { versao: 1, remedios: [{ id: 'r1', nome: 'Ervalina' }], rotinas: [], registros: [], prefs: { modo: 'escuro' } }
const rapido = { iteracoes: 1000 }

describe('backup', () => {
  it('vai e volta com a senha certa', async () => {
    const texto = await cifrar(dados, 'senha-de-teste', rapido)
    const volta = await decifrar(texto, 'senha-de-teste')
    expect(volta.dados).toEqual(dados)
    expect(volta.criadoEm).toBeTruthy()
  })
  it('o arquivo não mostra nada do conteúdo', async () => {
    const texto = await cifrar(dados, 'senha-de-teste', rapido)
    expect(texto).not.toContain('Ervalina')
    expect(texto).not.toContain('remedios')
    expect(Object.keys(JSON.parse(texto)).sort()).toEqual(['cifra', 'criadoEm', 'dados', 'formato', 'kdf', 'versao'])
  })
  it('senha errada não abre', async () => {
    const texto = await cifrar(dados, 'senha-de-teste', rapido)
    await expect(decifrar(texto, 'outra-senha')).rejects.toThrow('Senha errada ou arquivo danificado.')
  })
  it('arquivo mexido não abre', async () => {
    const arq = JSON.parse(await cifrar(dados, 'senha-de-teste', rapido))
    arq.dados = arq.dados.slice(0, -6) + 'AAAAA='
    await expect(decifrar(JSON.stringify(arq), 'senha-de-teste')).rejects.toThrow('Senha errada ou arquivo danificado.')
  })
  it('dois backups iguais saem diferentes (sal e iv novos)', async () => {
    const a = JSON.parse(await cifrar(dados, 'senha-de-teste', rapido))
    const b = JSON.parse(await cifrar(dados, 'senha-de-teste', rapido))
    expect(a.dados).not.toBe(b.dados)
    expect(a.kdf.sal).not.toBe(b.kdf.sal)
  })
  it('recusa arquivo que não é backup e versão mais nova', async () => {
    expect(() => lerCabecalho('oi')).toThrow('não é um backup')
    expect(() => lerCabecalho('{"a":1}')).toThrow('não é um backup')
    const arq = JSON.parse(await cifrar(dados, 'senha-de-teste', rapido))
    expect(() => lerCabecalho(JSON.stringify({ ...arq, versao: 2 }))).toThrow('versão mais nova')
  })
  it('recusa conteúdo fora do formato', async () => {
    expect(validar({ versao: 1, remedios: [], rotinas: [] })).toBe(false)
    const texto = await cifrar({ versao: 1, remedios: 'x' }, 'senha-de-teste', rapido)
    await expect(decifrar(texto, 'senha-de-teste')).rejects.toThrow('formato esperado')
  })
  it('nome do arquivo e dias sem backup', () => {
    expect(nomeDoArquivo(new Date('2026-11-16T10:00:00'))).toBe('airmed-backup-2026-11-16.txt')
    expect(diasSemBackup(null)).toBe(null)
    expect(diasSemBackup('2026-11-16T12:00:05', new Date('2026-11-16T12:00:00'))).toBe(0)
    expect(diasSemBackup('2026-11-08T10:00:00', new Date('2026-11-16T12:00:00'))).toBe(8)
  })
})
