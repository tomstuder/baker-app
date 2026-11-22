import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ContentError({ error }: { error: Error }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <AlertCircle className="size-4 text-destructive" />
        Couldn't load content
      </div>
      <p className="text-muted-foreground">{error.message}</p>
      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  )
}
