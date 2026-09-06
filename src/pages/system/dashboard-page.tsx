import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangleIcon,
  BriefcaseIcon,
  CheckSquareIcon,
  FolderKanbanIcon,
  GitBranchIcon,
  LineChartIcon,
  ListTodoIcon,
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

import { PageHeader } from "@/components/shared/page-header"
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
  listApprovals,
  listClients,
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
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
        const [tasksRes, apprRes, clientsRes, projectsRes, crmRes, actRes, budgetsRes] =
          await Promise.all([
            listTasks(),
            listApprovals(),
            listClients(),
            listProjects(),
            getCrmSummary(),
            listActivity(12),
            listBudgets().catch(() => ({ data: [] })),
          ])
        if (cancelled) return
        setTasks(tasksRes.data ?? [])
        setApprovals(apprRes.data ?? [])
        setClients(clientsRes.data ?? [])
        setProjects(normalizeProjects(projectsRes))
        setCrm(crmRes.data ?? null)
        setActivity(actRes.data ?? [])
        setBudgets(budgetsRes.data ?? [])
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
  const needsAttentionCount = useMemo(() => {
    const taskIds = new Set<string>()
    for (const t of overdueTasks) taskIds.add(t.taskId)
    for (const t of blockedTasks) taskIds.add(t.taskId)
    return taskIds.size + stuckApprovals.length + attentionClients.length + budgetRisks.length
  }, [overdueTasks, blockedTasks, stuckApprovals, attentionClients, budgetRisks])

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

  const pipelineConfig = {
    value: { label: "Value", color: "var(--chart-1)" },
  } satisfies ChartConfig

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Agency home"
        description="What needs you today — tasks, approvals, pipeline, and accounts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link to="/tasks" />}>
              Tasks
            </Button>
            <Button size="sm" variant="outline" render={<Link to="/projects" />}>
              Projects
            </Button>
            <Button size="sm" render={<Link to="/crm" />}>
              Pipeline
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <StatisticsCard
              title="Open tasks"
              value={String(openTasks.length)}
              changePercentage={`${blockedOrCritical.length} high / blocked`}
              icon={<ListTodoIcon className="size-4" />}
            />
            <StatisticsCard
              title="Approvals queue"
              value={String(pendingApprovals.length)}
              changePercentage="pending review"
              icon={<CheckSquareIcon className="size-4" />}
            />
            <StatisticsCard
              title="Pipeline"
              value={money(crm?.pipelineValue)}
              changePercentage={`${crm?.openDeals ?? 0} open deals`}
              icon={<GitBranchIcon className="size-4" />}
            />
            <StatisticsCard
              title="Active projects"
              value={String(activeProjects.length)}
              changePercentage={`${atRiskClients.length} accounts need care`}
              icon={<FolderKanbanIcon className="size-4" />}
            />
          </div>

          <Card className="flex min-h-80 flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <GitBranchIcon className="size-4" />
                Pipeline visualization
              </h2>
              <div className="text-muted-foreground text-xs">
                Weighted {money(crm?.weightedPipeline)} · Won {money(crm?.wonValue)}
              </div>
            </div>
            <ChartContainer config={pipelineConfig} className="h-64 w-full">
              <AreaChart accessibilityLayer data={pipelineTrendData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickFormatter={(value) => money(Number(value))}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value) => money(Number(value))}
                    />
                  }
                />
                <Area
                  dataKey="value"
                  type="monotone"
                  fill="var(--color-value)"
                  fillOpacity={0.18}
                  stroke="var(--color-value)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </Card>
        </div>

        <Card
          className={cn(
            "flex flex-col gap-3 p-4",
            needsAttentionCount > 0 && "border-destructive/25 bg-destructive/[0.03]",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangleIcon
                className={cn(
                  "size-4",
                  needsAttentionCount > 0 ? "text-destructive" : "text-muted-foreground",
                )}
              />
              Needs attention
              {needsAttentionCount > 0 ? (
                <span className="text-muted-foreground font-normal">
                  ({needsAttentionCount})
                </span>
              ) : null}
            </h2>
            {needsAttentionCount > 0 ? (
              <div className="text-muted-foreground flex flex-wrap gap-1.5 text-xs">
                {overdueTasks.length > 0 ? (
                  <Badge variant="secondary" className="font-normal">
                    {overdueTasks.length} overdue
                  </Badge>
                ) : null}
                {blockedTasks.length > 0 ? (
                  <Badge
                    variant="secondary"
                    className="bg-destructive/15 text-destructive font-normal"
                  >
                    {blockedTasks.length} blocked
                  </Badge>
                ) : null}
                {stuckApprovals.length > 0 ? (
                  <Badge variant="outline" className="font-normal">
                    {stuckApprovals.length} approvals
                  </Badge>
                ) : null}
                {attentionClients.length > 0 ? (
                  <Badge variant="outline" className="font-normal capitalize">
                    {attentionClients.length} accounts
                  </Badge>
                ) : null}
                {budgetRisks.length > 0 ? (
                  <Badge variant="outline" className="font-normal">
                    {budgetRisks.length} finance
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          {needsAttentionCount === 0 ? (
            <p className="text-muted-foreground text-sm">All clear for now</p>
          ) : (
            <div className="grid gap-4">
            {overdueTasks.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Overdue tasks ({overdueTasks.length})
                </div>
                <ul className="flex flex-col gap-2">
                  {overdueTasks.slice(0, 5).map((t) => (
                    <li key={t.taskId}>
                      <Link
                        to={t.projectId ? `/projects/${t.projectId}` : "/tasks"}
                        className="hover:bg-muted/50 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.title}</div>
                          <div className="text-muted-foreground truncate text-xs">
                            {t.projectName || t.projectId || "No project"}
                            {t.dueDate
                              ? ` · due ${new Date(t.dueDate).toLocaleDateString()}`
                              : ""}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-destructive/15 text-destructive shrink-0"
                        >
                          Overdue
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                {overdueTasks.length > 5 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 self-start text-xs"
                    render={<Link to="/tasks" />}
                  >
                    +{overdueTasks.length - 5} more on board
                  </Button>
                ) : null}
              </div>
            ) : null}

            {blockedTasks.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Blocked tasks ({blockedTasks.length})
                </div>
                <ul className="flex flex-col gap-2">
                  {blockedTasks.slice(0, 5).map((t) => (
                    <li key={t.taskId}>
                      <Link
                        to={t.projectId ? `/projects/${t.projectId}` : "/tasks"}
                        className="hover:bg-muted/50 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.title}</div>
                          <div className="text-muted-foreground truncate text-xs">
                            {t.projectName || t.projectId || "No project"} ·{" "}
                            {t.assignee || "Unassigned"}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-destructive/15 text-destructive shrink-0 capitalize"
                        >
                          Blocked
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                {blockedTasks.length > 5 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 self-start text-xs"
                    render={<Link to="/tasks" />}
                  >
                    +{blockedTasks.length - 5} more on board
                  </Button>
                ) : null}
              </div>
            ) : null}

            {stuckApprovals.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Stuck approvals ({stuckApprovals.length})
                </div>
                <ul className="flex flex-col gap-2">
                  {stuckApprovals.slice(0, 5).map((a) => (
                    <li key={a.approvalId}>
                      <Link
                        to={a.projectId ? `/projects/${a.projectId}` : "/approvals"}
                        className="hover:bg-muted/50 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{a.title}</div>
                          <div className="text-muted-foreground truncate text-xs">
                            {a.entityType}:{a.entityId}
                            {a.reviewer ? ` · ${a.reviewer}` : ""}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0 capitalize">
                          {a.status.replace("_", " ")}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                {stuckApprovals.length > 5 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 self-start text-xs"
                    render={<Link to="/approvals" />}
                  >
                    +{stuckApprovals.length - 5} in queue
                  </Button>
                ) : null}
              </div>
            ) : null}

            {attentionClients.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  At-risk accounts ({attentionClients.length})
                </div>
                <ul className="flex flex-col gap-2">
                  {attentionClients.slice(0, 5).map((c) => (
                    <li key={c.clientId}>
                      <Link
                        to={`/clients/${c.clientId}`}
                        className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="text-muted-foreground text-xs capitalize">
                            {c.stage}
                            {c.accountLead ? ` · ${c.accountLead}` : ""}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 capitalize">
                          {c.health || c.stage}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                {attentionClients.length > 5 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 self-start text-xs"
                    render={<Link to="/clients" />}
                  >
                    +{attentionClients.length - 5} in CRM
                  </Button>
                ) : null}
              </div>
            ) : null}
            {budgetRisks.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Contract risk ({budgetRisks.length})
                </div>
                <ul className="flex flex-col gap-2">
                  {budgetRisks.slice(0, 5).map((budget) => (
                    <li key={budget.budgetId}>
                      <Link
                        to="/finance"
                        className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">{budget.projectName}</div>
                          <div className="text-muted-foreground truncate text-xs">
                            Minimum {money(budget.contractedMinimum)} · spent {money(budget.spent)}
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-destructive/15 text-destructive shrink-0">
                          {money(budget.minimumShortfall ?? 0)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                {budgetRisks.length > 5 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 self-start text-xs"
                    render={<Link to="/finance" />}
                  >
                    +{budgetRisks.length - 5} in finance
                  </Button>
                ) : null}
              </div>
            ) : null}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4">
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <LineChartIcon className="size-4" />
              Delivery analytics
            </h2>
            <Badge variant="outline" className="font-normal">
              {tasks.length} tasks · {projects.length} projects
            </Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Task workload</span>
                <span className="font-medium">{openTasks.length} open</span>
              </div>
              <ChartContainer config={workloadConfig} className="h-56 w-full">
                <BarChart accessibilityLayer data={workloadChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="status"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="tasks" fill="var(--color-tasks)" radius={4} />
                </BarChart>
              </ChartContainer>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Project flow</span>
                <span className="font-medium">{activeProjects.length} active</span>
              </div>
              <ChartContainer config={projectConfig} className="h-56 w-full">
                <BarChart accessibilityLayer data={projectStatusData} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="status"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    width={84}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="projects" fill="var(--color-projects)" radius={4} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="flex flex-col gap-3 p-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ListTodoIcon className="size-4" />
              Focus tasks
            </h2>
            <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/tasks" />}>
              Board
            </Button>
          </div>
          {blockedOrCritical.length === 0 && openTasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No open tasks. Nice.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(blockedOrCritical.length ? blockedOrCritical : openTasks)
                .slice(0, 6)
                .map((t) => (
                  <li key={t.taskId}>
                    <Link
                      to={t.projectId ? `/projects/${t.projectId}` : "/tasks"}
                      className="hover:bg-muted/50 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.title}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {t.projectName || t.projectId || "No project"} · {t.assignee || "—"}
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0 capitalize",
                          t.status === "blocked" && "bg-destructive/15 text-destructive",
                        )}
                        variant="secondary"
                      >
                        {t.status.replace("_", " ")}
                      </Badge>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CheckSquareIcon className="size-4" />
              Approvals
            </h2>
            <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/approvals" />}>
              Queue
            </Button>
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="text-muted-foreground text-sm">Queue is clear.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingApprovals.slice(0, 6).map((a) => (
                <li key={a.approvalId}>
                  <Link
                    to={a.projectId ? `/projects/${a.projectId}` : "/approvals"}
                    className="hover:bg-muted/50 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{a.title}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {a.entityType}:{a.entityId}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {a.priority || a.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangleIcon className="size-4" />
              Accounts to watch
            </h2>
            <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/clients" />}>
              CRM
            </Button>
          </div>
          {atRiskClients.length === 0 ? (
            <p className="text-muted-foreground text-sm">All accounts look steady.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {atRiskClients.slice(0, 6).map((c) => (
                <li key={c.clientId}>
                  <Link
                    to={`/clients/${c.clientId}`}
                    className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-muted-foreground text-xs capitalize">
                        {c.stage} · {c.accountLead}
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize shrink-0">
                      {c.health || c.stage}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BriefcaseIcon className="size-4" />
              Active projects
            </h2>
            <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/projects" />}>
              All
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {activeProjects.slice(0, 6).map((p) => (
              <li key={p.projectId}>
                <Link
                  to={`/projects/${p.projectId}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.projectName}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {p.clientName || p.clientId || "—"} · {p.campaignId || "no campaign"}
                    </div>
                  </div>
                  <Badge variant="outline">{p.status}</Badge>
                </Link>
              </li>
            ))}
            {activeProjects.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active projects yet.</p>
            ) : null}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent activity</h2>
            <Button size="sm" variant="ghost" className="h-7 text-xs" render={<Link to="/activity" />}>
              Feed
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {activity.slice(0, 8).map((item) => {
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
                    className="hover:bg-muted/50 block rounded-lg border px-3 py-2 text-sm transition-colors"
                  >
                    <div className="font-medium">{item.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {item.actor || "System"}
                      {item.createdAt
                        ? ` · ${new Date(item.createdAt).toLocaleString()}`
                        : ""}
                    </div>
                  </Link>
                </li>
              )
            })}
            {activity.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent activity.</p>
            ) : null}
          </ul>
        </Card>
      </div>
    </div>
  )
}
