import { Link, useSearchParams } from 'react-router-dom'
import { NotebookPen, Plus, Tags, X } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { ContentError } from '@/components/content-error'
import { Chip } from '@/components/filter-chip'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { assetUrl, loadConfig, loadDiary, type DiaryPost, type Snapshot } from '@/lib/content'
import { formatDate } from '@/lib/format'

async function load(snap: Snapshot) {
  const [config, posts] = await Promise.all([loadConfig(snap), loadDiary(snap)])
  return { categories: config.categories.diary, posts }
}

export function DiaryPage() {
  const { data, snap, error, loading } = useContent('diary', load)
  const [params, setParams] = useSearchParams()
  const category = params.get('category')
  const tag = params.get('tag')

  const posts = data?.posts ?? []
  const used = [...new Set(posts.map((p) => p.category).filter((c): c is string => !!c))]
  const categories = [...(data?.categories ?? []).filter((c) => used.includes(c)), ...used.filter((c) => !data?.categories.includes(c))]
  const visible = posts.filter((p) => (!category || p.category === category) && (!tag || p.tags.includes(tag)))

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="Journal" description="Notes from the kitchen: what I baked, tried and learned.">
        <IfEditing>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/edit/categories?from=journal">
                <Tags />
                Categories
              </Link>
            </Button>
            <Button asChild>
              <Link to="/journal/new">
                <Plus />
                New post
              </Link>
            </Button>
          </div>
        </IfEditing>
      </PageHeader>

      {error && <ContentError error={error} />}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : (
        data && (
          <>
            {categories.length > 1 && (
              <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
                <Chip active={!category} onClick={() => set('category', null)}>
                  All <span className="text-muted-foreground">{posts.length}</span>
                </Chip>
                {categories.map((c) => (
                  <Chip key={c} active={category === c} onClick={() => set('category', category === c ? null : c)}>
                    {c} <span className="text-muted-foreground">{posts.filter((p) => p.category === c).length}</span>
                  </Chip>
                ))}
              </div>
            )}

            {tag && (
              <div className="mb-6 flex items-center gap-2 text-sm">
                Tagged <span className="font-medium">#{tag}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Clear tag filter" onClick={() => set('tag', null)}>
                  <X />
                </Button>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
                <NotebookPen className="mx-auto mb-3 size-8 text-primary/60" />
                No posts yet. The first one is on its way.
              </div>
            ) : visible.length === 0 ? (
              <p className="text-muted-foreground">No posts match.</p>
            ) : (
              <ol className="divide-y border-y">
                {visible.map((p) => (
                  <li key={p.slug}>
                    <PostRow post={p} snap={snap} />
                  </li>
                ))}
              </ol>
            )}
          </>
        )
      )}
    </>
  )
}

function PostRow({ post: p, snap }: { post: DiaryPost; snap?: Snapshot }) {
  const cover = snap ? assetUrl(snap, p.path, p.image) : undefined
  return (
    <Link to={`/journal/${p.slug}`} className="group flex gap-5 py-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">
          {[p.date && formatDate(p.date), p.category].filter(Boolean).join(' · ')}
        </p>
        <h2 className="mt-1 text-xl font-semibold group-hover:text-primary sm:text-2xl">{p.title}</h2>
        {p.excerpt && <p className="mt-2 line-clamp-2 text-muted-foreground">{p.excerpt}</p>}
        {p.tags.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{p.tags.map((t) => `#${t}`).join('  ')}</p>}
      </div>
      {cover && (
        <img src={cover} alt="" loading="lazy" className="hidden size-28 shrink-0 rounded-lg object-cover sm:block md:size-36" />
      )}
    </Link>
  )
}
