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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PortfolioSummaryCard } from "@/components/widgets/portfolio-summary-card"
import { ProjectsDatatable } from "@/components/widgets/projects-datatable"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import { useClients, useProjects } from "@/hooks/use-agency-data"
import { createProject, deleteProject, updateProject } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Project } from "@/types/agency"

const ACTIVE_STATUSES = new Set(["InProgress", "Review", "NotStarted"])
const PROJECT_STATUSES = ["NotStarted", "InProgress", "Review", "Approved", "Archived"] as const

interface ProjectFormData {
  projectName: string
  clientId: string
  campaignId: string
  status: string
  startDate: string
  endDate: string
  weight: string
  budget: string
  description: string
}

const emptyForm: ProjectFormData = {
  projectName: "",
  clientId: "",
  campaignId: "",
  status: "NotStarted",
  startDate: "",
  endDate: "",
  weight: "",
  budget: "",
  description: "",
}

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
  const [isSaving, setIsSaving] = useState(false)
  const [pendingProject, setPendingProject] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState<ProjectFormData>(emptyForm)

  function openCreateDialog() {
    setEditingProject(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  function openEditDialog(project: Project) {
    setEditingProject(project)
    setForm({
      projectName: project.projectName,
      clientId: project.clientId || "",
      campaignId: project.campaignId || "",
      status: project.status || "NotStarted",
      startDate: project.startDate ? project.startDate.slice(0, 10) : "",
      endDate: project.endDate ? project.endDate.slice(0, 10) : "",
      weight: project.weight != null ? String(project.weight) : "",
      budget: project.budget != null ? String(project.budget) : "",
      description: project.description || "",
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
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
      toast.error("Please enter valid positive numbers and ensure end date is after start date.")
      return
    }

    setIsSaving(true)
    try {
      const client = clients.find((c) => c.clientId === form.clientId)
      if (editingProject) {
        await updateProject(editingProject.projectId, {
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
        toast.success("Project updated")
      } else {
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
        toast.success("Project created")
        if (res.data?.projectId) navigate(`/projects/${res.data.projectId}`)
      }
      setIsDialogOpen(false)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed")
    } finally {
      setIsSaving(false)
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        description="Delivery register — open a row for the full workspace."
        actions={
          canWrite ? (
            <Button size="sm" onClick={openCreateDialog}>
              <PlusIcon className="size-3.5" />
              New project
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
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
            <div className="lg:col-span-2 flex flex-col gap-4">
              <ProjectsDatatable
                data={projects}
                onRowClick={(p) => navigate(`/projects/${p.projectId}`)}
              />

              {/* Quick Actions List for Project Admins */}
              {canWrite && projects.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-xl border bg-card p-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                    Project Controls
                  </div>
                  {projects.map((project) => (
                    <div
                      key={project.projectId}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-lg hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-foreground truncate block">
                          {project.projectName}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {project.projectId} · {project.clientName || "Unassigned"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${project.projectName}`}
                          disabled={Boolean(pendingProject)}
                          onClick={() => openEditDialog(project)}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive"
                          aria-label={`Delete ${project.projectName}`}
                          disabled={Boolean(pendingProject)}
                          onClick={() => setDeleteTarget({ id: project.projectId, name: project.projectName })}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
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

      {/* Add / Edit Project Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {editingProject
                ? "Update timeline, budget, client ownership, and milestones."
                : "Initialize a new project within your agency delivery book."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                placeholder="e.g. Lumen Onboarding Sprint"
                value={form.projectName}
                onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="project-client">Client Account</Label>
                <Select
                  id="project-client"
                  value={form.clientId}
                  onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {clients.map((c) => (
                    <option key={c.clientId} value={c.clientId}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="project-status">Status</Label>
                <Select
                  id="project-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="project-budget">Budget ($ USD)</Label>
                <Input
                  id="project-budget"
                  type="number"
                  placeholder="e.g. 50000"
                  value={form.budget}
                  onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="project-campaign">Campaign ID / Tag</Label>
                <Input
                  id="project-campaign"
                  placeholder="e.g. Q4-LAUNCH"
                  value={form.campaignId}
                  onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="project-start">Start Date</Label>
                <Input
                  id="project-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="project-end">End Date</Label>
                <Input
                  id="project-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                placeholder="Scope, deliverables, and requirements..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving || !form.projectName.trim()}>
              {isSaving ? "Saving…" : editingProject ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Delete */}
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !pendingProject) setDeleteTarget(null) }}
        title="Delete project?"
        description={deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
