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
import { createTask } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Campaign, Project, Task } from "@/types/agency"

type CreateTaskModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects?: Project[]
  campaigns?: Campaign[]
  defaultProjectId?: string
  onSuccess: (task: Task) => void
}

export function CreateTaskModal({
  open,
  onOpenChange,
  projects = [],
  campaigns = [],
  defaultProjectId,
  onSuccess,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("")
  const [projectId, setProjectId] = useState(defaultProjectId || "")
  const [campaignId, setCampaignId] = useState("")
  const [assignee, setAssignee] = useState("Unassigned")
  const [priority, setPriority] = useState<string>("medium")
  const [status, setStatus] = useState<string>("todo")
  const [dueDate, setDueDate] = useState("")
  const [estimateHours, setEstimateHours] = useState("")
  const [tags, setTags] = useState("")
  const [description, setDescription] = useState("")
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
    setAssignee("Unassigned")
    setPriority("medium")
    setStatus("todo")
    setDueDate("")
    setEstimateHours("")
    setTags("")
    setDescription("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("Task title is required.")
      return
    }
    const hours = estimateHours.trim() ? Number(estimateHours) : 0
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Estimate hours must be a non-negative number.")
      return
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
        assignee: assignee.trim() || "Unassigned",
        priority,
        status,
        dueDate: dueDate || null,
        estimateHours: hours,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        description: description.trim() || undefined,
      }
      const res = await createTask(payload)
      if (res.data) {
        toast.success(`Task "${res.data.title}" created`)
        onSuccess(res.data)
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

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="task-project">Linked Project</Label>
                <select
                  id="task-project"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select project (optional)</option>
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
                <Input
                  id="task-assignee"
                  placeholder="e.g. Jordan Lee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  disabled={busy}
                />
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
