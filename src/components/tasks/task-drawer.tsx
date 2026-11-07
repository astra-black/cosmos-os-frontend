import { Link } from "react-router-dom"
import { CheckIcon, MessageSquareIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/tasks/task-status"
import type { Task } from "@/types/agency"

type TaskDrawerProps = {
  task: Task | null
  open: boolean
  canWrite: boolean
  busy?: boolean
  onClose: () => void
  onEdit: (task: Task) => void
  onMarkDone: (task: Task) => void
}

function dueLabel(dueDate?: string | null) {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (Number.isNaN(d.getTime())) return dueDate
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

export function TaskDrawer({
  task,
  open,
  canWrite,
  busy,
  onClose,
  onEdit,
  onMarkDone,
}: TaskDrawerProps) {
  if (!open || !task) return null

  const statusLabel =
    TASK_STATUS_LABELS[task.status as TaskStatus] || task.status.replace(/_/g, " ")
  const due = dueLabel(task.dueDate)
  const deps = task.dependencyIds?.length ?? 0

  return (
    <div className="cosmos-work-drawer-scrim" onClick={onClose}>
      <aside
        className="cosmos-work-drawer"
        role="dialog"
        aria-labelledby="work-task-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cosmos-work-drawer__head">
          <div>
            <p className="cosmos-work-page__eyebrow">Task · {statusLabel}</p>
            <h2 id="work-task-drawer-title">{task.title}</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <XIcon className="size-4" />
          </Button>
        </header>

        <div className="cosmos-work-drawer__meta">
          <Badge variant="secondary" className="capitalize">
            {statusLabel}
          </Badge>
          {task.projectName || task.projectId ? (
            <Badge variant="outline">
              {task.projectId ? (
                <Link to={`/projects/${task.projectId}`} className="hover:underline">
                  {task.projectName || "Project"}
                </Link>
              ) : (
                task.projectName
              )}
            </Badge>
          ) : null}
          {due ? <Badge variant="outline">Due {due}</Badge> : null}
          {task.priority ? (
            <Badge variant="outline" className="capitalize">
              {task.priority}
            </Badge>
          ) : null}
        </div>

        <dl className="cosmos-work-drawer__pairs">
          <div>
            <dt>Assigned to</dt>
            <dd>{task.assignee || "Unassigned"}</dd>
          </div>
          <div>
            <dt>Depends on</dt>
            <dd>
              {deps > 0
                ? `${deps} predecessor${deps === 1 ? "" : "s"} in this project`
                : "None recorded"}
            </dd>
          </div>
          {task.estimateHours != null && task.estimateHours > 0 ? (
            <div>
              <dt>Estimate</dt>
              <dd>{task.estimateHours}h</dd>
            </div>
          ) : null}
          {task.tags && task.tags.length > 0 ? (
            <div>
              <dt>Tags</dt>
              <dd>{task.tags.join(", ")}</dd>
            </div>
          ) : null}
        </dl>

        {task.description ? (
          <p className="cosmos-work-drawer__desc">{task.description}</p>
        ) : null}

        <div className="cosmos-work-unavailable">
          <p>Checklist and files are not available</p>
          <span>
            Designed task checklist and file strip (Figma 75–78) have no task sub-item or
            attachment API yet. Nothing is simulated here.
          </span>
        </div>

        <footer className="cosmos-work-drawer__foot">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Task-linked messaging is not available yet"
          >
            <MessageSquareIcon className="size-3.5" />
            Message
          </Button>
          <div className="cosmos-work-drawer__foot-actions">
            {canWrite ? (
              <>
                <Button size="sm" variant="outline" onClick={() => onEdit(task)} disabled={busy}>
                  Edit
                </Button>
                {task.status !== "done" ? (
                  <Button
                    size="sm"
                    className="cosmos-work-primary"
                    onClick={() => onMarkDone(task)}
                    disabled={busy}
                  >
                    <CheckIcon className="size-3.5" />
                    Mark Done
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </footer>
      </aside>
    </div>
  )
}

export function taskInitials(name?: string | null) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export function isDueSoon(dueDate?: string | null, status?: string) {
  if (!dueDate || status === "done") return false
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 3)
  return due >= today && due <= limit
}

export function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || status === "done") return false
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function boardColumnForStatus(status: string): "todo" | "in_progress" | "review" | "done" {
  if (status === "in_progress") return "in_progress"
  if (status === "review") return "review"
  if (status === "done") return "done"
  // Blocked and unknown statuses surface in To Do with a Blocked badge (Figma board).
  return "todo"
}

export function cnFlag(task: Task) {
  if (task.status === "blocked") return "blocked"
  if (isOverdue(task.dueDate, task.status)) return "overdue"
  if (isDueSoon(task.dueDate, task.status)) return "soon"
  if (task.tags?.some((t) => /client/i.test(t))) return "client"
  if (task.tags?.some((t) => /vendor|atlas/i.test(t))) return "vendor"
  return null
}
