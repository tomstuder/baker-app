import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calculator, Clock, ExternalLink, History, Minus, Pencil, Plus, Thermometer, Users, UtensilsCrossed } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { ContentError } from '@/components/content-error'
import { Markdown } from '@/components/markdown'
import { StatusBadge } from '@/components/recipe-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useContent } from '@/hooks/use-content'
import { formatGrams, formatPct } from '@/lib/bakers'
import { BakeLog } from '@/components/bake-log'
import { assetUrl, githubFileUrl, loadBakes, loadRecipe, type Recipe } from '@/lib/content'
import { formatDate, stripLeadingTitle } from '@/lib/format'
import { formatOven, itemPct, recipeStats, recipeToFormula } from '@/lib/recipe-math'

export function RecipePage() {
  const { slug = '' } = useParams()
  const { data, snap, error, loading } = useContent(`recipe:${slug}`, async (s) => {
    const [recipe, bakes] = await Promise.all([loadRecipe(s, slug), loadBakes(s, slug)])
    return { recipe, bakes }
  })
  const recipe = data?.recipe
  const navigate = useNavigate()
  const [batch, setBatch] = useState(1)

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (error) return <ContentError error={error} />
  if (!recipe) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-semibold">Recipe not found</h1>
        <Button asChild className="mt-6">
          <Link to="/recipes">All recipes</Link>
        </Button>
      </div>
    )
  }

  const stats = recipeStats(recipe)
  const formula = recipeToFormula(recipe)
  const image = snap ? assetUrl(snap, recipe.path, recipe.image) : undefined
  const body = stripLeadingTitle(recipe.body, recipe.title).trim()
  const hasIngredients = recipe.ingredients.some((g) => g.items.length)

  return (
    <article>
      <Link to="/recipes" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Recipes
      </Link>

      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {recipe.category && (
            <Link to={`/recipes?category=${encodeURIComponent(recipe.category)}`}>
              <Badge variant="secondary">{recipe.category}</Badge>
            </Link>
          )}
          <StatusBadge status={recipe.status} />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-4xl font-semibold">{recipe.title}</h1>
          <IfEditing>
            <Button asChild variant="outline">
              <Link to={`/recipes/${recipe.slug}/edit`}>
                <Pencil />
                Edit
              </Link>
            </Button>
          </IfEditing>
        </div>
        {recipe.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {recipe.tags.map((t) => (
              <li key={t}>
                <Link to={`/recipes?tag=${encodeURIComponent(t)}`} className="text-muted-foreground hover:text-primary">
                  #{t}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Meta recipe={recipe} />
      </header>

      {image && <img src={image} alt={recipe.title} className="mb-8 max-h-[480px] w-full rounded-2xl object-cover" />}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6 lg:sticky lg:top-20">
          {hasIngredients ? (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-2xl">Ingredients</CardTitle>
                <CardAction>
                  <BatchStepper value={batch} onChange={setBatch} />
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-24 text-right font-mono text-xs tracking-wider uppercase">Grams</TableHead>
                      <TableHead className="font-mono text-xs tracking-wider uppercase">Ingredient</TableHead>
                      <TableHead className="w-14 text-right font-mono text-xs tracking-wider uppercase">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  {recipe.ingredients.map((g, gi) => (
                    <TableBody key={gi}>
                      {(g.group || g.note) && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={3} className="pt-5 whitespace-normal">
                            {g.group && <span className="block font-heading text-base font-semibold">{g.group}</span>}
                            {g.note && <span className="block text-xs text-muted-foreground">{g.note}</span>}
                          </TableCell>
                        </TableRow>
                      )}
                      {g.items.map((i, ii) => {
                        const pct = stats.base > 0 ? itemPct(i, stats.base) : undefined
                        return (
                          <TableRow key={ii} className="hover:bg-transparent">
                            <TableCell className="py-3 text-right align-top font-mono text-primary tabular-nums">
                              {i.grams !== undefined ? (
                                <span title={i.estimated ? 'Estimated weight' : undefined}>
                                  {i.estimated && '~'}
                                  {formatGrams(i.grams * batch)} g
                                </span>
                              ) : i.amount ? (
                                <span className="whitespace-normal" title={batch !== 1 ? 'Not scaled: no weight given' : undefined}>
                                  {i.amount}
                                  {batch !== 1 && <span className="text-muted-foreground"> ×{batch}</span>}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 align-top whitespace-normal">
                              <span className={i.flour ? 'font-medium' : undefined}>{i.name}</span>
                              {((i.amount && i.grams !== undefined && batch === 1) || i.note) && (
                                <span className="block text-xs text-muted-foreground">
                                  {[i.grams !== undefined && batch === 1 && i.amount, i.note].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 text-right align-top font-mono text-xs text-muted-foreground tabular-nums">
                              {pct !== undefined ? formatPct(pct) : ''}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  ))}
                </Table>

                {stats.base > 0 && (
                  <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted p-4 font-mono text-sm">
                    <Stat label="Hydration" value={`${formatPct(stats.hydration)}%`} />
                    <Stat label="Flour" value={`${formatGrams(stats.flour * batch)} g`} />
                    <Stat label="Total" value={`${formatGrams(stats.total * batch)} g`} />
                  </dl>
                )}
                {recipe.ingredients.some((g) => g.items.some((i) => i.estimated)) && (
                  <p className="text-xs text-muted-foreground">~ marks an estimated weight.</p>
                )}

                {formula && (
                  <Button variant="outline" className="w-full" onClick={() => navigate('/calculator', { state: { ...formula, source: recipe.slug } })}>
                    <Calculator />
                    Scale in calculator
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}

          {recipe.equipment.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-primary" /> Equipment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {recipe.equipment.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0">
          {recipe.status === 'draft' && !hasIngredients && (
            <p className="mb-4 rounded-lg border border-dashed p-4 text-muted-foreground">This recipe is still a draft.</p>
          )}
          {body && !/^_?not written yet\._?$/i.test(body) && (
            <Markdown file={recipe.path} snap={snap}>
              {body}
            </Markdown>
          )}
        </div>
      </div>

      <BakeLog recipe={recipe.slug} bakes={data?.bakes ?? []} snap={snap} />

      <footer className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-6 text-sm text-muted-foreground">
        {recipe.created && <span>Added {formatDate(recipe.created)}</span>}
        {recipe.source && /^https?:\/\//.test(recipe.source) && (
          <a href={recipe.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
            Original source <ExternalLink className="size-3.5" />
          </a>
        )}
        <a href={githubFileUrl(recipe.path, 'commits')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
          <History className="size-3.5" /> Change history
        </a>
      </footer>
    </article>
  )
}

function Meta({ recipe }: { recipe: Recipe }) {
  const items = [
    recipe.yield && { icon: Users, label: 'Yield', value: recipe.servings ? `${recipe.yield} · ${recipe.servings}` : recipe.yield },
    !recipe.yield && recipe.servings && { icon: Users, label: 'Serves', value: recipe.servings },
    ...Object.entries(recipe.time).map(([k, v]) => ({ icon: Clock, label: k[0].toUpperCase() + k.slice(1), value: v })),
    recipe.oven && { icon: Thermometer, label: 'Oven', value: formatOven(recipe.oven)! },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string }[]
  if (!items.length) return null
  return (
    <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden />
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

const BATCHES = [0.5, 1, 1.5, 2, 3, 4]

/** Multiplies the recipe's weights for this view only (the recipe itself is unchanged). */
function BatchStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const i = BATCHES.indexOf(value)
  return (
    <div className="flex items-center rounded-full border bg-background" role="group" aria-label="Batch size">
      <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Smaller batch" disabled={i <= 0} onClick={() => onChange(BATCHES[i - 1])}>
        <Minus />
      </Button>
      <div className="min-w-16 border-x px-2 text-center leading-tight" aria-live="polite">
        <span className="block font-mono text-sm">{value}×</span>
        <span className="block font-mono text-[0.625rem] tracking-widest text-muted-foreground uppercase">batch</span>
      </div>
      <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Larger batch" disabled={i >= BATCHES.length - 1} onClick={() => onChange(BATCHES[i + 1])}>
        <Plus />
      </Button>
    </div>
  )
}
