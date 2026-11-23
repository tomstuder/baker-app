import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, History, Pencil, Wheat } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { Stars } from '@/components/bake-log'
import { ContentError } from '@/components/content-error'
import { Markdown } from '@/components/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { assetUrl, githubFileUrl, loadDiary, type Snapshot } from '@/lib/content'
import { loadRelated, type RelatedLink } from '@/lib/related'
import { formatDate, stripLeadingTitle } from '@/lib/format'

export function DiaryPostPage() {
  const { slug = '' } = useParams()
  const { data, snap, error, loading } = useContent(`diary:${slug}`, async (s) => {
    const posts = await loadDiary(s)
    const index = posts.findIndex((p) => p.slug === slug)
    const post = posts[index]
    return {
      post,
      newer: index > 0 ? posts[index - 1] : undefined,
      older: index >= 0 ? posts[index + 1] : undefined,
      related: post ? await loadRelated(s, post.related) : [],
    }
  })

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }
  if (error) return <ContentError error={error} />
  const post = data?.post
  if (!post) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-semibold">Post not found</h1>
        <Button asChild className="mt-6">
          <Link to="/diary">All posts</Link>
        </Button>
      </div>
    )
  }

  const cover = snap ? assetUrl(snap, post.path, post.image) : undefined
  const body = stripLeadingTitle(post.body, post.title).trim()

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/diary" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Diary
      </Link>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {post.category && (
            <Link to={`/diary?category=${encodeURIComponent(post.category)}`}>
              <Badge variant="secondary">{post.category}</Badge>
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-4xl font-semibold sm:text-5xl">{post.title}</h1>
          <IfEditing>
            <Button asChild variant="outline">
              <Link to={`/diary/${post.slug}/edit`}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </IfEditing>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {post.date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> {formatDate(post.date)}
            </span>
          )}
          {post.tags.map((t) => (
            <Link key={t} to={`/diary?tag=${encodeURIComponent(t)}`} className="hover:text-primary">
              #{t}
            </Link>
          ))}
        </div>
      </header>

      {cover && <img src={cover} alt="" className="mb-8 max-h-[520px] w-full rounded-2xl object-cover" />}

      {body && (
        <Markdown file={post.path} snap={snap} className="text-[17px] leading-8 [&_img]:mx-auto">
          {body}
        </Markdown>
      )}

      {data.related.length > 0 && (
        <section aria-labelledby="related" className="mt-12">
          <h2 id="related" className="mb-4 text-xl font-semibold">
            Related
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.related.map((r) => (
              <RelatedCard key={r.ref} link={r} snap={snap} />
            ))}
          </div>
        </section>
      )}

      <nav aria-label="More posts" className="mt-12 grid grid-cols-1 gap-3 border-t pt-6 sm:grid-cols-2">
        {data.older ? (
          <Link to={`/diary/${data.older.slug}`} className="group rounded-xl border p-4 hover:border-primary/50">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowLeft className="size-3.5" /> Older
            </span>
            <span className="mt-1 block font-medium group-hover:text-primary">{data.older.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {data.newer && (
          <Link to={`/diary/${data.newer.slug}`} className="group rounded-xl border p-4 text-right hover:border-primary/50">
            <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
              Newer <ArrowRight className="size-3.5" />
            </span>
            <span className="mt-1 block font-medium group-hover:text-primary">{data.newer.title}</span>
          </Link>
        )}
      </nav>

      <footer className="mt-8 text-sm text-muted-foreground">
        <a href={githubFileUrl(post.path, 'commits')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
          <History className="size-3.5" /> Change history
        </a>
      </footer>
    </article>
  )
}

function RelatedCard({ link: { recipe, bake }, snap }: { link: RelatedLink; snap?: Snapshot }) {
  const img = snap ? (bake?.photos[0] ? assetUrl(snap, bake.path, bake.photos[0]) : assetUrl(snap, recipe.path, recipe.image)) : undefined
  const to = bake ? `/recipes/${recipe.slug}?bake=${encodeURIComponent(bake.id)}` : `/recipes/${recipe.slug}`
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/50">
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-secondary to-accent">
        {img ? <img src={img} alt="" className="size-full object-cover" /> : <Wheat className="size-6 text-primary/50" aria-hidden />}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{bake ? `Bake · ${formatDate(bake.date)}` : (recipe.category ?? 'Recipe')}</p>
        <p className="truncate font-medium group-hover:text-primary">{bake?.title ? `${recipe.title}: ${bake.title}` : recipe.title}</p>
        {bake?.rating && <Stars rating={bake.rating} className="mt-0.5 [&_svg]:size-3" />}
      </div>
    </Link>
  )
}
