import { createContext, useContext } from 'react'

/**
 * signed-out: no token saved on this device (visitors, or the owner on a new device)
 * locked:     an encrypted token is saved here; the passphrase is needed to edit
 * unlocked:   the token is decrypted in memory and edit controls are shown
 */
export type AuthStatus = 'signed-out' | 'locked' | 'unlocked'

export type Auth = {
  status: AuthStatus
  token: string | null
  /** Open the sign-in or unlock dialog, whichever applies. */
  requestEdit: () => void
  lock: () => void
  signOut: () => void
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
