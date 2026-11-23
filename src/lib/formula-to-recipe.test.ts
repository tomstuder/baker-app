import { describe, expect, it } from 'vitest'
import { calculate, countrySourdough } from './bakers'
import { toRecipe } from './content'
import { applyFormula, batchLabel, describeChanges, formulaToIngredients, roundGrams } from './formula-to-recipe'
import { recipeToFormula } from './recipe-math'

const SOURDOUGH = toRecipe(
  'recipes/sourdough-base/recipe.md',
  `---
title: Sourdough Base Recipe
ingredients:
  - group: Levain
    items:
      - { name: Levain, grams: 200, pct: 20, hydration: 100 }
  - group: Dough
    items:
      - { name: Bread flour, amount: 7 cups, grams: 900, pct: 90, flour: true }
      - { name: Whole wheat flour, grams: 100, pct: 10, flour: true }
      - { name: Water, amount: 3 cups, grams: 750, pct: 75, water: 100 }
      - { name: Salt, grams: 20, pct: 2 }
      - { name: Seeds (optional) }
---
`,
)

describe('formulaToIngredients', () => {
  it('builds preferment and dough groups at the batch size', () => {
    const groups = formulaToIngredients(countrySourdough(), { mode: 'flour', weight: 500 })
    expect(groups.map((g) => g.group)).toEqual(['Preferment', 'Dough'])
    expect(groups[0].items).toEqual([{ name: 'Levain', grams: 100, hydration: 100 }])
    expect(groups[1].items).toEqual([
      { name: 'Bread flour', grams: 450, flour: true },
      { name: 'Whole wheat flour', grams: 50, flour: true },
      { name: 'Water', grams: 375, water: 100 },
      { name: 'Salt', grams: 10 },
    ])
  })
})

describe('applyFormula', () => {
  it('is a no-op when nothing changed (even after scaling in the calculator)', () => {
    const conv = recipeToFormula(SOURDOUGH)!
    const { ingredients, changed } = applyFormula(SOURDOUGH, conv.formula)
    expect(changed).toBe(0)
    expect(ingredients).toEqual(SOURDOUGH.ingredients)
  })

  it("applies new percentages at the recipe's own batch size", () => {
    const f = recipeToFormula(SOURDOUGH)!.formula
    f.ingredients.find((i) => i.name === 'Water')!.pct = 78
    f.ingredients = f.ingredients.filter((i) => i.name !== 'Salt')
    f.flours.push({ id: 'r', name: 'Rye flour', pct: 5 })
    f.ingredients.push({ id: 'y', name: 'Instant yeast', pct: 0.25, waterPct: 0 })
    const { ingredients, changed } = applyFormula(SOURDOUGH, f)
    const dough = ingredients[1].items
    const water = dough.find((i) => i.name === 'Water')!
    expect(water).toMatchObject({ name: 'Water', grams: 780, water: 100 })
    expect(water.amount).toBeUndefined() // "3 cups" would now be wrong
    expect(water.pct).toBeUndefined() // recalculated on save
    expect(dough.find((i) => i.name === 'Bread flour')?.amount).toBe('7 cups') // unchanged keeps it
    expect(dough.some((i) => i.name === 'Salt')).toBe(false)
    expect(dough.find((i) => i.name === 'Rye flour')).toEqual({ name: 'Rye flour', grams: 50, flour: true })
    expect(dough.find((i) => i.name === 'Instant yeast')).toEqual({ name: 'Instant yeast', grams: 2.5 })
    expect(dough.some((i) => i.name === 'Seeds (optional)')).toBe(true) // unweighed items untouched
    expect(changed).toBe(4)
  })
})

describe('rounding', () => {
  // 3 g of 240 g is 1.25%, which the calculator shows as 1.3%; converting back gives 3.1 g.
  const BANANA = toRecipe(
    'recipes/b/recipe.md',
    `---
title: B
ingredients:
  - items:
      - { name: Flour, grams: 240, flour: true }
      - { name: Butter, grams: 113, water: 16 }
      - { name: Baking soda, grams: 3 }
      - { name: Vanilla, grams: 5 }
      - { name: Starter, grams: 125, hydration: 100 }
---
`,
  )
  it('treats calculator rounding as no change', () => {
    const f = recipeToFormula(BANANA)!.formula
    expect(applyFormula(BANANA, f).changed).toBe(0)
    expect(describeChanges(BANANA, f)).toEqual([])
  })
  it('still sees a real 0.1% change', () => {
    const f = recipeToFormula(BANANA)!.formula
    f.ingredients.find((i) => i.name === 'Baking soda')!.pct = 1.4
    expect(applyFormula(BANANA, f).changed).toBe(1)
    expect(describeChanges(BANANA, f)).toEqual(['Baking soda 1.3% → 1.4%'])
  })
})

describe('describeChanges', () => {
  it('lists what differs from the recipe', () => {
    const f = recipeToFormula(SOURDOUGH)!.formula
    f.ingredients.find((i) => i.name === 'Water')!.pct = 78
    f.preferments[0].hydration = 80
    f.ingredients = f.ingredients.filter((i) => i.name !== 'Salt')
    f.flours.push({ id: 'r', name: 'Rye flour', pct: 5 })
    expect(describeChanges(SOURDOUGH, f)).toEqual(['Added Rye flour 5%', 'Levain hydration 100% → 80%', 'Water 75% → 78%', 'Left out Salt'])
  })

  it('is empty for an unchanged formula', () => {
    expect(describeChanges(SOURDOUGH, recipeToFormula(SOURDOUGH)!.formula)).toEqual([])
  })
})

describe('helpers', () => {
  it('labels batches and rounds grams', () => {
    const f = countrySourdough()
    expect(batchLabel({ mode: 'pieces', count: 2, weight: 900 }, 1800)).toBe('2 × 900 g')
    expect(batchLabel({ mode: 'dough', weight: 1800 }, 1800)).toBe('1800 g dough')
    expect(batchLabel({ mode: 'flour', weight: 500 }, calculate(f, { mode: 'flour', weight: 500 }).totalDough)).toBe('500 g flour (985 g dough)')
    expect(roundGrams(2.46)).toBe(2.5)
    expect(roundGrams(684.6)).toBe(685)
  })
})
