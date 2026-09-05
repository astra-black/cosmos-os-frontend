import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { CreateCrewModal } from "@/components/modals"
import { CrewBoard } from "@/components/ops/crew-board"
import { EventScopeBar } from "@/components/ops/event-scope-bar"
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
import { createDepartment, deleteCrew, deleteDepartment, listCrew, listDepartments, updateCrew, updateCrewStatus, updateDepartment } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { CrewMember, Department } from "@/types/agency"

type DepartmentFormData = {
  name: string
  description: string
  color: string
  headOfDepartment: string
  contactEmail: string
  contactPhone: string
  status: string
}

type CrewFormData = {
  name: string
  role: string
  departmentId: string
  email: string
  phone: string
  status: string
}

const emptyDepartmentForm: DepartmentFormData = {
  name: "",
  description: "",
  color: "#3B82F6",
  headOfDepartment: "",
  contactEmail: "",
  contactPhone: "",
  status: "active",
}

const emptyCrewForm: CrewFormData = {
  name: "",
  role: "",
  departmentId: "",
  email: "",
  phone: "",
  status: "assigned",
}

const CREW_STATUSES = ["assigned", "confirmed", "on_site", "complete"] as const
const DEPARTMENT_STATUSES = ["active", "inactive"] as const

function isOptionalEmail(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function CrewPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops")
  const { events, eventId, setEventId, selectedEvent, loadingEvents } = useEventScope()
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCrewId, setBusyCrewId] = useState<string | null>(null)
  const [departmentFormMode, setDepartmentFormMode] = useState<"create" | "edit" | null>(null)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [crewFormMode, setCrewFormMode] = useState<"edit" | null>(null)
  const [createCrewOpen, setCreateCrewOpen] = useState(false)
  const [editingCrew, setEditingCrew] = useState<CrewMember | null>(null)
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormData>(emptyDepartmentForm)
  const [crewForm, setCrewForm] = useState<CrewFormData>(emptyCrewForm)
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

  function openCreateDepartment() {
    setEditingDepartment(null)
    setDepartmentForm(emptyDepartmentForm)
    setDepartmentFormMode("create")
  }

  function openEditDepartment(dept: Department) {
    setEditingDepartment(dept)
    setDepartmentForm({
      name: dept.name,
      description: dept.description ?? "",
      color: dept.color ?? "#3B82F6",
      headOfDepartment: dept.headOfDepartment ?? "",
      contactEmail: dept.contactEmail ?? "",
      contactPhone: dept.contactPhone ?? "",
      status: dept.status,
    })
    setDepartmentFormMode("edit")
  }

  async function handleSaveDepartment() {
    if (!eventId || !canWrite || !departmentForm.name.trim()) return
    if (!isOptionalEmail(departmentForm.contactEmail)) {
      toast.error("Enter a valid department contact email")
      return
    }
    const departmentId = editingDepartment?.departmentId
    setPendingId(departmentId ?? "new-department")
    const payload = {
      name: departmentForm.name.trim(),
      description: departmentForm.description.trim(),
      color: departmentForm.color.trim(),
      headOfDepartment: departmentForm.headOfDepartment.trim(),
      contactEmail: departmentForm.contactEmail.trim(),
      contactPhone: departmentForm.contactPhone.trim(),
      status: departmentForm.status,
    }
    try {
      await withMutationFeedback(
        departmentId ? updateDepartment(departmentId, payload) : createDepartment(eventId, payload),
        {
          loading: departmentId ? "Updating department..." : "Creating department...",
          success: departmentId ? "Department updated" : "Department created",
          error: (err) => err instanceof ApiError ? err.message : "Could not save department",
        },
      )
      setDepartmentForm(emptyDepartmentForm)
      setEditingDepartment(null)
      setDepartmentFormMode(null)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save department")
    } finally {
      setPendingId(null)
    }
  }

  function openCreateCrew() {
    setCreateCrewOpen(true)
  }

  function openEditCrew(member: CrewMember) {
    setEditingCrew(member)
    setCrewForm({
      name: member.name ?? "",
      role: member.role ?? "",
      departmentId: member.departmentId ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      status: member.status,
    })
    setCrewFormMode("edit")
  }

  async function handleSaveCrew() {
    if (!eventId || !canWrite || !crewForm.name.trim() || !crewForm.role.trim() || !crewForm.departmentId || !editingCrew) return
    if (!isOptionalEmail(crewForm.email)) {
      toast.error("Enter a valid crew email")
      return
    }
    const crewId = editingCrew.crewId
    setPendingId(crewId)
    const payload = {
      name: crewForm.name.trim(),
      role: crewForm.role.trim(),
      departmentId: crewForm.departmentId,
      email: crewForm.email.trim(),
      phone: crewForm.phone.trim(),
      status: crewForm.status,
    }
    try {
      await withMutationFeedback(updateCrew(crewId, payload), {
        loading: "Updating crew member...",
        success: "Crew member updated",
        error: (err) => err instanceof ApiError ? err.message : "Could not save crew member",
      })
      setCrewForm(emptyCrewForm)
      setEditingCrew(null)
      setCrewFormMode(null)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save crew member")
    } finally {
      setPendingId(null)
    }
  }
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
         trailing={canWrite ? <div className="flex gap-2"><Button size="sm" variant="outline" onClick={openCreateDepartment}>New department</Button><Button size="sm" onClick={openCreateCrew}>Add crew</Button></div> : undefined}
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
           onEdit={pendingId ? undefined : openEditCrew}
          onDelete={pendingId ? undefined : (member) => setDeleteTarget({ type: "crew", id: member.crewId, name: member.name || member.crewId })}
        />
      )}
      <div className="sr-only">Department management is available from the department cards.</div>
       {departments.length > 0 && canWrite ? <div className="flex flex-wrap gap-2">{departments.map((dept) => <div key={dept.departmentId} className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><span>{dept.name}</span><Button size="icon" variant="ghost" className="size-6" onClick={() => openEditDepartment(dept)}>Edit</Button><Button size="icon" variant="ghost" className="size-6" onClick={() => setDeleteTarget({ type: "department", id: dept.departmentId, name: dept.name })}>×</Button></div>)}</div> : null}
       <EntityFormDialog
         open={departmentFormMode !== null}
         onOpenChange={(open) => {
           if (!open && !pendingId) {
             setDepartmentFormMode(null)
             setEditingDepartment(null)
           }
         }}
         title={departmentFormMode === "edit" ? "Edit department" : "New department"}
         description="Define department ownership, contact details, and availability."
         onSubmit={handleSaveDepartment}
         submitLabel={departmentFormMode === "edit" ? "Save changes" : "Create department"}
         pending={Boolean(pendingId)}
         submitDisabled={!departmentForm.name.trim() || !isOptionalEmail(departmentForm.contactEmail)}
         maxWidth="max-w-2xl"
       >
         <div className="grid gap-4 sm:grid-cols-2">
           <div className="grid gap-1.5"><Label htmlFor="department-name">Name</Label><Input id="department-name" value={departmentForm.name} onChange={(e) => setDepartmentForm((f) => ({ ...f, name: e.target.value }))} placeholder="Department name" required /></div>
           <div className="grid gap-1.5"><Label htmlFor="department-status">Status</Label><Select id="department-status" value={departmentForm.status} onChange={(e) => setDepartmentForm((f) => ({ ...f, status: e.target.value }))}>{DEPARTMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</Select></div>
           <div className="grid gap-1.5"><Label htmlFor="department-color">Color</Label><Input id="department-color" type="color" value={departmentForm.color} onChange={(e) => setDepartmentForm((f) => ({ ...f, color: e.target.value }))} className="h-9 p-1" /></div>
           <div className="grid gap-1.5"><Label htmlFor="department-head">Head of department</Label><Input id="department-head" value={departmentForm.headOfDepartment} onChange={(e) => setDepartmentForm((f) => ({ ...f, headOfDepartment: e.target.value }))} placeholder="Name" /></div>
           <div className="grid gap-1.5"><Label htmlFor="department-email">Contact email</Label><Input id="department-email" type="email" value={departmentForm.contactEmail} onChange={(e) => setDepartmentForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="contact@example.com" /></div>
           <div className="grid gap-1.5"><Label htmlFor="department-phone">Contact phone</Label><Input id="department-phone" type="tel" value={departmentForm.contactPhone} onChange={(e) => setDepartmentForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder="Phone number" /></div>
         </div>
         <div className="grid gap-1.5"><Label htmlFor="department-description">Description</Label><Textarea id="department-description" value={departmentForm.description} onChange={(e) => setDepartmentForm((f) => ({ ...f, description: e.target.value }))} placeholder="Department responsibilities" /></div>
       </EntityFormDialog>
       {eventId ? (
         <CreateCrewModal
           open={createCrewOpen}
           onOpenChange={setCreateCrewOpen}
           eventId={eventId}
           departments={departments}
           onSuccess={async () => {
             await reload()
           }}
         />
       ) : null}
       <EntityFormDialog
         open={crewFormMode === "edit"}
         onOpenChange={(open) => {
           if (!open && !pendingId) {
             setCrewFormMode(null)
             setEditingCrew(null)
           }
         }}
         title="Edit crew member"
         description="Assign a crew member to a department and track their show status."
         onSubmit={handleSaveCrew}
         submitLabel="Save changes"
         pending={Boolean(pendingId)}
         submitDisabled={!crewForm.name.trim() || !crewForm.role.trim() || !crewForm.departmentId || !isOptionalEmail(crewForm.email)}
         maxWidth="max-w-2xl"
       >
         <div className="grid gap-4 sm:grid-cols-2">
           <div className="grid gap-1.5"><Label htmlFor="crew-name">Name</Label><Input id="crew-name" value={crewForm.name} onChange={(e) => setCrewForm((f) => ({ ...f, name: e.target.value }))} placeholder="Crew member name" required /></div>
           <div className="grid gap-1.5"><Label htmlFor="crew-role">Role</Label><Input id="crew-role" value={crewForm.role} onChange={(e) => setCrewForm((f) => ({ ...f, role: e.target.value }))} placeholder="Role" required /></div>
           <div className="grid gap-1.5"><Label htmlFor="crew-department">Department</Label><Select id="crew-department" value={crewForm.departmentId} onChange={(e) => setCrewForm((f) => ({ ...f, departmentId: e.target.value }))} required><option value="">Select department</option>{departments.map((dept) => <option key={dept.departmentId} value={dept.departmentId}>{dept.name}</option>)}</Select></div>
           <div className="grid gap-1.5"><Label htmlFor="crew-status">Status</Label><Select id="crew-status" value={crewForm.status} onChange={(e) => setCrewForm((f) => ({ ...f, status: e.target.value }))}>{CREW_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}</Select></div>
           <div className="grid gap-1.5"><Label htmlFor="crew-email">Email</Label><Input id="crew-email" type="email" value={crewForm.email} onChange={(e) => setCrewForm((f) => ({ ...f, email: e.target.value }))} placeholder="crew@example.com" /></div>
           <div className="grid gap-1.5"><Label htmlFor="crew-phone">Phone</Label><Input id="crew-phone" type="tel" value={crewForm.phone} onChange={(e) => setCrewForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone number" /></div>
         </div>
       </EntityFormDialog>
       <ConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pendingId) setDeleteTarget(null) }} title={`Delete ${deleteTarget?.type ?? "item"}?`} description={deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined} confirmLabel="Delete" destructive pending={Boolean(pendingId)} onConfirm={handleDeleteTarget} />
    </div>
  )
}
