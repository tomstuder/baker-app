import { PageHeader } from '@/components/page-header'
import { ComingSoon } from '@/components/coming-soon'

export function DiaryPage() {
  return (
    <>
      <PageHeader title="Diary" description="Notes from the kitchen." />
      <ComingSoon items={['Markdown posts with photos', 'Link to recipes and specific bakes']} />
    </>
  )
}
