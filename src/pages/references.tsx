import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export function ReferencesPage() {
  return (
    <>
      <PageHeader title="References" description="Links, books, conversions and techniques." />
      <ComingSoon items={['Links and books with notes', 'Conversion tables: volume to weight, oven temps, yeast types', 'Glossary and technique write-ups', 'PDF and image uploads']} />
    </>
  )
}
