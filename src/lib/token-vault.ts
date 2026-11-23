/**
 * Keeps the GitHub token encrypted at rest in this browser.
 *
 * The token is encrypted with AES-GCM using a key derived from the owner's passphrase (PBKDF2,
 * SHA-256, 600k iterations, random salt). Only the ciphertext is stored; the plain token lives in
 * memory while unlocked and is forgotten on reload or "Lock".
 */

const VAULT_KEY = 'auth:vault:v1'
const ITERATIONS = 600_000

export type Vault = { v: 1; salt: string; iv: string; data: string; savedAt: string }

const enc = new TextEncoder()
const dec = new TextDecoder()

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sealToken(token: string, passphrase: string): Promise<Vault> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)))
  return { v: 1, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data), savedAt: new Date().toISOString() }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase doesn't match.")
  }
}

export async function openVault(vault: Vault, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromBase64(vault.salt))
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(vault.iv) }, key, fromBase64(vault.data))
    return dec.decode(plain)
  } catch {
    throw new WrongPassphraseError()
  }
}

export function loadVault(): Vault | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    const v = raw ? (JSON.parse(raw) as Vault) : null
    return v?.v === 1 && v.salt && v.iv && v.data ? v : null
  } catch {
    return null
  }
}

export function saveVault(vault: Vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault))
}

export function clearVault() {
  try {
    localStorage.removeItem(VAULT_KEY)
  } catch {
    /* ignore */
  }
}
