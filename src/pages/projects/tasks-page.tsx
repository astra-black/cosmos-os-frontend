import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  CalendarIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayoutGridIcon,
  ListIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { CreateTaskModal } from "@/components/modals"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns, useProjects, useTasks, useTeamMembers } from "@/hooks/use-agency-data"
import { assignTask, deleteTask, updateTask } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Task } from "@/types/agency"
import { cn } from "@/lib/utils"
import {
  isTaskStatusTransitionAllowed,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/tasks/task-status"

const LANES = [
  { id: "todo", label: TASK_STATUS_LABELS.todo, next: "in_progress", prev: null },
  { id: "in_progress", label: TASK_STATUS_LABELS.in_progress, next: "review", prev: "todo" },
  { id: "review", label: TASK_STATUS_LABELS.review, next: "done", prev: "in_progress" },
  { id: "blocked", label: TASK_STATUS_LABELS.blocked, next: "in_progress", prev: "todo" },
  { id: "done", label: TASK_STATUS_LABELS.done, next: null, prev: "review" },
] as const

const PRIORITIES = ["low", "medium", "high", "critical"] as const

const priorityTone: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-chart-4/25 text-foreground",
  medium: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
}

type TaskForm = {
  title: string
  projectId: string
  campaignId: string
  assignee: string
  status: string
  priority: string
  dueDate: string
  estimateHours: string
  tags: string
  dependencyIds: string[]
}

const emptyTaskForm: TaskForm = {
  title: "",
  projectId: "",
  campaignId: "",
  assignee: "",
  status: "todo",
  priority: "medium",
  dueDate: "",
  estimateHours: "",
  tags: "",
  dependencyIds: [],
}

export function TasksPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const scopedProjectId = searchParams.get("projectId") || ""
  const canWrite = canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")
  const {
    data: tasks,
    setData: setTasks,
    loading,
    error,
    reload,
  } = useTasks()
  const { data: projects } = useProjects()
  const { data: campaigns } = useCampaigns()
  const { data: teamMembers } = useTeamMembers()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskSaving, setTaskSaving] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  useEffect(() => {
    if (scopedProjectId && searchParams.get("create") === "1") {
      setCreateOpen(true)
    }
  }, [scopedProjectId, searchParams])

  function patchLocal(updated: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.taskId === updated.taskId ? { ...t, ...updated } : t)),
    )
  }

  const assignees = useMemo(() => {
    const memberNames = teamMembers.map((m) => m.name).filter(Boolean)
    if (memberNames.length === 0) {
      return user?.name ? [user.name, "Unassigned"] : ["Unassigned"]
    }
    return [...new Set([...memberNames, "Unassigned"])]
  }, [teamMembers, user?.name])

  const assigneeOptions = useMemo(() => {
    const fromTasks = tasks.map((t) => t.assignee || "Unassigned")
    return [...new Set([...assignees, ...fromTasks])]
  }, [assignees, tasks])
  const memberOptions = useMemo(
    () => teamMembers.filter((member) => member.status === "active"),
    [teamMembers],
  )

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (assigneeFilter !== "all" && (t.assignee || "Unassigned") !== assigneeFilter)
        return false
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
      return true
    })
  }, [tasks, assigneeFilter, priorityFilter])

  const lanes = useMemo(
    () =>
      LANES.map((lane) => ({
        ...lane,
        items: filtered.filter((t) => t.status === lane.id),
      })),
    [filtered],
  )

  const counts = useMemo(
    () => ({
      total: tasks.length,
      done: tasks.filter((t) => t.status === "done").length,
      blocked: tasks.filter((t) => t.status === "blocked").length,
      overdue: tasks.filter(
        (t) =>
          t.dueDate &&
          t.status !== "done" &&
          new Date(t.dueDate) < new Date(new Date().toDateString()),
      ).length,
    }),
    [tasks],
  )

  async function moveTask(task: Task, next: string) {
    if (!canWrite) return
    if (!isTaskStatusTransitionAllowed(task.status, next)) {
      toast.error(`Cannot move ${TASK_STATUS_LABELS[task.status as TaskStatus] || task.status} to ${TASK_STATUS_LABELS[next as TaskStatus] || next}`)
      return
    }
    setBusyId(task.taskId)
    patchLocal({ ...task, status: next })
    try {
      const res = await updateTask(task.taskId, { status: next })
      if (res.data) patchLocal(res.data)
      await reload()
      toast.success(`${task.title} → ${next.replace("_", " ")}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
      await reload().catch(() => undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function patchTask(task: Task, body: Partial<Task>, label: string) {
    if (!canWrite) return
    setBusyId(task.taskId)
    patchLocal({ ...task, ...body })
    try {
      const res = await updateTask(task.taskId, body)
      if (res.data) patchLocal(res.data)
      await reload()
      toast.success(label)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
      await reload().catch(() => undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(task: Task) {
    if (!canWrite) return
    setDeletingId(task.taskId)
    try {
      await deleteTask(task.taskId)
      await reload()
      toast.success("Task deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  function openCreateTask() {
    setCreateOpen(true)
  }

  function openEditTask(task: Task) {
    setEditingTask(task)
    setTaskForm({
      title: task.title,
      projectId: task.projectId ?? "",
      campaignId: task.campaignId ?? "",
      assignee: task.assigneeMemberId || "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      estimateHours: task.estimateHours == null ? "" : String(task.estimateHours),
      tags: task.tags?.join(", ") ?? "",
      dependencyIds: task.dependencyIds ?? [],
    })
    setTaskDialogOpen(true)
  }

  function closeTaskDialog(force = false) {
    if (taskSaving && !force) return
    setTaskDialogOpen(false)
    setEditingTask(null)
    setTaskForm(emptyTaskForm)
  }

  async function saveTask() {
    if (!taskForm.title.trim() || !canWrite || !editingTask) return
    if (
      taskForm.status !== editingTask.status &&
      !isTaskStatusTransitionAllowed(editingTask.status, taskForm.status)
    ) {
      toast.error(
        `Cannot move ${TASK_STATUS_LABELS[editingTask.status as TaskStatus] || editingTask.status} to ${TASK_STATUS_LABELS[taskForm.status as TaskStatus] || taskForm.status}`,
      )
      return
    }
    const estimateHours = taskForm.estimateHours.trim() ? Number(taskForm.estimateHours) : 0
    if (!Number.isFinite(estimateHours) || estimateHours < 0) {
      toast.error("Estimate hours must be a non-negative number")
      return
    }
    const selectedProject = projects.find((p) => p.projectId === taskForm.projectId)
    const projectName = selectedProject?.projectName ??
      (editingTask.projectId === taskForm.projectId ? editingTask.projectName ?? null : null)
    const body = {
      title: taskForm.title.trim(),
      projectId: taskForm.projectId || null,
      projectName,
      campaignId: taskForm.campaignId || null,
      status: taskForm.status,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate || null,
      estimateHours,
      tags: taskForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      dependencyIds: taskForm.dependencyIds,
    }
    setTaskSaving(true)
    try {
      await updateTask(editingTask.taskId, body)
      if (taskForm.assignee !== (editingTask.assigneeMemberId || "")) {
        await assignTask(editingTask.taskId, taskForm.assignee || null)
      }
      toast.success("Task updated")
      closeTaskDialog(true)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save task")
    } finally {
      setTaskSaving(false)
    }
  }

  const [viewMode, setViewMode] = useState<"board" | "list">("board")

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Production workboard — manage deliverables, track status, and assign team owners.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tab switcher: Board / List */}
          <div className="flex items-center p-1 rounded-full bg-surface-alt border border-border">
            <button
              onClick={() => setViewMode("board")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                viewMode === "board"
                  ? "bg-[#270045] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGridIcon className="size-3.5" />
              Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                viewMode === "list"
                  ? "bg-[#270045] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListIcon className="size-3.5" />
              List
            </button>
          </div>

          {canWrite ? (
            <Button
              size="sm"
              onClick={openCreateTask}
              className="bg-[#270045] text-white hover:bg-[#3a006b] rounded-full px-4 h-9 shadow-xs"
            >
              <PlusIcon className="size-3.5 mr-1" />
              Add task
            </Button>
          ) : null}
        </div>
      </div>

      {projects.length === 0 && !loading ? (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">No projects found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tasks belong to projects. Create a project first to organize deliverables and assign work items.
              </p>
            </div>
            <Link to="/projects?create=1" className={buttonVariants({ size: "sm" })}>
              <PlusIcon className="size-3.5 mr-1" />
              Create Project
            </Link>
          </div>
        </Card>
      ) : null}

      {/* KPI Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Tasks</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">{counts.total}</p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary">
              All active deliverables
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Completed</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">{counts.done}</p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-success/15 text-success">
              {counts.total > 0 ? `${Math.round((counts.done / counts.total) * 100)}% finished` : "0%"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Blocked</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">{counts.blocked}</p>
          <div className="mt-1">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              counts.blocked > 0 ? "bg-warning/15 text-warning" : "bg-surface-alt text-muted-foreground"
            )}>
              {counts.blocked > 0 ? "Needs attention" : "No blockers"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overdue</p>
          <p className={cn(
            "font-sora text-2xl sm:text-3xl font-bold leading-none",
            counts.overdue > 0 ? "text-destructive" : "text-foreground"
          )}>
            {counts.overdue}
          </p>
          <div className="mt-1">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              counts.overdue > 0 ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
            )}>
              {counts.overdue > 0 ? "Past scheduled due" : "On schedule"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and search row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Assignee:</span>
          <select
            className="border-input bg-surface h-9 rounded-lg border px-3 text-xs font-medium shadow-xs focus:ring-2 focus:ring-primary/20 outline-none"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="all">All assignees</option>
            {assigneeOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Priority:</span>
          <select
            className="border-input bg-surface h-9 rounded-lg border px-3 text-xs font-medium shadow-xs focus:ring-2 focus:ring-primary/20 outline-none"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-destructive">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void reload()}>Retry</Button>
          </div>
        </Card>
      ) : null}

      {!canWrite ? (
        <p className="text-muted-foreground text-xs">View only — need ops/pm/producer to edit tasks.</p>
      ) : null}

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 xl:grid-cols-5">
          {LANES.map((l) => (
            <Skeleton key={l.id} className="h-80 w-[min(85vw,17rem)] shrink-0 rounded-2xl md:w-auto" />
          ))}
        </div>
      ) : viewMode === "board" ? (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 md:snap-none xl:grid-cols-5">
          {lanes.map((lane) => (
            <section
              key={lane.id}
              className="bg-surface-alt/40 flex min-h-[380px] w-[min(85vw,17rem)] shrink-0 snap-start flex-col rounded-2xl border border-border/70 p-3 md:w-auto md:min-w-0"
            >
              <header className="mb-3 flex items-center justify-between px-1.5 pt-1">
                <span className="font-sora text-sm font-semibold text-foreground tracking-tight">{lane.label}</span>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-surface border border-border text-foreground tabular-nums shadow-2xs">
                  {lane.items.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
                {lane.items.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-border/60 bg-surface/40 my-2">
                    <p className="text-xs text-muted-foreground font-medium">No tasks in {lane.label}</p>
                  </div>
                ) : (
                  lane.items.map((task) => {
                    const overdue =
                      task.dueDate &&
                      task.status !== "done" &&
                      new Date(task.dueDate) < new Date(new Date().toDateString())
                    return (
                      <article
                        key={task.taskId}
                        className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] hover:shadow-md hover:border-primary/30 transition-all flex flex-col gap-2.5"
                      >
                        {/* Top: Priority + Project + Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              task.priority === "critical"
                                ? "bg-destructive/15 text-destructive border border-destructive/20"
                                : task.priority === "high"
                                ? "bg-orange/15 text-orange border border-orange/20"
                                : task.priority === "medium"
                                ? "bg-primary/15 text-primary border border-primary/20"
                                : "bg-surface-alt text-muted-foreground border border-border"
                            )}
                          >
                            {task.priority}
                          </span>

                          {canWrite ? (
                            <div className="flex items-center gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-foreground"
                                disabled={Boolean(deletingId) || Boolean(busyId)}
                                onClick={() => openEditTask(task)}
                                aria-label={`Edit ${task.title}`}
                              >
                                <PencilIcon className="size-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                disabled={Boolean(deletingId)}
                                onClick={() => setDeleteTarget(task)}
                                aria-label={`Delete ${task.title}`}
                              >
                                <Trash2Icon className="size-3" />
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        {/* Title */}
                        <h3 className="font-sora text-sm font-semibold text-foreground leading-snug line-clamp-2">
                          {task.title}
                        </h3>

                        {/* Project Link */}
                        <p className="text-xs text-muted-foreground truncate">
                          {task.projectId ? (
                            <Link
                              to={`/projects/${task.projectId}`}
                              className="text-primary hover:underline font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {task.projectName || task.projectId}
                            </Link>
                          ) : (
                            task.projectName || "General task"
                          )}
                        </p>

                        {/* Assignee Avatar + Due date */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div
                              className="h-5 w-5 rounded-full border border-card flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                              style={{
                                background: `hsl(${((task.assignee || "?").charCodeAt(0) * 45) % 360}deg 60% 45%)`,
                              }}
                            >
                              {(task.assignee || "U").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="truncate text-muted-foreground text-[11px] font-medium">
                              {task.assignee || "Unassigned"}
                            </span>
                          </div>

                          <span
                            className={cn(
                              "text-[11px] shrink-0 font-medium",
                              overdue ? "text-destructive font-semibold" : "text-muted-foreground"
                            )}
                          >
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due"}
                          </span>
                        </div>

                        {/* Stage Transition Buttons */}
                        {canWrite ? (
                          <div className="mt-1 flex items-center gap-1.5 pt-1">
                            {lane.prev ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] flex-1 border-border/80"
                                disabled={busyId === task.taskId}
                                onClick={() => moveTask(task, lane.prev!)}
                              >
                                <ChevronLeftIcon className="size-3" />
                              </Button>
                            ) : null}

                            {lane.next ? (
                              <Button
                                size="sm"
                                className="h-7 px-2 text-[11px] flex-1 bg-[#270045] text-white hover:bg-[#3a006b]"
                                disabled={busyId === task.taskId}
                                onClick={() => moveTask(task, lane.next!)}
                              >
                                {busyId === task.taskId ? (
                                  <Loader2Icon className="size-3 animate-spin" />
                                ) : (
                                  <>
                                    <span className="truncate">{lane.next.replace("_", " ")}</span>
                                    <ChevronRightIcon className="size-3 ml-0.5" />
                                  </>
                                )}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt/60 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Due Date</th>
                  {canWrite && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No tasks found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((task) => {
                    const overdue =
                      task.dueDate &&
                      task.status !== "done" &&
                      new Date(task.dueDate) < new Date(new Date().toDateString())

                    return (
                      <tr key={task.taskId} className="hover:bg-surface-alt/30 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-foreground">
                          <div>
                            <span className="font-sora font-semibold text-sm">{task.title}</span>
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {task.tags.map((t) => (
                                  <span key={t} className="text-[10px] text-muted-foreground bg-surface-alt px-1.5 py-0.5 rounded">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold inline-block",
                              task.status === "done"
                                ? "bg-success/15 text-success border border-success/20"
                                : task.status === "review"
                                ? "bg-blue/15 text-blue border border-blue/20"
                                : task.status === "in_progress"
                                ? "bg-primary/15 text-primary border border-primary/20"
                                : task.status === "blocked"
                                ? "bg-destructive/15 text-destructive border border-destructive/20"
                                : "bg-surface-alt text-muted-foreground border border-border"
                            )}
                          >
                            {TASK_STATUS_LABELS[task.status as TaskStatus] || task.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold inline-block uppercase text-[10px]",
                              task.priority === "critical"
                                ? "bg-destructive/15 text-destructive border border-destructive/20"
                                : task.priority === "high"
                                ? "bg-orange/15 text-orange border border-orange/20"
                                : task.priority === "medium"
                                ? "bg-primary/15 text-primary border border-primary/20"
                                : "bg-surface-alt text-muted-foreground border border-border"
                            )}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {task.projectId ? (
                            <Link to={`/projects/${task.projectId}`} className="text-primary hover:underline font-medium">
                              {task.projectName || task.projectId}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{task.projectName || "None"}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-6 w-6 rounded-full border border-card flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{
                                background: `hsl(${((task.assignee || "?").charCodeAt(0) * 45) % 360}deg 60% 45%)`,
                              }}
                            >
                              {(task.assignee || "U").slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs text-foreground font-medium">{task.assignee || "Unassigned"}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium">
                          <span className={cn(overdue ? "text-destructive font-semibold" : "text-muted-foreground")}>
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                          </span>
                        </td>
                        {canWrite && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditTask(task)}
                                aria-label={`Edit ${task.title}`}
                              >
                                <PencilIcon className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget(task)}
                                aria-label={`Delete ${task.title}`}
                              >
                                <Trash2Icon className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects}
        campaigns={campaigns}
        teamMembers={teamMembers}
        defaultProjectId={scopedProjectId || projects[0]?.projectId}
        onSuccess={async () => {
          await reload()
        }}
      />

      <EntityFormDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          if (open) setTaskDialogOpen(true)
          else closeTaskDialog()
        }}
        title="Edit task"
        description="Set the task's delivery ownership, timing, and planning details."
        onSubmit={saveTask}
        submitLabel="Save changes"
        pending={taskSaving}
        submitDisabled={!taskForm.title.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="task-form-title">Title</Label>
            <Input
              id="task-form-title"
              value={taskForm.title}
              onChange={(event) => setTaskForm((form) => ({ ...form, title: event.target.value }))}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-project">Project</Label>
            <Select
              id="task-form-project"
              value={taskForm.projectId}
              onChange={(event) => setTaskForm((form) => ({ ...form, projectId: event.target.value }))}
            >
              <option value="">No project</option>
              {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}
              {editingTask?.projectId && !projects.some((project) => project.projectId === editingTask.projectId) ? (
                <option value={editingTask.projectId}>{editingTask.projectName || editingTask.projectId}</option>
              ) : null}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-campaign">Campaign</Label>
            <Select
              id="task-form-campaign"
              value={taskForm.campaignId}
              onChange={(event) => setTaskForm((form) => ({ ...form, campaignId: event.target.value }))}
            >
              <option value="">No campaign</option>
              {campaigns.map((campaign) => <option key={campaign.campaignId} value={campaign.campaignId}>{campaign.name}</option>)}
              {editingTask?.campaignId && !campaigns.some((campaign) => campaign.campaignId === editingTask.campaignId) ? (
                <option value={editingTask.campaignId}>Current Campaign</option>
              ) : null}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-assignee">Assignee</Label>
            <Select
              id="task-form-assignee"
              value={taskForm.assignee}
              onChange={(event) => setTaskForm((form) => ({ ...form, assignee: event.target.value }))}
            >
              <option value="">Unassigned</option>
              {memberOptions.map((member) => (
                <option key={member.memberId} value={member.memberId}>{member.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-status">Status</Label>
            <Select
              id="task-form-status"
              value={taskForm.status}
              onChange={(event) => setTaskForm((form) => ({ ...form, status: event.target.value }))}
            >
              {LANES.map((lane) => <option key={lane.id} value={lane.id}>{lane.label}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-priority">Priority</Label>
            <Select
              id="task-form-priority"
              value={taskForm.priority}
              onChange={(event) => setTaskForm((form) => ({ ...form, priority: event.target.value }))}
            >
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-due-date">Due date</Label>
            <Input
              id="task-form-due-date"
              type="date"
              value={taskForm.dueDate}
              onChange={(event) => setTaskForm((form) => ({ ...form, dueDate: event.target.value }))}
            />
            <p className="text-muted-foreground text-xs">
              The assignee receives an in-app reminder on the due date.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-estimate">Estimate hours</Label>
            <Input
              id="task-form-estimate"
              type="number"
              min="0"
              step="0.25"
              value={taskForm.estimateHours}
              onChange={(event) => setTaskForm((form) => ({ ...form, estimateHours: event.target.value }))}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="task-form-tags">Tags</Label>
            <Input
              id="task-form-tags"
              value={taskForm.tags}
              onChange={(event) => setTaskForm((form) => ({ ...form, tags: event.target.value }))}
              placeholder="design, client-review"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="task-form-dependencies">Blocked by</Label>
            <Select
              id="task-form-dependencies"
              multiple
              value={taskForm.dependencyIds}
              onChange={(event) =>
                setTaskForm((form) => ({
                  ...form,
                  dependencyIds: Array.from(event.target.selectedOptions, (option) => option.value),
                }))
              }
              className="min-h-24"
            >
              {tasks
                .filter((candidate) =>
                  candidate.taskId !== editingTask?.taskId &&
                  candidate.projectId === taskForm.projectId,
                )
                .map((candidate) => (
                  <option key={candidate.taskId} value={candidate.taskId}>
                    {candidate.title}
                  </option>
                ))}
            </Select>
            <p className="text-muted-foreground text-xs">
              Select tasks that must be completed first. Dependencies must stay within the same project.
            </p>
          </div>
        </div>
      </EntityFormDialog>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null) }}
        title="Delete task?"
        description={deleteTarget ? `This will permanently delete “${deleteTarget.title}”.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={Boolean(deletingId)}
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget) : undefined}
      />
    </div>
  )
}
