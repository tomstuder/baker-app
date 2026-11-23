import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ExternalLink, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthContext, type Auth, type AuthStatus } from '@/lib/auth-context'
import { CONTENT_REPO, invalidateSnapshot, setAuthToken } from '@/lib/content'
import { verifyToken } from '@/lib/github'
import { clearVault, loadVault, openVault, saveVault, sealToken } from '@/lib/token-vault'

const MIN_PASSPHRASE = 8

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [hasVault, setHasVault] = useState(() => loadVault() !== null)
  const [dialog, setDialog] = useState<'sign-in' | 'unlock' | null>(null)

  const status: AuthStatus = token ? 'unlocked' : hasVault ? 'locked' : 'signed-out'

  const activate = useCallback((t: string) => {
    setAuthToken(t)
    invalidateSnapshot() // re-read with the token so edits show immediately
    setToken(t)
    setDialog(null)
  }, [])

  const auth = useMemo<Auth>(
    () => ({
      status,
      token,
      requestEdit: () => setDialog(loadVault() ? 'unlock' : 'sign-in'),
      lock: () => {
        setAuthToken(null)
        setToken(null)
        toast('Editing locked')
      },
      signOut: () => {
        clearVault()
        setAuthToken(null)
        setToken(null)
        setHasVault(false)
        toast('Signed out. The saved token was removed from this device.')
      },
    }),
    [status, token],
  )

  return (
    <AuthContext.Provider value={auth}>
      {children}
      <SignInDialog
        open={dialog === 'sign-in'}
        onOpenChange={(o) => setDialog(o ? 'sign-in' : null)}
        onDone={(t) => {
          setHasVault(true)
          activate(t)
          toast.success('Signed in. Edit buttons are now visible.')
        }}
      />
      <UnlockDialog
        open={dialog === 'unlock'}
        onOpenChange={(o) => setDialog(o ? 'unlock' : null)}
        onDone={activate}
        onForgot={() => {
          clearVault()
          setHasVault(false)
          setDialog('sign-in')
        }}
      />
    </AuthContext.Provider>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  ) : null
}

function SignInDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (token: string) => void }) {
  const [token, setToken] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const t = token.trim()
    if (pass.length < MIN_PASSPHRASE) return setError(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`)
    if (pass !== pass2) return setError("The passphrases don't match.")
    setBusy(true)
    try {
      await verifyToken(t)
      saveVault(await sealToken(t, pass))
      setToken('')
      setPass('')
      setPass2('')
      onDone(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-heading">Sign in to edit</DialogTitle>
            <DialogDescription>
              Edits are saved as commits to <span className="font-medium text-foreground">{CONTENT_REPO}</span> using a GitHub token that only
              you hold.
            </DialogDescription>
          </DialogHeader>

          <ol className="list-decimal space-y-1.5 rounded-lg bg-muted/60 py-3 pr-3 pl-8 text-sm">
            <li>
              Open{' '}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-4"
              >
                GitHub → new fine-grained token <ExternalLink className="size-3" />
              </a>
            </li>
            <li>Name it "Tom Studer's Bakes" and pick an expiration (90 days is a good default).</li>
            <li>
              Repository access: <b>Only select repositories</b> → <b>{CONTENT_REPO}</b>.
            </li>
            <li>
              Permissions → Repository → <b>Contents: Read and write</b>. Nothing else.
            </li>
            <li>Generate the token, copy it and paste it below.</li>
          </ol>

          <div className="space-y-2">
            <Label htmlFor="pat">Token</Label>
            <Input
              id="pat"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pass">Choose a passphrase</Label>
              <Input id="pass" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass2">Repeat passphrase</Label>
              <Input id="pass2" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The token is encrypted with your passphrase and saved only in this browser. You'll enter the passphrase each time you open the
            site to edit.
          </p>

          <ErrorText>{error}</ErrorText>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
              {busy ? 'Checking token…' : 'Sign in'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UnlockDialog({
  open,
  onOpenChange,
  onDone,
  onForgot,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: (token: string) => void
  onForgot: () => void
}) {
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const vault = loadVault()
    if (!vault) return onForgot()
    setBusy(true)
    setError('')
    try {
      const t = await openVault(vault, pass)
      setPass('')
      onDone(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-heading">Unlock editing</DialogTitle>
            <DialogDescription>Enter the passphrase you chose when you signed in on this device.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="unlock-pass">Passphrase</Label>
            <Input id="unlock-pass" type="password" autoComplete="current-password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} required />
          </div>
          <ErrorText>{error}</ErrorText>
          <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onForgot} className="text-left text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Forgot it? Sign in again with a new token
            </button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Unlock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
