/**
 * Producer Dashboard + Customize — Figma 00.10 · 55–58
 * Frames: #55 Dark / #56 Light (Dashboard); #57 Dark / #58 Light (Customize).
 * Data is agency-scoped only; locked widgets never expose counts.
 */
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  TrendingUpIcon,
  CheckIcon,
  Clock3Icon,
  EyeIcon,
  InfoIcon,
  LockIcon,
  MessageSquareIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getDashboardLayout,
  listAllIncidents,
  listApprovals,
  listConversations,
  listEvents,
  listMilestones,
  listProjects,
  normalizeProjects,
  resetDashboardLayout,
  saveDashboardLayout,
} from "@/lib/api/agency"
import { listBudgets, type BudgetRow } from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canAccessRoute, canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type {
  Approval,
  DashboardLayout,
  DashboardWidgetCatalogItem,
  DashboardWidgetId,
  Event,
  Incident,
  Milestone,
  Project,
} from "@/types/agency"

const ACTIVE_PROJECT_STATUSES = new Set([
  "inprogress",
  "in_progress",
  "review",
  "notstarted",
  "not_started",
  "active",
])

type NeedsItem = {
  id: string
  severity: "critical" | "warning" | "info"
  title: string
  context: string
  to: string
}

function greetingFor(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function dayLabel(date?: string | null) {
  if (!date) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function daysUntil(date?: string | null) {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - start.getTime()) / 86400000)
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function money(n: number) {
  if (!Number.isFinite(n)) return "—"
  if (Math.abs(n) >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}M`
  }
  if (Math.abs(n) >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`
  return `$${Math.round(n)}`
}

function statusHealth(status: string): { tone: string; label: string } {
  const s = status.toLowerCase().replace(/[\s-]+/g, "_")
  if (s === "in_progress" || s === "inprogress" || s === "active") {
    return { tone: "success", label: "In Progress" }
  }
  if (s === "review") return { tone: "info", label: "Review" }
  if (s === "approved") return { tone: "success", label: "Approved" }
  if (s === "archived") return { tone: "neutral", label: "Archived" }
  if (s === "not_started" || s === "notstarted") return { tone: "neutral", label: "Not Started" }
  return { tone: "neutral", label: status || "—" }
}

function widgetIcon(id: string) {
  switch (id) {
    case "spend_vs_plan":
    case "invoices_over_time":
      return TrendingUpIcon
    case "milestones":
      return CalendarDaysIcon
    case "crew_attendance":
      return UsersIcon
    case "unread_conversations":
      return MessageSquareIcon
    case "reviews_waiting":
      return EyeIcon
    case "recent_feedback":
      return StarIcon
    default:
      return PlusIcon
  }
}

export function DashboardPage() {
  const { user } = useAuth()
  const canCreateProject = canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")
  const canOpenFinance = canAccessRoute(user?.role, "/finance")

  const [projects, setProjects] = useState<Project[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [financeAccess, setFinanceAccess] = useState(false)
  const [unreadTotal, setUnreadTotal] = useState<number | null>(null)
  const [unreadConversations, setUnreadConversations] = useState(0)
  const [messagingUnavailable, setMessagingUnavailable] = useState(false)

  const [layout, setLayout] = useState<DashboardLayout | null>(null)
  const [catalog, setCatalog] = useState<DashboardWidgetCatalogItem[]>([])
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidgetId[]>([])
  const [customizing, setCustomizing] = useState(false)
  const [widgetQuery, setWidgetQuery] = useState("")
  const [savingLayout, setSavingLayout] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const [
        pr,
        ar,
        er,
        mr,
        ir,
        br,
        cr,
        lr,
      ] = await Promise.allSettled([
        listProjects(),
        listApprovals(),
        listEvents({ page: 1, limit: 100 }),
        listMilestones({ status: "upcoming" }),
        listAllIncidents({ status: "open" }),
        listBudgets(),
        listConversations(),
        getDashboardLayout(),
      ])
      if (cancelled) return

      const hardFail = [pr, ar, er].find((r) => r.status === "rejected")
      if (hardFail?.status === "rejected") {
        setError(
          hardFail.reason instanceof ApiError
            ? hardFail.reason.message
            : "Workspace data could not be loaded.",
        )
      }

      if (pr.status === "fulfilled") setProjects(normalizeProjects(pr.value))
      if (ar.status === "fulfilled") setApprovals(ar.value.data ?? [])
      if (er.status === "fulfilled") setEvents(er.value.data ?? [])
      if (mr.status === "fulfilled") setMilestones(mr.value.data ?? [])
      if (ir.status === "fulfilled") setIncidents(ir.value.data ?? [])

      if (br.status === "fulfilled") {
        setBudgets(br.value.data ?? [])
        setFinanceAccess((br.value as { financeAccess?: boolean }).financeAccess === true)
      } else {
        setBudgets([])
        setFinanceAccess(false)
      }

      if (cr.status === "fulfilled") {
        const list = cr.value.data?.conversations ?? []
        const total = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
        const withUnread = list.filter((c) => (c.unreadCount || 0) > 0).length
        setUnreadTotal(total)
        setUnreadConversations(withUnread)
        setMessagingUnavailable(false)
      } else {
        setUnreadTotal(null)
        setUnreadConversations(0)
        setMessagingUnavailable(true)
      }

      if (lr.status === "fulfilled") {
        const data = lr.value.data
        setLayout(data)
        setCatalog(data.catalog ?? [])
        setDraftWidgets(data.widgets ?? [])
        if ((lr.value as { financeAccess?: boolean }).financeAccess === true) {
          setFinanceAccess(true)
        }
      } else {
        const fallback = [
          "kpi_active_projects",
          "kpi_decisions",
          "kpi_unread",
          "kpi_portfolio_budget",
          "projects",
          "needs_you",
          "spend_vs_plan",
          "milestones",
        ] as DashboardWidgetId[]
        setLayout({ version: 1, mode: "default", widgets: fallback })
        setDraftWidgets(fallback)
        setCatalog([])
      }

      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const activeProjects = useMemo(
    () =>
      projects.filter((p) =>
        ACTIVE_PROJECT_STATUSES.has(p.status.toLowerCase().replace(/[\s-]+/g, "_")),
      ),
    [projects],
  )

  const pendingApprovals = useMemo(
    () =>
      approvals.filter((a) =>
        ["pending", "changes_requested"].includes(a.status.toLowerCase()),
      ),
    [approvals],
  )

  const overdueApprovals = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return pendingApprovals.filter((a) => {
      if (!a.dueDate) return false
      const d = new Date(a.dueDate)
      return !Number.isNaN(d.getTime()) && d.getTime() < today.getTime()
    })
  }, [pendingApprovals])

  const liveTonight = useMemo(() => {
    const now = new Date()
    return events.filter((e) => {
      if (["completed", "cancelled"].includes(String(e.status).toLowerCase())) return false
      const start = new Date(e.startDate)
      if (Number.isNaN(start.getTime())) return false
      const live = String(e.status).toLowerCase() === "live" || String(e.status).toLowerCase() === "in_progress"
      return live || isSameDay(start, now)
    })
  }, [events])

  const portfolioBudget = useMemo(() => {
    if (!financeAccess) return null
    const planned = budgets.reduce((s, b) => s + (b.planned || 0), 0)
    const spent = budgets.reduce((s, b) => s + (b.spent || 0), 0)
    if (planned <= 0) return { pct: null as number | null, planned, spent }
    return { pct: Math.round((spent / planned) * 100), planned, spent }
  }, [budgets, financeAccess])

  const needsYou = useMemo(() => {
    const items: NeedsItem[] = []
    for (const inc of incidents.slice(0, 6)) {
      const sev = String(inc.severity || "").toLowerCase()
      items.push({
        id: `inc-${inc.incidentId}`,
        severity: sev === "critical" ? "critical" : sev === "warning" ? "warning" : "info",
        title: inc.title || "Open incident",
        context: "Live ops",
        to: inc.eventId ? `/events/${inc.eventId}` : "/events",
      })
    }
    for (const a of pendingApprovals.slice(0, 8)) {
      const projectName =
        a.projectName ||
        (a.projectId
          ? projects.find((p) => p.projectId === a.projectId)?.projectName
          : null) ||
        "Workspace"
      const overdue = overdueApprovals.some((o) => o.approvalId === a.approvalId)
      items.push({
        id: `ap-${a.approvalId}`,
        severity: overdue ? "warning" : "info",
        title: a.title,
        context: `${projectName}${a.dueDate ? ` · due ${dayLabel(a.dueDate)}` : ""}`,
        to: "/approvals",
      })
    }
    return items.slice(0, 8)
  }, [incidents, pendingApprovals, overdueApprovals, projects])

  const upcomingMilestones = useMemo(() => {
    const rows: Array<{
      id: string
      title: string
      subtitle: string
      right: string
      live?: boolean
      to: string
    }> = []

    for (const e of liveTonight.slice(0, 2)) {
      rows.push({
        id: `ev-${e.eventId || e.id}`,
        title: e.name,
        subtitle: `${dayLabel(e.startDate)}${e.venue || e.location ? ` · ${e.venue || e.location}` : ""}`,
        right: "Live",
        live: true,
        to: `/events/${e.eventId || e.id}`,
      })
    }

    const upcoming = [...milestones]
      .filter((m) => m.status === "upcoming")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    for (const m of upcoming.slice(0, 6)) {
      const projectName =
        (typeof m.project === "string" ? m.project : null) ||
        (m.projectId
          ? projects.find((p) => p.projectId === m.projectId)?.projectName
          : null) ||
        "Project"
      const days = daysUntil(m.dueDate)
      rows.push({
        id: `ms-${m.milestoneId}`,
        title: m.name,
        subtitle: `${projectName} · ${dayLabel(m.dueDate)}`,
        right: days == null ? "—" : days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`,
        to: "/milestones",
      })
    }
    return rows.slice(0, 6)
  }, [liveTonight, milestones, projects])

  const sortedProjects = useMemo(() => {
    return [...activeProjects]
      .sort((a, b) => {
        const da = a.endDate ? new Date(a.endDate).getTime() : Number.POSITIVE_INFINITY
        const db = b.endDate ? new Date(b.endDate).getTime() : Number.POSITIVE_INFINITY
        return da - db
      })
      .slice(0, 8)
  }, [activeProjects])

  const activeWidgets = customizing ? draftWidgets : layout?.widgets ?? draftWidgets

  const showKpi = (id: DashboardWidgetId) => activeWidgets.includes(id)
  const kpiIds = [
    "kpi_active_projects",
    "kpi_decisions",
    "kpi_unread",
    "kpi_portfolio_budget",
  ] as const
  const visibleKpis = kpiIds.filter((id) => showKpi(id))

  const catalogById = useMemo(() => {
    const map = new Map<string, DashboardWidgetCatalogItem>()
    for (const item of catalog) map.set(item.id, item)
    return map
  }, [catalog])

  function openCustomize() {
    setDraftWidgets(layout?.widgets ?? [])
    setWidgetQuery("")
    setCustomizing(true)
  }

  function closeCustomize() {
    setCustomizing(false)
    setDraftWidgets(layout?.widgets ?? [])
  }

  function addWidget(id: DashboardWidgetId) {
    setDraftWidgets((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  function removeWidget(id: DashboardWidgetId) {
    setDraftWidgets((prev) => prev.filter((w) => w !== id))
  }

  async function handleSaveLayout() {
    setSavingLayout(true)
    try {
      const res = await saveDashboardLayout(draftWidgets)
      setLayout(res.data)
      setCatalog(res.data.catalog ?? catalog)
      setDraftWidgets(res.data.widgets)
      if ((res as { financeAccess?: boolean }).financeAccess === true) setFinanceAccess(true)
      toast.success("Dashboard layout saved")
      setCustomizing(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save layout")
    } finally {
      setSavingLayout(false)
    }
  }

  async function handleResetLayout() {
    setSavingLayout(true)
    try {
      const res = await resetDashboardLayout()
      setLayout(res.data)
      setCatalog(res.data.catalog ?? catalog)
      setDraftWidgets(res.data.widgets)
      toast.success("Reset to Producer default")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reset layout")
    } finally {
      setSavingLayout(false)
    }
  }

  const filteredCatalog = catalog.filter((item) => {
    const q = widgetQuery.trim().toLowerCase()
    if (!q) return true
    return (
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    )
  })

  const firstName = user?.name?.split(/\s+/)[0] || "there"

  return (
    <div className="cosmos-dash" data-figma="00.10 · 55–58">
      {error ? (
        <div className="cosmos-dash-error" role="alert">
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            <RefreshCwIcon /> Retry
          </Button>
        </div>
      ) : null}

      <div className="cosmos-dash-title-row">
        <div>
          <h1>
            {greetingFor()}, {firstName}
          </h1>
        </div>
        <div className="cosmos-dash-actions">
          <Button size="sm" variant="outline" onClick={openCustomize}>
            <SlidersHorizontalIcon /> Customize
          </Button>
          {canCreateProject ? (
            <Button size="sm" className="cosmos-dash-primary" render={<Link to="/projects" />}>
              <PlusIcon /> New Project
            </Button>
          ) : null}
        </div>
      </div>

      {visibleKpis.length > 0 ? (
        <div
          className="cosmos-dash-kpis"
          style={{ gridTemplateColumns: `repeat(${Math.min(visibleKpis.length, 4)}, minmax(0, 1fr))` }}
        >
          {showKpi("kpi_active_projects") ? (
            <KpiCard
              editing={customizing}
              onRemove={() => removeWidget("kpi_active_projects")}
              label="Active Projects"
              value={loading ? "—" : String(activeProjects.length)}
              hint={
                loading
                  ? "Loading…"
                  : [
                      liveTonight.length
                        ? `${liveTonight.length} live / today`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Across your workspace"
              }
              to="/projects"
            />
          ) : null}
          {showKpi("kpi_decisions") ? (
            <KpiCard
              editing={customizing}
              onRemove={() => removeWidget("kpi_decisions")}
              label="Decisions Waiting"
              value={loading ? "—" : String(pendingApprovals.length)}
              hint={
                loading
                  ? "Loading…"
                  : overdueApprovals.length
                    ? `${overdueApprovals.length} overdue`
                    : pendingApprovals.length
                      ? "Awaiting review"
                      : "All clear"
              }
              tone={pendingApprovals.length ? "warning" : undefined}
              to="/approvals"
            />
          ) : null}
          {showKpi("kpi_unread") ? (
            <KpiCard
              editing={customizing}
              onRemove={() => removeWidget("kpi_unread")}
              label="Unread"
              value={
                loading
                  ? "—"
                  : messagingUnavailable
                    ? "—"
                    : String(unreadTotal ?? 0)
              }
              hint={
                loading
                  ? "Loading…"
                  : messagingUnavailable
                    ? "Messaging unavailable"
                    : unreadConversations
                      ? `In ${unreadConversations} conversation${unreadConversations === 1 ? "" : "s"}`
                      : "No unread messages"
              }
              to="/messages"
              unavailable={messagingUnavailable && !loading}
            />
          ) : null}
          {showKpi("kpi_portfolio_budget") ? (
            financeAccess ? (
              <KpiCard
                editing={customizing}
                onRemove={() => removeWidget("kpi_portfolio_budget")}
                label="Portfolio Budget Used"
                value={
                  loading
                    ? "—"
                    : portfolioBudget?.pct == null
                      ? "—"
                      : `${portfolioBudget.pct}%`
                }
                hint={
                  loading
                    ? "Loading…"
                    : portfolioBudget?.planned
                      ? `Of ${money(portfolioBudget.planned)} approved`
                      : "No budgets yet"
                }
                to={canOpenFinance ? "/finance" : undefined}
              />
            ) : (
              <LockedKpi
                editing={customizing}
                onRemove={() => removeWidget("kpi_portfolio_budget")}
                label="Portfolio Budget Used"
                reason="Finance access required"
              />
            )
          ) : null}
        </div>
      ) : null}

      <div className="cosmos-dash-mid">
        {activeWidgets.includes("projects") ? (
          <section
            className={cn("cosmos-dash-card cosmos-dash-projects", customizing && "is-editing")}
          >
            {customizing ? (
              <button
                type="button"
                className="cosmos-dash-remove"
                aria-label="Remove Projects"
                onClick={() => removeWidget("projects")}
              >
                <XIcon />
              </button>
            ) : null}
            <div className="cosmos-dash-card__head">
              <h2>Projects</h2>
              <span className="cosmos-dash-muted">Sort · Next Date</span>
            </div>
            <div className="cosmos-dash-table-wrap">
              <table className="cosmos-dash-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Next Date</th>
                    <th>Owner</th>
                    <th>Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0, 1, 2].map((n) => (
                      <tr key={n}>
                        <td colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : sortedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="cosmos-dash-empty-cell">
                        No active projects yet.
                      </td>
                    </tr>
                  ) : (
                    sortedProjects.map((p) => {
                      const health = statusHealth(p.status)
                      const budgetRow = budgets.find((b) => b.projectId === p.projectId)
                      return (
                        <tr key={p.projectId}>
                          <td>
                            <Link to={`/projects/${p.projectId}`} className="cosmos-dash-project-link">
                              <strong>{p.projectName}</strong>
                              <small>
                                {[p.clientName, p.status].filter(Boolean).join(" · ")}
                              </small>
                            </Link>
                          </td>
                          <td>
                            <span className={cn("cosmos-dash-pill", `is-${health.tone}`)}>
                              {health.label}
                            </span>
                          </td>
                          <td>
                            <span className="cosmos-dash-muted" title="Task completion % is not stored on projects">
                              —
                            </span>
                          </td>
                          <td>{dayLabel(p.endDate)}</td>
                          <td>
                            <span className="cosmos-dash-muted" title="Project owner is not on the current schema">
                              —
                            </span>
                          </td>
                          <td>
                            {financeAccess ? (
                              budgetRow ? (
                                money(budgetRow.planned)
                              ) : p.budget != null ? (
                                money(p.budget)
                              ) : (
                                "—"
                              )
                            ) : (
                              <span className="cosmos-dash-lock-inline" title="Finance access required">
                                <LockIcon />
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeWidgets.includes("needs_you") ? (
          <section
            className={cn("cosmos-dash-card cosmos-dash-needs", customizing && "is-editing")}
          >
            {customizing ? (
              <button
                type="button"
                className="cosmos-dash-remove"
                aria-label="Remove Needs You"
                onClick={() => removeWidget("needs_you")}
              >
                <XIcon />
              </button>
            ) : null}
            <div className="cosmos-dash-card__head">
              <h2>Needs You</h2>
              {!loading && needsYou.length > 0 ? (
                <span className="cosmos-dash-pill is-warning">{needsYou.length}</span>
              ) : null}
            </div>
            <div className="cosmos-dash-needs-list">
              {loading ? (
                [0, 1, 2].map((n) => <Skeleton key={n} className="h-12 w-full" />)
              ) : needsYou.length === 0 ? (
                <div className="cosmos-dash-empty">
                  <CheckIcon />
                  <span>
                    <strong>All caught up</strong>
                    <small>Approvals and open incidents you can see will appear here.</small>
                  </span>
                </div>
              ) : (
                needsYou.map((item) => (
                  <Link key={item.id} to={item.to} className="cosmos-dash-needs-row">
                    <span className={cn("cosmos-dash-sev", `is-${item.severity}`)}>
                      {item.severity === "critical" ? (
                        <AlertTriangleIcon />
                      ) : item.severity === "warning" ? (
                        <Clock3Icon />
                      ) : (
                        <InfoIcon />
                      )}
                    </span>
                    <span className="cosmos-dash-needs-copy">
                      <strong>{item.title}</strong>
                      <small>{item.context}</small>
                    </span>
                    <span className="cosmos-dash-open">Open</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>

      <div className="cosmos-dash-bottom">
        {activeWidgets.includes("spend_vs_plan") ? (
          <SpendWidget
            editing={customizing}
            onRemove={() => removeWidget("spend_vs_plan")}
            financeAccess={financeAccess}
            canOpenFinance={canOpenFinance}
            meta={catalogById.get("spend_vs_plan")}
          />
        ) : null}

        {activeWidgets.includes("milestones") ? (
          <MilestonesWidget
            editing={customizing}
            onRemove={() => removeWidget("milestones")}
            loading={loading}
            rows={upcomingMilestones}
          />
        ) : null}

        {activeWidgets.includes("crew_attendance") ? (
          <UnavailableWidget
            editing={customizing}
            onRemove={() => removeWidget("crew_attendance")}
            title="Crew Attendance"
            reason="Crew attendance is not available yet."
            locked={false}
          />
        ) : null}

        {activeWidgets.includes("unread_conversations") ? (
          <UnreadWidget
            editing={customizing}
            onRemove={() => removeWidget("unread_conversations")}
            loading={loading}
            unavailable={messagingUnavailable}
            total={unreadTotal}
            conversations={unreadConversations}
          />
        ) : null}

        {activeWidgets.includes("reviews_waiting") ? (
          <ReviewsWidget
            editing={customizing}
            onRemove={() => removeWidget("reviews_waiting")}
            loading={loading}
            pending={pendingApprovals}
            overdue={overdueApprovals.length}
          />
        ) : null}

        {activeWidgets.includes("recent_feedback") ? (
          <UnavailableWidget
            editing={customizing}
            onRemove={() => removeWidget("recent_feedback")}
            title="Recent Feedback"
            reason="Reputation · leaders only"
            locked
          />
        ) : null}

        {activeWidgets.includes("invoices_over_time") ? (
          <UnavailableWidget
            editing={customizing}
            onRemove={() => removeWidget("invoices_over_time")}
            title="Invoices Over Time"
            reason={
              financeAccess
                ? "Invoice time series is not available yet."
                : "Finance access required"
            }
            locked={!financeAccess}
          />
        ) : null}
      </div>

      {customizing ? (
        <div className="cosmos-dash-scrim" role="presentation">
          <aside className="cosmos-dash-drawer" role="dialog" aria-label="Customize Dashboard">
            <div className="cosmos-dash-drawer__head">
              <h2>Customize Dashboard</h2>
              <button type="button" aria-label="Close" onClick={closeCustomize}>
                <XIcon />
              </button>
            </div>
            <div className="cosmos-dash-drawer__search">
              <SearchIcon />
              <Input
                value={widgetQuery}
                onChange={(e) => setWidgetQuery(e.target.value)}
                placeholder="Search widgets"
                aria-label="Search widgets"
              />
            </div>
            <p className="cosmos-dash-drawer__lab">Widget Library</p>
            <div className="cosmos-dash-library">
              {filteredCatalog.length === 0 ? (
                <p className="cosmos-dash-muted">No widgets match your search.</p>
              ) : (
                filteredCatalog.map((item) => {
                  const Icon = widgetIcon(item.id)
                  const onDash = draftWidgets.includes(item.id)
                  return (
                    <div key={item.id} className="cosmos-dash-lib-row">
                      <span className="cosmos-dash-lib-icon">
                        <Icon />
                      </span>
                      <span className="cosmos-dash-lib-copy">
                        <strong>{item.label}</strong>
                        <small>{item.description}</small>
                      </span>
                      {onDash ? (
                        <span className="cosmos-dash-pill is-success">On Dashboard</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => addWidget(item.id)}>
                          <PlusIcon /> Add
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            <p className="cosmos-dash-drawer__note">
              <LockIcon /> Widgets only show records you can already open. Adding one never
              grants access.
            </p>
            <div className="cosmos-dash-drawer__foot">
              <Button
                size="sm"
                variant="ghost"
                disabled={savingLayout}
                onClick={() => void handleResetLayout()}
              >
                Reset To Default
              </Button>
              <Button
                size="sm"
                className="cosmos-dash-primary"
                disabled={savingLayout}
                onClick={() => void handleSaveLayout()}
              >
                Save Layout
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  to,
  tone,
  editing,
  onRemove,
  unavailable,
}: {
  label: string
  value: string
  hint: string
  to?: string
  tone?: string
  editing?: boolean
  onRemove?: () => void
  unavailable?: boolean
}) {
  const inner = (
    <>
      {editing && onRemove ? (
        <button
          type="button"
          className="cosmos-dash-remove"
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.preventDefault()
            onRemove()
          }}
        >
          <XIcon />
        </button>
      ) : null}
      <small>{label}</small>
      <strong className={cn(tone && `is-${tone}`, unavailable && "is-muted")}>{value}</strong>
      <span>{hint}</span>
    </>
  )
  if (to && !editing) {
    return (
      <Link className={cn("cosmos-dash-kpi", editing && "is-editing")} to={to}>
        {inner}
      </Link>
    )
  }
  return <div className={cn("cosmos-dash-kpi", editing && "is-editing")}>{inner}</div>
}

function LockedKpi({
  label,
  reason,
  editing,
  onRemove,
}: {
  label: string
  reason: string
  editing?: boolean
  onRemove?: () => void
}) {
  return (
    <div className={cn("cosmos-dash-kpi is-locked", editing && "is-editing")}>
      {editing && onRemove ? (
        <button
          type="button"
          className="cosmos-dash-remove"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <XIcon />
        </button>
      ) : null}
      <small>{label}</small>
      <strong className="is-muted">
        <LockIcon />
      </strong>
      <span>{reason}</span>
    </div>
  )
}

function SpendWidget({
  editing,
  onRemove,
  financeAccess,
  canOpenFinance,
  meta,
}: {
  editing?: boolean
  onRemove?: () => void
  financeAccess: boolean
  canOpenFinance: boolean
  meta?: DashboardWidgetCatalogItem
}) {
  const locked = !financeAccess || meta?.locked
  return (
    <section className={cn("cosmos-dash-card cosmos-dash-spend", editing && "is-editing")}>
      {editing && onRemove ? (
        <button type="button" className="cosmos-dash-remove" aria-label="Remove Spend Vs Plan" onClick={onRemove}>
          <XIcon />
        </button>
      ) : null}
      <div className="cosmos-dash-card__head">
        <div>
          <h2>Spend Vs Plan</h2>
          <p className="cosmos-dash-muted">Cumulative % of approved budget</p>
        </div>
        <div className="cosmos-dash-legend">
          <span>
            <i className="is-actual" /> Actual
          </span>
          <span>
            <i className="is-plan" /> Plan
          </span>
        </div>
      </div>
      {locked ? (
        <div className="cosmos-dash-locked-panel">
          <LockIcon />
          <div>
            <strong>Finance access required</strong>
            <p>Budget curves stay hidden. Adding this widget does not grant access.</p>
          </div>
        </div>
      ) : (
        <div className="cosmos-dash-unavailable-panel">
          <TrendingUpIcon />
          <div>
            <strong>Chart unavailable</strong>
            <p>
              Planned vs actual spend over time is not exposed by the finance API yet. Open
              Finance for current budget totals.
            </p>
            {canOpenFinance ? (
              <Button size="sm" variant="outline" render={<Link to="/finance" />}>
                Open Finance
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}

function MilestonesWidget({
  editing,
  onRemove,
  loading,
  rows,
}: {
  editing?: boolean
  onRemove?: () => void
  loading: boolean
  rows: Array<{ id: string; title: string; subtitle: string; right: string; live?: boolean; to: string }>
}) {
  return (
    <section className={cn("cosmos-dash-card cosmos-dash-ms", editing && "is-editing")}>
      {editing && onRemove ? (
        <button type="button" className="cosmos-dash-remove" aria-label="Remove Upcoming Milestones" onClick={onRemove}>
          <XIcon />
        </button>
      ) : null}
      <div className="cosmos-dash-card__head">
        <h2>Upcoming Milestones</h2>
      </div>
      <div className="cosmos-dash-ms-list">
        {loading ? (
          [0, 1, 2].map((n) => <Skeleton key={n} className="h-12 w-full" />)
        ) : rows.length === 0 ? (
          <div className="cosmos-dash-empty">
            <CalendarDaysIcon />
            <span>
              <strong>No upcoming milestones</strong>
              <small>Milestones and live events you can see will appear here.</small>
            </span>
          </div>
        ) : (
          rows.map((row) => (
            <Link key={row.id} to={row.to} className="cosmos-dash-ms-row">
              <span className="cosmos-dash-ms-copy">
                <strong>{row.title}</strong>
                <small>{row.subtitle}</small>
              </span>
              {row.live ? (
                <span className="cosmos-dash-pill is-live">Live</span>
              ) : (
                <span className="cosmos-dash-muted">{row.right}</span>
              )}
            </Link>
          ))
        )}
      </div>
    </section>
  )
}

function UnreadWidget({
  editing,
  onRemove,
  loading,
  unavailable,
  total,
  conversations,
}: {
  editing?: boolean
  onRemove?: () => void
  loading: boolean
  unavailable: boolean
  total: number | null
  conversations: number
}) {
  return (
    <section className={cn("cosmos-dash-card", editing && "is-editing")}>
      {editing && onRemove ? (
        <button type="button" className="cosmos-dash-remove" aria-label="Remove Unread Conversations" onClick={onRemove}>
          <XIcon />
        </button>
      ) : null}
      <div className="cosmos-dash-card__head">
        <h2>Unread Conversations</h2>
      </div>
      {unavailable ? (
        <div className="cosmos-dash-unavailable-panel">
          <MessageSquareIcon />
          <div>
            <strong>Messaging unavailable</strong>
            <p>Conversation unread counts could not be loaded.</p>
          </div>
        </div>
      ) : (
        <div className="cosmos-dash-stat-block">
          <strong>{loading ? "—" : String(total ?? 0)}</strong>
          <span>
            {loading
              ? "Loading…"
              : conversations
                ? `Across ${conversations} conversation${conversations === 1 ? "" : "s"}`
                : "No unread messages"}
          </span>
          <Button size="sm" variant="outline" render={<Link to="/messages" />}>
            Open Messages
          </Button>
        </div>
      )}
    </section>
  )
}

function ReviewsWidget({
  editing,
  onRemove,
  loading,
  pending,
  overdue,
}: {
  editing?: boolean
  onRemove?: () => void
  loading: boolean
  pending: Approval[]
  overdue: number
}) {
  return (
    <section className={cn("cosmos-dash-card", editing && "is-editing")}>
      {editing && onRemove ? (
        <button type="button" className="cosmos-dash-remove" aria-label="Remove Reviews Waiting" onClick={onRemove}>
          <XIcon />
        </button>
      ) : null}
      <div className="cosmos-dash-card__head">
        <h2>Reviews Waiting</h2>
        {!loading && pending.length > 0 ? (
          <span className="cosmos-dash-pill is-warning">{pending.length}</span>
        ) : null}
      </div>
      <div className="cosmos-dash-needs-list">
        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : pending.length === 0 ? (
          <div className="cosmos-dash-empty">
            <CheckIcon />
            <span>
              <strong>No reviews waiting</strong>
              <small>{overdue ? `${overdue} overdue cleared` : "Proofs and approvals are clear."}</small>
            </span>
          </div>
        ) : (
          pending.slice(0, 5).map((a) => (
            <Link key={a.approvalId} to="/approvals" className="cosmos-dash-needs-row">
              <span className="cosmos-dash-sev is-info">
                <EyeIcon />
              </span>
              <span className="cosmos-dash-needs-copy">
                <strong>{a.title}</strong>
                <small>
                  {a.projectName || "Workspace"}
                  {a.dueDate ? ` · due ${dayLabel(a.dueDate)}` : ""}
                </small>
              </span>
              <span className="cosmos-dash-open">Open</span>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}

function UnavailableWidget({
  editing,
  onRemove,
  title,
  reason,
  locked,
}: {
  editing?: boolean
  onRemove?: () => void
  title: string
  reason: string
  locked: boolean
}) {
  return (
    <section className={cn("cosmos-dash-card", editing && "is-editing")}>
      {editing && onRemove ? (
        <button type="button" className="cosmos-dash-remove" aria-label={`Remove ${title}`} onClick={onRemove}>
          <XIcon />
        </button>
      ) : null}
      <div className="cosmos-dash-card__head">
        <h2>{title}</h2>
      </div>
      <div className={locked ? "cosmos-dash-locked-panel" : "cosmos-dash-unavailable-panel"}>
        {locked ? <LockIcon /> : <InfoIcon />}
        <div>
          <strong>{locked ? "Restricted" : "Unavailable"}</strong>
          <p>{reason}</p>
        </div>
      </div>
    </section>
  )
}
