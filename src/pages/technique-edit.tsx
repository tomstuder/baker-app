import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContentError } from '@/components/content-error'
import { EditGuard } from '@/components/editor/edit-guard'
import { Field, ImageField, MarkdownField, TextField } from '@/components/editor/fields'
import { SaveBar } from '@/components/editor/save-bar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { useAuth } from '@/lib/auth-context'
import { cacheFile, invalidateSnapshot, type Snapshot } from '@/lib/content'
import { deleteFile, putFile } from '@/lib/github'
import { TECHNIQUES_DIR, loadTechnique, newTechniquePath, serializeTechnique, type Technique } from '@/lib/references'

const today = () => new Date().toISOString().slice(0, 10)
const blank = (): Technique => ({ slug: '', path: '', title: '', tags: [], status: 'draft', created: today(), body: '' })

export function TechniqueEditPage() {
  return (
    <EditGuard>
      <Loader />
    </EditGuard>
  )
}

function Loader() {
  const { slug } = useParams()
  const { data, snap, error, loading } = useContent(`technique-edit:${slug ?? 'new'}`, (s) => (slug ? loadTechnique(s, slug) : Promise.resolve(blank())))
  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!data) return <p className="text-muted-foreground">Technique not found.</p>
  return <TechniqueForm key={slug ?? 'new'} initial={data} isNew={!slug} snap={snap} />
}

function TechniqueForm({ initial, isNew, snap }: { initial: Technique; isNew: boolean; snap?: Snapshot }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [t, setT] = useState(initial)
  const [tagsText, setTagsText] = useState(initial.tags.join(', '))
  const [message, setMessage] = useState(isNew ? '' : `Update technique: ${initial.title}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const path = isNew ? newTechniquePath(snap, t.title) : t.path
  const slug = path.split('/').pop()!.replace(/\.md$/, '')
  const sha = isNew ? undefined : snap?.files.get(t.path)
  const back = isNew ? '/references?tab=techniques' : `/references/techniques/${t.slug}`
  const update = (patch: Partial<Technique>) => {
    setT((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  async function save() {
    if (!token) return
    setError('')
    if (!t.title.trim()) return setError('Give the technique a title.')
    const item: Technique = {
      ...t,
      path,
      slug,
      tags: tagsText.split(',').map((x) => x.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean),
      body: isNew && !/^\s*#\s/.test(t.body) ? `# ${t.title.trim()}\n\n${t.body}` : t.body,
    }
    const text = serializeTechnique(item)
    setSaving(true)
    try {
      const res = await putFile({ token, path, content: text, message: message.trim() || `${isNew ? 'Add' : 'Update'} technique: ${item.title}`, sha })
      cacheFile(res.blobSha, text)
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Saved · commit ${res.commitSha.slice(0, 7)}`)
      navigate(`/references/techniques/${slug}`)
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
      const res = await deleteFile({ token, path: t.path, sha, message: `Delete technique: ${t.title}` })
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Deleted · commit ${res.commitSha.slice(0, 7)}. It's still in the git history.`)
      navigate('/references?tab=techniques')
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
        <ArrowLeft className="size-4" /> {isNew ? 'Techniques' : t.title}
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-semibold">{isNew ? 'New technique' : 'Edit technique'}</h1>
        {!isNew && (
          <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-destructive">
            <Trash2 />
            Delete
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <TextField label="Title" value={t.title} onChange={(title) => update({ title })} className="sm:col-span-2" autoFocus={isNew} hint={isNew && t.title.trim() ? `Saved as ${path}` : undefined} />
              <TextField label="Summary" value={t.summary} onChange={(summary) => update({ summary })} className="sm:col-span-2" placeholder="One line shown on the techniques list" />
              <TextField
                label="Tags"
                value={tagsText}
                onChange={(v) => {
                  setTagsText(v)
                  setDirty(true)
                }}
                placeholder="sourdough, shaping"
                hint="Separate with commas."
              />
              <Field label="Status">
                {(id) => (
                  <Select value={t.status} onValueChange={(status: Technique['status']) => update({ status })}>
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>
            <ImageField label="Cover photo (optional)" value={t.image} onChange={(image) => update({ image })} file={path} folder={`${TECHNIQUES_DIR}/images`} snap={snap} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Write-up</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownField
              value={t.body}
              onChange={(body) => update({ body })}
              file={path}
              snap={snap}
              photoFolder={`${TECHNIQUES_DIR}/images`}
              placeholder={'## What you need\n\n## Steps\n\n1. …\n\n## Tips'}
            />
          </CardContent>
        </Card>
      </div>

      <SaveBar message={message} onMessage={setMessage} onSave={save} onCancel={() => navigate(back)} saving={saving} dirty={dirty} error={error} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Delete this technique?</DialogTitle>
            <DialogDescription>"{t.title}" will be removed from References. It stays in the git history, so it can be restored.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={remove} disabled={saving}>
              <Trash2 />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
