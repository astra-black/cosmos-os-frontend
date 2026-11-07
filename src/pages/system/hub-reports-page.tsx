/**
 * Hub · Reports — Figma 00.04 · 35–40 (prototype flow 07)
 * Evidence: EXPERIENCE_ARCHITECTURE flow 07; build_core_gaps.py hub_reports / hub_fin
 * (D-122). Not Enterprise Consolidated Reports (build_v7_reports.py / 00.17).
 * MCP View-seat rate-limited — child node IDs not captured.
 *
 * Real agency-scoped aggregates only. Missing export/schedule/series → honest unavailable.
 * Distinct from Agency OS `/analytics` (event analytics) and `/dashboard` Producer Dashboard.
 */
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeftIcon,
  BarChart3Icon,
  ClockIcon,
  CpuIcon,
  DownloadIcon,
  FolderKanbanIcon,
  LayersIcon,
  LockIcon,
  RefreshCwIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import {
  getHubFinancialSummary,
  getHubProjectsSummary,
  getHubReportsCatalog,
  type HubFinancialSummary,
  type HubProjectsSummary,
  type HubReportCatalogItem,
  type HubReportsCatalog,
} from "@/lib/api/platform"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const ICONS: Record<string, typeof WalletIcon> = {
  "financial-summary": WalletIcon,
  projects: LayersIcon,
  "team-utilization": UsersIcon,
  "client-feedback": StarIcon,
  "astrid-agents": CpuIcon,
  "usage-credits": SparklesIcon,
}

function money(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `$${Math.round(n).toLocaleString()}`
  }
}

function dayLabel(date?: string | null) {
  if (!date) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusTone(state: string) {
  if (state === "included") return "success"
  if (state === "linked") return "info"
  return "neutral"
}

export function HubReportsLibraryPage() {
  const { user } = useAuth()
  const orgName = user?.agencyName || "Your organization"
  const [catalog, setCatalog] = useState<HubReportsCatalog | null>(null)
  const [financeAccess, setFinanceAccess] = useState(false)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await getHubReportsCatalog()
      setCatalog(res.data ?? null)
      setFinanceAccess(res.financeAccess === true)
      setStatus("ok")
    } catch (reason) {
      setCatalog(null)
      setStatus("error")
      setError(reason instanceof ApiError ? reason.message : "Reports catalog could not be loaded.")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      className="cosmos-home hub-admin hub-reports"
      data-figma="00.04 · 35–40 · Hub Reports"
      data-node-id-status="unconfirmed-mcp-rate-limited"
      data-flow="07"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub">
            <ArrowLeftIcon /> Hub
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Reports
          </div>
          <h1>Reports</h1>
          <p>
            Organization-level reports for this agency. Figures come only from agency-scoped
            records you can access. Export and scheduling stay unavailable until those APIs exist.
          </p>
        </div>
        <div className="hub-admin-actions">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCwIcon /> Refresh
          </Button>
          <Button size="sm" disabled title="Report scheduling is not implemented">
            <ClockIcon /> Schedule A Report
          </Button>
        </div>
      </header>

      {status === "loading" ? (
        <div className="hub-reports-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="hub-reports-card-skel" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="hub-admin-unavailable" role="alert">
          <BarChart3Icon />
          <div>
            <strong>Reports unavailable</strong>
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="hub-reports-grid">
            {(catalog?.reports || []).map((item) => (
              <ReportCard key={item.id} item={item} financeAccess={financeAccess} />
            ))}
          </div>

          <div className="hub-reports-lower">
            <section className="hub-reports-panel">
              <header className="hub-reports-panel-head">
                <h2>Scheduled</h2>
                <span className="hub-reports-chip is-info">0</span>
              </header>
              <div className="hub-admin-unavailable" role="status">
                <ClockIcon />
                <div>
                  <strong>Scheduling unavailable</strong>
                  <p>
                    {catalog?.scheduledUnavailableReason ||
                      "Report scheduling is designed but not implemented."}
                  </p>
                </div>
              </div>
            </section>

            <section className="hub-reports-panel hub-reports-boundaries">
              <header className="hub-reports-panel-head">
                <h2>What Hub Reports Show</h2>
              </header>
              <ul>
                {(catalog?.boundaries || []).map((row) => (
                  <li key={row.label}>
                    <div>
                      <strong>{row.label}</strong>
                      <small>{row.detail}</small>
                    </div>
                    <span className={cn("hub-reports-chip", `is-${statusTone(row.state)}`)}>
                      {row.state === "included"
                        ? "Included"
                        : row.state === "linked"
                          ? "Linked"
                          : "Unavailable"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function ReportCard({
  item,
  financeAccess,
}: {
  item: HubReportCatalogItem
  financeAccess: boolean
}) {
  const Icon = ICONS[item.id] || BarChart3Icon
  const locked = item.requiresFinance && !financeAccess
  const available = item.supported && !locked
  const body = (
    <>
      <span className="hub-reports-card-icon">
        <Icon />
      </span>
      <strong>{item.title}</strong>
      <p>{item.description}</p>
      <footer>
        <small>{item.scheduleHint}</small>
        {locked ? (
          <span className="hub-reports-chip is-neutral">
            <LockIcon /> Finance
          </span>
        ) : item.supported ? (
          <span className="hub-reports-chip is-success">Open</span>
        ) : (
          <span className="hub-reports-chip is-neutral">Unavailable</span>
        )}
      </footer>
      {!item.supported && item.unavailableReason ? (
        <p className="hub-reports-card-gap">{item.unavailableReason}</p>
      ) : null}
      {locked ? (
        <p className="hub-reports-card-gap">
          Finance figures require Finance access on this seat.
        </p>
      ) : null}
    </>
  )

  if (available && item.href) {
    return (
      <Link className="hub-reports-card is-live" to={item.href}>
        {body}
      </Link>
    )
  }

  return (
    <div className={cn("hub-reports-card", !item.supported || locked ? "is-unavailable" : undefined)}>
      {body}
    </div>
  )
}

export function HubReportFinancialPage() {
  const { user } = useAuth()
  const orgName = user?.agencyName || "Your organization"
  const [data, setData] = useState<HubFinancialSummary | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await getHubFinancialSummary()
      setData(res.data ?? null)
      setStatus("ok")
    } catch (reason) {
      setData(null)
      setStatus("error")
      setError(
        reason instanceof ApiError ? reason.message : "Financial summary could not be loaded.",
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = data?.kpis

  return (
    <div
      className="cosmos-home hub-admin hub-reports"
      data-figma="00.04 · 37 · Financial Summary"
      data-node-id-status="unconfirmed-mcp-rate-limited"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub/reports">
            <ArrowLeftIcon /> Reports
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Reports
          </div>
          <h1>Financial Summary</h1>
          <p>
            Budget planned vs spent and billable time revenue for this agency. Period menus,
            multi-edition charts, and invoice aging stay unavailable until those APIs exist.
          </p>
        </div>
        <div className="hub-admin-actions">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCwIcon /> Refresh
          </Button>
          <Button size="sm" variant="outline" disabled title="Scheduling is not implemented">
            <ClockIcon /> Schedule
          </Button>
          <Button size="sm" disabled title="Export is not implemented">
            <DownloadIcon /> Export
          </Button>
        </div>
      </header>

      <div className="hub-reports-filters" role="status">
        <span className="hub-reports-filter is-static">Agency totals</span>
        <span className="hub-reports-filter is-static">Agency OS only</span>
        <span className="hub-reports-updated">
          {status === "ok" && data?.updatedAt
            ? `Updated ${dayLabel(data.updatedAt)}`
            : status === "loading"
              ? "Loading…"
              : "—"}
        </span>
      </div>

      {status === "loading" ? (
        <div className="hub-reports-kpi-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="hub-reports-kpi-skel" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="hub-admin-unavailable" role="alert">
          <BarChart3Icon />
          <div>
            <strong>Financial summary unavailable</strong>
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : !data?.financeAccess ? (
        <div className="hub-admin-restricted" role="status">
          <LockIcon />
          <div>
            <strong>Finance access required</strong>
            <p>
              {data?.message ||
                "Monetary Hub Reports figures require Finance access on this seat. Project counts remain available on Projects & Productions."}
            </p>
            <div className="hub-admin-actions" style={{ marginTop: 12 }}>
              <Button size="sm" variant="outline" render={<Link to="/hub/reports/projects" />}>
                Open Projects report
              </Button>
              <Button size="sm" variant="outline" render={<Link to="/hub/reports" />}>
                Back to library
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="hub-reports-kpi-row">
            <Kpi label="Billable revenue" value={money(kpis?.revenue ?? 0)} note="From billable time × rate" />
            <Kpi
              label="Budget planned"
              value={money(kpis?.planned ?? 0)}
              note={`${money(kpis?.spent ?? 0)} spent · ${money(kpis?.remaining ?? 0)} remaining`}
            />
            <Kpi
              label="Active projects"
              value={String(data.activeProjects)}
              note="Agency OS statuses"
            />
            <Kpi
              label="Overdue invoices"
              value="—"
              note={data.overdueInvoices.reason}
              unavailable
            />
          </div>

          <div className="hub-reports-detail-row">
            <section className="hub-reports-panel hub-reports-chart">
              <header className="hub-reports-panel-head">
                <div>
                  <h2>Revenue by edition</h2>
                  <small>Last six months</small>
                </div>
              </header>
              <div className="hub-admin-unavailable" role="status">
                <BarChart3Icon />
                <div>
                  <strong>Chart series unavailable</strong>
                  <p>{data.trend.reason}</p>
                </div>
              </div>
            </section>

            <section className="hub-reports-panel">
              <header className="hub-reports-panel-head">
                <h2>Top projects by spend</h2>
              </header>
              {data.topBudgets.length === 0 ? (
                <div className="hub-admin-empty">
                  <FolderKanbanIcon />
                  <strong>No budgets yet</strong>
                  <small>Project budgets in Finance will appear here.</small>
                </div>
              ) : (
                <ul className="hub-reports-toplist">
                  {data.topBudgets.map((row) => (
                    <li key={row.budgetId || row.projectId || row.projectName}>
                      <div>
                        <strong>{row.projectName}</strong>
                        <small>
                          {row.clientName || "No client"} · {row.utilization}% utilized
                        </small>
                      </div>
                      <span>{money(row.spent, row.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="hub-reports-linkish"
                render={<Link to="/finance" />}
              >
                Open Finance
              </Button>
            </section>
          </div>

          <p className="hub-reports-footnote">
            Totals from agency budgets and billable time entries. Gross margin, edition roll-ups,
            period comparisons, export, and schedule are not fabricated.
          </p>
        </>
      )}
    </div>
  )
}

export function HubReportProjectsPage() {
  const { user } = useAuth()
  const orgName = user?.agencyName || "Your organization"
  const [data, setData] = useState<HubProjectsSummary | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await getHubProjectsSummary()
      setData(res.data ?? null)
      setStatus("ok")
    } catch (reason) {
      setData(null)
      setStatus("error")
      setError(
        reason instanceof ApiError ? reason.message : "Projects report could not be loaded.",
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div
      className="cosmos-home hub-admin hub-reports"
      data-figma="00.04 · Projects & Productions report"
      data-node-id-status="unconfirmed-mcp-rate-limited"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub/reports">
            <ArrowLeftIcon /> Reports
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Reports
          </div>
          <h1>Projects & Productions</h1>
          <p>
            Active, completed, and other project counts for this agency. At-risk scoring across
            editions is not modeled yet.
          </p>
        </div>
        <div className="hub-admin-actions">
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCwIcon /> Refresh
          </Button>
          <Button size="sm" disabled title="Export is not implemented">
            <DownloadIcon /> Export
          </Button>
        </div>
      </header>

      {status === "loading" ? (
        <div className="hub-reports-kpi-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="hub-reports-kpi-skel" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="hub-admin-unavailable" role="alert">
          <LayersIcon />
          <div>
            <strong>Projects report unavailable</strong>
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : data ? (
        <>
          <div className="hub-reports-kpi-row">
            <Kpi label="Total projects" value={String(data.counts.total)} note="Agency scoped" />
            <Kpi label="Active" value={String(data.counts.active)} note="In progress / review / planning" />
            <Kpi label="Completed" value={String(data.counts.completed)} note="Done / closed / archived" />
            <Kpi label="Other" value={String(data.counts.other)} note="Statuses outside those buckets" />
          </div>

          <section className="hub-reports-panel">
            <header className="hub-reports-panel-head">
              <h2>Recently updated</h2>
              <span className="hub-reports-updated">
                {data.updatedAt ? `Updated ${dayLabel(data.updatedAt)}` : null}
              </span>
            </header>
            {data.recent.length === 0 ? (
              <div className="hub-admin-empty">
                <FolderKanbanIcon />
                <strong>No projects yet</strong>
                <small>Agency projects will appear here when created.</small>
              </div>
            ) : (
              <ul className="hub-reports-toplist">
                {data.recent.map((row) => (
                  <li key={row.projectId}>
                    <div>
                      <strong>
                        <Link to={`/projects/${row.projectId}`}>{row.projectName}</Link>
                      </strong>
                      <small>
                        {row.clientName || "No client"} · {row.status || "—"}
                      </small>
                    </div>
                    <span>{dayLabel(row.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="hub-reports-linkish"
              render={<Link to="/projects" />}
            >
              Open Projects
            </Button>
          </section>
        </>
      ) : null}
    </div>
  )
}

function Kpi({
  label,
  value,
  note,
  unavailable = false,
}: {
  label: string
  value: string
  note: string
  unavailable?: boolean
}) {
  return (
    <div className={cn("hub-reports-kpi", unavailable && "is-unavailable")}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

export function HubReportsPage() {
  return <HubReportsLibraryPage />
}
