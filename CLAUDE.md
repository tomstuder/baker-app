# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Bake Book": a personal baking web app (calculator, recipes with bake logs, journal, references, bio home page). It's a static React site on GitHub Pages at https://tomstuder.github.io/baker-app/. There are **two repos**:

- **`tomstuder/baker-app`** (this repo): app code only. Pushing to `main` deploys.
- **`tomstuder/Recipes`**: all content, i.e. the "database". **Its README is the spec for every file format.** The app reads it live and writes to it through the GitHub API, so content changes need no deploy.

## Commands

```sh
npm run dev       # http://localhost:5173/baker-app/ (the /baker-app/ base path is required); reads live Recipes
npm test          # vitest run
npx vitest run src/lib/bakers.test.ts      # one file
npx vitest run -t "overall hydration"      # by test name
npm run lint      # oxlint (warnings in src/components/ui/ are shadcn's and expected)
npm run build     # tsc -b, then vite build into dist/
npx shadcn@latest add <component>
```

Deploy: pushing to `main` runs `.github/workflows/deploy.yml` (Pages `build_type` is `workflow`). Check with `gh run list` or `gh run watch`.

## Architecture

**Stack:** Vite + React 19 + TypeScript, Tailwind v4 via `@tailwindcss/vite` (the theme lives in `src/index.css`; there's no tailwind.config), shadcn/ui `radix-nova` + lucide, `yaml`, `react-markdown` + `remark-gfm`, `@dnd-kit`, `sonner`. The `@/` alias points to `src/` (vite.config.ts + tsconfigs).

**GitHub Pages constraints:**
- `base: '/baker-app/'` in `vite.config.ts` must match the repo name (use `'/'` with a custom domain).
- `HashRouter` (`src/main.tsx`), because Pages can't rewrite deep links.

**Routing:** `src/App.tsx`. Every route is nested in `components/layout.tsx` (header, mobile Sheet menu, footer with social links and "Owner sign-in"). Menu entries come from `lib/nav.ts`. Editor pages are `lazy()` routes, so visitors never download dnd-kit or the editors. Routes:
- `/` home
- `/calculator`
- `/recipes`, `/recipes/:slug`, `/recipes/new`, `/recipes/:slug/edit`, `/recipes/:slug/bakes/new`, `/recipes/:slug/bakes/:bake/edit`
- `/journal`, `/journal/:slug`, `/journal/new`, `/journal/:slug/edit` (the journal was called the diary: `/diary/*` redirects, and the content folder, `config.yml` key and code names are still `diary`)
- `/references?tab=converter|techniques|glossary|library`, `/references/techniques/:slug` (plus `/new` and `/:slug/edit`), `/references/edit/glossary|library|conversions`
- `/edit/home`, `/edit/categories?from=recipes|journal`

**Reading content** (`lib/content.ts`):
- `getSnapshot()` makes 2 GitHub API calls (`branches/main`, then the recursive `git/trees`) and caches the result 5 minutes in sessionStorage. Visitors without a token get only 60 API calls an hour, so never add per-file API reads.
- Files come from `raw.githubusercontent.com/<repo>/<commitSha>/<path>` and are cached in localStorage by blob SHA.
- `parseDoc` splits the YAML header from the Markdown body.
- Typed loaders: `loadRecipes`/`loadRecipe`, `loadBakes`/`loadBake`, `bakeCounts` (from the file list alone), `loadDiary`/`loadDiaryPost`, `loadHome`, `loadConfig` (category lists). `lib/references.ts` loads the glossary, library, conversions and techniques; `lib/related.ts` resolves diary `related` refs.
- `hooks/use-content.ts` gives pages `{ data, snap, error, loading }`, keyed by a string.
- Paths inside content files are relative to that file: `resolvePath` and `relativePath` convert, and `assetUrl` turns them into raw URLs. Photos live in `images/` next to the content (`recipes/<slug>/images/`, `diary/images/`, `references/techniques/images/`, `images/home/`); bake photos are `../images/…`.

**Writing content** (only when unlocked):
- Auth:
  - `components/auth-provider.tsx` holds the sign-in and unlock dialogs; `lib/auth-context.ts` provides `useAuth()` with status `signed-out` | `locked` | `unlocked`.
  - `lib/token-vault.ts` encrypts the token with AES-GCM using a PBKDF2 (600k) key from the passphrase. Only ciphertext is stored (`auth:vault:v1`); the plain token lives in memory.
  - Only fine-grained `github_pat_` tokens are accepted.
  - `components/auth-control.tsx` has `<IfEditing>`, the header lock and sign-out (with confirmation) and the footer sign-in link. Visitors see no edit controls.
- `lib/github.ts`:
  - `putFile` is one commit per file through the Contents API. Always pass the snapshot's blob `sha` when updating; GitHub then rejects stale saves with a 409, which maps to a `conflict` error.
  - `deleteFile` deletes one file.
  - `commitFiles` writes and/or deletes many files in ONE commit via the Git Data API (ref → commit → tree → commit → PATCH ref `force: false`). Pass `expectedHead: snap.commit` so it refuses if the repo moved since the content was read. `deletePaths` wraps it (deleting a recipe folder).
- `lib/categories.ts` + `pages/categories-edit.tsx`: category editing. `serializeConfig` rewrites only the changed lists in `config.yml`; `setCategory` swaps only the header's `category:` line, so renames touch nothing else in a file.
- After every save: `cacheFile(blobSha, text)`, then `invalidateSnapshot()`, then navigate. While unlocked, `setAuthToken` makes snapshot reads authenticated.
- `lib/serialize.ts` (`serializeRecipe`/`Home`/`Bake`/`Diary`) and `lib/references.ts` (`serializeGlossary`/`Library`/`Conversions`/`Technique`) write files in the hand-written style:
  - Block YAML, with `[a, b]` tag lists.
  - One `{ … }` line per ingredient, timeline step and conversion row, using the yaml library's `flow` setting. Never regex-build flow lines, because commas and colons must be quoted.
  - Ingredient `pct` is recalculated from grams on save.
  - **Invariant:** re-saving an unchanged file must reproduce it byte for byte (there are tests), so commits show only real edits.
- `components/editor/`: `fields.tsx` (`TextField`, `MarkdownField` with an optional "Insert photo", `ImageField`, `PhotosField`), `save-bar.tsx` (commit message, Save, unsaved-changes warning), `edit-guard.tsx`, and `sortable.tsx` + `sortable-utils.ts` (dnd-kit rows; `withKey` adds editor-only row keys that serializers never write). Photos are resized in the browser (`lib/image.ts`: 2000 px JPEG) and uploaded immediately as their own commit.

**Calculator** (`lib/bakers.ts`, pure functions; `pages/calculator.tsx` is UI only):
- Every % is relative to the *final-dough* flour. Preferments are added whole and carry flour and water via their hydration.
- "Overall" figures include preferment flour and water, plus the water inside ingredients (`waterPct`).
- `countrySourdough()` (90/10 flour, 75% water, 20% levain at 100%, 2% salt, which gives 77.27% overall) is the main test case. State is kept in localStorage `calculator:v1`, including `source`, the recipe it came from.
- Recipe ↔ calculator:
  - `lib/recipe-math.ts`: `recipeStats`, `recipeToFormula`, and `formatOven`/`formatTemp`, which show °F · °C and treat unitless numbers as °F.
  - `lib/formula-to-recipe.ts`: `formulaToIngredients` (new recipe), `applyFormula` (update a recipe at its own flour weight; matches by name, drops "amount as written" on changed items, ignores ±0.05% calculator rounding), `describeChanges` and `batchLabel` (bake log prefill).
  - `components/save-to-recipe.tsx` passes `FromCalculator` router state to the editors. Nothing is committed without review in an editor.

**Rendering:** `components/markdown.tsx` must never enable raw HTML (no rehype-raw), because a script injected through content could steal the token. Relative image `src` values resolve to the content repo, and `imageUrls` covers photos uploaded but not yet in the snapshot. `formatDate` and `stripLeadingTitle` are in `lib/format.ts`.

**Theme:** the user's Figma palette (cream, parchment, mist, warm-gray, bark, sienna, ink) mapped onto the shadcn CSS variables in `src/index.css`; the raw colors are also Tailwind colors (`text-sienna`, `bg-parchment`…). Always style through shadcn components and tokens (`bg-muted`, `text-primary`), not new component libraries. Dark mode is `.dark` on `<html>` (`components/theme-toggle.tsx`) with its own token values. Fonts are self-hosted via Fontsource (no Google Fonts requests): Fraunces (`font-heading`), Lora (`font-sans`, body text) and DM Mono (`font-mono`, used for gram amounts and stats). Markdown ordered lists render as numbered steps (`.md-steps`: 01, 02… in sienna; a step that starts with **bold** shows it as the step title). The recipe page has a view-only batch stepper (½× to 4×) that scales grams.

## Testing notes

- Unit tests sit next to the code (`src/lib/*.test.ts`), covering the math, parsing and serialization round-trips, and GitHub request shapes with a mocked `fetch`. Node-only APIs such as `Buffer` don't type-check in `src/`.
- For UI changes, the established check is a browser run with `playwright-core` driving the system Chrome against `vite preview` (port 4173). It intercepts every `api.github.com` PUT, DELETE, POST and PATCH, so nothing is written, and injects sample files by extending the `git/trees` response. Also check phone width (390 px) for horizontal overflow.

## Notes

- `npm audit` warnings come from the `shadcn` CLI (a dev dependency). `npm audit --omit=dev` is clean.
- Some build chunks are named after one module they contain (e.g. `tabs-*.js`, `content-error-*.js`). Those are shared code, not errors.
