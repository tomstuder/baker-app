import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, History, Pencil } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { ContentError } from '@/components/content-error'
import { Markdown } from '@/components/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { assetUrl, githubFileUrl } from '@/lib/content'
import { formatDate, stripLeadingTitle } from '@/lib/format'
import { loadTechnique } from '@/lib/references'

export function TechniquePage() {
  const { slug = '' } = useParams()
  const { data: t, snap, error, loading } = useContent(`technique:${slug}`, (s) => loadTechnique(s, slug))

  if (loading) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />
  if (error) return <ContentError error={error} />
  if (!t) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-semibold">Technique not found</h1>
        <Button asChild className="mt-6">
          <Link to="/references?tab=techniques">All techniques</Link>
        </Button>
      </div>
    )
  }
  const cover = snap ? assetUrl(snap, t.path, t.image) : undefined
  const body = stripLeadingTitle(t.body, t.title).trim()
  const placeholder = /^_?not written yet\._?$/i.test(body)

  return (
    <article className="mx-auto max-w-3xl">
      <Link to="/references?tab=techniques" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Techniques
      </Link>
      <header className="mb-8">
        {t.status === 'draft' && (
          <Badge variant="outline" className="mb-3">
            Draft
          </Badge>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-4xl font-semibold">{t.title}</h1>
          <IfEditing>
            <Button asChild variant="outline">
              <Link to={`/references/techniques/${t.slug}/edit`}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </IfEditing>
        </div>
        {t.summary && <p className="mt-3 text-lg text-muted-foreground">{t.summary}</p>}
        {t.tags.length > 0 && <p className="mt-3 text-sm text-muted-foreground">{t.tags.map((x) => `#${x}`).join('  ')}</p>}
      </header>
      {cover && <img src={cover} alt="" className="mb-8 max-h-[480px] w-full rounded-2xl object-cover" />}
      {body && !placeholder ? (
        <Markdown file={t.path} snap={snap} className="text-[17px] leading-8 [&_img]:mx-auto">
          {body}
        </Markdown>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-muted-foreground">Not written yet.</p>
      )}
      <footer className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm text-muted-foreground">
        {t.created && <span>Added {formatDate(t.created)}</span>}
        <a href={githubFileUrl(t.path, 'commits')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
          <History className="size-3.5" /> Change history
        </a>
      </footer>
    </article>
  )
}
