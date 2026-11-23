import { describe, expect, it } from 'vitest'
import { bakeCounts, newBakePath, relativePath, resolvePath, toBake, type Snapshot } from './content'
import { serializeBake } from './serialize'

const BAKE = `---
date: 2026-11-23
title: Higher hydration
rating: 4
batch: 2 loaves (900 g each)
changes:
  - Water 75% → 78%
  - Bulk 30 min longer
temps:
  kitchen: 72°F
  dough: 78°F
  oven: 475°F
timeline:
  - { time: "08:00", step: Build levain }
  - { time: "14:00", step: Mix and autolyse }
photos:
  - ../images/2026-11-23-crumb.jpg
---

More open crumb. Slightly flat — shape tighter next time.
`
const PATH = 'recipes/sourdough-base/bakes/2026-11-23-higher-hydration.md'

describe('bakes', () => {
  it('parses a bake file', () => {
    const b = toBake(PATH, BAKE)
    expect(b).toMatchObject({
      id: '2026-11-23-higher-hydration',
      recipe: 'sourdough-base',
      date: '2026-11-23',
      rating: 4,
      changes: ['Water 75% → 78%', 'Bulk 30 min longer'],
      temps: { kitchen: '72°F', dough: '78°F', oven: '475°F' },
      timeline: [
        { time: '08:00', step: 'Build levain' },
        { time: '14:00', step: 'Mix and autolyse' },
      ],
      photos: ['../images/2026-11-23-crumb.jpg'],
    })
    expect(resolvePath(PATH, b.photos[0])).toBe('recipes/sourdough-base/images/2026-11-23-crumb.jpg')
  })

  it('writes the same file back', () => {
    expect(serializeBake(toBake(PATH, BAKE))).toBe(BAKE)
  })

  it('quotes text with commas or colons so one-line steps survive', () => {
    const b = toBake(PATH, BAKE)
    b.timeline = [{ time: 'Day 2, 7am', step: 'Shape, then fridge: 12 h' }]
    b.changes = ['Salt: 2.2%, not 2%']
    const again = toBake(PATH, serializeBake(b))
    expect(again.timeline).toEqual(b.timeline)
    expect(again.changes).toEqual(b.changes)
  })

  it('takes the date from the file name and clamps the rating', () => {
    const b = toBake('recipes/x/bakes/2026-01-02.md', '---\nrating: 9\n---\n')
    expect(b.date).toBe('2026-01-02')
    expect(b.rating).toBe(5)
  })

  it('names new bake files without clobbering existing ones', () => {
    const snap: Snapshot = { commit: 'c', files: new Map([['recipes/x/bakes/2026-11-23.md', 's']]) }
    expect(newBakePath(snap, 'x', '2026-11-23')).toBe('recipes/x/bakes/2026-11-23-2.md')
    expect(newBakePath(snap, 'x', '2026-11-23', 'Rye test!')).toBe('recipes/x/bakes/2026-11-23-rye-test.md')
  })

  it('counts bakes per recipe from the file list', () => {
    const snap: Snapshot = {
      commit: 'c',
      files: new Map([
        ['recipes/a/recipe.md', '1'],
        ['recipes/a/bakes/2026-01-01.md', '2'],
        ['recipes/a/bakes/2026-01-02.md', '3'],
        ['recipes/a/images/x.jpg', '4'],
        ['recipes/b/bakes/2026-01-01.md', '5'],
      ]),
    }
    expect(Object.fromEntries(bakeCounts(snap))).toEqual({ a: 2, b: 1 })
  })
})

describe('relativePath', () => {
  it('walks up and across folders', () => {
    expect(relativePath('recipes/a/bakes/x.md', 'recipes/a/images/p.jpg')).toBe('../images/p.jpg')
    expect(relativePath('recipes/a/recipe.md', 'recipes/a/images/p.jpg')).toBe('images/p.jpg')
    expect(relativePath('home.md', 'images/home/h.jpg')).toBe('images/home/h.jpg')
  })
})
