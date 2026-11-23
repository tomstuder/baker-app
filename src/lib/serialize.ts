/**
 * Turn edited content back into files in the content repo's format (see that repo's README).
 * Output mirrors the hand-written style: block YAML, with tags and each ingredient on one line.
 */
import { Document, Scalar, isMap, isPair, isScalar, isSeq } from 'yaml'
import type { Bake, DiaryPost, Home, IngredientGroup, IngredientItem, Recipe } from '@/lib/content'

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Recalculate every weighed item's baker's % from grams (flour items = 100%). */
export function withComputedPct(groups: IngredientGroup[]): IngredientGroup[] {
  const base = groups.flatMap((g) => g.items).reduce((a, i) => a + (i.flour && i.grams ? i.grams : 0), 0)
  return groups.map((g) => ({
    ...g,
    items: g.items.map((i) => ({ ...i, pct: base > 0 && i.grams !== undefined ? round1((i.grams / base) * 100) : undefined })),
  }))
}

/** Drop undefined, empty strings, empty lists/maps and false flags so files stay tidy. */
function clean<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === false || v === '') continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
    out[k] = typeof v === 'string' ? v.trim() : v
  }
  return out as Partial<T>
}

function itemObject(i: IngredientItem) {
  return clean({
    name: i.name.trim(),
    amount: i.amount,
    grams: i.grams,
    pct: i.pct,
    flour: i.flour,
    hydration: i.flour ? undefined : i.hydration,
    water: i.flour || i.hydration !== undefined ? undefined : i.water,
    estimated: i.estimated,
    note: i.note,
  })
}

function toFile(
  data: Record<string, unknown>,
  body: string,
  flowPaths: (string | number)[][],
  comments: Record<string, string> = {},
  tweak?: (doc: Document) => void,
): string {
  const doc = new Document(data)
  if (isMap(doc.contents)) {
    for (const pair of doc.contents.items) {
      if (isPair(pair) && isScalar(pair.key) && typeof pair.key.value === 'string' && comments[pair.key.value]) {
        pair.key.commentBefore = ` ${comments[pair.key.value]}`
      }
    }
  }
  for (const path of flowPaths) {
    const node = doc.getIn(path, true)
    if (isSeq(node) || isMap(node)) node.flow = true
  }
  const ing = doc.get('ingredients', true)
  if (isSeq(ing)) {
    if (ing.items.length === 0) ing.flow = true
    for (const group of ing.items) {
      const items = isMap(group) ? group.get('items', true) : undefined
      if (isSeq(items)) for (const item of items.items) if (isMap(item)) item.flow = true
    }
  }
  tweak?.(doc)
  // Ingredient lines read best as `{ name: … }`; simple lists as `[a, b]`, matching the hand-written files.
  const yaml = doc.toString({ lineWidth: 0 }).replace(/^(\w+): \[ (.*) \]$/gm, '$1: [$2]')
  return `---\n${yaml}---\n\n${body.replace(/^\s+/, '').replace(/\s*$/, '\n')}`
}

export function serializeRecipe(r: Recipe): string {
  const groups = withComputedPct(
    r.ingredients
      .map((g) => ({ ...g, items: g.items.filter((i) => i.name.trim()) }))
      .filter((g) => g.items.length || g.group?.trim()),
  )
  const data = clean({
    title: r.title.trim(),
    category: r.category,
    tags: r.tags.map((t) => t.trim()).filter(Boolean),
    status: r.status,
    created: r.created,
    source: r.source,
    image: r.image,
    yield: r.yield,
    servings: r.servings,
    time: clean(r.time),
    oven: r.oven,
    equipment: r.equipment.map((e) => e.trim()).filter(Boolean),
  }) as Record<string, unknown>
  data.ingredients = groups.map((g) => ({ ...clean({ group: g.group, note: g.note }), items: g.items.map(itemObject) }))
  const base = groups.flatMap((g) => g.items).reduce((a, i) => a + (i.flour && i.grams ? i.grams : 0), 0)
  const comments: Record<string, string> = base > 0 ? { ingredients: `grams are the source of truth; pct is baker's % of the flour (${round1(base)} g = 100%).` } : {}
  return toFile(data, r.body, [['tags']], comments)
}

export function serializeHome(h: Home): string {
  const data = clean({
    name: h.name.trim(),
    tagline: h.tagline,
    hero: h.hero,
    portrait: h.portrait,
    featured: h.featured,
    social: clean(h.social),
  })
  return toFile(data, h.body, [['featured']])
}

export function serializeBake(b: Bake): string {
  const data = clean({
    date: b.date,
    title: b.title,
    rating: b.rating,
    batch: b.batch,
    changes: b.changes.map((c) => c.trim()).filter(Boolean),
    temps: clean({ kitchen: b.temps.kitchen, dough: b.temps.dough, oven: b.temps.oven }),
    timeline: b.timeline.filter((t) => t.time.trim() || t.step.trim()).map((t) => clean({ time: t.time, step: t.step })),
    photos: b.photos,
  })
  return toFile(data, b.body, [], {}, (doc) => {
    // One line per step; always quote times so "08:00" can't be read as a number by YAML 1.1 tools.
    const timeline = doc.get('timeline', true)
    if (!isSeq(timeline)) return
    for (const item of timeline.items) {
      if (!isMap(item)) continue
      item.flow = true
      const time = item.get('time', true)
      if (isScalar(time)) time.type = Scalar.QUOTE_DOUBLE
    }
  })
}

export function serializeDiary(p: DiaryPost): string {
  const data = clean({
    title: p.title.trim(),
    date: p.date,
    category: p.category,
    tags: p.tags.map((t) => t.trim()).filter(Boolean),
    image: p.image,
    related: p.related,
  })
  return toFile(data, p.body, [['tags']])
}
