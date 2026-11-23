import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useContent } from '@/hooks/use-content'
import { useAuth } from '@/lib/auth-context'
import { invalidateSnapshot, loadDiary, loadHome, recipeFiles, type Recipe } from '@/lib/content'
import { deletePaths } from '@/lib/github'

export function DeleteRecipeDialog({ open, onOpenChange, recipe, onDeleted }: { open: boolean; onOpenChange: (o: boolean) => void; recipe: Recipe; onDeleted?: () => void }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data, loading } = useContent(open ? `delete:${recipe.slug}` : 'delete:closed', async (snap) => {
    if (!open) return null
    const [diary, home] = await Promise.all([loadDiary(snap), loadHome(snap)])
    return {
      files: recipeFiles(snap, recipe.slug),
      mentions: diary.filter((p) => p.related.some((r) => r === recipe.slug || r.startsWith(`${recipe.slug}/`))).map((p) => p.title),
      featured: home.featured.includes(recipe.slug),
    }
  })

  const needsTyping = (data?.files.bakes.length ?? 0) > 0
  const confirmed = !needsTyping || typed.trim().toLowerCase() === recipe.title.trim().toLowerCase()

  async function remove() {
    if (!token || !data) return
    setBusy(true)
    setError('')
    try {
      const res = await deletePaths({ token, paths: data.files.all, message: `Delete recipe: ${recipe.title}` })
      invalidateSnapshot()
      onDeleted?.()
      onOpenChange(false)
      toast.success(`Deleted "${recipe.title}" · commit ${res.commitSha.slice(0, 7)}. It's still in the git history.`)
      navigate('/recipes')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Delete "{recipe.title}"?</DialogTitle>
          <DialogDescription>This removes the recipe's whole folder from the Recipes repo in one commit.</DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <Loader2 className="mx-auto my-6 size-6 animate-spin text-primary" />
        ) : (
          <div className="space-y-4 text-sm">
            <ul className="list-disc space-y-1 pl-5">
              <li>The recipe</li>
              {data.files.bakes.length > 0 && <li>{plural(data.files.bakes.length, 'logged bake')}</li>}
              {data.files.photos.length > 0 && <li>{plural(data.files.photos.length, 'photo')}</li>}
            </ul>
            {(data.mentions.length > 0 || data.featured) && (
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="font-medium">Links that will disappear</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {data.featured && <li>Featured on the home page</li>}
                  {data.mentions.map((t) => (
                    <li key={t}>Journal: {t}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-muted-foreground">Everything stays in the repo's git history, so it can be restored from GitHub if needed.</p>
            {needsTyping && (
              <div className="space-y-1.5">
                <Label htmlFor="confirm-title">
                  Type <span className="font-semibold">{recipe.title}</span> to confirm
                </Label>
                <Input id="confirm-title" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
              </div>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={remove} disabled={busy || !data || !confirmed}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete recipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
