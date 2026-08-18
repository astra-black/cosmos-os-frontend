import { useSimpleCache } from "@/hooks/use-simple-cache"
import { listEvents } from "@/lib/api/agency"
import type { Event } from "@/types/agency"

export function useEventsSimpleCache() {
  return useSimpleCache<Event[]>(async () => {
    const res = await listEvents()
    return res.data ?? []
  }, "events")
}
