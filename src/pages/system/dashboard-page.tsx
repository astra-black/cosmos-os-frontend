import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CheckSquareIcon,
  ClockIcon,
  ExternalLinkIcon,
  FolderKanbanIcon,
  GitBranchIcon,
  LineChartIcon,
  ListTodoIcon,
  RadioIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import { useAuth } from "@/lib/auth"
import { PageHeader } from "@/components/shared/page-header"
import { ConflictDetectorBanner } from "@/components/widgets/conflict-detector-banner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import {
  getCrmSummary,
  listActivity,
  listAllIncidents,
  listApprovals,
  listClients,
  listEvents,
  listProjects,
  listTasks,
  normalizeProjects,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { listBudgets, type BudgetRow } from "@/lib/api/platform"
import type {
  ActivityItem,
  AgencyClient,
  Approval,
  CrmSummary,
  Event,
  Incident,
  Project,
  Task,
} from "@/types/agency"
import { cn } from "@/lib/utils"

function money(n?: number) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

const OPEN_TASK = new Set(["todo", "in_progress", "review", "blocked"])
const PENDING_APPR = new Set(["pending", "changes_requested"])
const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
  NotStarted: "Not started",
  InProgress: "In progress",
  Review: "Review",
  Approved: "Approved",
  Complete: "Complete",
}

function startOfToday() {
  return new Date(new Date().toDateString())
}

function isOverdueTask(t: Task) {
  return (
    Boolean(t.dueDate) &&
    t.status !== "done" &&
    new Date(t.dueDate!) < startOfToday()
  )
}

function countBy<T>(items: T[], getKey: (item: T) => string | undefined | null) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "unknown"
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
}

function prettyStatus(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ")
}

export function DashboardPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [crm, setCrm] = useState<CrmSummary | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [tasksRes, apprRes, clientsRes, projectsRes, crmRes, actRes, budgetsRes, incidentsRes, eventsRes] =
          await Promise.all([
            listTasks(),
            listApprovals(),
            listClients(),
            listProjects(),
            getCrmSummary(),
            listActivity(12),
            listBudgets().catch((err) => {
              console.warn('[Dashboard] Failed to load budgets:', err)
              return { data: [] }
            }),
            listAllIncidents().catch((err) => {
              console.warn('[Dashboard] Failed to load incidents:', err)
              return { data: [] }
            }),
            listEvents({ limit: 10 }).catch((err) => {
              console.warn('[Dashboard] Failed to load events:', err)
              return { data: [] }
            }),
          ])
        if (cancelled) return
        setTasks(tasksRes.data ?? [])
        setApprovals(apprRes.data ?? [])
        setClients(clientsRes.data ?? [])
        setProjects(normalizeProjects(projectsRes))
        setCrm(crmRes.data ?? null)
        setActivity(actRes.data ?? [])
        setBudgets(budgetsRes.data ?? [])
        setIncidents(incidentsRes.data ?? [])
        setEvents(eventsRes.data ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load dashboard")
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

  const openTasks = useMemo(
    () => tasks.filter((t) => OPEN_TASK.has(t.status)),
    [tasks],
  )
  const blockedOrCritical = useMemo(
    () =>
      openTasks.filter(
        (t) => t.status === "blocked" || t.priority === "critical" || t.priority === "high",
      ),
    [openTasks],
  )
  const pendingApprovals = useMemo(
    () => approvals.filter((a) => PENDING_APPR.has(a.status)),
    [approvals],
  )
  const atRiskClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.health === "watch" ||
          c.health === "risk" ||
          c.stage === "paused" ||
          c.stage === "onboarding",
      ),
    [clients],
  )
  const activeProjects = useMemo(
    () =>
      projects.filter((p) =>
        ["InProgress", "Review", "NotStarted"].includes(p.status),
      ),
    [projects],
  )
  const openIncidents = useMemo(
    () =>
      incidents.filter((i) =>
        ["open", "in_progress", "escalated"].includes(String(i.status || "").toLowerCase()),
      ),
    [incidents],
  )
  const criticalIncidents = useMemo(
    () =>
      openIncidents.filter(
        (i) => String(i.severity || "").toLowerCase() === "critical",
      ),
    [openIncidents],
  )

  /** Actionable queues for the Needs attention strip (product filters) */
  const overdueTasks = useMemo(
    () => tasks.filter(isOverdueTask),
    [tasks],
  )
  const blockedTasks = useMemo(
    () => tasks.filter((t) => t.status === "blocked"),
    [tasks],
  )
  const stuckApprovals = pendingApprovals
  const attentionClients = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.health === "watch" ||
          c.health === "risk" ||
          c.stage === "paused",
      ),
    [clients],
  )
  const budgetRisks = useMemo(
    () => budgets.filter((budget) => budget.penaltyRisk || (budget.minimumShortfall ?? 0) > 0),
    [budgets],
  )
  const shortfallPenaltyRisks = useMemo(
    () =>
      budgets.filter(
        (b) => Number(b.contractedMinimum || 0) > 0 && (b.minimumShortfall ?? 0) > 0,
      ),
    [budgets],
  )
  const urgent14DayShortfalls = useMemo(
    () =>
      shortfallPenaltyRisks.filter(
        (b) =>
          b.is14DayAlert ||
          (b.daysUntilKickoff !== null &&
            b.daysUntilKickoff !== undefined &&
            b.daysUntilKickoff <= 14 &&
            b.daysUntilKickoff >= 0),
      ),
    [shortfallPenaltyRisks],
  )
  const needsAttentionCount = useMemo(() => {
    const taskIds = new Set<string>()
    for (const t of overdueTasks) taskIds.add(t.taskId)
    for (const t of blockedTasks) taskIds.add(t.taskId)
    return (
      taskIds.size +
      stuckApprovals.length +
      attentionClients.length +
      shortfallPenaltyRisks.length +
      openIncidents.length
    )
  }, [overdueTasks, blockedTasks, stuckApprovals, attentionClients, shortfallPenaltyRisks, openIncidents])

  const workloadChartData = useMemo(() => {
    const taskCounts = countBy(tasks, (task) => task.status)
    return ["todo", "in_progress", "review", "blocked", "done"].map((status) => ({
      status: prettyStatus(status),
      tasks: taskCounts[status] ?? 0,
    }))
  }, [tasks])

  const projectStatusData = useMemo(() => {
    const projectCounts = countBy(projects, (project) => project.status)
    return Object.entries(projectCounts)
      .map(([status, value]) => ({
        status: prettyStatus(status),
        projects: value,
      }))
      .sort((a, b) => b.projects - a.projects)
  }, [projects])

  const pipelineTrendData = useMemo(() => {
    const pipeline = crm?.pipelineValue ?? 0
    const weighted = crm?.weightedPipeline ?? 0
    const won = crm?.wonValue ?? 0
    const open = crm?.openDeals ?? 0
    return [
      { label: "Won", value: won },
      { label: "Weighted", value: weighted },
      { label: "Pipeline", value: pipeline },
      { label: "Open deals", value: open ? pipeline + open * 2500 : pipeline },
    ]
  }, [crm])

  const workloadConfig = {
    tasks: { label: "Tasks", color: "var(--chart-3)" },
  } satisfies ChartConfig

  const projectConfig = {
    projects: { label: "Projects", color: "var(--chart-2)" },
  } satisfies ChartConfig

  const liveEvents = useMemo(
    () => events.filter((e) => e.status === "live"),
    [events],
  )

  const avgProgress = useMemo(() => {
    if (activeProjects.length === 0) return 0
    const total = activeProjects.reduce((acc, p) => {
      const pTasks = tasks.filter((t) => t.projectId === p.projectId)
      const pProg =
        pTasks.length > 0
          ? Math.round(
              (pTasks.filter((t) => t.status === "done").length / pTasks.length) * 100,
            )
          : p.status === "Approved" || p.status === "Complete"
            ? 100
            : p.status === "Review"
              ? 80
              : p.status === "InProgress"
                ? 55
                : 15
      return acc + pProg
    }, 0)
    return Math.round(total / activeProjects.length)
  }, [activeProjects, tasks])

  const priorities = useMemo(() => {
    const list: Array<{
      id: string
      title: string
      description: string
      source: string
      priority: "critical" | "warning" | "high"
      link: string
    }> = []

    // Critical incidents
    criticalIncidents.forEach((inc) => {
      list.push({
        id: `inc-${inc.id || inc.incidentId}`,
        title: inc.title || "Critical event incident",
        description: inc.departmentName
          ? `${inc.departmentName} · Requires immediate review`
          : "Event operations incident",
        source: "Live Operations",
        priority: "critical",
        link: "/incidents",
      })
    })

    // Urgent budget shortfalls
    urgent14DayShortfalls.forEach((b) => {
      list.push({
        id: `bud-${b.budgetId || b.projectId}`,
        title: `Spend minimum shortfall: ${b.projectName || "Event Budget"}`,
        description: `Shortfall of ${money(b.minimumShortfall)} within 14-day alert window`,
        source: "Finance",
        priority: "critical",
        link: "/finance",
      })
    })

    // Blocked tasks
    blockedTasks.slice(0, 3).forEach((t) => {
      list.push({
        id: `task-b-${t.taskId}`,
        title: t.title || "Blocked deliverable",
        description: t.projectName ? `Project: ${t.projectName}` : "Task blocked in pipeline",
        source: "Tasks",
        priority: "warning",
        link: "/tasks",
      })
    })

    // Overdue tasks
    overdueTasks.slice(0, 3).forEach((t) => {
      list.push({
        id: `task-od-${t.taskId}`,
        title: t.title || "Overdue task",
        description: `Deadline was ${t.dueDate || "overdue"}`,
        source: "Tasks",
        priority: "warning",
        link: "/tasks",
      })
    })

    // Pending approvals
    pendingApprovals.slice(0, 3).forEach((a) => {
      list.push({
        id: `appr-${a.approvalId}`,
        title: a.title || "Proof awaiting review",
        description: a.requester ? `Requested by ${a.requester} · Waiting on sign-off` : "Proof review",
        source: "Approvals",
        priority: "high",
        link: "/approvals",
      })
    })

    return list.slice(0, 5)
  }, [criticalIncidents, urgent14DayShortfalls, blockedTasks, overdueTasks, pendingApprovals])

  const upcomingMilestones = useMemo(() => {
    const items: Array<{
      id: string
      title: string
      project: string
      date: Date
      month: string
      day: string
      status: string
      link: string
    }> = []

    tasks
      .filter((t) => t.dueDate && t.status !== "done")
      .forEach((t) => {
        const d = new Date(t.dueDate!)
        if (!isNaN(d.getTime())) {
          items.push({
            id: `m-task-${t.taskId}`,
            title: t.title,
            project: t.projectName || "General",
            date: d,
            month: d.toLocaleString("default", { month: "short" }).toUpperCase(),
            day: String(d.getDate()).padStart(2, "0"),
            status: t.status === "review" ? "In Review" : t.priority === "critical" ? "Urgent" : "Pending",
            link: "/tasks",
          })
        }
      })

    projects
      .filter((p) => p.endDate && p.status !== "Complete")
      .forEach((p) => {
        const d = new Date(p.endDate!)
        if (!isNaN(d.getTime())) {
          items.push({
            id: `m-proj-${p.projectId}`,
            title: `${p.projectName} Milestone`,
            project: p.clientName || "Project Milestone",
            date: d,
            month: d.toLocaleString("default", { month: "short" }).toUpperCase(),
            day: String(d.getDate()).padStart(2, "0"),
            status: p.status,
            link: `/projects/${p.projectId}`,
          })
        }
      })

    return items
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5)
  }, [tasks, projects])

  function avatarBg(name: string) {
    const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
    return `hsl(${hue}deg 60% 45%)`
  }

  function getProjectHealth(project: Project) {
    if (project.status === "Approved" || project.status === "Complete") return "Completed"
    if (project.status === "Review") return "In Review"
    if (project.status === "InProgress") return "On Track"
    return "Planning"
  }

  function getHealthVariant(health: string): "success" | "warning" | "danger" | "purple" | "default" {
    const h = health.toLowerCase()
    if (h.includes("track") || h.includes("complete") || h.includes("won")) return "success"
    if (h.includes("risk") || h.includes("review") || h.includes("hold")) return "warning"
    if (h.includes("delayed") || h.includes("overdue") || h.includes("lost")) return "danger"
    return "purple"
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Card className="border-destructive/40 bg-destructive/5 text-destructive px-4 py-3 text-sm">
          {error}
        </Card>
      )}

      <ConflictDetectorBanner />

      {/* ── 1. Hero Card ─────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-2xl p-7 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #270045 0%, #17002b 100%)" }}
      >
        {/* Subtle radial glow */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full blur-3xl opacity-35"
          style={{ background: "radial-gradient(circle, #7a5cc2 0%, transparent 70%)" }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider bg-white/10 text-white/90 backdrop-blur-sm border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {user?.role ? `${user.role.toUpperCase()} WORKSPACE` : "ADMIN WORKSPACE"}
            </div>
            <h1 className="font-sora text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.name || "Team"}
            </h1>
            <p className="text-sm text-white/70 leading-relaxed">
              {activeProjects.length} active projects, {pendingApprovals.length} proofs awaiting review
              {liveEvents.length > 0
                ? `, and ${liveEvents.length} live event operation running right now.`
                : ", and production operations on track."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {liveEvents.length > 0 ? (
              <Button
                variant="pastel"
                className="rounded-full shadow-md font-semibold px-5"
                render={<Link to="/events" />}
              >
                <RadioIcon className="size-4 animate-pulse text-rose-300 mr-1" />
                Open live operations →
              </Button>
            ) : (
              <Button
                variant="pastel"
                className="rounded-full shadow-md font-semibold px-5"
                render={<Link to="/events" />}
              >
                Open live operations →
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              render={<Link to="/projects" />}
            >
              All projects
            </Button>
          </div>
        </div>
      </section>

      {/* ── 2. KPI Stat Tiles ────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Stat 1: Active Projects */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active projects
            </p>
            <p className="font-sora text-3xl font-bold text-foreground mt-2">
              {activeProjects.length}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="purple" className="text-xs">
              {avgProgress}% avg progress
            </Badge>
            <span className="text-xs text-muted-foreground">{projects.length} total</span>
          </div>
        </div>

        {/* Stat 2: Awaiting Approval */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Awaiting approval
            </p>
            <p className="font-sora text-3xl font-bold text-foreground mt-2">
              {pendingApprovals.length}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Badge
              variant={pendingApprovals.length > 0 ? "warning" : "success"}
              className="text-xs"
            >
              {pendingApprovals.length} proofs pending
            </Badge>
            <span className="text-xs text-muted-foreground">sign-off</span>
          </div>
        </div>

        {/* Stat 3: Revenue Invoiced */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Revenue invoiced
            </p>
            <p className="font-sora text-3xl font-bold text-foreground mt-2">
              {money(crm?.wonValue || crm?.pipelineValue || 0)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="success" className="text-xs">
              {money(crm?.wonValue || 0)} won
            </Badge>
            <span className="text-xs text-muted-foreground">{crm?.openDeals ?? 0} active deals</span>
          </div>
        </div>

        {/* Stat 4: Hours Saved by AI */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hours saved by AI
            </p>
            <p className="font-sora text-3xl font-bold text-foreground mt-2">96h</p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="pink" className="text-xs">
              <SparklesIcon className="size-3 mr-1" />
              14 automations
            </Badge>
            <span className="text-xs text-muted-foreground">Astrid AI engine</span>
          </div>
        </div>
      </div>

      {/* ── 3. Two-Column Section: Priorities + Milestones ───── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Left: Top priorities */}
        <Card className="p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-sora font-semibold text-base text-foreground">Top priorities</h2>
              <Badge variant="outline" className="text-xs">
                {priorities.length} items
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Suggestions, improvements and what needs doing next
            </p>
            <div className="space-y-3">
              {priorities.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  className="group flex items-start gap-3 rounded-lg border border-border/60 p-3 hover:border-primary/40 hover:bg-surface-alt/60 transition-all"
                >
                  <div
                    className={cn(
                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                      item.priority === "critical"
                        ? "bg-destructive animate-pulse"
                        : item.priority === "warning"
                          ? "bg-amber-500"
                          : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </p>
                      <Badge
                        variant={
                          item.priority === "critical"
                            ? "danger"
                            : item.priority === "warning"
                              ? "warning"
                              : "purple"
                        }
                        className="text-[10px] shrink-0 uppercase"
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                    <span className="text-[10px] font-medium text-muted-foreground/70 mt-1 inline-block">
                      {item.source}
                    </span>
                  </div>
                </Link>
              ))}
              {priorities.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2Icon className="mx-auto size-6 text-success mb-2" />
                  All high-priority queues are clear.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Right: Upcoming milestones */}
        <Card className="p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-sora font-semibold text-base text-foreground">
                Upcoming milestones
              </h2>
              <Link to="/milestones" className="text-xs font-semibold text-primary hover:underline">
                Milestones →
              </Link>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Target deliverables and deadlines</p>
            <div className="space-y-3">
              {upcomingMilestones.map((m) => (
                <Link
                  key={m.id}
                  to={m.link}
                  className="group flex items-start gap-3.5 rounded-lg border border-border/60 p-2.5 hover:border-primary/40 hover:bg-surface-alt/60 transition-all"
                >
                  <div className="flex flex-col items-center justify-center w-10 py-1 rounded-md bg-surface-alt border border-border/80 shrink-0">
                    <span className="text-[9px] font-bold text-muted-foreground tracking-wider">
                      {m.month}
                    </span>
                    <span className="font-sora text-base font-bold text-foreground leading-none">
                      {m.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {m.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.project}</p>
                    <div className="mt-1">
                      <Badge variant="gray" className="text-[10px]">
                        {m.status}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
              {upcomingMilestones.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No upcoming milestone deadlines recorded.
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ── 4. Active Projects Grid ──────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-sora text-xl font-bold text-foreground">Active projects</h2>
            <p className="text-xs text-muted-foreground">
              Overview of client engagements and live campaigns
            </p>
          </div>
          <Button variant="ghost" size="sm" render={<Link to="/projects" />}>
            View all projects ({activeProjects.length}) →
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeProjects.slice(0, 6).map((project) => {
            const pTasks = tasks.filter((t) => t.projectId === project.projectId)
            const progress =
              pTasks.length > 0
                ? Math.round(
                    (pTasks.filter((t) => t.status === "done").length / pTasks.length) * 100,
                  )
                : project.status === "Approved" || project.status === "Complete"
                  ? 100
                  : project.status === "Review"
                    ? 80
                    : project.status === "InProgress"
                      ? 55
                      : 15
            const health = getProjectHealth(project)
            const healthVar = getHealthVariant(health)
            const clientLabel = project.clientName || project.clientId || "Client Account"

            return (
              <Link
                key={project.projectId}
                to={`/projects/${project.projectId}`}
                className="group block rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_0_rgba(39,0,69,0.06)] hover:shadow-md hover:border-primary/40 transition-all"
              >
                {/* Cover placeholder with dark purple brand gradient */}
                <div
                  className="relative h-28 w-full p-3 flex items-start justify-between"
                  style={{ background: "linear-gradient(135deg, #270045 0%, #17002b 100%)" }}
                >
                  <Badge variant={healthVar} className="shadow-sm">
                    {health}
                  </Badge>
                  <span className="text-[11px] font-medium text-white/50 bg-black/30 backdrop-blur-xs px-2 py-0.5 rounded-full">
                    {pTasks.length} tasks
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-sora font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {project.projectName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{clientLabel}</p>
                  </div>

                  {/* Gradient progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">Progress</span>
                      <span className="font-medium text-foreground">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-alt overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(0, progress))}%`,
                          background:
                            "linear-gradient(115deg, oklch(48% 0.23 295), oklch(58% 0.24 350), oklch(68% 0.18 50))",
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer: avatar stack + due date */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs text-muted-foreground">
                    <div className="flex -space-x-1.5">
                      {["Alex M", "Jordan K", "Sarah T"].map((name, i) => (
                        <div
                          key={i}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white shadow-xs"
                          style={{ background: avatarBg(name + project.projectName) }}
                          title={name}
                        >
                          {name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px]">
                      {project.endDate ? `Due ${project.endDate}` : "Active cycle"}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
          {activeProjects.length === 0 && (
            <Card className="col-span-full p-8 text-center text-sm text-muted-foreground">
              No active projects yet.
            </Card>
          )}
        </div>
      </div>

      {/* ── 5. Bottom 3-Column Row ───────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Col 1: Needs your review */}
        <Card className="p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-sora font-semibold text-sm text-foreground flex items-center gap-2">
                <ShieldCheckIcon className="size-4 text-primary" />
                Needs your review
              </h2>
              <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/approvals" />}>
                All →
              </Button>
            </div>
            <ul className="flex flex-col gap-2.5">
              {pendingApprovals.slice(0, 5).map((appr) => (
                <li key={appr.approvalId}>
                  <Link
                    to="/approvals"
                    className="hover:bg-surface-alt/70 hover:border-primary/40 flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-sm transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{appr.title}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {appr.requester ? `Requested by ${appr.requester}` : (appr.entityType || "General Proof")}
                      </div>
                    </div>
                    <Badge variant="purple" className="shrink-0 text-[10px]">
                      Proof
                    </Badge>
                  </Link>
                </li>
              ))}
              {pendingApprovals.length === 0 && (
                <p className="text-muted-foreground text-xs py-4 text-center">
                  Queue clear — no proofs awaiting review.
                </p>
              )}
            </ul>
          </div>
        </Card>

        {/* Col 2: Live & upcoming events */}
        <Card className="p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-sora font-semibold text-sm text-foreground flex items-center gap-2">
                <RadioIcon className="size-4 text-rose-500" />
                Live & upcoming events
              </h2>
              <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/events" />}>
                All →
              </Button>
            </div>
            <ul className="flex flex-col gap-2.5">
              {events.slice(0, 5).map((ev) => {
                const isLive = ev.status === "live"
                return (
                  <li key={ev.eventId || ev.id}>
                    <Link
                      to={`/events/${ev.eventId || ev.id}`}
                      className="hover:bg-surface-alt/70 hover:border-primary/40 flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-sm transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
                          {isLive && (
                            <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                          )}
                          <span className="truncate">{ev.name}</span>
                        </div>
                        <div className="text-muted-foreground truncate text-xs">
                          {ev.venue || ev.location || "Venue TBA"}
                          {ev.startDate ? ` · ${new Date(ev.startDate).toLocaleDateString()}` : ""}
                        </div>
                      </div>
                      <Badge
                        variant={isLive ? "live" : ev.status === "confirmed" ? "success" : "purple"}
                        className="shrink-0 text-[10px] capitalize"
                      >
                        {ev.status || "Scheduled"}
                      </Badge>
                    </Link>
                  </li>
                )
              })}
              {events.length === 0 && (
                <p className="text-muted-foreground text-xs py-4 text-center">
                  No upcoming events scheduled.
                </p>
              )}
            </ul>
          </div>
        </Card>

        {/* Col 3: Recent activity */}
        <Card className="p-5 flex flex-col justify-between shadow-[0_1px_3px_0_rgba(39,0,69,0.06)]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-sora font-semibold text-sm text-foreground flex items-center gap-2">
                <ZapIcon className="size-4 text-amber-500" />
                Recent activity
              </h2>
              <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/activity" />}>
                Feed →
              </Button>
            </div>
            <ul className="flex flex-col gap-2.5">
              {activity.slice(0, 5).map((item) => {
                const href =
                  item.entityType === "client" && item.entityId
                    ? `/clients/${item.entityId}`
                    : item.entityType === "project" && item.entityId
                      ? `/projects/${item.entityId}`
                      : "/activity"
                return (
                  <li key={item.activityId}>
                    <Link
                      to={href}
                      className="hover:bg-surface-alt/70 hover:border-primary/40 block rounded-lg border border-border/70 px-3 py-2.5 text-sm transition-colors"
                    >
                      <div className="font-medium text-foreground truncate">{item.title}</div>
                      <div className="text-muted-foreground text-xs mt-0.5 truncate">
                        {item.actor || "System"}
                        {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString()}` : ""}
                      </div>
                    </Link>
                  </li>
                )
              })}
              {activity.length === 0 && (
                <p className="text-muted-foreground text-xs py-4 text-center">
                  No recent activity recorded.
                </p>
              )}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
