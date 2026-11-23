import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/auth-provider'
import { Layout } from '@/components/layout'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HomePage } from '@/pages/home'
import { CalculatorPage } from '@/pages/calculator'
import { RecipesPage } from '@/pages/recipes'
import { RecipePage } from '@/pages/recipe'
import { RecipeEditPage } from '@/pages/recipe-edit'
import { HomeEditPage } from '@/pages/home-edit'
import { BakeEditPage } from '@/pages/bake-edit'
import { DiaryPage } from '@/pages/diary'
import { ReferencesPage } from '@/pages/references'
import { NotFoundPage } from '@/pages/not-found'

export default function App() {
  return (
    <TooltipProvider>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="bottom-center" />
      </AuthProvider>
    </TooltipProvider>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="calculator" element={<CalculatorPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="recipes/new" element={<RecipeEditPage />} />
        <Route path="recipes/:slug" element={<RecipePage />} />
        <Route path="recipes/:slug/edit" element={<RecipeEditPage />} />
        <Route path="recipes/:slug/bakes/new" element={<BakeEditPage />} />
        <Route path="recipes/:slug/bakes/:bake/edit" element={<BakeEditPage />} />
        <Route path="edit/home" element={<HomeEditPage />} />
        <Route path="diary" element={<DiaryPage />} />
        <Route path="references" element={<ReferencesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
