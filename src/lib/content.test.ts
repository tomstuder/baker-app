import { describe, expect, it } from 'vitest'
import { calculate } from './bakers'
import { parseDoc, resolvePath, toDiaryPost, toHome, toRecipe } from './content'
import { formatOven, recipeStats, recipeToFormula } from './recipe-math'

// Mirrors recipes/sourdough-banana-bread/recipe.md in tomstuder/Recipes.
const BANANA = `---
title: Sourdough Banana Bread
category: Quick breads & muffins
tags: [banana, sourdough-discard, loaf-pan]
status: tested
created: 2026-05-23
yield: 2 loaves (8×4" pans)
time:
  prep: 15 min
  bake: 45–60 min
oven: 350°F
ingredients:
  - group: Wet
    items:
      - { name: Unsalted butter, amount: 8 tbsp, grams: 113, pct: 47.1, water: 16 }
      - { name: Brown sugar, amount: 1 cup, grams: 200, pct: 83.3 }
      - { name: Large eggs, amount: "2", grams: 100, pct: 41.7, water: 75, estimated: true }
      - { name: Ripe bananas, amount: 3 medium, grams: 350, pct: 145.8, water: 75, estimated: true, note: mashed }
      - { name: Greek yogurt, amount: 3 tbsp, grams: 45, pct: 18.8, water: 81 }
      - { name: Vanilla extract, amount: 1 tsp, grams: 5, pct: 2.1 }
      - { name: Sourdough starter, amount: 1/2 cup, grams: 125, pct: 52.1, hydration: 100 }
  - group: Dry
    items:
      - { name: Flour, amount: 2 cups, grams: 240, pct: 100, flour: true }
      - { name: Baking powder, amount: 2 tsp, grams: 8, pct: 3.3, estimated: true }
      - { name: Baking soda, amount: 1/2 tsp, grams: 3, pct: 1.3, estimated: true }
      - { name: Fine sea salt, amount: 1 tsp, grams: 5, pct: 2.1 }
  - group: Add-ins (optional)
    items:
      - { name: Milk chocolate chips }
---

# Sourdough Banana Bread

## Method
`

describe('parseDoc / toRecipe', () => {
  const r = toRecipe('recipes/sourdough-banana-bread/recipe.md', BANANA)

  it('reads the header block', () => {
    expect(r.slug).toBe('sourdough-banana-bread')
    expect(r.title).toBe('Sourdough Banana Bread')
    expect(r.category).toBe('Quick breads & muffins')
    expect(r.tags).toEqual(['banana', 'sourdough-discard', 'loaf-pan'])
    expect(r.status).toBe('tested')
    expect(r.created).toBe('2026-05-23') // stays a string, not a Date
    expect(r.time).toEqual({ prep: '15 min', bake: '45–60 min' })
    expect(r.ingredients.map((g) => g.items.length)).toEqual([7, 4, 1])
    expect(r.ingredients[0].items[2]).toMatchObject({ name: 'Large eggs', amount: '2', grams: 100, estimated: true })
    expect(r.ingredients[1].items[1].amount).toBe('2 tsp')
    expect(r.body.trimStart().startsWith('# Sourdough Banana Bread')).toBe(true)
  })

  it('falls back safely on a file with no header', () => {
    const plain = toRecipe('recipes/x/recipe.md', '# Just a title')
    expect(plain.title).toBe('x')
    expect(plain.status).toBe('draft')
    expect(plain.ingredients).toEqual([])
  })

  it('treats invalid YAML as an empty header', () => {
    expect(parseDoc('---\ntitle: [oops\n---\nbody').data).toEqual({})
  })
})

describe('recipe math', () => {
  const r = toRecipe('recipes/sourdough-banana-bread/recipe.md', BANANA)

  it('computes stats from grams, counting starter and water content', () => {
    const s = recipeStats(r)
    expect(s.base).toBe(240)
    expect(s.flour).toBeCloseTo(302.5, 6)
    expect(s.water).toBeCloseTo(454.5, 1)
    expect(s.hydration).toBeCloseTo(150.26, 2)
    expect(s.total).toBe(1194)
  })

  it('converts to a calculator formula that reproduces the same batch', () => {
    const conv = recipeToFormula(r)!
    expect(conv.formula.flours).toHaveLength(1)
    expect(conv.formula.preferments[0]).toMatchObject({ name: 'Sourdough starter', kind: 'levain', pct: 52.1, hydration: 100 })
    expect(conv.formula.ingredients.find((i) => i.name === 'Large eggs')).toMatchObject({ pct: 41.7, waterPct: 75 })
    // Add-ins without grams are left out.
    expect(conv.formula.ingredients.some((i) => i.name === 'Milk chocolate chips')).toBe(false)
    const batch = calculate(conv.formula, conv.scale)
    expect(batch.totalDough).toBeCloseTo(1194, -1)
    expect(batch.overall.hydration).toBeCloseTo(recipeStats(r).hydration, 0)
  })

  it('returns null for a recipe with no flour', () => {
    expect(recipeToFormula(toRecipe('recipes/x/recipe.md', '---\ntitle: X\ningredients: []\n---\n'))).toBeNull()
  })

  it('formats oven temperatures in both units', () => {
    expect(formatOven('350°F')).toBe('350°F · 177°C')
    expect(formatOven('230 C')).toBe('446°F · 230°C')
    expect(formatOven('hot')).toBe('hot')
    expect(formatOven('71º')).toBe('71°F · 22°C')
    expect(formatOven('500')).toBe('500°F · 260°C')
    expect(formatOven('24 c')).toBe('75°F · 24°C')
    expect(formatOven('450 degrees F')).toBe('450°F · 232°C')
    expect(formatOven('450°F, then 425°F')).toBe('450°F, then 425°F')
  })
})

describe('home and diary', () => {
  it('reads home.md', () => {
    const h = toHome(`---
name: Tom Studer
tagline: Home baker
featured: [sourdough-banana-bread]
social:
  instagram: https://www.instagram.com/tomstuder
---
Hello.`)
    expect(h.name).toBe('Tom Studer')
    expect(h.featured).toEqual(['sourdough-banana-bread'])
    expect(h.social.instagram).toBe('https://www.instagram.com/tomstuder')
    expect(h.body.trim()).toBe('Hello.')
  })

  it('takes the diary date from the file name and builds an excerpt', () => {
    const p = toDiaryPost('diary/2026-11-21-first-rye.md', '---\ntitle: First rye\n---\n\n# First rye\n\nIt was **dense** but [tasty](x).\n')
    expect(p.date).toBe('2026-11-21')
    expect(p.excerpt).toBe('It was dense but tasty.')
  })
})

describe('resolvePath', () => {
  it('resolves relative to the file', () => {
    expect(resolvePath('recipes/a/recipe.md', 'images/x.jpg')).toBe('recipes/a/images/x.jpg')
    expect(resolvePath('home.md', 'images/home/hero.jpg')).toBe('images/home/hero.jpg')
    expect(resolvePath('recipes/a/recipe.md', '../b/images/y.jpg')).toBe('recipes/b/images/y.jpg')
    expect(resolvePath('recipes/a/recipe.md', '/images/z.jpg')).toBe('images/z.jpg')
    expect(resolvePath('home.md', 'https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
  })
})
