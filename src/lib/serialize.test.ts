import { describe, expect, it } from 'vitest'
import { toHome, toRecipe, type Recipe } from './content'
import { serializeHome, serializeRecipe, slugify, withComputedPct } from './serialize'

const BANANA = `---
title: Sourdough Banana Bread
category: Quick breads & muffins
tags: [banana, sourdough-discard, loaf-pan]
status: tested
created: 2026-05-23
yield: 2 loaves (8×4" pans)
servings: 10–12 slices
time:
  prep: 15 min
  bake: 45–60 min
oven: 350°F
equipment:
  - (2) 8×4" loaf pans
  - Whisk
ingredients:
  - group: Wet
    items:
      - { name: Unsalted butter, amount: 8 tbsp, grams: 113, pct: 47.1, water: 16 }
      - { name: Large eggs, amount: "2", grams: 100, pct: 41.7, water: 75, estimated: true }
      - { name: Sourdough starter, amount: 1/2 cup, grams: 125, pct: 52.1, hydration: 100, note: discard or active }
  - group: Dry
    items:
      - { name: Flour, amount: 2 cups, grams: 240, pct: 100, flour: true, note: all-purpose or bread flour }
      - { name: Baking soda, amount: 1/2 tsp, grams: 3, pct: 1.3, estimated: true }
  - group: Add-ins (optional)
    note: Keep the total to ½–¾ cup.
    items:
      - { name: Milk chocolate chips }
---

# Sourdough Banana Bread

## Method

1. Preheat oven to 350°F (177°C).
`

const PATH = 'recipes/sourdough-banana-bread/recipe.md'

describe('serializeRecipe', () => {
  it('round-trips without losing anything', () => {
    const r = toRecipe(PATH, BANANA)
    const again = toRecipe(PATH, serializeRecipe(r))
    expect(again).toEqual(r)
  })

  it('writes the compact hand-written style', () => {
    const out = serializeRecipe(toRecipe(PATH, BANANA))
    expect(out.startsWith('---\ntitle: Sourdough Banana Bread\n')).toBe(true)
    expect(out).toContain('tags: [banana, sourdough-discard, loaf-pan]')
    expect(out).toContain("# grams are the source of truth; pct is baker's % of the flour (240 g = 100%).\ningredients:")
    expect(out).toContain('- { name: Large eggs, amount: "2", grams: 100, pct: 41.7, water: 75, estimated: true }')
    expect(out).toContain('\n---\n\n# Sourdough Banana Bread\n')
    expect(out.endsWith('(177°C).\n')).toBe(true)
  })

  it('recalculates baker’s % from grams on save', () => {
    const r = toRecipe(PATH, BANANA)
    r.ingredients[1].items[0].grams = 300 // flour 240 → 300
    const again = toRecipe(PATH, serializeRecipe(r))
    expect(again.ingredients[1].items[0].pct).toBe(100)
    expect(again.ingredients[0].items[0].pct).toBe(37.7) // 113 / 300
  })

  it('drops empty fields, blank rows and irrelevant water/hydration', () => {
    const r: Recipe = {
      slug: 'x',
      path: 'recipes/x/recipe.md',
      title: '  New loaf ',
      category: 'Bread',
      tags: ['', 'rye '],
      status: 'draft',
      time: { prep: '', bake: '40 min' },
      equipment: [' '],
      ingredients: [
        {
          group: '',
          items: [
            { name: 'Rye flour', grams: 500, flour: true, water: 12 },
            { name: 'Levain', grams: 100, hydration: 100, water: 50 },
            { name: '   ' },
          ],
        },
      ],
      body: '\n\n# New loaf\n',
    }
    const out = serializeRecipe(r)
    expect(out).toBe(`---
title: New loaf
category: Bread
tags: [rye]
status: draft
time:
  bake: 40 min
# grams are the source of truth; pct is baker's % of the flour (500 g = 100%).
ingredients:
  - items:
      - { name: Rye flour, grams: 500, pct: 100, flour: true }
      - { name: Levain, grams: 100, pct: 20, hydration: 100 }
---

# New loaf
`)
  })

  it('writes an empty ingredient list for drafts', () => {
    const r = toRecipe('recipes/d/recipe.md', '---\ntitle: D\nstatus: draft\ningredients: []\n---\n\n# D\n')
    expect(serializeRecipe(r)).toContain('ingredients: []')
  })
})

describe('withComputedPct', () => {
  it('clears pct when there is no flour', () => {
    expect(withComputedPct([{ items: [{ name: 'Sugar', grams: 10, pct: 50 }] }])[0].items[0].pct).toBeUndefined()
  })
})

describe('serializeHome', () => {
  it('round-trips', () => {
    const text = `---
name: Tom Studer
tagline: Home baker
hero: images/home/hero.jpg
featured: [a, b]
social:
  instagram: https://www.instagram.com/tomstuder
---

Hello there.
`
    expect(serializeHome(toHome(text))).toBe(text)
  })
})

describe('slugify', () => {
  it('makes folder-safe names', () => {
    expect(slugify('Cinnamon Rolls')).toBe('cinnamon-rolls')
    expect(slugify('  Pain au Chocolat! ')).toBe('pain-au-chocolat')
    expect(slugify('Crème brûlée & tarts')).toBe('creme-brulee-and-tarts')
  })
})
