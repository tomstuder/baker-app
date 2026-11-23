import { Link } from 'react-router-dom'
import { CalendarDays, Pencil, Plus, Star, Thermometer } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { Markdown } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { assetUrl, type Bake, type Snapshot } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { formatTemp } from '@/lib/recipe-math'
import { cn } from '@/lib/utils'

export function Stars({ rating, className }: { rating?: number; className?: string }) {
  if (!rating) return null
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-4', n <= rating ? 'fill-primary text-primary' : 'text-muted-foreground/40')} aria-hidden />
      ))}
    </span>
  )
}

export function BakeLog({ recipe, bakes, snap }: { recipe: string; bakes: Bake[]; snap?: Snapshot }) {
  const rated = bakes.filter((b) => b.rating)
  const avg = rated.length ? rated.reduce((a, b) => a + b.rating!, 0) / rated.length : undefined

  return (
    <section aria-labelledby="bake-log" className="mt-12 border-t pt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="bake-log" className="text-2xl font-semibold">
            Bake log
          </h2>
          {bakes.length > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Baked {bakes.length}× · last on {formatDate(bakes[0].date)}
              {avg !== undefined && ` · average ${avg.toFixed(1)}/5`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No bakes logged yet.</p>
          )}
        </div>
        <IfEditing>
          <Button asChild>
            <Link to={`/recipes/${recipe}/bakes/new`}>
              <Plus />
              Log a bake
            </Link>
          </Button>
        </IfEditing>
      </div>

      <ol className="space-y-4">
        {bakes.map((b) => (
          <li key={b.id}>
            <BakeCard bake={b} snap={snap} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function BakeCard({ bake: b, snap }: { bake: Bake; snap?: Snapshot }) {
  const temps = [
    ['Kitchen', b.temps.kitchen],
    ['Dough', b.temps.dough],
    ['Oven', b.temps.oven],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <Card id={`bake-${b.id}`} className="scroll-mt-20">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {formatDate(b.date)}
              {b.batch && <span>· {b.batch}</span>}
            </p>
            {b.title && <h3 className="mt-1 text-lg font-semibold">{b.title}</h3>}
          </div>
          <div className="flex items-center gap-2">
            <Stars rating={b.rating} />
            <IfEditing>
              <Button asChild variant="ghost" size="icon-sm" aria-label="Edit this bake">
                <Link to={`/recipes/${b.recipe}/bakes/${b.id}/edit`}>
                  <Pencil />
                </Link>
              </Button>
            </IfEditing>
          </div>
        </div>

        {temps.length > 0 && (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {temps.map(([label, v]) => (
              <div key={label} className="flex items-center gap-1.5">
                <Thermometer className="size-3.5 text-primary" aria-hidden />
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{formatTemp(v)}</dd>
              </div>
            ))}
          </dl>
        )}

        {(b.changes.length > 0 || b.timeline.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {b.changes.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Changes from the recipe</h4>
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {b.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {b.timeline.length > 0 && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">Timeline</h4>
                <ol className="space-y-0.5 text-sm">
                  {b.timeline.map((t, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{t.time}</span>
                      <span>{t.step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {b.photos.length > 0 && snap && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {b.photos.map((p) => {
              const url = assetUrl(snap, b.path, p)
              return (
                <a key={p} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-muted">
                  <img src={url} alt="" loading="lazy" className="size-full object-cover transition-transform hover:scale-[1.03]" />
                </a>
              )
            })}
          </div>
        )}

        {b.body.trim() && (
          <Markdown file={b.path} snap={snap} className="text-[15px]">
            {b.body}
          </Markdown>
        )}
      </CardContent>
    </Card>
  )
}
