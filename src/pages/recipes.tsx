import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export function RecipesPage() {
  return (
    <>
      <PageHeader title="Recipes" description="Formulas, method and the history of every bake." />
      <ComingSoon
        items={['Recipe list with tags and search', 'Bake log entries: tweaks, temperatures, timings, rating, photos', 'Edit and save straight to GitHub']}
      />
    </>
  )
}
