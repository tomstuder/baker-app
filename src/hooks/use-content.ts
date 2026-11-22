import { useEffect, useState } from 'react'
import { getSnapshot, type Snapshot } from '@/lib/content'

type State<T> = { data: T | undefined; snap: Snapshot | undefined; error: Error | undefined; loading: boolean }

/**
 * Load something from the content repo. `key` identifies the request; change it to reload
 * (e.g. include the slug). The loader receives the shared snapshot.
 */
export function useContent<T>(key: string, load: (snap: Snapshot) => Promise<T>): State<T> {
  const [state, setState] = useState<State<T> & { key: string }>({
    key,
    data: undefined,
    snap: undefined,
    error: undefined,
    loading: true,
  })

  // Reset synchronously when the key changes so stale data never shows under a new key.
  if (state.key !== key) setState({ key, data: undefined, snap: undefined, error: undefined, loading: true })

  useEffect(() => {
    let cancelled = false
    getSnapshot()
      .then(async (snap) => {
        const data = await load(snap)
        if (!cancelled) setState({ key, data, snap, error: undefined, loading: false })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ key, data: undefined, snap: undefined, error, loading: false })
      })
    return () => {
      cancelled = true
    }
    // `load` is expected to be stable for a given key.
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
