# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Bake Book": a personal baking web app with four sections: a baker's percentage calculator, a recipe log with a history of individual bakes, a diary, and references. It's a static site on GitHub Pages at https://tomstuder.github.io/baker-app/ (repo `tomstuder/baker-app`, public).

## Commands

```sh
npm run dev       # dev server at http://localhost:5173/baker-app/ (note the /baker-app/ base path)
npm run build     # tsc -b type-check, then vite build into dist/
npm run lint      # oxlint
npm test          # vitest run (all tests)
npx vitest run src/lib/bakers.test.ts      # one file
npx vitest run -t "overall hydration"      # tests whose name matches
npx shadcn@latest add <component>   # add shadcn/ui components into src/components/ui/
```

Deploy: every push to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/` to Pages (Pages `build_type` is `workflow`, not branch-based). Check a run with `gh run list` or `gh run watch`.

## Architecture

- **Stack:** Vite + React 19 + TypeScript, Tailwind v4 through `@tailwindcss/vite` (there's no tailwind.config; the theme lives in `src/index.css`), and shadcn/ui with the `radix-nova` style and lucide icons. The `@/` alias points to `src/` and is defined in both `vite.config.ts` and the tsconfigs.
- **GitHub Pages constraints:**
  - `base: '/baker-app/'` in `vite.config.ts` must match the repo name.
  - Routing uses `HashRouter` (in `src/main.tsx`) because Pages can't rewrite deep links. Keep it unless hosting changes.
- **Routing and navigation:** routes are in `src/App.tsx`, all nested under `components/layout.tsx`, which provides the header, mobile `Sheet` menu and `<Outlet/>`. Menu entries come from `src/lib/nav.ts`, which drives both the header and the home-page cards, so a new section needs a route in `App.tsx` and an entry in `nav.ts`.
- **Theme:**
  - Colors are shadcn CSS variables, overridden in `src/index.css` with a warm palette.
  - Dark mode is the `.dark` class on `<html>`, toggled by `components/theme-toggle.tsx`. It saves the choice in localStorage and falls back to the system setting.
  - Headings use Fraunces (`font-heading`, applied to h1–h3 in the base layer); body text uses Geist.

- **Calculator** (built):
  - All the math lives in `src/lib/bakers.ts` as pure functions; `pages/calculator.tsx` is only UI.
  - Convention: every % is relative to the *final-dough* flour (the 100% base). Preferments are added whole as a % of that flour and carry their own flour and water, set by their hydration. "Overall" figures (total flour, hydration, prefermented flour) include preferment flour and water, plus the water inside ingredients (`waterPct`, e.g. milk 87).
  - The country sourdough example (`countrySourdough()`) is the main test case in `bakers.test.ts`: 90/10 flour, 75% water, 20% levain at 100%, 2% salt, which gives 77.27% overall hydration.
  - The working formula is saved to localStorage under `calculator:v1`.
  - `components/number-input.tsx` keeps the typed text separately from the number, so a blank field becomes NaN, which the math treats as 0.

## Planned design (agreed with the user; not built yet)

- **Git is the database, in a separate content repo: `tomstuder/Recipes`** (public, CC0). This repo is only the app code. There's no backend or hosted DB:
  - Layout: `config.yml` (category lists per section), `recipes/<slug>/recipe.md`, `recipes/<slug>/bakes/<date>.md`, `recipes/<slug>/images/`, `diary/<date>-<slug>.md`, `references/techniques/<slug>.md` (plus links, glossary, conversions and files to come).
  - **The file format is documented in the Recipes repo's README, which is the spec.** Each file has a YAML header block (title, category, tags, status draft/testing/tested, created, yield, servings, time, oven, equipment, ingredients) followed by a Markdown body. Ingredients are `groups[].items[]` with `name`, `amount` (as written), `grams` (the source of truth), `pct` (baker's %, which the app recalculates on save), `flour: true` (counts toward the 100% base), `hydration` (marks a preferment), `water` (water-content %), `estimated` and `note`. Parse it with the `yaml` package.
  - Reading needs no index file: one GitHub API call lists every file (`branches/main`, then `git/trees/<sha>?recursive=1`), the files themselves come from `raw.githubusercontent.com/tomstuder/Recipes/<commitSha>/<path>`, and results are cached by blob SHA so only changed files are downloaded again. Without a token, the GitHub API allows 60 requests per hour per visitor, so cache the file list briefly.
  - Writing commits through the GitHub API to `Recipes` only. The editing token is limited to that repo, so it can't touch the app code or its deploy workflow.
  - Mapping to the calculator: `flour: true` items become flours, items with `hydration` become preferments, and everything else becomes an ingredient with `pct = grams / flour × 100` and `waterPct = water`.
- **Security model:**
  - Anyone can read the site. To edit, the user pastes a fine-grained personal access token that is limited to the `Recipes` content repo, has Contents read/write only, and expires.
  - The token is stored encrypted (AES-GCM with a key derived from a passphrase) in browser storage. Without it, the app is read-only.
  - Rendered Markdown must be sanitized so it can't run scripts and steal the token. Keep runtime dependencies minimal.
- **Calculator scope:** multiple flours, ingredients as % of total flour, total hydration including water in milk, eggs and butter, preferments (levain, poolish, biga) with their own hydration, scaling by dough weight, loaf count or flour weight, and saving a formula into a recipe.
- **Recipe log:** recipes plus individual bake entries (date, tweaks, temperatures, timings, rating, photos). Diary posts can link to recipes and bakes. Photos are resized in the browser and committed to the repo.
- **Categories and tags** (user request): recipes, diary posts and reference notes each get one category plus any number of free-form tags, stored in each file's header block. Categories come from a short, editable list per section. The lists live in the content repo's `config.yml`. Recipes: Bread, Enriched bread, Quick breads & muffins, Pastry, Cakes & cookies, Pizza & flatbread, Pasta & noodles, Starters & preferments. Diary: Bake log, Experiment, Learning, Kitchen notes. References: Techniques, Glossary, Links & books, Conversions. List and search views filter by category and tag.
- **Build order:** 1) shell and deploy (done), 2) calculator (done), 3) content layer with GitHub read/write and token login, then recipes and bakes, 4) diary, then references and uploads.
- **Units:** grams by default; temperatures in both °F and °C.

## Notes

- The `npm audit` warnings come from the `shadcn` CLI's own dependencies. It's a dev dependency and never reaches the browser; `npm audit --omit=dev` is clean.
