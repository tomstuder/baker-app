/**
 * Baker's percentage math.
 *
 * Convention (the common "final dough" style, e.g. "75% water, 20% levain"):
 * - Every percentage is relative to the final-dough flour, which is the 100% base. The flour blend's
 *   percentages should add up to 100.
 * - A preferment (levain, poolish, biga) is added whole as a % of that flour and carries its own
 *   flour and water, set by its hydration.
 * - "Overall" figures (total flour, total hydration, prefermented flour) count everything,
 *   including the preferment and the water inside ingredients like milk, eggs and butter.
 */

export type Flour = { id: string; name: string; pct: number }

/** Any non-flour ingredient. waterPct is how much of its weight is water (water 100, milk 87, salt 0). */
export type Ingredient = { id: string; name: string; pct: number; waterPct: number }

export type PrefermentKind = 'levain' | 'poolish' | 'biga' | 'other'
export type Preferment = { id: string; name: string; kind: PrefermentKind; pct: number; hydration: number }

export type Formula = {
  name: string
  flours: Flour[]
  ingredients: Ingredient[]
  preferments: Preferment[]
}

export type Scale =
  | { mode: 'pieces'; count: number; weight: number }
  | { mode: 'dough'; weight: number }
  | { mode: 'flour'; weight: number }

export type Line = { id: string; name: string; pct: number; grams: number }
export type PrefermentLine = Line & { flour: number; water: number; hydration: number; kind: PrefermentKind }

export type Batch = {
  /** Final-dough flour: the 100% base. */
  baseFlour: number
  totalDough: number
  flours: Line[]
  ingredients: Line[]
  preferments: PrefermentLine[]
  overall: {
    flour: number
    water: number
    /** Total water / total flour, as a %. */
    hydration: number
    /** Flour inside preferments / total flour, as a %. */
    prefermentedFlour: number
    /** Sum of the flour blend's percentages; should be 100. */
    flourPctSum: number
    /** Sum of every percentage in the formula (dough weight = baseFlour × this / 100). */
    formulaPctSum: number
  }
}

export const INGREDIENT_PRESETS: { name: string; waterPct: number }[] = [
  { name: 'Water', waterPct: 100 },
  { name: 'Salt', waterPct: 0 },
  { name: 'Instant yeast', waterPct: 0 },
  { name: 'Active dry yeast', waterPct: 0 },
  { name: 'Fresh yeast', waterPct: 70 },
  { name: 'Whole milk', waterPct: 87 },
  { name: 'Buttermilk', waterPct: 89 },
  { name: 'Whole egg', waterPct: 75 },
  { name: 'Egg yolk', waterPct: 50 },
  { name: 'Butter', waterPct: 16 },
  { name: 'Olive oil', waterPct: 0 },
  { name: 'Sugar', waterPct: 0 },
  { name: 'Honey', waterPct: 17 },
  { name: 'Diastatic malt', waterPct: 0 },
]

export const PREFERMENT_DEFAULT_HYDRATION: Record<PrefermentKind, number> = {
  levain: 100,
  poolish: 100,
  biga: 60,
  other: 100,
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
}

/** Standard country sourdough: the built-in example and the main test case. */
export function countrySourdough(): Formula {
  return {
    name: 'Country sourdough',
    flours: [
      { id: newId(), name: 'Bread flour', pct: 90 },
      { id: newId(), name: 'Whole wheat flour', pct: 10 },
    ],
    ingredients: [
      { id: newId(), name: 'Water', pct: 75, waterPct: 100 },
      { id: newId(), name: 'Salt', pct: 2, waterPct: 0 },
    ],
    preferments: [{ id: newId(), name: 'Levain', kind: 'levain', pct: 20, hydration: 100 }],
  }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)

/** Flour and water inside a preferment of the given weight and hydration (%). */
export function splitPreferment(weight: number, hydration: number) {
  const flour = weight / (1 + hydration / 100)
  return { flour, water: weight - flour }
}

export function formulaPctSum(f: Formula): number {
  return sum(f.flours.map((x) => x.pct)) + sum(f.ingredients.map((x) => x.pct)) + sum(f.preferments.map((x) => x.pct))
}

/** Final-dough flour weight (the 100% base) for a given scale. */
export function baseFlourFor(f: Formula, scale: Scale): number {
  if (scale.mode === 'flour') return Math.max(0, scale.weight)
  const dough = scale.mode === 'pieces' ? scale.count * scale.weight : scale.weight
  const pctSum = formulaPctSum(f)
  return pctSum > 0 ? Math.max(0, dough) / (pctSum / 100) : 0
}

export function calculate(f: Formula, scale: Scale): Batch {
  const base = baseFlourFor(f, scale)
  const g = (pct: number) => (base * (Number.isFinite(pct) ? pct : 0)) / 100

  const flours = f.flours.map((x) => ({ id: x.id, name: x.name, pct: x.pct, grams: g(x.pct) }))
  const ingredients = f.ingredients.map((x) => ({ id: x.id, name: x.name, pct: x.pct, grams: g(x.pct) }))
  const preferments = f.preferments.map((p) => {
    const grams = g(p.pct)
    return { id: p.id, name: p.name, kind: p.kind, pct: p.pct, hydration: p.hydration, grams, ...splitPreferment(grams, p.hydration) }
  })

  const flourInDough = sum(flours.map((x) => x.grams))
  const flourInPref = sum(preferments.map((p) => p.flour))
  const totalFlour = flourInDough + flourInPref
  const totalWater =
    sum(f.ingredients.map((x, i) => (ingredients[i].grams * x.waterPct) / 100)) + sum(preferments.map((p) => p.water))

  return {
    baseFlour: base,
    totalDough: flourInDough + sum(ingredients.map((x) => x.grams)) + sum(preferments.map((p) => p.grams)),
    flours,
    ingredients,
    preferments,
    overall: {
      flour: totalFlour,
      water: totalWater,
      hydration: totalFlour > 0 ? (totalWater / totalFlour) * 100 : 0,
      prefermentedFlour: totalFlour > 0 ? (flourInPref / totalFlour) * 100 : 0,
      flourPctSum: sum(f.flours.map((x) => x.pct)),
      formulaPctSum: formulaPctSum(f),
    },
  }
}

/** Grams for display: up to one decimal under 20 g (salt, yeast), whole grams above. */
export function formatGrams(g: number): string {
  if (!Number.isFinite(g)) return '–'
  return g < 20 ? String(Math.round(g * 10) / 10) : String(Math.round(g))
}

export function formatPct(p: number): string {
  if (!Number.isFinite(p)) return '–'
  return String(Math.round(p * 10) / 10)
}

/** Plain-text version of a batch, for copying into notes or messages. */
export function batchToText(name: string, b: Batch): string {
  const line = (n: string, grams: number, pct?: number) =>
    `${n}: ${formatGrams(grams)} g${pct !== undefined ? ` (${formatPct(pct)}%)` : ''}`
  const out = [`${name}: ${formatGrams(b.totalDough)} g dough`, '']
  for (const p of b.preferments) {
    out.push(`${p.name} build (${formatPct(p.hydration)}% hydration): ${formatGrams(p.flour)} g flour + ${formatGrams(p.water)} g water`)
  }
  if (b.preferments.length) out.push('')
  out.push('Final mix:')
  for (const x of b.flours) out.push('  ' + line(x.name, x.grams, x.pct))
  for (const x of b.ingredients) out.push('  ' + line(x.name, x.grams, x.pct))
  for (const p of b.preferments) out.push('  ' + line(p.name, p.grams, p.pct))
  out.push('', `Overall hydration ${formatPct(b.overall.hydration)}% · total flour ${formatGrams(b.overall.flour)} g`)
  return out.join('\n')
}
