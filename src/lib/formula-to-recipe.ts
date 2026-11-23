/**
 * Turning a calculator formula back into recipe ingredients: for a new recipe, for updating an
 * existing recipe's proportions, and for describing what changed (for the bake log).
 */
import { calculate, formatGrams, formatPct, type Formula, type Scale } from '@/lib/bakers'
import type { IngredientGroup, IngredientItem, Recipe } from '@/lib/content'
import { recipeStats } from '@/lib/recipe-math'

const norm = (s: string) => s.trim().toLowerCase()
/** Calculator percentages are rounded to 0.1, so differences up to half of that are just rounding. */
const PCT_TOLERANCE = 0.051

/** Grams as stored in recipes: one decimal under 20 g, whole grams above. */
export const roundGrams = (g: number) => (g < 20 ? Math.round(g * 10) / 10 : Math.round(g))

type Row = { name: string; pct: number; kind: 'flour' | 'preferment' | 'ingredient'; hydration?: number; waterPct?: number }

function rows(f: Formula): Row[] {
  return [
    ...f.flours.map((x) => ({ name: x.name, pct: x.pct, kind: 'flour' as const })),
    ...f.preferments.map((x) => ({ name: x.name, pct: x.pct, kind: 'preferment' as const, hydration: x.hydration })),
    ...f.ingredients.map((x) => ({ name: x.name, pct: x.pct, kind: 'ingredient' as const, waterPct: x.waterPct })),
  ].filter((r) => r.name.trim() && Number.isFinite(r.pct))
}

function toItem(r: Row, grams: number): IngredientItem {
  return {
    name: r.name.trim(),
    grams: roundGrams(grams),
    ...(r.kind === 'flour' && { flour: true }),
    ...(r.kind === 'preferment' && { hydration: r.hydration ?? 100 }),
    ...(r.kind === 'ingredient' && r.waterPct ? { water: r.waterPct } : {}),
  }
}

/** Ingredients for a brand-new recipe, at the calculator's current batch size. */
export function formulaToIngredients(f: Formula, scale: Scale): IngredientGroup[] {
  const base = calculate(f, scale).baseFlour
  const all = rows(f)
  const pre = all.filter((r) => r.kind === 'preferment')
  const dough = all.filter((r) => r.kind !== 'preferment')
  return [
    ...(pre.length ? [{ group: 'Preferment', items: pre.map((r) => toItem(r, (base * r.pct) / 100)) }] : []),
    { group: pre.length ? 'Dough' : undefined, items: dough.map((r) => toItem(r, (base * r.pct) / 100)) },
  ]
}

/** A short description of the batch, e.g. "2 × 900 g" or "1,800 g dough". */
export function batchLabel(scale: Scale, totalDough: number): string {
  if (scale.mode === 'pieces') return `${scale.count} × ${formatGrams(scale.weight)} g`
  if (scale.mode === 'dough') return `${formatGrams(scale.weight)} g dough`
  return `${formatGrams(scale.weight)} g flour (${formatGrams(totalDough)} g dough)`
}

/**
 * Apply a formula's percentages to a recipe, keeping the recipe's own flour weight (batch size).
 * Matched by ingredient name: changed items get new grams (and lose their "amount as written",
 * which would now be wrong); new rows are appended to a fitting group; weighed items missing from
 * the formula are removed. Unweighed items (add-ins, garnishes) are left alone.
 */
export function applyFormula(recipe: Pick<Recipe, 'ingredients'>, f: Formula): { ingredients: IngredientGroup[]; changed: number } {
  const base = recipeStats(recipe).base || 1000
  const pending = new Map(rows(f).map((r) => [norm(r.name), r]))
  let changed = 0

  const groups = recipe.ingredients.map((g) => ({
    ...g,
    items: g.items.flatMap((item): IngredientItem[] => {
      if (item.grams === undefined) return [item]
      const r = pending.get(norm(item.name))
      if (!r) {
        changed++
        return []
      }
      pending.delete(norm(item.name))
      const grams = roundGrams((base * r.pct) / 100)
      // The calculator shows percentages to 0.1, so anything within that rounding is "unchanged".
      const moved = Math.abs(r.pct - (item.grams / base) * 100) > PCT_TOLERANCE
      if (moved) changed++
      const next: IngredientItem = { ...item, grams: moved ? grams : item.grams }
      if (moved) {
        delete next.amount
        delete next.estimated
        delete next.pct // recalculated from grams when saved
      }
      if (r.kind === 'preferment') next.hydration = r.hydration ?? next.hydration
      if (r.kind === 'ingredient' && r.waterPct !== undefined) next.water = r.waterPct || undefined
      return [next]
    }),
  }))

  // New rows go to the group that already holds their kind, else the last group.
  const home = (kind: Row['kind']) => {
    const match = (i: IngredientItem) => (kind === 'flour' ? i.flour : kind === 'preferment' ? i.hydration !== undefined : !i.flour && i.hydration === undefined && i.grams !== undefined)
    const idx = groups.findIndex((g) => g.items.some(match))
    return idx >= 0 ? idx : Math.max(0, groups.length - 1)
  }
  if (!groups.length && pending.size) groups.push({ items: [] })
  for (const r of pending.values()) {
    groups[home(r.kind)].items.push(toItem(r, (base * r.pct) / 100))
    changed++
  }
  return { ingredients: groups, changed }
}

/** Human-readable differences between a recipe and a formula, e.g. "Water 75% → 78%". */
export function describeChanges(recipe: Pick<Recipe, 'ingredients'>, f: Formula): string[] {
  const { base } = recipeStats(recipe)
  if (base <= 0) return []
  const before = new Map(
    recipe.ingredients
      .flatMap((g) => g.items)
      .filter((i) => i.grams !== undefined)
      .map((i) => [norm(i.name), { name: i.name, pct: (i.grams! / base) * 100, hydration: i.hydration }]),
  )
  const out: string[] = []
  for (const r of rows(f)) {
    const b = before.get(norm(r.name))
    before.delete(norm(r.name))
    if (!b) {
      out.push(`Added ${r.name} ${formatPct(r.pct)}%`)
      continue
    }
    if (Math.abs(b.pct - r.pct) > PCT_TOLERANCE) out.push(`${r.name} ${formatPct(b.pct)}% → ${formatPct(r.pct)}%`)
    if (r.kind === 'preferment' && b.hydration !== undefined && r.hydration !== undefined && b.hydration !== r.hydration) {
      out.push(`${r.name} hydration ${formatPct(b.hydration)}% → ${formatPct(r.hydration)}%`)
    }
  }
  for (const b of before.values()) out.push(`Left out ${b.name}`)
  return out
}
