import { useState } from "react"
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
import { createIncident } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Department, Incident } from "@/types/agency"

const INCIDENT_SEVERITIES = ["info", "warning", "critical"] as const

type CreateIncidentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  departments?: Department[]
  onSuccess: (incident: Incident) => void
}

export function CreateIncidentModal({
  open,
  onOpenChange,
  eventId,
  departments = [],
  onSuccess,
}: CreateIncidentModalProps) {
  const [title, setTitle] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [severity, setSeverity] = useState<string>("warning")
  const [category, setCategory] = useState("ops")
  const [assignedTo, setAssignedTo] = useState("")
  const [reportedBy, setReportedBy] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setTitle("")
    setDepartmentId("")
    setSeverity("warning")
    setCategory("ops")
    setAssignedTo("")
    setReportedBy("")
    setLocation("")
    setDescription("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("Incident summary is required.")
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
      const res = await createIncident(eventId, {
        title: title.trim(),
        severity,
        category: category.trim() || undefined,
        departmentId: departmentId || undefined,
        departmentName: selectedDept?.name || undefined,
        assignedTo: assignedTo.trim() || undefined,
        reportedBy: reportedBy.trim() || undefined,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      })
      if (res.data) {
        toast.success(`Incident "${res.data.title}" reported`)
        onSuccess(res.data)
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to report incident")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Log Live Incident</DialogTitle>
            <DialogDescription>
              Report technical faults, safety alerts, stage delays, or equipment issues.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="incident-title">Incident Headline *</Label>
              <Input
                id="incident-title"
                placeholder="e.g. Stage Left Audio Feed Dropped"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="incident-severity">Severity</Label>
                <select
                  id="incident-severity"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  disabled={busy}
                >
                  {INCIDENT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="incident-category">Category</Label>
                <Input
                  id="incident-category"
                  placeholder="e.g. ops, technical, safety"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="incident-department">Impacted Department</Label>
                <select
                  id="incident-department"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">General / None</option>
                  {departments.map((d) => (
                    <option key={d.departmentId || d.id} value={d.departmentId || d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="incident-location">Stage / Area</Label>
                <Input
                  id="incident-location"
                  placeholder="e.g. Stage Left"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="incident-assigned">Assigned To</Label>
                <Input
                  id="incident-assigned"
                  placeholder="e.g. Stage Manager"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="incident-reporter">Reported By</Label>
                <Input
                  id="incident-reporter"
                  placeholder="e.g. Alex Rivera"
                  value={reportedBy}
                  onChange={(e) => setReportedBy(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="incident-description">Description & Resolution Steps</Label>
              <Textarea
                id="incident-description"
                placeholder="Details of the fault, initial triage steps taken..."
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
            <Button
              type="submit"
              variant={severity === "critical" ? "destructive" : "default"}
              disabled={busy || !title.trim() || !eventId}
            >
              {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Report Incident
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
