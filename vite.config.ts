import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base: the site lives at https://kitchen.tomstuder.com/ (custom domain), and the same build
// also works under https://tomstuder.github.io/baker-app/. HashRouter keeps the page path at the root.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
