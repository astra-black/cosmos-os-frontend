import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  MapPinIcon,
  RadioIcon,
  UsersIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getEvent,
  getEventAnalytics,
  getIncidentStats,
  listCrew,
  listCues,
  listIncidents,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { CrewMember, Cue, Event, EventAnalytics, Incident } from "@/types/agency"
import { cn } from "@/lib/utils"

type HubTab = "overview" | "cues" | "crew" | "incidents"

function formatWhen(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatTime(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function EventDetailPage() {
  const { eventId = "" } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null)
  const [openIncidents, setOpenIncidents] = useState(0)
  const [cues, setCues] = useState<Cue[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<HubTab>("overview")

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [eventRes, analyticsRes, statsRes, cuesRes, incidentsRes, crewRes] =
          await Promise.all([
            getEvent(eventId),
            getEventAnalytics(eventId).catch(() => null),
            getIncidentStats(eventId).catch(() => null),
            listCues(eventId).catch(() => null),
            listIncidents(eventId).catch(() => null),
            listCrew(eventId).catch(() => null),
          ])

        if (cancelled) return

        setEvent(eventRes.data)
        setAnalytics(analyticsRes?.data ?? null)
        setOpenIncidents(
          (statsRes?.data?.byStatus.open ?? 0) + (statsRes?.data?.byStatus.inProgress ?? 0),
        )
        setCues(cuesRes?.data ?? [])
        setIncidents(incidentsRes?.data ?? [])
        setCrew(crewRes?.data ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load event")
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

  const sortedCues = useMemo(
    () =>
      [...cues].sort(
        (a, b) =>
          new Date(a.scheduledTime || 0).getTime() - new Date(b.scheduledTime || 0).getTime(),
      ),
    [cues],
  )

  const liveCue = sortedCues.find((c) => c.status === "in_progress")
  const nextCue = sortedCues.find((c) => c.status === "pending")
  const doneCues = sortedCues.filter(
    (c) => c.status === "completed" || c.status === "skipped",
  ).length
  const cuePct = sortedCues.length
    ? Math.round((doneCues / sortedCues.length) * 100)
    : Number(analytics?.cues.completionRate ?? 0) || 0

  const criticalOpen = incidents.filter(
    (i) => i.severity === "critical" && i.status !== "resolved",
  ).length
  const onSite = crew.filter((c) => c.status === "on_site").length
  const opsQuery = eventId ? `?eventId=${encodeURIComponent(eventId)}` : ""

  const tabs: { id: HubTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "cues", label: "Cues", count: cues.length },
    { id: "crew", label: "Crew", count: crew.length },
    { id: "incidents", label: "Incidents", count: openIncidents },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit px-0"
          render={<Link to="/events" />}
        >
          <ArrowLeftIcon className="size-4" />
          Events
        </Button>

        {loading ? (
          <>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {event?.name ?? "Event"}
                </h1>
                {event?.status ? (
                  <Badge className="capitalize">{event.status}</Badge>
                ) : null}
                {criticalOpen > 0 ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangleIcon className="size-3" />
                    {criticalOpen} critical
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-mono text-xs">{eventId}</span>
                {event?.venue || event?.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3.5" />
                    {event?.venue || event?.location}
                  </span>
                ) : null}
              </p>
            </div>

            {/* Jump into live desks scoped to this event */}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" render={<Link to={`/cues${opsQuery}`} />}>
                <RadioIcon className="size-3.5" />
                Run sheet
              </Button>
              <Button size="sm" variant="outline" render={<Link to={`/crew${opsQuery}`} />}>
                <UsersIcon className="size-3.5" />
                Crew
              </Button>
              <Button
                size="sm"
                variant="outline"
                render={<Link to={`/incidents${opsQuery}`} />}
              >
                <AlertTriangleIcon className="size-3.5" />
                Triage
              </Button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            {
              label: "Cues complete",
              value: `${doneCues}/${sortedCues.length || analytics?.cues.total || 0}`,
              sub: `${Number.isFinite(cuePct) ? cuePct : 0}%`,
              icon: ClipboardListIcon,
            },
            {
              label: "Crew on site",
              value: String(onSite),
              sub: `${crew.length || analytics?.crew.total || 0} total`,
              icon: UsersIcon,
            },
            {
              label: "Open incidents",
              value: String(openIncidents),
              sub: criticalOpen ? `${criticalOpen} critical` : "queue",
              icon: AlertTriangleIcon,
              danger: openIncidents > 0,
            },
            {
              label: "Health",
              value: String(analytics?.overall.healthScore ?? "—"),
              sub: event?.status ?? "score",
              icon: RadioIcon,
            },
          ] as const
        ).map((k) => (
          <Card key={k.label} className="p-3 sm:p-4">
            <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium">
              <k.icon className="size-3.5" />
              {k.label}
            </div>
            <div
              className={cn(
                "mt-1 text-xl font-semibold tabular-nums sm:text-2xl",
                "danger" in k && k.danger && "text-destructive",
              )}
            >
              {loading ? "…" : k.value}
            </div>
            <div className="text-muted-foreground text-xs capitalize">{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Live now strip */}
      {!loading ? (
        <Card className="grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Now calling
            </div>
            {liveCue ? (
              <>
                <div className="mt-1 font-semibold leading-snug">{liveCue.name}</div>
                <div className="text-muted-foreground text-xs">
                  {formatTime(liveCue.scheduledTime)}
                  {liveCue.departmentName ? ` · ${liveCue.departmentName}` : ""}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mt-1 text-sm">No live cue</p>
            )}
          </div>
          <div className="border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              Next up
            </div>
            {nextCue ? (
              <>
                <div className="mt-1 font-medium leading-snug">{nextCue.name}</div>
                <div className="text-muted-foreground text-xs">
                  {formatTime(nextCue.scheduledTime)}
                  {nextCue.location ? ` · ${nextCue.location}` : ""}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mt-1 text-sm">End of run sheet</p>
            )}
          </div>
          <div className="flex flex-col justify-center gap-2 border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Run progress</span>
              <span className="tabular-nums font-medium">{cuePct}%</span>
            </div>
            <Progress value={cuePct} className="h-2" />
            <Button size="sm" className="mt-1" render={<Link to={`/cues${opsQuery}`} />}>
              Open show caller
              <ExternalLinkIcon className="size-3.5" />
            </Button>
          </div>
        </Card>
      ) : (
        <Skeleton className="h-28 w-full rounded-xl" />
      )}

      {/* Tabs */}
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count != null ? (
              <span className="tabular-nums opacity-70">{t.count}</span>
            ) : null}
          </Button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 sm:p-5">
            <h2 className="font-semibold">Event details</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Type</dt>
                <dd className="font-medium capitalize">{event?.type ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Venue</dt>
                <dd className="font-medium">{event?.venue ?? event?.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Start</dt>
                <dd className="font-medium">{formatWhen(event?.startDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">End</dt>
                <dd className="font-medium">{formatWhen(event?.endDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Expected attendees</dt>
                <dd className="font-medium tabular-nums">
                  {event?.expectedAttendees?.toLocaleString() ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Budget</dt>
                <dd className="font-medium tabular-nums">
                  {event?.budget != null ? `$${event.budget.toLocaleString()}` : "—"}
                </dd>
              </div>
              {event?.description ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground text-xs">Description</dt>
                  <dd className="mt-0.5 leading-relaxed">{event.description}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Ops snapshot</h2>
              <Button size="sm" variant="ghost" render={<Link to={`/analytics`} />}>
                Analytics
              </Button>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li className="bg-muted/40 flex justify-between rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Cue completion</span>
                <span className="font-medium tabular-nums">{cuePct}%</span>
              </li>
              <li className="bg-muted/40 flex justify-between rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Crew confirmed+</span>
                <span className="font-medium tabular-nums">
                  {crew.filter((c) =>
                    ["confirmed", "on_site", "complete"].includes(c.status),
                  ).length}
                  /{crew.length}
                </span>
              </li>
              <li className="bg-muted/40 flex justify-between rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Incidents resolved</span>
                <span className="font-medium tabular-nums">
                  {incidents.filter((i) => i.status === "resolved").length}/{incidents.length}
                </span>
              </li>
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                render={<Link to={`/cues${opsQuery}`} />}
              >
                Cues
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                render={<Link to={`/crew${opsQuery}`} />}
              >
                Crew
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                render={<Link to={`/incidents${opsQuery}`} />}
              >
                Incidents
              </Button>
            </div>
          </Card>
        </div>
      ) : tab === "cues" ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Run sheet</h2>
            <Button size="sm" render={<Link to={`/cues${opsQuery}`} />}>
              Open desk
            </Button>
          </div>
          {sortedCues.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">No cues for this event.</p>
          ) : (
            <ul className="divide-y">
              {sortedCues.map((cue) => (
                <li
                  key={cue.cueId}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm",
                    cue.status === "in_progress" && "bg-primary/5",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {cue.cueId}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-5 capitalize",
                          cue.status === "in_progress" && "bg-primary text-primary-foreground",
                          cue.status === "completed" && "opacity-70",
                        )}
                      >
                        {cue.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-0.5 font-medium">{cue.name || cue.title}</div>
                  </div>
                  <div className="text-muted-foreground text-xs tabular-nums">
                    {formatTime(cue.scheduledTime)}
                    {cue.duration != null ? ` · ${cue.duration}m` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : tab === "crew" ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Crew roster</h2>
            <Button size="sm" render={<Link to={`/crew${opsQuery}`} />}>
              Open board
            </Button>
          </div>
          {crew.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">No crew assigned.</p>
          ) : (
            <ul className="divide-y">
              {crew.map((m) => (
                <li
                  key={m.crewId}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{m.name || m.crewId}</div>
                    <div className="text-muted-foreground text-xs">
                      {m.role}
                      {m.departmentName ? ` · ${m.departmentName}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {m.status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Incidents</h2>
            <Button size="sm" render={<Link to={`/incidents${opsQuery}`} />}>
              Open triage
            </Button>
          </div>
          {incidents.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">No incidents logged.</p>
          ) : (
            <ul className="divide-y">
              {[...incidents]
                .sort((a, b) => {
                  const order = { critical: 0, warning: 1, info: 2 }
                  return (
                    (order[a.severity as keyof typeof order] ?? 9) -
                    (order[b.severity as keyof typeof order] ?? 9)
                  )
                })
                .map((inc) => (
                  <li
                    key={inc.incidentId}
                    className={cn(
                      "flex flex-wrap items-start justify-between gap-2 border-l-4 px-4 py-3 text-sm",
                      inc.severity === "critical" && "border-l-destructive",
                      inc.severity === "warning" && "border-l-chart-4",
                      inc.severity === "info" && "border-l-muted-foreground/40",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {inc.incidentId}
                        </span>
                        <Badge variant="outline" className="h-5 capitalize">
                          {inc.severity}
                        </Badge>
                        <Badge
                          className={cn(
                            "h-5 capitalize",
                            inc.status === "resolved"
                              ? "bg-chart-2/15"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {inc.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-0.5 font-medium">{inc.title}</div>
                      {inc.location ? (
                        <div className="text-muted-foreground text-xs">{inc.location}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
