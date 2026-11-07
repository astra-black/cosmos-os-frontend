/**
 * Cosmos Hub · Portal · One Edition — Figma 00.04
 * Evidence: Desktop frame `02 · Portal · One Edition · Light` (+ dark twin via design-src);
 * build_v6_portal.portal_single / build_v7_portal; IDENTITY_ACCESS §7.
 * Child node IDs unavailable (MCP View-seat rate limit). Not 00.10 · 55–58.
 *
 * Data truth: `/api/v1/agency/tenant` is a static in-memory platformStore object
 * (env defaults + hardcoded seats) — never shown as live plan/seat metrics.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BadgeDollarSignIcon,
  BarChart3Icon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckIcon,
  CircleCheckIcon,
  FileCheck2Icon,
  FolderKanbanIcon,
  LayersIcon,
  LayoutGridIcon,
  RadioIcon,
  RefreshCwIcon,
  SparklesIcon,
  StarIcon,
  UsersRoundIcon,
  WalletCardsIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getCrmSummary,
  listApprovals,
  listClients,
  listEvents,
  listProjects,
  normalizeProjects,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { listBudgets, type BudgetRow } from "@/lib/api/platform"
import { useAuth } from "@/lib/auth"
import { canAccessRoute, canPerform, normalizeRole } from "@/lib/rbac"
import type { AgencyClient, Approval, CrmSummary, Event, Project } from "@/types/agency"
import { cn } from "@/lib/utils"

const ACTIVE_STATUSES = new Set([
  "inprogress",
  "in_progress",
  "review",
  "notstarted",
  "not_started",
  "active",
])

function greetingFor(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

function dayLabel(date?: string) {
  if (!date) return "—"
  const d = new Date(date)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function dateDistance(date?: string) {
  if (!date) return "—"
  const days = Math.ceil(
    (new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  )
  if (days < 0) return "Overdue"
  if (days === 0) return "Today"
  if (days === 1) return "1 Day"
  return `${days} Days`
}

function timeAgo(date?: string) {
  if (!date) return ""
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  return dayLabel(date)
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback
}

type QuickTile = {
  name: string
  to: string
  icon: typeof FolderKanbanIcon
  note: string
  gated?: boolean
}

export function HubPortalPage() {
  const { user } = useAuth()
  const role = normalizeRole(user?.role)
  const canAdminOrg = role === "admin" || canPerform(user?.role, "manage_team")
  const canSeeFinance = canAccessRoute(user?.role, "/finance")
  const canSeeCrm = canAccessRoute(user?.role, "/crm")
  const canSeeClients = canAccessRoute(user?.role, "/clients")
  const canSeeBilling = canAccessRoute(user?.role, "/billing")

  const [projects, setProjects] = useState<Project[]>([])
  const [projectsStatus, setProjectsStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "loading",
  )
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [clientsStatus, setClientsStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "loading",
  )
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [approvalsStatus, setApprovalsStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("loading")
  const [approvalsError, setApprovalsError] = useState<string | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [eventsStatus, setEventsStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "loading",
  )
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [budgetsStatus, setBudgetsStatus] = useState<"idle" | "loading" | "ok" | "error">(
    canSeeFinance ? "loading" : "idle",
  )
  const [budgetsError, setBudgetsError] = useState<string | null>(null)
  const [financeAccess, setFinanceAccess] = useState(false)
  const [crm, setCrm] = useState<CrmSummary | null>(null)
  const [crmStatus, setCrmStatus] = useState<"idle" | "loading" | "ok" | "error">("loading")
  const [bootLoading, setBootLoading] = useState(true)

  const loadApprovals = useCallback(async () => {
    setApprovalsStatus("loading")
    setApprovalsError(null)
    try {
      const result = await listApprovals()
      setApprovals(result.data ?? [])
      setApprovalsStatus("ok")
    } catch (reason) {
      setApprovals([])
      setApprovalsStatus("error")
      setApprovalsError(
        errorMessage(reason, "Approvals could not be loaded."),
      )
    }
  }, [])

  const loadBudgets = useCallback(async () => {
    if (!canSeeFinance) {
      setBudgets([])
      setFinanceAccess(false)
      setBudgetsStatus("idle")
      setBudgetsError(null)
      return
    }
    setBudgetsStatus("loading")
    setBudgetsError(null)
    try {
      const result = await listBudgets()
      setBudgets(result.data ?? [])
      setFinanceAccess((result as { financeAccess?: boolean }).financeAccess === true)
      setBudgetsStatus("ok")
    } catch (reason) {
      setBudgets([])
      setFinanceAccess(false)
      setBudgetsStatus("error")
      setBudgetsError(errorMessage(reason, "Budget data could not be loaded."))
    }
  }, [canSeeFinance])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setBootLoading(true)
      setProjectsStatus("loading")
      setClientsStatus("loading")
      setApprovalsStatus("loading")
      setApprovalsError(null)
      setEventsStatus("loading")
      setCrmStatus("loading")
      if (canSeeFinance) {
        setBudgetsStatus("loading")
        setBudgetsError(null)
      } else {
        setBudgets([])
        setFinanceAccess(false)
        setBudgetsStatus("idle")
        setBudgetsError(null)
      }

      const [pr, cr, ar, er, mr, br] = await Promise.allSettled([
        listProjects(),
        listClients(),
        listApprovals(),
        listEvents({ page: 1, limit: 100 }),
        getCrmSummary(),
        canSeeFinance ? listBudgets() : Promise.resolve(null),
      ])
      if (cancelled) return

      if (pr.status === "fulfilled") {
        setProjects(normalizeProjects(pr.value))
        setProjectsStatus("ok")
      } else {
        setProjects([])
        setProjectsStatus("error")
      }

      if (cr.status === "fulfilled") {
        setClients(cr.value.data ?? [])
        setClientsStatus("ok")
      } else {
        setClients([])
        setClientsStatus("error")
      }

      if (ar.status === "fulfilled") {
        setApprovals(ar.value.data ?? [])
        setApprovalsStatus("ok")
        setApprovalsError(null)
      } else {
        setApprovals([])
        setApprovalsStatus("error")
        setApprovalsError(
          errorMessage(ar.reason, "Approvals could not be loaded."),
        )
      }

      if (er.status === "fulfilled") {
        setEvents(er.value.data ?? [])
        setEventsStatus("ok")
      } else {
        setEvents([])
        setEventsStatus("error")
      }

      if (mr.status === "fulfilled") {
        setCrm(mr.value.data ?? null)
        setCrmStatus("ok")
      } else {
        setCrm(null)
        setCrmStatus("error")
      }

      if (!canSeeFinance) {
        setBudgets([])
        setFinanceAccess(false)
        setBudgetsStatus("idle")
        setBudgetsError(null)
      } else if (br.status === "fulfilled" && br.value) {
        setBudgets(br.value.data ?? [])
        setFinanceAccess((br.value as { financeAccess?: boolean }).financeAccess === true)
        setBudgetsStatus("ok")
        setBudgetsError(null)
      } else if (br.status === "rejected") {
        setBudgets([])
        setFinanceAccess(false)
        setBudgetsStatus("error")
        setBudgetsError(
          errorMessage(br.reason, "Budget data could not be loaded."),
        )
      } else {
        setBudgets([])
        setFinanceAccess(false)
        setBudgetsStatus("error")
        setBudgetsError("Budget data could not be loaded.")
      }

      setBootLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [canSeeFinance])

  const activeProjects = useMemo(
    () =>
      projects.filter((p) =>
        ACTIVE_STATUSES.has(p.status.toLowerCase().replace(/[\s-]+/g, "_")),
      ),
    [projects],
  )

  const pending = useMemo(
    () =>
      approvals.filter((a) =>
        ["pending", "changes_requested"].includes(a.status.toLowerCase()),
      ),
    [approvals],
  )

  const nextEvent = useMemo(() => {
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    return events
      .filter(
        (e) =>
          !["completed", "cancelled"].includes(String(e.status).toLowerCase()) &&
          new Date(e.startDate).setHours(0, 0, 0, 0) >= startOfToday,
      )
      .sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      )[0]
  }, [events])

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            new Date(b.updatedAt || b.createdAt || 0).getTime() -
            new Date(a.updatedAt || a.createdAt || 0).getTime(),
        )
        .slice(0, 3),
    [projects],
  )

  const overBudget = useMemo(
    () =>
      canSeeFinance && financeAccess && budgetsStatus === "ok"
        ? budgets.filter((b) => b.planned > 0 && (b.utilization ?? 0) >= 90).slice(0, 2)
        : [],
    [budgets, budgetsStatus, canSeeFinance, financeAccess],
  )

  const committedPct = useMemo(() => {
    if (!canSeeFinance || !financeAccess || budgetsStatus !== "ok") return null
    const planned = budgets.reduce((s, b) => s + (b.planned || 0), 0)
    if (planned <= 0) return null
    return Math.round(budgets.reduce((s, b) => s + (b.spent || 0), 0) / planned * 100)
  }, [budgets, budgetsStatus, canSeeFinance, financeAccess])

  const budgetAttentionFailed = canSeeFinance && budgetsStatus === "error"
  const attentionWaitingOnBudgets =
    canSeeFinance &&
    budgetsStatus === "loading" &&
    approvalsStatus === "ok" &&
    pending.length === 0
  const attentionLoading =
    approvalsStatus === "loading" ||
    (bootLoading && approvalsStatus !== "error" && !budgetAttentionFailed) ||
    attentionWaitingOnBudgets
  const showAttentionCaughtUp =
    approvalsStatus === "ok" &&
    pending.length === 0 &&
    overBudget.length === 0 &&
    !budgetAttentionFailed &&
    !attentionWaitingOnBudgets &&
    budgetsStatus !== "loading"

  const firstName = user?.name?.split(/\s+/)[0] || "there"
  const orgName = user?.agencyName || "Your organization"
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date())

  const attentionLead =
    approvalsStatus === "ok" && pending[0]
      ? pending[0].title
      : canSeeFinance && overBudget[0]
        ? `${overBudget[0].projectName} is near its budget limit`
        : null

  const subtitle = attentionLead
    ? `${attentionLead}. Open Agency OS to continue in your workspace.`
    : "Your organization Hub. Open Agency OS when you are ready to work."

  const projectsNote =
    projectsStatus === "loading" || bootLoading
      ? "Loading…"
      : projectsStatus === "error"
        ? "Unavailable"
        : activeProjects.length
          ? `${activeProjects.length} active`
          : "Open projects"

  const clientsNote =
    !canSeeClients
      ? "Not on your seat"
      : clientsStatus === "loading" || bootLoading
        ? "Loading…"
        : clientsStatus === "error"
          ? "Unavailable"
          : clients.length
            ? `${clients.length} accounts`
            : "Client accounts"

  const pipelineNote =
    !canSeeCrm
      ? "Not on your seat"
      : crmStatus === "loading" || bootLoading
        ? "Loading…"
        : crmStatus === "error"
          ? "Unavailable"
          : crm
            ? `${crm.openDeals} opportunities`
            : "Sales pipeline"

  const budgetsNote =
    !canSeeFinance
      ? "Not on your seat"
      : budgetsStatus === "loading" || bootLoading
        ? "Loading…"
        : budgetsStatus === "error"
          ? "Unavailable"
          : !financeAccess
            ? "Finance access required"
            : committedPct == null
              ? "No budgets yet"
              : `${committedPct}% committed`

  const reviewsNote =
    approvalsStatus === "loading" || bootLoading
      ? "Loading…"
      : approvalsStatus === "error"
        ? "Unavailable"
        : pending.length
          ? `${pending.length} waiting`
          : "No pending reviews"

  const clientPortalNote =
    approvalsStatus === "loading" || bootLoading
      ? "Loading…"
      : approvalsStatus === "error"
        ? "Reviews unavailable"
        : `${approvals.filter((a) => a.clientVisible).length} client-visible`

  const quickTiles: QuickTile[] = [
    {
      name: "Projects",
      to: "/projects",
      icon: FolderKanbanIcon,
      note: projectsNote,
    },
    {
      name: "Clients",
      to: "/clients",
      icon: UsersRoundIcon,
      note: clientsNote,
      gated: !canSeeClients,
    },
    {
      name: "Pipeline",
      to: "/crm",
      icon: CircleCheckIcon,
      note: pipelineNote,
      gated: !canSeeCrm,
    },
    {
      name: "Budgets",
      to: "/finance",
      icon: BadgeDollarSignIcon,
      note: budgetsNote,
      gated: !canSeeFinance,
    },
    {
      name: "Reviews & Reputation",
      to: "/hub/reputation",
      icon: StarIcon,
      note: "Feedback · reviews · testimonials",
    },
    {
      name: "Reports",
      to: "/hub/reports",
      icon: BarChart3Icon,
      note: "Hub library",
    },
    {
      name: "Shared Records",
      to: "/hub/records",
      icon: LayersIcon,
      note: "Clients · vendors · contacts",
    },
    {
      name: "Organization",
      to: "/hub/organization",
      icon: Building2Icon,
      note: "Profile · people · admin",
    },
    {
      name: "Creative Reviews",
      to: "/approvals",
      icon: FileCheck2Icon,
      note: reviewsNote,
    },
    {
      name: "Client Portal",
      to: "/portal/login",
      icon: BriefcaseBusinessIcon,
      note: clientPortalNote,
    },
    {
      name: "Spatial Stage",
      to: "/spatial-stage",
      icon: LayoutGridIcon,
      note: "Open stage layouts",
    },
    {
      name: "Agents",
      to: "/ai",
      icon: SparklesIcon,
      note: "Open Astrid",
    },
  ]

  const projectsKpiLoading = bootLoading || projectsStatus === "loading"
  const eventsKpiLoading = bootLoading || eventsStatus === "loading"
  const approvalsKpiLoading = bootLoading || approvalsStatus === "loading"

  return (
    <div
      className="cosmos-home"
      data-figma="00.04 · Portal · One Edition"
      data-node-id-status="unconfirmed-mcp-rate-limited"
    >
      <section className="portal-overview">
        <div className="portal-welcome">
          <div className="portal-eyebrow">
            <span />
            {dateLine} · {orgName}
          </div>
          <h1>
            {greetingFor()}, <em>{firstName}.</em>
          </h1>
          <p>{subtitle}</p>
        </div>
        <div className="portal-kpis">
          <HubKpi
            icon={FolderKanbanIcon}
            label="Active projects"
            value={
              projectsKpiLoading
                ? "—"
                : projectsStatus === "error"
                  ? "—"
                  : String(activeProjects.length)
            }
            note={
              projectsStatus === "error"
                ? "Projects unavailable"
                : clientsStatus === "ok" && canSeeClients && clients.length
                  ? `Across ${clients.length} clients`
                  : "Across your workspace"
            }
            to="/projects"
            unavailable={projectsStatus === "error"}
          />
          <HubKpi
            icon={CalendarDaysIcon}
            label="Next event"
            value={
              eventsKpiLoading
                ? "—"
                : eventsStatus === "error"
                  ? "—"
                  : nextEvent
                    ? dateDistance(nextEvent.startDate)
                    : "—"
            }
            note={
              eventsStatus === "error"
                ? "Events unavailable"
                : nextEvent?.name || "No upcoming events"
            }
            to="/events"
            unavailable={eventsStatus === "error"}
          />
          <HubKpi
            icon={FileCheck2Icon}
            label="Decisions"
            value={
              approvalsKpiLoading
                ? "—"
                : approvalsStatus === "error"
                  ? "—"
                  : String(pending.length)
            }
            note={
              approvalsStatus === "error"
                ? "Approvals unavailable"
                : pending.length
                  ? `${pending.length} waiting`
                  : "All clear"
            }
            tone={approvalsStatus === "ok" && pending.length ? "warning" : ""}
            to="/approvals"
            unavailable={approvalsStatus === "error"}
          />
          <HubKpi
            icon={UsersRoundIcon}
            label="Seats"
            value="—"
            note="Seat counts unavailable"
            unavailable
            to={canSeeBilling ? "/billing" : undefined}
          />
        </div>
      </section>

      <section className="portal-launchpad">
        <div className="portal-agency-tile">
          <img src="/cosmos-portal-hero.jpeg" alt="" />
          <div className="portal-agency-overlay" />
          <span className="portal-agency-badge">
            <img className="portal-edition-glyph-dark" src="/agency-edition-glyph-dark.svg" alt="" />
            <img className="portal-edition-glyph-light" src="/agency-edition-glyph-light.svg" alt="" />
          </span>
          <div className="portal-agency-copy">
            <h2>Agency OS</h2>
            <p>Creative, experiential, branding and marketing agencies</p>
            <Link to="/dashboard">
              Open Agency OS <ArrowUpRightIcon />
            </Link>
          </div>
        </div>
        <div className="portal-shortcuts">
          <div className="portal-shortcuts-heading">
            <h2>Quick Access</h2>
            <span>PINNED FOR YOU</span>
            <button type="button" disabled title="Hub pin customization is not available yet">
              Customize
            </button>
          </div>
          <div className="portal-shortcut-grid">
            {quickTiles.map(({ name, to, icon: Icon, note, gated }) =>
              gated ? (
                <span
                  key={name}
                  className={cn("portal-shortcut", "is-gated")}
                  title="Not available on your seat"
                >
                  <span className="portal-shortcut-icon">
                    <Icon />
                  </span>
                  <strong>{name}</strong>
                  <small>{note}</small>
                </span>
              ) : (
                <Link key={name} to={to} className="portal-shortcut">
                  <span className="portal-shortcut-icon">
                    <Icon />
                  </span>
                  <strong>{name}</strong>
                  <small>{note}</small>
                </Link>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="portal-bottom-grid">
        <div className="portal-panel portal-attention">
          <div className="portal-panel-heading">
            <h2>Needs Your Attention</h2>
            <Link to="/approvals">
              View All <ArrowRightIcon />
            </Link>
          </div>
          <div className="portal-attention-items">
            {attentionLoading ? (
              <div className="portal-loading">
                {[0, 1, 2].map((n) => (
                  <Skeleton key={n} />
                ))}
              </div>
            ) : (
              <>
                {approvalsStatus === "error" ? (
                  <div className="portal-section-error" role="alert">
                    <div>
                      <strong>Approvals unavailable</strong>
                      <small>{approvalsError || "Approvals could not be loaded."}</small>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadApprovals()}
                    >
                      <RefreshCwIcon /> Retry
                    </Button>
                  </div>
                ) : null}

                {approvalsStatus === "ok"
                  ? pending.slice(0, 3).map((approval, index) => (
                      <AttentionRow
                        key={approval.approvalId}
                        severity={index === 0 ? "warning" : "info"}
                        title={approval.title}
                        context={`${
                          approval.projectId
                            ? projects.find((p) => p.projectId === approval.projectId)
                                ?.projectName || "Agency OS"
                            : "Agency OS"
                        } · ${approval.entityType}`}
                        due={
                          approval.dueDate
                            ? `Due ${dayLabel(approval.dueDate)}`
                            : "Awaiting review"
                        }
                        action="Review"
                        to="/approvals"
                      />
                    ))
                  : null}

                {budgetAttentionFailed ? (
                  <div className="portal-section-error" role="alert">
                    <div>
                      <strong>Budget attention unavailable</strong>
                      <small>
                        {budgetsError ||
                          "Finance budget signals could not be loaded for Needs Attention."}
                      </small>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void loadBudgets()}
                    >
                      <RefreshCwIcon /> Retry
                    </Button>
                  </div>
                ) : null}

                {overBudget.map((budget) => (
                  <AttentionRow
                    key={budget.budgetId}
                    severity="warning"
                    title={`${budget.projectName} budget is ${Math.round(budget.utilization)}% committed`}
                    context="Agency OS · Finance"
                    due="Review budget"
                    action="Inspect"
                    to="/finance"
                  />
                ))}

                {showAttentionCaughtUp ? (
                  <div className="portal-empty">
                    <CircleCheckIcon />
                    <span>
                      <strong>All caught up</strong>
                      <small>New decisions will appear here.</small>
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div className="portal-severity-legend">
            <span className="is-warning">● Critical</span>
            <span className="is-caution">◉ Warning</span>
            <span className="is-info">◉ Info</span>
            <span className="is-ready">✓ Ready</span>
            <small>SEVERITY</small>
          </div>
        </div>

        <div className="portal-panel portal-insights">
          <div className="portal-panel-heading">
            <h2>
              <span className="portal-astrid-glyph">
                <img src="/figma-astrid.svg" alt="" />
              </span>
              Astrid Insights
            </h2>
            <Link to="/ai">
              Open Astrid <ArrowRightIcon />
            </Link>
          </div>
          <div className="portal-empty portal-insights-empty">
            <SparklesIcon />
            <span>
              <strong>Insights are not generated on the Hub yet</strong>
              <small>
                Astrid can explore records you can access inside Agency OS. No fabricated
                recommendations are shown here.
              </small>
              <Link to="/ai">
                Start a conversation <ArrowRightIcon />
              </Link>
            </span>
          </div>
        </div>

        <aside className="portal-right-rail">
          <div className="portal-panel portal-recent">
            <div className="portal-panel-heading">
              <h2>Continue Where You Left Off</h2>
              <Link to="/projects">
                View All <ArrowRightIcon />
              </Link>
            </div>
            {projectsStatus === "loading" || bootLoading ? (
              <div className="portal-loading">
                {[0, 1, 2].map((n) => (
                  <Skeleton key={n} />
                ))}
              </div>
            ) : projectsStatus === "error" ? (
              <div className="portal-rail-empty">
                Recent projects unavailable — open Projects to retry.
              </div>
            ) : recentProjects.length ? (
              <div className="portal-recent-list">
                {recentProjects.map((project, index) => (
                  <Link
                    className="portal-recent-item"
                    key={project.projectId}
                    to={`/projects/${project.projectId}`}
                  >
                    <span className={`portal-recent-thumb portal-thumb-${index}`}>
                      <img
                        src={
                          [
                            "/cosmos-project-shortlist.png",
                            "/cosmos-project-kairo.jpeg",
                            "/cosmos-project-playbook.png",
                          ][index] || "/cosmos-project-shortlist.png"
                        }
                        alt=""
                      />
                    </span>
                    <span className="portal-recent-copy">
                      <strong>{project.projectName}</strong>
                      <small>
                        <i /> Agency OS
                      </small>
                    </span>
                    <time>{timeAgo(project.updatedAt || project.createdAt)}</time>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="portal-rail-empty">Recent projects will appear here.</div>
            )}
          </div>

          <div className="portal-panel portal-plan">
            <div className="portal-panel-heading">
              <h2>Plan & Seats</h2>
              {canSeeBilling ? (
                <Link to="/billing">Explore Editions</Link>
              ) : (
                <span className="portal-muted-link">Explore Editions</span>
              )}
            </div>
            <div className="portal-unavailable-panel">
              <WalletCardsIcon />
              <div>
                <strong>Plan and seats unavailable</strong>
                <p>
                  Seat and plan figures are not sourced from this agency yet. The billing
                  endpoint returns static platform defaults, so numbers are not shown here.
                </p>
                {canSeeBilling ? (
                  <Button size="sm" variant="outline" render={<Link to="/billing" />}>
                    Open billing
                  </Button>
                ) : null}
              </div>
            </div>
            {canAdminOrg ? (
              <div className="portal-plan-admin">
                <Button size="sm" variant="outline" render={<Link to="/hub/members" />}>
                  Members & Roles
                </Button>
                <Button size="sm" variant="outline" render={<Link to="/settings" />}>
                  Organization settings
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      <footer className="portal-footer">
        Astra Black Cosmos™ <span>·</span> Privacy <span>·</span> Terms
      </footer>
    </div>
  )
}

function HubKpi({
  icon: Icon,
  label,
  value,
  note,
  to,
  tone = "",
  unavailable = false,
}: {
  icon: typeof FolderKanbanIcon
  label: string
  value: string
  note: string
  to?: string
  tone?: string
  unavailable?: boolean
}) {
  const body = (
    <>
      <span className="portal-kpi-label">
        <Icon />
        {label}
      </span>
      <strong
        className={cn(tone ? `is-${tone}` : undefined, unavailable && "is-unavailable")}
      >
        {value}
      </strong>
      <small>{note}</small>
    </>
  )
  if (to) {
    return (
      <Link className={cn("portal-kpi", unavailable && "is-unavailable")} to={to}>
        {body}
      </Link>
    )
  }
  return (
    <div className={cn("portal-kpi", unavailable && "is-unavailable")}>{body}</div>
  )
}

function AttentionRow({
  severity,
  title,
  context,
  due,
  action,
  to,
}: {
  severity: "warning" | "info" | "ready"
  title: string
  context: string
  due: string
  action: string
  to: string
}) {
  const Icon =
    severity === "warning" ? WalletCardsIcon : severity === "info" ? RadioIcon : CheckIcon
  return (
    <Link to={to} className="portal-attention-row">
      <span className={`portal-attention-status is-${severity}`}>
        <Icon />
      </span>
      <span className="portal-attention-text">
        <strong>{title}</strong>
        <small>
          {context}
          <b> · </b>
          {due}
        </small>
      </span>
      <span className={`portal-row-action is-${severity}`}>{action}</span>
    </Link>
  )
}
