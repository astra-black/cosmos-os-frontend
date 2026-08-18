import { useEffect, useState } from "react"

import { EventScopeBar } from "@/components/ops/event-scope-bar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useEventScope } from "@/hooks/use-event-scope"
import { getEventAnalytics } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { EventAnalytics } from "@/types/agency"
import { cn } from "@/lib/utils"

function Ring({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-24">
        <svg className="size-full -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            className="stroke-muted"
            strokeWidth="8"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            className="stroke-primary transition-all"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold tabular-nums">
          {Math.round(clamped)}
        </div>
      </div>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  )
}

function Meter({
  label,
  value,
  max,
  detail,
}: {
  label: string
  value: number
  max: number
  detail?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {value}/{max}
          {detail ? ` · ${detail}` : ""}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function AnalyticsPage() {
  const { events, eventId, setEventId, selectedEvent, loadingEvents } = useEventScope()
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await getEventAnalytics(eventId)
        if (!cancelled) setAnalytics(res.data ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load analytics")
          setAnalytics(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [eventId])

  const health = analytics?.overall.healthScore ?? 0
  const cueRate = Number(analytics?.cues.completionRate ?? 0)
  const crewReady =
    analytics?.crew.total && analytics.crew.total > 0
      ? ((analytics.crew.confirmed + analytics.crew.onSite) / analytics.crew.total) * 100
      : 0
  const incidentClear =
    analytics?.incidents.total && analytics.incidents.total > 0
      ? ((analytics.incidents.resolved || 0) / analytics.incidents.total) * 100
      : 100

  return (
    <div className="flex flex-col gap-5">
      <EventScopeBar
        title="Show analytics"
        events={events}
        eventId={eventId}
        onEventChange={setEventId}
        loading={loadingEvents}
        selectedEvent={selectedEvent}
        compact
        trailing={
          analytics ? (
            <Badge variant={analytics.overall.onTrack ? "default" : "destructive"}>
              {analytics.overall.onTrack ? "On track" : "At risk"}
            </Badge>
          ) : null
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {loading ? (
        <Skeleton className="h-80 w-full rounded-xl" />
      ) : !analytics ? (
        <div className="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
          No analytics for this event yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Score rings — show readiness at a glance */}
          <Card className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <Ring value={health} label="Health score" />
            <Ring value={Number.isFinite(cueRate) ? cueRate : 0} label="Cue completion" />
            <Ring value={crewReady} label="Crew readiness" />
            <Ring value={incidentClear} label="Incidents cleared" />
          </Card>

          {/* Domain breakdowns — meters, not duplicated stats cards */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="font-semibold">Cues</h2>
                <p className="text-muted-foreground text-xs">Run sheet execution</p>
              </div>
              <Meter
                label="Completed"
                value={analytics.cues.completed}
                max={analytics.cues.total || 1}
              />
              <Meter
                label="In progress"
                value={analytics.cues.inProgress}
                max={analytics.cues.total || 1}
              />
              <Meter
                label="Pending"
                value={analytics.cues.pending}
                max={analytics.cues.total || 1}
              />
            </Card>

            <Card className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="font-semibold">Crew</h2>
                <p className="text-muted-foreground text-xs">Staffing readiness</p>
              </div>
              <Meter
                label="Confirmed"
                value={analytics.crew.confirmed}
                max={analytics.crew.total || 1}
              />
              <Meter
                label="On site"
                value={analytics.crew.onSite}
                max={analytics.crew.total || 1}
              />
              <Meter
                label="Shift complete"
                value={analytics.crew.complete}
                max={analytics.crew.total || 1}
              />
            </Card>

            <Card className="flex flex-col gap-4 p-5">
              <div>
                <h2 className="font-semibold">Incidents</h2>
                <p className="text-muted-foreground text-xs">Pressure & clearance</p>
              </div>
              <Meter
                label="Open"
                value={analytics.incidents.open}
                max={analytics.incidents.total || 1}
              />
              <Meter
                label="Critical"
                value={analytics.incidents.critical}
                max={analytics.incidents.total || 1}
              />
              <Meter
                label="Resolved"
                value={analytics.incidents.resolved}
                max={analytics.incidents.total || 1}
              />
            </Card>
          </div>

          {/* Event context footer */}
          <Card className="text-muted-foreground grid gap-3 p-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide opacity-70">Event</div>
              <div className="text-foreground font-medium">{analytics.event.name}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide opacity-70">Status</div>
              <div className={cn("text-foreground font-medium capitalize")}>
                {analytics.event.status}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide opacity-70">Budget</div>
              <div className="text-foreground font-medium">
                {analytics.event.budget != null
                  ? `$${analytics.event.budget.toLocaleString()}`
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide opacity-70">Expected</div>
              <div className="text-foreground font-medium">
                {analytics.event.expectedAttendees ?? "—"} guests
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
