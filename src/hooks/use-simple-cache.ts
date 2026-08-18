import { useEffect, useState } from "react"

type SimpleCacheFn<T> = () => Promise<T>

/**
 * Simple 1-time cache hook.
 * - Makes exactly 1 API call per page load
 * - Zero calls on subsequent renders
 * - Zero calls on navigation within same session
 * - Refreshes on component unmount / re-mount / page reload
 *
 * @param fetchFn - API fetch function
 * @param key - Unique key for debugging (optional)
 */
export function useSimpleCache<T>(fetchFn: SimpleCacheFn<T>, key?: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  // Fetch only once: on first mount and hasFetched is false
  useEffect(() => {
    if (!hasFetched) {
      setLoading(true)
      fetchFn()
        .then((result) => {
          setData(result)
          setHasFetched(true)
          setLoading(false)
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error("Failed to fetch"))
          setLoading(false)
          setHasFetched(true) // Still mark as fetched so we don't retry
        })
    }
  }, [fetchFn, key, hasFetched])

  // Reset on manual refresh - optional: you can add a separate "refetch" function
  // if (!hasFetched) {
  //   // First render - will trigger fetch above
  // }

  return { data, loading, error }
}
