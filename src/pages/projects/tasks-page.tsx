import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
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
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns, useProjects, useTasks, useTeamMembers } from "@/hooks/use-agency-data"
import { deleteTask, updateTask } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Task } from "@/types/agency"
import { cn } from "@/lib/utils"

const LANES = [
  { id: "todo", label: "To do", next: "in_progress", prev: null },
  { id: "in_progress", label: "In progress", next: "review", prev: "todo" },
  { id: "review", label: "Review", next: "done", prev: "in_progress" },
  { id: "blocked", label: "Blocked", next: "in_progress", prev: "todo" },
  { id: "done", label: "Done", next: null, prev: "review" },
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
}

const emptyTaskForm: TaskForm = {
  title: "",
  projectId: "",
  campaignId: "",
  assignee: "Unassigned",
  status: "todo",
  priority: "medium",
  dueDate: "",
  estimateHours: "",
  tags: "",
}

export function TasksPage() {
  const { user } = useAuth()
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
      assignee: task.assignee || "Unassigned",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      estimateHours: task.estimateHours == null ? "" : String(task.estimateHours),
      tags: task.tags?.join(", ") ?? "",
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
      assignee: taskForm.assignee || "Unassigned",
      status: taskForm.status,
      priority: taskForm.priority,
      dueDate: taskForm.dueDate || null,
      estimateHours,
      tags: taskForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    }
    setTaskSaving(true)
    try {
      await updateTask(editingTask.taskId, body)
      toast.success("Task updated")
      closeTaskDialog(true)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save task")
    } finally {
      setTaskSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tasks"
        description="Production workboard — move cards, set priority, assign owners."
        actions={
          canWrite ? (
            <Button size="sm" variant="outline" onClick={openCreateTask}>
              <PlusIcon className="size-3.5" />
              Add task
            </Button>
          ) : undefined
        }
      />

      {/* KPI */}
      <div className="bg-card grid grid-cols-2 gap-3 rounded-xl border p-3 sm:grid-cols-4 sm:p-4">
        <div>
          <div className="text-muted-foreground text-xs">Total</div>
          <div className="text-lg font-semibold tabular-nums">{counts.total}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Done</div>
          <div className="text-lg font-semibold tabular-nums">{counts.done}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Blocked</div>
          <div className="text-lg font-semibold tabular-nums">{counts.blocked}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Overdue</div>
          <div
            className={cn(
              "text-lg font-semibold tabular-nums",
              counts.overdue > 0 && "text-destructive",
            )}
          >
            {counts.overdue}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm sm:w-auto"
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
        <select
          className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm sm:w-auto"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
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
        <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-5">
          {LANES.map((l) => (
            <Skeleton key={l.id} className="h-72 w-[min(85vw,16rem)] shrink-0 rounded-xl md:w-auto" />
          ))}
        </div>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 md:snap-none xl:grid-cols-5">
          {lanes.map((lane) => (
            <section
              key={lane.id}
              className="bg-muted/40 flex min-h-72 w-[min(85vw,16rem)] shrink-0 snap-start flex-col rounded-xl border border-dashed p-2 md:w-auto md:min-w-0"
            >
              <header className="mb-2 flex items-center justify-between px-1 pt-1">
                <span className="text-sm font-semibold">{lane.label}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {lane.items.length}
                </Badge>
              </header>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {lane.items.length === 0 ? (
                  <EmptyState title="Empty" className="border-0 py-10" />
                ) : (
                  lane.items.map((task) => {
                    const overdue =
                      task.dueDate &&
                      task.status !== "done" &&
                      new Date(task.dueDate) < new Date(new Date().toDateString())
                    return (
                      <article
                        key={task.taskId}
                        className="bg-card rounded-lg border p-3 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-1">
                              <h3 className="text-sm font-medium leading-snug">{task.title}</h3>
                              {canWrite ? (
                                <>
                                  <Button size="icon" variant="ghost" className="size-6 shrink-0" disabled={Boolean(deletingId) || Boolean(busyId)} onClick={() => openEditTask(task)} aria-label={`Edit ${task.title}`}>
                                    <PencilIcon className="size-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="size-6 shrink-0 text-destructive" disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(task)} aria-label={`Delete ${task.title}`}>
                                    <Trash2Icon className="size-3" />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          {canWrite ? (
                            <select
                              className={cn(
                                "h-6 max-w-[5.5rem] shrink-0 rounded border-0 px-1 text-[10px] font-medium capitalize outline-none",
                                priorityTone[task.priority] ?? "bg-muted",
                              )}
                              value={task.priority}
                              disabled={busyId === task.taskId}
                              onChange={(e) =>
                                void patchTask(
                                  task,
                                  { priority: e.target.value },
                                  `Priority → ${e.target.value}`,
                                )
                              }
                            >
                              {PRIORITIES.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Badge
                              className={cn(
                                "h-5 shrink-0 capitalize",
                                priorityTone[task.priority] ?? "",
                              )}
                            >
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {task.projectId ? (
                            <Link
                              to={`/projects/${task.projectId}`}
                              className="hover:text-primary underline-offset-2 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {task.projectName || task.projectId}
                            </Link>
                          ) : (
                            task.projectName || "No project"
                          )}
                        </p>
                        <div className="text-muted-foreground mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                          {canWrite ? (
                            <select
                              className="bg-transparent max-w-[8rem] truncate text-[11px] outline-none"
                              value={task.assignee || "Unassigned"}
                              disabled={busyId === task.taskId}
                              onChange={(e) =>
                                void patchTask(
                                  task,
                                  { assignee: e.target.value },
                                  `Assigned to ${e.target.value}`,
                                )
                              }
                            >
                              {assigneeOptions.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{task.assignee || "Unassigned"}</span>
                          )}
                          <span className={cn(overdue && "text-destructive font-medium")}>
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : "No due"}
                          </span>
                        </div>
                        {canWrite ? (
                          <div className="mt-2 flex flex-col gap-1">
                            <div className="flex gap-1">
                              {lane.prev ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 flex-1 text-xs"
                                  disabled={busyId === task.taskId}
                                  onClick={() => moveTask(task, lane.prev!)}
                                >
                                  <ChevronLeftIcon className="size-3" />
                                </Button>
                              ) : null}
                              {lane.next ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 flex-1 text-xs"
                                  disabled={busyId === task.taskId}
                                  onClick={() => moveTask(task, lane.next!)}
                                >
                                  {busyId === task.taskId ? (
                                    <Loader2Icon className="size-3 animate-spin" />
                                  ) : (
                                    <ChevronRightIcon className="size-3" />
                                  )}
                                  {lane.next.replace("_", " ")}
                                </Button>
                              ) : null}
                            </div>
                            {task.status !== "blocked" && task.status !== "done" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-full text-xs"
                                disabled={busyId === task.taskId}
                                onClick={() => moveTask(task, "blocked")}
                              >
                                Block
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
      )}

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects}
        campaigns={campaigns}
        defaultProjectId={projects[0]?.projectId}
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
              {campaigns.map((campaign) => <option key={campaign.campaignId} value={campaign.campaignId}>{campaign.name} ({campaign.campaignId})</option>)}
              {editingTask?.campaignId && !campaigns.some((campaign) => campaign.campaignId === editingTask.campaignId) ? (
                <option value={editingTask.campaignId}>{editingTask.campaignId}</option>
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
              {assigneeOptions.map((assignee) => <option key={assignee} value={assignee}>{assignee}</option>)}
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
