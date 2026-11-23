import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookPlus, ClipboardList, FilePlus2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useContent } from '@/hooks/use-content'
import { calculate, type Formula, type Scale } from '@/lib/bakers'
import { loadRecipes } from '@/lib/content'
import { batchLabel, describeChanges, formulaToIngredients } from '@/lib/formula-to-recipe'

/** Router state the editors accept from the calculator. */
export type FromCalculator = {
  draft?: { title: string; yield: string; ingredients: ReturnType<typeof formulaToIngredients> }
  applyFormula?: Formula
  prefill?: { batch: string; changes: string[] }
}

function Option({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border p-4">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export function SaveToRecipeDialog({
  open,
  onOpenChange,
  formula,
  scale,
  source,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  formula: Formula
  scale: Scale
  /** Slug of the recipe this formula was opened from, if any. */
  source?: string
}) {
  const navigate = useNavigate()
  const { data: recipes, loading } = useContent(open ? 'save-to-recipe' : 'save-to-recipe:closed', (s) => (open ? loadRecipes(s) : Promise.resolve([])))
  const [target, setTarget] = useState<string | undefined>(source)
  const sourceRecipe = recipes?.find((r) => r.slug === source)
  const chosen = target ?? sourceRecipe?.slug
  const batch = batchLabel(scale, calculate(formula, scale).totalDough)

  const go = (to: string, state: FromCalculator) => {
    onOpenChange(false)
    navigate(to, { state })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Save to recipe</DialogTitle>
          <DialogDescription>Each option opens an editor first, so you can review before anything is saved.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <Loader2 className="mx-auto my-8 size-6 animate-spin text-primary" />
        ) : (
          <div className="space-y-3">
            {sourceRecipe && (
              <Option icon={<ClipboardList className="size-5" />} title={`Log a bake of ${sourceRecipe.title}`} text={`Records this batch (${batch}) and what you changed from the recipe.`}>
                <Button
                  size="sm"
                  onClick={() =>
                    go(`/recipes/${sourceRecipe.slug}/bakes/new`, { prefill: { batch, changes: describeChanges(sourceRecipe, formula) } })
                  }
                >
                  Log a bake
                </Button>
              </Option>
            )}

            <Option
              icon={<RefreshCw className="size-5" />}
              title="Update a recipe"
              text="Applies these percentages to the recipe at its own batch size. Changed ingredients get new grams."
            >
              <div className="flex flex-wrap gap-2">
                <Select value={chosen ?? ''} onValueChange={setTarget}>
                  <SelectTrigger className="min-w-48 flex-1" aria-label="Recipe to update">
                    <SelectValue placeholder="Choose a recipe…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(recipes ?? []).map((r) => (
                      <SelectItem key={r.slug} value={r.slug}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" disabled={!chosen} onClick={() => chosen && go(`/recipes/${chosen}/edit`, { applyFormula: formula })}>
                  Review update
                </Button>
              </div>
            </Option>

            <Option icon={<FilePlus2 className="size-5" />} title="Save as a new recipe" text={`Starts a new recipe with these ingredients at this batch size (${batch}).`}>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  go('/recipes/new', {
                    draft: { title: formula.name.trim() === sourceRecipe?.title ? `${formula.name.trim()} (variation)` : formula.name.trim(), yield: batch, ingredients: formulaToIngredients(formula, scale) },
                  })
                }
              >
                <BookPlus />
                New recipe
              </Button>
            </Option>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
