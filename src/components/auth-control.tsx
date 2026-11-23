import { useState } from 'react'
import { Lock, LockOpen, LogOut, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/lib/auth-context'

/** Header control. Hidden for visitors; shows lock state once a token is saved on this device. */
export function AuthControl() {
  const { status, requestEdit, lock, signOut } = useAuth()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
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
          <Button variant="ghost" size="icon" aria-label="Sign out and remove the saved token" onClick={() => setConfirmSignOut(true)}>
            <LogOut />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Sign out on this device</TooltipContent>
      </Tooltip>

      <Dialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Sign out on this device?</DialogTitle>
            <DialogDescription>
              This removes the saved token from this browser. To edit here again you'll need to paste a token, and GitHub only shows a
              token once, when it's created.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Just want to hide the edit controls? Use <span className="font-medium text-foreground">Lock</span> instead. You'll only need
            your passphrase to unlock.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmSignOut(false)
                lock()
              }}
            >
              <LockOpen />
              Lock instead
            </Button>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmSignOut(false)
                signOut()
              }}
            >
              <LogOut />
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
