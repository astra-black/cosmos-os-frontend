import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { LinkIcon, Loader2Icon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CreateTaskModal } from "@/components/modals"
import {
  TaskDrawer,
  boardColumnForStatus,
  cnFlag,
  isDueSoon,
  isOverdue,
  taskInitials,
} from "@/components/tasks/task-drawer"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns, useProjects, useTasks, useTeamMembers } from "@/hooks/use-agency-data"
import { assignTask, deleteTask, updateTask } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import {
  isTaskStatusTransitionAllowed,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/tasks/task-status"
import type { Task } from "@/types/agency"
import { cn } from "@/lib/utils"

type WorkView = "board" | "table" | "timeline"

const BOARD_LANES = [
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "review", label: "In Review" },
  { id: "done", label: "Done" },
] as const

const PRIORITIES = ["low", "medium", "high", "critical"] as const

const STATUS_OPTIONS = [
  { id: "todo", label: TASK_STATUS_LABELS.todo },
  { id: "in_progress", label: TASK_STATUS_LABELS.in_progress },
  { id: "review", label: TASK_STATUS_LABELS.review },
  { id: "blocked", label: TASK_STATUS_LABELS.blocked },
  { id: "done", label: TASK_STATUS_LABELS.done },
] as const

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

function formatDue(dueDate?: string | null) {
  if (!dueDate) return "—"
  const d = new Date(dueDate)
  if (Number.isNaN(d.getTime())) return dueDate
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

function parseView(raw: string | null): WorkView {
  if (raw === "table" || raw === "timeline" || raw === "board") return raw
  return "board"
}

export function TasksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const scopedProjectId = searchParams.get("projectId") || ""
  const view = parseView(searchParams.get("view"))
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
  const [createDefaultStatus, setCreateDefaultStatus] = useState("todo")
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [drawerTask, setDrawerTask] = useState<Task | null>(null)
  const [taskSaving, setTaskSaving] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [projectFilter, setProjectFilter] = useState(scopedProjectId || "all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    if (scopedProjectId) setProjectFilter(scopedProjectId)
  }, [scopedProjectId])

  useEffect(() => {
    if (scopedProjectId && searchParams.get("create") === "1") {
      setCreateDefaultStatus("todo")
      setCreateOpen(true)
    }
  }, [scopedProjectId, searchParams])

  function setView(next: WorkView) {
    const params = new URLSearchParams(searchParams)
    if (next === "board") params.delete("view")
    else params.set("view", next)
    setSearchParams(params, { replace: true })
  }

  function patchLocal(updated: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.taskId === updated.taskId ? { ...t, ...updated } : t)),
    )
    setDrawerTask((current) =>
      current?.taskId === updated.taskId ? { ...current, ...updated } : current,
    )
  }

  const memberOptions = useMemo(
    () => teamMembers.filter((member) => member.status === "active"),
    [teamMembers],
  )

  const assigneeOptions = useMemo(() => {
    const names = [
      ...memberOptions.map((m) => m.name),
      ...tasks.map((t) => t.assignee || "Unassigned"),
    ]
    return [...new Set(names.filter(Boolean))]
  }, [memberOptions, tasks])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilter !== "all" && t.projectId !== projectFilter) return false
      if (assigneeFilter !== "all" && (t.assignee || "Unassigned") !== assigneeFilter) return false
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false
      return true
    })
  }, [tasks, projectFilter, assigneeFilter, priorityFilter])

  const activeFilterCount =
    (projectFilter !== "all" ? 1 : 0) +
    (assigneeFilter !== "all" ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0)

  const boardLanes = useMemo(
    () =>
      BOARD_LANES.map((lane) => ({
        ...lane,
        items: filtered.filter((t) => boardColumnForStatus(t.status) === lane.id),
      })),
    [filtered],
  )

  const timelineGroups = useMemo(() => {
    const byProject = new Map<string, { projectId: string; projectName: string; tasks: Task[] }>()
    for (const task of filtered) {
      if (!task.dueDate) continue
      const key = task.projectId || task.projectName || "unscoped"
      const existing = byProject.get(key)
      if (existing) existing.tasks.push(task)
      else {
        byProject.set(key, {
          projectId: task.projectId || "",
          projectName: task.projectName || "No project",
          tasks: [task],
        })
      }
    }
    return [...byProject.values()].map((group) => ({
      ...group,
      tasks: [...group.tasks].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
    }))
  }, [filtered])

  const timelineWindow = useMemo(() => {
    const dates = filtered
      .map((t) => (t.dueDate ? new Date(t.dueDate) : null))
      .filter((d): d is Date => Boolean(d && !Number.isNaN(d.getTime())))
    if (dates.length === 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const end = new Date(today)
      end.setDate(end.getDate() + 28)
      return { start: today, end, days: 29 }
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())))
    const max = new Date(Math.max(...dates.map((d) => d.getTime())))
    min.setHours(0, 0, 0, 0)
    max.setHours(0, 0, 0, 0)
    min.setDate(min.getDate() - 3)
    max.setDate(max.getDate() + 3)
    const days = Math.max(7, Math.round((max.getTime() - min.getTime()) / 86400000) + 1)
    return { start: min, end: max, days }
  }, [filtered])

  const dependencyNoteCount = useMemo(
    () => filtered.filter((t) => (t.dependencyIds?.length ?? 0) > 0).length,
    [filtered],
  )

  async function moveTask(task: Task, next: string) {
    if (!canWrite) return
    if (!isTaskStatusTransitionAllowed(task.status, next)) {
      toast.error(
        `Cannot move ${TASK_STATUS_LABELS[task.status as TaskStatus] || task.status} to ${TASK_STATUS_LABELS[next as TaskStatus] || next}`,
      )
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

  async function handleDelete(task: Task) {
    if (!canWrite) return
    setDeletingId(task.taskId)
    try {
      await deleteTask(task.taskId)
      setSelectedIds((ids) => ids.filter((id) => id !== task.taskId))
      if (drawerTask?.taskId === task.taskId) setDrawerTask(null)
      await reload()
      toast.success("Task deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  function openCreateTask(status = "todo") {
    setCreateDefaultStatus(status === "review" ? "review" : status === "done" ? "todo" : status)
    setCreateOpen(true)
  }

  function openEditTask(task: Task) {
    setDrawerTask(null)
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
    const projectName =
      selectedProject?.projectName ??
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
      tags: taskForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
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

  function toggleSelected(taskId: string) {
    setSelectedIds((ids) =>
      ids.includes(taskId) ? ids.filter((id) => id !== taskId) : [...ids, taskId],
    )
  }

  function toggleSelectAll() {
    if (selectedIds.length === filtered.length) setSelectedIds([])
    else setSelectedIds(filtered.map((t) => t.taskId))
  }

  async function bulkUpdate(body: Partial<Task>, label: string) {
    if (!canWrite || selectedIds.length === 0) return
    setBulkBusy(true)
    try {
      for (const id of selectedIds) {
        const task = tasks.find((t) => t.taskId === id)
        if (!task) continue
        if (
          body.status &&
          body.status !== task.status &&
          !isTaskStatusTransitionAllowed(task.status, body.status)
        ) {
          toast.error(`Skipped ${task.title}: invalid status transition`)
          continue
        }
        await updateTask(id, body)
      }
      toast.success(label)
      setSelectedIds([])
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Bulk update failed")
      await reload().catch(() => undefined)
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkAssign(memberId: string) {
    if (!canWrite || selectedIds.length === 0) return
    setBulkBusy(true)
    try {
      for (const id of selectedIds) {
        await assignTask(id, memberId || null)
      }
      toast.success(memberId ? "Assigned selected tasks" : "Unassigned selected tasks")
      setSelectedIds([])
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Bulk assign failed")
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkDelete() {
    if (!canWrite || selectedIds.length === 0) return
    setBulkBusy(true)
    try {
      for (const id of selectedIds) {
        await deleteTask(id)
      }
      toast.success("Deleted selected tasks")
      setSelectedIds([])
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Bulk delete failed")
    } finally {
      setBulkBusy(false)
    }
  }

  function renderCardFlag(task: Task) {
    const flag = cnFlag(task)
    if (flag === "blocked") return <span className="cosmos-work-flag is-critical">Blocked</span>
    if (flag === "overdue") return <span className="cosmos-work-flag is-warning">Overdue</span>
    if (flag === "soon") return <span className="cosmos-work-flag is-warning">Due Soon</span>
    if (flag === "client") return <span className="cosmos-work-flag">With Client</span>
    if (flag === "vendor") {
      const tag = task.tags?.find((t) => /vendor|atlas/i.test(t)) || "Vendor"
      return <span className="cosmos-work-flag">{tag}</span>
    }
    return null
  }

  function dayOffset(dueDate: string) {
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    return Math.max(
      0,
      Math.min(
        timelineWindow.days - 1,
        Math.round((due.getTime() - timelineWindow.start.getTime()) / 86400000),
      ),
    )
  }

  const scaleLabels = useMemo(() => {
    const labels: string[] = []
    const step = Math.max(1, Math.floor(timelineWindow.days / 5))
    for (let i = 0; i < timelineWindow.days; i += step) {
      const d = new Date(timelineWindow.start)
      d.setDate(d.getDate() + i)
      labels.push(d.toLocaleDateString(undefined, { day: "numeric", month: "short" }))
    }
    return labels
  }, [timelineWindow])

  const todayOffset = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (today < timelineWindow.start || today > timelineWindow.end) return null
    return Math.round((today.getTime() - timelineWindow.start.getTime()) / 86400000)
  }, [timelineWindow])

  return (
    <div className="cosmos-work-page">
      <div className="cosmos-work-page__title-row">
        <div>
          <p className="cosmos-work-page__eyebrow">Agency OS · Workspace</p>
          <h1>Work</h1>
        </div>
        {canWrite ? (
          <Button size="sm" className="cosmos-work-primary" onClick={() => openCreateTask("todo")}>
            <PlusIcon className="size-3.5" />
            New Task
          </Button>
        ) : null}
      </div>

      <div className="cosmos-work-toolbar">
        <div className="cosmos-schedule-seg" role="tablist" aria-label="Work views">
          {(
            [
              ["board", "Board"],
              ["table", "Table"],
              ["timeline", "Timeline"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={cn(view === id && "is-active")}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={false}
            title="Calendar lives on Schedule"
            onClick={() => navigate("/schedule")}
          >
            Calendar
          </button>
        </div>

        <Select
          className="cosmos-work-filter"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Filter by project"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.projectId} value={p.projectId}>
              {p.projectName}
            </option>
          ))}
        </Select>

        <Select
          className="cosmos-work-filter"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filter by assignee"
        >
          <option value="all">Assignee · Anyone</option>
          {assigneeOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>

        <Select
          className="cosmos-work-filter"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
        >
          <option value="all">
            {activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : "Filter"}
          </option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              Priority · {p}
            </option>
          ))}
        </Select>

        <span className="cosmos-work-toolbar__grow" />

        {canWrite && view !== "board" ? (
          <Button size="sm" className="cosmos-work-primary" onClick={() => openCreateTask("todo")}>
            <PlusIcon className="size-3.5" />
            New Task
          </Button>
        ) : null}
      </div>

      {projects.length === 0 && !loading ? (
        <div className="cosmos-work-banner">
          <div>
            <strong>No projects found</strong>
            <p>Tasks belong to projects. Create a project first to organize work.</p>
          </div>
          <Link to="/projects?create=1" className={buttonVariants({ size: "sm" })}>
            Create Project
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="cosmos-work-error" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : null}

      {!canWrite ? (
        <p className="cosmos-work-note">View only — need ops/pm/producer to edit tasks.</p>
      ) : null}

      {loading ? (
        <div className="cosmos-work-board">
          {BOARD_LANES.map((lane) => (
            <Skeleton key={lane.id} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : null}

      {!loading && view === "board" ? (
        <div className="cosmos-work-board">
          {boardLanes.map((lane) => (
            <section key={lane.id} className="cosmos-work-column">
              <header>
                <h2>{lane.label}</h2>
                <span>{lane.items.length}</span>
              </header>
              <div className="cosmos-work-column__cards">
                {lane.items.map((task) => (
                  <article
                    key={task.taskId}
                    className="cosmos-work-card"
                    onClick={() => setDrawerTask(task)}
                  >
                    <h3>{task.title}</h3>
                    <p>
                      {task.projectId ? (
                        <Link
                          to={`/projects/${task.projectId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {task.projectName || "Project"}
                        </Link>
                      ) : (
                        task.projectName || "No project"
                      )}
                    </p>
                    <div className="cosmos-work-card__foot">
                      <span className="cosmos-work-avatar" aria-hidden>
                        {taskInitials(task.assignee)}
                      </span>
                      <span className={cn(isOverdue(task.dueDate, task.status) && "is-late")}>
                        {formatDue(task.dueDate)}
                      </span>
                      <span className="cosmos-work-card__flag">{renderCardFlag(task)}</span>
                    </div>
                  </article>
                ))}
              </div>
              {canWrite ? (
                <button
                  type="button"
                  className="cosmos-work-add"
                  onClick={() =>
                    openCreateTask(
                      lane.id === "done" ? "todo" : lane.id === "review" ? "review" : lane.id,
                    )
                  }
                >
                  <PlusIcon className="size-3.5" />
                  Add
                </button>
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      {!loading && view === "table" ? (
        <div className="cosmos-work-table-wrap">
          {selectedIds.length > 0 && canWrite ? (
            <div className="cosmos-work-bulk">
              <label className="cosmos-work-check">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                />
                <span>{selectedIds.length} selected</span>
              </label>
              <div className="cosmos-work-bulk__actions">
                <Select
                  disabled={bulkBusy}
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    void bulkAssign(v === "__none__" ? "" : v)
                    e.target.value = ""
                  }}
                  aria-label="Bulk assign"
                >
                  <option value="">Assign</option>
                  <option value="__none__">Unassigned</option>
                  {memberOptions.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <Input
                  type="date"
                  disabled={bulkBusy}
                  aria-label="Bulk due date"
                  onChange={(e) => {
                    if (!e.target.value) return
                    void bulkUpdate({ dueDate: e.target.value }, "Due dates updated")
                    e.target.value = ""
                  }}
                />
                <Select
                  disabled={bulkBusy}
                  defaultValue=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    void bulkUpdate({ status: v }, "Status updated")
                    e.target.value = ""
                  }}
                  aria-label="Bulk status"
                >
                  <option value="">Status</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={bulkBusy}
                  onClick={() => void bulkDelete()}
                >
                  {bulkBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                  Delete
                </Button>
              </div>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="cosmos-work-empty">
              <p>No tasks match these filters</p>
              <span>Adjust project, assignee, or priority filters, or create a task.</span>
            </div>
          ) : (
            <table className="cosmos-work-table">
              <thead>
                <tr>
                  <th className="cosmos-work-table__check">
                    {canWrite ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    ) : null}
                  </th>
                  <th>Task</th>
                  <th>Project</th>
                  <th />
                  <th>Due</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => {
                  const selected = selectedIds.includes(task.taskId)
                  return (
                    <tr
                      key={task.taskId}
                      className={cn(selected && "is-selected")}
                      onClick={() => setDrawerTask(task)}
                    >
                      <td className="cosmos-work-table__check" onClick={(e) => e.stopPropagation()}>
                        {canWrite ? (
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(task.taskId)}
                            aria-label={`Select ${task.title}`}
                          />
                        ) : null}
                      </td>
                      <td className="cosmos-work-table__title">{task.title}</td>
                      <td>
                        {task.projectId ? (
                          <Link
                            to={`/projects/${task.projectId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {task.projectName || "Project"}
                          </Link>
                        ) : (
                          task.projectName || "—"
                        )}
                      </td>
                      <td>
                        <span className="cosmos-work-avatar" title={task.assignee || "Unassigned"}>
                          {taskInitials(task.assignee)}
                        </span>
                      </td>
                      <td
                        className={cn(
                          isOverdue(task.dueDate, task.status) && "cosmos-work-warn",
                          isDueSoon(task.dueDate, task.status) && "cosmos-work-soon",
                        )}
                      >
                        {formatDue(task.dueDate)}
                      </td>
                      <td>
                        <Badge variant="outline" className="capitalize">
                          {task.priority}
                        </Badge>
                      </td>
                      <td>
                        {task.status === "blocked" ? (
                          <span className="cosmos-work-flag is-critical">Blocked</span>
                        ) : (
                          <Badge variant="secondary" className="capitalize">
                            {TASK_STATUS_LABELS[task.status as TaskStatus] || task.status}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {!loading && view === "timeline" ? (
        <div className="cosmos-work-timeline-card">
          {timelineGroups.length === 0 ? (
            <div className="cosmos-work-empty">
              <p>No dated tasks to plot</p>
              <span>
                Timeline uses each task&apos;s due date from the API. Tasks without a due date are
                omitted — ranges are not estimated.
              </span>
            </div>
          ) : (
            <>
              <div className="cosmos-work-timeline-scale">
                {scaleLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div
                className="cosmos-work-timeline"
                style={
                  todayOffset != null
                    ? ({
                        ["--work-today"]: `${(todayOffset / timelineWindow.days) * 100}%`,
                      } as CSSProperties)
                    : undefined
                }
                data-has-today={todayOffset != null ? "true" : undefined}
              >
                {todayOffset != null ? (
                  <div className="cosmos-work-timeline__today" title="Today" />
                ) : null}
                {timelineGroups.map((group) => (
                  <div key={group.projectId || group.projectName} className="cosmos-work-timeline__group">
                    <div className="cosmos-work-timeline__project">
                      {group.projectId ? (
                        <Link to={`/projects/${group.projectId}`} className="hover:underline">
                          {group.projectName}
                        </Link>
                      ) : (
                        group.projectName
                      )}
                    </div>
                    {group.tasks.map((task) => {
                      const offset = dayOffset(task.dueDate!)
                      const widthDays = Math.max(
                        1,
                        task.estimateHours && task.estimateHours > 8
                          ? Math.ceil(task.estimateHours / 8)
                          : 1,
                      )
                      return (
                        <button
                          key={task.taskId}
                          type="button"
                          className="cosmos-work-timeline__row"
                          onClick={() => setDrawerTask(task)}
                        >
                          <span className="cosmos-work-timeline__label">{task.title}</span>
                          <span className="cosmos-work-timeline__track">
                            <span
                              className="cosmos-work-timeline__bar"
                              style={{
                                left: `${(offset / timelineWindow.days) * 100}%`,
                                width: `${(widthDays / timelineWindow.days) * 100}%`,
                              }}
                            />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="cosmos-work-note cosmos-work-timeline-note">
            <LinkIcon className="size-3.5" />
            {dependencyNoteCount > 0
              ? `${dependencyNoteCount} task${dependencyNoteCount === 1 ? "" : "s"} record dependencies. Moving dates does not auto-shift dependents — use Schedule Change on /schedule.`
              : "Dependency shifts and acknowledgement live on Schedule Change (/schedule). Timeline here only plots due dates."}
          </p>
        </div>
      ) : null}

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        projects={projects}
        campaigns={campaigns}
        teamMembers={teamMembers}
        defaultProjectId={
          projectFilter !== "all" ? projectFilter : scopedProjectId || projects[0]?.projectId
        }
        defaultStatus={createDefaultStatus}
        onSuccess={async () => {
          await reload()
        }}
      />

      <TaskDrawer
        open={Boolean(drawerTask)}
        task={drawerTask}
        canWrite={canWrite}
        busy={busyId === drawerTask?.taskId}
        onClose={() => setDrawerTask(null)}
        onEdit={openEditTask}
        onMarkDone={(task) => void moveTask(task, "done")}
      />

      <EntityFormDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          if (open) setTaskDialogOpen(true)
          else closeTaskDialog()
        }}
        title="Edit task"
        description="Set ownership, timing, and planning details from existing task fields."
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
              onChange={(event) =>
                setTaskForm((form) => ({ ...form, projectId: event.target.value }))
              }
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.projectName}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-campaign">Campaign</Label>
            <Select
              id="task-form-campaign"
              value={taskForm.campaignId}
              onChange={(event) =>
                setTaskForm((form) => ({ ...form, campaignId: event.target.value }))
              }
            >
              <option value="">No campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.campaignId} value={campaign.campaignId}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-assignee">Assignee</Label>
            <Select
              id="task-form-assignee"
              value={taskForm.assignee}
              onChange={(event) =>
                setTaskForm((form) => ({ ...form, assignee: event.target.value }))
              }
            >
              <option value="">Unassigned</option>
              {memberOptions.map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-status">Status</Label>
            <Select
              id="task-form-status"
              value={taskForm.status}
              onChange={(event) =>
                setTaskForm((form) => ({ ...form, status: event.target.value }))
              }
            >
              {STATUS_OPTIONS.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-priority">Priority</Label>
            <Select
              id="task-form-priority"
              value={taskForm.priority}
              onChange={(event) =>
                setTaskForm((form) => ({ ...form, priority: event.target.value }))
              }
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-form-due-date">Due date</Label>
            <Input
              id="task-form-due-date"
              type="date"
              value={taskForm.dueDate}
              onChange={(event) =>
                setTaskForm((form) => ({ ...form, dueDate: event.target.value }))
              }
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
              onChange={(event) =>
                setTaskForm((form) => ({ ...form, estimateHours: event.target.value }))
              }
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
                .filter(
                  (candidate) =>
                    candidate.taskId !== editingTask?.taskId &&
                    candidate.projectId === taskForm.projectId,
                )
                .map((candidate) => (
                  <option key={candidate.taskId} value={candidate.taskId}>
                    {candidate.title}
                  </option>
                ))}
            </Select>
          </div>
        </div>
      </EntityFormDialog>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null)
        }}
        title="Delete task?"
        description={
          deleteTarget ? `This will permanently delete “${deleteTarget.title}”.` : undefined
        }
        confirmLabel="Delete"
        destructive
        pending={Boolean(deletingId)}
        onConfirm={() => (deleteTarget ? handleDelete(deleteTarget) : undefined)}
      />
    </div>
  )
}
