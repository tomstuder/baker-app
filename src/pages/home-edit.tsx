import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { ContentError } from '@/components/content-error'
import { EditGuard } from '@/components/editor/edit-guard'
import { ImageField, MarkdownField, TextField } from '@/components/editor/fields'
import { SaveBar } from '@/components/editor/save-bar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { useAuth } from '@/lib/auth-context'
import { cacheFile, invalidateSnapshot, loadHome, loadRecipes, type Home, type Recipe, type Snapshot } from '@/lib/content'
import { putFile } from '@/lib/github'
import { serializeHome } from '@/lib/serialize'

const MAX_FEATURED = 3

export function HomeEditPage() {
  return (
    <EditGuard>
      <HomeEditLoader />
    </EditGuard>
  )
}

function HomeEditLoader() {
  const { data, snap, error, loading } = useContent('home-edit', async (s) => {
    const [home, recipes] = await Promise.all([loadHome(s), loadRecipes(s)])
    return { home, recipes }
  })
  if (loading) return <Skeleton className="h-96 w-full rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!data) return null
  return <HomeForm initial={data.home} recipes={data.recipes} snap={snap} sha={snap?.files.get('home.md')} />
}

function HomeForm({ initial, recipes, snap, sha }: { initial: Home; recipes: Recipe[]; snap?: Snapshot; sha?: string }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [h, setH] = useState<Home>(initial)
  const [message, setMessage] = useState('Update home page')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  const update = (patch: Partial<Home>) => {
    setH((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }
  const setSocial = (key: keyof Home['social'], v: string) => update({ social: { ...h.social, [key]: v } })

  async function save() {
    if (!token) return
    setError('')
    if (!h.name.trim()) return setError('Add your name.')
    const bad = Object.entries(h.social).find(([, v]) => v && !/^https:\/\//.test(v))
    if (bad) return setError(`The ${bad[0]} link should start with https://`)
    const text = serializeHome(h)
    setSaving(true)
    try {
      const res = await putFile({ token, path: 'home.md', content: text, message: message.trim() || 'Update home page', sha })
      cacheFile(res.blobSha, text)
      invalidateSnapshot()
      setDirty(false)
      toast.success(`Saved · commit ${res.commitSha.slice(0, 7)}`)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Home
      </Link>
      <h1 className="mb-8 text-3xl font-semibold">Edit home page</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Name" value={h.name} onChange={(name) => update({ name })} />
              <TextField label="Tagline" value={h.tagline} onChange={(tagline) => update({ tagline })} placeholder="Home baker · sourdough and more" />
            </div>
            <MarkdownField value={h.body} onChange={(body) => update({ body })} file="home.md" snap={snap} placeholder="A short overview about you and your baking." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Photos are resized in your browser before upload. Each upload is its own commit.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_200px]">
            <ImageField label="Main photo (your breads)" value={h.hero} onChange={(hero) => update({ hero })} file="home.md" folder="images/home" snap={snap} aspect="aspect-[4/3]" />
            <ImageField label="Portrait (optional)" value={h.portrait} onChange={(portrait) => update({ portrait })} file="home.md" folder="images/home" snap={snap} aspect="aspect-square" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Featured recipes</CardTitle>
            <CardDescription>Pick up to {MAX_FEATURED}, in the order to show them. Tested recipes fill any empty spots.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {recipes.map((r) => {
              const index = h.featured.indexOf(r.slug)
              const checked = index >= 0
              const full = !checked && h.featured.length >= MAX_FEATURED
              return (
                <label key={r.slug} className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${full ? 'opacity-50' : 'cursor-pointer hover:border-primary/50'}`}>
                  <Checkbox
                    checked={checked}
                    disabled={full}
                    onCheckedChange={(c) => update({ featured: c ? [...h.featured, r.slug] : h.featured.filter((s) => s !== r.slug) })}
                  />
                  <span className="flex-1">
                    <span className="font-medium">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.category}
                      {r.status !== 'tested' && ` · ${r.status}`}
                    </span>
                  </span>
                  {checked && <span className="text-xs font-semibold text-primary tabular-nums">#{index + 1}</span>}
                </label>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Social links</CardTitle>
            <CardDescription>Leave a field empty to hide that icon.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <TextField label="Instagram" type="url" value={h.social.instagram} onChange={(v) => setSocial('instagram', v)} placeholder="https://www.instagram.com/…" />
            <TextField label="LinkedIn" type="url" value={h.social.linkedin} onChange={(v) => setSocial('linkedin', v)} placeholder="https://www.linkedin.com/in/…" />
            <TextField label="Facebook" type="url" value={h.social.facebook} onChange={(v) => setSocial('facebook', v)} placeholder="https://www.facebook.com/…" />
          </CardContent>
        </Card>
      </div>

      <SaveBar message={message} onMessage={setMessage} onSave={save} onCancel={() => navigate('/')} saving={saving} dirty={dirty} error={error} />
    </div>
  )
}
