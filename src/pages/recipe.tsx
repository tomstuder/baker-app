import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calculator, Clock, ExternalLink, History, Pencil, Thermometer, Users, UtensilsCrossed } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { ContentError } from '@/components/content-error'
import { Markdown } from '@/components/markdown'
import { StatusBadge } from '@/components/recipe-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
                <CardTitle>Ingredients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingredient</TableHead>
                      <TableHead className="text-right">Grams</TableHead>
                      <TableHead className="w-14 text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  {recipe.ingredients.map((g, gi) => (
                    <TableBody key={gi}>
                      {(g.group || g.note) && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={3} className="pt-5 whitespace-normal">
                            {g.group && <span className="block text-sm font-semibold">{g.group}</span>}
                            {g.note && <span className="block text-xs text-muted-foreground">{g.note}</span>}
                          </TableCell>
                        </TableRow>
                      )}
                      {g.items.map((i, ii) => {
                        const pct = stats.base > 0 ? itemPct(i, stats.base) : undefined
                        return (
                          <TableRow key={ii}>
                            <TableCell className="whitespace-normal">
                              <span className={i.flour ? 'font-medium' : undefined}>{i.name}</span>
                              {(i.amount || i.note) && (
                                <span className="block text-xs text-muted-foreground">{[i.amount, i.note].filter(Boolean).join(' · ')}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {i.grams !== undefined ? (
                                <span title={i.estimated ? 'Estimated weight' : undefined}>
                                  {i.estimated && '~'}
                                  {formatGrams(i.grams)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">{pct !== undefined ? formatPct(pct) : ''}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  ))}
                </Table>

                {stats.base > 0 && (
                  <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                    <Stat label="Hydration" value={`${formatPct(stats.hydration)}%`} />
                    <Stat label="Flour (total)" value={`${formatGrams(stats.flour)} g`} />
                    <Stat label="Total weight" value={`${formatGrams(stats.total)} g`} />
                  </dl>
                )}
                {recipe.ingredients.some((g) => g.items.some((i) => i.estimated)) && (
                  <p className="text-xs text-muted-foreground">~ marks an estimated weight.</p>
                )}

                {formula && (
                  <Button variant="outline" className="w-full" onClick={() => navigate('/calculator', { state: formula })}>
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
