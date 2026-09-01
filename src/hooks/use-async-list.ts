import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api/client"

/**
 * Shared list loader for agency pages — clean lifecycle without cross-hook cache collision.
 */
export function useAsyncList<T>(
  loader: () => Promise<T[]>,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loader()
      setData(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load")
      setData([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, setData, loading, error, reload }
}
