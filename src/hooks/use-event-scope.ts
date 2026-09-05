import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { listEvents } from "@/lib/api/agency"
import type { Event } from "@/types/agency"

const STORAGE_KEY = "cosmos.opsEventId"

/**
 * Shared event scope for Event Operations pages.
 * Prefer ?eventId= URL, then localStorage, then first live/confirmed event.
 */
export function useEventScope() {
  const [searchParams, setSearchParams] = useSearchParams()
  const paramEventId = searchParams.get("eventId")

  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventIdState] = useState<string>(
    () => paramEventId || localStorage.getItem(STORAGE_KEY) || "",
  )
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingEvents(true)
      try {
        const res = await listEvents({ page: 1, limit: 100 })
        if (cancelled) return
        const list = res.data ?? []
        setEvents(list)

        const validStored = localStorage.getItem(STORAGE_KEY)
        const storedExists = validStored && list.some((e) => e.eventId === validStored || e.id === validStored)
        const paramExists = paramEventId && list.some((e) => e.eventId === paramEventId || e.id === paramEventId)

        const preferred =
          (paramExists ? paramEventId : null) ||
          (storedExists ? validStored : null) ||
          list.find((e) => e.status === "live")?.eventId ||
          list.find((e) => e.status === "confirmed")?.eventId ||
          list[0]?.eventId ||
          ""

        setEventIdState(preferred)
        if (preferred) {
          localStorage.setItem(STORAGE_KEY, preferred)
          if (!paramEventId) {
            setSearchParams({ eventId: preferred }, { replace: true })
          }
        } else {
          localStorage.removeItem(STORAGE_KEY)
          if (paramEventId) {
            setSearchParams({}, { replace: true })
          }
        }
      } catch {
        if (!cancelled) setEventsError("Could not load events for scope picker")
      } finally {
        if (!cancelled) setLoadingEvents(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // Only on mount — URL sync handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (paramEventId && paramEventId !== eventId) {
      setEventIdState(paramEventId)
      localStorage.setItem(STORAGE_KEY, paramEventId)
    }
  }, [paramEventId, eventId])

  const setEventId = useCallback(
    (id: string) => {
      setEventIdState(id)
      localStorage.setItem(STORAGE_KEY, id)
      setSearchParams(id ? { eventId: id } : {}, { replace: true })
    },
    [setSearchParams],
  )

  const selectedEvent = events.find((e) => e.eventId === eventId) ?? null

  return {
    events,
    eventId,
    setEventId,
    selectedEvent,
    loadingEvents,
    eventsError,
  }
}
