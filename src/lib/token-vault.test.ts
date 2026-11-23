import { describe, expect, it } from 'vitest'
import { WrongPassphraseError, openVault, sealToken } from './token-vault'

describe('token vault', () => {
  it('round-trips a token with the right passphrase', async () => {
    const vault = await sealToken('github_pat_example', 'correct horse battery')
    expect(vault.data).not.toContain('github_pat_example')
    expect(await openVault(vault, 'correct horse battery')).toBe('github_pat_example')
  })

  it('rejects the wrong passphrase', async () => {
    const vault = await sealToken('github_pat_example', 'correct horse battery')
    await expect(openVault(vault, 'wrong')).rejects.toBeInstanceOf(WrongPassphraseError)
  })

  it('uses a fresh salt and IV each time', async () => {
    const a = await sealToken('t', 'p')
    const b = await sealToken('t', 'p')
    expect(a.salt).not.toBe(b.salt)
    expect(a.iv).not.toBe(b.iv)
  })
})
