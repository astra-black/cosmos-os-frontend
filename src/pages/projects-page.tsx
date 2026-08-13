import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArchiveIcon,
  CheckCircle2Icon,
  FolderKanbanIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PortfolioSummaryCard } from "@/components/widgets/portfolio-summary-card"
import { ProjectsDatatable } from "@/components/widgets/projects-datatable"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import { useClients, useProjects } from "@/hooks/use-agency-data"
import { createProject, deleteProject, updateProject } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
const ACTIVE_STATUSES = new Set(["InProgress", "Review", "NotStarted"])
const PROJECT_STATUSES = ["NotStarted", "InProgress", "Review", "Approved", "Archived"] as const

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canWrite =
    canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")

  const {
    data: projects,
    loading,
    error,
    reload,
  } = useProjects()
  const { data: clients } = useClients()
  const [creating, setCreating] = useState(false)
  const [pendingProject, setPendingProject] = useState<string | null>(null)
  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [editForm, setEditForm] = useState({ projectName: "", status: "NotStarted", budget: "", startDate: "", endDate: "", weight: "", description: "" })
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    projectName: "",
    clientId: "",
    campaignId: "",
    status: "NotStarted",
    startDate: "",
    endDate: "",
    weight: "",
    budget: "",
    description: "",
  })

  function startEdit(project: (typeof projects)[number]) {
    setEditProjectId(project.projectId)
    setEditForm({ projectName: project.projectName, status: project.status, budget: project.budget == null ? "" : String(project.budget), startDate: project.startDate?.slice(0, 10) ?? "", endDate: project.endDate?.slice(0, 10) ?? "", weight: project.weight == null ? "" : String(project.weight), description: project.description ?? "" })
  }

  function validateNumbers(values: { budget: string; weight: string; startDate: string; endDate: string }) {
    const budget = values.budget ? Number(values.budget) : 0
    const weight = values.weight ? Number(values.weight) : 0
    if ((values.budget && (!Number.isFinite(budget) || budget < 0)) || (values.weight && (!Number.isFinite(weight) || weight < 0)) || (values.startDate && values.endDate && values.startDate > values.endDate)) {
      toast.error("Use valid non-negative numbers and dates in order")
      return null
    }
    return { budget, weight }
  }

  async function handleEdit() {
    if (!editProjectId || !canWrite || !editForm.projectName.trim()) return
    const values = validateNumbers(editForm)
    if (!values) return
    setPendingProject(`edit:${editProjectId}`)
    try {
      await updateProject(editProjectId, { projectName: editForm.projectName.trim(), status: editForm.status, budget: values.budget, weight: values.weight, startDate: editForm.startDate || null, endDate: editForm.endDate || null, description: editForm.description.trim() })
      await reload()
      setEditProjectId(null)
      toast.success("Project updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setPendingProject(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !canWrite) return
    setPendingProject(`delete:${deleteTarget.id}`)
    try {
      await deleteProject(deleteTarget.id)
      await reload()
      setDeleteTarget(null)
      toast.success("Project deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setPendingProject(null)
    }
  }

  const inProgress = projects.filter((p) => p.status === "InProgress").length
  const inReview = projects.filter((p) => p.status === "Review").length
  const approved = projects.filter((p) => p.status === "Approved").length
  const archived = projects.filter((p) => p.status === "Archived").length
  const active = projects.filter((p) => ACTIVE_STATUSES.has(p.status)).length
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0)
  const activeShare =
    projects.length === 0 ? 0 : Math.round((active / projects.length) * 100)

  const campaignLines = useMemo(() => {
    const byCampaign = new Map<string, { count: number; budget: number }>()
    for (const project of projects) {
      const key = project.campaignId || "Unassigned"
      const prev = byCampaign.get(key) ?? { count: 0, budget: 0 }
      byCampaign.set(key, {
        count: prev.count + 1,
        budget: prev.budget + (project.budget ?? 0),
      })
    }
    return [...byCampaign.entries()]
      .sort((a, b) => b[1].budget - a[1].budget)
      .slice(0, 4)
      .map(([campaign, stats]) => ({
        key: campaign,
        label: campaign,
        detail: `${stats.count} project${stats.count === 1 ? "" : "s"}`,
        value: stats.budget > 0 ? `$${Math.round(stats.budget / 1000)}k` : "—",
        progressPercentage: Math.min(
          100,
          totalBudget > 0 ? Math.round((stats.budget / totalBudget) * 100) : stats.count * 20,
        ),
      }))
  }, [projects, totalBudget])

  const statusLines = useMemo(() => {
    const order = ["InProgress", "Review", "NotStarted", "Approved", "Archived"]
    const counts = new Map<string, number>()
    for (const project of projects) {
      counts.set(project.status, (counts.get(project.status) ?? 0) + 1)
    }
    const total = projects.length || 1
    return order
      .filter((status) => counts.has(status))
      .map((status) => {
        const count = counts.get(status) ?? 0
        return {
          key: status,
          label: status,
          detail: "delivery status",
          value: String(count),
          progressPercentage: Math.round((count / total) * 100),
        }
      })
  }, [projects])

  async function handleCreate() {
    if (!form.projectName.trim() || !canWrite) return
    const weight = form.weight ? Number(form.weight) : 0
    const budget = form.budget ? Number(form.budget) : 0
    const startDate = form.startDate ? new Date(`${form.startDate}T00:00:00`) : null
    const endDate = form.endDate ? new Date(`${form.endDate}T00:00:00`) : null
    if (
      (startDate !== null && Number.isNaN(startDate.getTime())) ||
      (endDate !== null && Number.isNaN(endDate.getTime())) ||
      (form.startDate && form.endDate && form.startDate > form.endDate) ||
      (form.weight && (!Number.isFinite(weight) || weight < 0)) ||
      (form.budget && (!Number.isFinite(budget) || budget < 0))
    ) {
      toast.error("Use valid numbers and ensure the start date is before or equal to the end date")
      return
    }
    setCreating(true)
    try {
      const client = clients.find((c) => c.clientId === form.clientId)
      const res = await createProject({
        projectName: form.projectName.trim(),
        clientId: form.clientId || null,
        clientName: client?.name || null,
        campaignId: form.campaignId.trim() || null,
        status: form.status,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        weight,
        budget,
        description: form.description.trim() || "",
      })
      await reload()
      setForm({ projectName: "", clientId: "", campaignId: "", status: "NotStarted", startDate: "", endDate: "", weight: "", budget: "", description: "" })
      setShowCreate(false)
      toast.success("Project created")
      if (res.data?.projectId) navigate(`/projects/${res.data.projectId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        description="Delivery register — open a row for the full workspace."
        actions={
          canWrite ? (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <PlusIcon className="size-3.5" />
              New project
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {showCreate ? (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1">
            <label className="text-muted-foreground mb-1 block text-xs">Name</label>
            <Input
              placeholder="Project name"
              value={form.projectName}
              onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
            />
          </div>
          <div className="min-w-[10rem]">
            <label className="text-muted-foreground mb-1 block text-xs">Client</label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="text-muted-foreground mb-1 block text-xs">Budget</label>
            <Input
              type="number"
              placeholder="0"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
            />
          </div>
          <div className="min-w-[10rem]">
            <label className="text-muted-foreground mb-1 block text-xs">Campaign ID</label>
            <Input value={form.campaignId} onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))} />
          </div>
          <div className="min-w-[10rem]">
            <label className="text-muted-foreground mb-1 block text-xs">Status</label>
            <select className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">Start date</label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">End date</label>
            <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
          <div className="w-28">
            <label className="text-muted-foreground mb-1 block text-xs">Weight</label>
            <Input type="number" min="0" step="1" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
          </div>
          <div className="min-w-[14rem] flex-1">
            <label className="text-muted-foreground mb-1 block text-xs">Description</label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <Button size="sm" disabled={creating || !form.projectName.trim()} onClick={handleCreate}>
            {creating ? <LoaderIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
            Create
          </Button>
        </Card>
      ) : null}

      {editProjectId ? (
        <Card className="flex flex-col gap-3 border-primary/30 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1"><label className="text-muted-foreground mb-1 block text-xs">Name</label><Input value={editForm.projectName} onChange={(e) => setEditForm((f) => ({ ...f, projectName: e.target.value }))} /></div>
          <div><label className="text-muted-foreground mb-1 block text-xs">Status</label><select className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>{PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div>
          <div className="w-28"><label className="text-muted-foreground mb-1 block text-xs">Budget</label><Input type="number" min="0" value={editForm.budget} onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))} /></div>
          <div><label className="text-muted-foreground mb-1 block text-xs">Start</label><Input type="date" value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} /></div>
          <div><label className="text-muted-foreground mb-1 block text-xs">End</label><Input type="date" value={editForm.endDate} onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))} /></div>
          <div className="w-24"><label className="text-muted-foreground mb-1 block text-xs">Weight</label><Input type="number" min="0" value={editForm.weight} onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))} /></div>
          <Button size="sm" disabled={Boolean(pendingProject) || !editForm.projectName.trim()} onClick={() => void handleEdit()}>{pendingProject === `edit:${editProjectId}` ? <LoaderIcon className="size-3.5 animate-spin" /> : null}Save</Button>
          <Button size="sm" variant="ghost" disabled={Boolean(pendingProject)} onClick={() => setEditProjectId(null)}>Cancel</Button>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatisticsCard
              title="Active"
              value={String(active)}
              changePercentage={`${activeShare}% of book`}
              icon={<FolderKanbanIcon className="size-4" />}
            />
            <StatisticsCard
              title="In progress"
              value={String(inProgress)}
              changePercentage={`${inReview} in review`}
              icon={<LoaderIcon className="size-4" />}
            />
            <StatisticsCard
              title="Approved"
              value={String(approved)}
              changePercentage="delivery complete"
              icon={<CheckCircle2Icon className="size-4" />}
            />
            <StatisticsCard
              title="Archived"
              value={String(archived)}
              changePercentage={`$${Math.round(totalBudget / 1000)}k total budget`}
              icon={<ArchiveIcon className="size-4" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ProjectsDatatable
                data={projects}
                onRowClick={(p) => navigate(`/projects/${p.projectId}`)}
              />
              {canWrite ? <div className="flex flex-col gap-1 rounded-md border p-2">{projects.map((project) => <div key={project.projectId} className="flex items-center justify-between gap-2 px-2 py-1 text-sm"><span className="min-w-0 truncate">{project.projectName}</span><span className="flex shrink-0 gap-1"><Button size="icon-xs" variant="ghost" aria-label={`Edit ${project.projectName}`} disabled={Boolean(pendingProject)} onClick={() => startEdit(project)}><PencilIcon className="size-3" /></Button><Button size="icon-xs" variant="ghost" aria-label={`Delete ${project.projectName}`} disabled={Boolean(pendingProject)} onClick={() => setDeleteTarget({ id: project.projectId, name: project.projectName })}><Trash2Icon className="text-destructive size-3" /></Button></span></div>)}</div> : null}
            </div>
            <div className="flex flex-col gap-4">
              <PortfolioSummaryCard
                title="By campaign"
                headlineValue={String(campaignLines.length)}
                trend="up"
                percentage={activeShare}
                comparisonText="share of book"
                items={campaignLines}
              />
              <PortfolioSummaryCard
                title="By status"
                headlineValue={String(projects.length)}
                trend="up"
                percentage={100}
                comparisonText="all projects"
                items={statusLines}
              />
            </div>
          </div>
        </>
      )}
      <ConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !pendingProject) setDeleteTarget(null) }} title="Delete project?" description={deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined} confirmLabel="Delete" destructive pending={deleteTarget ? pendingProject === `delete:${deleteTarget.id}` : false} onConfirm={handleDelete} />
    </div>
  )
}
