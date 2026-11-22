# Bake Book

A personal baking app: baker's percentage calculator, recipe and bake log, diary, and references.
Built with React, Vite and [shadcn/ui](https://ui.shadcn.com/). Hosted on GitHub Pages at
https://tomstuder.github.io/baker-app/

Content (recipes, bakes, diary, references) lives as files under `content/` in this repo, so every
change is a git commit.

## Develop

```sh
npm install
npm run dev      # http://localhost:5173/baker-app/
npm run build    # production build into dist/
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it to
GitHub Pages. You can also run it by hand from the repo's **Actions** tab.
