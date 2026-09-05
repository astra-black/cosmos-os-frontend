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
import { createEvent } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Event, EventStatus } from "@/types/agency"

const EVENT_TYPES = ["festival", "concert", "conference", "corporate", "tour", "private", "Product"] as const
const EVENT_STATUSES = ["draft", "planning", "confirmed", "live", "completed", "cancelled"] as const

type CreateEventModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (event: Event) => void
}

export function CreateEventModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateEventModalProps) {
  const [name, setName] = useState("")
  const [type, setType] = useState<string>("corporate")
  const [status, setStatus] = useState<EventStatus>("draft")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [location, setLocation] = useState("")
  const [venue, setVenue] = useState("")
  const [organizerId, setOrganizerId] = useState("")
  const [budget, setBudget] = useState("")
  const [expectedAttendees, setExpectedAttendees] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName("")
    setType("corporate")
    setStatus("draft")
    setStartDate("")
    setEndDate("")
    setLocation("")
    setVenue("")
    setOrganizerId("")
    setBudget("")
    setExpectedAttendees("")
    setDescription("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !type || !location.trim() || !startDate || !endDate) {
      setError("Name, type, location, start date, and end date are required.")
      return
    }
    const start = new Date(startDate)
    const end = new Date(endDate)
    const attendees = expectedAttendees ? Number(expectedAttendees) : undefined
    const budgetNum = budget ? Number(budget) : undefined
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      setError("Start date must be before or equal to end date.")
      return
    }
    if (
      (attendees !== undefined && (!Number.isInteger(attendees) || attendees <= 0)) ||
      (budgetNum !== undefined && (!Number.isFinite(budgetNum) || budgetNum <= 0))
    ) {
      setError("Attendees must be a positive whole number and budget must be positive.")
      return
    }

    setBusy(true)
    setError(null)
    try {
      const payload: Partial<Event> = {
        name: name.trim(),
        type,
        status,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        location: location.trim(),
        venue: venue.trim() || undefined,
        organizerId: organizerId.trim() || undefined,
        budget: budgetNum,
        expectedAttendees: attendees,
        description: description.trim() || undefined,
      }
      const res = await createEvent(payload)
      if (res.data) {
        toast.success(`Event "${res.data.name}" created`)
        onSuccess(res.data)
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create event")
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    Boolean(name.trim()) && Boolean(type) && Boolean(location.trim()) && Boolean(startDate) && Boolean(endDate)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create Live Event</DialogTitle>
            <DialogDescription>
              Schedule an experiential production, brand activation, summit, or gala.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="event-name">Event Name *</Label>
              <Input
                id="event-name"
                placeholder="e.g. Astra Global Summit 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="event-type">Event Format / Type *</Label>
                <select
                  id="event-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={busy}
                  required
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="event-status">Status</Label>
                <select
                  id="event-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EventStatus)}
                  disabled={busy}
                >
                  {EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="event-start">Start Date & Time *</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="event-end">End Date & Time *</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="event-location">City / Location *</Label>
                <Input
                  id="event-location"
                  placeholder="e.g. San Francisco, CA"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="event-venue">Venue</Label>
                <Input
                  id="event-venue"
                  placeholder="e.g. Moscone West"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="event-budget">Production Budget ($)</Label>
                <Input
                  id="event-budget"
                  type="number"
                  placeholder="e.g. 250000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="event-attendees">Expected Attendees</Label>
                <Input
                  id="event-attendees"
                  type="number"
                  placeholder="e.g. 1200"
                  value={expectedAttendees}
                  onChange={(e) => setExpectedAttendees(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="event-organizer">Organizer ID</Label>
              <Input
                id="event-organizer"
                placeholder="Optional organizer id"
                value={organizerId}
                onChange={(e) => setOrganizerId(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="event-description">Event Brief & Run-of-Show Notes</Label>
              <Textarea
                id="event-description"
                placeholder="High-level vision, key partners, streaming specs..."
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
            <Button type="submit" disabled={busy || !canSubmit}>
              {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Create Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
