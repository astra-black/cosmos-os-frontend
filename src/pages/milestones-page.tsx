import { useState } from "react"
import { FlagIcon, Loader2Icon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useMilestones, useProjects } from "@/hooks/use-agency-data"
import { createMilestone, deleteMilestone, updateMilestone } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Milestone, MilestoneStatus } from "@/types/agency"
import { cn } from "@/lib/utils"

const STATUSES: MilestoneStatus[] = ["upcoming", "done", "missed"]

const statusTone: Record<MilestoneStatus, string> = {
  upcoming: "bg-chart-2/15 text-chart-2",
  done: "bg-chart-1/15 text-chart-1",
  missed: "bg-destructive/15 text-destructive",
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

  const formPanel = showCreate || editingId
    ? <Card className="gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium">
            MilestoneId
            <Input value={form.milestoneId} onChange={(event) => updateForm("milestoneId", event.target.value)} placeholder="Generated if blank" />
          </label>
          <label className="grid gap-1 text-xs font-medium sm:col-span-2">
            Name
            <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Launch creative review" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            DueDate
            <Input type="date" value={form.dueDate} onChange={(event) => updateForm("dueDate", event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Status
            <select className="border-input bg-background h-8 rounded-lg border px-2 text-sm" value={form.status} onChange={(event) => updateForm("status", event.target.value)}>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium sm:col-span-2">
            Project link
            <select className="border-input bg-background h-8 rounded-lg border px-2 text-sm" value={form.projectId} onChange={(event) => updateForm("projectId", event.target.value)}>
              <option value="">Select a project</option>
              {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium sm:col-span-2">
            Notes
            <textarea className="border-input bg-background min-h-8 rounded-lg border px-2 py-1.5 text-sm" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Optional context" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            {editingId ? "Save changes" : "Create milestone"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={cancelForm}>Cancel</Button>
        </div>
      </Card>
    : null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Milestones"
        description="Track delivery dates and project checkpoints."
        actions={canWrite ? <Button size="sm" variant={showCreate ? "default" : "outline"} onClick={showCreate ? cancelForm : startCreate}><PlusIcon className="size-3.5" />Add milestone</Button> : undefined}
      />
      {formPanel}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-40 rounded-xl" />)}</div>
      ) : error ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm font-medium">Could not load milestones</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void reload()}><RefreshCwIcon className="size-3.5" />Retry</Button>
        </Card>
      ) : milestones.length === 0 ? (
        <EmptyState icon={<FlagIcon className="size-5" />} title="No milestones yet" description="Create a milestone to start tracking delivery checkpoints." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {milestones.map((milestone) => {
            const project = projects.find((item) => item.projectId === milestone.projectId)
            return <Card key={milestone.milestoneId} className="gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{milestone.name}</h2>
                  <p className="text-muted-foreground mt-1 text-xs">{milestone.milestoneId}</p>
                </div>
                <Badge className={cn("shrink-0 capitalize", statusTone[milestone.status])}>{milestone.status}</Badge>
              </div>
              <div className="text-muted-foreground grid gap-1 text-xs">
                <p><span className="text-foreground font-medium">DueDate:</span> {milestone.dueDate || "Not set"}</p>
                <p><span className="text-foreground font-medium">Project:</span> {project?.projectName ?? milestone.projectId ?? "Not linked"}</p>
                {milestone.notes ? <p className="line-clamp-2 pt-1">{milestone.notes}</p> : null}
              </div>
              {canWrite ? <div className="flex flex-wrap gap-2">
                <Button className="self-start" size="sm" variant="ghost" disabled={Boolean(pendingMilestoneId)} onClick={() => startEdit(milestone)}><PencilIcon className="size-3.5" />Edit</Button>
                <Button className="self-start" size="sm" variant="ghost" disabled={Boolean(pendingMilestoneId)} onClick={() => setDeleteTarget(milestone)}><Trash2Icon className="size-3.5 text-destructive" />Delete</Button>
              </div> : null}
            </Card>
          })}
        </div>
      )}
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
