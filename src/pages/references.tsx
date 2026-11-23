import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Download, ExternalLink, FileText, Globe, Newspaper, Pencil, Plus, Search, Video } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { ContentError } from '@/components/content-error'
import { Chip } from '@/components/filter-chip'
import { Markdown } from '@/components/markdown'
import { PageHeader } from '@/components/page-header'
import { Converter } from '@/components/references/converter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useContent } from '@/hooks/use-content'
import { assetUrl, githubFileUrl, rawUrl, resolvePath, type Snapshot } from '@/lib/content'
import { LIBRARY_PATH, loadConversions, loadGlossary, loadLibrary, loadTechniques, type GlossaryEntry, type LibraryItem, type LibraryType, type Technique } from '@/lib/references'

const TABS = ['converter', 'techniques', 'glossary', 'library'] as const
type Tab = (typeof TABS)[number]

async function load(snap: Snapshot) {
  const [volume, techniques, glossary, library] = await Promise.all([loadConversions(snap), loadTechniques(snap), loadGlossary(snap), loadLibrary(snap)])
  return { volume, techniques, glossary, library }
}

export function ReferencesPage() {
  const { data, snap, error, loading } = useContent('references', load)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'converter'

  return (
    <>
      <PageHeader title="References" description="Conversions, techniques, terms and the resources I keep coming back to." />
      {error && <ContentError error={error} />}

      <Tabs value={tab} onValueChange={(t) => setParams(t === 'converter' ? {} : { tab: t }, { replace: true })}>
        <TabsList className="mb-6 w-full sm:w-auto">
          <TabsTrigger value="converter">Converter</TabsTrigger>
          <TabsTrigger value="techniques">Techniques</TabsTrigger>
          <TabsTrigger value="glossary">Glossary</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>

        {loading || !data ? (
          !error && <Skeleton className="h-80 w-full rounded-xl" />
        ) : (
          <>
            <TabsContent value="converter">
              <EditBar to="/references/edit/conversions" label="Edit cup weights" />
              <Converter volume={data.volume} />
            </TabsContent>
            <TabsContent value="techniques">
              <EditBar to="/references/techniques/new" label="New technique" icon={<Plus />} />
              <TechniqueList items={data.techniques} snap={snap} />
            </TabsContent>
            <TabsContent value="glossary">
              <Glossary entries={data.glossary} />
            </TabsContent>
            <TabsContent value="library">
              <EditBar to="/references/edit/library" label="Edit library" />
              <Library items={data.library} snap={snap} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </>
  )
}

function EditBar({ to, label, icon = <Pencil /> }: { to: string; label: string; icon?: ReactNode }) {
  return (
    <IfEditing>
      <div className="mb-4 flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link to={to}>
            {icon}
            {label}
          </Link>
        </Button>
      </div>
    </IfEditing>
  )
}

function TechniqueList({ items, snap }: { items: Technique[]; snap?: Snapshot }) {
  if (!items.length) return <p className="text-muted-foreground">No techniques written up yet.</p>
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((t) => {
        const img = snap ? assetUrl(snap, t.path, t.image) : undefined
        return (
          <Link key={t.slug} to={`/references/techniques/${t.slug}`} className="group">
            <Card className="h-full gap-0 overflow-hidden py-0 transition-colors group-hover:border-primary/50">
              {img && <img src={img} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}
              <CardContent className="space-y-1.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg leading-snug font-semibold">{t.title}</h3>
                  {t.status === 'draft' && <Badge variant="outline">Draft</Badge>}
                </div>
                {t.summary && <p className="text-sm text-muted-foreground">{t.summary}</p>}
                {t.tags.length > 0 && <p className="text-xs text-muted-foreground">{t.tags.map((x) => `#${x}`).join('  ')}</p>}
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

function Glossary({ entries }: { entries: GlossaryEntry[] }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const shown = query ? entries.filter((e) => e.term.toLowerCase().includes(query) || e.definition.toLowerCase().includes(query)) : entries
  const letters = [...new Set(shown.map((e) => e.term[0].toUpperCase()))]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms…" aria-label="Search the glossary" className="pl-8" />
        </div>
        <span className="text-sm text-muted-foreground">
          {shown.length} of {entries.length} terms
        </span>
        <IfEditing>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link to="/references/edit/glossary">
              <Pencil />
              Edit glossary
            </Link>
          </Button>
        </IfEditing>
      </div>
      {shown.length === 0 ? (
        <p className="text-muted-foreground">{entries.length ? 'No matching terms.' : 'No terms yet.'}</p>
      ) : (
        <div className="space-y-8">
          {letters.map((letter) => (
            <section key={letter} aria-label={letter}>
              <h3 className="mb-2 border-b pb-1 font-heading text-xl font-semibold text-primary">{letter}</h3>
              <dl className="space-y-3">
                {shown
                  .filter((e) => e.term[0].toUpperCase() === letter)
                  .map((e) => (
                    <div key={e.term} id={`term-${e.term.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="grid gap-1 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
                      <dt className="font-semibold">{e.term}</dt>
                      <dd className="text-muted-foreground [&_p]:my-0 [&_p]:leading-relaxed">
                        <Markdown>{e.definition}</Markdown>
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

const TYPE_META: Record<LibraryType, { label: string; icon: typeof Globe }> = {
  website: { label: 'Websites', icon: Globe },
  video: { label: 'Videos', icon: Video },
  book: { label: 'Books', icon: BookOpen },
  article: { label: 'Articles', icon: Newspaper },
  file: { label: 'Files', icon: FileText },
}

function Library({ items, snap }: { items: LibraryItem[]; snap?: Snapshot }) {
  const [type, setType] = useState<LibraryType | null>(null)
  const types = (Object.keys(TYPE_META) as LibraryType[]).filter((t) => items.some((i) => i.type === t))
  const shown = type ? items.filter((i) => i.type === type) : items
  if (!items.length) return <p className="text-muted-foreground">Nothing in the library yet.</p>
  return (
    <div>
      {types.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          <Chip active={!type} onClick={() => setType(null)}>
            All <span className="text-muted-foreground">{items.length}</span>
          </Chip>
          {types.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(type === t ? null : t)}>
              {TYPE_META[t].label} <span className="text-muted-foreground">{items.filter((i) => i.type === t).length}</span>
            </Chip>
          ))}
        </div>
      )}
      <ul className="divide-y border-y">
        {shown.map((item, i) => (
          <li key={i}>
            <LibraryRow item={item} snap={snap} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function LibraryRow({ item, snap }: { item: LibraryItem; snap?: Snapshot }) {
  const { icon: Icon } = TYPE_META[item.type]
  const filePath = item.file ? resolvePath(LIBRARY_PATH, item.file) : undefined
  const href = item.type === 'file' && filePath ? githubFileUrl(filePath) : item.url
  const safeHref = href && /^https?:\/\//.test(href) ? href : undefined
  return (
    <div className="flex gap-4 py-4">
      <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {safeHref ? (
            <a href={safeHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary hover:underline">
              {item.title}
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
            </a>
          ) : (
            item.title
          )}
        </p>
        {item.author && <p className="text-sm text-muted-foreground">{item.author}</p>}
        {item.note && <p className="mt-1 text-sm">{item.note}</p>}
        {item.tags.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{item.tags.map((t) => `#${t}`).join('  ')}</p>}
      </div>
      {item.type === 'file' && filePath && snap?.files.has(filePath) && (
        <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${item.title}`}>
          <a href={rawUrl(snap, filePath)} download>
            <Download />
          </a>
        </Button>
      )}
    </div>
  )
}
