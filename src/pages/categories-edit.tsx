import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, Plus, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ContentError } from '@/components/content-error'
import { EditGuard } from '@/components/editor/edit-guard'
import { SaveBar } from '@/components/editor/save-bar'
import { DragHandle, SortableRow } from '@/components/editor/sortable'
import { useDragSensors } from '@/components/editor/sortable-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { newId } from '@/lib/bakers'
import {
  CATEGORY_SECTIONS,
  CONFIG_PATH,
  affectedItems,
  categoryMoves,
  serializeConfig,
  setCategory,
  validateRows,
  type Categorized,
  type CategoryRow,
  type CategorySection,
  type RemovedCategory,
} from '@/lib/categories'
import { useAuth } from '@/lib/auth-context'
import { invalidateSnapshot, loadConfig, loadDiary, loadRecipes, readText, type Snapshot } from '@/lib/content'
import { commitFiles, type FileChange } from '@/lib/github'

const SECTION = {
  recipes: { title: 'Recipe categories', label: 'recipe', noun: ['recipe', 'recipes'] },
  diary: { title: 'Diary categories', label: 'diary', noun: ['post', 'posts'] },
} as const

const count = (n: number, s: CategorySection) => `${n} ${SECTION[s].noun[n === 1 ? 0 : 1]}`

type SectionState = { rows: CategoryRow[]; removed: RemovedCategory[] }

export function CategoriesEditPage() {
  return (
    <EditGuard>
      <Loader />
    </EditGuard>
  )
}

function Loader() {
  const { data, snap, error, loading } = useContent('categories-edit', async (s) => {
    const [configText, config, recipes, diary] = await Promise.all([readText(s, CONFIG_PATH), loadConfig(s), loadRecipes(s), loadDiary(s)])
    const strip = (x: Categorized) => ({ path: x.path, title: x.title, category: x.category })
    return { configText, lists: config.categories, items: { recipes: recipes.map(strip), diary: diary.map(strip) } }
  })
  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!data || !snap) return null
  return <CategoriesForm configText={data.configText} lists={data.lists} items={data.items} snap={snap} />
}

function CategoriesForm({
  configText,
  lists,
  items,
  snap,
}: {
  configText: string | null
  lists: Record<CategorySection, string[]>
  items: Record<CategorySection, Categorized[]>
  snap: Snapshot
}) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const back = params.get('from') === 'diary' ? '/diary' : '/recipes'
  const [state, setState] = useState<Record<CategorySection, SectionState>>(() => ({
    recipes: { rows: lists.recipes.map((name) => ({ key: newId(), name, original: name })), removed: [] },
    diary: { rows: lists.diary.map((name) => ({ key: newId(), name, original: name })), removed: [] },
  }))
  const [message, setMessage] = useState('Update categories')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  const update = (s: CategorySection, next: SectionState) => {
    setState({ ...state, [s]: next })
    setDirty(true)
    setError('')
  }

  // Everything a save would change, per section.
  const plan = useMemo(
    () =>
      Object.fromEntries(
        CATEGORY_SECTIONS.map((s) => {
          const moves = categoryMoves(state[s].rows, state[s].removed)
          return [s, { moves, affected: affectedItems(items[s], moves) }]
        }),
      ) as Record<CategorySection, { moves: Map<string, string>; affected: (Categorized & { to: string })[] }>,
    [state, items],
  )

  async function save() {
    if (!token) return
    for (const s of CATEGORY_SECTIONS) {
      const problem = validateRows(state[s].rows, SECTION[s].label)
      if (problem) return setError(problem)
    }
    setSaving(true)
    setError('')
    try {
      const changes: FileChange[] = []
      const newLists = { recipes: state.recipes.rows.map((r) => r.name.trim()), diary: state.diary.rows.map((r) => r.name.trim()) }
      const config = serializeConfig(configText, newLists)
      if (config !== configText) changes.push({ path: CONFIG_PATH, content: config })
      for (const s of CATEGORY_SECTIONS) {
        for (const it of plan[s].affected) {
          const text = await readText(snap, it.path)
          if (text === null) continue
          const next = setCategory(text, it.to)
          if (next !== text) changes.push({ path: it.path, content: next })
        }
      }
      if (!changes.length) {
        setDirty(false)
        toast('Nothing changed.')
        return navigate(back)
      }
      const res = await commitFiles({ token, changes, message: message.trim() || 'Update categories', expectedHead: snap.commit })
      invalidateSnapshot()
      setDirty(false)
      const files = changes.length - (changes[0].path === CONFIG_PATH ? 1 : 0)
      toast.success(`Saved${files ? ` with ${files} file${files === 1 ? '' : 's'} updated` : ''} · commit ${res.commitSha.slice(0, 7)}`)
      navigate(back)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const summary = CATEGORY_SECTIONS.flatMap((s) =>
    [...plan[s].moves].map(([from, to]) => {
      const n = plan[s].affected.filter((a) => a.category === from).length
      const renamed = state[s].rows.some((r) => r.original === from)
      return `${renamed ? 'Rename' : 'Move'} "${from}" → "${to}"${n ? ` (updates ${count(n, s)})` : ''}`
    }),
  )

  return (
    <div>
      <Link to={back} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {back === '/diary' ? 'Diary' : 'Recipes'}
      </Link>
      <h1 className="text-3xl font-semibold">Edit categories</h1>
      <p className="mt-1 mb-8 max-w-2xl text-muted-foreground">
        Drag the grip to reorder; the order here is the order of the filters and recipe sections. Renaming a category also updates every recipe or post
        that uses it, all in one commit. Tags need no setup.
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {(params.get('from') === 'diary' ? (['diary', 'recipes'] as const) : CATEGORY_SECTIONS).map((s) => (
          <SectionEditor key={s} section={s} value={state[s]} items={items[s]} onChange={(v) => update(s, v)} />
        ))}
      </div>

      {summary.length > 0 && (
        <div className="mt-8 rounded-lg bg-muted/60 p-4 text-sm">
          <p className="font-medium">Saving will</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <SaveBar message={message} onMessage={setMessage} onSave={save} onCancel={() => navigate(back)} saving={saving} dirty={dirty} error={error} />
    </div>
  )
}

function SectionEditor({
  section,
  value,
  items,
  onChange,
}: {
  section: CategorySection
  value: SectionState
  items: Categorized[]
  onChange: (v: SectionState) => void
}) {
  const sensors = useDragSensors()
  const [adding, setAdding] = useState('')
  const { rows, removed } = value
  const uses = (name: string) => items.filter((it) => it.category === name).length
  const meta = SECTION[section]

  // Categories used in files but missing from the list (and not already being handled here).
  const handled = new Set([...rows.map((r) => r.original), ...removed.map((r) => r.original)])
  const unlisted = [...new Set(items.map((it) => it.category).filter((c): c is string => !!c && !handled.has(c)))]

  const setRows = (next: CategoryRow[]) => onChange({ rows: next, removed })
  const patch = (key: string, name: string) => setRows(rows.map((r) => (r.key === key ? { ...r, name } : r)))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setRows(arrayMove(rows, rows.findIndex((r) => r.key === active.id), rows.findIndex((r) => r.key === over.id)))
  }
  const remove = (row: CategoryRow) => {
    const rest = rows.filter((r) => r.key !== row.key)
    // Only categories that files use need a decision; others just disappear from the list.
    const track = row.original !== undefined && uses(row.original) > 0
    onChange({
      rows: rest,
      removed: track ? [...removed, { original: row.original!, moveTo: null }] : removed,
    })
  }
  const restore = (x: RemovedCategory) => onChange({ rows: [...rows, { key: newId(), name: x.original, original: x.original }], removed: removed.filter((r) => r !== x) })
  const add = (name: string, original?: string) => {
    const n = name.trim()
    if (!n) return
    onChange({ rows: [...rows, { key: newId(), name: n, ...(original !== undefined && { original }) }], removed })
    setAdding('')
  }

  return (
    <section aria-labelledby={`cat-${section}`} className="min-w-0">
      <h2 id={`cat-${section}`} className="mb-3 text-xl font-semibold">
        {meta.title}
      </h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {rows.map((r) => {
              const n = r.original !== undefined ? uses(r.original) : 0
              const renamed = r.original !== undefined && r.name.trim() !== r.original
              return (
                <SortableRow key={r.key} id={r.key} className="rounded-lg border bg-background p-2">
                  <div className="flex items-center gap-2">
                    <DragHandle label={`Reorder ${r.name || 'category'}`} />
                    <Input aria-label={`${meta.title}: name`} value={r.name} onChange={(e) => patch(r.key, e.target.value)} className="min-w-0 flex-1" />
                    <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{r.original === undefined ? 'new' : count(n, section)}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.name || 'category'}`} onClick={() => remove(r)} className="shrink-0 text-muted-foreground">
                      <Trash2 />
                    </Button>
                  </div>
                  {renamed && <p className="mt-1 pl-8 text-xs text-muted-foreground">Renamed from "{r.original}"{n > 0 && `; ${count(n, section)} will be updated`}</p>}
                </SortableRow>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add(adding)
        }}
      >
        <Input aria-label={`New ${meta.label} category`} placeholder="New category" value={adding} onChange={(e) => setAdding(e.target.value)} className="min-w-0 flex-1" />
        <Button type="submit" variant="outline" disabled={!adding.trim()}>
          <Plus /> Add
        </Button>
      </form>

      {removed.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Removed, but still in use</p>
          {removed.map((x) => (
            <div key={x.original} className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium line-through decoration-muted-foreground">{x.original}</span>{' '}
                <span className="text-muted-foreground">· {count(uses(x.original), section)}</span>
              </span>
              <Select
                value={x.moveTo ?? 'keep'}
                onValueChange={(v) => onChange({ rows, removed: removed.map((r) => (r === x ? { ...r, moveTo: v === 'keep' ? null : v } : r)) })}
              >
                <SelectTrigger className="w-full sm:w-56" aria-label={`What to do with ${x.original} ${meta.noun[1]}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Leave them as they are</SelectItem>
                  {rows
                    .filter((r) => r.name.trim())
                    .map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        Move to {r.name.trim()}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon-sm" aria-label={`Undo removing ${x.original}`} onClick={() => restore(x)}>
                <Undo2 />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Left as they are, they still show on the site, after the listed categories.</p>
        </div>
      )}

      {unlisted.length > 0 && (
        <div className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
          <p className="font-medium">Used but not in this list</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unlisted.map((c) => (
              <Button key={c} size="sm" variant="outline" onClick={() => add(c, c)}>
                <Plus /> {c} <span className="text-muted-foreground">({count(uses(c), section)})</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
