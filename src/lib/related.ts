import { loadBake, loadRecipe, type Bake, type Recipe, type Snapshot } from '@/lib/content'

export type RelatedLink = { ref: string; recipe: Recipe; bake?: Bake }

/** Resolve related refs ("recipe" or "recipe/bake-id") to recipes and bakes; missing ones are skipped. */
export async function loadRelated(snap: Snapshot, refs: string[]): Promise<RelatedLink[]> {
  const links = await Promise.all(
    refs.map(async (ref): Promise<RelatedLink | null> => {
      const [slug, bakeId] = ref.split('/')
      const recipe = await loadRecipe(snap, slug)
      if (!recipe) return null
      const bake = bakeId ? await loadBake(snap, slug, bakeId) : undefined
      if (bakeId && !bake) return null
      return bake ? { ref, recipe, bake } : { ref, recipe }
    }),
  )
  return links.filter((l): l is RelatedLink => l !== null)
}
