import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Link2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ContentError } from '@/components/content-error'
import { EditGuard } from '@/components/editor/edit-guard'
import { Field, ImageField, MarkdownField, TextField } from '@/components/editor/fields'
import { SaveBar } from '@/components/editor/save-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { useAuth } from '@/lib/auth-context'
import {
  bakeCounts,
  cacheFile,
  invalidateSnapshot,
  loadBakes,
  loadConfig,
  loadDiaryPost,
  loadRecipes,
  newDiaryPath,
  type Bake,
  type DiaryPost,
  type Recipe,
  type Snapshot,
} from '@/lib/content'
import { formatDate } from '@/lib/format'
import { deleteFile, putFile } from '@/lib/github'
import { serializeDiary } from '@/lib/serialize'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function blankPost(): DiaryPost {
  return { slug: '', path: '', title: '', date: today(), tags: [], related: [], excerpt: '', body: '' }
}

type Linkable = { recipe: Recipe; bakes: Bake[] }

export function DiaryEditPage() {
  return (
    <EditGuard>
      <DiaryEditLoader />
    </EditGuard>
  )
}

function DiaryEditLoader() {
  const { slug } = useParams()
  const { data, snap, error, loading } = useContent(`diary-edit:${slug ?? 'new'}`, async (s) => {
    const [post, config, recipes] = await Promise.all([slug ? loadDiaryPost(s, slug) : Promise.resolve(blankPost()), loadConfig(s), loadRecipes(s)])
    const counts = bakeCounts(s)
    const linkable: Linkable[] = await Promise.all(recipes.map(async (recipe) => ({ recipe, bakes: counts.get(recipe.slug) ? await loadBakes(s, recipe.slug) : [] })))
    return { post, categories: config.categories.diary, linkable }
  })
  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!data?.post) return <p className="text-muted-foreground">Post not found.</p>
  return <DiaryForm key={slug ?? 'new'} initial={data.post} isNew={!slug} categories={data.categories} linkable={data.linkable} snap={snap} />
}

function DiaryForm({
  initial,
  isNew,
  categories,
  linkable,
  snap,
}: {
  initial: DiaryPost
  isNew: boolean
  categories: string[]
  linkable: Linkable[]
  snap?: Snapshot
}) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [p, setP] = useState<DiaryPost>(initial)
  const [tagsText, setTagsText] = useState(initial.tags.join(', '))
  const [message, setMessage] = useState(isNew ? '' : `Update journal: ${initial.title}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const path = isNew ? newDiaryPath(snap, p.date || today(), p.title) : p.path
  const slug = path.replace(/^diary\//, '').replace(/\.md$/, '')
  const sha = isNew ? undefined : snap?.files.get(p.path)
  const categoryOptions = p.category && !categories.includes(p.category) ? [...categories, p.category] : categories

  const update = (patch: Partial<DiaryPost>) => {
    setP((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const labelFor = (ref: string) => {
    const [s, b] = ref.split('/')
    const l = linkable.find((x) => x.recipe.slug === s)
    if (!l) return ref
    if (!b) return l.recipe.title
    const bake = l.bakes.find((x) => x.id === b)
    return bake ? `${l.recipe.title} · bake ${formatDate(bake.date)}${bake.title ? ` (${bake.title})` : ''}` : ref
  }

  async function save() {
    if (!token) return
    setError('')
    if (!p.title.trim()) return setError('Give the post a title.')
    if (!p.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return setError('Pick a date.')
    if (!p.category) return setError('Choose a category.')
    const post: DiaryPost = {
      ...p,
      path,
      slug,
      tags: tagsText.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean),
      body: isNew && !/^\s*#\s/.test(p.body) ? `# ${p.title.trim()}\n\n${p.body}` : p.body,
    }
    const text = serializeDiary(post)
    setSaving(true)
    try {
      const res = await putFile({ token, path, content: text, message: message.trim() || `${isNew ? 'Add' : 'Update'} journal: ${post.title}`, sha })
      cacheFile(res.blobSha, text)
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Saved · commit ${res.commitSha.slice(0, 7)}`)
      navigate(`/journal/${slug}`)
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
      const res = await deleteFile({ token, path: p.path, sha, message: `Delete journal: ${p.title}` })
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Post deleted · commit ${res.commitSha.slice(0, 7)}. It's still in the git history.`)
      navigate('/journal')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConfirmDelete(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link to={isNew ? '/journal' : `/journal/${p.slug}`} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {isNew ? 'Journal' : p.title}
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">{isNew ? 'New journal post' : 'Edit post'}</h1>
        {!isNew && (
          <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-destructive">
            <Trash2 />
            Delete post
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Post</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <TextField
                label="Title"
                value={p.title}
                onChange={(title) => update({ title })}
                className="sm:col-span-2"
                autoFocus={isNew}
                hint={isNew && p.title.trim() ? `Saved as ${path}` : undefined}
              />
              <TextField label="Date" type="date" value={p.date} onChange={(date) => update({ date })} />
              <Field label="Category">
                {(id) => (
                  <Select value={p.category ?? ''} onValueChange={(category) => update({ category })}>
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <TextField
                label="Tags"
                value={tagsText}
                onChange={(v) => {
                  setTagsText(v)
                  setDirty(true)
                }}
                placeholder="rye, starter, holiday"
                hint="Separate with commas."
                className="sm:col-span-2"
              />
            </div>
            <ImageField label="Cover photo (optional)" value={p.image} onChange={(image) => update({ image })} file={path} folder="diary/images" snap={snap} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Text</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownField
              value={p.body}
              onChange={(body) => update({ body })}
              file={path}
              snap={snap}
              photoFolder="diary/images"
              placeholder={'What happened in the kitchen today?\n\nUse "Insert photo" to place pictures in the text.'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Related recipes and bakes</CardTitle>
            <CardDescription>Shown as links at the end of the post.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.related.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {p.related.map((ref) => (
                  <li key={ref} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pr-1 pl-3 text-sm">
                    <Link2 className="size-3.5 text-primary" aria-hidden />
                    {labelFor(ref)}
                    <Button variant="ghost" size="icon-xs" aria-label={`Remove link to ${labelFor(ref)}`} onClick={() => update({ related: p.related.filter((r) => r !== ref) })}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Select value="" onValueChange={(ref) => ref && !p.related.includes(ref) && update({ related: [...p.related, ref] })}>
              <SelectTrigger className="w-full sm:w-96" aria-label="Link a recipe or bake">
                <SelectValue placeholder="Link a recipe or bake…" />
              </SelectTrigger>
              <SelectContent>
                {linkable.map(({ recipe, bakes }) => (
                  <SelectGroup key={recipe.slug}>
                    <SelectLabel>{recipe.title}</SelectLabel>
                    <SelectItem value={recipe.slug} disabled={p.related.includes(recipe.slug)}>
                      Recipe: {recipe.title}
                    </SelectItem>
                    {bakes.map((b) => (
                      <SelectItem key={b.id} value={`${recipe.slug}/${b.id}`} disabled={p.related.includes(`${recipe.slug}/${b.id}`)}>
                        Bake: {formatDate(b.date)}
                        {b.title ? ` · ${b.title}` : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <SaveBar message={message} onMessage={setMessage} onSave={save} onCancel={() => navigate(isNew ? '/journal' : `/journal/${p.slug}`)} saving={saving} dirty={dirty} error={error} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Delete this post?</DialogTitle>
            <DialogDescription>"{p.title}" will be removed from the journal. It stays in the Recipes repo's git history, so it can be restored. Its photos are kept.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={remove} disabled={saving}>
              <Trash2 />
              Delete post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
