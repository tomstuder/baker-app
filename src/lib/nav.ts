import { BookOpen, Calculator, NotebookPen, Wheat, type LucideIcon } from 'lucide-react'

export type NavItem = { to: string; label: string; icon: LucideIcon; blurb: string }

export const NAV: NavItem[] = [
  { to: '/calculator', label: "Baker's %", icon: Calculator, blurb: 'Formulas, hydration, preferments and scaling.' },
  { to: '/recipes', label: 'Recipes', icon: Wheat, blurb: 'Your recipes and the history of every bake.' },
  { to: '/journal', label: 'Journal', icon: NotebookPen, blurb: 'Notes and stories, linked to recipes and bakes.' },
  { to: '/references', label: 'References', icon: BookOpen, blurb: 'Links, books, conversions, glossary and files.' },
]
