import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ContentError } from '@/components/content-error'
import { EditGuard } from '@/components/editor/edit-guard'
import { Field, ImageField, MarkdownField, TextField } from '@/components/editor/fields'
import { IngredientEditor } from '@/components/editor/ingredient-editor'
import { SaveBar } from '@/components/editor/save-bar'
import { withKey } from '@/components/editor/sortable-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useContent } from '@/hooks/use-content'
import { useAuth } from '@/lib/auth-context'
import { cacheFile, invalidateSnapshot, loadConfig, loadRecipe, type Recipe, type Snapshot } from '@/lib/content'
import { putFile } from '@/lib/github'
import { serializeRecipe, slugify } from '@/lib/serialize'

const today = () => new Date().toISOString().slice(0, 10)

function blankRecipe(): Recipe {
  return {
    slug: '',
    path: '',
    title: '',
    category: undefined,
    tags: [],
    status: 'draft',
    created: today(),
    time: {},
    equipment: [],
    ingredients: [{ group: '', items: [{ name: '', flour: true }, { name: 'Water', water: 100 }, { name: 'Salt' }] }],
    body: '## Method\n\n1. \n',
  }
}

export function RecipeEditPage() {
  return (
    <EditGuard>
      <RecipeEditLoader />
    </EditGuard>
  )
}

function RecipeEditLoader() {
  const { slug } = useParams()
  const isNew = !slug
  const { data, snap, error, loading } = useContent(`recipe-edit:${slug ?? 'new'}`, async (s) => {
    const [recipe, config] = await Promise.all([slug ? loadRecipe(s, slug) : Promise.resolve(blankRecipe()), loadConfig(s)])
    return { recipe, categories: config.categories.recipes }
  })

  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!data?.recipe) return <p className="text-muted-foreground">Recipe not found.</p>
  return (
    <RecipeForm
      key={slug ?? 'new'}
      initial={data.recipe}
      categories={data.categories}
      isNew={isNew}
      snap={snap}
      sha={snap && !isNew ? snap.files.get(data.recipe.path) : undefined}
    />
  )
}

function RecipeForm({ initial, categories, isNew, snap, sha }: { initial: Recipe; categories: string[]; isNew: boolean; snap?: Snapshot; sha?: string }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [r, setR] = useState<Recipe>(() => ({ ...initial, ingredients: initial.ingredients.map((g) => withKey({ ...g, items: g.items.map(withKey) })) }))
  const [tagsText, setTagsText] = useState(initial.tags.join(', '))
  const [equipmentText, setEquipmentText] = useState(initial.equipment.join('\n'))
  const [message, setMessage] = useState(isNew ? '' : `Update ${initial.title}`)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  const slug = isNew ? slugify(r.title) : r.slug
  const path = `recipes/${slug}/recipe.md`
  const categoryOptions = r.category && !categories.includes(r.category) ? [...categories, r.category] : categories

  const update = (patch: Partial<Recipe>) => {
    setR((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  async function save() {
    if (!token) return
    setError('')
    if (!r.title.trim()) return setError('Give the recipe a title.')
    if (!slug) return setError('The title needs at least one letter or number.')
    if (!r.category) return setError('Choose a category.')
    if (isNew && snap?.files.has(path)) return setError(`There's already a recipe saved as ${path}. Choose a different title.`)
    const recipe: Recipe = {
      ...r,
      slug,
      path,
      tags: tagsText.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean),
      equipment: equipmentText.split('\n').map((e) => e.trim()).filter(Boolean),
      body: isNew && !/^\s*#\s/.test(r.body) ? `# ${r.title.trim()}\n\n${r.body}` : r.body,
    }
    const text = serializeRecipe(recipe)
    setSaving(true)
    try {
      const res = await putFile({ token, path, content: text, message: message.trim() || `${isNew ? 'Add' : 'Update'} ${recipe.title}`, sha })
      cacheFile(res.blobSha, text)
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Saved · commit ${res.commitSha.slice(0, 7)}`)
      navigate(`/recipes/${slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link to={isNew ? '/recipes' : `/recipes/${r.slug}`} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {isNew ? 'Recipes' : r.title}
      </Link>
      <h1 className="mb-8 text-3xl font-semibold">{isNew ? 'New recipe' : `Edit ${initial.title}`}</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <TextField
                label="Title"
                value={r.title}
                onChange={(title) => update({ title })}
                className="sm:col-span-2"
                hint={isNew && slug ? `Saved as recipes/${slug}/recipe.md` : undefined}
                autoFocus={isNew}
              />
              <Field label="Category">
                {(id) => (
                  <Select value={r.category ?? ''} onValueChange={(category) => update({ category })}>
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
              <Field label="Status">
                {(id) => (
                  <Select value={r.status} onValueChange={(status: Recipe['status']) => update({ status })}>
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="testing">Testing</SelectItem>
                      <SelectItem value="tested">Tested</SelectItem>
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
                placeholder="sourdough, rye, holiday"
                hint="Separate with commas."
                className="sm:col-span-2"
              />
              <TextField label="Yield" value={r.yield} onChange={(v) => update({ yield: v })} placeholder="2 loaves (~900 g each)" />
              <TextField label="Servings" value={r.servings} onChange={(v) => update({ servings: v })} placeholder="12 slices" />
              <TextField label="Prep time" value={r.time.prep} onChange={(v) => update({ time: { ...r.time, prep: v } })} placeholder="30 min" />
              <TextField label="Rise / proof" value={r.time.rise} onChange={(v) => update({ time: { ...r.time, rise: v } })} placeholder="4–5 h" />
              <TextField label="Bake time" value={r.time.bake} onChange={(v) => update({ time: { ...r.time, bake: v } })} placeholder="45 min" />
              <TextField label="Oven" value={r.oven} onChange={(v) => update({ oven: v })} placeholder="450°F" hint="Shown in °F and °C." />
              <TextField label="Created" type="date" value={r.created} onChange={(v) => update({ created: v })} />
              <TextField label="Source link" value={r.source} onChange={(v) => update({ source: v })} placeholder="https://…" type="url" />
            </div>
            <ImageField
              label="Photo"
              value={r.image}
              onChange={(image) => update({ image })}
              file={path}
              folder={`recipes/${slug}/images`}
              snap={snap}
              disabled={!slug}
              disabledHint="Add a title first."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <CardDescription>
              Grams drive scaling and baker's %. Mark flours as <b>Flour</b> (they add up to 100%) and starters, levains or poolish as{' '}
              <b>Preferment</b>. Percentages are recalculated when you save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IngredientEditor groups={r.ingredients} onChange={(ingredients) => update({ ingredients })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Method &amp; notes</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownField value={r.body} onChange={(body) => update({ body })} file={path} snap={snap} placeholder={'## Method\n\n1. Mix…'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              aria-label="Equipment, one per line"
              value={equipmentText}
              onChange={(e) => {
                setEquipmentText(e.target.value)
                setDirty(true)
              }}
              placeholder={'Dutch oven\nBanneton'}
              className="min-h-28"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">One item per line.</p>
          </CardContent>
        </Card>
      </div>

      <SaveBar
        message={message}
        onMessage={setMessage}
        onSave={save}
        onCancel={() => navigate(isNew ? '/recipes' : `/recipes/${r.slug}`)}
        saving={saving}
        dirty={dirty}
        error={error}
      />
    </div>
  )
}
