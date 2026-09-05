import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  FolderKanbanIcon,
  ImagesIcon,
  ListTodoIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CreateTaskModal } from "@/components/modals"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { EmptyState } from "@/components/shared/empty-state"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useCampaigns, useClients } from "@/hooks/use-agency-data"
import {
  getProject,
  listApprovals,
  listAssets,
  listTasks,
  normalizeAssets,
  updateProject,
  updateTask,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Approval, Asset, Project, Task } from "@/types/agency"
import { cn } from "@/lib/utils"

type Tab = "overview" | "tasks" | "assets" | "approvals" | "comments"

type ProjectEditForm = {
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

const STATUS_ORDER = ["NotStarted", "InProgress", "Review", "Approved", "Archived"] as const

const PROJECT_STATUSES = [...STATUS_ORDER]

const emptyProjectForm: ProjectEditForm = {
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

const statusClass: Record<string, string> = {
  NotStarted: "bg-muted text-muted-foreground",
  InProgress: "bg-primary/10 text-primary",
  Review: "bg-chart-4/20 text-foreground",
  Approved: "bg-chart-2/20 text-foreground",
  Archived: "bg-muted text-muted-foreground",
}

const taskStatusTone: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  review: "bg-chart-4/20 text-foreground",
  blocked: "bg-destructive/15 text-destructive",
  done: "bg-chart-2/20 text-foreground",
}

function money(n?: number) {
  if (n == null || n === 0) return "—"
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: clients } = useClients()
  const { data: campaigns } = useCampaigns()
  const canWrite =
    canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [tab, setTab] = useState<Tab>("overview")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectForm, setProjectForm] = useState<ProjectEditForm>(emptyProjectForm)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    const [projRes, taskRes, assetRes, apprRes] = await Promise.all([
      getProject(projectId),
      listTasks({ projectId }),
      listAssets({ projectId }).catch(() => ({ data: [] as Asset[] })),
      listApprovals().catch(() => ({ data: [] as Approval[] })),
    ])
    setProject(projRes.data ?? null)
    setTasks(taskRes.data ?? [])
    setAssets(normalizeAssets(assetRes as Parameters<typeof normalizeAssets>[0]))
    const allAppr = apprRes.data ?? []
    setApprovals(
      allAppr.filter(
        (a) =>
          a.projectId === projectId ||
          a.entityId === projectId ||
          (projRes.data?.assets || []).includes(a.entityId),
      ),
    )
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load project")
          setProject(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [load])

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done"),
    [tasks],
  )
  const pendingApprovals = useMemo(
    () =>
      approvals.filter(
        (a) => a.status === "pending" || a.status === "changes_requested",
      ),
    [approvals],
  )

  async function advanceStatus() {
    if (!project || !canWrite) return
    const idx = STATUS_ORDER.indexOf(project.status as (typeof STATUS_ORDER)[number])
    const next =
      STATUS_ORDER[Math.min(idx < 0 ? 1 : idx + 1, STATUS_ORDER.length - 1)]
    if (next === project.status) return
    setStatusBusy(true)
    try {
      const res = await updateProject(project.projectId, { status: next })
      setProject(res.data ?? { ...project, status: next })
      toast.success(`Status → ${next}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setStatusBusy(false)
    }
  }

  async function moveTask(task: Task, status: string) {
    if (!canWrite) return
    setTaskBusy(task.taskId)
    setTasks((prev) =>
      prev.map((t) => (t.taskId === task.taskId ? { ...t, status } : t)),
    )
    try {
      await updateTask(task.taskId, { status })
      toast.success(`${task.title} → ${status.replace("_", " ")}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Task update failed")
      await load()
    } finally {
      setTaskBusy(null)
    }
  }

  function openProjectEditor() {
    if (!project || !canWrite) return
    setProjectForm({
      projectName: project.projectName,
      clientId: project.clientId ?? "",
      campaignId: project.campaignId ?? "",
      status: project.status || "NotStarted",
      startDate: project.startDate ? project.startDate.slice(0, 10) : "",
      endDate: project.endDate ? project.endDate.slice(0, 10) : "",
      weight: project.weight == null ? "" : String(project.weight),
      budget: project.budget == null ? "" : String(project.budget),
      description: project.description ?? "",
    })
    setProjectDialogOpen(true)
  }

  async function saveProject() {
    if (!project || !canWrite) return
    const name = projectForm.projectName.trim()
    const weight = projectForm.weight.trim() ? Number(projectForm.weight) : 0
    const budget = projectForm.budget.trim() ? Number(projectForm.budget) : 0
    if (!name) {
      toast.error("Project name is required")
      return
    }
    if (
      !Number.isFinite(weight) ||
      weight < 0 ||
      !Number.isFinite(budget) ||
      budget < 0 ||
      (projectForm.startDate && projectForm.endDate && projectForm.startDate > projectForm.endDate)
    ) {
      toast.error("Enter valid non-negative numbers and ensure the end date is after the start date.")
      return
    }

    const client = clients.find((item) => item.clientId === projectForm.clientId)
    setProjectSaving(true)
    try {
      await updateProject(project.projectId, {
        projectName: name,
        clientId: projectForm.clientId || null,
        clientName: client?.name || null,
        campaignId: projectForm.campaignId || null,
        status: projectForm.status,
        startDate: projectForm.startDate || null,
        endDate: projectForm.endDate || null,
        weight,
        budget,
        description: projectForm.description.trim(),
      })
      setProjectDialogOpen(false)
      await load()
      toast.success("Project updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Project update failed")
    } finally {
      setProjectSaving(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "tasks", label: `Tasks (${tasks.length})` },
    { id: "assets", label: `Assets (${assets.length})` },
    { id: "approvals", label: `Approvals (${approvals.length})` },
    { id: "comments", label: "Comments" },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("/projects")}>
          <ArrowLeftIcon className="size-3.5" />
          Back to projects
        </Button>
        <EmptyState
          title="Project not found"
          description={error || "This project id is missing from the delivery store."}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground w-fit px-0 hover:bg-transparent"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeftIcon className="size-3.5" />
          Projects
        </Button>
        <PageHeader
          title={project.projectName}
          description={project.description || "Delivery workspace — tasks, assets, approvals."}
          actions={
            canWrite ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={openProjectEditor}>
                  <PencilIcon className="size-3.5" />
                  Edit project
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCreateTaskOpen(true)}>
                  <PlusIcon className="size-3.5" />
                  Add task
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link to={`/assets?projectId=${project.projectId}`} />}
                >
                  <ImagesIcon className="size-3.5" />
                  Upload asset
                </Button>
                <Button size="sm" disabled={statusBusy} onClick={advanceStatus}>
                  {statusBusy ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <ChevronRightIcon className="size-3.5" />
                  )}
                  Advance status
                </Button>
              </div>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge
            className={cn(
              "h-auto rounded-sm px-1.5 capitalize",
              statusClass[project.status] ?? "bg-primary/10 text-primary",
            )}
          >
            {project.status}
          </Badge>
          <span className="text-muted-foreground font-mono text-xs">{project.projectId}</span>
          {project.clientId ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full"
              render={<Link to={`/clients/${project.clientId}`} />}
            >
              {project.clientName || project.clientId}
            </Button>
          ) : null}
          {project.campaignId ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-full"
              render={<Link to="/campaigns" />}
            >
              {project.campaignId}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Budget
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{money(project.budget)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Open tasks
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{openTasks.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Assets
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{assets.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Pending approvals
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {pendingApprovals.length}
          </div>
        </Card>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <FolderKanbanIcon className="size-4" />
              Delivery facts
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Start</dt>
                <dd>{project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">End</dt>
                <dd>{project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Weight</dt>
                <dd>{project.weight != null ? `${project.weight}%` : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Client</dt>
                <dd>
                  {project.clientId ? (
                    <Link className="text-primary underline-offset-2 hover:underline" to={`/clients/${project.clientId}`}>
                      {project.clientName || project.clientId}
                    </Link>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </Card>
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <ListTodoIcon className="size-4" />
              Needs attention
            </div>
            {openTasks.length === 0 && pendingApprovals.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing blocked right now.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {openTasks.slice(0, 4).map((t) => (
                  <li key={t.taskId} className="flex items-center justify-between gap-2">
                    <span className="truncate">{t.title}</span>
                    <Badge className={cn("shrink-0 capitalize", taskStatusTone[t.status])}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
                {pendingApprovals.slice(0, 2).map((a) => (
                  <li key={a.approvalId} className="flex items-center justify-between gap-2">
                    <span className="truncate">{a.title}</span>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {a.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setTab("tasks")}>
                All tasks
              </Button>
              <Button size="sm" variant="outline" render={<Link to="/tasks" />}>
                Full board
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="flex flex-col gap-2">
          {canWrite && tasks.length > 0 ? (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setCreateTaskOpen(true)}>
                <PlusIcon className="size-3.5" />
                Add task
              </Button>
            </div>
          ) : null}
          {tasks.length === 0 ? (
            <EmptyState
              title="No tasks on this project"
              description="Create a task here to keep delivery work in context."
              action={
                canWrite ? (
                  <Button size="sm" onClick={() => setCreateTaskOpen(true)}>
                    <PlusIcon className="size-3.5" />
                    Add task
                  </Button>
                ) : undefined
              }
            />
          ) : (
            tasks.map((task) => (
              <Card key={task.taskId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{task.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {task.assignee || "Unassigned"}
                    {task.dueDate ? ` · due ${task.dueDate}` : ""}
                    {task.priority ? ` · ${task.priority}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("capitalize", taskStatusTone[task.status])}>
                    {task.status.replace("_", " ")}
                  </Badge>
                  {canWrite && task.status !== "done" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={taskBusy === task.taskId}
                      onClick={() =>
                        moveTask(
                          task,
                          task.status === "todo"
                            ? "in_progress"
                            : task.status === "in_progress"
                              ? "review"
                              : task.status === "review"
                                ? "done"
                                : task.status === "blocked"
                                  ? "in_progress"
                                  : "done",
                        )
                      }
                    >
                      {taskBusy === task.taskId ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2Icon className="size-3.5" />
                      )}
                      Advance
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === "assets" ? (
        <div className="flex flex-col gap-2">
          {assets.length === 0 ? (
            <EmptyState
              title="No assets linked"
              description="Upload delivery files tagged to this project."
              action={
                canWrite ? (
                  <Button size="sm" render={<Link to={`/assets?projectId=${project.projectId}`} />}>
                    <ImagesIcon className="size-3.5" />
                    Upload asset
                  </Button>
                ) : undefined
              }
            />
          ) : (
            assets.map((asset) => (
              <Card
                key={asset.assetId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ImagesIcon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{asset.assetName}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {asset.assetId}
                      {asset.version ? ` · v${asset.version}` : ""}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {asset.status || "—"}
                </Badge>
              </Card>
            ))
          )}
          {assets.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              render={<Link to={`/assets?projectId=${project.projectId}`} />}
            >
              Open assets library
            </Button>
          ) : null}
        </div>
      ) : null}

      {tab === "approvals" ? (
        <div className="flex flex-col gap-2">
          {approvals.length === 0 ? (
            <EmptyState
              title="No approvals for this project"
              description="Request a review from the approvals queue with this project prefilled."
              action={
                <Button size="sm" variant="outline" render={<Link to={`/approvals?projectId=${project.projectId}&create=1`} />}>
                  Request approval
                </Button>
              }
            />
          ) : (
            approvals.map((a) => (
              <Card key={a.approvalId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {a.entityType}:{a.entityId} · {a.requester || "—"}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
              </Card>
            ))
          )}
          {approvals.length > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="w-fit"
              render={<Link to={`/approvals?projectId=${project.projectId}`} />}
            >
              Open approvals queue
            </Button>
          ) : null}
        </div>
      ) : null}

      {tab === "comments" ? (
        <CommentsPanel entityType="project" entityId={project.projectId} />
      ) : null}

      <EntityFormDialog
        open={projectDialogOpen}
        onOpenChange={(open) => {
          if (!open && !projectSaving) setProjectDialogOpen(false)
        }}
        title="Edit project"
        description="Update the project details used across delivery planning."
        onSubmit={saveProject}
        submitLabel="Save changes"
        pending={projectSaving}
        submitDisabled={!projectForm.projectName.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="project-detail-name">Project name</Label>
            <Input
              id="project-detail-name"
              value={projectForm.projectName}
              onChange={(event) => setProjectForm((form) => ({ ...form, projectName: event.target.value }))}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-detail-client">Client</Label>
            <Select
              id="project-detail-client"
              value={projectForm.clientId}
              onChange={(event) => setProjectForm((form) => ({ ...form, clientId: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {clients.map((client) => (
                <option key={client.clientId} value={client.clientId}>
                  {client.name}
                </option>
              ))}
              {project.clientId && !clients.some((client) => client.clientId === project.clientId) ? (
                <option value={project.clientId}>{project.clientName || project.clientId}</option>
              ) : null}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-detail-campaign">Campaign</Label>
            <Select
              id="project-detail-campaign"
              value={projectForm.campaignId}
              onChange={(event) => setProjectForm((form) => ({ ...form, campaignId: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {campaigns.map((campaign) => (
                <option key={campaign.campaignId} value={campaign.campaignId}>
                  {campaign.name} ({campaign.campaignId})
                </option>
              ))}
              {project.campaignId && !campaigns.some((campaign) => campaign.campaignId === project.campaignId) ? (
                <option value={project.campaignId}>{project.campaignId}</option>
              ) : null}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-detail-status">Status</Label>
            <Select
              id="project-detail-status"
              value={projectForm.status}
              onChange={(event) => setProjectForm((form) => ({ ...form, status: event.target.value }))}
            >
              {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-detail-weight">Weight (%)</Label>
            <Input
              id="project-detail-weight"
              type="number"
              min="0"
              value={projectForm.weight}
              onChange={(event) => setProjectForm((form) => ({ ...form, weight: event.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-detail-budget">Budget ($ USD)</Label>
            <Input
              id="project-detail-budget"
              type="number"
              min="0"
              value={projectForm.budget}
              onChange={(event) => setProjectForm((form) => ({ ...form, budget: event.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-detail-start">Start date</Label>
            <Input
              id="project-detail-start"
              type="date"
              value={projectForm.startDate}
              onChange={(event) => setProjectForm((form) => ({ ...form, startDate: event.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="project-detail-end">End date</Label>
            <Input
              id="project-detail-end"
              type="date"
              value={projectForm.endDate}
              onChange={(event) => setProjectForm((form) => ({ ...form, endDate: event.target.value }))}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="project-detail-description">Description</Label>
            <Textarea
              id="project-detail-description"
              value={projectForm.description}
              onChange={(event) => setProjectForm((form) => ({ ...form, description: event.target.value }))}
              placeholder="Scope, deliverables, and requirements..."
            />
          </div>
        </div>
      </EntityFormDialog>
      {project ? (
        <CreateTaskModal
          open={createTaskOpen}
          onOpenChange={setCreateTaskOpen}
          projects={[project]}
          campaigns={campaigns}
          defaultProjectId={project.projectId}
          onSuccess={async () => {
            await load()
          }}
        />
      ) : null}
    </div>
  )
}
