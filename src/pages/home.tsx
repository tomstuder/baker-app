import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Calculator, NotebookPen, Pencil, Wheat } from 'lucide-react'
import { IfEditing } from '@/components/auth-control'
import { ContentError } from '@/components/content-error'
import { Markdown } from '@/components/markdown'
import { RecipeCard } from '@/components/recipe-card'
import { SocialLinks } from '@/components/social-links'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useContent } from '@/hooks/use-content'
import { DEFAULT_HOME, assetUrl, loadDiary, loadHome, loadRecipes, type Recipe, type Snapshot } from '@/lib/content'
import { formatDate } from '@/lib/format'

const FEATURED_COUNT = 3

async function loadHomePage(snap: Snapshot) {
  const [home, recipes, diary] = await Promise.all([loadHome(snap), loadRecipes(snap), loadDiary(snap)])
  return { home, recipes, latestPost: diary[0] }
}

/** Featured slugs from home.md first, then tested recipes, then anything else. */
function pickFeatured(featured: string[], recipes: Recipe[]): Recipe[] {
  const bySlug = new Map(recipes.map((r) => [r.slug, r]))
  const picked = featured.map((s) => bySlug.get(s)).filter((r): r is Recipe => !!r)
  const rest = recipes.filter((r) => !picked.includes(r)).sort((a, b) => Number(b.status === 'tested') - Number(a.status === 'tested'))
  return [...picked, ...rest].slice(0, FEATURED_COUNT)
}

export function HomePage() {
  const { data, snap, error, loading } = useContent('home', loadHomePage)
  const home = data?.home ?? DEFAULT_HOME
  const hero = snap ? assetUrl(snap, 'home.md', home.hero) : undefined
  const portrait = snap ? assetUrl(snap, 'home.md', home.portrait) : undefined
  const featured = data ? pickFeatured(home.featured, data.recipes) : []

  return (
    <div className="space-y-16">
      {/* Bio */}
      <section className="grid items-center gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="order-2 md:order-1">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">Bake Book</p>
            <IfEditing>
              <Button asChild variant="outline" size="sm">
                <Link to="/edit/home">
                  <Pencil />
                  Edit home page
                </Link>
              </Button>
            </IfEditing>
          </div>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{home.name}</h1>
          {home.tagline && <p className="mt-3 text-lg text-muted-foreground">{home.tagline}</p>}

          {loading ? (
            <div className="mt-6 space-y-2" aria-hidden>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            home.body.trim() && (
              <Markdown file="home.md" snap={snap} className="mt-4 text-[17px] text-foreground/90">
                {home.body}
              </Markdown>
            )
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/recipes">
                Browse recipes
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/calculator">
                <Calculator />
                Baker's % calculator
              </Link>
            </Button>
          </div>

          <SocialLinks social={home.social} className="mt-6" />
        </div>

        <div className="relative order-1 md:order-2">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-secondary via-accent to-primary/25 shadow-sm md:aspect-[4/5]">
            {hero ? (
              <img src={hero} alt={`Breads baked by ${home.name}`} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Wheat className="size-20 text-primary/30" aria-hidden />
              </div>
            )}
          </div>
          {portrait && (
            <img
              src={portrait}
              alt={home.name}
              className="absolute -bottom-6 left-6 size-24 rounded-full border-4 border-background object-cover shadow-md sm:size-28"
            />
          )}
        </div>
      </section>

      {error && <ContentError error={error} />}

      {/* Featured recipes */}
      <section aria-labelledby="featured-heading">
        <SectionHeader id="featured-heading" title="Featured recipes" to="/recipes" linkLabel="All recipes" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: FEATURED_COUNT }, (_, i) => <Skeleton key={i} className="aspect-[4/3.9] rounded-xl" />)
            : featured.map((r) => <RecipeCard key={r.slug} recipe={r} snap={snap} />)}
        </div>
        {!loading && !error && featured.length === 0 && <p className="text-muted-foreground">No recipes yet.</p>}
      </section>

      {/* Diary + tools */}
      <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <SectionHeader title="From the diary" to="/diary" linkLabel="All posts" />
          {loading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : data?.latestPost ? (
            <Link to={`/diary/${data.latestPost.slug}`} className="group block">
              <Card className="transition-colors group-hover:border-primary/50">
                <CardContent className="space-y-2">
                  {data.latestPost.date && <p className="text-sm text-muted-foreground">{formatDate(data.latestPost.date)}</p>}
                  <h3 className="text-xl font-semibold">{data.latestPost.title}</h3>
                  {data.latestPost.excerpt && <p className="text-muted-foreground">{data.latestPost.excerpt}</p>}
                  <p className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-primary">
                    Read post <ArrowRight className="size-4" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-4 text-muted-foreground">
                <NotebookPen className="size-6 shrink-0 text-primary/60" aria-hidden />
                <p>No diary posts yet. The first one is on its way.</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Tools</h2>
          <div className="space-y-3">
            <ToolLink to="/calculator" icon={Calculator} title="Baker's % calculator" text="Scale formulas, hydration and preferments." />
            <ToolLink to="/references" icon={BookOpen} title="References" text="Conversions, techniques and links." />
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ title, to, linkLabel, id }: { title: string; to: string; linkLabel: string; id?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
        {linkLabel} <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}

function ToolLink({ to, icon: Icon, title, text }: { to: string; icon: typeof Calculator; title: string; text: string }) {
  return (
    <Link to={to} className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </Link>
  )
}
