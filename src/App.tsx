import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/components/auth-provider'
import { Layout } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HomePage } from '@/pages/home'
import { CalculatorPage } from '@/pages/calculator'
import { RecipesPage } from '@/pages/recipes'
import { RecipePage } from '@/pages/recipe'

// Editor pages (and the drag-and-drop library they use) download only when the owner opens them.
const RecipeEditPage = lazy(() => import('@/pages/recipe-edit').then((m) => ({ default: m.RecipeEditPage })))
const HomeEditPage = lazy(() => import('@/pages/home-edit').then((m) => ({ default: m.HomeEditPage })))
const BakeEditPage = lazy(() => import('@/pages/bake-edit').then((m) => ({ default: m.BakeEditPage })))
const editorFallback = <Skeleton className="h-96 w-full rounded-xl" />
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
        <Route path="recipes/new" element={<Suspense fallback={editorFallback}><RecipeEditPage /></Suspense>} />
        <Route path="recipes/:slug" element={<RecipePage />} />
        <Route path="recipes/:slug/edit" element={<Suspense fallback={editorFallback}><RecipeEditPage /></Suspense>} />
        <Route path="recipes/:slug/bakes/new" element={<Suspense fallback={editorFallback}><BakeEditPage /></Suspense>} />
        <Route path="recipes/:slug/bakes/:bake/edit" element={<Suspense fallback={editorFallback}><BakeEditPage /></Suspense>} />
        <Route path="edit/home" element={<Suspense fallback={editorFallback}><HomeEditPage /></Suspense>} />
        <Route path="diary" element={<DiaryPage />} />
        <Route path="references" element={<ReferencesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
