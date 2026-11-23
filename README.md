# Bake Book

A personal baking web app: a baker's percentage calculator, recipes with a log of every bake, a
journal, and a references library. It's a static site on GitHub Pages with **no database**. All
content lives as plain files in a separate git repo, so every change has a history.

- **Live site:** https://kitchen.tomstuder.com/ (the old https://tomstuder.github.io/baker-app/
  links redirect there)
- **App code (this repo):** https://github.com/tomstuder/baker-app
- **Content:** https://github.com/tomstuder/Recipes. Recipes, bakes, journal posts, references and photos
  live there (journal posts are in the `diary/` folder). Its README documents the file formats.

## Features

| Section | What it does |
| --- | --- |
| **Home** | Bio, photos, featured recipes, the latest journal post and social links (all from `home.md`). |
| **Baker's %** | Flour blends, ingredients as % of flour, overall hydration (including water in milk, eggs and butter), levain/poolish/biga with their own hydration, and scaling by loaves, dough weight or flour weight. **Save to recipe** logs a bake, updates a recipe or starts a new one. |
| **Recipes** | Categories, tags, grams and baker's %, hydration, °F/°C, numbered method steps with photos, a ½×–4× batch stepper, and **Scale in calculator**. Each recipe has a **bake log**: date, rating, batch, changes, temperatures, a timeline and photos. |
| **Journal** | Posts with a cover photo, photos placed in the text, categories and tags, and links to recipes or specific bakes. |
| **References** | Converter (cups to grams per ingredient, °F/°C, g/oz, yeast types), techniques, a searchable glossary, and a library of links, books, videos and uploaded PDFs. |

Everything can be edited in the app after signing in (see [Editing](#editing)), or by editing the
files in the `Recipes` repo directly. Both create ordinary git commits.

### Link previews

When a link to the site is pasted into Messages, Slack or social sites, it shows a card with a
photo, the title "Bake Book" and a one-line description. These come from the Open Graph `<meta>`
tags in `index.html` and the image `public/og-image.jpg` (1200 × 630). To change the photo, replace
that file and push. Apps cache a preview when a link is first sent, so links already shared keep
the old card.

Every link currently shows the same card, because everything after `#` in a link (e.g.
`#/recipes/cornbread`) never reaches the server and preview services don't run the app.
See [Planned](#planned) for per-recipe previews.

## Editing

- **In the app:** click **Owner sign-in** in the footer, paste a fine-grained GitHub token and
  choose a passphrase. Edit buttons then appear throughout the site. On later visits, unlock with
  the passphrase (🔒 in the header). **Lock** hides the edit controls; **Sign out** removes the
  saved token from that browser.
- **On GitHub:** open a file in `tomstuder/Recipes` and use the pencil icon. Saving makes a commit.
- **On the desktop:** see [Editing on the desktop](#editing-on-the-desktop).

The site picks up content changes within about 5 minutes, or right away in a new tab. Content
changes never need a deploy and never touch this repo's code.

### Editing on the desktop

Keep a clone of the content repo next to this one:

```
~/Documents/claude/
  baker-app/     this repo (app code)
  Recipes/       content: git clone https://github.com/tomstuder/Recipes.git
```

Don't clone it inside `baker-app`. Saves made in the app are commits to `Recipes` too, so the
desktop copy falls behind whenever you edit in the browser:

```sh
cd ~/Documents/claude/Recipes
git pull                                  # always first
# edit files…
git add -A && git commit -m "Describe the change"
git push                                  # live on the site within ~5 minutes
```

If a push is rejected, run `git pull` and push again. The file formats are documented in the
`Recipes` README. In a recipe, `grams` is the value that counts; the app works out baker's %
from it. If a file's header (the YAML between the `---` lines) has a mistake, only that page
fails to show. Fix it and push again; every earlier version stays in git history.

### Categories and tags

- **Categories** for recipes and the journal: when signed in, click **Categories** on the Recipes or
  Journal page. Add, rename, drag to reorder or remove them; the order is the order of the filters
  and recipe sections. **Renaming updates every recipe or post that uses the category**, and a
  removed category's items can be moved to another one, all in one commit. Categories used in
  files but missing from the list are offered for adding.
- They're stored in `Recipes/config.yml`, which you can also edit by hand. Editing by hand
  doesn't update the files that use a renamed category, and a category missing from the list still
  shows, after the listed ones.
- **Tags** need no setup: type any tag on a recipe or post and it appears in the filters.

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
npm run dev        # http://localhost:5173/
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
- [shadcn/ui](https://ui.shadcn.com/) on Tailwind CSS v4, with lucide icons. The palette (cream, sienna, ink…) and
  fonts (Fraunces, Lora, DM Mono, self-hosted) are theme tokens in `src/index.css`
- React Router (hash routing, so deep links work on GitHub Pages)
- `yaml`, `react-markdown` + `remark-gfm`, `@dnd-kit` (drag to reorder, editor pages only), `sonner`

### Project structure

```
src/
  App.tsx                 routes (editor pages are lazy-loaded)
  lib/
    bakers.ts             baker's % math (calculator)
    content.ts            reading the Recipes repo; recipes, bakes, journal (diary/), home, config
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

### Custom domain

The site is served at **kitchen.tomstuder.com**, set under this repo's **Settings → Pages →
Custom domain** with **Enforce HTTPS** on. `tomstuder.com` itself stays at Bluehost; its DNS
there has two records for this site (never move the domain's nameservers, which would take the
main site offline):

| Type | Host | Value | Purpose |
| --- | --- | --- | --- |
| CNAME | `kitchen` | `tomstuder.github.io` | points the subdomain at GitHub Pages |
| TXT | `_github-pages-challenge-tomstuder` | code from GitHub | verifies the domain to the GitHub account, so nobody else can use it |

`base: './'` in `vite.config.ts` makes the build work at any path, so moving to another domain
only needs the Pages setting, DNS, and the absolute URLs in the preview tags in `index.html`.
Sign-in is stored per address: after a domain change, sign in once more with the token.

## Planned

- **Per-recipe and per-post link previews.** At build time, generate a small share page for each
  recipe and journal post (e.g. `/baker-app/s/<slug>/`) with that item's photo, title and summary
  in Open Graph tags, which forwards visitors to the real `#/…` page. Add a **Share** button that
  copies that link. A save in `Recipes` would trigger a rebuild of this site (a workflow in
  `Recipes` with a token allowed to start this repo's deploy), so new items can be shared within
  about a minute.

## Troubleshooting

- **"GitHub is limiting requests":** visitors who aren't signed in get 60 GitHub API calls an hour.
  The app caches heavily, so this is rare; wait a few minutes. Signed-in reads use your token's
  much higher limit.
- **"GitHub rejected the token":** it expired or was revoked. Regenerate it on GitHub and sign in
  again.
- **"This file changed on GitHub after you opened it":** someone (or another tab) saved first.
  Reload, then make your edit again.
