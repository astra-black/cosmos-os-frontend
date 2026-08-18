import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { CrewBoard } from "@/components/ops/crew-board"
import { EventScopeBar } from "@/components/ops/event-scope-bar"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { withMutationFeedback } from "@/components/shared/mutation-feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useEventScope } from "@/hooks/use-event-scope"
import { createCrew, createDepartment, deleteCrew, deleteDepartment, listCrew, listDepartments, updateCrew, updateCrewStatus, updateDepartment } from "@/lib/api/agency"
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
  const [showDepartment, setShowDepartment] = useState(false)
  const [showCrew, setShowCrew] = useState(false)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "crew" | "department"; id: string; name: string } | null>(null)

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

  async function handleCreateDepartment() {
    if (!eventId || !canWrite || !name.trim()) return
    setPendingId("new-department")
    try { await withMutationFeedback(createDepartment(eventId, { name: name.trim(), status: "active" }), { loading: "Creating department...", success: "Department created", error: (err) => err instanceof ApiError ? err.message : "Could not create department" }); setName(""); setShowDepartment(false); await reload() }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not create department") } finally { setPendingId(null) }
  }

  async function handleCreateCrew() {
    if (!eventId || !canWrite || !name.trim() || !role.trim() || !departmentId) return
    setPendingId("new-crew")
    try { await withMutationFeedback(createCrew(eventId, { name: name.trim(), role: role.trim(), departmentId, status: "assigned" }), { loading: "Adding crew member...", success: "Crew member added", error: (err) => err instanceof ApiError ? err.message : "Could not add crew member" }); setName(""); setRole(""); setDepartmentId(""); setShowCrew(false); await reload() }
    catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not add crew member") } finally { setPendingId(null) }
  }

  async function handleEditDepartment(dept: Department) { const next = window.prompt("Department name", dept.name); if (!next || !next.trim() || next.trim() === dept.name) return; setPendingId(dept.departmentId); try { await withMutationFeedback(updateDepartment(dept.departmentId, { name: next.trim() }), { loading: "Updating department...", success: "Department updated", error: "Could not update department" }); await reload() } catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not update department") } finally { setPendingId(null) } }
  async function handleEditCrew(member: CrewMember) { const next = window.prompt("Crew member name", member.name || ""); if (!next || !next.trim() || next.trim() === member.name) return; setPendingId(member.crewId); try { await withMutationFeedback(updateCrew(member.crewId, { name: next.trim() }), { loading: "Updating crew member...", success: "Crew member updated", error: "Could not update crew member" }); await reload() } catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not update crew member") } finally { setPendingId(null) } }
  async function handleDeleteTarget() { if (!deleteTarget) return; setPendingId(deleteTarget.id); try { const mutation = deleteTarget.type === "crew" ? deleteCrew(deleteTarget.id) : deleteDepartment(deleteTarget.id); await withMutationFeedback(mutation, { loading: `Deleting ${deleteTarget.type}...`, success: `${deleteTarget.type === "crew" ? "Crew member" : "Department"} deleted`, error: "Could not delete item" }); await reload() } catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not delete item") } finally { setPendingId(null); setDeleteTarget(null) } }

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
        trailing={canWrite ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setShowDepartment((v) => !v)}>New department</Button><Button size="sm" onClick={() => setShowCrew((v) => !v)}>Add crew</Button></div> : undefined}
      />

      {showDepartment ? <Card className="flex gap-2 p-3"><Input placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} /><Button disabled={Boolean(pendingId) || !name.trim()} onClick={() => void handleCreateDepartment()}>Create</Button></Card> : null}
      {showCrew ? <Card className="flex flex-wrap gap-2 p-3"><Input className="min-w-40 flex-1" placeholder="Crew name" value={name} onChange={(e) => setName(e.target.value)} /><Input className="min-w-40 flex-1" placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} /><select className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">Department</option>{departments.map((dept) => <option key={dept.departmentId} value={dept.departmentId}>{dept.name}</option>)}</select><Button disabled={Boolean(pendingId) || !name.trim() || !role.trim() || !departmentId} onClick={() => void handleCreateCrew()}>Create</Button></Card> : null}

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
          onEdit={pendingId ? undefined : handleEditCrew}
          onDelete={pendingId ? undefined : (member) => setDeleteTarget({ type: "crew", id: member.crewId, name: member.name || member.crewId })}
        />
      )}
      <div className="sr-only">Department management is available from the department cards.</div>
      {departments.length > 0 && canWrite ? <div className="flex flex-wrap gap-2">{departments.map((dept) => <div key={dept.departmentId} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><span>{dept.name}</span><Button size="icon" variant="ghost" className="size-6" onClick={() => void handleEditDepartment(dept)}>Edit</Button><Button size="icon" variant="ghost" className="size-6" onClick={() => setDeleteTarget({ type: "department", id: dept.departmentId, name: dept.name })}>×</Button></div>)}</div> : null}
      <ConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pendingId) setDeleteTarget(null) }} title={`Delete ${deleteTarget?.type ?? "item"}?`} description={deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined} confirmLabel="Delete" destructive pending={Boolean(pendingId)} onConfirm={handleDeleteTarget} />
    </div>
  )
}
