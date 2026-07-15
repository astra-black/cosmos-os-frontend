import { useEffect, useMemo, useState } from "react"
import {
  ArchiveIcon,
  CheckCircle2Icon,
  FolderKanbanIcon,
  LoaderIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PortfolioSummaryCard } from "@/components/widgets/portfolio-summary-card"
import { ProjectsDatatable } from "@/components/widgets/projects-datatable"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import { listProjects, normalizeProjects } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Project } from "@/types/agency"

const ACTIVE_STATUSES = new Set(["InProgress", "Review", "NotStarted"])

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const response = await listProjects()
        if (cancelled) return
        setProjects(normalizeProjects(response))
        setMessage(response.message ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load projects")
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

  const inProgress = projects.filter((p) => p.status === "InProgress").length
  const inReview = projects.filter((p) => p.status === "Review").length
  const approved = projects.filter((p) => p.status === "Approved").length
  const archived = projects.filter((p) => p.status === "Archived").length
  const active = projects.filter((p) => ACTIVE_STATUSES.has(p.status)).length
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0)
  const activeShare =
    projects.length === 0 ? 0 : Math.round((active / projects.length) * 100)

  const campaignLines = useMemo(() => {
    const byCampaign = new Map<string, { count: number; budget: number }>()
    for (const project of projects) {
      const key = project.campaignId || "Unassigned"
      const prev = byCampaign.get(key) ?? { count: 0, budget: 0 }
      byCampaign.set(key, {
        count: prev.count + 1,
        budget: prev.budget + (project.budget ?? 0),
      })
    }
    return [...byCampaign.entries()]
      .sort((a, b) => b[1].budget - a[1].budget)
      .slice(0, 4)
      .map(([campaign, stats]) => ({
        key: campaign,
        label: campaign,
        detail: `${stats.count} project${stats.count === 1 ? "" : "s"}`,
        value: stats.budget > 0 ? `$${Math.round(stats.budget / 1000)}k` : "—",
        progressPercentage: Math.min(
          100,
          totalBudget > 0 ? Math.round((stats.budget / totalBudget) * 100) : stats.count * 20,
        ),
      }))
  }, [projects, totalBudget])

  const statusLines = useMemo(() => {
    const order = ["InProgress", "Review", "NotStarted", "Approved", "Archived"]
    const counts = new Map<string, number>()
    for (const project of projects) {
      counts.set(project.status, (counts.get(project.status) ?? 0) + 1)
    }
    const total = projects.length || 1
    return order
      .filter((status) => counts.has(status))
      .map((status) => {
        const count = counts.get(status) ?? 0
        return {
          key: status,
          label: status,
          detail: "delivery status",
          value: String(count),
          progressPercentage: Math.round((count / total) * 100),
        }
      })
  }, [projects])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-muted-foreground text-sm">
          Campaign delivery board — weight, budget, and status across the book of work.
        </p>
      </div>

      {message ? (
        <Card className="text-muted-foreground px-4 py-3 text-sm">{message}</Card>
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
                icon={<FolderKanbanIcon className="size-4" />}
                value={String(projects.length)}
                title="Projects"
                changePercentage={`${active} active`}
              />
              <StatisticsCard
                icon={<LoaderIcon className="size-4" />}
                value={String(inProgress)}
                title="In progress"
                changePercentage={`${inReview} in review`}
              />
              <StatisticsCard
                icon={<CheckCircle2Icon className="size-4" />}
                value={String(approved)}
                title="Approved"
                changePercentage={
                  totalBudget > 0 ? `$${Math.round(totalBudget / 1000)}k book` : "no budget"
                }
              />
              <StatisticsCard
                icon={<ArchiveIcon className="size-4" />}
                value={String(archived)}
                title="Archived"
                changePercentage={`${activeShare}% still active`}
              />
            </>
          )}
        </div>

        <PortfolioSummaryCard
          className="col-span-full justify-between gap-5 sm:min-w-0 lg:col-span-1"
          loading={loading}
          title="By campaign"
          headlineValue={
            totalBudget > 0 ? `$${Math.round(totalBudget / 1000)}k` : String(projects.length)
          }
          trend="up"
          percentage={activeShare}
          comparisonText="Active share of delivery book"
          items={campaignLines}
        />

        <PortfolioSummaryCard
          className="col-span-full justify-between gap-5 sm:min-w-0 lg:col-span-2"
          loading={loading}
          title="Delivery status mix"
          headlineValue={String(active)}
          trend={inProgress >= archived ? "up" : "down"}
          percentage={activeShare}
          comparisonText="Projects still moving through production"
          items={statusLines}
        />

        <Card className="col-span-full w-full py-4">
          <div className="mb-4 px-4">
            <h2 className="text-lg font-semibold">Project register</h2>
            <p className="text-muted-foreground text-sm">
              `GET /api/v1/agency/projects` · campaign delivery lines
            </p>
          </div>
          {loading ? (
            <div className="px-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <div className="px-4">
              <ProjectsDatatable data={projects} />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
