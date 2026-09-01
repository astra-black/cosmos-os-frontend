import { useCallback, useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { EventScopeBar } from "@/components/ops/event-scope-bar"
import { IncidentTriage } from "@/components/ops/incident-triage"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { withMutationFeedback } from "@/components/shared/mutation-feedback"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useEventScope } from "@/hooks/use-event-scope"
import {
  createIncident,
  listDepartments,
  listIncidents,
  updateIncident,
  escalateIncident,
  reopenIncident,
  resolveIncident,
  deleteIncident,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Department, Incident } from "@/types/agency"

type IncidentFormData = {
  title: string
  description: string
  severity: string
  category: string
  departmentId: string
  location: string
  assignedTo: string
}

const emptyIncidentForm: IncidentFormData = {
  title: "",
  description: "",
  severity: "warning",
  category: "ops",
  departmentId: "",
  location: "",
  assignedTo: "",
}

const INCIDENT_SEVERITIES = ["info", "warning", "critical"] as const

export function IncidentsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops")
  const { events, eventId, setEventId, selectedEvent, loadingEvents } = useEventScope()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyIncidentId, setBusyIncidentId] = useState<string | null>(null)
  const [incidentFormMode, setIncidentFormMode] = useState<"create" | "edit" | null>(null)
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [logging, setLogging] = useState(false)
  const [incidentForm, setIncidentForm] = useState<IncidentFormData>(emptyIncidentForm)
  const [pendingMutationId, setPendingMutationId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null)

  const reload = useCallback(async () => {
    if (!eventId) return
    const [listRes, departmentsRes] = await Promise.all([
      listIncidents(eventId),
      listDepartments(eventId).catch(() => null),
    ])
    setIncidents(listRes.data ?? [])
    setDepartments(departmentsRes?.data ?? [])
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

  function openCreateDialog() {
    setEditingIncident(null)
    setIncidentForm(emptyIncidentForm)
    setIncidentFormMode("create")
  }

  function openEditDialog(incident: Incident) {
    setEditingIncident(incident)
    setIncidentForm({
      title: incident.title ?? "",
      description: incident.description ?? "",
      severity: incident.severity,
      category: incident.category ?? "",
      departmentId: incident.departmentId ?? "",
      location: incident.location ?? "",
      assignedTo: incident.assignedTo ?? "",
    })
    setIncidentFormMode("edit")
  }

  async function handleSaveIncident() {
    if (!eventId || !canWrite || !incidentForm.title.trim()) return
    setLogging(true)
    const incidentId = editingIncident?.incidentId
    const payload = {
      title: incidentForm.title.trim(),
      description: incidentForm.description.trim() || undefined,
      severity: incidentForm.severity,
      category: incidentForm.category.trim() || undefined,
      departmentId: incidentForm.departmentId || undefined,
      location: incidentForm.location.trim() || undefined,
      assignedTo: incidentForm.assignedTo.trim() || undefined,
    }
    try {
      if (incidentId) {
        await withMutationFeedback(updateIncident(incidentId, payload), {
          loading: "Updating incident...",
          success: "Incident updated",
          error: (err) => err instanceof ApiError ? err.message : "Could not update incident",
        })
      } else {
        const res = await createIncident(eventId, payload)
        if (res.data) setIncidents((prev) => [res.data, ...prev])
        else await reload()
        toast.success("Incident logged")
      }
      setIncidentForm(emptyIncidentForm)
      setEditingIncident(null)
      setIncidentFormMode(null)
      if (incidentId) await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : incidentId ? "Could not update incident" : "Could not log incident")
    } finally {
      setLogging(false)
    }
  }

  async function handleEdit(incident: Incident) {
    if (!canWrite) return
    openEditDialog(incident)
  }

  async function handleDelete(incident: Incident) {
    if (!canWrite) return
    setPendingMutationId(incident.incidentId)
    try {
      await withMutationFeedback(deleteIncident(incident.incidentId), {
        loading: "Deleting incident...", success: "Incident deleted",
        error: (err) => err instanceof ApiError ? err.message : "Could not delete incident",
      })
      await reload()
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not delete incident")
    } finally { setPendingMutationId(null); setDeleteTarget(null) }
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
              variant={incidentFormMode === "create" ? "default" : "outline"}
              onClick={openCreateDialog}
            >
              <PlusIcon className="size-3.5" />
              Log incident
            </Button>
          ) : undefined
        }
      />

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
          onEdit={pendingMutationId ? undefined : handleEdit}
          onDelete={pendingMutationId ? undefined : (incident) => setDeleteTarget(incident)}
        />
      )}
      <EntityFormDialog
        open={incidentFormMode !== null}
        onOpenChange={(open) => {
          if (!open && !logging) {
            setIncidentFormMode(null)
            setEditingIncident(null)
          }
        }}
        title={incidentFormMode === "edit" ? "Edit incident" : "Log incident"}
        description="Capture the incident details and route it to the right department or owner."
        onSubmit={handleSaveIncident}
        submitLabel={incidentFormMode === "edit" ? "Save changes" : "Log incident"}
        pending={logging}
        submitDisabled={!incidentForm.title.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="incident-title">Title</Label><Input id="incident-title" value={incidentForm.title} onChange={(e) => setIncidentForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Mic drop on presenter 2" required /></div>
          <div className="grid gap-1.5"><Label htmlFor="incident-severity">Severity</Label><Select id="incident-severity" value={incidentForm.severity} onChange={(e) => setIncidentForm((f) => ({ ...f, severity: e.target.value }))}>{INCIDENT_SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}</option>)}</Select></div>
          <div className="grid gap-1.5"><Label htmlFor="incident-category">Category</Label><Input id="incident-category" value={incidentForm.category} onChange={(e) => setIncidentForm((f) => ({ ...f, category: e.target.value }))} placeholder="Operations" /></div>
          <div className="grid gap-1.5"><Label htmlFor="incident-department">Department</Label><Select id="incident-department" value={incidentForm.departmentId} onChange={(e) => setIncidentForm((f) => ({ ...f, departmentId: e.target.value }))}><option value="">Unassigned department</option>{departments.map((department) => <option key={department.departmentId} value={department.departmentId}>{department.name}</option>)}</Select></div>
          <div className="grid gap-1.5"><Label htmlFor="incident-assignee">Assigned to</Label><Input id="incident-assignee" value={incidentForm.assignedTo} onChange={(e) => setIncidentForm((f) => ({ ...f, assignedTo: e.target.value }))} placeholder="Person or team" /></div>
          <div className="grid gap-1.5 sm:col-span-2"><Label htmlFor="incident-location">Location</Label><Input id="incident-location" value={incidentForm.location} onChange={(e) => setIncidentForm((f) => ({ ...f, location: e.target.value }))} placeholder="Main stage" /></div>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="incident-description">Description</Label><Textarea id="incident-description" value={incidentForm.description} onChange={(e) => setIncidentForm((f) => ({ ...f, description: e.target.value }))} placeholder="What happened?" /></div>
      </EntityFormDialog>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !pendingMutationId) setDeleteTarget(null) }}
        title="Delete incident?"
        description={deleteTarget ? `This will permanently delete “${deleteTarget.title || deleteTarget.incidentId}”.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={Boolean(pendingMutationId)}
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget) : undefined}
      />
    </div>
  )
}
