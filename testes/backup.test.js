import './apoio.js'
import { describe, it, expect, beforeEach } from 'vitest'
import * as A from '../src/nucleo/acesso.js'
import { empacotar, abrirBackup, lerEnvelope, nomeDoArquivo, diasSemBackup, backupDevido } from '../src/nucleo/backup.js'

A.ajuste.iteracoes = 1000
const dados = { versao: 1, remedios: [{ id: 'r1', nome: 'Ervalina' }], rotinas: [], registros: [], perfil: { apelido: 'Ale' } }
let codigo
beforeEach(async () => {
  A.apagarAcesso()
  await A.criarSenha('senha-de-acesso', 'Ale')
  codigo = await A.gerarNovoCodigo()
})

describe('backup trancado pela chave mestra', () => {
  it('abre com a senha de acesso', async () => {
    const r = await abrirBackup(await empacotar(dados), 'senha-de-acesso')
    expect(r.dados).toEqual(dados)
    expect(r.pelaChave).toBe(false)
    expect([...r.mestra]).toEqual([...A.chaveMestraDaSessao()])
  })
  it('abre com a chave de recuperação', async () => {
    const r = await abrirBackup(await empacotar(dados), codigo.toLowerCase())
    expect(r.dados).toEqual(dados)
    expect(r.pelaChave).toBe(true)
  })
  it('não abre com senha errada', async () => {
    await expect(abrirBackup(await empacotar(dados), 'senha-errada')).rejects.toThrow('incorreta')
  })
  it('por fora não aparece remédio, apelido nem senha', async () => {
    const texto = await empacotar(dados)
    for (const t of ['Ervalina', 'Ale', 'remedios', 'senha-de-acesso', codigo]) expect(texto).not.toContain(t)
    expect(Object.keys(JSON.parse(texto)).sort()).toEqual(['airmed', 'compressao', 'criado_em', 'criptografia', 'dados'])
  })
  it('backup antigo continua abrindo depois de trocar a senha (com a senha da época ou com a chave)', async () => {
    const texto = await empacotar(dados)
    await A.alterarSenha('senha-de-acesso', 'senha-trocada')
    expect((await abrirBackup(texto, 'senha-de-acesso')).dados).toEqual(dados)
    expect((await abrirBackup(texto, codigo)).dados).toEqual(dados)
    await expect(abrirBackup(texto, 'senha-trocada')).rejects.toThrow('incorreta')
    expect((await abrirBackup(await empacotar(dados), 'senha-trocada')).dados).toEqual(dados)
  })
  it('aparelho novo adota a mesma chave mestra e a mesma chave de recuperação', async () => {
    const texto = await empacotar(dados)
    A.apagarAcesso()
    const r = await abrirBackup(texto, codigo)
    A.adotarMestra(r.mestra, r.rec)
    await A.criarSenha('senha-do-aparelho-novo', r.dados.perfil.apelido)
    A.aplicarRecAdotado()
    expect(A.acesso.recPendente).toBe(false)
    await A.entrarComCodigo(codigo)
    expect((await abrirBackup(texto, codigo)).dados).toEqual(dados)
    expect((await abrirBackup(await empacotar(dados), 'senha-do-aparelho-novo')).dados).toEqual(dados)
  })
  it('arquivo mexido é recusado', async () => {
    const env = JSON.parse(await empacotar(dados))
    env.dados = env.dados.slice(0, -6) + 'AAAAA='
    await expect(abrirBackup(JSON.stringify(env), 'senha-de-acesso')).rejects.toThrow('corrompido')
  })
  it('sem acesso desbloqueado não faz backup', async () => {
    A.apagarAcesso()
    await expect(empacotar(dados)).rejects.toThrow('Desbloqueie')
  })
  it('recusa arquivo qualquer, versão mais nova e conteúdo fora do formato', async () => {
    expect(() => lerEnvelope('lista de compras')).toThrow('não é um backup')
    expect(() => lerEnvelope('{"a":1}')).toThrow('não é um backup')
    expect(() => lerEnvelope('{"airmed":2,"dados":"x"}')).toThrow('versão mais nova')
    await expect(abrirBackup(await empacotar({ versao: 1, remedios: 'x' }), 'senha-de-acesso')).rejects.toThrow('formato esperado')
  })
})

describe('formato antigo (versão de teste 0.2)', () => {
  it('ainda abre com a senha própria do backup', async () => {
    const enc = new TextEncoder()
    const sal = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12))
    const base = await crypto.subtle.importKey('raw', enc.encode('senha-do-backup'), 'PBKDF2', false, ['deriveKey'])
    const k = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 1000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt'])
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(dados)))
    const texto = JSON.stringify({ formato: 'airmed-backup', versao: 1, criadoEm: '2026-11-16T10:00:00.000Z', kdf: { nome: 'PBKDF2', hash: 'SHA-256', iteracoes: 1000, sal: A.b64(sal) }, cifra: { nome: 'AES-GCM', iv: A.b64(iv) }, dados: A.b64(ct) })
    const r = await abrirBackup(texto, 'senha-do-backup')
    expect(r.dados).toEqual(dados)
    expect(r.mestra).toBe(null)
    await expect(abrirBackup(texto, 'errada')).rejects.toThrow('Senha errada')
  })
})

describe('nome e lembrete', () => {
  it('nome do arquivo com data e hora', () => {
    expect(nomeDoArquivo(new Date('2026-11-16T10:05:00'))).toBe('airmed-backup-2026-11-16-1005.txt')
  })
  it('dias sem backup', () => {
    expect(diasSemBackup(null)).toBe(null)
    expect(diasSemBackup('2026-11-16T12:00:05', new Date('2026-11-16T12:00:00'))).toBe(0)
    expect(diasSemBackup('2026-11-08T10:00:00', new Date('2026-11-16T12:00:00'))).toBe(8)
  })
  it('lembrete segue o intervalo escolhido', () => {
    const agora = new Date('2026-11-16T12:00:00')
    expect(backupDevido({ intervalo: 'semanal', ultimo: '2026-11-10T12:00:00' }, agora)).toBe(false)
    expect(backupDevido({ intervalo: 'semanal', ultimo: '2026-11-09T11:00:00' }, agora)).toBe(true)
    expect(backupDevido({ intervalo: 'diario', ultimo: '2026-11-15T11:00:00' }, agora)).toBe(true)
    expect(backupDevido({ intervalo: 'desligado', ultimo: null }, agora)).toBe(false)
    expect(backupDevido({ intervalo: 'semanal', ultimo: null, desde: '2026-11-14T12:00:00' }, agora)).toBe(false)
    expect(backupDevido({ intervalo: 'semanal', ultimo: null, desde: '2026-11-01T12:00:00' }, agora)).toBe(true)
  })
})
