import { useState, useMemo } from "react"
import { Link } from "react-router-dom"
import { FlagIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useMilestones, useProjects } from "@/hooks/use-agency-data"
import { createMilestone, deleteMilestone, updateMilestone } from "@/lib/api/agency"
import { ShareWithClientToggle } from "@/components/shared/share-with-client-toggle"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Milestone, MilestoneStatus } from "@/types/agency"
import { cn } from "@/lib/utils"

const STATUSES: MilestoneStatus[] = ["upcoming", "done", "missed"]

function parseDate(dateStr?: string) {
  if (!dateStr) return { month: "TBD", day: "--", year: "" }
  const d = new Date(dateStr + "T00:00:00")
  if (isNaN(d.getTime())) return { month: "TBD", day: "--", year: "" }
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  const day = String(d.getDate()).padStart(2, "0")
  const year = d.getFullYear()
  return { month, day, year }
}

function getMilestoneBadge(status: MilestoneStatus) {
  if (status === "done") return <Badge variant="success">Done</Badge>
  if (status === "missed") return <Badge variant="danger">Missed</Badge>
  return <Badge variant="warning">Upcoming</Badge>
}

type MilestoneForm = {
  milestoneId: string
  name: string
  dueDate: string
  status: MilestoneStatus
  notes: string
  projectId: string
}

const emptyForm: MilestoneForm = {
  milestoneId: "",
  name: "",
  dueDate: "",
  status: "upcoming",
  notes: "",
  projectId: "",
}

function formFromMilestone(milestone: Milestone): MilestoneForm {
  return {
    milestoneId: milestone.milestoneId,
    name: milestone.name,
    dueDate: milestone.dueDate,
    status: milestone.status,
    notes: milestone.notes ?? "",
    projectId: milestone.projectId ?? (Array.isArray(milestone.project) ? milestone.project[0] : milestone.project) ?? "",
  }
}

export function MilestonesPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")
  const { data: milestones, loading, error, reload } = useMilestones()
  const { data: projects } = useProjects()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MilestoneForm>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [pendingMilestoneId, setPendingMilestoneId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null)
  const [filterTab, setFilterTab] = useState<string>("All")

  const filteredMilestones = useMemo(() => {
    if (filterTab === "Upcoming") return milestones.filter((m) => m.status === "upcoming")
    if (filterTab === "Done") return milestones.filter((m) => m.status === "done")
    if (filterTab === "Missed") return milestones.filter((m) => m.status === "missed")
    return milestones
  }, [milestones, filterTab])

  const tabCounts = useMemo(() => {
    return {
      All: milestones.length,
      Upcoming: milestones.filter((m) => m.status === "upcoming").length,
      Done: milestones.filter((m) => m.status === "done").length,
      Missed: milestones.filter((m) => m.status === "missed").length,
    }
  }, [milestones])

  function updateForm(field: keyof MilestoneForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function validate() {
    if (!form.name.trim()) return "Name is required"
    if (!form.dueDate) return "DueDate is required"
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dueDate)) return "DueDate must be YYYY-MM-DD"
    if (!form.projectId) return "Project link is required"
    return null
  }

  function startCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, projectId: projects[0]?.projectId ?? "" })
    setShowCreate(true)
  }

  function startEdit(milestone: Milestone) {
    setShowCreate(false)
    setEditingId(milestone.milestoneId)
    setForm(formFromMilestone(milestone))
  }

  function cancelForm() {
    setShowCreate(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function save() {
    if (!canWrite) return
    const validationError = validate()
    if (validationError) {
      toast.error(validationError)
      return
    }
    setBusy(true)
    const body = {
      ...(form.milestoneId.trim() ? { milestoneId: form.milestoneId.trim() } : {}),
      name: form.name.trim(),
      dueDate: form.dueDate,
      status: form.status,
      notes: form.notes,
      projectId: form.projectId,
    }
    try {
      if (editingId) {
        await updateMilestone(editingId, body)
        toast.success("Milestone updated")
      } else {
        await createMilestone(body)
        toast.success("Milestone created")
      }
      cancelForm()
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save milestone")
    } finally {
      setBusy(false)
    }
  }

  async function removeMilestone() {
    if (!deleteTarget || !canWrite || !deleteTarget.milestoneId) return
    setPendingMilestoneId(deleteTarget.milestoneId)
    try {
      await deleteMilestone(deleteTarget.milestoneId)
      await reload()
      toast.success("Milestone deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete milestone")
    } finally {
      setPendingMilestoneId(null)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Milestones & Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Key client deliverables, checkpoint approvals, and critical production dates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void reload()}
            className="gap-1.5"
          >
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
          {canWrite && (
            <Button
              size="sm"
              onClick={startCreate}
              className="gap-1.5 bg-[#270045] hover:bg-[#3b006a] text-white shadow-sm"
            >
              <PlusIcon className="size-4" />
              New milestone
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(["All", "Upcoming", "Done", "Missed"] as const).map((tab) => {
          const count = tabCounts[tab]
          const isActive = filterTab === tab
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all select-none shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-surface-alt/80"
              )}
            >
              <span>{tab}</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-surface-alt text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center rounded-2xl">
          <p className="font-sora text-sm font-semibold text-foreground">Could not load milestones</p>
          <p className="text-muted-foreground text-xs">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCwIcon className="size-3.5" />
            Retry
          </Button>
        </Card>
      ) : filteredMilestones.length === 0 ? (
        <EmptyState
          icon={<FlagIcon className="size-5" />}
          title={`No ${filterTab !== "All" ? filterTab.toLowerCase() : ""} milestones`}
          description="Create a milestone checkpoint to start tracking critical delivery dates."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMilestones.map((milestone) => {
            const project = projects.find((item) => item.projectId === milestone.projectId)
            const { month, day, year } = parseDate(milestone.dueDate)
            return (
              <div
                key={milestone.milestoneId}
                className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] flex flex-col justify-between gap-4 hover:border-primary/40 transition-all group"
              >
                <div className="flex items-start gap-4">
                  {/* Big Date Tile */}
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-surface-alt/80 border border-border shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{month}</span>
                    <span className="font-sora text-xl font-bold text-foreground leading-none mt-0.5">{day}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-sora font-semibold text-base text-foreground leading-tight truncate">
                        {milestone.name}
                      </h3>
                      {getMilestoneBadge(milestone.status)}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {project ? (
                        <Link
                          to={`/projects/${project.projectId}`}
                          className="inline-flex items-center text-xs text-primary font-medium hover:underline truncate"
                        >
                          {project.projectName}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unlinked project</span>
                      )}
                      {year && <span className="text-xs text-muted-foreground">· {year}</span>}
                    </div>

                    {milestone.notes ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                        {milestone.notes}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Actions & Sharing */}
                <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                  <div className="flex items-center gap-1">
                    {milestone.clientId ? (
                      <ShareWithClientToggle
                        clientId={milestone.clientId}
                        entityType="milestone"
                        entityId={milestone.milestoneId}
                        clientVisible={milestone.clientVisible}
                        size="sm"
                      />
                    ) : null}
                  </div>

                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs px-2.5 gap-1 hover:text-primary"
                        disabled={Boolean(pendingMilestoneId)}
                        onClick={() => startEdit(milestone)}
                      >
                        <PencilIcon className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={Boolean(pendingMilestoneId)}
                        onClick={() => setDeleteTarget(milestone)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <EntityFormDialog
        open={showCreate || Boolean(editingId)}
        onOpenChange={(open) => {
          if (!open && !busy) cancelForm()
        }}
        title={editingId ? "Edit milestone" : "Create milestone"}
        description="Keep the checkpoint linked to a project with a valid delivery date."
        onSubmit={save}
        submitLabel={editingId ? "Save changes" : "Create milestone"}
        pending={busy}
        submitDisabled={!form.name.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="milestone-form-id">Milestone ID</Label>
            <Input
              id="milestone-form-id"
              value={form.milestoneId}
              onChange={(event) => updateForm("milestoneId", event.target.value)}
              placeholder="Generated if blank"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="milestone-form-name">Name</Label>
            <Input
              id="milestone-form-name"
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              placeholder="Launch creative review"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="milestone-form-date">Due date</Label>
            <Input
              id="milestone-form-date"
              type="date"
              value={form.dueDate}
              onChange={(event) => updateForm("dueDate", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="milestone-form-status">Status</Label>
            <Select
              id="milestone-form-status"
              value={form.status}
              onChange={(event) => updateForm("status", event.target.value)}
            >
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="milestone-form-project">Project</Label>
            <Select
              id="milestone-form-project"
              value={form.projectId}
              onChange={(event) => updateForm("projectId", event.target.value)}
              required
            >
              <option value="">Select a project</option>
              {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}
              {form.projectId && !projects.some((project) => project.projectId === form.projectId) ? (
                <option value={form.projectId}>{form.projectId}</option>
              ) : null}
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="milestone-form-notes">Notes</Label>
            <textarea
              id="milestone-form-notes"
              className="border-input bg-background min-h-20 rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              placeholder="Optional context"
            />
          </div>
        </div>
      </EntityFormDialog>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !pendingMilestoneId) setDeleteTarget(null) }}
        title="Delete milestone?"
        description={deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={Boolean(pendingMilestoneId)}
        onConfirm={removeMilestone}
      />
    </div>
  )
}
