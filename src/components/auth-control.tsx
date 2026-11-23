import { Lock, LockOpen, LogOut, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth-context'

/** Header control. Hidden for visitors; shows lock state once a token is saved on this device. */
export function AuthControl() {
  const { status, requestEdit, lock, signOut } = useAuth()
  if (status === 'signed-out') return null
  if (status === 'locked') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Unlock editing" onClick={requestEdit}>
            <Lock />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Unlock editing</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <div className="flex items-center">
      <span className="mr-1 hidden items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary sm:inline-flex">
        <PencilLine className="size-3" /> Editing
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Lock editing" onClick={lock}>
            <LockOpen />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Lock editing</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Sign out and remove the saved token" onClick={signOut}>
            <LogOut />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Sign out on this device</TooltipContent>
      </Tooltip>
    </div>
  )
}

/** Small footer link so the owner can sign in on a new device. */
export function OwnerSignIn() {
  const { status, requestEdit } = useAuth()
  if (status === 'unlocked') return null
  return (
    <button type="button" onClick={requestEdit} className="underline-offset-4 hover:text-foreground hover:underline">
      {status === 'locked' ? 'Unlock editing' : 'Owner sign-in'}
    </button>
  )
}

/** Renders children only while editing is unlocked. */
export function IfEditing({ children }: { children: React.ReactNode }) {
  return useAuth().status === 'unlocked' ? <>{children}</> : null
}
