import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { LayersIcon, PlusIcon } from "lucide-react"

import { CreateEventModal } from "@/components/modals"
import {
  DataFreshnessPill,
  FRESHNESS_LEGEND,
  type DataFreshness,
} from "@/components/events/data-freshness-pill"
import { UpdateAttendanceDialog } from "@/components/events/update-attendance-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { listAllIncidents, listEvents } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Event, EventStatus, Incident } from "@/types/agency"

type StatusFilter = "all" | "live" | "upcoming"
type MainTab = "events" | "issues"

type EventRowView = {
  event: Event
  statusLabel: string
  statusTone: "critical" | "info" | "success" | "neutral" | "warning"
  freshness: DataFreshness
  source: string
  subtitle: string
  editionLabel: string
}

const EDITION_OPTIONS = [
  { value: "all", label: "All Editions" },
  { value: "agency", label: "Agency OS" },
] as const

function mapStatus(status: EventStatus): { label: string; tone: EventRowView["statusTone"] } {
  switch (status) {
    case "live":
      return { label: "Live", tone: "critical" }
    case "confirmed":
      return { label: "Confirmed", tone: "info" }
    case "planning":
      return { label: "Planned", tone: "neutral" }
    case "draft":
      return { label: "Draft", tone: "neutral" }
    case "completed":
      return { label: "Completed", tone: "success" }
    case "cancelled":
      return { label: "Cancelled", tone: "neutral" }
    default:
      return { label: status, tone: "neutral" }
  }
}

function formatWhen(event: Event): string {
  if (!event.startDate) return event.location || "Schedule unset"
  const start = new Date(event.startDate)
  if (Number.isNaN(start.getTime())) return event.location || "Schedule unset"
  const now = new Date()
  const sameDay =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  const when = sameDay
    ? `Tonight · ${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
  const place = event.venue || event.location
  return place ? `${when} · ${place}` : when
}

function formatUpdated(event: Event): string {
  const raw = event.updatedAt || event.createdAt
  if (!raw) return "Agency OS record"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return "Agency OS record"
  return `Agency OS · updated ${d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`
}

/**
 * Freshness is about the data feed, not event lifecycle status.
 * Agency OS events have no edition sync / scanner feed fields — mark Unverified
 * rather than inventing Live/Delayed/Disconnected from status alone.
 */
function deriveFreshness(event: Event): DataFreshness {
  const meta = event.metadata
  const raw =
    typeof meta?.dataFreshness === "string"
      ? meta.dataFreshness
      : typeof meta?.freshness === "string"
        ? meta.freshness
        : null
  if (raw === "Live" || raw === "Delayed" || raw === "Disconnected" || raw === "Unverified") {
    return raw
  }
  return "Unverified"
}

function deriveSource(event: Event, freshness: DataFreshness): string {
  const meta = event.metadata
  if (typeof meta?.dataSource === "string" && meta.dataSource.trim()) return meta.dataSource.trim()
  if (typeof meta?.source === "string" && meta.source.trim()) return meta.source.trim()
  if (freshness === "Unverified" && event.expectedAttendees != null) {
    return `Agency OS · expected ${event.expectedAttendees.toLocaleString()} attendees · ${formatUpdated(event)}`
  }
  return formatUpdated(event)
}

function isUpcoming(event: Event): boolean {
  if (event.status === "live" || event.status === "completed" || event.status === "cancelled") {
    return false
  }
  if (!event.startDate) return ["planning", "confirmed", "draft"].includes(event.status)
  const start = new Date(event.startDate)
  if (Number.isNaN(start.getTime())) return true
  return start.getTime() >= Date.now() - 60 * 60 * 1000
}

function buildRow(event: Event): EventRowView {
  const status = mapStatus(event.status)
  const freshness = deriveFreshness(event)
  return {
    event,
    statusLabel: status.label,
    statusTone: status.tone,
    freshness,
    source: deriveSource(event, freshness),
    subtitle: formatWhen(event),
    editionLabel: "Agency OS",
  }
}

export function EventsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops")
  const [events, setEvents] = useState<Event[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [issuesLoading, setIssuesLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [issuesError, setIssuesError] = useState<string | null>(null)
  const [tab, setTab] = useState<MainTab>("events")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [editionFilter, setEditionFilter] = useState("all")
  const [createOpen, setCreateOpen] = useState(false)
  const [attendanceEvent, setAttendanceEvent] = useState<Event | null>(null)

  async function reloadEvents() {
    const response = await listEvents({ page: 1, limit: 100 })
    setEvents(response.data ?? [])
  }

  async function reloadIssues() {
    const response = await listAllIncidents()
    setIncidents(response.data ?? [])
    setIssuesError(null)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await reloadEvents()
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

  useEffect(() => {
    let cancelled = false
    async function loadIssues() {
      setIssuesLoading(true)
      setIssuesError(null)
      try {
        await reloadIssues()
      } catch (err) {
        if (!cancelled) {
          setIncidents([])
          setIssuesError(
            err instanceof ApiError ? err.message : "Failed to load issues",
          )
        }
      } finally {
        if (!cancelled) setIssuesLoading(false)
      }
    }
    void loadIssues()
    return () => {
      cancelled = true
    }
  }, [])

  async function retryIssues() {
    setIssuesLoading(true)
    setIssuesError(null)
    try {
      await reloadIssues()
    } catch (err) {
      setIncidents([])
      setIssuesError(
        err instanceof ApiError ? err.message : "Failed to load issues",
      )
    } finally {
      setIssuesLoading(false)
    }
  }

  const rows = useMemo(() => events.map(buildRow), [events])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (editionFilter === "agency" || editionFilter === "all") {
        // Only Agency OS records exist in this API.
      } else {
        return false
      }
      if (statusFilter === "live") return row.event.status === "live"
      if (statusFilter === "upcoming") return isUpcoming(row.event)
      return true
    })
  }, [rows, statusFilter, editionFilter])

  const openIssues = useMemo(
    () =>
      incidents.filter((incident) => {
        const status = (incident.status || "").toLowerCase()
        return status === "open" || status === "in_progress" || status === "escalated"
      }),
    [incidents],
  )

  const agencyLabel = user?.agencyName || "Workspace"

  return (
    <div className="cosmos-events-page">
      <div className="cosmos-events-page__head">
        <div>
          <p className="cosmos-events-page__eyebrow">
            {agencyLabel} · Workspace
          </p>
          <div className="cosmos-events-page__title-row">
            <h1>Events</h1>
            {canWrite ? (
              <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
                <PlusIcon className="size-3.5" />
                New event
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="cosmos-events-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="cosmos-events-tabs" role="tablist" aria-label="Events sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "events"}
          className={cn(tab === "events" && "is-active")}
          onClick={() => setTab("events")}
        >
          Events
          <span>{loading ? "…" : String(events.length)}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "issues"}
          className={cn(tab === "issues" && "is-active")}
          onClick={() => setTab("issues")}
        >
          Issues
          <span>
            {issuesLoading ? "…" : issuesError ? "!" : String(openIssues.length)}
          </span>
        </button>
      </div>

      {tab === "events" ? (
        <>
          <div className="cosmos-events-toolbar">
            <div className="cosmos-schedule-seg" role="tablist" aria-label="Event timing">
              {(
                [
                  ["all", "All"],
                  ["live", "Live"],
                  ["upcoming", "Upcoming"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === value}
                  className={cn(statusFilter === value && "is-active")}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <Select
              value={editionFilter}
              onChange={(e) => setEditionFilter(e.target.value)}
              aria-label="Filter by edition"
              className="cosmos-events-filter normal-case"
            >
              {EDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              value="all"
              aria-label="Filter by project"
              className="cosmos-events-filter normal-case"
              disabled
              title="Events are not linked to projects in the Agency OS schema yet"
            >
              <option value="all">All Projects</option>
            </Select>
          </div>

          <div className="cosmos-events-board">
            {loading ? (
              <div className="cosmos-events-board__loading">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : filteredRows.length === 0 ? (
              <EmptyState
                title="No events in this view"
                description={
                  statusFilter === "live"
                    ? "Nothing is live right now."
                    : statusFilter === "upcoming"
                      ? "No upcoming events match the current filters."
                      : "Create an event to populate this board."
                }
              />
            ) : (
              <table className="cosmos-events-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th>Source</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.event.eventId}>
                      <td>
                        <div className="cosmos-events-table__event">
                          <span className="cosmos-events-table__thumb" aria-hidden>
                            {(row.event.name || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <Link
                              to={`/events/${row.event.eventId}`}
                              className="cosmos-events-table__name"
                            >
                              {row.event.name}
                            </Link>
                            <p>
                              <span className="cosmos-events-table__edition">{row.editionLabel}</span>
                              {" · "}
                              {row.subtitle}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={cn("project-status-pill", `is-${row.statusTone}`)}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td>
                        <DataFreshnessPill value={row.freshness} />
                      </td>
                      <td>
                        <span className="cosmos-events-table__source" title={row.source}>
                          {row.source}
                        </span>
                      </td>
                      <td>
                        <div className="cosmos-events-table__actions">
                          <Button
                            size="sm"
                            variant="ghost"
                            render={<Link to={`/events/${row.event.eventId}`} />}
                          >
                            Open
                          </Button>
                          {canWrite ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAttendanceEvent(row.event)}
                            >
                              Update Attendance
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="cosmos-events-legend">
            {FRESHNESS_LEGEND.map((item) => (
              <div key={item.value} className="cosmos-events-legend__item">
                <DataFreshnessPill value={item.value} />
                <span>{item.description}</span>
              </div>
            ))}
          </div>

          <div className="cosmos-events-note">
            <LayersIcon className="size-3.5 shrink-0" />
            <p>
              Events come from Agency OS, Run of Show OS, Artist OS and later editions. Each edition
              owns its operational tools; this view shows authorized status, schedule, attendance and
              issues. Connected feeds and multi-edition freshness are not in the Agency OS API yet —
              records here are Agency OS and marked Unverified unless metadata supplies a freshness
              value.
            </p>
          </div>
        </>
      ) : (
        <div className="cosmos-events-board">
          {issuesLoading ? (
            <div className="cosmos-events-board__loading">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : issuesError ? (
            <div className="cosmos-events-issues-error">
              <p role="alert">{issuesError}</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void retryIssues()}>
                Retry
              </Button>
            </div>
          ) : openIssues.length === 0 ? (
            <EmptyState
              title="No open issues"
              description="Open and escalated incidents across events appear here."
            />
          ) : (
            <table className="cosmos-events-table cosmos-events-table--issues">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Event</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {openIssues.map((incident) => {
                  const event = events.find((e) => e.eventId === incident.eventId)
                  return (
                    <tr key={incident.incidentId}>
                      <td>
                        <p className="cosmos-events-table__name">
                          {incident.title || "Untitled issue"}
                        </p>
                        {incident.location ? (
                          <p className="cosmos-events-table__muted">{incident.location}</p>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={cn(
                            "project-status-pill",
                            incident.severity === "critical"
                              ? "is-critical"
                              : incident.severity === "warning"
                                ? "is-warning"
                                : "is-info",
                          )}
                        >
                          {incident.severity}
                        </span>
                      </td>
                      <td>
                        <span className="project-status-pill is-neutral">
                          {(incident.status || "open").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td>
                        <span className="cosmos-events-table__source">
                          {event?.name || incident.eventId}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          render={<Link to={`/events/${incident.eventId}`} />}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <CreateEventModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={async () => {
          await reloadEvents()
        }}
      />

      <UpdateAttendanceDialog
        open={Boolean(attendanceEvent)}
        onOpenChange={(open) => {
          if (!open) setAttendanceEvent(null)
        }}
        event={attendanceEvent}
        freshness={attendanceEvent ? deriveFreshness(attendanceEvent) : "Unverified"}
        feedNote={
          attendanceEvent
            ? `Agency OS has no live attendance feed for “${attendanceEvent.name}”. Manual audited updates are designed; the write API is not available yet.`
            : undefined
        }
      />
    </div>
  )
}
