import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  BriefcaseIcon,
  Building2Icon,
  HeartPulseIcon,
  ImagesIcon,
  WalletIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getClientPortfolio, listPortfolioClients } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { ClientPortfolio, PortfolioClient } from "@/types/agency"
import { cn } from "@/lib/utils"

function money(n?: number) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

function healthTone(score: number) {
  if (score >= 85) return "text-chart-2"
  if (score >= 70) return "text-foreground"
  return "text-destructive"
}

function statusTone(status: string) {
  const s = status.toLowerCase()
  if (s.includes("progress") || s === "inprogress") return "bg-primary/10 text-primary"
  if (s.includes("review")) return "bg-chart-4/20"
  if (s.includes("approv") || s === "done") return "bg-chart-2/15"
  if (s.includes("archiv")) return "bg-muted text-muted-foreground"
  return "bg-muted"
}

export function PortfolioPage() {
  const [clients, setClients] = useState<PortfolioClient[]>([])
  const [clientId, setClientId] = useState("")
  const [portfolio, setPortfolio] = useState<ClientPortfolio | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await listPortfolioClients()
        if (cancelled) return
        const list = res.data ?? []
        setClients(list)
        setMessage(res.message ?? null)
        if (list[0]) setClientId(list[0].clientId)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load clients")
        }
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    async function load() {
      setLoadingDetail(true)
      setError(null)
      try {
        const res = await getClientPortfolio(clientId)
        if (!cancelled) setPortfolio(res.data ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load portfolio")
          setPortfolio(null)
        }
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [clientId])

  const spent = portfolio?.summary.spentBudget ?? 0
  const planned = portfolio?.summary.totalBudget ?? 0
  const util = planned > 0 ? Math.round((spent / planned) * 100) : 0

  const projectStatuses = useMemo(() => {
    if (!portfolio) return []
    return [...new Set(portfolio.projects.map((p) => p.status))]
  }, [portfolio])

  const projects = useMemo(() => {
    if (!portfolio) return []
    let list = [...portfolio.projects]
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter)
    return list.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))
  }, [portfolio, statusFilter])

  const bookValue = clients.reduce((s, c) => s + (c.projectsCount ?? 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Client portfolio</h1>
          <p className="text-muted-foreground text-sm">
            Account books of work — budget, health, and delivery weight.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" render={<Link to="/clients" />}>
            CRM accounts
          </Button>
          <Button size="sm" variant="outline" render={<Link to="/projects" />}>
            All projects
          </Button>
          <Button size="sm" variant="outline" render={<Link to="/assets" />}>
            <ImagesIcon className="size-3.5" />
            Assets
          </Button>
        </div>
      </div>

      {/* Book KPIs */}
      <div className="bg-card grid grid-cols-2 gap-3 rounded-xl border p-3 sm:grid-cols-4 sm:p-4">
        <div>
          <div className="text-muted-foreground text-xs">Accounts</div>
          <div className="text-lg font-semibold tabular-nums">{clients.length}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Projects in book</div>
          <div className="text-lg font-semibold tabular-nums">{bookValue}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Selected budget</div>
          <div className="text-lg font-semibold tabular-nums">{money(planned)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Utilization</div>
          <div
            className={cn(
              "text-lg font-semibold tabular-nums",
              util >= 85 && "text-destructive",
            )}
          >
            {portfolio ? `${util}%` : "—"}
          </div>
        </div>
      </div>

      {message ? <p className="text-muted-foreground text-xs">{message}</p> : null}
      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">
          {error}
          <span className="text-muted-foreground mt-1 block text-xs">
            Portfolio needs JWT + VITE_COSMOS_API_KEY matching COSMOS_API_KEYS.
          </span>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside
          className={cn(
            "lg:w-72 lg:shrink-0",
            clientId && portfolio ? "hidden lg:block" : "",
          )}
        >
          <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Accounts
          </div>
          {loadingList ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : (
            <div className="flex flex-row gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {clients.map((client) => (
                <button
                  key={client.clientId}
                  type="button"
                  onClick={() => setClientId(client.clientId)}
                  className={cn(
                    "hover:bg-muted/60 bg-card min-w-[14rem] rounded-xl border p-3 text-left transition-colors lg:min-w-0",
                    clientId === client.clientId && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Building2Icon className="text-primary size-4 shrink-0" />
                    <span className="truncate font-medium">{client.name}</span>
                  </div>
                  <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                    <span>{client.industry}</span>
                    <span className="capitalize">{client.health}</span>
                  </div>
                  <div className="text-muted-foreground mt-1 text-[11px]">
                    {client.projectsCount ?? 0} projects · {client.assetsCount ?? 0} assets
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className={cn("min-w-0 flex-1", !clientId && "hidden lg:block")}>
          {loadingDetail || !portfolio ? (
            <Skeleton className="h-80 w-full rounded-xl" />
          ) : (
            <div className="flex flex-col gap-4">
              <Button
                size="sm"
                variant="ghost"
                className="w-fit lg:hidden"
                onClick={() => setClientId("")}
              >
                ← Accounts
              </Button>

              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">{portfolio.clientName}</h2>
                    <p className="text-muted-foreground font-mono text-xs">
                      {portfolio.clientId}
                      {portfolio.industry ? ` · ${portfolio.industry}` : ""}
                    </p>
                    {portfolio.accountLead ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Lead: {portfolio.accountLead}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {portfolio.health ? (
                      <Badge variant="outline" className="capitalize">
                        {portfolio.health}
                      </Badge>
                    ) : null}
                    <Badge className={cn("gap-1", healthTone(portfolio.summary.healthScore))}>
                      <HeartPulseIcon className="size-3" />
                      Health {portfolio.summary.healthScore}
                    </Badge>
                  </div>
                </div>

                {portfolio.notes ? (
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                    {portfolio.notes}
                  </p>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs">Active</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {portfolio.summary.activeProjects}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs">Projects</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {portfolio.summary.totalProjects}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs">Budget</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {money(portfolio.summary.totalBudget)}
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="text-muted-foreground text-xs">Assets</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {portfolio.summary.assetsDelivered}
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <WalletIcon className="size-3.5" />
                      Spend vs plan
                    </span>
                    <span className="tabular-nums font-medium">
                      {money(spent)} / {money(planned)} · {util}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, util)}
                    className={cn("h-2", util >= 85 && "*:bg-destructive")}
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" render={<Link to="/clients" />}>
                    Open in CRM
                  </Button>
                  <Button size="sm" variant="outline" render={<Link to="/projects" />}>
                    Projects
                  </Button>
                  <Button size="sm" variant="outline" render={<Link to="/finance" />}>
                    Finance
                  </Button>
                </div>
              </Card>

              <div>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                    <BriefcaseIcon className="size-3.5" />
                    Projects in book
                  </div>
                  <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
                    <Button
                      size="sm"
                      variant={statusFilter === "all" ? "secondary" : "ghost"}
                      className="h-7 shrink-0 rounded-full text-xs"
                      onClick={() => setStatusFilter("all")}
                    >
                      All
                    </Button>
                    {projectStatuses.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={statusFilter === s ? "secondary" : "ghost"}
                        className="h-7 shrink-0 rounded-full text-xs capitalize"
                        onClick={() => setStatusFilter(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {projects.length === 0 ? (
                    <Card className="text-muted-foreground p-8 text-center text-sm">
                      No projects in this filter.
                    </Card>
                  ) : (
                    projects.map((project) => {
                      const pSpent = project.spent ?? 0
                      const pBudget = project.budget ?? 0
                      const pUtil =
                        pBudget > 0 ? Math.min(100, Math.round((pSpent / pBudget) * 100)) : 0
                      return (
                        <div
                          key={project.projectId}
                          className="bg-card flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{project.projectName}</div>
                            <div className="text-muted-foreground font-mono text-xs">
                              {project.projectId}
                              {project.weight != null ? ` · ${project.weight}% weight` : ""}
                            </div>
                            {pBudget > 0 ? (
                              <div className="mt-2 max-w-xs">
                                <div className="text-muted-foreground mb-1 flex justify-between text-[11px] tabular-nums">
                                  <span>
                                    {money(pSpent)} / {money(pBudget)}
                                  </span>
                                  <span>{pUtil}%</span>
                                </div>
                                <Progress value={pUtil} className="h-1.5" />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {project.budget != null ? (
                              <span className="text-muted-foreground text-sm tabular-nums">
                                {money(project.budget)}
                              </span>
                            ) : null}
                            <Badge
                              variant="secondary"
                              className={cn("capitalize", statusTone(project.status))}
                            >
                              {project.status}
                            </Badge>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
