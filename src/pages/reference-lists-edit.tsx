import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, FileUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContentError } from '@/components/content-error'
import { EditGuard } from '@/components/editor/edit-guard'
import { SaveBar } from '@/components/editor/save-bar'
import { DragHandle, SortableRow } from '@/components/editor/sortable'
import { useDragSensors, withKey } from '@/components/editor/sortable-utils'
import { NumberInput } from '@/components/number-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useContent } from '@/hooks/use-content'
import { useAuth } from '@/lib/auth-context'
import { cacheFile, invalidateSnapshot, type Snapshot } from '@/lib/content'
import { putFile } from '@/lib/github'
import {
  CONVERSIONS_PATH,
  FILES_DIR,
  GLOSSARY_PATH,
  LIBRARY_PATH,
  LIBRARY_TYPES,
  VOLUME_UNITS,
  loadConversions,
  loadGlossary,
  loadLibrary,
  serializeConversions,
  serializeGlossary,
  serializeLibrary,
  type GlossaryEntry,
  type LibraryItem,
  type LibraryType,
  type VolumeUnit,
  type VolumeWeight,
} from '@/lib/references'
import { slugify } from '@/lib/serialize'

const LISTS = {
  glossary: { title: 'Edit glossary', path: GLOSSARY_PATH, tab: 'glossary' },
  library: { title: 'Edit library', path: LIBRARY_PATH, tab: 'library' },
  conversions: { title: 'Edit cup weights', path: CONVERSIONS_PATH, tab: 'converter' },
} as const
type ListName = keyof typeof LISTS

export function ReferenceListEditPage() {
  return (
    <EditGuard>
      <Loader />
    </EditGuard>
  )
}

function Loader() {
  const list = useParams().list as ListName
  const meta = LISTS[list]
  const { data, snap, error, loading } = useContent(`ref-edit:${list}`, async (s) => ({
    glossary: list === 'glossary' ? await loadGlossary(s) : [],
    library: list === 'library' ? await loadLibrary(s) : [],
    conversions: list === 'conversions' ? await loadConversions(s) : [],
  }))
  if (!meta) return <p className="text-muted-foreground">Unknown list.</p>
  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!data) return null
  if (list === 'glossary') return <GlossaryForm initial={data.glossary} snap={snap} />
  if (list === 'library') return <LibraryForm initial={data.library} snap={snap} />
  return <ConversionsForm initial={data.conversions} snap={snap} />
}

/** Shared page frame + save logic for the three list editors. */
function useListSave(list: ListName, snap: Snapshot | undefined) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const meta = LISTS[list]
  const [message, setMessage] = useState(`Update ${list}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const back = `/references?tab=${meta.tab}`

  async function save(text: string) {
    if (!token) return
    setSaving(true)
    setError('')
    try {
      const res = await putFile({ token, path: meta.path, content: text, message: message.trim() || `Update ${list}`, sha: snap?.files.get(meta.path) })
      cacheFile(res.blobSha, text)
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Saved · commit ${res.commitSha.slice(0, 7)}`)
      navigate(back)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const frame = (description: ReactNode, children: ReactNode, onSave: () => void) => (
    <div>
      <Link to={back} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> References
      </Link>
      <h1 className="text-3xl font-semibold">{meta.title}</h1>
      <p className="mt-1 mb-8 text-muted-foreground">{description}</p>
      {children}
      <SaveBar message={message} onMessage={setMessage} onSave={onSave} onCancel={() => navigate(back)} saving={saving} dirty={dirty} error={error} />
    </div>
  )
  return { save, frame, markDirty: () => setDirty(true), setError }
}

function RowButtons({ onRemove, label }: { onRemove: () => void; label: string }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={onRemove} className="shrink-0 text-muted-foreground">
      <Trash2 />
    </Button>
  )
}

// ---------- Glossary ----------

function GlossaryForm({ initial, snap }: { initial: GlossaryEntry[]; snap?: Snapshot }) {
  const [rows, setRows] = useState(() => initial.map(withKey))
  const { save, frame, markDirty, setError } = useListSave('glossary', snap)
  const set = (next: typeof rows) => {
    setRows(next)
    markDirty()
  }
  const patch = (key: string, p: Partial<GlossaryEntry>) => set(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))

  return frame(
    'Terms are sorted A–Z when you save. Definitions can use Markdown (**bold**, *italic*, links).',
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => set([withKey({ term: '', definition: '' }), ...rows])}
      >
        <Plus /> Add term
      </Button>
      {rows.map((r) => (
        <div key={r.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-start">
          <Input aria-label="Term" placeholder="Term" value={r.term} onChange={(e) => patch(r.key, { term: e.target.value })} className="font-medium" />
          <Textarea aria-label={`Definition of ${r.term || 'new term'}`} placeholder="Definition" value={r.definition} onChange={(e) => patch(r.key, { definition: e.target.value })} className="min-h-16" />
          <RowButtons label={r.term || 'term'} onRemove={() => set(rows.filter((x) => x.key !== r.key))} />
        </div>
      ))}
    </div>,
    () => {
      const terms = rows.map((r) => r.term.trim().toLowerCase()).filter(Boolean)
      const dup = terms.find((t, i) => terms.indexOf(t) !== i)
      if (dup) return setError(`"${dup}" is listed twice.`)
      void save(serializeGlossary(rows))
    },
  )
}

// ---------- Library ----------

const TYPE_LABEL: Record<LibraryType, string> = { website: 'Website', video: 'Video', book: 'Book', article: 'Article', file: 'File' }
const MAX_FILE_MB = 25

function LibraryForm({ initial, snap }: { initial: LibraryItem[]; snap?: Snapshot }) {
  const [rows, setRows] = useState(() => initial.map(withKey))
  const [tagsText, setTagsText] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, r.tags.join(', ')])))
  const { save, frame, markDirty, setError } = useListSave('library', snap)
  const sensors = useDragSensors()
  const set = (next: typeof rows) => {
    setRows(next)
    markDirty()
  }
  const patch = (key: string, p: Partial<LibraryItem>) => set(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    set(arrayMove(rows, rows.findIndex((r) => r.key === active.id), rows.findIndex((r) => r.key === over.id)))
  }

  return frame(
    'Drag the grip to reorder. Files (PDFs, images) are uploaded to the Recipes repo as soon as you pick them.',
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const row = withKey<LibraryItem>({ type: 'website', title: '', tags: [] })
          set([...rows, row])
        }}
      >
        <Plus /> Add item
      </Button>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          {rows.map((r) => (
            <SortableRow key={r.key} id={r.key} className="rounded-lg border bg-background p-3">
              <div className="flex items-start gap-2">
                <DragHandle label={`Reorder ${r.title || 'item'}`} />
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[130px_minmax(0,1fr)]">
                  <Select value={r.type} onValueChange={(type: LibraryType) => patch(r.key, { type })}>
                    <SelectTrigger className="w-full" aria-label="Type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIBRARY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input aria-label="Title" placeholder="Title" value={r.title} onChange={(e) => patch(r.key, { title: e.target.value })} className="font-medium" />
                  <div className="sm:col-span-2">
                    {r.type === 'file' ? (
                      <FileUpload value={r.file} onChange={(file, title) => patch(r.key, { file, ...(title && !r.title && { title }) })} />
                    ) : (
                      <Input aria-label="Link" type="url" placeholder={r.type === 'book' ? 'Link (optional)' : 'https://…'} value={r.url ?? ''} onChange={(e) => patch(r.key, { url: e.target.value })} />
                    )}
                  </div>
                  <Input aria-label="Author or source" placeholder="Author or source (optional)" value={r.author ?? ''} onChange={(e) => patch(r.key, { author: e.target.value })} />
                  <Input
                    aria-label="Tags"
                    placeholder="Tags, comma separated"
                    value={tagsText[r.key] ?? ''}
                    onChange={(e) => {
                      setTagsText({ ...tagsText, [r.key]: e.target.value })
                      patch(r.key, { tags: e.target.value.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean) })
                    }}
                  />
                  <Input aria-label="Note" placeholder="Note (optional)" value={r.note ?? ''} onChange={(e) => patch(r.key, { note: e.target.value })} className="sm:col-span-2" />
                </div>
                <RowButtons label={r.title || 'item'} onRemove={() => set(rows.filter((x) => x.key !== r.key))} />
              </div>
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
    </div>,
    () => {
      const bad = rows.find((r) => r.title.trim() && r.type !== 'file' && r.url?.trim() && !/^https?:\/\//.test(r.url.trim()))
      if (bad) return setError(`The link for "${bad.title}" should start with https://`)
      const noFile = rows.find((r) => r.title.trim() && r.type === 'file' && !r.file)
      if (noFile) return setError(`Upload a file for "${noFile.title}", or change its type.`)
      void save(serializeLibrary(rows))
    },
  )
}

function FileUpload({ value, onChange }: { value?: string; onChange: (file: string, title?: string) => void }) {
  const { token } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(f: File) {
    if (!token) return
    setError('')
    if (f.size > MAX_FILE_MB * 1024 * 1024) return setError(`That file is over ${MAX_FILE_MB} MB. Try compressing it first.`)
    setBusy(true)
    try {
      const ext = (f.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? 'bin').toLowerCase()
      const base = slugify(f.name.replace(/\.[^.]+$/, '')) || 'file'
      const repoPath = `${FILES_DIR}/${new Date().toISOString().slice(0, 10)}-${base}.${ext}`
      await putFile({ token, path: repoPath, content: new Uint8Array(await f.arrayBuffer()), message: `Add file ${repoPath}` })
      onChange(repoPath.replace(/^references\//, ''), f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
        {busy ? 'Uploading…' : value ? 'Replace file' : 'Upload file'}
      </Button>
      {value && <span className="truncate text-xs text-muted-foreground">{value}</span>}
      <input
        ref={input}
        type="file"
        accept=".pdf,image/*,.txt,.md,.csv,.xlsx,.docx"
        className="hidden"
        aria-label="Upload file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void upload(f)
        }}
      />
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ---------- Conversions ----------

function ConversionsForm({ initial, snap }: { initial: VolumeWeight[]; snap?: Snapshot }) {
  const [rows, setRows] = useState(() => initial.map(withKey))
  const { save, frame, markDirty } = useListSave('conversions', snap)
  const sensors = useDragSensors()
  const set = (next: typeof rows) => {
    setRows(next)
    markDirty()
  }
  const patch = (key: string, p: Partial<VolumeWeight>) => set(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    set(arrayMove(rows, rows.findIndex((r) => r.key === active.id), rows.findIndex((r) => r.key === over.id)))
  }

  return frame(
    'Weight of one cup, tablespoon or teaspoon of each ingredient. Weigh your own scoop to make these match how you measure.',
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          {rows.map((r) => (
            <SortableRow key={r.key} id={r.key} className="flex items-center gap-2 rounded-lg bg-background">
              <DragHandle label={`Reorder ${r.name || 'row'}`} />
              <Input aria-label="Ingredient" placeholder="Ingredient" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} className="min-w-0 flex-1" />
              <span className="text-sm text-muted-foreground">1</span>
              <Select value={r.unit} onValueChange={(unit: VolumeUnit) => patch(r.key, { unit })}>
                <SelectTrigger className="w-20" aria-label="Unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VOLUME_UNITS) as VolumeUnit[]).map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">=</span>
              <NumberInput aria-label="Grams" value={r.grams} onChange={(grams) => patch(r.key, { grams })} suffix="g" className="w-24 shrink-0" />
              <RowButtons label={r.name || 'row'} onRemove={() => set(rows.filter((x) => x.key !== r.key))} />
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
      <Button variant="ghost" size="sm" className="text-primary" onClick={() => set([...rows, withKey<VolumeWeight>({ name: '', unit: 'cup', grams: Number.NaN })])}>
        <Plus /> Add ingredient
      </Button>
    </div>,
    () => void save(serializeConversions(rows)),
  )
}
