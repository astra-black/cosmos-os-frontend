export const TASK_STATUSES = ["todo", "in_progress", "review", "blocked", "done"] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
}

const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["todo", "in_progress", "blocked"],
  in_progress: ["todo", "in_progress", "review", "blocked"],
  review: ["in_progress", "review", "blocked", "done"],
  blocked: ["todo", "in_progress", "blocked"],
  done: ["done"],
}

export function isTaskStatusTransitionAllowed(from: string, to: string): to is TaskStatus {
  return TASK_STATUSES.includes(from as TaskStatus) &&
    ALLOWED_TRANSITIONS[from as TaskStatus].includes(to as TaskStatus)
}
