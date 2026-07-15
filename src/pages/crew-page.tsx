import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { CrewBoard } from "@/components/ops/crew-board"
import { EventScopeBar } from "@/components/ops/event-scope-bar"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useEventScope } from "@/hooks/use-event-scope"
import { listCrew, listDepartments, updateCrewStatus } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { CrewMember, Department } from "@/types/agency"

export function CrewPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops")
  const { events, eventId, setEventId, selectedEvent, loadingEvents } = useEventScope()
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCrewId, setBusyCrewId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!eventId) return
    const [crewRes, deptRes] = await Promise.all([
      listCrew(eventId),
      listDepartments(eventId).catch(() => null),
    ])
    setCrew(crewRes.data ?? [])
    setDepartments(deptRes?.data ?? [])
  }, [eventId])

  function patchLocal(updated: CrewMember | null | undefined) {
    if (!updated?.crewId) return
    setCrew((prev) =>
      prev.map((c) =>
        c.crewId === updated.crewId || c.id === updated.id ? { ...c, ...updated } : c,
      ),
    )
  }

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await reload()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load crew")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [eventId, reload])

  async function handleStatusChange(member: CrewMember, nextStatus: string) {
    if (!eventId || !canWrite) return
    setBusyCrewId(member.crewId)
    // Optimistic: move card immediately
    patchLocal({ ...member, status: nextStatus })
    try {
      const res = await updateCrewStatus(member.crewId, nextStatus, eventId)
      patchLocal(res.data)
      await reload()
      toast.success(`${member.name || member.crewId} → ${nextStatus.replace("_", " ")}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update crew status")
      await reload().catch(() => undefined)
    } finally {
      setBusyCrewId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <EventScopeBar
        title="Crew & Departments"
        events={events}
        eventId={eventId}
        onEventChange={setEventId}
        loading={loadingEvents}
        selectedEvent={selectedEvent}
        compact
      />

      {!canWrite ? (
        <p className="text-muted-foreground text-xs">
          View only — status changes need ops / producer / pm / admin.
        </p>
      ) : null}

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="grid gap-3 md:grid-cols-4">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : (
        <CrewBoard
          crew={crew}
          departments={departments}
          busyCrewId={busyCrewId}
          canWrite={canWrite}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
