import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SocialLinks } from '@/components/social-links'
import { ThemeToggle } from '@/components/theme-toggle'
import { useContent } from '@/hooks/use-content'
import { DEFAULT_HOME, loadHome } from '@/lib/content'
import { NAV } from '@/lib/nav'
import { cn } from '@/lib/utils'

const YEAR = new Date().getFullYear()

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const home = useContent('home-footer', loadHome).data ?? DEFAULT_HOME

  return (
    <div className="min-h-svh flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetHeader>
                <SheetTitle className="font-heading">Bake Book</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4">
                {NAV.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} className={navClass} onClick={() => setOpen(false)}>
                    <Icon className="size-4" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="font-heading text-lg font-semibold tracking-tight">
            Bake Book
          </Link>

          <nav className="ml-6 hidden gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={navClass}>
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>
            © {YEAR} {home.name} · Recipes are kept in{' '}
            <a href="https://github.com/tomstuder/Recipes" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">
              git
            </a>
          </p>
          <SocialLinks social={home.social} size="sm" />
        </div>
      </footer>
    </div>
  )
}
