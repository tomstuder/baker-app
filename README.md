# Bake Book

A personal baking web app: a baker's percentage calculator, a recipe log that tracks every bake, a
diary, and a references library. Everything is stored as plain files in this git repo, so every
change has a history.

**Live site:** https://tomstuder.github.io/baker-app/

> Status: early development. The app shell and automatic deploy work; the four sections below are
> placeholders being built in order.

## Features

| Section | What it does |
| --- | --- |
| **Baker's %** | Ingredients as a percentage of total flour, multiple flours, total hydration (including water in milk, eggs and butter), preferments (levain, poolish, biga), scaling by dough weight, loaf count or flour weight, and saving a formula to a recipe. |
| **Recipes** | Recipes, each with a log of individual bakes: date, tweaks, temperatures, timings, rating and photos. |
| **Diary** | Markdown posts that can link to recipes and specific bakes. |
| **References** | Links and books, conversion tables (volume to weight, oven temperatures, yeast types), a glossary and technique notes, and PDF and image uploads. |

## Tech stack

- [React](https://react.dev/) 19 + TypeScript, built with [Vite](https://vite.dev/)
- [shadcn/ui](https://ui.shadcn.com/) components on [Tailwind CSS](https://tailwindcss.com/) v4
- [React Router](https://reactrouter.com/) (hash routing, so links work on GitHub Pages)
- GitHub Pages hosting, deployed by GitHub Actions
- **No database:** content lives as Markdown and JSON files in this repo (see below)

## Getting started

You'll need [Node.js](https://nodejs.org/) 24 or newer.

```sh
git clone https://github.com/tomstuder/baker-app.git
cd baker-app
npm install
npm run dev
```

Then open http://localhost:5173/baker-app/. Include the `/baker-app/` path, because the app
expects it.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local dev server with hot reload |
| `npm run build` | Type-check and build the production site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally to check it before deploying |
| `npm run lint` | Lint the code with oxlint |
| `npx shadcn@latest add <name>` | Add a shadcn/ui component to `src/components/ui/` |

## Project structure

```
src/
  App.tsx            routes
  main.tsx           app entry (HashRouter)
  index.css          Tailwind + theme colors and fonts (light and dark)
  components/        layout, theme toggle, shared pieces
  components/ui/     shadcn/ui components (generated, safe to edit)
  lib/nav.ts         the sections shown in the menu and on the home page
  pages/             one file per section
public/              static files copied as-is (favicon)
.github/workflows/   GitHub Pages deploy
content/             (planned) recipes, bakes, diary and references as files
```

## How content is stored (planned)

The repo is the database. Each item is a Markdown file with a small header block of structured data:

```
content/
  recipes/country-loaf/
    recipe.md              formula (flours, baker's %, preferment) + method and notes
    bakes/2026-11-20.md    one bake: tweaks, temperatures, timings, rating
    images/                photos, resized in the browser before upload
  diary/2026-11-21-first-rye.md
  references/              links, glossary, conversions.json, files/
```

Saving in the app creates a commit through the GitHub API. You can also edit the files by hand and
push. Both work, because both are just commits.

## Security

- **Anyone can read the site; only the owner can change it.** GitHub Pages serves static files,
  so visitors have no way to modify or delete anything. Changes require a commit to this repo.
- **In-app editing uses a fine-grained personal access token** that is limited to this repo, has
  *Contents: read and write* permission only, and has an expiry date. It's stored encrypted in the
  browser behind a passphrase. Without it the app is read-only.
- **Two-factor authentication** on the GitHub account protects everything else.
- **History is a safety net:** any bad change can be reverted from git history.

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which
installs dependencies, builds the site and publishes `dist/` to GitHub Pages. It usually takes
under a minute. You can also start it by hand from the repo's **Actions** tab (**Run workflow**).

One-time repo setup, already done: **Settings → Pages → Source: GitHub Actions**.

If the repo is renamed, update `base` in `vite.config.ts` to match the new name.
