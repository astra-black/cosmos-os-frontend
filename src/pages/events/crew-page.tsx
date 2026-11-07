import { useCallback, useEffect, useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CreateCrewModal } from "@/components/modals"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { withMutationFeedback } from "@/components/shared/mutation-feedback"
import { VendorsCrewTabs } from "@/components/vendors/vendors-crew-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useVendors } from "@/hooks/use-agency-data"
import { useEventScope } from "@/hooks/use-event-scope"
import {
  checkInCrew,
  createDepartment,
  deleteCrew,
  deleteDepartment,
  getEvent,
  listCrew,
  listDepartments,
  prefillCrewFromProject,
  updateCrew,
  updateCrewStatus,
  updateDepartment,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canAccessRoute, canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
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

const CREW_STATUSES = ["assigned", "invited", "confirmed", "on_site", "complete", "no_show", "cancelled"] as const
const DEPARTMENT_STATUSES = ["active", "inactive"] as const

function isOptionalEmail(value: string) {
  return !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
}

function normalizeStatus(status: string) {
  return (status || "").toLowerCase().replace(/\s+/g, "_")
}

/** Map API CrewStatus to Figma roster labels without inventing attendance. */
function rosterStatus(member: CrewMember): { label: string; tone: "success" | "warning" | "info" | "neutral" | "critical" } {
  const s = normalizeStatus(member.status)
  if (s === "on_site") return { label: "Checked In", tone: "success" }
  if (s === "complete") return { label: "Complete", tone: "success" }
  if (s === "confirmed") return { label: "Confirmed", tone: "info" }
  if (s === "no_show") return { label: "No Show", tone: "critical" }
  if (s === "cancelled") return { label: "Cancelled", tone: "neutral" }
  if (s === "assigned" || s === "invited") return { label: "Not Called", tone: "neutral" }
  return { label: member.status?.replaceAll("_", " ") || "Unknown", tone: "neutral" }
}

function formatClock(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function CrewPage() {
  const { user } = useAuth()
  const canView = canAccessRoute(user?.role, "/crew")
  const canWrite = canPerform(user?.role, "write_ops")
  const agencyLabel = user?.agencyName?.trim() || "Workspace"
  const { data: vendors } = useVendors()
  const { events, eventId, setEventId, selectedEvent, loadingEvents, eventsError } = useEventScope()

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
  const [prefillBusy, setPrefillBusy] = useState(false)
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!eventId) return
    const [crewRes, deptRes] = await Promise.all([
      listCrew(eventId),
      listDepartments(eventId).catch((err) => {
        console.warn("[CrewPage] Failed to load departments:", err)
        return null
      }),
    ])
    setCrew(crewRes.data ?? [])
    setDepartments(deptRes?.data ?? [])
  }, [eventId])

  function patchLocal(updated: CrewMember | null | undefined) {
    if (!updated?.crewId) return
    setCrew((prev) =>
      prev.map((c) => (c.crewId === updated.crewId || c.id === updated.id ? { ...c, ...updated } : c)),
    )
  }

  useEffect(() => {
    if (!eventId) {
      setLinkedProjectId(null)
      return
    }
    let cancelled = false
    getEvent(eventId)
      .then((res) => {
        if (cancelled) return
        const pid = res.data?.metadata?.projectId
        setLinkedProjectId(typeof pid === "string" ? pid : null)
      })
      .catch((err) => {
        console.warn("[CrewPage] Failed to load linked project:", err)
        if (!cancelled) setLinkedProjectId(null)
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  useEffect(() => {
    if (!eventId) {
      setCrew([])
      setDepartments([])
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

  const kpis = useMemo(() => {
    /** Called = roster statuses past “Not Called” (invited/assigned). */
    const called = crew.filter((m) => {
      const s = normalizeStatus(m.status)
      return s === "confirmed" || s === "on_site" || s === "complete" || s === "no_show" || s === "cancelled"
    }).length
    const checkedIn = crew.filter((m) => {
      const s = normalizeStatus(m.status)
      return s === "on_site" || s === "complete"
    })
    const unconfirmed = crew.filter((m) => {
      const s = normalizeStatus(m.status)
      return s === "invited" || s === "assigned" || s === ""
    })
    const latestCheckIn = checkedIn
      .map((m) => m.onSiteAt)
      .filter(Boolean)
      .map((iso) => new Date(iso as string).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => b - a)[0]
    const checkInClock = latestCheckIn ? formatClock(new Date(latestCheckIn).toISOString()) : null

    return {
      called,
      checkedIn: checkedIn.length,
      checkedInSource: checkInClock
        ? `Source: crew check-in · ${checkInClock}`
        : checkedIn.length
          ? "Source: crew check-in API"
          : "No check-ins recorded",
      unconfirmed: unconfirmed.length,
      orgHint:
        departments.length > 0
          ? `Across ${departments.length} department${departments.length === 1 ? "" : "s"}`
          : "Event roster",
    }
  }, [crew, departments.length])

  async function handlePrefillFromVendors() {
    if (!eventId || !canWrite) return
    setPrefillBusy(true)
    try {
      const res = await withMutationFeedback(
        prefillCrewFromProject(eventId, linkedProjectId ? { projectId: linkedProjectId } : {}),
        {
          loading: "Importing vendors into crew roster...",
          success: "Crew roster updated from project vendors",
          error: (err) =>
            err instanceof ApiError ? err.message : "Could not prefill crew from vendors",
        },
      )
      await reload()
      const data = (res as { data?: { createdCount?: number; message?: string } })?.data
      if ((data?.createdCount ?? 0) === 0) {
        toast.info(data?.message || "No new crew members added")
      }
    } catch {
      // toasted
    } finally {
      setPrefillBusy(false)
    }
  }

  async function handleStatusChange(member: CrewMember, nextStatus: string) {
    if (!eventId || !canWrite) return
    setBusyCrewId(member.crewId)
    patchLocal({ ...member, status: nextStatus })
    try {
      if (normalizeStatus(nextStatus) === "on_site") {
        const res = await checkInCrew(eventId, member.crewId)
        patchLocal(res.data)
      } else {
        const res = await updateCrewStatus(member.crewId, nextStatus, eventId)
        patchLocal(res.data)
      }
      await reload()
      toast.success(`${member.name || member.crewId} → ${nextStatus.replaceAll("_", " ")}`)
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

  function openCreateCrew() {
    if (departments.length === 0) {
      toast.info("Create a department first", {
        description: "Crew must belong to a department for this event.",
      })
      openCreateDepartment()
      return
    }
    setCreateCrewOpen(true)
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
    if (!eventId || !canWrite || !departmentForm.name.trim()) {
      toast.error("Please fill in all required fields")
      return
    }
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
          error: (err) => (err instanceof ApiError ? err.message : "Could not save department"),
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

  function openEditCrew(member: CrewMember) {
    setEditingCrew(member)
    setCrewForm({
      name: member.name ?? "",
      role: member.role ?? "",
      departmentId: member.departmentId ?? "",
      email: member.email ?? "",
      phone: member.phone ?? "",
      status: normalizeStatus(member.status) || "assigned",
    })
    setCrewFormMode("edit")
  }

  async function handleSaveCrew() {
    if (!eventId || !canWrite || !crewForm.name.trim() || !crewForm.role.trim() || !crewForm.departmentId || !editingCrew) {
      toast.error("Please fill in all required fields")
      return
    }
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
        error: (err) => (err instanceof ApiError ? err.message : "Could not save crew member"),
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

  async function handleDeleteTarget() {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    setPendingId(targetId)
    try {
      const mutation = deleteTarget.type === "crew" ? deleteCrew(targetId) : deleteDepartment(targetId)
      await withMutationFeedback(mutation, {
        loading: `Deleting ${deleteTarget.type}...`,
        success: `${deleteTarget.type === "crew" ? "Crew member" : "Department"} deleted`,
        error: "Could not delete item",
      })
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete item")
    } finally {
      setPendingId(null)
      setDeleteTarget(null)
    }
  }

  if (!canView) {
    return (
      <div className="cosmos-vc-page">
        <EmptyState
          title="Crew is unavailable"
          description="Your role cannot open the show-day crew roster."
        />
      </div>
    )
  }

  const eventTitle = selectedEvent?.name?.trim() || "Show Day Crew"
  const eyebrow = selectedEvent
    ? `${agencyLabel} · ${selectedEvent.name}`
    : `${agencyLabel} · Workspace`

  return (
    <div className="cosmos-vc-page">
      <div className="cosmos-vc-page__head">
        <p className="cosmos-vc-page__eyebrow">{eyebrow}</p>
        <div className="cosmos-vc-page__title-row">
          <h1>Vendors &amp; Crew</h1>
          <div className="cosmos-vc-page__actions">
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Request Replacement is not in the Agency OS API yet"
            >
              Request Replacement · Unavailable
            </Button>
          </div>
        </div>
      </div>

      <VendorsCrewTabs active="crew" vendorCount={vendors.length} crewCount={crew.length || "—"} />

      <div className="cosmos-vc-scope">
        <label className="cosmos-vc-scope__label" htmlFor="crew-event-scope">
          Event
        </label>
        {loadingEvents ? (
          <Skeleton className="h-9 w-56" />
        ) : (
          <Select
            id="crew-event-scope"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            aria-label="Operating event"
            className="cosmos-vc-scope__select"
          >
            {events.length === 0 ? <option value="">No events</option> : null}
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.name}
              </option>
            ))}
          </Select>
        )}
        {selectedEvent ? (
          <span className="cosmos-vc-scope__meta capitalize">{selectedEvent.status}</span>
        ) : null}
      </div>

      {eventsError ? (
        <div className="cosmos-vc-page__error" role="alert">
          <span>{eventsError}</span>
        </div>
      ) : null}

      {error ? (
        <div className="cosmos-vc-page__error" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!eventId && !loadingEvents ? (
        <EmptyState
          title="No event selected"
          description="Create or select an event to load the show-day crew roster."
        />
      ) : loading ? (
        <div className="space-y-3">
          <div className="cosmos-vc-kpis">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="cosmos-vc-kpis">
            <article className="cosmos-vc-kpi">
              <p className="cosmos-vc-kpi__label">Called</p>
              <p className="cosmos-vc-kpi__value">{kpis.called}</p>
              <p className="cosmos-vc-kpi__sub">{kpis.orgHint}</p>
            </article>
            <article className="cosmos-vc-kpi">
              <p className="cosmos-vc-kpi__label">Checked In</p>
              <p className="cosmos-vc-kpi__value">{kpis.checkedIn}</p>
              <p className="cosmos-vc-kpi__sub">{kpis.checkedInSource}</p>
            </article>
            <article className="cosmos-vc-kpi">
              <p className="cosmos-vc-kpi__label">Running Late</p>
              <p className="cosmos-vc-kpi__value">—</p>
              <p className="cosmos-vc-kpi__sub">Not tracked by crew API</p>
            </article>
            <article className="cosmos-vc-kpi">
              <p className="cosmos-vc-kpi__label">Unconfirmed</p>
              <p className="cosmos-vc-kpi__value">{kpis.unconfirmed}</p>
              <p className="cosmos-vc-kpi__sub">Invited or assigned only</p>
            </article>
          </div>

          <section className="cosmos-vc-roster">
            <header className="cosmos-vc-roster__head">
              <h2>{eventTitle} · Show Day Crew</h2>
              {canWrite ? (
                <div className="cosmos-vc-roster__actions">
                  <Button size="sm" variant="outline" onClick={openCreateDepartment}>
                    Department
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={prefillBusy}
                    onClick={() => void handlePrefillFromVendors()}
                  >
                    {prefillBusy ? "Importing…" : "Import vendors"}
                  </Button>
                  <Button size="sm" onClick={openCreateCrew}>
                    <PlusIcon className="size-3.5" />
                    Add To Call
                  </Button>
                </div>
              ) : null}
            </header>

            {departments.length === 0 ? (
              <EmptyState
                title="No departments yet"
                description="Create a department before assigning crew for this event."
                action={
                  canWrite ? (
                    <Button size="sm" onClick={openCreateDepartment}>
                      New department
                    </Button>
                  ) : undefined
                }
              />
            ) : crew.length === 0 ? (
              <EmptyState
                title="No crew on this call"
                description={
                  canWrite
                    ? "Add crew to the call or import project vendors."
                    : "No crew members are assigned to this event."
                }
                action={
                  canWrite ? (
                    <Button size="sm" onClick={openCreateCrew}>
                      Add To Call
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="cosmos-vc-table-wrap">
                <table className="cosmos-vc-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Organization</th>
                      <th>Call</th>
                      <th>Status</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {crew.map((member) => {
                      const status = rosterStatus(member)
                      const org =
                        member.departmentName?.trim() ||
                        departments.find((d) => d.departmentId === member.departmentId)?.name ||
                        agencyLabel
                      const busy = busyCrewId === member.crewId
                      return (
                        <tr key={member.crewId} className={cn(busy && "is-busy")}>
                          <td>
                            <button
                              type="button"
                              className="cosmos-vc-vendor-cell cosmos-vc-person-btn"
                              onClick={() => openEditCrew(member)}
                              disabled={!canWrite || Boolean(pendingId)}
                            >
                              <span className="cosmos-vc-mark" aria-hidden>
                                {initials(member.name || "?") || "?"}
                              </span>
                              <span>
                                <span className="cosmos-vc-vendor-name">
                                  {member.name || "Unnamed"}
                                </span>
                                <span className="cosmos-vc-vendor-sub">
                                  {member.role?.trim() || "Crew"}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td>{org}</td>
                          <td>
                            <span
                              className="cosmos-vc-mono cosmos-vc-muted"
                              title="Call-sheet times are not stored on Crew records"
                            >
                              —
                            </span>
                          </td>
                          <td>
                            <div className="cosmos-vc-status-cell">
                              <span className={cn("cosmos-vc-status", `is-${status.tone}`)}>
                                {status.label}
                              </span>
                              {canWrite ? (
                                <Select
                                  value={normalizeStatus(member.status) || "assigned"}
                                  disabled={busy || Boolean(pendingId)}
                                  aria-label={`Status for ${member.name || member.crewId}`}
                                  className="cosmos-vc-status-select"
                                  onChange={(e) => void handleStatusChange(member, e.target.value)}
                                >
                                  {CREW_STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                      {s.replaceAll("_", " ")}
                                    </option>
                                  ))}
                                </Select>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className="cosmos-vc-row-actions">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled
                                title="In-roster messaging is not connected"
                              >
                                Message
                              </Button>
                              {canWrite ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  disabled={Boolean(pendingId)}
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: "crew",
                                      id: member.crewId,
                                      name: member.name || member.crewId,
                                    })
                                  }
                                >
                                  Remove
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="cosmos-vc-footnote">
                  Called counts confirmed / on-site / complete / no-show / cancelled only. Checked-in
                  uses crew check-in / status APIs. Running late and call-sheet times are not on the
                  Crew model (Call column stays —). Message and Request Replacement are not available
                  yet.
                </p>
              </div>
            )}

            {departments.length > 0 && canWrite ? (
              <div className="cosmos-vc-dept-chips">
                {departments.map((dept) => (
                  <div key={dept.departmentId} className="cosmos-vc-dept-chip">
                    <span>{dept.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => openEditDepartment(dept)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() =>
                        setDeleteTarget({
                          type: "department",
                          id: dept.departmentId,
                          name: dept.name,
                        })
                      }
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}

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
          <div className="grid gap-1.5">
            <Label htmlFor="department-name">Name</Label>
            <Input
              id="department-name"
              value={departmentForm.name}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="department-status">Status</Label>
            <Select
              id="department-status"
              value={departmentForm.status}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, status: e.target.value }))}
            >
              {DEPARTMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="department-color">Color</Label>
            <Input
              id="department-color"
              type="color"
              value={departmentForm.color}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, color: e.target.value }))}
              className="h-9 p-1"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="department-head">Head of department</Label>
            <Input
              id="department-head"
              value={departmentForm.headOfDepartment}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, headOfDepartment: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="department-email">Contact email</Label>
            <Input
              id="department-email"
              type="email"
              value={departmentForm.contactEmail}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, contactEmail: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="department-phone">Contact phone</Label>
            <Input
              id="department-phone"
              type="tel"
              value={departmentForm.contactPhone}
              onChange={(e) => setDepartmentForm((f) => ({ ...f, contactPhone: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="department-description">Description</Label>
          <Textarea
            id="department-description"
            value={departmentForm.description}
            onChange={(e) => setDepartmentForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
      </EntityFormDialog>

      {eventId ? (
        <CreateCrewModal
          open={createCrewOpen}
          onOpenChange={setCreateCrewOpen}
          eventId={eventId}
          departments={departments}
          onNeedDepartment={openCreateDepartment}
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
        submitDisabled={
          !crewForm.name.trim() ||
          !crewForm.role.trim() ||
          !crewForm.departmentId ||
          !isOptionalEmail(crewForm.email)
        }
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="crew-name">Name</Label>
            <Input
              id="crew-name"
              value={crewForm.name}
              onChange={(e) => setCrewForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="crew-role">Role</Label>
            <Input
              id="crew-role"
              value={crewForm.role}
              onChange={(e) => setCrewForm((f) => ({ ...f, role: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="crew-department">Department</Label>
            <Select
              id="crew-department"
              value={crewForm.departmentId}
              onChange={(e) => setCrewForm((f) => ({ ...f, departmentId: e.target.value }))}
              required
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept.departmentId} value={dept.departmentId}>
                  {dept.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="crew-status">Status</Label>
            <Select
              id="crew-status"
              value={crewForm.status}
              onChange={(e) => setCrewForm((f) => ({ ...f, status: e.target.value }))}
            >
              {CREW_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="crew-email">Email</Label>
            <Input
              id="crew-email"
              type="email"
              value={crewForm.email}
              onChange={(e) => setCrewForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="crew-phone">Phone</Label>
            <Input
              id="crew-phone"
              type="tel"
              value={crewForm.phone}
              onChange={(e) => setCrewForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>
      </EntityFormDialog>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !pendingId) setDeleteTarget(null)
        }}
        title={`Delete ${deleteTarget?.type ?? "item"}?`}
        description={
          deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined
        }
        confirmLabel="Delete"
        destructive
        pending={Boolean(pendingId)}
        onConfirm={handleDeleteTarget}
      />
    </div>
  )
}
