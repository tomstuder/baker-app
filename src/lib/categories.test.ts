import { describe, expect, it } from 'vitest'
import YAML from 'yaml'
import { affectedItems, categoryMoves, serializeConfig, setCategory, validateRows } from './categories'

const CONFIG = `# Categories shown in Bake Book. Each recipe, diary post and reference has one category plus any tags.
# Edit these lists to add, rename or reorder categories.
categories:
  recipes:
    - Bread
    - Enriched bread
    - Quick breads & muffins
  diary:
    - Bake log
    - Experiment
  references:
    - Techniques
    - Glossary
`

describe('serializeConfig', () => {
  it('reproduces an unchanged file byte for byte', () => {
    expect(serializeConfig(CONFIG, { recipes: ['Bread', 'Enriched bread', 'Quick breads & muffins'], diary: ['Bake log', 'Experiment'] })).toBe(CONFIG)
  })

  it('rewrites only the changed list, keeping comments and references', () => {
    const out = serializeConfig(CONFIG, { recipes: ['Enriched bread', 'Bread', 'Pastry'], diary: ['Bake log', 'Experiment'] })
    expect(out).toBe(CONFIG.replace('    - Bread\n    - Enriched bread\n    - Quick breads & muffins\n', '    - Enriched bread\n    - Bread\n    - Pastry\n'))
  })

  it('quotes names that need it', () => {
    const out = serializeConfig(CONFIG, { recipes: ['Bread: rye', '#1 loaves'], diary: [] })
    expect(YAML.parse(out).categories).toEqual({ recipes: ['Bread: rye', '#1 loaves'], diary: [], references: ['Techniques', 'Glossary'] })
  })

  it('creates a config when there is none', () => {
    const out = serializeConfig(null, { recipes: ['Bread'], diary: ['Experiment'] })
    expect(out.startsWith('# Categories')).toBe(true)
    expect(YAML.parse(out)).toEqual({ categories: { recipes: ['Bread'], diary: ['Experiment'] } })
  })
})

describe('setCategory', () => {
  const recipe = '---\ntitle: Country sourdough\ncategory: Bread\ntags: [sourdough]\n---\n\n## Method\n\ncategory: not this one\n'

  it('changes only the header line', () => {
    expect(setCategory(recipe, 'Breads')).toBe(recipe.replace('category: Bread\n', 'category: Breads\n'))
  })

  it('quotes values that need it', () => {
    const out = setCategory(recipe, 'Bread: rye')
    expect(out).toContain('category: "Bread: rye"\n')
    expect(out.endsWith('category: not this one\n')).toBe(true)
  })

  it('leaves files without a header alone', () => {
    expect(setCategory('# Just text\n', 'X')).toBe('# Just text\n')
  })
})

describe('validateRows', () => {
  it('catches empty and duplicate names', () => {
    expect(validateRows([{ key: 'a', name: ' ' }], 'recipe')).toMatch(/no name/)
    expect(validateRows([{ key: 'a', name: 'Bread' }, { key: 'b', name: 'bread ' }], 'recipe')).toMatch(/listed twice/)
    expect(validateRows([{ key: 'a', name: 'Bread' }, { key: 'b', name: 'Pastry' }], 'recipe')).toBeNull()
  })
})

describe('categoryMoves / affectedItems', () => {
  const rows = [
    { key: 'a', name: 'Breads ', original: 'Bread' },
    { key: 'b', name: 'Pastry', original: 'Pastry' },
    { key: 'c', name: 'Cookies' },
  ]

  it('maps renames and moved removals, and skips unchanged rows and kept removals', () => {
    const moves = categoryMoves(rows, [
      { original: 'Cakes', moveTo: 'c' },
      { original: 'Noodles', moveTo: null },
    ])
    expect([...moves]).toEqual([
      ['Bread', 'Breads'],
      ['Cakes', 'Cookies'],
    ])
  })

  it('handles swapped names', () => {
    const moves = categoryMoves([{ key: 'a', name: 'B', original: 'A' }, { key: 'b', name: 'A', original: 'B' }], [])
    const items = [{ path: '1', title: 'One', category: 'A' }, { path: '2', title: 'Two', category: 'B' }]
    expect(affectedItems(items, moves).map((i) => i.to)).toEqual(['B', 'A'])
  })

  it('lists only the items whose category moves', () => {
    const items = [
      { path: 'recipes/a/recipe.md', title: 'A', category: 'Bread' },
      { path: 'recipes/b/recipe.md', title: 'B', category: 'Pastry' },
      { path: 'recipes/c/recipe.md', title: 'C' },
    ]
    expect(affectedItems(items, categoryMoves(rows, []))).toEqual([{ ...items[0], to: 'Breads' }])
  })
})
