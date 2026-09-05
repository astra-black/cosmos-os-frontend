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
import { createCrew } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { CrewMember, Department } from "@/types/agency"

type CreateCrewModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  departments?: Department[]
  onSuccess: (crew: CrewMember) => void
}

export function CreateCrewModal({
  open,
  onOpenChange,
  eventId,
  departments = [],
  onSuccess,
}: CreateCrewModalProps) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [status, setStatus] = useState<CrewMember["status"]>("assigned")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName("")
    setRole("")
    setDepartmentId("")
    setEmail("")
    setPhone("")
    setStatus("assigned")
    setNotes("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Crew member name is required.")
      return
    }
    if (!role.trim()) {
      setError("Role is required.")
      return
    }
    if (!departmentId) {
      setError("Department is required.")
      return
    }
    if (!eventId) {
      setError("Event scope is required.")
      return
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid crew email.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const selectedDept = departments.find((d) => d.departmentId === departmentId || d.id === departmentId)
      const payload: Partial<CrewMember> = {
        name: name.trim(),
        role: role.trim(),
        departmentId,
        departmentName: selectedDept?.name || undefined,
        email: email.trim(),
        phone: phone.trim(),
        status,
        notes: notes.trim() || undefined,
      }
      const res = await createCrew(eventId, payload)
      if (res.data) {
        toast.success(`Crew member "${res.data.name}" added`)
        onSuccess(res.data)
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add crew member")
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = Boolean(name.trim()) && Boolean(role.trim()) && Boolean(departmentId) && Boolean(eventId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add Crew Member</DialogTitle>
            <DialogDescription>
              Assign staff, technical operators, stage managers, or hospitality leads.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="crew-name">Full Name *</Label>
              <Input
                id="crew-name"
                placeholder="e.g. Marcus Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="crew-role">Position / Role *</Label>
                <Input
                  id="crew-role"
                  placeholder="e.g. Lighting Lead"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="crew-department">Department *</Label>
                <select
                  id="crew-department"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={busy}
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.departmentId || d.id} value={d.departmentId || d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="crew-email">Email Address</Label>
                <Input
                  id="crew-email"
                  type="email"
                  placeholder="crew@production.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="crew-phone">Phone / Comms</Label>
                <Input
                  id="crew-phone"
                  placeholder="+1 (555) 019-2834"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="crew-status">Readiness Status</Label>
              <select
                id="crew-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={status}
                onChange={(e) => setStatus(e.target.value as CrewMember["status"])}
                disabled={busy}
              >
                <option value="assigned">Assigned</option>
                <option value="confirmed">Confirmed</option>
                <option value="on_site">On Site</option>
                <option value="complete">Shift Complete</option>
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="crew-notes">Comms & Shift Notes</Label>
              <Textarea
                id="crew-notes"
                placeholder="Call time, radio channel, kit requirements..."
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
            <Button type="submit" disabled={busy || !canSubmit}>
              {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Add Crew
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
