import { describe, expect, it } from 'vitest'
import {
  convertYeast,
  cToF,
  fToC,
  parseConversions,
  parseGlossary,
  parseLibrary,
  serializeConversions,
  serializeGlossary,
  serializeLibrary,
  serializeTechnique,
  toTechnique,
  volumeToGrams,
} from './references'

describe('glossary', () => {
  it('round-trips and keeps A–Z order', () => {
    const entries = [
      { term: 'Levain', definition: 'A sourdough **preferment**.' },
      { term: 'autolyse', definition: 'Resting flour and water before mixing in the rest.' },
    ]
    const text = serializeGlossary(entries)
    expect(text.startsWith('# Glossary shown')).toBe(true)
    expect(parseGlossary(text).map((e) => e.term)).toEqual(['autolyse', 'Levain'])
    expect(serializeGlossary(parseGlossary(text))).toBe(text)
  })

  it('tolerates a missing or broken file', () => {
    expect(parseGlossary(null)).toEqual([])
    expect(parseGlossary('terms: [oops')).toEqual([])
  })
})

describe('library', () => {
  it('round-trips links, books and files', () => {
    const items = parseLibrary(`items:
  - type: website
    title: Ingredient weight chart
    url: https://www.kingarthurbaking.com/learn/ingredient-weight-chart
    tags: [conversions]
  - type: book
    title: Flour Water Salt Yeast
    author: Ken Forkish
  - type: file
    title: Starter feeding schedule
    file: files/2026-11-23-starter.pdf
    url: https://ignored.example
`)
    expect(items.map((i) => i.type)).toEqual(['website', 'book', 'file'])
    const out = serializeLibrary(items)
    expect(out).toContain('    tags: [conversions]')
    expect(out).not.toContain('ignored.example') // files don't keep a url
    expect(parseLibrary(out)).toEqual(items.map((i) => (i.type === 'file' ? { ...i, url: undefined } : i)))
  })
})

describe('conversions', () => {
  const rows = parseConversions(`volume:
  - { name: All-purpose flour, unit: cup, grams: 120 }
  - { name: Table salt, unit: tsp, grams: 6 }
  - { name: Broken, unit: cup }
`)

  it('parses and drops rows without grams', () => {
    expect(rows.map((r) => r.name)).toEqual(['All-purpose flour', 'Table salt'])
  })

  it('writes one line per row', () => {
    const out = serializeConversions(rows)
    expect(out).toContain('  - { name: All-purpose flour, unit: cup, grams: 120 }')
    expect(parseConversions(out)).toEqual(rows)
  })

  it('quotes names with commas or colons', () => {
    const tricky = [{ name: 'Sugar, granulated: fine', unit: 'cup' as const, grams: 198 }]
    expect(parseConversions(serializeConversions(tricky))).toEqual(tricky)
  })

  it('converts volume to grams across units', () => {
    expect(volumeToGrams(rows[0], 1.5, 'cup')).toBeCloseTo(180)
    expect(volumeToGrams(rows[0], 2, 'tbsp')).toBeCloseTo(15)
    expect(volumeToGrams(rows[1], 1, 'tbsp')).toBeCloseTo(18)
  })

  it('converts temperatures and yeast', () => {
    expect(fToC(350)).toBeCloseTo(176.67, 2)
    expect(cToF(230)).toBeCloseTo(446)
    expect(convertYeast(10, 'active dry', 'instant')).toBeCloseTo(8)
    expect(convertYeast(7, 'instant', 'fresh')).toBeCloseTo(21)
  })
})

describe('techniques', () => {
  it('parses a technique file', () => {
    const t = toTechnique('references/techniques/sourdough-starter.md', '---\ntitle: How to Create a Sourdough Starter\ncategory: Techniques\ntags: [sourdough, starter]\nstatus: draft\ncreated: 2021-01-28\n---\n\n# How to Create a Sourdough Starter\n')
    const again = toTechnique(t.path, serializeTechnique(t))
    expect(again).toEqual(t)
    expect(serializeTechnique(t)).toContain('tags: [sourdough, starter]\nstatus: draft')
    expect(t).toMatchObject({ slug: 'sourdough-starter', title: 'How to Create a Sourdough Starter', status: 'draft', tags: ['sourdough', 'starter'], created: '2021-01-28' })
  })
})
