import { Link } from 'react-router-dom'
import { Wheat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { assetUrl, bakeCounts, type Recipe, type Snapshot } from '@/lib/content'

export function StatusBadge({ status }: { status: Recipe['status'] }) {
  if (status === 'tested') return null
  return <Badge variant="outline">{status === 'draft' ? 'Draft' : 'Testing'}</Badge>
}

export function RecipeCard({ recipe, snap }: { recipe: Recipe; snap?: Snapshot }) {
  const baked = snap ? (bakeCounts(snap).get(recipe.slug) ?? 0) : 0
  const img = snap ? assetUrl(snap, recipe.path, recipe.image) : undefined
  return (
    <Link to={`/recipes/${recipe.slug}`} className="group block h-full rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="h-full gap-0 overflow-hidden py-0 transition-colors group-hover:border-primary/50">
        <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-secondary to-accent">
          {img ? (
            <img src={img} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Wheat className="size-10 text-primary/40" aria-hidden />
            </div>
          )}
        </div>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg leading-snug font-semibold">{recipe.title}</h3>
            <StatusBadge status={recipe.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[recipe.category, baked > 0 && `Baked ${baked}×`].filter(Boolean).join(' · ')}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
