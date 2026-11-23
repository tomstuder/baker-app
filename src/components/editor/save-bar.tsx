import { useEffect } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Sticky bottom bar with the commit message and Save / Cancel. Warns before leaving with unsaved edits. */
export function SaveBar({
  message,
  onMessage,
  onSave,
  onCancel,
  saving,
  dirty,
  error,
}: {
  message: string
  onMessage: (m: string) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  dirty: boolean
  error?: string
}) {
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t bg-background/95 px-4 py-3 backdrop-blur">
      {error && (
        <p role="alert" className="mb-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Commit message" value={message} onChange={(e) => onMessage(e.target.value)} className="min-w-48 flex-1" />
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving || !dirty}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Saving creates a commit in the Recipes repo with this message.</p>
    </div>
  )
}
