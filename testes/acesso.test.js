import './apoio.js'
import { describe, it, expect, beforeEach } from 'vitest'
import * as A from '../src/nucleo/acesso.js'

A.ajuste.iteracoes = 1000
beforeEach(() => { A.apagarAcesso() })

describe('senha, PIN e apelido', () => {
  it('valida senha e PIN', () => {
    expect(A.validarNovaSenha('')).toMatch(/Informe/)
    expect(A.validarNovaSenha('123')).toMatch(/pelo menos 4/)
    expect(A.validarNovaSenha('1234')).toBe('')
    expect(A.validarNovaSenha('1234567890123')).toMatch(/até 12/)
    expect(A.validarNovaSenha('abc12')).toMatch(/pelo menos 6/)
    expect(A.validarNovaSenha('abc123')).toBe('')
    expect(A.validarApelido('  ')).toMatch(/apelido/)
  })
  it('cria o acesso, guarda só o hash e entra com a senha certa', async () => {
    await A.criarSenha('ervas-do-quintal', 'Ale')
    expect(A.acesso.configurada).toBe(true)
    expect(A.acesso.apelido).toBe('Ale')
    expect(A.acesso.pin).toBe(false)
    expect(localStorage.getItem('airmed:acesso')).not.toContain('ervas-do-quintal')
    expect(await A.conferirSenha('ervas-do-quintal')).toBe(true)
    expect(await A.conferirSenha('outra-senha')).toBe(false)
  })
  it('PIN é reconhecido', async () => {
    await A.criarSenha('4821', 'Ale')
    expect(A.acesso.pin).toBe(true)
  })
  it('trocar a senha mantém a chave mestra (os backups antigos continuam abrindo)', async () => {
    await A.criarSenha('senha-antiga', 'Ale')
    const antes = [...A.chaveMestraDaSessao()]
    await expect(A.alterarSenha('errada', 'senha-nova1')).rejects.toThrow('não confere')
    await A.alterarSenha('senha-antiga', 'senha-nova1')
    expect([...A.chaveMestraDaSessao()]).toEqual(antes)
    expect(await A.conferirSenha('senha-nova1')).toBe(true)
    expect(await A.conferirSenha('senha-antiga')).toBe(false)
  })
  it('a partir da quinta tentativa errada, manda esperar', async () => {
    await A.criarSenha('senha-certa', 'Ale')
    for (let i = 0; i < 5; i++) expect(await A.verificarSenha('errada')).toBe(false)
    expect(A.esperaAteTentar()).toBeGreaterThan(0)
    await expect(A.verificarSenha('senha-certa')).rejects.toThrow('Muitas tentativas')
  })
})

describe('chave de recuperação', () => {
  it('tem 24 caracteres em grupos de 4, sem letras que confundem', () => {
    const c = A.gerarCodigo()
    expect(c).toMatch(/^([A-HJ-NP-Z2-9]{4}-){5}[A-HJ-NP-Z2-9]{4}$/)
    expect(A.codigoValido(c)).toBe(true)
    expect(A.codigoValido(c.toLowerCase().replace(/-/g, ' '))).toBe(true)
    expect(A.codigoValido('ABCD')).toBe(false)
  })
  it('esqueci a senha: a chave abre o aparelho e deixa criar senha nova, sem trocar a chave mestra', async () => {
    await A.criarSenha('senha-esquecida', 'Ale')
    const mestra = [...A.chaveMestraDaSessao()]
    const codigo = await A.gerarNovoCodigo()
    expect(A.acesso.recPendente).toBe(true)
    A.confirmarCodigoGuardado()
    expect(A.acesso.recPendente).toBe(false)
    await expect(A.entrarComCodigo('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA')).rejects.toThrow(/incorret/)
    await A.entrarComCodigo(codigo)
    await A.redefinirSenhaComCodigo('senha-nova-2')
    expect([...A.chaveMestraDaSessao()]).toEqual(mestra)
    expect(await A.conferirSenha('senha-nova-2')).toBe(true)
  })
  it('ver a chave atual pede a senha', async () => {
    await A.criarSenha('minha-senha', 'Ale')
    const codigo = await A.gerarNovoCodigo()
    await expect(A.verCodigoAtual('errada')).rejects.toThrow('incorreto')
    expect(await A.verCodigoAtual('minha-senha')).toBe(codigo)
  })
})
