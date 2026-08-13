import { useEffect, useMemo, useState } from "react"
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PlusIcon,
  RadioIcon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { withMutationFeedback } from "@/components/shared/mutation-feedback"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EventOpsMetricsCard } from "@/components/widgets/event-ops-metrics-card"
import { EventsDatatable } from "@/components/widgets/events-datatable"
import { PortfolioSummaryCard } from "@/components/widgets/portfolio-summary-card"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import { createEvent, deleteEvent, listEvents, updateEvent } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Event } from "@/types/agency"

const EVENT_TYPES = ["festival", "concert", "conference", "corporate", "tour", "private", "Product"] as const

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
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingEventId, setPendingEventId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null)
  const [form, setForm] = useState({
    name: "",
    type: "corporate",
    location: "",
    venue: "",
    description: "",
    organizerId: "",
    expectedAttendees: "",
    budget: "",
    startDate: "",
    endDate: "",
  })

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

  async function handleCreate() {
    if (!canWrite) return
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
    setCreating(true)
    try {
      await createEvent({
        name: form.name.trim(),
        type: form.type,
        location: form.location.trim(),
        venue: form.venue.trim() || undefined,
        description: form.description.trim() || undefined,
        organizerId: form.organizerId.trim() || undefined,
        expectedAttendees,
        budget,
        status: "draft",
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      setForm({ name: "", type: "corporate", location: "", venue: "", description: "", organizerId: "", expectedAttendees: "", budget: "", startDate: "", endDate: "" })
      setShowCreate(false)
      await reload()
      toast.success("Event created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit(event: Event) {
    if (!canWrite) return
    const name = window.prompt("Event name", event.name)
    if (name == null || !name.trim() || name.trim() === event.name) return
    setSaving(true)
    setPendingEventId(event.eventId)
    try {
      await withMutationFeedback(
        updateEvent(event.eventId, { name: name.trim() }),
        { loading: "Updating event...", success: "Event updated", error: (err) => err instanceof ApiError ? err.message : "Update failed" },
      )
      await reload()
    } catch {
    } finally {
      setSaving(false)
      setPendingEventId(null)
    }
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
          canWrite ? <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            <PlusIcon className="size-3.5" />
            New event
          </Button> : undefined
        }
      />

      {showCreate ? (
        <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Event name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Input
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
          <Input placeholder="Venue" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
          <Input placeholder="Organizer ID" value={form.organizerId} onChange={(e) => setForm((f) => ({ ...f, organizerId: e.target.value }))} />
          <Input type="number" min="1" step="1" placeholder="Expected attendees" value={form.expectedAttendees} onChange={(e) => setForm((f) => ({ ...f, expectedAttendees: e.target.value }))} />
          <Input type="number" min="0.01" step="0.01" placeholder="Budget" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} />
          <textarea className="border-input bg-background min-h-9 rounded-md border px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Input
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
          <Input
            type="datetime-local"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button disabled={creating || !form.name.trim() || !form.location.trim() || !form.startDate || !form.endDate} onClick={handleCreate}>
              Create
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

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
