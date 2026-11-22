import { Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { HomePage } from '@/pages/home'
import { CalculatorPage } from '@/pages/calculator'
import { RecipesPage } from '@/pages/recipes'
import { DiaryPage } from '@/pages/diary'
import { ReferencesPage } from '@/pages/references'
import { NotFoundPage } from '@/pages/not-found'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="diary" element={<DiaryPage />} />
        <Route path="references" element={<ReferencesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
