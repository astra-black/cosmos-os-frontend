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
import { createProject } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { AgencyClient, Project } from "@/types/agency"

const PROJECT_STATUSES = ["NotStarted", "InProgress", "Review", "Approved", "Archived"] as const

type CreateProjectModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clients?: AgencyClient[]
  onSuccess: (project: Project) => void
}

export function CreateProjectModal({
  open,
  onOpenChange,
  clients = [],
  onSuccess,
}: CreateProjectModalProps) {
  const [name, setName] = useState("")
  const [clientId, setClientId] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [budget, setBudget] = useState("")
  const [weight, setWeight] = useState("")
  const [status, setStatus] = useState<string>("NotStarted")
  const [startDate, setStartDate] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName("")
    setClientId("")
    setCampaignId("")
    setBudget("")
    setWeight("")
    setStatus("NotStarted")
    setStartDate("")
    setTargetDate("")
    setDescription("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Project name is required.")
      return
    }

    const weightNum = weight ? Number(weight) : 0
    const budgetNum = budget ? Number(budget) : 0
    if (
      (startDate && targetDate && startDate > targetDate) ||
      (weight && (!Number.isFinite(weightNum) || weightNum < 0)) ||
      (budget && (!Number.isFinite(budgetNum) || budgetNum < 0))
    ) {
      setError("Enter valid positive numbers and ensure end date is after start date.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const client = clients.find((c) => c.clientId === clientId)
      const payload: Partial<Project> = {
        projectName: name.trim(),
        status,
        budget: budgetNum,
        weight: weightNum,
        description: description.trim() || "",
        startDate: startDate || null,
        endDate: targetDate || null,
        clientId: clientId || null,
        clientName: client?.name || null,
        campaignId: campaignId.trim() || null,
      }
      const res = await createProject(payload)
      if (res.data) {
        toast.success(`Project "${res.data.projectName}" created`)
        onSuccess(res.data)
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Launch a new client deliverable, campaign production, or brand initiative.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                placeholder="e.g. Brand Refresh 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="project-client">Client Account</Label>
                <select
                  id="project-client"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Select client (optional)</option>
                  {clients.map((c) => (
                    <option key={c.clientId} value={c.clientId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="project-campaign">Campaign ID</Label>
                <Input
                  id="project-campaign"
                  placeholder="Optional campaign id"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="project-status">Status</Label>
                <select
                  id="project-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={busy}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="project-weight">Weight</Label>
                <Input
                  id="project-weight"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="project-start-date">Start Date</Label>
                <Input
                  id="project-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="project-target-date">Target Completion</Label>
                <Input
                  id="project-target-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-budget">Budget ($)</Label>
              <Input
                id="project-budget"
                type="number"
                min="0"
                placeholder="e.g. 50000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="project-description">Scope & Description</Label>
              <Textarea
                id="project-description"
                placeholder="Key goals, deliverables, and production constraints..."
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
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
