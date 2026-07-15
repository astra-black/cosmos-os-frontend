import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  FolderKanbanIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EventHealthCard } from "@/components/widgets/event-health-card"
import { EventOpsMetricsCard } from "@/components/widgets/event-ops-metrics-card"
import { EventsDatatable } from "@/components/widgets/events-datatable"
import { PortfolioSummaryCard } from "@/components/widgets/portfolio-summary-card"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import {
  getEventAnalytics,
  getIncidentStats,
  listEvents,
  listProjects,
  normalizeProjects,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Event, EventAnalytics } from "@/types/agency"

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--chart-3)",
  planning: "var(--chart-2)",
  confirmed: "var(--chart-4)",
  live: "var(--chart-1)",
  completed: "var(--chart-5)",
  cancelled: "var(--muted-foreground)",
}

function pickFeaturedEvent(events: Event[]) {
  return (
    events.find((event) => event.status === "live") ||
    events.find((event) => event.status === "confirmed") ||
    events[0]
  )
}

export function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [projectCount, setProjectCount] = useState(0)
  const [openIncidents, setOpenIncidents] = useState(0)
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [eventsRes, projectsRes] = await Promise.all([
          listEvents({ page: 1, limit: 50 }),
          listProjects(),
        ])

        if (cancelled) return

        const nextEvents = eventsRes.data ?? []
        setEvents(nextEvents)
        setProjectCount(normalizeProjects(projectsRes).length)

        const featured = pickFeaturedEvent(nextEvents)
        if (featured?.eventId) {
          const [statsRes, analyticsRes] = await Promise.all([
            getIncidentStats(featured.eventId).catch(() => null),
            getEventAnalytics(featured.eventId).catch(() => null),
          ])
          if (cancelled) return
          setOpenIncidents(
            (statsRes?.data?.byStatus.open ?? 0) +
              (statsRes?.data?.byStatus.inProgress ?? 0),
          )
          setAnalytics(analyticsRes?.data ?? null)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const activeEvents = events.filter((event) =>
    ["live", "confirmed", "planning"].includes(event.status),
  ).length

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

  const planPercentage =
    events.length === 0 ? 0 : Math.round((activeEvents / events.length) * 100)

  const featured = pickFeaturedEvent(events)
  const cueRate = Number(analytics?.cues.completionRate ?? 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Operations dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Live view across events, projects, and incident load from Cosmos middleware.
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">
          {error}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        <div className="col-span-full grid gap-6 sm:grid-cols-3 md:max-lg:grid-cols-1">
          {loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <StatisticsCard
                icon={<CalendarDaysIcon className="size-4" />}
                value={String(activeEvents)}
                title="Active events"
                changePercentage={`${events.length} total`}
              />
              <StatisticsCard
                icon={<FolderKanbanIcon className="size-4" />}
                value={String(projectCount)}
                title="Projects"
                changePercentage={projectCount === 0 ? "stub/empty API" : "from agency API"}
              />
              <StatisticsCard
                icon={<AlertTriangleIcon className="size-4" />}
                value={String(openIncidents)}
                title="Open incidents"
                changePercentage={featured ? featured.name : "no featured event"}
              />
            </>
          )}
        </div>

        <div className="grid gap-6 max-xl:col-span-full lg:max-xl:grid-cols-2">
          <EventHealthCard
            className="justify-between gap-3 *:data-[slot=card-content]:gap-5"
            loading={loading}
            eventName={featured?.name}
            updatedLabel={featured ? featured.status : "n/a"}
            healthScore={analytics?.overall.healthScore ?? 0}
            cueCompletionRate={Number.isFinite(cueRate) ? cueRate : 0}
            openIncidents={openIncidents}
          />
          <PortfolioSummaryCard
            className="justify-between gap-5 sm:min-w-0"
            loading={loading}
            title="Delivery mix"
            headlineValue={String(events.length)}
            trend="up"
            percentage={planPercentage}
            comparisonText="Share of events in active pipeline"
            items={[
              {
                key: "events",
                label: "Events",
                detail: "Agency calendar",
                value: String(events.length),
                progressPercentage: Math.min(events.length * 10, 100),
              },
              {
                key: "projects",
                label: "Projects",
                detail: "Campaign delivery",
                value: String(projectCount),
                progressPercentage: Math.min(projectCount * 10, 100),
              },
              {
                key: "incidents",
                label: "Open incidents",
                detail: featured?.eventId ?? "—",
                value: String(openIncidents),
                progressPercentage: Math.min(openIncidents * 15, 100),
              },
            ]}
          />
        </div>

        <EventOpsMetricsCard
          className="col-span-full *:data-[slot=card-content]:gap-6 xl:col-span-2"
          loading={loading}
          planPercentage={planPercentage}
          metrics={[
            { title: "Events", value: String(events.length), icon: "events" },
            { title: "Projects", value: String(projectCount), icon: "projects" },
            { title: "Open incidents", value: String(openIncidents), icon: "incidents" },
            {
              title: "Cue completion",
              value: `${Number.isFinite(cueRate) ? cueRate.toFixed(0) : 0}%`,
              icon: "cues",
            },
          ]}
          statusSlices={statusSlices}
        />

        <Card className="col-span-full w-full py-4">
          <div className="mb-4 px-4">
            <h2 className="text-lg font-semibold">Recent events</h2>
            <p className="text-muted-foreground text-sm">
              Sourced from `GET /api/v1/agency/events`
            </p>
          </div>
          {loading ? (
            <div className="px-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="px-4">
              <EventsDatatable data={events} />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
