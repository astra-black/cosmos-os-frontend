import { useCallback, useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { EventScopeBar } from "@/components/ops/event-scope-bar"
import { IncidentTriage } from "@/components/ops/incident-triage"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useEventScope } from "@/hooks/use-event-scope"
import {
  createIncident,
  escalateIncident,
  listIncidents,
  reopenIncident,
  resolveIncident,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Incident } from "@/types/agency"

export function IncidentsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops")
  const { events, eventId, setEventId, selectedEvent, loadingEvents } = useEventScope()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyIncidentId, setBusyIncidentId] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [logging, setLogging] = useState(false)
  const [title, setTitle] = useState("")
  const [severity, setSeverity] = useState("warning")
  const [location, setLocation] = useState("")

  const reload = useCallback(async () => {
    if (!eventId) return
    const listRes = await listIncidents(eventId)
    setIncidents(listRes.data ?? [])
  }, [eventId])

  function patchLocal(updated: Incident | null | undefined) {
    if (!updated?.incidentId) return
    setIncidents((prev) =>
      prev.map((i) =>
        i.incidentId === updated.incidentId || i.id === updated.id
          ? { ...i, ...updated }
          : i,
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
          setError(err instanceof ApiError ? err.message : "Failed to load incidents")
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

  async function handleResolve(incident: Incident, resolution: string) {
    if (!eventId || !canWrite) return
    setBusyIncidentId(incident.incidentId)
    patchLocal({
      ...incident,
      status: "resolved",
      resolution,
      resolvedAt: new Date().toISOString(),
    })
    try {
      const res = await resolveIncident(incident.incidentId, resolution, eventId)
      patchLocal(res.data)
      await reload()
      toast.success(`Resolved ${incident.incidentId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not resolve incident")
      await reload().catch(() => undefined)
    } finally {
      setBusyIncidentId(null)
    }
  }

  async function handleEscalate(incident: Incident) {
    if (!eventId || !canWrite) return
    setBusyIncidentId(incident.incidentId)
    const nextSev =
      incident.severity === "info"
        ? "warning"
        : incident.severity === "warning"
          ? "critical"
          : "critical"
    patchLocal({ ...incident, status: "escalated", severity: nextSev })
    try {
      const res = await escalateIncident(incident.incidentId, eventId)
      patchLocal(res.data)
      await reload()
      toast.success(`Escalated ${incident.incidentId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not escalate incident")
      await reload().catch(() => undefined)
    } finally {
      setBusyIncidentId(null)
    }
  }

  async function handleReopen(incident: Incident) {
    if (!eventId || !canWrite) return
    setBusyIncidentId(incident.incidentId)
    patchLocal({
      ...incident,
      status: "open",
      resolution: undefined,
      resolvedAt: undefined,
    })
    try {
      const res = await reopenIncident(incident.incidentId, eventId)
      patchLocal(res.data)
      await reload()
      toast.success(`Reopened ${incident.incidentId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reopen incident")
      await reload().catch(() => undefined)
    } finally {
      setBusyIncidentId(null)
    }
  }

  async function handleLog() {
    if (!eventId || !canWrite || !title.trim()) return
    setLogging(true)
    try {
      const res = await createIncident(eventId, {
        title: title.trim(),
        severity,
        location: location.trim() || undefined,
        category: "ops",
      })
      if (res.data) setIncidents((prev) => [res.data as Incident, ...prev])
      else await reload()
      setTitle("")
      setLocation("")
      setSeverity("warning")
      setShowLog(false)
      toast.success("Incident logged")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not log incident")
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <EventScopeBar
        title="Incident triage"
        events={events}
        eventId={eventId}
        onEventChange={setEventId}
        loading={loadingEvents}
        selectedEvent={selectedEvent}
        compact
        trailing={
          canWrite ? (
            <Button
              size="sm"
              variant={showLog ? "default" : "outline"}
              onClick={() => setShowLog((v) => !v)}
            >
              <PlusIcon className="size-3.5" />
              Log incident
            </Button>
          ) : undefined
        }
      />

      {showLog && canWrite ? (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Title</label>
            <Input
              placeholder="e.g. Mic drop on presenter 2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleLog()}
            />
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-36">
            <label className="text-muted-foreground text-xs font-medium">Severity</label>
            <select
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Location</label>
            <Input
              placeholder="Main stage"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={logging || !title.trim()} onClick={() => void handleLog()}>
            {logging ? "Logging…" : "Submit"}
          </Button>
        </Card>
      ) : null}

      {!canWrite ? (
        <p className="text-muted-foreground text-xs">
          View only — triage actions need ops / producer / pm / admin.
        </p>
      ) : null}

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : (
        <IncidentTriage
          incidents={incidents}
          busyIncidentId={busyIncidentId}
          canWrite={canWrite}
          onResolve={handleResolve}
          onEscalate={handleEscalate}
          onReopen={handleReopen}
        />
      )}
    </div>
  )
}
