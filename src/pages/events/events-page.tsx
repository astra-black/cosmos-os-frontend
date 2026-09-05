import { useEffect, useMemo, useState } from "react"
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PlusIcon,
  RadioIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CreateEventModal } from "@/components/modals"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { withMutationFeedback } from "@/components/shared/mutation-feedback"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { EventOpsMetricsCard } from "@/components/widgets/event-ops-metrics-card"
import { EventsDatatable } from "@/components/widgets/events-datatable"
import { PortfolioSummaryCard } from "@/components/widgets/portfolio-summary-card"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import { deleteEvent, listEvents, updateEvent } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Event, EventStatus } from "@/types/agency"

const EVENT_TYPES = ["festival", "concert", "conference", "corporate", "tour", "private", "Product"] as const
const EVENT_STATUSES = ["draft", "planning", "confirmed", "live", "completed", "cancelled"] as const

type EventFormData = {
  name: string
  type: string
  status: EventStatus
  location: string
  venue: string
  description: string
  organizerId: string
  expectedAttendees: string
  budget: string
  startDate: string
  endDate: string
}

const emptyEventForm: EventFormData = {
  name: "",
  type: "corporate",
  status: "draft",
  location: "",
  venue: "",
  description: "",
  organizerId: "",
  expectedAttendees: "",
  budget: "",
  startDate: "",
  endDate: "",
}

function toDateTimeLocal(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--chart-3)",
  planning: "var(--chart-2)",
  confirmed: "var(--chart-4)",
  live: "var(--chart-1)",
  completed: "var(--chart-5)",
  cancelled: "var(--muted-foreground)",
}

export function EventsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops")
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventFormMode, setEventFormMode] = useState<"edit" | null>(null)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingEventId, setPendingEventId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [form, setForm] = useState<EventFormData>(emptyEventForm)

  async function reload() {
    const response = await listEvents({ page: 1, limit: 100 })
    setEvents(response.data ?? [])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await reload()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load events")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function openCreateDialog() {
    setCreateOpen(true)
  }

  function openEditDialog(event: Event) {
    setEditingEvent(event)
    setForm({
      name: event.name,
      type: event.type,
      status: event.status,
      location: event.location,
      venue: event.venue ?? "",
      description: event.description ?? "",
      organizerId: event.organizerId ?? "",
      expectedAttendees: event.expectedAttendees != null ? String(event.expectedAttendees) : "",
      budget: event.budget != null ? String(event.budget) : "",
      startDate: toDateTimeLocal(event.startDate),
      endDate: toDateTimeLocal(event.endDate),
    })
    setEventFormMode("edit")
  }

  async function handleSaveEvent() {
    if (!canWrite || !editingEvent) return
    if (!form.name.trim() || !form.type || !form.location.trim() || !form.startDate || !form.endDate) {
      toast.error("Name, type, location, start date, and end date are required")
      return
    }
    const startDate = new Date(form.startDate)
    const endDate = new Date(form.endDate)
    const expectedAttendees = form.expectedAttendees ? Number(form.expectedAttendees) : undefined
    const budget = form.budget ? Number(form.budget) : undefined
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      toast.error("Start date must be before or equal to end date")
      return
    }
    if (
      (expectedAttendees !== undefined && (!Number.isInteger(expectedAttendees) || expectedAttendees <= 0)) ||
      (budget !== undefined && (!Number.isFinite(budget) || budget <= 0))
    ) {
      toast.error("Attendees must be a positive whole number and budget must be positive")
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        location: form.location.trim(),
        venue: form.venue.trim() || undefined,
        description: form.description.trim() || undefined,
        organizerId: form.organizerId.trim() || undefined,
        expectedAttendees,
        budget,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }
      await withMutationFeedback(updateEvent(editingEvent.eventId, payload), {
        loading: "Updating event...",
        success: "Event updated",
        error: (err) => err instanceof ApiError ? err.message : "Update failed",
      })
      setForm(emptyEventForm)
      setEditingEvent(null)
      setEventFormMode(null)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(event: Event) {
    if (!canWrite) return
    openEditDialog(event)
  }

  async function handleDelete(event: Event) {
    if (!canWrite) return
    setSaving(true)
    setPendingEventId(event.eventId)
    try {
      await withMutationFeedback(
        deleteEvent(event.eventId),
        { loading: "Archiving event...", success: "Event archived", error: (err) => err instanceof ApiError ? err.message : "Archive failed" },
      )
      await reload()
    } catch {
    } finally {
      setSaving(false)
      setPendingEventId(null)
      setDeleteTarget(null)
    }
  }

  const liveCount = events.filter((e) => e.status === "live").length
  const pipelineCount = events.filter((e) =>
    ["live", "confirmed", "planning"].includes(e.status),
  ).length
  const venues = new Set(events.map((e) => e.location).filter(Boolean)).size
  const totalBudget = events.reduce((sum, e) => sum + (e.budget ?? 0), 0)
  const planPercentage =
    events.length === 0 ? 0 : Math.round((pipelineCount / events.length) * 100)

  const statusSlices = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      counts.set(event.status, (counts.get(event.status) ?? 0) + 1)
    }
    return [...counts.entries()].map(([status, count]) => ({
      status,
      count,
      fill: STATUS_COLORS[status] ?? "var(--primary)",
    }))
  }, [events])

  const typeLines = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      const key = event.type || "other"
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const total = events.length || 1
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([type, count]) => ({
        key: type,
        label: type,
        detail: `${count} event${count === 1 ? "" : "s"}`,
        value: String(count),
        progressPercentage: Math.round((count / total) * 100),
      }))
  }, [events])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Events"
        description="Agency calendar and show pipeline — open a row for cues, crew, and incidents."
        actions={
          canWrite ? <Button size="sm" onClick={openCreateDialog}>
            <PlusIcon className="size-3.5" />
            New event
          </Button> : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">
          {error}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        <div className="col-span-full grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <StatisticsCard
                icon={<CalendarDaysIcon className="size-4" />}
                value={String(events.length)}
                title="Total events"
                changePercentage="all statuses"
              />
              <StatisticsCard
                icon={<RadioIcon className="size-4" />}
                value={String(liveCount)}
                title="Live now"
                changePercentage={`${pipelineCount} in pipeline`}
              />
              <StatisticsCard
                icon={<CalendarCheckIcon className="size-4" />}
                value={String(pipelineCount)}
                title="Active pipeline"
                changePercentage={`${planPercentage}% of book`}
              />
              <StatisticsCard
                icon={<MapPinIcon className="size-4" />}
                value={String(venues)}
                title="Locations"
                changePercentage={
                  totalBudget > 0 ? `$${Math.round(totalBudget / 1000)}k budget` : "no budget"
                }
              />
            </>
          )}
        </div>

        <PortfolioSummaryCard
          className="col-span-full justify-between gap-5 lg:col-span-1"
          loading={loading}
          title="By type"
          headlineValue={String(events.length)}
          trend="up"
          percentage={planPercentage}
          comparisonText="Share of events still in active pipeline"
          items={typeLines}
        />

        <EventOpsMetricsCard
          className="col-span-full *:data-[slot=card-content]:gap-6 lg:col-span-2"
          loading={loading}
          planPercentage={planPercentage}
          metrics={[
            { title: "Events", value: String(events.length), icon: "events" },
            { title: "Live", value: String(liveCount), icon: "cues" },
            { title: "Pipeline", value: String(pipelineCount), icon: "projects" },
            {
              title: "Budget",
              value: totalBudget > 0 ? `$${Math.round(totalBudget / 1000)}k` : "—",
              icon: "incidents",
            },
          ]}
          statusSlices={statusSlices}
        />

        <Card className="col-span-full w-full py-4">
          <div className="mb-4 px-4">
            <h2 className="text-lg font-semibold">Event register</h2>
            <p className="text-muted-foreground text-sm">
              `GET /api/v1/agency/events` · click a name for ops detail
            </p>
          </div>
          {loading ? (
            <div className="px-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="px-4">
               <EventsDatatable data={events} canWrite={canWrite && !saving} onEdit={handleEdit} onDelete={(event) => setDeleteTarget(event)} />
            </div>
          )}
        </Card>
      </div>
      <CreateEventModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={async () => {
          await reload()
        }}
      />
      <EntityFormDialog
        open={eventFormMode === "edit"}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setEventFormMode(null)
            setEditingEvent(null)
          }
        }}
        title="Edit event"
        description="Set the event schedule, venue, status, and operating details."
        onSubmit={handleSaveEvent}
        submitLabel="Save changes"
        pending={saving}
        submitDisabled={!form.name.trim() || !form.type || !form.location.trim() || !form.startDate || !form.endDate}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="event-name">Name</Label>
            <Input id="event-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Event name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-type">Type</Label>
            <Select id="event-type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-status">Status</Label>
            <Select id="event-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as EventStatus }))}>
              {EVENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-location">Location</Label>
            <Input id="event-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="City or site" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-venue">Venue</Label>
            <Input id="event-venue" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Venue name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-organizer">Organizer ID</Label>
            <Input id="event-organizer" value={form.organizerId} onChange={(e) => setForm((f) => ({ ...f, organizerId: e.target.value }))} placeholder="Optional organizer ID" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-start">Start</Label>
            <Input id="event-start" type="datetime-local" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-end">End</Label>
            <Input id="event-end" type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-attendees">Expected attendees</Label>
            <Input id="event-attendees" type="number" min="1" step="1" value={form.expectedAttendees} onChange={(e) => setForm((f) => ({ ...f, expectedAttendees: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="event-budget">Budget</Label>
            <Input id="event-budget" type="number" min="0.01" step="0.01" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="event-description">Description</Label>
          <Textarea id="event-description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Event description" />
        </div>
      </EntityFormDialog>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !pendingEventId) setDeleteTarget(null) }}
        title="Archive event?"
        description={deleteTarget ? `This will archive “${deleteTarget.name}”.` : undefined}
        confirmLabel="Archive"
        destructive
        pending={Boolean(pendingEventId)}
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget) : undefined}
      />
    </div>
  )
}
