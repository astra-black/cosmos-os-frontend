import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  ImagesIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RadioIcon,
  SendIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CreateTaskModal } from "@/components/modals"
import { ChangeOrderModal } from "@/components/finance/change-order-modal"
import { ChangeOrdersList } from "@/components/finance/change-orders-list"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { EmptyState } from "@/components/shared/empty-state"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { ProjectActivityPanel } from "@/components/shared/project-activity-panel"
import { ShareWithClientToggle } from "@/components/shared/share-with-client-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useCampaigns, useClients, useTeamMembers } from "@/hooks/use-agency-data"
import {
  createComment,
  getProject,
  listApprovals,
  listAssets,
  listChangeOrders,
  listComments,
  listMilestones,
  listTasks,
  normalizeAssets,
  spawnEventFromProject,
  updateProject,
  updateTask,
  type ChangeOrder,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Approval, Asset, Comment, Milestone, Project, Task } from "@/types/agency"
import { cn } from "@/lib/utils"

type Tab =
  | "overview"
  | "work"
  | "schedule"
  | "deliverables"
  | "finance"
  | "files"
  | "people"
  | "conversation"
  | "activity"

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

type WorkScope = "all" | "mine"
type WorkGroup = "none" | "status"

const STATUS_ORDER = ["NotStarted", "InProgress", "Review", "Approved", "Archived"] as const
const PROJECT_STATUSES = [...STATUS_ORDER]

const COVER_IMAGES = [
  "/cosmos-project-kairo.jpeg",
  "/cosmos-project-shortlist.png",
  "/cosmos-project-playbook.png",
  "/cosmos-project-solace.png",
  "/cosmos-project-chicago.jpeg",
]

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

const taskStatusTone: Record<string, string> = {
  todo: "project-status-pill is-neutral",
  in_progress: "project-status-pill is-info",
  review: "project-status-pill is-warning",
  blocked: "project-status-pill is-critical",
  done: "project-status-pill is-success",
  Assigned: "project-status-pill is-info",
}

function money(n?: number) {
  if (n == null || n === 0) return "—"
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

function coverFor(projectId: string) {
  let hash = 0
  for (let i = 0; i < projectId.length; i += 1) {
    hash = (hash + projectId.charCodeAt(i) * (i + 1)) % COVER_IMAGES.length
  }
  return COVER_IMAGES[hash]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

function formatShortDate(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatCommentWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const ms = Date.now() - date.getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "short" })
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function statusLabel(status: string) {
  switch (status) {
    case "NotStarted":
      return "Not Started"
    case "InProgress":
      return "In Progress"
    case "Review":
      return "In Review"
    case "Approved":
      return "Approved"
    case "Archived":
      return "Archived"
    default:
      return status.replace(/_/g, " ")
  }
}

function taskStatusLabel(status: string) {
  if (status === "todo") return "To Do"
  if (status === "in_progress") return "In Progress"
  if (status === "done") return "Done"
  return status.replace(/_/g, " ")
}

function milestoneMark(status: Milestone["status"], index: number, activeIndex: number) {
  if (status === "done") return "done"
  if (status === "missed") return "missed"
  if (index === activeIndex) return "now"
  return "upcoming"
}

export function ProjectDetailPage() {
  const { projectId = "" } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: clients } = useClients()
  const { data: campaigns } = useCampaigns()
  const { data: teamMembers } = useTeamMembers()
  const canWrite =
    canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [tab, setTab] = useState<Tab>("overview")
  const [workScope, setWorkScope] = useState<WorkScope>("all")
  const [workGroup, setWorkGroup] = useState<WorkGroup>("none")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)
  const [projectForm, setProjectForm] = useState<ProjectEditForm>(emptyProjectForm)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [spawnBusy, setSpawnBusy] = useState(false)
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([])
  const [createCoOpen, setCreateCoOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState("")
  const [commentSending, setCommentSending] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    const [projRes, taskRes, assetRes, apprRes, coRes, milestoneRes, commentRes] =
      await Promise.all([
        getProject(projectId),
        listTasks({ projectId }),
        listAssets({ projectId }).catch((err) => {
          console.warn("[ProjectDetail] Failed to load assets:", err)
          return { data: [] as Asset[] }
        }),
        listApprovals().catch((err) => {
          console.warn("[ProjectDetail] Failed to load approvals:", err)
          return { data: [] as Approval[] }
        }),
        listChangeOrders(projectId).catch((err) => {
          console.warn("[ProjectDetail] Failed to load change orders:", err)
          return { data: [] as ChangeOrder[] }
        }),
        listMilestones().catch((err) => {
          console.warn("[ProjectDetail] Failed to load milestones:", err)
          return { data: [] as Milestone[] }
        }),
        listComments("project", projectId).catch((err) => {
          console.warn("[ProjectDetail] Failed to load comments:", err)
          return { data: [] as Comment[] }
        }),
      ])
    setProject(projRes.data ?? null)
    setTasks(taskRes.data ?? [])
    setAssets(normalizeAssets(assetRes as Parameters<typeof normalizeAssets>[0]))
    setChangeOrders(coRes.data ?? [])
    const allAppr = apprRes.data ?? []
    setApprovals(
      allAppr.filter(
        (a) =>
          a.projectId === projectId ||
          a.entityId === projectId ||
          Boolean(a.assetId && (projRes.data?.assets || []).includes(a.assetId)),
      ),
    )
    const allMilestones = milestoneRes.data ?? []
    setMilestones(
      allMilestones.filter((milestone) => {
        if (milestone.projectId === projectId) return true
        if (typeof milestone.project === "string") return milestone.project === projectId
        if (Array.isArray(milestone.project)) return milestone.project.includes(projectId)
        return false
      }),
    )
    setComments(commentRes.data ?? [])
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
  const doneTasks = useMemo(
    () => tasks.filter((t) => t.status === "done"),
    [tasks],
  )
  const progressPct = tasks.length
    ? Math.round((doneTasks.length / tasks.length) * 100)
    : null

  const assigneeNames = useMemo(() => {
    const names = new Set<string>()
    for (const task of tasks) {
      if (task.assignee?.trim()) names.add(task.assignee.trim())
    }
    return Array.from(names).slice(0, 5)
  }, [tasks])

  const sortedMilestones = useMemo(() => {
    return [...milestones].sort((a, b) => {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
      return aTime - bTime
    })
  }, [milestones])

  const activeMilestoneIndex = useMemo(() => {
    const nowIdx = sortedMilestones.findIndex((m) => m.status === "upcoming")
    if (nowIdx >= 0) return nowIdx
    const lastDone = [...sortedMilestones].map((m) => m.status).lastIndexOf("done")
    return lastDone >= 0 ? lastDone : 0
  }, [sortedMilestones])

  const workTasks = useMemo(() => {
    const filtered =
      workScope === "mine"
        ? tasks.filter((task) => {
            const me = (user?.name || "").trim().toLowerCase()
            if (!me) return false
            return (task.assignee || "").trim().toLowerCase() === me
          })
        : tasks
    const sorted = [...filtered].sort((a, b) => {
      if (workGroup === "status" && a.status !== b.status) {
        return a.status.localeCompare(b.status)
      }
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
      return aDue - bDue
    })
    return sorted
  }, [tasks, workScope, workGroup, user?.name])

  const nextActions = useMemo(() => {
    const actions: Array<{
      id: string
      severity: "warning" | "info"
      title: string
      context: string
      tab: Tab
    }> = []
    for (const approval of pendingApprovals.slice(0, 3)) {
      actions.push({
        id: `approval-${approval.approvalId}`,
        severity: "warning",
        title: approval.title,
        context: approval.dueDate
          ? `Approval · due ${formatShortDate(approval.dueDate)}`
          : "Approval · awaiting review",
        tab: "deliverables",
      })
    }
    for (const task of tasks) {
      if (actions.length >= 4) break
      if (task.status === "blocked") {
        actions.push({
          id: `task-${task.taskId}`,
          severity: "warning",
          title: task.title,
          context: task.dueDate
            ? `Blocked · due ${formatShortDate(task.dueDate)}`
            : "Blocked task",
          tab: "work",
        })
      }
    }
    for (const task of openTasks) {
      if (actions.length >= 4) break
      if (task.status === "blocked") continue
      if (!task.dueDate) continue
      const due = new Date(task.dueDate).getTime()
      if (Number.isNaN(due) || due > Date.now() + 7 * 86400000) continue
      actions.push({
        id: `due-${task.taskId}`,
        severity: "info",
        title: task.title,
        context: `Due ${formatShortDate(task.dueDate)}`,
        tab: "work",
      })
    }
    return actions
  }, [pendingApprovals, tasks, openTasks])

  const recentComments = useMemo(
    () =>
      [...comments]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 3),
    [comments],
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
      (projectForm.startDate &&
        projectForm.endDate &&
        projectForm.startDate > projectForm.endDate)
    ) {
      toast.error(
        "Enter valid non-negative numbers and ensure the end date is after the start date.",
      )
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

  async function startShowDesk() {
    if (!project || !canWrite) return
    setSpawnBusy(true)
    try {
      const res = await spawnEventFromProject(project.projectId)
      const payload = res.data
      const eventId = payload?.event?.eventId || payload?.event?.id
      const cueCount = payload?.cues?.length ?? 0
      toast.success(
        payload?.reused ? "Opened existing Show Desk event" : "Show Desk event spawned",
        {
          description: eventId
            ? `${cueCount} draft cue(s) ready · ${eventId.slice(0, 8)}…`
            : payload?.message,
        },
      )
      if (eventId) navigate(`/events/${eventId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not spawn Show Desk event")
    } finally {
      setSpawnBusy(false)
    }
  }

  async function sendOverviewComment() {
    if (!project || !commentDraft.trim()) return
    setCommentSending(true)
    try {
      await createComment({
        entityType: "project",
        entityId: project.projectId,
        body: commentDraft.trim(),
        author: user?.name || user?.email || "You",
      })
      setCommentDraft("")
      const res = await listComments("project", project.projectId)
      setComments(res.data ?? [])
      toast.success("Comment added")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to comment")
    } finally {
      setCommentSending(false)
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "work", label: "Work", count: tasks.length || undefined },
    { id: "schedule", label: "Schedule" },
    {
      id: "deliverables",
      label: "Deliverables",
      count: approvals.length || undefined,
    },
    { id: "finance", label: "Finance" },
    { id: "files", label: "Files", count: assets.length || undefined },
    { id: "people", label: "People" },
    {
      id: "conversation",
      label: "Conversation",
      count: comments.length || undefined,
    },
    { id: "activity", label: "Activity" },
  ]

  if (loading) {
    return (
      <div className="project-full-page">
        <div className="project-full-page__inner flex flex-col gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[150px] w-full rounded-[18px]" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="project-full-page">
        <div className="project-full-page__inner flex flex-col gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => navigate("/projects")}
          >
            <ArrowLeftIcon className="size-3.5" />
            Back to projects
          </Button>
          <EmptyState
            title="Project not found"
            description={error || "This project id is missing from the delivery store."}
          />
        </div>
      </div>
    )
  }

  const coverEyebrow = project.clientName
    ? `${project.clientName.toUpperCase()} · AGENCY OS`
    : "AGENCY OS"

  const metaBits = [
    project.endDate ? `Launch ${formatShortDate(project.endDate)}` : null,
    project.startDate && !project.endDate
      ? `Started ${formatShortDate(project.startDate)}`
      : null,
  ].filter(Boolean)

  return (
    <div className="project-full-page">
      <div className="project-full-page__inner">
        <div className="project-full-page__chrome">
          <div className="project-full-page__eyebrow">
            <span>Projects · Expanded View</span>
          </div>
          <div className="project-full-page__title-row">
            <h1>Project</h1>
            <div className="project-full-page__title-actions">
              {canWrite ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="sm" variant="outline" className="project-actions-menu">
                        <MoreHorizontalIcon className="size-3.5" />
                        Actions
                        <ChevronDownIcon className="size-3.5 opacity-60" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={openProjectEditor}>
                      <PencilIcon className="size-3.5" />
                      Edit project
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreateTaskOpen(true)}>
                      <PlusIcon className="size-3.5" />
                      Add task
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCreateCoOpen(true)}>
                      <FileTextIcon className="size-3.5" />
                      Issue Change Order
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={<Link to={`/assets?projectId=${project.projectId}`} />}
                    >
                      <ImagesIcon className="size-3.5" />
                      Upload asset
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={spawnBusy} onClick={startShowDesk}>
                      <RadioIcon className="size-3.5" />
                      Start Show Desk
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={statusBusy} onClick={advanceStatus}>
                      <ChevronRightIcon className="size-3.5" />
                      Advance status
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="project-full-page__back"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeftIcon className="size-3.5" />
                Back To Dashboard
              </Button>
            </div>
          </div>
        </div>

        <section className="project-cover">
          <img
            className="project-cover__image"
            src={coverFor(project.projectId)}
            alt=""
          />
          <div className="project-cover__scrim" />
          <div className="project-cover__content">
            <div className="project-cover__meta">
              <span className="project-cover__edition">
                <img src="/agency-edition-glyph-dark.svg" alt="" />
              </span>
              <span>{coverEyebrow}</span>
            </div>
            <h2 className="project-cover__name">{project.projectName}</h2>
            <div className="project-cover__status-row">
              <span
                className={cn(
                  "project-status-pill",
                  project.status === "InProgress" || project.status === "Review"
                    ? "is-success"
                    : project.status === "Approved"
                      ? "is-success"
                      : "is-neutral",
                )}
              >
                {statusLabel(project.status)}
              </span>
              {metaBits.length ? (
                <span className="project-cover__launch">{metaBits.join(" · ")}</span>
              ) : null}
            </div>
          </div>
          <div className="project-cover__actions">
            {assigneeNames.length > 0 ? (
              <div
                className="project-cover__avatars"
                aria-label="Task assignees on this project"
                title="Assignees from project tasks"
              >
                {assigneeNames.map((name) => (
                  <Avatar key={name} className="project-cover__avatar" title={name}>
                    <AvatarFallback>{initials(name)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            ) : null}
            {project.clientId ? (
              <ShareWithClientToggle
                clientId={project.clientId}
                entityType="PROJECT"
                entityId={project.projectId}
                clientVisible={project.clientVisible}
                onChange={(v) =>
                  setProject((p) => (p ? { ...p, clientVisible: v } : p))
                }
                className="project-cover__share"
                idleLabel="Share"
                activeLabel="Shared"
                idleIcon="upload"
              />
            ) : null}
          </div>
        </section>

        <nav className="project-tabs" aria-label="Project sections">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn("project-tab", tab === item.id && "is-active")}
              onClick={() => setTab(item.id)}
            >
              <span>{item.label}</span>
              {item.count != null ? <small>{item.count}</small> : null}
            </button>
          ))}
        </nav>

        {tab === "overview" ? (
          <div className="project-overview">
            <div className="project-overview__main">
              <Card className="project-panel">
                <div className="project-panel__head">
                  <h3>Progress</h3>
                  <span>
                    {progressPct == null
                      ? "No tasks yet"
                      : `${progressPct}% · ${doneTasks.length} of ${tasks.length} done`}
                  </span>
                </div>
                <div className="project-progress-track">
                  <div
                    className="project-progress-fill"
                    style={{ width: `${progressPct ?? 0}%` }}
                  />
                </div>
                {sortedMilestones.length > 0 ? (
                  <div className="project-milestone-rail">
                    {sortedMilestones.map((milestone, index) => {
                      const mark = milestoneMark(
                        milestone.status,
                        index,
                        activeMilestoneIndex,
                      )
                      return (
                        <div key={milestone.milestoneId} className="project-milestone">
                          <div className="project-milestone__line">
                            <span className={cn("project-milestone__dot", `is-${mark}`)}>
                              {mark === "done" ? (
                                <CheckCircle2Icon className="size-3" />
                              ) : null}
                            </span>
                            {index < sortedMilestones.length - 1 ? (
                              <span
                                className={cn(
                                  "project-milestone__connector",
                                  mark === "done" && "is-done",
                                )}
                              />
                            ) : null}
                          </div>
                          <strong>{milestone.name}</strong>
                          <small>
                            {milestone.dueDate
                              ? formatShortDate(milestone.dueDate)
                              : milestone.status}
                          </small>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="project-panel__empty">
                    No milestones linked to this project yet.
                  </p>
                )}
              </Card>

              <Card className="project-panel">
                <div className="project-panel__head">
                  <h3>Work</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="project-link-btn"
                    onClick={() => setTab("work")}
                  >
                    Open Board
                  </Button>
                </div>
                <div className="project-work-controls">
                  <div className="project-work-controls__left">
                    <div className="project-seg">
                      <button
                        type="button"
                        className={cn(workScope === "mine" && "is-active")}
                        onClick={() => setWorkScope("mine")}
                      >
                        Mine
                      </button>
                      <button
                        type="button"
                        className={cn(workScope === "all" && "is-active")}
                        onClick={() => setWorkScope("all")}
                      >
                        All
                      </button>
                    </div>
                    <Select
                      aria-label="Group work"
                      className="project-work-group h-8 w-auto min-w-[8.5rem] normal-case"
                      value={workGroup}
                      onChange={(event) =>
                        setWorkGroup(event.target.value as WorkGroup)
                      }
                    >
                      <option value="none">Group · None</option>
                      <option value="status">Group · Status</option>
                    </Select>
                  </div>
                  {canWrite ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCreateTaskOpen(true)}
                    >
                      <PlusIcon className="size-3.5" />
                      Add Task
                    </Button>
                  ) : null}
                </div>
                {workTasks.length === 0 ? (
                  <p className="project-panel__empty">
                    {workScope === "mine"
                      ? "No tasks assigned to you on this project."
                      : "No tasks on this project yet."}
                  </p>
                ) : (
                  <ul className="project-work-list">
                    {workTasks.slice(0, 6).map((task) => {
                      const done = task.status === "done"
                      return (
                        <li key={task.taskId}>
                          <button
                            type="button"
                            className={cn(
                              "project-work-check",
                              done && "is-checked",
                            )}
                            aria-label={
                              done
                                ? `Mark ${task.title} as not done`
                                : `Mark ${task.title} done`
                            }
                            disabled={!canWrite || taskBusy === task.taskId}
                            onClick={() =>
                              void moveTask(task, done ? "todo" : "done")
                            }
                          >
                            {done ? <CheckCircle2Icon className="size-3.5" /> : null}
                          </button>
                          <div className="project-work-list__copy">
                            <strong className={cn(done && "is-done")}>{task.title}</strong>
                            <small>
                              {[task.assignee || "Unassigned", task.priority]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </div>
                          {task.assignee ? (
                            <Avatar className="size-6">
                              <AvatarFallback className="text-[10px]">
                                {initials(task.assignee)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <span className="size-6" />
                          )}
                          <span
                            className={cn(
                              "project-work-due",
                              task.status === "blocked" && "is-late",
                            )}
                          >
                            {task.dueDate ? formatShortDate(task.dueDate) : "—"}
                          </span>
                          <Badge
                            className={cn(
                              "capitalize",
                              taskStatusTone[task.status] ??
                                "project-status-pill is-neutral",
                            )}
                          >
                            {taskStatusLabel(task.status)}
                          </Badge>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {tasks.some((t) => t.status === "blocked") ? (
                  <div className="project-note">
                    One or more tasks are blocked. Downstream dates may slip until they
                    move forward.
                  </div>
                ) : null}
              </Card>
            </div>

            <aside className="project-overview__side">
              <Card className="project-panel">
                <div className="project-panel__head">
                  <h3>Next Actions</h3>
                </div>
                {nextActions.length === 0 ? (
                  <p className="project-panel__empty">
                    Nothing waiting on approvals or upcoming task due dates.
                  </p>
                ) : (
                  <ul className="project-actions">
                    {nextActions.map((action) => (
                      <li key={action.id}>
                        <span
                          className={cn(
                            "project-actions__sev",
                            action.severity === "warning" ? "is-warning" : "is-info",
                          )}
                        />
                        <div>
                          <strong>{action.title}</strong>
                          <small>{action.context}</small>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTab(action.tab)}
                        >
                          Open
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="project-panel">
                <div className="project-panel__head">
                  <div className="project-conv-title">
                    <h3>Conversation</h3>
                    <span className="project-conv-kind">Project comments</span>
                  </div>
                  {project.clientVisible && project.clientName ? (
                    <span className="project-vis">
                      Client portal · {project.clientName}
                    </span>
                  ) : (
                    <span className="project-vis is-internal">Internal only</span>
                  )}
                </div>
                <p className="project-conv-note">
                  These are project comments from the current API—not a messaging
                  channel. Channel threads are not available yet.
                </p>
                {recentComments.length === 0 ? (
                  <p className="project-panel__empty">No comments yet.</p>
                ) : (
                  <ul className="project-conv-list">
                    {recentComments.map((comment) => (
                      <li key={comment.commentId}>
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {initials(comment.author || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="project-conv-list__meta">
                            <strong>{comment.author}</strong>
                            <span>{formatCommentWhen(comment.createdAt)}</span>
                          </div>
                          <p>{comment.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="project-conv-composer">
                  <Input
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Write a project comment…"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void sendOverviewComment()
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={commentSending || !commentDraft.trim()}
                    onClick={() => void sendOverviewComment()}
                  >
                    {commentSending ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <SendIcon className="size-3.5" />
                    )}
                  </Button>
                </div>
                <div className="project-conv-footer">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="project-link-btn"
                    onClick={() => setTab("conversation")}
                  >
                    Open all comments
                  </Button>
                  {canWrite ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCreateTaskOpen(true)}
                    >
                      <PlusIcon className="size-3.5" />
                      Create Task
                    </Button>
                  ) : null}
                </div>
              </Card>
            </aside>
          </div>
        ) : null}

        {tab === "work" ? (
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
                <Card
                  key={task.taskId}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {task.assignee || "Unassigned"}
                      {task.dueDate ? ` · due ${task.dueDate}` : ""}
                      {task.priority ? ` · ${task.priority}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="capitalize">{taskStatusLabel(task.status)}</Badge>
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

        {tab === "schedule" ? (
          <EmptyState
            title="Schedule is not available yet"
            description="The designed schedule board needs schedule/source APIs that are not in the current middleware. Linked milestones still appear on Overview when present—no sample schedule is shown."
            action={
              sortedMilestones.length > 0 ? (
                <Button size="sm" variant="outline" onClick={() => setTab("overview")}>
                  View milestones on Overview
                </Button>
              ) : (
                <Button size="sm" variant="outline" render={<Link to="/milestones" />}>
                  Open milestones
                </Button>
              )
            }
          />
        ) : null}

        {tab === "deliverables" ? (
          <div className="flex flex-col gap-2">
            {approvals.length === 0 ? (
              <EmptyState
                title="No approvals for this project"
                description="Request a review from the approvals queue with this project prefilled."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <Link to={`/approvals?projectId=${project.projectId}&create=1`} />
                    }
                  >
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

        {tab === "finance" ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Project budget
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {money(project.budget)}
                </div>
                <p className="text-muted-foreground mt-2 text-xs">
                  Only the project budget field from the current API. Designed finance
                  rows (margin, POs, invoices) are omitted until those APIs exist.
                </p>
              </Card>
              <Card className="p-4">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Change orders
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {changeOrders.length}
                </div>
              </Card>
            </div>
            {canWrite ? (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5 bg-amber-600 text-white hover:bg-amber-500"
                  onClick={() => setCreateCoOpen(true)}
                >
                  <FileTextIcon className="size-3.5" />
                  Issue Change Order
                </Button>
              </div>
            ) : null}
            <ChangeOrdersList changeOrders={changeOrders} onRefresh={load} />
          </div>
        ) : null}

        {tab === "files" ? (
          <div className="flex flex-col gap-2">
            {assets.length === 0 ? (
              <EmptyState
                title="No assets linked"
                description="Upload delivery files tagged to this project."
                action={
                  canWrite ? (
                    <Button
                      size="sm"
                      render={<Link to={`/assets?projectId=${project.projectId}`} />}
                    >
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

        {tab === "people" ? (
          <EmptyState
            title="People & access is not available yet"
            description="Participant scopes, guest grants, and project access management are not in the current APIs. Cover avatars list task assignees only—not collaborators or portal participants."
            action={
              <Button size="sm" variant="outline" render={<Link to="/teams" />}>
                Open People directory
              </Button>
            }
          />
        ) : null}

        {tab === "conversation" ? (
          <CommentsPanel
            entityType="project"
            entityId={project.projectId}
            title="Project comments"
          />
        ) : null}

        {tab === "activity" ? (
          <ProjectActivityPanel projectId={project.projectId} />
        ) : null}

        {project ? (
          <ChangeOrderModal
            open={createCoOpen}
            onOpenChange={setCreateCoOpen}
            projectId={project.projectId}
            clientId={project.clientId ?? undefined}
            currentPlannedBudget={project.budget ?? 0}
            onSuccess={() => void load()}
          />
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
                onChange={(event) =>
                  setProjectForm((form) => ({
                    ...form,
                    projectName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-detail-client">Client</Label>
              <Select
                id="project-detail-client"
                value={projectForm.clientId}
                onChange={(event) =>
                  setProjectForm((form) => ({ ...form, clientId: event.target.value }))
                }
              >
                <option value="">Unassigned</option>
                {clients.map((client) => (
                  <option key={client.clientId} value={client.clientId}>
                    {client.name}
                  </option>
                ))}
                {project.clientId &&
                !clients.some((client) => client.clientId === project.clientId) ? (
                  <option value={project.clientId}>
                    {project.clientName || project.clientId}
                  </option>
                ) : null}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-detail-campaign">Campaign</Label>
              <Select
                id="project-detail-campaign"
                value={projectForm.campaignId}
                onChange={(event) =>
                  setProjectForm((form) => ({
                    ...form,
                    campaignId: event.target.value,
                  }))
                }
              >
                <option value="">Unassigned</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.campaignId} value={campaign.campaignId}>
                    {campaign.name}
                  </option>
                ))}
                {project.campaignId &&
                !campaigns.some(
                  (campaign) => campaign.campaignId === project.campaignId,
                ) ? (
                  <option value={project.campaignId}>Current Campaign</option>
                ) : null}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-detail-status">Status</Label>
              <Select
                id="project-detail-status"
                value={projectForm.status}
                onChange={(event) =>
                  setProjectForm((form) => ({ ...form, status: event.target.value }))
                }
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-detail-weight">Weight (%)</Label>
              <Input
                id="project-detail-weight"
                type="number"
                min="0"
                value={projectForm.weight}
                onChange={(event) =>
                  setProjectForm((form) => ({ ...form, weight: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-detail-budget">Budget ($ USD)</Label>
              <Input
                id="project-detail-budget"
                type="number"
                min="0"
                value={projectForm.budget}
                onChange={(event) =>
                  setProjectForm((form) => ({ ...form, budget: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-detail-start">Start date</Label>
              <Input
                id="project-detail-start"
                type="date"
                value={projectForm.startDate}
                onChange={(event) =>
                  setProjectForm((form) => ({
                    ...form,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-detail-end">End date</Label>
              <Input
                id="project-detail-end"
                type="date"
                value={projectForm.endDate}
                onChange={(event) =>
                  setProjectForm((form) => ({ ...form, endDate: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="project-detail-description">Description</Label>
              <Textarea
                id="project-detail-description"
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
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
            teamMembers={teamMembers}
            defaultProjectId={project.projectId}
            onSuccess={async () => {
              await load()
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
