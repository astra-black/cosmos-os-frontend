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
import { createCue } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Cue, Department } from "@/types/agency"

function toDateTimeLocal(iso?: string) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type CreateCueModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  departments?: Department[]
  /** Prefill from last cue + duration (page-derived). */
  defaultScheduledTime?: string
  onSuccess: (cue: Cue) => void
}

export function CreateCueModal({
  open,
  onOpenChange,
  eventId,
  departments = [],
  defaultScheduledTime,
  onSuccess,
}: CreateCueModalProps) {
  const [name, setName] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [departmentName, setDepartmentName] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [duration, setDuration] = useState("10")
  const [priority, setPriority] = useState<Cue["priority"]>("medium")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setScheduledTime(toDateTimeLocal(defaultScheduledTime) || "")
    }
  }, [open, defaultScheduledTime])

  function reset() {
    setName("")
    setDepartmentId("")
    setDepartmentName("")
    setScheduledTime(toDateTimeLocal(defaultScheduledTime) || "")
    setDuration("10")
    setPriority("medium")
    setLocation("")
    setDescription("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Cue title/action is required.")
      return
    }
    if (!eventId) {
      setError("Event scope is required.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const selectedDept = departments.find((d) => d.departmentId === departmentId || d.id === departmentId)
      const resolvedDeptName =
        selectedDept?.name || departmentName.trim() || undefined
      const scheduledIso = scheduledTime
        ? new Date(scheduledTime).toISOString()
        : defaultScheduledTime || new Date().toISOString()

      const res = await createCue(eventId, {
        name: name.trim(),
        description: description.trim() || undefined,
        scheduledTime: scheduledIso,
        duration: duration ? Number(duration) : 10,
        priority,
        location: location.trim() || undefined,
        departmentName: resolvedDeptName,
      })
      if (res.data) {
        toast.success(`Cue "${res.data.name}" added to run-sheet`)
        onSuccess(res.data)
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add cue")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add Run of Show Cue</DialogTitle>
            <DialogDescription>
              Sequence stage cues, visual transitions, audio stings, or presenter calls.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="cue-name">Cue Action / Title *</Label>
              <Input
                id="cue-name"
                placeholder="e.g. Intro Video Roll & House Lights Down"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cue-department">Department</Label>
                {departments.length > 0 ? (
                  <select
                    id="cue-department"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value)
                      setDepartmentName("")
                    }}
                    disabled={busy}
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.departmentId || d.id} value={d.departmentId || d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="cue-department"
                    placeholder="e.g. Audio / Lighting"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    disabled={busy}
                  />
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cue-priority">Priority</Label>
                <select
                  id="cue-priority"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Cue["priority"])}
                  disabled={busy}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cue-time">Scheduled Execution Time</Label>
                <Input
                  id="cue-time"
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cue-duration">Duration (minutes)</Label>
                <Input
                  id="cue-duration"
                  type="number"
                  placeholder="10"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cue-location">Stage / Location</Label>
              <Input
                id="cue-location"
                placeholder="e.g. Main Stage / Booth A"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cue-description">Technical Instructions & Trigger Notes</Label>
              <Textarea
                id="cue-description"
                placeholder="Standby on 30s mark, fade audio at 04:30..."
                rows={2}
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
            <Button type="submit" disabled={busy || !name.trim() || !eventId}>
              {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Add Cue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
