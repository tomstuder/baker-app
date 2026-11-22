import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export function CalculatorPage() {
  return (
    <>
      <PageHeader title="Baker's percentage" description="Every ingredient as a percentage of total flour." />
      <ComingSoon
        items={[
          'Flour blends and ingredient percentages',
          'Total hydration, including water in milk, eggs and butter',
          'Levain, poolish and biga with their own hydration',
          'Scale by dough weight, loaf count or flour weight',
          'Save a formula to a recipe',
        ]}
      />
    </>
  )
}
