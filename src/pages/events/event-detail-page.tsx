import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClipboardListIcon,
  CoinsIcon,
  CopyIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  FlameIcon,
  KeyRoundIcon,
  Loader2Icon,
  LogInIcon,
  LogOutIcon,
  MapPinIcon,
  PercentIcon,
  QrCodeIcon,
  RadioIcon,
  ReceiptIcon,
  Share2Icon,
  ShieldAlertIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  Tv2Icon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  checkInCrew,
  checkOutCrew,
  getEvent,
  getEventAnalytics,
  getIncidentStats,
  listCrew,
  listCues,
  listIncidents,
  resolveIncident,
  updateKioskPin,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { CrewMember, Cue, Event, EventAnalytics, Incident } from "@/types/agency"
import { cn } from "@/lib/utils"

type HubTab = "overview" | "cues" | "crew" | "incidents" | "finance"

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

function getCrewHourlyRate(role?: string | null): number {
  if (!role) return 50
  const r = role.toLowerCase()
  if (r.includes("director") || r.includes("producer")) return 85
  if (r.includes("stage manager") || r.includes("caller")) return 75
  if (r.includes("audio") || r.includes("sound") || r.includes("foh")) return 65
  if (r.includes("lighting") || r.includes("video") || r.includes("v1") || r.includes("a1")) return 60
  if (r.includes("camera") || r.includes("broadcast")) return 55
  if (r.includes("ops") || r.includes("logistics")) return 45
  if (r.includes("runner") || r.includes("assist")) return 30
  return 50
}

export function EventDetailPage({ defaultTab }: { defaultTab?: HubTab } = {}) {
  const { eventId = "" } = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null)
  const [openIncidents, setOpenIncidents] = useState(0)
  const [cues, setCues] = useState<Cue[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<HubTab>(() => defaultTab || (window.location.pathname.endsWith("/finance") ? "finance" : "overview"))

  // Incident Resolution Modal state
  const [resolvingIncident, setResolvingIncident] = useState<Incident | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [resolutionCost, setResolutionCost] = useState("")
  const [resolvingBusy, setResolvingBusy] = useState(false)

  const handleOpenResolveModal = (inc: Incident) => {
    setResolvingIncident(inc)
    setResolutionNotes(inc.resolution || "")
    const cost = Number(inc.costImpact ?? inc.metadata?.costImpact)
    setResolutionCost(cost > 0 ? String(cost) : "")
  }

  const handleConfirmResolve = async () => {
    if (!resolvingIncident || !eventId || resolvingBusy) return
    if (!resolutionNotes.trim()) {
      toast.error("Resolution notes are required")
      return
    }

    setResolvingBusy(true)
    const costNum = resolutionCost ? Number(resolutionCost) : 0

    try {
      await resolveIncident(
        resolvingIncident.incidentId,
        resolutionNotes.trim(),
        eventId,
        costNum,
      )

      setIncidents((prev) =>
        prev.map((i) =>
          i.incidentId === resolvingIncident.incidentId
            ? {
                ...i,
                status: "resolved",
                resolution: resolutionNotes.trim(),
                resolvedAt: new Date().toISOString(),
                costImpact: costNum,
                metadata: { ...(i.metadata || {}), costImpact: costNum },
              }
            : i,
        ),
      )

      toast.success(`Incident ${resolvingIncident.incidentId} resolved`)
      setResolvingIncident(null)
      setResolutionNotes("")
      setResolutionCost("")
    } catch (err: any) {
      toast.error(err?.message || "Failed to resolve incident")
    } finally {
      setResolvingBusy(false)
    }
  }

  const [crewActionBusyId, setCrewActionBusyId] = useState<string | null>(null)

  const handleCheckInCrew = async (crewId: string) => {
    if (!eventId || crewActionBusyId) return
    setCrewActionBusyId(crewId)
    try {
      await checkInCrew(eventId, crewId)
      setCrew((prev) =>
        prev.map((c) =>
          c.crewId === crewId ? { ...c, status: "on_site", onSiteAt: new Date().toISOString() } : c
        )
      )
      toast.success("Crew member checked in on-site")
    } catch (err: any) {
      toast.error(err?.message || "Failed to check in crew")
    } finally {
      setCrewActionBusyId(null)
    }
  }

  const handleCheckOutCrew = async (crewId: string) => {
    if (!eventId || crewActionBusyId) return
    setCrewActionBusyId(crewId)
    try {
      await checkOutCrew(eventId, crewId)
      setCrew((prev) =>
        prev.map((c) =>
          c.crewId === crewId ? { ...c, status: "complete", completedAt: new Date().toISOString() } : c
        )
      )
      toast.success("Crew member checked out (time entry logged)")
    } catch (err: any) {
      toast.error(err?.message || "Failed to check out crew")
    } finally {
      setCrewActionBusyId(null)
    }
  }

  const [kioskModalOpen, setKioskModalOpen] = useState(false)
  const currentKioskPin = String(event?.metadata?.kioskPin || "1234").trim()
  const [editingPin, setEditingPin] = useState(currentKioskPin)
  const [pinUpdateBusy, setPinUpdateBusy] = useState(false)

  const handleCopyKioskLink = () => {
    if (typeof window === "undefined" || !eventId) return
    const url = `${window.location.origin}/events/${eventId}/checkin?pin=${currentKioskPin}`
    navigator.clipboard.writeText(url)
    toast.success("Kiosk check-in link copied with PIN embedded!", {
      description: url,
    })
  }

  const handleSaveKioskPin = async () => {
    if (!eventId || pinUpdateBusy) return
    if (!editingPin || editingPin.trim().length < 4) {
      toast.error("PIN must be at least 4 digits")
      return
    }

    setPinUpdateBusy(true)
    try {
      await updateKioskPin(eventId, editingPin.trim())
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              metadata: {
                ...(prev.metadata || {}),
                kioskPin: editingPin.trim(),
              },
            }
          : prev
      )
      toast.success(`Event Kiosk PIN updated to ${editingPin.trim()}`)
      setKioskModalOpen(false)
    } catch (err: any) {
      toast.error(err?.message || "Failed to update kiosk PIN")
    } finally {
      setPinUpdateBusy(false)
    }
  }

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

  const eventBudget = Number(event?.budget || 0)
  const eventActualCost = Number(event?.actualCost || 0)
  const eventShortfall = Math.max(0, eventBudget - eventActualCost)
  const eventSpendPct =
    eventBudget > 0 ? Math.min(100, Math.round((eventActualCost / eventBudget) * 100)) : 0

  const daysUntilEvent = useMemo(() => {
    if (!event?.startDate) return null
    const startMs = new Date(event.startDate).getTime()
    if (isNaN(startMs)) return null
    return Math.ceil((startMs - Date.now()) / (1000 * 60 * 60 * 24))
  }, [event?.startDate])

  const is14DayAttritionAlert = useMemo(() => {
    return (
      daysUntilEvent !== null &&
      daysUntilEvent >= 0 &&
      daysUntilEvent <= 14 &&
      eventBudget > 0 &&
      eventActualCost < eventBudget
    )
  }, [daysUntilEvent, eventBudget, eventActualCost])

  // 3.2 Event Settlement & Margin Pacing Metrics
  const contractRevenue = eventBudget
  const vendorCommitments = Math.round(contractRevenue * 0.42)
  const crewPayrollEstimated = useMemo(() => {
    return crew.reduce((acc, c) => acc + 8 * getCrewHourlyRate(c.role), 0)
  }, [crew])

  // Dynamically sum all resolved incidents' costImpact and factor active/unresolved baseline
  const resolvedIncidentsCost = useMemo(() => {
    return incidents
      .filter((i) => i.status === "resolved")
      .reduce((sum, inc) => {
        const directCost = Number(inc.costImpact ?? inc.metadata?.costImpact ?? 0)
        return sum + (isNaN(directCost) ? 0 : directCost)
      }, 0)
  }, [incidents])

  const totalIncidentsCost = useMemo(() => {
    return incidents.reduce((sum, inc) => {
      const directCost = Number(inc.costImpact ?? inc.metadata?.costImpact ?? 0)
      return sum + (isNaN(directCost) ? 0 : directCost)
    }, 0)
  }, [incidents])

  const activeIncidentsOverhead = openIncidents * 250
  const incidentOverhead = resolvedIncidentsCost > 0
    ? resolvedIncidentsCost + activeIncidentsOverhead
    : (totalIncidentsCost > 0 ? totalIncidentsCost : activeIncidentsOverhead)

  const totalCalculatedCosts = Math.max(
    eventActualCost,
    vendorCommitments + crewPayrollEstimated + incidentOverhead,
  )
  const projectedGrossProfit = contractRevenue - totalCalculatedCosts
  const projectedGrossMarginPct =
    contractRevenue > 0 ? Math.round((projectedGrossProfit / contractRevenue) * 100) : 0

  const timelinePacing = useMemo(() => {
    if (!event?.startDate || !event?.endDate) return { elapsedPct: 0, hasSchedule: false, status: "unscheduled" }
    const start = new Date(event.startDate).getTime()
    const end = new Date(event.endDate).getTime()
    const now = Date.now()
    if (isNaN(start) || isNaN(end) || end <= start) return { elapsedPct: 0, hasSchedule: false, status: "unscheduled" }
    if (now < start) return { elapsedPct: 0, hasSchedule: true, status: "pre_event" }
    if (now > end) return { elapsedPct: 100, hasSchedule: true, status: "completed" }
    const pct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
    return { elapsedPct: pct, hasSchedule: true, status: "live" }
  }, [event?.startDate, event?.endDate])

  const spendBurnPct =
    contractRevenue > 0 ? Math.min(100, Math.round((totalCalculatedCosts / contractRevenue) * 100)) : 0

  const isBurnAccelerated =
    timelinePacing.hasSchedule &&
    timelinePacing.status === "live" &&
    spendBurnPct > timelinePacing.elapsedPct + 15

  const tabs: { id: HubTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "cues", label: "Cues", count: cues.length },
    { id: "crew", label: "Crew", count: crew.length },
    { id: "incidents", label: "Incidents", count: openIncidents },
    { id: "finance", label: "Finance & Margin" },
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
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                render={<Link to={`/events/${eventId}/stage`} target="_blank" rel="noopener noreferrer" />}
              >
                <Tv2Icon className="size-3.5" />
                Stage Monitor
              </Button>
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

          {/* Event Budget Commitments & Attrition Monitor */}
          <Card
            className={cn(
              "p-4 sm:p-5 lg:col-span-2 transition-all",
              is14DayAttritionAlert
                ? "border-destructive/40 bg-gradient-to-br from-card via-card to-destructive/[0.04] shadow-sm ring-1 ring-destructive/20"
                : "border-border/80",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-base sm:text-lg">Event Budget & Contract Minimum Monitor</h2>
                {is14DayAttritionAlert ? (
                  <Badge variant="destructive" className="gap-1 font-bold text-xs uppercase animate-pulse">
                    <ShieldAlertIcon className="size-3" />
                    14-Day Attrition Alert ({daysUntilEvent}d out)
                  </Badge>
                ) : eventBudget > 0 ? (
                  <Badge variant="secondary" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                    <CheckCircle2Icon className="size-3" />
                    Commitment Tracked
                  </Badge>
                ) : null}
              </div>

              <Button size="sm" variant="outline" render={<Link to="/finance" />}>
                Manage in Finance
                <ExternalLinkIcon className="size-3.5" />
              </Button>
            </div>

            {/* If 14-Day Attrition Alert is triggered */}
            {is14DayAttritionAlert && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                <AlertTriangleIcon className="size-5 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-sm">
                    Urgent: Event is {daysUntilEvent} day{daysUntilEvent === 1 ? "" : "s"} away with ${eventShortfall.toLocaleString()} unspent commitment!
                  </p>
                  <p className="mt-0.5 text-destructive/90">
                    Venue & hotel contract penalty deadlines typically enforce minimum spend 14 days prior to event start. Review actual expenditures or credit vendor add-ons to prevent unfulfilled shortfall penalties.
                  </p>
                </div>
              </div>
            )}

            {/* Progress & Financial Breakdown */}
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground font-sans">Spend vs Contracted Minimum</span>
                <span className="font-bold tabular-nums">
                  ${eventActualCost.toLocaleString()} of ${eventBudget.toLocaleString()} ({eventSpendPct}%)
                </span>
              </div>
              <Progress
                value={eventSpendPct}
                className={cn(
                  "h-2.5",
                  is14DayAttritionAlert ? "[&>div]:bg-destructive" : "[&>div]:bg-primary",
                )}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-xs">
              <div className="rounded-lg bg-muted/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase font-sans">Committed Budget</div>
                <div className="text-base font-bold tabular-nums mt-0.5">
                  {eventBudget > 0 ? `$${eventBudget.toLocaleString()}` : "Not set"}
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase font-sans">Actual Incurred</div>
                <div className="text-base font-bold tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
                  ${eventActualCost.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase font-sans">Remaining Shortfall</div>
                <div className={cn(
                  "text-base font-bold tabular-nums mt-0.5",
                  eventShortfall > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                )}>
                  {eventShortfall > 0 ? `$${eventShortfall.toLocaleString()}` : "$0 (Covered)"}
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase font-sans">Event Kickoff</div>
                <div className="text-base font-bold tabular-nums mt-0.5">
                  {daysUntilEvent !== null
                    ? daysUntilEvent > 0
                      ? `In ${daysUntilEvent} days`
                      : daysUntilEvent === 0
                        ? "Today"
                        : `${Math.abs(daysUntilEvent)}d ago`
                    : "—"}
                </div>
              </div>
            </div>
          </Card>

          {/* Event Profitability & Gross Margin Pacing Card */}
          <Card className="p-4 sm:p-5 lg:col-span-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.03] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-base sm:text-lg">Event Settlement & Margin Pacing</h2>
                  {projectedGrossMarginPct >= 25 ? (
                    <Badge variant="secondary" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                      <TrendingUpIcon className="size-3" />
                      {projectedGrossMarginPct}% Protected Margin
                    </Badge>
                  ) : projectedGrossMarginPct >= 10 ? (
                    <Badge variant="secondary" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs font-semibold">
                      <CoinsIcon className="size-3" />
                      {projectedGrossMarginPct}% Target Margin
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-xs font-semibold">
                      <TrendingDownIcon className="size-3" />
                      {projectedGrossMarginPct}% Margin Compression
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Consolidated event settlement comparing client contract value vs vendor commitments and crew payroll.
                </p>
              </div>

              <Button size="sm" onClick={() => setTab("finance")} className="gap-1.5">
                <WalletIcon className="size-3.5" />
                Open Settlement Desk
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono text-xs">
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-[11px] text-muted-foreground uppercase font-sans font-medium">Contract Value</div>
                <div className="text-lg font-bold tabular-nums mt-1 text-foreground">
                  ${contractRevenue.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground font-sans mt-0.5">Client revenue</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-[11px] text-muted-foreground uppercase font-sans font-medium">Vendor Commitments</div>
                <div className="text-lg font-bold tabular-nums mt-1 text-amber-600 dark:text-amber-400">
                  ${vendorCommitments.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground font-sans mt-0.5">Venue & AV floors</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-[11px] text-muted-foreground uppercase font-sans font-medium">Crew Payroll</div>
                <div className="text-lg font-bold tabular-nums mt-1 text-blue-600 dark:text-blue-400">
                  ${crewPayrollEstimated.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground font-sans mt-0.5">{crew.length} rostered staff</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-[11px] text-muted-foreground uppercase font-sans font-medium">Projected Margin</div>
                <div className={cn(
                  "text-lg font-bold tabular-nums mt-1",
                  projectedGrossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}>
                  ${projectedGrossProfit.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground font-sans mt-0.5">{projectedGrossMarginPct}% net margin</div>
              </div>
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
          <div className="flex flex-wrap items-center justify-between border-b px-4 py-3 gap-2">
            <div>
              <h2 className="font-semibold">Crew roster & presence</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {crew.filter((c) => c.status === "on_site").length} of {crew.length} on-site · Real-time check-in time tracking
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingPin(currentKioskPin)
                  setKioskModalOpen(true)
                }}
                className="gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
              >
                <KeyRoundIcon className="size-3.5" />
                PIN & Share: {currentKioskPin}
              </Button>
              <Button size="sm" variant="outline" render={<Link to={`/events/${eventId}/crew-kiosk`} target="_blank" />} className="gap-1.5">
                <QrCodeIcon className="size-3.5 text-primary" />
                Check-in Kiosk
              </Button>
              <Button size="sm" variant="ghost" render={<Link to={`/crew${opsQuery}`} />}>
                Open board
              </Button>
            </div>
          </div>
          {crew.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">No crew assigned to this event.</p>
          ) : (
            <ul className="divide-y">
              {crew.map((m) => (
                <li
                  key={m.crewId}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm transition-colors",
                    m.status === "on_site" && "bg-emerald-500/[0.03]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-bold",
                      m.status === "on_site"
                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : m.status === "complete"
                        ? "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {m.name ? m.name.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {m.name || m.crewId}
                        {m.status === "on_site" ? (
                          <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                        ) : null}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {m.role || "Crew"}
                        {m.departmentName ? ` · ${m.departmentName}` : ""}
                        {m.onSiteAt ? ` · In: ${formatTime(m.onSiteAt)}` : ""}
                        {m.completedAt ? ` · Out: ${formatTime(m.completedAt)}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize text-[11px]",
                        m.status === "on_site" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-semibold",
                        m.status === "complete" && "border-blue-500/40 text-blue-500 bg-blue-500/10",
                      )}
                    >
                      {m.status.replace("_", " ")}
                    </Badge>

                    {m.status === "on_site" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckOutCrew(m.crewId)}
                        disabled={crewActionBusyId === m.crewId}
                        className="h-7 text-xs border-blue-500/30 text-blue-500 hover:bg-blue-500/10 gap-1 font-medium"
                      >
                        {crewActionBusyId === m.crewId ? (
                          <Loader2Icon className="size-3 animate-spin" />
                        ) : (
                          <LogOutIcon className="size-3" />
                        )}
                        Check Out
                      </Button>
                    ) : m.status !== "complete" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckInCrew(m.crewId)}
                        disabled={crewActionBusyId === m.crewId}
                        className="h-7 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 font-medium"
                      >
                        {crewActionBusyId === m.crewId ? (
                          <Loader2Icon className="size-3 animate-spin" />
                        ) : (
                          <LogInIcon className="size-3" />
                        )}
                        Check In
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground font-mono px-2">✓ Logged</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : tab === "incidents" ? (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between border-b px-4 py-3 gap-2">
            <div>
              <h2 className="font-semibold">Incidents & triage</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {openIncidents} active incident{openIncidents === 1 ? "" : "s"} · {incidentOverhead > 0 ? `$${incidentOverhead.toLocaleString()} financial cost impact` : "No financial overhead"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" render={<Link to={`/events/${eventId}/stage`} target="_blank" />} className="gap-1.5">
                <RadioIcon className="size-3.5 text-rose-500" />
                Stage Hotbar
              </Button>
              <Button size="sm" variant="ghost" render={<Link to={`/incidents${opsQuery}`} />}>
                Open triage
              </Button>
            </div>
          </div>
          {incidents.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">No incidents logged for this event.</p>
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
                .map((inc) => {
                  const cost = Number(inc.costImpact ?? inc.metadata?.costImpact) || 0
                  return (
                    <li
                      key={inc.incidentId}
                      className={cn(
                        "flex flex-wrap items-start justify-between gap-3 border-l-4 px-4 py-3 text-sm transition-colors",
                        inc.severity === "critical" && "border-l-destructive bg-destructive/[0.02]",
                        inc.severity === "warning" && "border-l-amber-500 bg-amber-500/[0.02]",
                        inc.severity === "info" && "border-l-muted-foreground/40",
                      )}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground font-mono text-[11px]">
                            {inc.incidentId}
                          </span>
                          <Badge
                            variant={inc.severity === "critical" ? "destructive" : "outline"}
                            className="h-5 capitalize text-[11px]"
                          >
                            {inc.severity}
                          </Badge>
                          <Badge
                            className={cn(
                              "h-5 capitalize text-[11px]",
                              inc.status === "resolved"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {inc.status.replace("_", " ")}
                          </Badge>
                          {cost > 0 ? (
                            <Badge variant="secondary" className="h-5 text-[11px] text-destructive bg-destructive/10 border-destructive/20 font-mono font-semibold">
                              -${cost.toLocaleString()} Cost Impact
                            </Badge>
                          ) : null}
                        </div>
                        <div className="font-medium text-foreground">{inc.title}</div>
                        {inc.description ? (
                          <p className="text-xs text-muted-foreground">{inc.description}</p>
                        ) : null}
                        {inc.resolution ? (
                          <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground mt-1.5 border">
                            <span className="font-semibold text-foreground">Resolution: </span>
                            {inc.resolution}
                          </div>
                        ) : null}
                        <div className="text-muted-foreground text-xs flex flex-wrap gap-2 pt-0.5">
                          {inc.departmentName ? <span>Dept: {inc.departmentName}</span> : null}
                          {inc.location ? <span>Loc: {inc.location}</span> : null}
                          <span>Reported: {formatWhen(inc.reportedAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-center">
                        {inc.status !== "resolved" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResolveModal(inc)}
                            className="h-7 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 font-medium"
                          >
                            <CheckCircle2Icon className="size-3" />
                            Resolve
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                            Resolved
                          </Badge>
                        )}
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </Card>
      ) : (
        /* Finance & Margin Settlement Tab */
        <div className="flex flex-col gap-5">
          {/* Executive Margin & Settlement Header Card */}
          <Card className="flex flex-col gap-4 p-4 sm:p-6 border-primary/30 bg-gradient-to-br from-card via-card to-primary/[0.03] shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight">Event Settlement & Margin Calculator</h2>
                  {projectedGrossMarginPct >= 25 ? (
                    <Badge variant="secondary" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-xs font-semibold">
                      <TrendingUpIcon className="size-3" />
                      {projectedGrossMarginPct}% Protected Margin
                    </Badge>
                  ) : projectedGrossMarginPct >= 10 ? (
                    <Badge variant="secondary" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs font-semibold">
                      <CoinsIcon className="size-3" />
                      {projectedGrossMarginPct}% Target Margin
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1 text-xs font-semibold">
                      <TrendingDownIcon className="size-3" />
                      {projectedGrossMarginPct}% Margin Compression
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                  Reconcile incoming client contract value against vendor minimum commitments, crew shift payroll, and operational burn.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" render={<Link to="/finance" />} className="gap-1.5">
                  <ExternalLinkIcon className="size-3.5" />
                  Agency Finance Desk
                </Button>
              </div>
            </div>

            {/* Financial Reconciliation Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border bg-muted/20 p-3.5">
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <DollarSignIcon className="size-3.5 text-emerald-500" />
                  Contract Value (Revenue)
                </div>
                <div className="text-xl sm:text-2xl font-black tabular-nums mt-1">
                  ${contractRevenue.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Gross client billing
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3.5">
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <ReceiptIcon className="size-3.5 text-amber-500" />
                  Vendor Commitments
                </div>
                <div className="text-xl sm:text-2xl font-black tabular-nums mt-1 text-amber-600 dark:text-amber-400">
                  ${vendorCommitments.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Venue, AV, staging minimums
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3.5">
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <UsersIcon className="size-3.5 text-blue-500" />
                  Crew Payroll Costs
                </div>
                <div className="text-xl sm:text-2xl font-black tabular-nums mt-1 text-blue-600 dark:text-blue-400">
                  ${crewPayrollEstimated.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {crew.length} rostered call shifts
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3.5">
                <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                  <PercentIcon className="size-3.5 text-primary" />
                  Projected Net Margin
                </div>
                <div className={cn(
                  "text-xl sm:text-2xl font-black tabular-nums mt-1",
                  projectedGrossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                )}>
                  ${projectedGrossProfit.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {projectedGrossMarginPct}% retained margin
                </div>
              </div>
            </div>

            {/* Real-Time Burn & Pacing Meter */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FlameIcon className={cn("size-4", isBurnAccelerated ? "text-destructive" : "text-amber-500")} />
                  <span className="font-semibold text-sm">Real-Time Burn Tracking & Pacing</span>
                  {isBurnAccelerated ? (
                    <Badge variant="destructive" className="text-[10px] font-bold uppercase">
                      ⚠️ Accelerated Burn Rate
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-medium">
                      Pacing on schedule
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Burn: <span className="font-bold text-foreground">${totalCalculatedCosts.toLocaleString()}</span> ({spendBurnPct}%) · Timeline: <span className="font-bold text-foreground">{timelinePacing.elapsedPct}%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Financial Burn Rate (${totalCalculatedCosts.toLocaleString()} / ${contractRevenue.toLocaleString()})</span>
                  <span className="font-bold tabular-nums text-foreground">{spendBurnPct}%</span>
                </div>
                <Progress
                  value={spendBurnPct}
                  className={cn("h-2.5", isBurnAccelerated ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")}
                />
              </div>

              {timelinePacing.hasSchedule ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Show Schedule Progress</span>
                    <span className="font-bold tabular-nums text-foreground">{timelinePacing.elapsedPct}%</span>
                  </div>
                  <Progress value={timelinePacing.elapsedPct} className="h-1.5 [&>div]:bg-emerald-500" />
                </div>
              ) : null}
            </div>

            {/* Itemized Settlement Statement Table */}
            <div className="rounded-xl border overflow-hidden">
              <div className="bg-muted/40 px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold text-sm">Itemized Settlement Statement</div>
                <Badge variant="outline" className="text-xs">
                  {event?.status === "completed" ? "Settled" : "Draft Pacing"}
                </Badge>
              </div>
              <div className="divide-y text-sm">
                <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      INFLOW
                    </Badge>
                    <div>
                      <div className="font-medium">Client Contract Value</div>
                      <div className="text-xs text-muted-foreground">Primary event production agreement</div>
                    </div>
                  </div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +${contractRevenue.toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                      OUTFLOW
                    </Badge>
                    <div>
                      <div className="font-medium">Venue & Hall Minimum Commitment</div>
                      <div className="text-xs text-muted-foreground">Space rental, power drop, and facility deposit</div>
                    </div>
                  </div>
                  <div className="font-bold text-foreground tabular-nums">
                    -${Math.round(contractRevenue * 0.25).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                      OUTFLOW
                    </Badge>
                    <div>
                      <div className="font-medium">Production, AV & Staging Minimums</div>
                      <div className="text-xs text-muted-foreground">Audio rigging, video walls, lighting consoles</div>
                    </div>
                  </div>
                  <div className="font-bold text-foreground tabular-nums">
                    -${Math.round(contractRevenue * 0.17).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-xs">
                      OUTFLOW
                    </Badge>
                    <div>
                      <div className="font-medium">Direct Crew Payroll & Day Rates</div>
                      <div className="text-xs text-muted-foreground">{crew.length} rostered staff shifts on site</div>
                    </div>
                  </div>
                  <div className="font-bold text-foreground tabular-nums">
                    -${crewPayrollEstimated.toLocaleString()}
                  </div>
                </div>

                {incidentOverhead > 0 ? (
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Badge variant="secondary" className="bg-destructive/10 text-destructive font-semibold text-xs">
                        OUTFLOW
                      </Badge>
                      <div>
                        <div className="font-medium">Incident & Remediation Overhead</div>
                        <div className="text-xs text-muted-foreground">{openIncidents} active/escalated incidents</div>
                      </div>
                    </div>
                    <div className="font-bold text-destructive tabular-nums">
                      -${incidentOverhead.toLocaleString()}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between px-4 py-3.5 bg-muted/30 font-bold border-t">
                  <div className="text-base">Net Retained Margin & Settlement Profit</div>
                  <div className={cn(
                    "text-lg tabular-nums font-black",
                    projectedGrossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                  )}>
                    ${projectedGrossProfit.toLocaleString()} ({projectedGrossMarginPct}%)
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Resolve Incident Dialog */}
      <Dialog
        open={!!resolvingIncident}
        onOpenChange={(open) => {
          if (!open) {
            setResolvingIncident(null)
            setResolutionNotes("")
            setResolutionCost("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-emerald-500" />
              Resolve Incident
            </DialogTitle>
            <DialogDescription>
              Record the operational resolution and any financial cost impact incurred for this incident.
            </DialogDescription>
          </DialogHeader>

          {resolvingIncident ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm border">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{resolvingIncident.incidentId}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {resolvingIncident.severity}
                  </Badge>
                </div>
                <div className="font-medium text-foreground">{resolvingIncident.title}</div>
                {resolvingIncident.location ? (
                  <div className="text-xs text-muted-foreground">Location: {resolvingIncident.location}</div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution-notes" className="text-xs font-semibold">
                  Resolution Summary <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="resolution-notes"
                  placeholder="e.g. Swapped wireless receiver to backup channel B. Audio restored."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution-cost" className="text-xs font-semibold">
                  Financial Cost Impact ($ USD)
                </Label>
                <div className="relative">
                  <DollarSignIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="resolution-cost"
                    type="number"
                    min="0"
                    step="50"
                    placeholder="0.00"
                    value={resolutionCost}
                    onChange={(e) => setResolutionCost(e.target.value)}
                    className="pl-8 text-sm tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Incurred equipment replacement, overtime, or expedite fees will be deducted from net retained margin.
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResolvingIncident(null)}
              disabled={resolvingBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmResolve}
              disabled={resolvingBusy || !resolutionNotes.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {resolvingBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckCircle2Icon className="size-3.5" />}
              Resolve & Update Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kiosk PIN & Mobile Check-in Sharing Dialog */}
      <Dialog open={kioskModalOpen} onOpenChange={setKioskModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRoundIcon className="size-5 text-amber-500" />
              Event Kiosk PIN & Freelancer Self-Serve
            </DialogTitle>
            <DialogDescription>
              Share this direct link or 4-digit PIN for venue tablets and freelance crew check-ins on mobile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Direct Mobile Link */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Direct Self-Serve Check-in Link (PIN Embedded)</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/events/${eventId}/checkin?pin=${currentKioskPin}` : ""}
                  className="text-xs font-mono bg-muted select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyKioskLink}
                  className="gap-1.5 shrink-0"
                >
                  <CopyIcon className="size-3.5" />
                  Copy
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Opening this link on mobile phones or iPads automatically unlocks the check-in roster.
              </p>
            </div>

            {/* PIN Editor */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">4-Digit Event PIN Gate</div>
                  <div className="text-xs text-muted-foreground">Used to access the kiosk if URL PIN is omitted</div>
                </div>
                <Badge variant="secondary" className="font-mono text-base font-bold px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {currentKioskPin}
                </Badge>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="New 4-digit PIN"
                  value={editingPin}
                  onChange={(e) => setEditingPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-sm font-mono tracking-widest tabular-nums w-40"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveKioskPin}
                  disabled={pinUpdateBusy || editingPin === currentKioskPin || editingPin.length < 4}
                  className="text-xs"
                >
                  {pinUpdateBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : "Update PIN"}
                </Button>
              </div>
            </div>

            {/* Instructions box */}
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2Icon className="size-3.5" />
                Venue Tablet & Mobile QR Posters
              </div>
              <p className="text-[11px] opacity-90">
                You can print or project the check-in QR code at the front-desk station. Freelance staff scan and tap their name to check in, automatically starting their time-tracking clock.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setKioskModalOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              render={<Link to={`/events/${eventId}/checkin?pin=${currentKioskPin}`} target="_blank" />}
              className="bg-primary text-primary-foreground gap-1.5"
            >
              <ExternalLinkIcon className="size-3.5" />
              Open Live Kiosk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
