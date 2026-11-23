/**
 * References: glossary, library (links, books, videos, files), conversions and techniques.
 * List-style references are YAML files; techniques are Markdown files like diary posts.
 */
import YAML, { Document, isMap, isSeq } from 'yaml'
import { parseDoc, readText, type Snapshot } from '@/lib/content'

export const GLOSSARY_PATH = 'references/glossary.yml'
export const LIBRARY_PATH = 'references/library.yml'
export const CONVERSIONS_PATH = 'references/conversions.yml'
export const TECHNIQUES_DIR = 'references/techniques'
export const FILES_DIR = 'references/files'

const str = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v).trim() || undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

function parseYaml(text: string | null): unknown {
  if (!text) return undefined
  try {
    return YAML.parse(text)
  } catch {
    return undefined
  }
}

/** YAML list file with a comment header; entries as block maps (readable diffs). */
function toYamlFile(header: string, key: string, items: Record<string, unknown>[], flowKeys: string[] = [], flowItems = false): string {
  const doc = new Document({ [key]: items })
  doc.commentBefore = header
    .split('\n')
    .map((l) => ` ${l}`)
    .join('\n')
  const seq = doc.get(key, true)
  if (isSeq(seq)) {
    if (seq.items.length === 0) seq.flow = true
    for (const item of seq.items) {
      if (!isMap(item)) continue
      if (flowItems) item.flow = true
      for (const k of flowKeys) {
        const node = item.get(k, true)
        if (isSeq(node)) node.flow = true
      }
    }
  }
  return doc.toString({ lineWidth: 0 }).replace(/^(\s+\w+): \[ (.*) \]$/gm, '$1: [$2]')
}

function clean<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)),
  )
}

// ---------- Glossary ----------

export type GlossaryEntry = { term: string; definition: string; key?: string }

export function parseGlossary(text: string | null): GlossaryEntry[] {
  return list(obj(parseYaml(text)).terms)
    .map((e) => ({ term: str(obj(e).term) ?? '', definition: str(obj(e).definition) ?? '' }))
    .filter((e) => e.term)
}

export const sortTerms = (entries: GlossaryEntry[]) => [...entries].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))

export function serializeGlossary(entries: GlossaryEntry[]): string {
  const items = sortTerms(entries.filter((e) => e.term.trim())).map((e) => clean({ term: e.term.trim(), definition: e.definition.trim() }))
  return toYamlFile('Glossary shown on the References page. Kept in A–Z order; definitions can use Markdown.', 'terms', items)
}

// ---------- Library ----------

export const LIBRARY_TYPES = ['website', 'video', 'book', 'article', 'file'] as const
export type LibraryType = (typeof LIBRARY_TYPES)[number]
export type LibraryItem = {
  type: LibraryType
  title: string
  url?: string
  /** For type "file": path relative to references/, e.g. files/2026-11-23-starter-guide.pdf */
  file?: string
  author?: string
  note?: string
  tags: string[]
  key?: string
}

export function parseLibrary(text: string | null): LibraryItem[] {
  return list(obj(parseYaml(text)).items)
    .map((raw) => {
      const o = obj(raw)
      const type = str(o.type) as LibraryType | undefined
      return {
        type: type && LIBRARY_TYPES.includes(type) ? type : str(o.file) ? 'file' : 'website',
        title: str(o.title) ?? '',
        url: str(o.url),
        file: str(o.file),
        author: str(o.author),
        note: str(o.note),
        tags: list(o.tags).map(String).filter(Boolean),
      } satisfies LibraryItem
    })
    .filter((i) => i.title)
}

export function serializeLibrary(items: LibraryItem[]): string {
  return toYamlFile(
    'Library shown on the References page: websites, videos, books, articles and uploaded files (in references/files/).',
    'items',
    items
      .filter((i) => i.title.trim())
      .map((i) =>
        clean({
          type: i.type,
          title: i.title.trim(),
          url: i.type === 'file' ? undefined : i.url?.trim(),
          file: i.type === 'file' ? i.file : undefined,
          author: i.author?.trim(),
          note: i.note?.trim(),
          tags: i.tags.map((t) => t.trim()).filter(Boolean),
        }),
      ),
    ['tags'],
  )
}

// ---------- Conversions ----------

export const VOLUME_UNITS = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48 } as const
export type VolumeUnit = keyof typeof VOLUME_UNITS
export type VolumeWeight = { name: string; unit: VolumeUnit; grams: number; key?: string }

/** grams for an amount of an ingredient, given its weight per cup/tbsp/tsp. */
export function volumeToGrams(row: VolumeWeight, amount: number, unit: VolumeUnit): number {
  const cups = amount * VOLUME_UNITS[unit]
  return (cups / VOLUME_UNITS[row.unit]) * row.grams
}

export function parseConversions(text: string | null): VolumeWeight[] {
  return list(obj(parseYaml(text)).volume)
    .map((raw) => {
      const o = obj(raw)
      const unit = str(o.unit) as VolumeUnit | undefined
      return { name: str(o.name) ?? '', unit: unit && unit in VOLUME_UNITS ? unit : 'cup', grams: num(o.grams) ?? NaN }
    })
    .filter((r) => r.name && Number.isFinite(r.grams) && r.grams > 0)
}

export function serializeConversions(rows: VolumeWeight[]): string {
  return toYamlFile(
    'Volume-to-weight table for the References converter. Approximate; adjust to match your own measuring.\nunit is cup, tbsp or tsp; grams is the weight of one of that unit.',
    'volume',
    rows.filter((r) => r.name.trim() && r.grams > 0).map((r) => ({ name: r.name.trim(), unit: r.unit, grams: r.grams })),
    [],
    true, // one line per row, like recipe ingredients
  )
}

/** Yeast equivalents relative to instant yeast (approximate, commonly used ratios). */
export const YEAST_FACTORS = { instant: 1, 'active dry': 1.25, fresh: 3 } as const
export type YeastType = keyof typeof YEAST_FACTORS
export const convertYeast = (grams: number, from: YeastType, to: YeastType) => (grams / YEAST_FACTORS[from]) * YEAST_FACTORS[to]

export const fToC = (f: number) => ((f - 32) * 5) / 9
export const cToF = (c: number) => (c * 9) / 5 + 32
export const GRAMS_PER_OUNCE = 28.349523125

// ---------- Techniques ----------

export type Technique = {
  slug: string
  path: string
  title: string
  tags: string[]
  status: 'draft' | 'published'
  created?: string
  image?: string
  summary?: string
  body: string
}

export function toTechnique(path: string, text: string): Technique {
  const { data: d, body } = parseDoc(text)
  const slug = path.split('/').pop()!.replace(/\.md$/, '')
  return {
    slug,
    path,
    title: str(d.title) ?? slug,
    tags: list(d.tags).map(String).filter(Boolean),
    status: str(d.status) === 'draft' ? 'draft' : 'published',
    created: str(d.created),
    image: str(d.image),
    summary: str(d.summary),
    body,
  }
}

export function serializeTechnique(t: Technique): string {
  const doc = new Document(
    clean({
      title: t.title.trim(),
      summary: t.summary?.trim(),
      tags: t.tags.map((x) => x.trim()).filter(Boolean),
      status: t.status === 'draft' ? 'draft' : undefined,
      created: t.created,
      image: t.image,
    }),
  )
  const tags = doc.get('tags', true)
  if (isSeq(tags)) tags.flow = true
  const yaml = doc.toString({ lineWidth: 0 }).replace(/^tags: \[ (.*) \]$/m, 'tags: [$1]')
  return `---\n${yaml}---\n\n${t.body.replace(/^\s+/, '').replace(/\s*$/, '\n')}`
}

export function newTechniquePath(snap: Snapshot | undefined, title: string): string {
  const slug =
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'technique'
  let path = `${TECHNIQUES_DIR}/${slug}.md`
  for (let n = 2; snap?.files.has(path); n++) path = `${TECHNIQUES_DIR}/${slug}-${n}.md`
  return path
}

// ---------- Loaders ----------

export async function loadGlossary(snap: Snapshot) {
  return sortTerms(parseGlossary(await readText(snap, GLOSSARY_PATH)))
}
export async function loadLibrary(snap: Snapshot) {
  return parseLibrary(await readText(snap, LIBRARY_PATH))
}
export async function loadConversions(snap: Snapshot) {
  return parseConversions(await readText(snap, CONVERSIONS_PATH))
}
export async function loadTechniques(snap: Snapshot): Promise<Technique[]> {
  const paths = [...snap.files.keys()].filter((p) => new RegExp(`^${TECHNIQUES_DIR}/[^/]+\\.md$`).test(p))
  const items = await Promise.all(paths.map(async (p) => toTechnique(p, (await readText(snap, p)) ?? '')))
  return items.sort((a, b) => a.title.localeCompare(b.title))
}
export async function loadTechnique(snap: Snapshot, slug: string): Promise<Technique | null> {
  const path = `${TECHNIQUES_DIR}/${slug}.md`
  const text = await readText(snap, path)
  return text === null ? null : toTechnique(path, text)
}
