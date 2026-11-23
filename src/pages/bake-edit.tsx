import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContentError } from '@/components/content-error'
import { EditGuard } from '@/components/editor/edit-guard'
import { MarkdownField, PhotosField, TextField } from '@/components/editor/fields'
import { SaveBar } from '@/components/editor/save-bar'
import { DragHandle, SortableRow } from '@/components/editor/sortable'
import { useDragSensors, withKey } from '@/components/editor/sortable-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useContent } from '@/hooks/use-content'
import { useAuth } from '@/lib/auth-context'
import { cacheFile, invalidateSnapshot, loadBake, loadRecipe, newBakePath, type Bake, type Recipe, type Snapshot } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { deleteFile, putFile } from '@/lib/github'
import { serializeBake } from '@/lib/serialize'
import { cn } from '@/lib/utils'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function blankBake(recipe: Recipe): Bake {
  return {
    id: '',
    path: '',
    recipe: recipe.slug,
    date: today(),
    batch: recipe.yield,
    changes: [],
    temps: { oven: recipe.oven },
    timeline: [withKey({ time: '', step: '' })],
    photos: [],
    body: '',
  }
}

export function BakeEditPage() {
  return (
    <EditGuard>
      <BakeEditLoader />
    </EditGuard>
  )
}

function BakeEditLoader() {
  const { slug = '', bake: bakeId } = useParams()
  const { data, snap, error, loading } = useContent(`bake-edit:${slug}:${bakeId ?? 'new'}`, async (s) => {
    const recipe = await loadRecipe(s, slug)
    const bake = recipe && bakeId ? await loadBake(s, slug, bakeId) : recipe ? blankBake(recipe) : null
    return { recipe, bake }
  })
  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!data?.recipe || !data.bake) return <p className="text-muted-foreground">{data?.recipe ? 'Bake not found.' : 'Recipe not found.'}</p>
  return <BakeForm key={bakeId ?? 'new'} recipe={data.recipe} initial={data.bake} isNew={!bakeId} snap={snap} />
}

function BakeForm({ recipe, initial, isNew, snap }: { recipe: Recipe; initial: Bake; isNew: boolean; snap?: Snapshot }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [b, setB] = useState<Bake>(() => ({ ...initial, timeline: initial.timeline.map(withKey) }))
  const sensors = useDragSensors()
  const [changesText, setChangesText] = useState(initial.changes.join('\n'))
  const [message, setMessage] = useState(isNew ? '' : `Update bake ${initial.date} of ${recipe.title}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(isNew)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // New bakes get their file name when first saved; photos go in the recipe's images folder.
  const path = isNew ? newBakePath(snap, recipe.slug, b.date || today(), b.title) : b.path
  const back = `/recipes/${recipe.slug}`
  const sha = isNew ? undefined : snap?.files.get(b.path)

  const update = (patch: Partial<Bake>) => {
    setB((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }
  const setStep = (i: number, patch: Partial<Bake['timeline'][number]>) =>
    update({ timeline: b.timeline.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= b.timeline.length || from === to) return
    update({ timeline: arrayMove(b.timeline, from, to) })
  }
  const onStepDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    moveStep(
      b.timeline.findIndex((t) => t.key === active.id),
      b.timeline.findIndex((t) => t.key === over.id),
    )
  }

  async function save() {
    if (!token) return
    setError('')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return setError('Pick the date you baked.')
    const bake: Bake = { ...b, path, changes: changesText.split('\n').map((c) => c.trim()).filter(Boolean) }
    const text = serializeBake(bake)
    setSaving(true)
    try {
      const res = await putFile({
        token,
        path,
        content: text,
        message: message.trim() || `Log bake of ${recipe.title} (${formatDate(bake.date)})`,
        sha,
      })
      cacheFile(res.blobSha, text)
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Bake saved · commit ${res.commitSha.slice(0, 7)}`)
      navigate(back)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!token || !sha) return
    setSaving(true)
    try {
      const res = await deleteFile({ token, path: b.path, sha, message: `Delete bake ${b.date} of ${recipe.title}` })
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Bake deleted · commit ${res.commitSha.slice(0, 7)}. It's still in the git history.`)
      navigate(back)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link to={back} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {recipe.title}
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{isNew ? 'Log a bake' : 'Edit bake'}</h1>
          <p className="mt-1 text-muted-foreground">{recipe.title}</p>
        </div>
        {!isNew && (
          <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-destructive">
            <Trash2 />
            Delete bake
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>The bake</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <TextField label="Date" type="date" value={b.date} onChange={(date) => update({ date })} />
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <RatingInput value={b.rating} onChange={(rating) => update({ rating })} />
            </div>
            <TextField label="Title (optional)" value={b.title} onChange={(title) => update({ title })} placeholder="e.g. 78% hydration test" />
            <TextField label="Batch" value={b.batch} onChange={(batch) => update({ batch })} placeholder="2 loaves (900 g each)" />
            <TextField label="Kitchen temperature" value={b.temps.kitchen} onChange={(kitchen) => update({ temps: { ...b.temps, kitchen } })} placeholder="72°F" />
            <TextField label="Final dough temperature" value={b.temps.dough} onChange={(dough) => update({ temps: { ...b.temps, dough } })} placeholder="78°F" />
            <TextField label="Oven" value={b.temps.oven} onChange={(oven) => update({ temps: { ...b.temps, oven } })} placeholder="475°F" hint="Temperatures show in °F and °C." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changes from the recipe</CardTitle>
            <CardDescription>What you did differently this time, one per line.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              aria-label="Changes, one per line"
              value={changesText}
              onChange={(e) => {
                setChangesText(e.target.value)
                setDirty(true)
              }}
              placeholder={'Water 75% → 78%\nBulk fermentation 30 min longer'}
              className="min-h-24"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>Optional. Times as you like them: "08:00", "Day 2 9am", "+45 min".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
              <SortableContext items={b.timeline.map((t) => t.key!)} strategy={verticalListSortingStrategy}>
                {b.timeline.map((t, i) => (
                  <SortableRow key={t.key} id={t.key!} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-background pb-2 sm:flex-nowrap sm:pb-0">
                    <DragHandle label={`Reorder step ${i + 1}`} />
                    <Input aria-label="Time" value={t.time} onChange={(e) => setStep(i, { time: e.target.value })} placeholder="08:00" className="w-28 shrink-0" />
                    <Input aria-label="Step" value={t.step} onChange={(e) => setStep(i, { step: e.target.value })} placeholder="Build levain" className="order-last ml-7.5 min-w-0 basis-full sm:order-none sm:ml-0 sm:basis-auto sm:flex-1" />
                    <div className="ml-auto flex shrink-0 sm:ml-0">
                      <Button variant="ghost" size="icon-sm" aria-label="Move step up" disabled={i === 0} onClick={() => moveStep(i, i - 1)}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Move step down" disabled={i === b.timeline.length - 1} onClick={() => moveStep(i, i + 1)}>
                        <ArrowDown />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label="Remove step" onClick={() => update({ timeline: b.timeline.filter((_, j) => j !== i) })} className="shrink-0 text-muted-foreground">
                      <Trash2 />
                    </Button>
                  </SortableRow>
                ))}
              </SortableContext>
            </DndContext>
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => update({ timeline: [...b.timeline, withKey({ time: '', step: '' })] })}>
              <Plus /> Add step
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotosField label="Crumb, crust, anything worth remembering" value={b.photos} onChange={(photos) => update({ photos })} file={path} folder={`recipes/${recipe.slug}/images`} snap={snap} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownField value={b.body} onChange={(body) => update({ body })} file={path} snap={snap} placeholder="How did it go? Crumb, crust, flavor, what to try next time." photoFolder={`recipes/${recipe.slug}/images`} />
          </CardContent>
        </Card>
      </div>

      <SaveBar message={message} onMessage={setMessage} onSave={save} onCancel={() => navigate(back)} saving={saving} dirty={dirty} error={error} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Delete this bake?</DialogTitle>
            <DialogDescription>
              The {formatDate(b.date)} bake will be removed from the log. It stays in the Recipes repo's git history, so it can be restored. Its photos
              are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={remove} disabled={saving}>
              <Trash2 />
              Delete bake
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RatingInput({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="flex h-8 items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 5`}
          onClick={() => onChange(value === n ? undefined : n)}
          className="rounded p-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Star className={cn('size-6 transition-colors', value && n <= value ? 'fill-primary text-primary' : 'text-muted-foreground/40 hover:text-primary/60')} />
        </button>
      ))}
      {value && <span className="ml-2 text-sm text-muted-foreground">{value}/5</span>}
    </div>
  )
}
