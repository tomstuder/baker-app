import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

/** Renders children only while editing is unlocked; otherwise offers to sign in or unlock. */
export function EditGuard({ children }: { children: ReactNode }) {
  const { status, requestEdit } = useAuth()
  if (status === 'unlocked') return <>{children}</>
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <Lock className="mx-auto size-8 text-primary" />
      <h1 className="mt-4 text-2xl font-semibold">{status === 'locked' ? 'Editing is locked' : 'Sign in to edit'}</h1>
      <p className="mt-2 text-muted-foreground">
        {status === 'locked' ? 'Enter your passphrase to continue.' : 'Only the site owner can edit content.'}
      </p>
      <Button className="mt-6" onClick={requestEdit}>
        {status === 'locked' ? 'Unlock' : 'Sign in'}
      </Button>
    </div>
  )
}
