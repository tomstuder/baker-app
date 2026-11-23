import { Link, useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { ContentError } from '@/components/content-error'
import { Chip } from '@/components/filter-chip'
import { PageHeader } from '@/components/page-header'
import { RecipeCard } from '@/components/recipe-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { loadConfig, loadRecipes, type Snapshot } from '@/lib/content'

async function load(snap: Snapshot) {
  const [config, recipes] = await Promise.all([loadConfig(snap), loadRecipes(snap)])
  return { categories: config.categories.recipes, recipes }
}

export function RecipesPage() {
  const { data, snap, error, loading } = useContent('recipes', load)
  const [params, setParams] = useSearchParams()
  const category = params.get('category')
  const tag = params.get('tag')

  const recipes = data?.recipes ?? []
  // Categories in config order, plus any used in files but missing from config.
  const known = data?.categories ?? []
  const used = [...new Set(recipes.map((r) => r.category ?? 'Uncategorized'))]
  const categories = [...known.filter((c) => used.includes(c)), ...used.filter((c) => !known.includes(c))]
  const countOf = (c: string) => recipes.filter((r) => (r.category ?? 'Uncategorized') === c).length

  const visible = recipes.filter((r) => (!category || (r.category ?? 'Uncategorized') === category) && (!tag || r.tags.includes(tag)))
  const groups = categories
    .map((c) => ({ category: c, items: visible.filter((r) => (r.category ?? 'Uncategorized') === c) }))
    .filter((g) => g.items.length)

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader title="Recipes" description="Formulas, method and the history of every bake.">
        <IfEditing>
          <Button asChild>
            <Link to="/recipes/new">
              <Plus />
              New recipe
            </Link>
          </Button>
        </IfEditing>
      </PageHeader>

      {error && <ContentError error={error} />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3.9] rounded-xl" />
          ))}
        </div>
      ) : (
        data && (
          <>
            <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              <Chip active={!category} onClick={() => set('category', null)}>
                All <span className="text-muted-foreground">{recipes.length}</span>
              </Chip>
              {categories.map((c) => (
                <Chip key={c} active={category === c} onClick={() => set('category', category === c ? null : c)}>
                  {c} <span className="text-muted-foreground">{countOf(c)}</span>
                </Chip>
              ))}
            </div>

            {tag && (
              <div className="mb-6 flex items-center gap-2 text-sm">
                Tagged <span className="font-medium">#{tag}</span>
                <Button variant="ghost" size="icon-sm" aria-label="Clear tag filter" onClick={() => set('tag', null)}>
                  <X />
                </Button>
              </div>
            )}

            {groups.length === 0 && <p className="text-muted-foreground">No recipes match.</p>}

            <div className="space-y-10">
              {groups.map((g) => (
                <section key={g.category}>
                  {!category && <h2 className="mb-4 text-xl font-semibold">{g.category}</h2>}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((r) => (
                      <RecipeCard key={r.slug} recipe={r} snap={snap} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )
      )}
    </>
  )
}
