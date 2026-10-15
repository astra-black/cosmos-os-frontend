import { useEffect, useMemo, useState } from "react"
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TrendingDownIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Link } from "react-router-dom"

import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { listProjects, normalizeProjects } from "@/lib/api/agency"
import {
  createTimeEntry,
  createBudget,
  deleteBudget,
  deleteTimeEntry,
  getFinanceSummary,
  getProjectProfitability,
  listBudgets,
  listTimeEntries,
  updateBudget,
  updateTimeEntry,
  type BudgetRow,
  type ProjectProfitability,
  type TimeEntry,
} from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/agency"

function money(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

export function FinancePage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops") || canPerform(user?.role, "write_crm")
  const [summary, setSummary] = useState<{
    planned: number
    spent: number
    remaining: number
    hours: number
    billableHours: number
    revenue: number
  } | null>(null)
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [profitability, setProfitability] = useState<ProjectProfitability[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [hours, setHours] = useState("1")
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [billable, setBillable] = useState(true)
  const [rate, setRate] = useState("165")
  const [note, setNote] = useState("")
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetProjectId, setBudgetProjectId] = useState("")
  const [budgetPlanned, setBudgetPlanned] = useState("")
  const [budgetContractedMinimum, setBudgetContractedMinimum] = useState("")
  const [budgetCurrency, setBudgetCurrency] = useState("USD")
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [editingPlanned, setEditingPlanned] = useState("")
  const [editingContractedMinimum, setEditingContractedMinimum] = useState("")
  const [editingCurrency, setEditingCurrency] = useState("USD")
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingHours, setEditingHours] = useState("")
  const [editingDate, setEditingDate] = useState("")
  const [editingRate, setEditingRate] = useState("")
  const [editingNote, setEditingNote] = useState("")
  const [editingBillable, setEditingBillable] = useState(false)
  const [showTimeForm, setShowTimeForm] = useState(false)
  const [pendingItem, setPendingItem] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "budget" | "time"; id: string; label: string } | null>(null)

  const contractMinimumBudgets = useMemo(
    () => budgets.filter((b) => Number(b.contractedMinimum || 0) > 0),
    [budgets],
  )
  const totalContractCommitments = useMemo(
    () => contractMinimumBudgets.reduce((sum, b) => sum + Number(b.contractedMinimum || 0), 0),
    [contractMinimumBudgets],
  )
  const totalContractSpent = useMemo(
    () =>
      contractMinimumBudgets.reduce(
        (sum, b) => sum + Math.min(Number(b.spent || 0), Number(b.contractedMinimum || 0)),
        0,
      ),
    [contractMinimumBudgets],
  )
  const totalShortfallExposure = useMemo(
    () => contractMinimumBudgets.reduce((sum, b) => sum + Number(b.minimumShortfall || 0), 0),
    [contractMinimumBudgets],
  )
  const highRiskContractsCount = useMemo(
    () =>
      contractMinimumBudgets.filter(
        (b) =>
          b.penaltyRisk &&
          Number(b.contractedMinimum || 0) > 0 &&
          Number(b.spent || 0) / Number(b.contractedMinimum || 0) < 0.65,
      ).length,
    [contractMinimumBudgets],
  )

  async function reload() {
    setError(null)
    const [s, b, t, p, profitabilityResponse] = await Promise.all([
      getFinanceSummary(),
      listBudgets(),
      listTimeEntries(),
      listProjects(),
      getProjectProfitability().catch((err) => {
        console.warn('[FinancePage] Failed to load profitability:', err)
        return { data: [] as ProjectProfitability[] }
      }),
    ])
    setSummary(s.data ?? null)
    setBudgets(b.data ?? [])
    setEntries(t.data ?? [])
    setProfitability(profitabilityResponse.data ?? [])
    const nextProjects = normalizeProjects(p)
    setProjects(nextProjects)
    setProjectId((current) => {
      if (current && nextProjects.some((proj) => proj.projectId === current)) {
        return current
      }
      return nextProjects[0]?.projectId ?? ""
    })
    setBudgetProjectId((current) => current || nextProjects[0]?.projectId || "")
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch {
        if (!cancelled) setError("We couldn't load the finance data. Try again.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function logTime() {
    if (!canWrite) return
    const selected = projects.find((p) => p.projectId === projectId)
    if (!selected) {
      toast.error("Select a project first")
      return
    }
    const parsedHours = Number(hours)
    const parsedRate = Number(rate)
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || !entryDate) {
      toast.error("Enter a valid date and number of hours greater than zero")
      return
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      toast.error("Enter a valid hourly rate")
      return
    }
    setSaving(true)
    try {
      await createTimeEntry({
        projectId: selected.projectId,
        projectName: selected.projectName,
        user: user?.name || "You",
        hours: parsedHours,
        note: note.trim(),
         billable,
         rate: parsedRate,
         date: entryDate,
      })
       setNote("")
       setShowTimeForm(false)
       await reload()
      toast.success("Time logged")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to log time")
    } finally {
      setSaving(false)
    }
  }

  async function saveBudget() {
    if (!canWrite) return
    const project = projects.find((item) => item.projectId === budgetProjectId)
    const planned = Number(budgetPlanned)
    const contractedMinimum = budgetContractedMinimum.trim() ? Number(budgetContractedMinimum) : 0
    if (!project || !Number.isFinite(planned) || planned < 0 || !Number.isFinite(contractedMinimum) || contractedMinimum < 0) {
      toast.error("Select a project and enter valid budget amounts")
      return
    }
    setSaving(true)
    try {
      await createBudget({ projectId: project.projectId, projectName: project.projectName, planned, contractedMinimum, currency: budgetCurrency })
      setBudgetPlanned("")
      setBudgetContractedMinimum("")
      setShowBudgetForm(false)
      await reload()
      toast.success("Budget created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create budget")
    } finally {
      setSaving(false)
    }
  }

  async function saveBudgetEdit() {
    if (!editingBudgetId || !canWrite) return
    const planned = Number(editingPlanned)
    const contractedMinimum = editingContractedMinimum.trim() ? Number(editingContractedMinimum) : 0
    if (!Number.isFinite(planned) || planned < 0 || !Number.isFinite(contractedMinimum) || contractedMinimum < 0 || editingCurrency.trim().length !== 3) {
      toast.error("Enter valid amounts and a 3-letter currency")
      return
    }
    setPendingItem(`budget-edit:${editingBudgetId}`)
    try {
      await updateBudget(editingBudgetId, { planned, contractedMinimum, currency: editingCurrency.toUpperCase() })
      setEditingBudgetId(null)
      await reload()
      toast.success("Budget updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update budget")
    } finally {
      setPendingItem(null)
    }
  }

  function startEntryEdit(entry: TimeEntry) {
    setEditingEntryId(entry.entryId)
    setEditingHours(String(entry.hours))
    setEditingDate(entry.date)
    setEditingRate(String(entry.rate))
    setEditingNote(entry.note ?? "")
    setEditingBillable(entry.billable)
  }

  async function saveEntryEdit() {
    if (!editingEntryId || !canWrite) return
    const parsedHours = Number(editingHours)
    const parsedRate = Number(editingRate)
    if (!Number.isFinite(parsedHours) || parsedHours < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(editingDate)) {
      toast.error("Enter a valid date and non-negative number of hours")
      return
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      toast.error("Enter a valid hourly rate")
      return
    }
    const entryId = editingEntryId
    setPendingItem(`time-edit:${entryId}`)
    try {
      await updateTimeEntry(entryId, {
        hours: parsedHours,
        date: editingDate,
        rate: parsedRate,
        note: editingNote.trim(),
        billable: editingBillable,
      })
      setEditingEntryId(null)
      await reload()
      toast.success("Time entry updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update time entry")
    } finally {
      setPendingItem(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !canWrite) return
    const target = deleteTarget
    setPendingItem(`${target.type}-delete:${target.id}`)
    try {
      if (target.type === "budget") await deleteBudget(target.id)
      else await deleteTimeEntry(target.id)
      setDeleteTarget(null)
      await reload()
      toast.success(target.type === "budget" ? "Budget deleted" : "Time entry deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to delete ${target.type}`)
    } finally {
      setPendingItem(null)
    }
  }

  async function retry() {
    setRefreshing(true)
    try {
      await reload()
    } catch {
      setError("We couldn't load the finance data. Try again.")
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Budget & Profitability
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time project financials, spend variance, profit margins, and commitments.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void retry()}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCwIcon className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
          {canWrite && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTimeForm(true)}
                className="gap-1.5"
              >
                <PlusIcon className="size-3.5" />
                Log time
              </Button>
              <Button
                size="sm"
                onClick={() => setShowBudgetForm(true)}
                className="gap-1.5 bg-[#270045] hover:bg-[#3b006a] text-white"
              >
                <PlusIcon className="size-3.5" />
                New budget
              </Button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="text-destructive flex items-center gap-2">
            <AlertTriangleIcon className="size-4" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => void retry()} disabled={refreshing}>
            <RefreshCwIcon className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
            Retry
          </Button>
        </Card>
      ) : null}

      {/* 4 Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Budget</p>
          <div className="my-2">
            <span className="font-sora text-3xl font-bold text-foreground tabular-nums">
              {money(summary?.planned ?? 0)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="purple" className="text-[11px]">
              {projects.length} active projects
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actual Cost</p>
          <div className="my-2">
            <span className="font-sora text-3xl font-bold text-foreground tabular-nums">
              {money(summary?.spent ?? 0)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="warning" className="text-[11px]">
              {summary?.planned ? Math.round(((summary.spent ?? 0) / summary.planned) * 100) : 0}% of budget
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoiced Revenue</p>
          <div className="my-2">
            <span className="font-sora text-3xl font-bold text-foreground tabular-nums">
              {money(summary?.revenue ?? 0)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="success" className="text-[11px]">
              {summary?.billableHours ?? 0}h billable
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] flex flex-col justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projected Profit</p>
          <div className="my-2">
            <span className={cn(
              "font-sora text-3xl font-bold tabular-nums",
              (summary?.revenue ?? 0) - (summary?.spent ?? 0) < 0 ? "text-destructive" : "text-success"
            )}>
              {money(Math.max(0, (summary?.revenue ?? 0) - (summary?.spent ?? 0)))}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="success" className="text-[11px]">
              {summary?.revenue && summary.revenue > 0
                ? `${Math.round(((summary.revenue - (summary.spent ?? 0)) / summary.revenue) * 100)}% margin`
                : "Healthy"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Project Profitability Card & Table */}
      <Card className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-sora font-bold text-base text-foreground">Project profitability & variance</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Planned budget compared with logged time cost and forecasted margin.
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {profitability.length} projects tracked
          </span>
        </div>

        {profitability.length === 0 ? (
          <EmptyState
            className="py-12"
            title="No profitability data yet"
            description="Add a project budget or log time to see margin and variance metrics."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-alt/50 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 px-5">Project</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Actual Cost</th>
                  <th className="py-3 px-4">Variance</th>
                  <th className="py-3 px-4">Margin</th>
                  <th className="py-3 px-4">Spend</th>
                  <th className="py-3 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profitability.map((p) => {
                  const spendPct = p.planned > 0 ? Math.min(100, Math.round((p.actualTimeCost / p.planned) * 100)) : 0
                  const variance = p.planned - p.actualTimeCost
                  return (
                    <tr key={p.projectId} className="hover:bg-surface-alt/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <Link to={`/projects/${p.projectId}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                          {p.projectName}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          {p.actualHours.toFixed(1)}h logged {p.costAvailable ? "" : "· rate unavailable"}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                        {money(p.planned)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                        {p.costAvailable ? money(p.actualTimeCost) : "—"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold">
                        <span className={variance >= 0 ? "text-success" : "text-destructive"}>
                          {variance >= 0 ? `+${money(variance)}` : `-${money(Math.abs(variance))}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium">
                        <span className={cn(p.margin < 0 ? "text-destructive" : "text-foreground")}>
                          {p.costAvailable ? `${money(p.margin)}${p.marginPercent != null ? ` (${Math.round(p.marginPercent)}%)` : ""}` : "—"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-surface-alt overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${spendPct}%`,
                                background: "linear-gradient(115deg, oklch(48% 0.23 295), oklch(58% 0.24 350), oklch(68% 0.18 50))",
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground">{spendPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Badge variant={variance >= 0 ? "success" : "danger"}>
                          {variance >= 0 ? "On Target" : "Over Budget"}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Contract Minimums & Attrition Monitor */}
      <Card className="flex min-w-0 flex-col gap-4 p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-card via-card to-amber-500/[0.03] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-sora text-base sm:text-lg font-bold text-foreground">
                Contract Minimums & Attrition Monitor
              </h2>
              {highRiskContractsCount > 0 ? (
                <Badge variant="danger" className="gap-1 font-semibold text-xs">
                  <ShieldAlertIcon className="size-3" />
                  {highRiskContractsCount} Attrition Risk
                </Badge>
              ) : contractMinimumBudgets.length > 0 ? (
                <Badge variant="success" className="gap-1 text-xs">
                  <CheckCircle2Icon className="size-3" />
                  Commitments Tracked
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Live tracking of hotel, venue, and production vendor minimum commitments, unfulfilled spend exposure, and attrition penalties.
            </p>
          </div>
          {canWrite ? (
            <Button size="sm" onClick={() => setShowBudgetForm(true)} className="gap-1.5 bg-[#270045] text-white hover:bg-[#3b006a]">
              <PlusIcon className="size-3.5" />
              Add Commitment
            </Button>
          ) : null}
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface-alt/40 p-3.5">
            <div className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Total Commitments</div>
            <div className="mt-1 font-sora text-xl font-bold text-foreground tabular-nums">
              {money(totalContractCommitments)}
            </div>
            <div className="text-muted-foreground text-[10px] mt-0.5">
              {contractMinimumBudgets.length} active contract{contractMinimumBudgets.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt/40 p-3.5">
            <div className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Credited Spend</div>
            <div className="mt-1 font-sora text-xl font-bold text-success tabular-nums">
              {money(totalContractSpent)}
            </div>
            <div className="text-muted-foreground text-[10px] mt-0.5">
              {totalContractCommitments > 0
                ? `${Math.round((totalContractSpent / totalContractCommitments) * 100)}% covered`
                : "0%"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt/40 p-3.5">
            <div className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Shortfall Exposure</div>
            <div className={cn(
              "mt-1 font-sora text-xl font-bold tabular-nums",
              totalShortfallExposure > 0 ? "text-destructive" : "text-success",
            )}>
              {totalShortfallExposure > 0 ? money(totalShortfallExposure) : "$0 (Covered)"}
            </div>
            <div className="text-muted-foreground text-[10px] mt-0.5">
              {totalShortfallExposure > 0 ? "Unfulfilled penalty risk" : "Zero penalty exposure"}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface-alt/40 p-3.5">
            <div className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Fulfillment Status</div>
            <div className="mt-1 font-sora text-xl font-bold text-foreground tabular-nums">
              {highRiskContractsCount > 0 ? `${highRiskContractsCount} Critical` : "Healthy"}
            </div>
            <div className="text-muted-foreground text-[10px] mt-0.5">
              {highRiskContractsCount > 0 ? "Requires mitigation" : "All commitments pacing well"}
            </div>
          </div>
        </div>

        {/* Contract Minimums Breakdown List */}
        {contractMinimumBudgets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium text-foreground">No contracted minimums configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a contracted minimum to any project or event budget to monitor attrition risks and unspent commitment shortfalls.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {contractMinimumBudgets.map((b) => {
              const minVal = Number(b.contractedMinimum || 0)
              const spentVal = Number(b.spent || 0)
              const shortfallVal = Number(b.minimumShortfall || 0)
              const coveredPct = minVal > 0 ? Math.min(100, Math.round((spentVal / minVal) * 100)) : 0
              const isHighRisk = b.penaltyRisk && minVal > 0 && spentVal / minVal < 0.65
              const isWatch = b.penaltyRisk && !isHighRisk

              return (
                <div
                  key={b.budgetId}
                  className={cn(
                    "flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all bg-card",
                    isHighRisk
                      ? "border-destructive/40 bg-destructive/[0.03] shadow-xs ring-1 ring-destructive/20"
                      : isWatch
                        ? "border-warning/40 bg-warning/[0.02]"
                        : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-sora font-semibold text-sm truncate">{b.projectName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-medium">{b.currency}</span>
                        <span>·</span>
                        <span>Total Planned: {money(b.planned)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isHighRisk ? (
                        <Badge variant="danger" className="text-[10px] uppercase font-bold px-2 py-0.5 gap-1">
                          <AlertCircleIcon className="size-3" />
                          High Risk ({coveredPct}%)
                        </Badge>
                      ) : isWatch ? (
                        <Badge variant="warning" className="text-[10px] uppercase font-bold px-2 py-0.5">
                          Watch ({coveredPct}%)
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] uppercase font-bold px-2 py-0.5 gap-1">
                          <CheckCircle2Icon className="size-3" />
                          Covered (100%)
                        </Badge>
                      )}

                      {canWrite && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => {
                            setEditingBudgetId(b.budgetId)
                            setEditingPlanned(String(b.planned))
                            setEditingContractedMinimum(String(b.contractedMinimum ?? 0))
                            setEditingCurrency(b.currency)
                          }}
                          title="Edit Contract Minimum"
                        >
                          <PencilIcon className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Dual-Tone Commitment Progress Track */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted-foreground font-sans">Fulfillment</span>
                      <span className="font-bold tabular-nums">{coveredPct}% of {money(minVal)}</span>
                    </div>
                    <div className="relative h-2.5 w-full rounded-full bg-surface-alt overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isHighRisk
                            ? "bg-destructive"
                            : isWatch
                              ? "bg-warning"
                              : "bg-success",
                        )}
                        style={{ width: `${coveredPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial Breakdown Strip */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-surface-alt/40 p-2.5 text-center text-xs font-mono">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-sans">Spent</div>
                      <div className="font-semibold tabular-nums mt-0.5">{money(spentVal)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-sans">Minimum</div>
                      <div className="font-semibold tabular-nums mt-0.5">{money(minVal)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-sans">Shortfall</div>
                      <div className={cn(
                        "font-bold tabular-nums mt-0.5",
                        shortfallVal > 0 ? "text-destructive" : "text-success",
                      )}>
                        {shortfallVal > 0 ? `-${money(shortfallVal)}` : "Covered"}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Project budgets</h2>
            <div className="flex gap-2">
              {canWrite ? <Button size="sm" onClick={() => setShowBudgetForm(true)}><PlusIcon className="size-3.5" /> New budget</Button> : null}
              <Button size="sm" variant="outline" render={<Link to="/projects" />}>Manage projects</Button>
            </div>
          </div>
          {budgets.length === 0 ? (
            <EmptyState
              className="py-10"
              title="No budgets yet"
              description="Project budgets will appear here once they are set on a project."
            />
          ) : (
             budgets.map((b) => (
               <div
                 key={b.budgetId}
                 className={cn(
                   "space-y-1.5 rounded-xl border p-3",
                   b.penaltyRisk && "border-destructive/30 bg-destructive/[0.03]",
                 )}
               >
                 <div className="flex justify-between text-sm">
                    <span className="font-medium">{b.projectName}</span>
                    <span className="text-muted-foreground flex items-center gap-2 tabular-nums">
                      {money(b.spent)} / {money(b.planned)} {canWrite ? <span className="flex items-center gap-1">
                        <Button size="icon-xs" variant="ghost" aria-label={`Edit ${b.projectName} budget`} onClick={() => { setEditingBudgetId(b.budgetId); setEditingPlanned(String(b.planned)); setEditingContractedMinimum(String(b.contractedMinimum ?? 0)); setEditingCurrency(b.currency) }} disabled={pendingItem === `budget-delete:${b.budgetId}`}><PencilIcon className="size-3" /></Button>
                        <Button size="icon-xs" variant="ghost" aria-label={`Delete ${b.projectName} budget`} onClick={() => setDeleteTarget({ type: "budget", id: b.budgetId, label: `${b.projectName} budget` })} disabled={pendingItem === `budget-delete:${b.budgetId}`}><Trash2Icon className="text-destructive size-3" /></Button>
                      </span> : null}
                   </span>
                 </div>
                <Progress value={Math.min(b.utilization, 100)} />
                <div className="text-muted-foreground flex justify-between text-[11px]">
                  <span>{b.utilization}% used</span>
                  <span className={b.remaining < 0 ? "text-destructive" : ""}>
                    {money(b.remaining)} left
                  </span>
                </div>
                {(b.contractedMinimum ?? 0) > 0 ? (
                  <div className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs",
                    b.penaltyRisk ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  )}>
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangleIcon className="size-3.5" />
                      Contract minimum {money(b.contractedMinimum ?? 0)}
                    </span>
                    <span className="tabular-nums">
                      {b.penaltyRisk
                        ? `${money(b.minimumShortfall ?? 0)} exposure`
                        : "minimum covered"}
                    </span>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </Card>

        <Card className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Time entries</h2>
            {canWrite && projects.length > 0 ? <Button size="sm" onClick={() => setShowTimeForm(true)}><PlusIcon className="size-3.5" /> Log time</Button> : null}
          </div>
          {!canWrite ? <p className="text-muted-foreground text-sm">You do not have permission to log time.</p> : null}
          {canWrite && projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No projects available. Create a project before logging time.
            </p>
          ) : null}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {entries.length === 0 ? (
              <EmptyState
                className="py-10"
                title="No time entries yet"
                description="Log your first entry above to start tracking utilization."
              />
            ) : (
              entries.map((e) => (
                <div
                  key={e.entryId}
                  className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
                >
                  <>
                    <div>
                      <div className="font-medium">{e.projectName}</div>
                      <div className="text-muted-foreground text-xs">{e.user} · {e.date}{e.note ? ` · ${e.note}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="tabular-nums font-semibold">{e.hours}h</span>
                      <Badge variant={e.billable ? "default" : "secondary"}>{e.billable ? "Billable" : "Internal"}</Badge>
                      {canWrite ? <><Button size="icon-xs" variant="ghost" aria-label={`Edit time entry for ${e.projectName}`} onClick={() => startEntryEdit(e)} disabled={pendingItem === `time-delete:${e.entryId}`}><PencilIcon className="size-3" /></Button><Button size="icon-xs" variant="ghost" aria-label={`Delete time entry for ${e.projectName}`} onClick={() => setDeleteTarget({ type: "time", id: e.entryId, label: `${e.projectName} time entry` })} disabled={pendingItem === `time-delete:${e.entryId}`}><Trash2Icon className="text-destructive size-3" /></Button></> : null}
                    </div>
                  </>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
      <EntityFormDialog
        open={showBudgetForm || editingBudgetId !== null}
        onOpenChange={(open) => {
          const editingPending = editingBudgetId !== null && pendingItem === `budget-edit:${editingBudgetId}`
          if (!open && !saving && !editingPending) {
            setShowBudgetForm(false)
            setEditingBudgetId(null)
          }
        }}
        title={editingBudgetId ? "Edit budget" : "New budget"}
        description="Set the planned budget and any contracted minimum. Risk warnings update from spend automatically."
        onSubmit={editingBudgetId ? saveBudgetEdit : saveBudget}
        submitLabel={editingBudgetId ? "Save changes" : "Create budget"}
        pending={saving || (editingBudgetId !== null && pendingItem === `budget-edit:${editingBudgetId}`)}
        submitDisabled={!editingBudgetId && !budgetProjectId}
      >
        {editingBudgetId ? (
          <div className="grid gap-1.5">
            <Label>Project</Label>
            <p className="bg-muted/40 rounded-lg px-2.5 py-2 text-sm font-medium">
              {budgets.find((budget) => budget.budgetId === editingBudgetId)?.projectName}
            </p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="budget-project">Project</Label>
            <Select id="budget-project" value={budgetProjectId} onChange={(event) => setBudgetProjectId(event.target.value)}>
              <option value="">Select a project</option>
              {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}
            </Select>
          </div>
        )}
        <div className="grid gap-1.5 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="budget-planned">Planned amount</Label>
            <Input
              id="budget-planned"
              type="number"
              min="0"
              value={editingBudgetId ? editingPlanned : budgetPlanned}
              onChange={(event) => editingBudgetId ? setEditingPlanned(event.target.value) : setBudgetPlanned(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="budget-minimum">Contract minimum</Label>
            <Input
              id="budget-minimum"
              type="number"
              min="0"
              value={editingBudgetId ? editingContractedMinimum : budgetContractedMinimum}
              onChange={(event) => editingBudgetId ? setEditingContractedMinimum(event.target.value) : setBudgetContractedMinimum(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="budget-currency">Currency</Label>
            <Input
              id="budget-currency"
              maxLength={3}
              value={editingBudgetId ? editingCurrency : budgetCurrency}
              onChange={(event) => editingBudgetId ? setEditingCurrency(event.target.value.toUpperCase()) : setBudgetCurrency(event.target.value.toUpperCase())}
            />
          </div>
        </div>
      </EntityFormDialog>
      <EntityFormDialog
        open={showTimeForm || editingEntryId !== null}
        onOpenChange={(open) => {
          const editingPending = editingEntryId !== null && pendingItem === `time-edit:${editingEntryId}`
          if (!open && !saving && !editingPending) {
            setShowTimeForm(false)
            setEditingEntryId(null)
          }
        }}
        title={editingEntryId ? "Edit time entry" : "Log time"}
        description="Record the hours, date, rate, and billable status for this project."
        onSubmit={editingEntryId ? saveEntryEdit : logTime}
        submitLabel={editingEntryId ? "Save changes" : "Log time"}
        pending={saving || (editingEntryId !== null && pendingItem === `time-edit:${editingEntryId}`)}
        submitDisabled={!editingEntryId && !projectId}
        maxWidth="max-w-2xl"
      >
        {editingEntryId ? (
          <div className="grid gap-1.5">
            <Label>Project</Label>
            <p className="bg-muted/40 rounded-lg px-2.5 py-2 text-sm font-medium">
              {entries.find((entry) => entry.entryId === editingEntryId)?.projectName}
            </p>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="time-project">Project</Label>
            <Select id="time-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Select a project</option>
              {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}
            </Select>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="time-hours">Hours</Label>
            <Input
              id="time-hours"
              type="number"
              min={editingEntryId ? "0" : "0.5"}
              step="0.5"
              value={editingEntryId ? editingHours : hours}
              onChange={(event) => editingEntryId ? setEditingHours(event.target.value) : setHours(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="time-date">Date</Label>
            <Input
              id="time-date"
              type="date"
              value={editingEntryId ? editingDate : entryDate}
              onChange={(event) => editingEntryId ? setEditingDate(event.target.value) : setEntryDate(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="time-rate">Hourly rate</Label>
            <Input
              id="time-rate"
              type="number"
              min="0"
              step="0.01"
              value={editingEntryId ? editingRate : rate}
              onChange={(event) => editingEntryId ? setEditingRate(event.target.value) : setRate(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="time-note">Note</Label>
          <Input
            id="time-note"
            placeholder="What did you work on?"
            value={editingEntryId ? editingNote : note}
            onChange={(event) => editingEntryId ? setEditingNote(event.target.value) : setNote(event.target.value)}
          />
        </div>
        <label className="border-input flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm">
          <input
            type="checkbox"
            checked={editingEntryId ? editingBillable : billable}
            onChange={(event) => editingEntryId ? setEditingBillable(event.target.checked) : setBillable(event.target.checked)}
          />
          Billable
        </label>
      </EntityFormDialog>
      <ConfirmationDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !pendingItem) setDeleteTarget(null) }}
        title={`Delete ${deleteTarget?.label ?? "item"}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteTarget ? pendingItem === `${deleteTarget.type}-delete:${deleteTarget.id}` : false}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
