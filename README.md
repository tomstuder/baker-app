# Bake Book

A personal baking web app: a baker's percentage calculator, recipes with a log of every bake, a
diary, and a references library. It's a static site on GitHub Pages with **no database**. All
content lives as plain files in a separate git repo, so every change has a history.

- **Live site:** https://tomstuder.github.io/baker-app/
- **App code (this repo):** https://github.com/tomstuder/baker-app
- **Content:** https://github.com/tomstuder/Recipes. Recipes, bakes, diary, references and photos
  live there. Its README documents the file formats.

## Features

| Section | What it does |
| --- | --- |
| **Home** | Bio, photos, featured recipes, the latest diary post and social links (all from `home.md`). |
| **Baker's %** | Flour blends, ingredients as % of flour, overall hydration (including water in milk, eggs and butter), levain/poolish/biga with their own hydration, and scaling by loaves, dough weight or flour weight. **Save to recipe** logs a bake, updates a recipe or starts a new one. |
| **Recipes** | Categories, tags, grams and baker's %, hydration, °F/°C, method with photos, and **Scale in calculator**. Each recipe has a **bake log**: date, rating, batch, changes, temperatures, a timeline and photos. |
| **Diary** | Posts with a cover photo, photos placed in the text, categories and tags, and links to recipes or specific bakes. |
| **References** | Converter (cups to grams per ingredient, °F/°C, g/oz, yeast types), techniques, a searchable glossary, and a library of links, books, videos and uploaded PDFs. |

Everything can be edited in the app after signing in (see [Editing](#editing)), or by editing the
files in the `Recipes` repo directly. Both create ordinary git commits.

## Editing

- **In the app:** click **Owner sign-in** in the footer, paste a fine-grained GitHub token and
  choose a passphrase. Edit buttons then appear throughout the site. On later visits, unlock with
  the passphrase (🔒 in the header). **Lock** hides the edit controls; **Sign out** removes the
  saved token from that browser.
- **On GitHub or locally:** edit files in `tomstuder/Recipes` (pencil icon on GitHub, or clone,
  edit, push). The site picks up changes within about 5 minutes, or immediately in a new tab.

### Creating the token

GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token*:

- **Repository access:** *Only select repositories* → `tomstuder/Recipes`
- **Permissions → Repository → Contents:** *Read and write* (nothing else)
- **Expiration:** 90 days is a good default. When it expires, **Regenerate** it and sign in again.

The app only accepts fine-grained tokens (`github_pat_…`), never classic ones.

## Security

- **Anyone can read; only the owner can change anything.** The site is static. Edits are commits to
  `Recipes`, which only the token holder can make.
- **The token can only touch `Recipes` contents.** It can't change this repo, the site's code or
  its deploy workflow, or any repo settings.
- **The token is stored encrypted** in the browser (AES-GCM, with a key derived from your passphrase
  via PBKDF2). The plain token exists only in memory while unlocked.
- **Content is rendered safely:** Markdown never runs embedded HTML or scripts.
- **Saves can't overwrite newer changes:** if a file changed on GitHub since you opened it, the save
  is refused. Deletes are refused if the repo changed meanwhile.
- **Everything is recoverable from git history**, including deleted recipes, bakes and posts
  (GitHub → `Recipes` → Commits → open the commit → **Revert**).
- Keep **two-factor authentication** turned on for the GitHub account.

## Development

You'll need [Node.js](https://nodejs.org/) 24 or newer.

```sh
git clone https://github.com/tomstuder/baker-app.git
cd baker-app
npm install
npm run dev        # http://localhost:5173/baker-app/  (the /baker-app/ path is required)
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server with hot reload (reads the live `Recipes` repo) |
| `npm test` | Run the unit tests (Vitest) |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npx shadcn@latest add <name>` | Add a shadcn/ui component |

### Tech stack

- React 19 + TypeScript, built with Vite
- [shadcn/ui](https://ui.shadcn.com/) on Tailwind CSS v4, with lucide icons
- React Router (hash routing, so deep links work on GitHub Pages)
- `yaml`, `react-markdown` + `remark-gfm`, `@dnd-kit` (drag to reorder, editor pages only), `sonner`

### Project structure

```
src/
  App.tsx                 routes (editor pages are lazy-loaded)
  lib/
    bakers.ts             baker's % math (calculator)
    content.ts            reading the Recipes repo; recipes, bakes, diary, home, config
    references.ts         glossary, library, conversions, techniques + converter math
    serialize.ts          writing files back in the hand-written format
    github.ts             saving: putFile, deleteFile, deletePaths (multi-file delete)
    token-vault.ts        encrypted token storage
    formula-to-recipe.ts  calculator → recipe / bake
  pages/                  one file per page; *-edit.tsx are editors
  components/             layout, markdown, bake log, editor fields, dialogs
  components/ui/          shadcn/ui components
.github/workflows/        GitHub Pages deploy
```

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which
builds the site and publishes it to GitHub Pages in about a minute. You can also run it by hand from
the **Actions** tab. Content changes in `Recipes` don't need a deploy; the app reads them live.

If this repo is renamed, or a custom domain is added, update `base` in `vite.config.ts`
(`'/'` for a custom domain).

## Troubleshooting

- **"GitHub is limiting requests":** visitors who aren't signed in get 60 GitHub API calls an hour.
  The app caches heavily, so this is rare; wait a few minutes. Signed-in reads use your token's
  much higher limit.
- **"GitHub rejected the token":** it expired or was revoked. Regenerate it on GitHub and sign in
  again.
- **"This file changed on GitHub after you opened it":** someone (or another tab) saved first.
  Reload, then make your edit again.
