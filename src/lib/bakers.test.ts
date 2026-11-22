import { describe, expect, it } from 'vitest'
import { baseFlourFor, batchToText, calculate, countrySourdough, formatGrams, splitPreferment, type Formula } from './bakers'

const byName = <T extends { name: string }>(xs: T[], name: string) => xs.find((x) => x.name === name)!

describe('country sourdough (90/10 flour, 75% water, 20% levain @100%, 2% salt)', () => {
  const f = countrySourdough()

  it('sums to 197% of final-dough flour', () => {
    expect(calculate(f, { mode: 'flour', weight: 1000 }).overall.formulaPctSum).toBe(197)
  })

  it('scales from flour weight', () => {
    const b = calculate(f, { mode: 'flour', weight: 1000 })
    expect(b.baseFlour).toBe(1000)
    expect(byName(b.flours, 'Bread flour').grams).toBe(900)
    expect(byName(b.flours, 'Whole wheat flour').grams).toBe(100)
    expect(byName(b.ingredients, 'Water').grams).toBe(750)
    expect(byName(b.ingredients, 'Salt').grams).toBe(20)
    expect(b.preferments[0].grams).toBe(200)
    expect(b.preferments[0].flour).toBe(100)
    expect(b.preferments[0].water).toBe(100)
    expect(b.totalDough).toBe(1970)
  })

  it('reports overall hydration including the levain', () => {
    const b = calculate(f, { mode: 'flour', weight: 1000 })
    expect(b.overall.flour).toBe(1100)
    expect(b.overall.water).toBe(850)
    expect(b.overall.hydration).toBeCloseTo(77.27, 2)
    expect(b.overall.prefermentedFlour).toBeCloseTo(9.09, 2)
  })

  it('scales from loaf count × weight', () => {
    const b = calculate(f, { mode: 'pieces', count: 2, weight: 900 })
    expect(b.totalDough).toBeCloseTo(1800, 6)
    expect(b.baseFlour).toBeCloseTo(913.71, 2)
    expect(byName(b.ingredients, 'Water').grams).toBeCloseTo(685.28, 2)
    expect(byName(b.ingredients, 'Salt').grams).toBeCloseTo(18.27, 2)
    expect(b.preferments[0].grams).toBeCloseTo(182.74, 2)
  })

  it('scales from total dough weight', () => {
    const b = calculate(f, { mode: 'dough', weight: 1800 })
    expect(b.totalDough).toBeCloseTo(1800, 6)
  })
})

describe('water in other ingredients', () => {
  it('counts milk, egg and butter water toward hydration', () => {
    const f: Formula = {
      name: 'Enriched',
      flours: [{ id: 'f', name: 'Bread flour', pct: 100 }],
      ingredients: [
        { id: 'm', name: 'Whole milk', pct: 50, waterPct: 87 },
        { id: 'e', name: 'Whole egg', pct: 20, waterPct: 75 },
        { id: 'b', name: 'Butter', pct: 10, waterPct: 16 },
      ],
      preferments: [],
    }
    const b = calculate(f, { mode: 'flour', weight: 1000 })
    // 435 + 150 + 16 = 601
    expect(b.overall.water).toBeCloseTo(601, 6)
    expect(b.overall.hydration).toBeCloseTo(60.1, 6)
    expect(b.overall.prefermentedFlour).toBe(0)
  })
})

describe('preferments', () => {
  it('splits a 60% biga', () => {
    const { flour, water } = splitPreferment(160, 60)
    expect(flour).toBeCloseTo(100, 6)
    expect(water).toBeCloseTo(60, 6)
  })

  it('handles several preferments', () => {
    const f: Formula = {
      name: 'Two prefs',
      flours: [{ id: 'f', name: 'Flour', pct: 100 }],
      ingredients: [{ id: 'w', name: 'Water', pct: 60, waterPct: 100 }],
      preferments: [
        { id: 'p', name: 'Poolish', kind: 'poolish', pct: 40, hydration: 100 },
        { id: 'b', name: 'Biga', kind: 'biga', pct: 32, hydration: 60 },
      ],
    }
    const b = calculate(f, { mode: 'flour', weight: 500 })
    // poolish 200 g → 100/100; biga 160 g → 100/60
    expect(b.overall.flour).toBeCloseTo(700, 6)
    expect(b.overall.water).toBeCloseTo(300 + 100 + 60, 6)
  })
})

describe('edge cases', () => {
  it('returns zeros instead of NaN for an empty formula', () => {
    const f: Formula = { name: '', flours: [], ingredients: [], preferments: [] }
    const b = calculate(f, { mode: 'dough', weight: 1000 })
    expect(b.baseFlour).toBe(0)
    expect(b.overall.hydration).toBe(0)
  })

  it('treats a blank (NaN) percentage as zero', () => {
    const f = countrySourdough()
    f.ingredients[1].pct = Number.NaN
    expect(baseFlourFor(f, { mode: 'dough', weight: 1950 })).toBeCloseTo(1000, 6)
  })

  it('formats small weights with a decimal', () => {
    expect(formatGrams(18.27)).toBe('18.3')
    expect(formatGrams(685.28)).toBe('685')
  })

  it('produces a copyable text version', () => {
    const text = batchToText('Country sourdough', calculate(countrySourdough(), { mode: 'flour', weight: 1000 }))
    expect(text).toContain('Levain build (100% hydration): 100 g flour + 100 g water')
    expect(text).toContain('Salt: 20 g (2%)')
  })
})
