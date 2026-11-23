/**
 * Read-only access to the content repo (tomstuder/Recipes). Format spec: that repo's README.
 *
 * Loading costs two GitHub API calls (branch, then recursive tree), cached for a few minutes because
 * visitors without a token get 60 API calls an hour. File contents come from raw.githubusercontent.com
 * pinned to the commit SHA, and are cached in localStorage by blob SHA, so unchanged files are never
 * downloaded twice.
 */
import YAML from 'yaml'

export const CONTENT_REPO = 'tomstuder/Recipes'
export const CONTENT_BRANCH = 'main'
export const CONTENT_REPO_URL = `https://github.com/${CONTENT_REPO}`

export type Snapshot = { commit: string; files: Map<string, string> /* path → blob sha */ }

export class ContentError extends Error {
  readonly kind: 'rate-limit' | 'not-found' | 'network'
  constructor(message: string, kind: ContentError['kind']) {
    super(message)
    this.kind = kind
  }
}

// ---------- low-level ----------

const SNAPSHOT_KEY = 'content:snapshot:v1'
const SNAPSHOT_TTL_MS = 5 * 60 * 1000

function storageGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null
  }
}
function storageSet(store: Storage | undefined, key: string, value: string) {
  try {
    store?.setItem(key, value)
  } catch {
    /* full or unavailable: caching is optional */
  }
}
const session = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage)
const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

// Set while the owner is signed in, so reads use their 5,000/hour limit and see edits right away.
let authToken: string | null = null
export function setAuthToken(token: string | null) {
  authToken = token
}

async function githubApi<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: 'application/vnd.github+json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    })
  } catch {
    throw new ContentError("Couldn't reach GitHub. Check your connection and try again.", 'network')
  }
  if (res.status === 403 || res.status === 429) {
    throw new ContentError('GitHub is limiting requests right now. Try again in a few minutes.', 'rate-limit')
  }
  if (!res.ok) throw new ContentError(`GitHub returned ${res.status} for ${path}.`, res.status === 404 ? 'not-found' : 'network')
  return res.json() as Promise<T>
}

let snapshotPromise: Promise<Snapshot> | null = null

/** The current file list of the content repo. Shared by every caller on the page. */
export function getSnapshot(): Promise<Snapshot> {
  snapshotPromise ??= loadSnapshot().catch((e) => {
    snapshotPromise = null
    throw e
  })
  return snapshotPromise
}

async function loadSnapshot(): Promise<Snapshot> {
  const cached = storageGet(session(), SNAPSHOT_KEY)
  if (cached) {
    try {
      const { at, commit, files } = JSON.parse(cached) as { at: number; commit: string; files: [string, string][] }
      if (Date.now() - at < SNAPSHOT_TTL_MS) return { commit, files: new Map(files) }
    } catch {
      /* ignore corrupt cache */
    }
  }

  const branch = await githubApi<{ commit: { sha: string; commit: { tree: { sha: string } } } }>(
    `/repos/${CONTENT_REPO}/branches/${CONTENT_BRANCH}`,
  )
  const tree = await githubApi<{ tree: { path: string; sha: string; type: string }[] }>(
    `/repos/${CONTENT_REPO}/git/trees/${branch.commit.commit.tree.sha}?recursive=1`,
  )
  const files = tree.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t.sha] as [string, string])
  storageSet(session(), SNAPSHOT_KEY, JSON.stringify({ at: Date.now(), commit: branch.commit.sha, files }))
  return { commit: branch.commit.sha, files: new Map(files) }
}

/** Forget the cached file list, e.g. after saving, so the next read sees the new commit. */
export function invalidateSnapshot() {
  snapshotPromise = null
  try {
    sessionStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    /* ignore */
  }
}

/** Seed the file cache with text we just wrote, so reading it back doesn't wait on the CDN. */
export function cacheFile(blobSha: string, text: string) {
  storageSet(local(), `blob:${blobSha}`, text)
}

/** URL of a file at the snapshot's commit (works for images too). */
export function rawUrl(snap: Snapshot, path: string): string {
  return rawUrlAt(snap.commit, path)
}

/** URL of a file at a specific commit, e.g. one just created by an upload. */
export function rawUrlAt(commit: string, path: string): string {
  return `https://raw.githubusercontent.com/${CONTENT_REPO}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** Link to a file's page on GitHub, e.g. for "view history". */
export function githubFileUrl(path: string, view: 'blob' | 'commits' = 'blob'): string {
  return `${CONTENT_REPO_URL}/${view}/${CONTENT_BRANCH}/${path}`
}

/** Resolve a path written inside a content file (e.g. `images/hero.jpg`) relative to that file's folder. */
export function resolvePath(fromFile: string, rel: string): string {
  if (/^[a-z]+:/i.test(rel) || rel.startsWith('//')) return rel
  const parts = rel.startsWith('/') ? [] : fromFile.split('/').slice(0, -1)
  for (const seg of rel.replace(/^\//, '').split('/')) {
    if (seg === '..') parts.pop()
    else if (seg && seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

/** Path from a content file's folder to a repo path, e.g. (recipes/a/bakes/x.md, recipes/a/images/p.jpg) → ../images/p.jpg */
export function relativePath(fromFile: string, repoPath: string): string {
  const from = fromFile.split('/').slice(0, -1)
  const to = repoPath.split('/')
  let i = 0
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++
  return [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/')
}

/** Absolute URL for an image path written in a content file. */
export function assetUrl(snap: Snapshot, fromFile: string, rel: string | undefined): string | undefined {
  if (!rel) return undefined
  const resolved = resolvePath(fromFile, rel)
  return /^[a-z]+:|^\/\//i.test(resolved) ? resolved : rawUrl(snap, resolved)
}

const inflight = new Map<string, Promise<string>>()

export async function readText(snap: Snapshot, path: string): Promise<string | null> {
  const sha = snap.files.get(path)
  if (!sha) return null
  const key = `blob:${sha}`
  const cached = storageGet(local(), key)
  if (cached !== null) return cached
  if (!inflight.has(key)) {
    inflight.set(
      key,
      fetch(rawUrl(snap, path))
        .then((r) => {
          if (!r.ok) throw new ContentError(`Couldn't load ${path} (${r.status}).`, 'network')
          return r.text()
        })
        .then((text) => {
          storageSet(local(), key, text)
          return text
        })
        .finally(() => inflight.delete(key)),
    )
  }
  return inflight.get(key)!
}

/** Split a file into its YAML header block and Markdown body. */
export function parseDoc(text: string): { data: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/)
  if (!m) return { data: {}, body: text }
  let data: unknown
  try {
    data = YAML.parse(m[1])
  } catch {
    data = {}
  }
  return { data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {}, body: m[2] }
}

// ---------- typed content ----------

export type IngredientItem = {
  name: string
  amount?: string
  grams?: number
  pct?: number
  flour?: boolean
  hydration?: number
  water?: number
  estimated?: boolean
  note?: string
  /** Editor-only row key; never written to files. */
  key?: string
}
export type IngredientGroup = { group?: string; note?: string; items: IngredientItem[]; key?: string }
export type Status = 'draft' | 'testing' | 'tested'

export type Recipe = {
  slug: string
  path: string
  title: string
  category?: string
  tags: string[]
  status: Status
  created?: string
  yield?: string
  servings?: string
  time: Record<string, string>
  oven?: string
  equipment: string[]
  ingredients: IngredientGroup[]
  image?: string
  source?: string
  body: string
}

export type DiaryPost = {
  slug: string
  path: string
  title: string
  date?: string
  category?: string
  tags: string[]
  image?: string
  /** Linked recipes ("sourdough-base") or bakes ("sourdough-base/2026-11-20-higher-hydration"). */
  related: string[]
  excerpt: string
  body: string
}

export type Home = {
  name: string
  tagline?: string
  hero?: string
  portrait?: string
  featured: string[]
  social: { instagram?: string; linkedin?: string; facebook?: string }
  body: string
}

export type Bake = {
  /** File name without .md, e.g. 2026-11-23 or 2026-11-23-higher-hydration. */
  id: string
  path: string
  recipe: string
  date: string
  title?: string
  /** 1–5 */
  rating?: number
  batch?: string
  changes: string[]
  temps: { kitchen?: string; dough?: string; oven?: string }
  timeline: { time: string; step: string; key?: string }[]
  /** Paths relative to the bake file, e.g. ../images/2026-11-23-crumb.jpg */
  photos: string[]
  body: string
}

export type Config = { categories: { recipes: string[]; diary: string[]; references: string[] } }

const str = (v: unknown): string | undefined => (v === undefined || v === null || v === '' ? undefined : String(v))
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : typeof v === 'string' ? [v] : [])
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function toItem(v: unknown): IngredientItem | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = str(o.name)
  if (!name) return null
  return {
    name,
    amount: str(o.amount),
    grams: num(o.grams),
    pct: num(o.pct),
    flour: o.flour === true,
    hydration: num(o.hydration),
    water: num(o.water),
    estimated: o.estimated === true,
    note: str(o.note),
  }
}

export function toRecipe(path: string, text: string): Recipe {
  const { data: d, body } = parseDoc(text)
  const slug = path.split('/')[1]
  const groups = Array.isArray(d.ingredients) ? d.ingredients : []
  const status = str(d.status)
  return {
    slug,
    path,
    title: str(d.title) ?? slug,
    category: str(d.category),
    tags: strList(d.tags),
    status: status === 'tested' || status === 'testing' ? status : 'draft',
    created: str(d.created),
    yield: str(d.yield),
    servings: str(d.servings),
    time: d.time && typeof d.time === 'object' ? Object.fromEntries(Object.entries(d.time).map(([k, v]) => [k, String(v)])) : {},
    oven: str(d.oven),
    equipment: strList(d.equipment),
    ingredients: groups
      .map((g): IngredientGroup | null => {
        if (!g || typeof g !== 'object') return null
        const o = g as Record<string, unknown>
        const items = (Array.isArray(o.items) ? o.items : []).map(toItem).filter((x): x is IngredientItem => x !== null)
        return { group: str(o.group), note: str(o.note), items }
      })
      .filter((g): g is IngredientGroup => g !== null),
    image: str(d.image),
    source: str(d.source),
    body,
  }
}

function excerptOf(body: string): string {
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('!['))
  const plain = (para ?? '').replace(/[*_`>#]/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ')
  return plain.length > 220 ? plain.slice(0, 217).trimEnd() + '…' : plain
}

export function toDiaryPost(path: string, text: string): DiaryPost {
  const { data: d, body } = parseDoc(text)
  const file = path.split('/').pop()!.replace(/\.md$/, '')
  return {
    slug: file,
    path,
    title: str(d.title) ?? file,
    date: str(d.date) ?? str(d.created) ?? file.match(/^\d{4}-\d{2}-\d{2}/)?.[0],
    category: str(d.category),
    tags: strList(d.tags),
    image: str(d.image),
    related: strList(d.related),
    excerpt: excerptOf(body),
    body,
  }
}

/** Repo path for a new diary post, avoiding names already taken. */
export function newDiaryPath(snap: Snapshot | undefined, date: string, title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
  const base = `diary/${date}${slug ? `-${slug}` : ''}`
  let path = `${base}.md`
  for (let n = 2; snap?.files.has(path); n++) path = `${base}-${n}.md`
  return path
}

/** Used until home.md loads, or if it can't be loaded. */
export const DEFAULT_HOME: Home = {
  name: 'Tom Studer',
  tagline: 'Home baker',
  featured: [],
  social: {
    instagram: 'https://www.instagram.com/tomstuder',
    linkedin: 'https://www.linkedin.com/in/tomstuder/',
    facebook: 'https://www.facebook.com/tomstuder',
  },
  body: '',
}

export function toHome(text: string): Home {
  const { data: d, body } = parseDoc(text)
  const social = (d.social && typeof d.social === 'object' ? d.social : {}) as Record<string, unknown>
  return {
    name: str(d.name) ?? DEFAULT_HOME.name,
    tagline: str(d.tagline),
    hero: str(d.hero),
    portrait: str(d.portrait),
    featured: strList(d.featured),
    social: { instagram: str(social.instagram), linkedin: str(social.linkedin), facebook: str(social.facebook) },
    body,
  }
}

export function toBake(path: string, text: string): Bake {
  const { data: d, body } = parseDoc(text)
  const [, recipe, , file] = path.split('/')
  const id = file.replace(/\.md$/, '')
  const temps = (d.temps && typeof d.temps === 'object' ? d.temps : {}) as Record<string, unknown>
  const rating = num(d.rating)
  return {
    id,
    path,
    recipe,
    date: str(d.date) ?? id.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '',
    title: str(d.title),
    rating: rating !== undefined ? Math.min(5, Math.max(1, Math.round(rating))) : undefined,
    batch: str(d.batch),
    changes: strList(d.changes),
    temps: { kitchen: str(temps.kitchen), dough: str(temps.dough), oven: str(temps.oven) },
    timeline: (Array.isArray(d.timeline) ? d.timeline : [])
      .map((t) => {
        const o = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
        return { time: str(o.time) ?? '', step: str(o.step) ?? '' }
      })
      .filter((t) => t.time || t.step),
    photos: strList(d.photos),
    body,
  }
}

/** Repo path for a new bake, avoiding names already taken. */
export function newBakePath(snap: Snapshot | undefined, recipe: string, date: string, title?: string): string {
  const slug = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  const base = `recipes/${recipe}/bakes/${date}${slug ? `-${slug}` : ''}`
  let path = `${base}.md`
  for (let n = 2; snap?.files.has(path); n++) path = `${base}-${n}.md`
  return path
}

// ---------- loaders ----------

const RECIPE_PATH = /^recipes\/[^/]+\/recipe\.md$/
const DIARY_PATH = /^diary\/[^/]+\.md$/

export async function loadRecipes(snap: Snapshot): Promise<Recipe[]> {
  const paths = [...snap.files.keys()].filter((p) => RECIPE_PATH.test(p))
  const recipes = await Promise.all(paths.map(async (p) => toRecipe(p, (await readText(snap, p)) ?? '')))
  return recipes.sort((a, b) => a.title.localeCompare(b.title))
}

export async function loadRecipe(snap: Snapshot, slug: string): Promise<Recipe | null> {
  const path = `recipes/${slug}/recipe.md`
  const text = await readText(snap, path)
  return text === null ? null : toRecipe(path, text)
}

const bakePaths = (snap: Snapshot, recipe: string) =>
  [...snap.files.keys()].filter((p) => p.startsWith(`recipes/${recipe}/bakes/`) && /^[^/]+\.md$/.test(p.slice(`recipes/${recipe}/bakes/`.length)))

/** Number of bakes logged for each recipe, from the file list alone (no downloads). */
export function bakeCounts(snap: Snapshot): Map<string, number> {
  const counts = new Map<string, number>()
  for (const p of snap.files.keys()) {
    const m = p.match(/^recipes\/([^/]+)\/bakes\/[^/]+\.md$/)
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
  }
  return counts
}

/** All bakes for a recipe, newest first. */
export async function loadBakes(snap: Snapshot, recipe: string): Promise<Bake[]> {
  const bakes = await Promise.all(bakePaths(snap, recipe).map(async (p) => toBake(p, (await readText(snap, p)) ?? '')))
  return bakes.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export async function loadBake(snap: Snapshot, recipe: string, id: string): Promise<Bake | null> {
  const path = `recipes/${recipe}/bakes/${id}.md`
  const text = await readText(snap, path)
  return text === null ? null : toBake(path, text)
}

export async function loadDiary(snap: Snapshot): Promise<DiaryPost[]> {
  const paths = [...snap.files.keys()].filter((p) => DIARY_PATH.test(p))
  const posts = await Promise.all(paths.map(async (p) => toDiaryPost(p, (await readText(snap, p)) ?? '')))
  return posts.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.slug.localeCompare(a.slug))
}

export async function loadDiaryPost(snap: Snapshot, slug: string): Promise<DiaryPost | null> {
  const path = `diary/${slug}.md`
  const text = await readText(snap, path)
  return text === null ? null : toDiaryPost(path, text)
}

export async function loadHome(snap: Snapshot): Promise<Home> {
  const text = await readText(snap, 'home.md')
  return text === null ? DEFAULT_HOME : toHome(text)
}

export async function loadConfig(snap: Snapshot): Promise<Config> {
  const text = await readText(snap, 'config.yml')
  const fallback: Config = { categories: { recipes: [], diary: [], references: [] } }
  if (!text) return fallback
  try {
    const d = YAML.parse(text) as { categories?: Partial<Config['categories']> }
    return {
      categories: {
        recipes: strList(d?.categories?.recipes),
        diary: strList(d?.categories?.diary),
        references: strList(d?.categories?.references),
      },
    }
  } catch {
    return fallback
  }
}
