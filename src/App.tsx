import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
const DiaryEditPage = lazy(() => import('@/pages/diary-edit').then((m) => ({ default: m.DiaryEditPage })))
const TechniqueEditPage = lazy(() => import('@/pages/technique-edit').then((m) => ({ default: m.TechniqueEditPage })))
const ReferenceListEditPage = lazy(() => import('@/pages/reference-lists-edit').then((m) => ({ default: m.ReferenceListEditPage })))
const CategoriesEditPage = lazy(() => import('@/pages/categories-edit').then((m) => ({ default: m.CategoriesEditPage })))
const editorFallback = <Skeleton className="h-96 w-full rounded-xl" />
import { DiaryPage } from '@/pages/diary'
import { DiaryPostPage } from '@/pages/diary-post'
import { ReferencesPage } from '@/pages/references'
import { TechniquePage } from '@/pages/technique'
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
        <Route path="edit/categories" element={<Suspense fallback={editorFallback}><CategoriesEditPage /></Suspense>} />
        <Route path="journal" element={<DiaryPage />} />
        <Route path="journal/new" element={<Suspense fallback={editorFallback}><DiaryEditPage /></Suspense>} />
        <Route path="journal/:slug" element={<DiaryPostPage />} />
        <Route path="journal/:slug/edit" element={<Suspense fallback={editorFallback}><DiaryEditPage /></Suspense>} />
        <Route path="diary/*" element={<DiaryRedirect />} />
        <Route path="references" element={<ReferencesPage />} />
        <Route path="references/techniques/new" element={<Suspense fallback={editorFallback}><TechniqueEditPage /></Suspense>} />
        <Route path="references/techniques/:slug" element={<TechniquePage />} />
        <Route path="references/techniques/:slug/edit" element={<Suspense fallback={editorFallback}><TechniqueEditPage /></Suspense>} />
        <Route path="references/edit/:list" element={<Suspense fallback={editorFallback}><ReferenceListEditPage /></Suspense>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

/** The diary was renamed Journal: old /diary links (and their ?category= / ?tag= filters) still work. */
function DiaryRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate replace to={pathname.replace(/^\/diary/, '/journal') + search} />
}
