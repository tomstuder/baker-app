import { INGREDIENT_PRESETS, newId, splitPreferment, type Formula, type PrefermentKind, type Scale } from '@/lib/bakers'
import type { IngredientItem, Recipe } from '@/lib/content'

const allItems = (r: Pick<Recipe, 'ingredients'>) => r.ingredients.flatMap((g) => g.items)
const grams = (i: IngredientItem) => i.grams ?? 0

/** Flour base (the 100%), overall flour and water, and hydration, from a recipe's gram weights. */
export function recipeStats(r: Pick<Recipe, 'ingredients'>) {
  const items = allItems(r).filter((i) => i.grams !== undefined)
  const base = items.filter((i) => i.flour).reduce((a, i) => a + grams(i), 0)
  let flour = base
  let water = 0
  let total = 0
  for (const i of items) {
    total += grams(i)
    if (i.flour) continue
    if (i.hydration !== undefined) {
      const split = splitPreferment(grams(i), i.hydration)
      flour += split.flour
      water += split.water
    } else {
      water += (grams(i) * (i.water ?? 0)) / 100
    }
  }
  return {
    base,
    flour,
    water,
    total,
    hydration: flour > 0 ? (water / flour) * 100 : 0,
    prefermentedFlour: flour > 0 ? ((flour - base) / flour) * 100 : 0,
  }
}

/** Baker's % for an item: the stored value if present, else worked out from grams. */
export function itemPct(i: IngredientItem, base: number): number | undefined {
  if (i.pct !== undefined) return i.pct
  if (i.grams === undefined || base <= 0) return undefined
  return (i.grams / base) * 100
}

function prefermentKind(name: string): PrefermentKind {
  const n = name.toLowerCase()
  if (n.includes('poolish')) return 'poolish'
  if (n.includes('biga')) return 'biga'
  if (n.includes('levain') || n.includes('starter') || n.includes('sourdough')) return 'levain'
  return 'other'
}

/** Convert a recipe into a calculator formula, scaled to the recipe's own flour weight. */
export function recipeToFormula(r: Recipe): { formula: Formula; scale: Scale } | null {
  const { base } = recipeStats(r)
  if (base <= 0) return null
  const pct = (g: number) => Math.round((g / base) * 1000) / 10
  const weighed = allItems(r).filter((i) => i.grams !== undefined)
  const presetWater = (name: string) =>
    INGREDIENT_PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase())?.waterPct ?? 0
  return {
    formula: {
      name: r.title,
      flours: weighed.filter((i) => i.flour).map((i) => ({ id: newId(), name: i.name, pct: pct(grams(i)) })),
      preferments: weighed
        .filter((i) => !i.flour && i.hydration !== undefined)
        .map((i) => ({ id: newId(), name: i.name, kind: prefermentKind(i.name), pct: pct(grams(i)), hydration: i.hydration! })),
      ingredients: weighed
        .filter((i) => !i.flour && i.hydration === undefined)
        .map((i) => ({ id: newId(), name: i.name, pct: pct(grams(i)), waterPct: i.water ?? presetWater(i.name) })),
    },
    scale: { mode: 'flour', weight: base },
  }
}

/** "350°F" → "350°F · 177°C"; "200C" → "392°F · 200°C". Anything else is returned unchanged. */
export function formatOven(oven: string | undefined): string | undefined {
  if (!oven) return undefined
  const m = oven.match(/(\d+(?:\.\d+)?)\s*°?\s*([FC])\b/i)
  if (!m) return oven
  const v = Number(m[1])
  const [f, c] = m[2].toUpperCase() === 'F' ? [v, ((v - 32) * 5) / 9] : [(v * 9) / 5 + 32, v]
  return `${Math.round(f)}°F · ${Math.round(c)}°C`
}
