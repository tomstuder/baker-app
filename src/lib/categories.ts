/**
 * Category editing: config.yml lists the categories, and each recipe / diary post names one in its
 * YAML header. Renaming or removing a category can rewrite both, all in one commit.
 */
import YAML from 'yaml'

export const CONFIG_PATH = 'config.yml'
export const CATEGORY_SECTIONS = ['recipes', 'diary'] as const
export type CategorySection = (typeof CATEGORY_SECTIONS)[number]
export type CategoryLists = Record<CategorySection, string[]>

const NEW_CONFIG_HEADER =
  '# Categories shown in Bake Book. Each recipe, journal post and reference has one category plus any tags.\n' +
  '# Edit these lists to add, rename or reorder categories.\n'

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * New config.yml text with these category lists. Only the lists that changed are rewritten, so
 * comments, the references list and everything else stay byte for byte.
 */
export function serializeConfig(original: string | null, lists: CategoryLists): string {
  const doc = original?.trim() ? YAML.parseDocument(original) : null
  if (!doc || doc.errors.length || !YAML.isMap(doc.contents)) {
    return NEW_CONFIG_HEADER + YAML.stringify({ categories: { recipes: lists.recipes, diary: lists.diary } })
  }
  for (const section of CATEGORY_SECTIONS) {
    const current = doc.getIn(['categories', section])
    const now = YAML.isSeq(current) ? current.toJSON().map(String) : null
    if (now && sameList(now, lists[section])) continue
    doc.setIn(['categories', section], doc.createNode(lists[section]))
  }
  return doc.toString()
}

/**
 * Set the `category:` line in a file's YAML header to `name`, leaving every other byte unchanged.
 * Returns the text unchanged if the file has no header or no category line.
 */
export function setCategory(text: string, name: string): string {
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n|$))/)
  if (!m) return text
  const value = YAML.stringify(name).trimEnd()
  const header = m[2].replace(/^category:.*$/m, () => `category: ${value}`)
  return m[1] + header + m[3] + text.slice(m[0].length)
}

/** A row in the editor. `original` is the name it had when the page opened (unset for new rows). */
export type CategoryRow = { key: string; name: string; original?: string }
/** A removed category that was in use: move its items to the row with key `moveTo`, or leave them. */
export type RemovedCategory = { original: string; moveTo: string | null }

/** First problem with the rows, or null if they can be saved. */
export function validateRows(rows: CategoryRow[], label: string): string | null {
  const names = rows.map((r) => r.name.trim())
  if (names.some((n) => !n)) return `A ${label} category has no name.`
  const lower = names.map((n) => n.toLowerCase())
  const dup = names.find((_, i) => lower.indexOf(lower[i]) !== i)
  return dup ? `"${dup}" is listed twice in ${label} categories.` : null
}

/** Old category → new category, for every rename and every removal whose items are moved. */
export function categoryMoves(rows: CategoryRow[], removed: RemovedCategory[]): Map<string, string> {
  const moves = new Map<string, string>()
  for (const r of rows) {
    if (r.original !== undefined && r.original !== r.name.trim()) moves.set(r.original, r.name.trim())
  }
  for (const x of removed) {
    const target = rows.find((r) => r.key === x.moveTo)
    if (target) moves.set(x.original, target.name.trim())
  }
  return moves
}

/** A recipe or diary post, as far as categories are concerned. */
export type Categorized = { path: string; title: string; category?: string }

/** The items that a set of moves will rewrite, with their new category. */
export function affectedItems(items: Categorized[], moves: Map<string, string>): (Categorized & { to: string })[] {
  return items.flatMap((it) => (it.category !== undefined && moves.has(it.category) ? [{ ...it, to: moves.get(it.category)! }] : []))
}
