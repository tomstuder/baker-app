import { Link } from 'react-router-dom'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NAV } from '@/lib/nav'

export function HomePage() {
  return (
    <div>
      <section className="mb-10">
        <h1 className="text-4xl font-semibold sm:text-5xl">Bake Book</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Formulas, bake logs and notes from my kitchen.
        </p>
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        {NAV.map(({ to, label, icon: Icon, blurb }) => (
          <Link key={to} to={to} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader>
                <Icon className="mb-2 size-6 text-primary" />
                <CardTitle className="font-heading text-xl">{label}</CardTitle>
                <CardDescription>{blurb}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
