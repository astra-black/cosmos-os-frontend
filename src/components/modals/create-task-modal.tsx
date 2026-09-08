import { useEffect, useState } from "react"
import { toast } from "sonner"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import { createRecurringTasks, createTask } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Campaign, Project, Task, TeamMember } from "@/types/agency"

type CreateTaskModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects?: Project[]
  campaigns?: Campaign[]
  teamMembers?: TeamMember[]
  defaultProjectId?: string
  onSuccess: (task: Task) => void
}

export function CreateTaskModal({
  open,
  onOpenChange,
  projects = [],
  campaigns = [],
  teamMembers = [],
  defaultProjectId,
  onSuccess,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("")
  const [projectId, setProjectId] = useState(defaultProjectId || "")
  const [campaignId, setCampaignId] = useState("")
  const [assigneeMemberId, setAssigneeMemberId] = useState("")
  const [priority, setPriority] = useState<string>("medium")
  const [status, setStatus] = useState<string>("todo")
  const [dueDate, setDueDate] = useState("")
  const [estimateHours, setEstimateHours] = useState("")
  const [tags, setTags] = useState("")
  const [description, setDescription] = useState("")
  const [recurring, setRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [recurrenceInterval, setRecurrenceInterval] = useState("1")
  const [recurrenceStartDate, setRecurrenceStartDate] = useState("")
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("")
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState("1")
  const [recurrenceWeekday, setRecurrenceWeekday] = useState("1")
  const [recurrenceMaxOccurrences, setRecurrenceMaxOccurrences] = useState("12")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && !projectId && defaultProjectId) {
      setProjectId(defaultProjectId)
    }
  }, [open, defaultProjectId, projectId])

  function reset() {
    setTitle("")
    setProjectId(defaultProjectId || "")
    setCampaignId("")
    setAssigneeMemberId("")
    setPriority("medium")
    setStatus("todo")
    setDueDate("")
    setEstimateHours("")
    setTags("")
    setDescription("")
    setRecurring(false)
    setRecurrenceFrequency("weekly")
    setRecurrenceInterval("1")
    setRecurrenceStartDate("")
    setRecurrenceEndDate("")
    setRecurrenceDayOfMonth("1")
    setRecurrenceWeekday("1")
    setRecurrenceMaxOccurrences("12")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("Task title is required.")
      return
    }
    if (!projectId) {
      setError("Select a project before creating a task.")
      return
    }
    const hours = estimateHours.trim() ? Number(estimateHours) : 0
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Estimate hours must be a non-negative number.")
      return
    }
    if (recurring) {
      const interval = Number(recurrenceInterval)
      const maxOccurrences = Number(recurrenceMaxOccurrences)
      if (!Number.isInteger(interval) || interval < 1 || interval > 365) {
        setError("Recurrence interval must be an integer from 1 to 365.")
        return
      }
      if (!recurrenceStartDate || !Number.isInteger(maxOccurrences) || maxOccurrences < 1 || maxOccurrences > 100) {
        setError("Choose a recurrence start date and between 1 and 100 occurrences.")
        return
      }
    }

    setBusy(true)
    setError(null)
    try {
      const selectedProject = projects.find((p) => p.projectId === projectId)
      const payload: Partial<Task> = {
        title: title.trim(),
        projectId: projectId || null,
        projectName: selectedProject?.projectName ?? null,
        campaignId: campaignId || null,
        assigneeMemberId: assigneeMemberId || null,
        assignee: teamMembers.find((member) => member.memberId === assigneeMemberId)?.name || "Unassigned",
        priority,
        status,
        dueDate: dueDate || null,
        estimateHours: hours,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        description: description.trim() || undefined,
      }
      const res = recurring
        ? await createRecurringTasks({
            ...payload,
            recurrence: {
              frequency: recurrenceFrequency,
              interval: Number(recurrenceInterval),
              startDate: recurrenceStartDate,
              endDate: recurrenceEndDate || null,
              ...(recurrenceFrequency === "weekly" ? { byWeekday: Number(recurrenceWeekday) } : {}),
              ...(recurrenceFrequency === "monthly" ? { dayOfMonth: Number(recurrenceDayOfMonth) } : {}),
              maxOccurrences: Number(recurrenceMaxOccurrences),
            },
          })
        : await createTask(payload)
      if (res.data) {
        const createdTasks: Task[] = Array.isArray(res.data) ? res.data : [res.data]
        const created = createdTasks[0]
        toast.success(recurring ? `${createdTasks.length} recurring tasks created` : `Task "${created.title}" created`)
        onSuccess(created)
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create task")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Assign work items, action deliverables, or set milestones.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                placeholder="e.g. Master cut audio mixing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} disabled={busy} />
                Repeat this task
              </label>
              {recurring ? (
                <div className="mt-3 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={recurrenceFrequency} onChange={(e) => setRecurrenceFrequency(e.target.value as typeof recurrenceFrequency)} disabled={busy}>
                      <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                    </select>
                    <Input type="number" min="1" max="365" value={recurrenceInterval} onChange={(e) => setRecurrenceInterval(e.target.value)} disabled={busy} aria-label="Repeat interval" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="date" value={recurrenceStartDate} onChange={(e) => setRecurrenceStartDate(e.target.value)} disabled={busy} aria-label="Recurrence start date" />
                    <Input type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} disabled={busy} aria-label="Recurrence end date" />
                  </div>
                  {recurrenceFrequency === "weekly" ? (
                    <select className="h-9 rounded-md border bg-transparent px-3 text-sm" value={recurrenceWeekday} onChange={(e) => setRecurrenceWeekday(e.target.value)} disabled={busy}>
                      <option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option>
                    </select>
                  ) : null}
                  {recurrenceFrequency === "monthly" ? <Input type="number" min="1" max="31" value={recurrenceDayOfMonth} onChange={(e) => setRecurrenceDayOfMonth(e.target.value)} disabled={busy} aria-label="Day of month" /> : null}
                  <Input type="number" min="1" max="100" value={recurrenceMaxOccurrences} onChange={(e) => setRecurrenceMaxOccurrences(e.target.value)} disabled={busy} aria-label="Maximum occurrences" />
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="task-project">Linked Project *</Label>
                <select
                  id="task-project"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="task-campaign">Campaign</Label>
                <select
                  id="task-campaign"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">None</option>
                  {campaigns.map((c) => (
                    <option key={c.campaignId} value={c.campaignId}>
                      {c.name || c.campaignId}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="task-assignee">Assignee</Label>
                <select
                  id="task-assignee"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={assigneeMemberId}
                  onChange={(e) => setAssigneeMemberId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.memberId} value={member.memberId}>
                      {member.name}{member.title ? ` · ${member.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="task-estimate">Estimate (hours)</Label>
                <Input
                  id="task-estimate"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={estimateHours}
                  onChange={(e) => setEstimateHours(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <select
                  id="task-priority"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={busy}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="task-status">Status</Label>
                <select
                  id="task-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={busy}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={busy}
                />
                <p className="text-muted-foreground text-xs">
                  The assignee receives an in-app reminder on the due date.
                </p>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="task-tags">Tags</Label>
              <Input
                id="task-tags"
                placeholder="audio, mix, rush"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={busy}
              />
              <p className="text-muted-foreground text-xs">Separate tags with commas.</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="task-description">Task Notes / Specs</Label>
              <Textarea
                id="task-description"
                placeholder="Checklist, links, feedback items..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
