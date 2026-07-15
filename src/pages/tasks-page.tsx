import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createTask, listTasks, updateTask } from "@/lib/api/agency"
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

const ASSIGNEES = [
  "Maya Chen",
  "Jordan Blake",
  "Alex Rivera",
  "Priya Shah",
  "Chris Patel",
  "Unassigned",
]

export function TasksPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    title: "",
    assignee: "Unassigned",
    priority: "medium",
    dueDate: "",
    projectName: "",
  })
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  const reload = useCallback(async () => {
    const res = await listTasks()
    setTasks(res.data ?? [])
  }, [])

  function patchLocal(updated: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.taskId === updated.taskId ? { ...t, ...updated } : t)),
    )
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load tasks")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reload])

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

  async function handleCreate() {
    if (!form.title.trim() || !canWrite) return
    try {
      await createTask({
        title: form.title.trim(),
        status: "todo",
        priority: form.priority,
        assignee: form.assignee,
        dueDate: form.dueDate || null,
        projectName: form.projectName || null,
      })
      setForm({
        title: "",
        assignee: "Unassigned",
        priority: "medium",
        dueDate: "",
        projectName: "",
      })
      setShowAdd(false)
      await reload()
      toast.success("Task created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tasks"
        description="Production workboard — move cards, set priority, assign owners."
        actions={
          canWrite ? (
            <Button size="sm" variant={showAdd ? "default" : "outline"} onClick={() => setShowAdd((v) => !v)}>
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

      {showAdd && canWrite ? (
        <Card className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-5">
          <Input
            placeholder="Task title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
            className="lg:col-span-2"
          />
          <Input
            placeholder="Project name"
            value={form.projectName}
            onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
          />
          <select
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
            value={form.assignee}
            onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}
          >
            {ASSIGNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
            <select
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-auto"
            />
            <Button size="sm" disabled={!form.title.trim()} onClick={() => void handleCreate()}>
              Create
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm sm:w-auto"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
        >
          <option value="all">All assignees</option>
          {ASSIGNEES.map((a) => (
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
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
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
                          <h3 className="text-sm font-medium leading-snug">{task.title}</h3>
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
                          {task.projectName || task.projectId || "No project"}
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
                              {ASSIGNEES.map((a) => (
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
    </div>
  )
}
