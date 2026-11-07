import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangleIcon,
  DownloadIcon,
  LockIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { listProjects, normalizeProjects } from "@/lib/api/agency"
import {
  createBudget,
  createTimeEntry,
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

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—"
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) {
    return `$${Math.round(n).toLocaleString("en-US")}`
  }
  return `$${Math.round(n)}`
}

function moneyExact(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—"
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

type ApiMeta = { financeAccess?: boolean }

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
  const [financeAccess, setFinanceAccess] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [filterProjectId, setFilterProjectId] = useState<string>("all")
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
  const [showTimeForm, setShowTimeForm] = useState(false)
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: "budget" | "time"; id: string; label: string } | null>(null)
  const [pendingItem, setPendingItem] = useState<string | null>(null)
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

  const filteredBudgets = useMemo(() => {
    if (filterProjectId === "all") return budgets
    return budgets.filter((b) => b.projectId === filterProjectId)
  }, [budgets, filterProjectId])

  const filteredProfit = useMemo(() => {
    if (filterProjectId === "all") return profitability
    return profitability.filter((p) => p.projectId === filterProjectId)
  }, [profitability, filterProjectId])

  const rollup = useMemo(() => {
    const planned = filteredBudgets.reduce((s, b) => s + Number(b.planned || 0), 0)
    const spent = filteredBudgets.reduce((s, b) => s + Number(b.spent || 0), 0)
    const remaining = planned - spent
    const usedPct = planned > 0 ? Math.round((spent / planned) * 100) : 0
    let marginPercent: number | null = null
    if (financeAccess && filteredProfit.length > 0) {
      const withMargin = filteredProfit.filter((p) => p.marginPercent != null)
      if (withMargin.length === 1) marginPercent = withMargin[0].marginPercent
      else if (withMargin.length > 1) {
        const plannedSum = withMargin.reduce((s, p) => s + Number(p.planned || 0), 0)
        const marginSum = withMargin.reduce((s, p) => s + Number(p.margin || 0), 0)
        marginPercent = plannedSum > 0 ? (marginSum / plannedSum) * 100 : null
      }
    }
    return { planned, spent, remaining, usedPct, marginPercent }
  }, [filteredBudgets, filteredProfit, financeAccess])

  const attentionBudget = useMemo(() => {
    const near = filteredBudgets
      .filter((b) => Number(b.planned || 0) > 0)
      .map((b) => ({
        budget: b,
        remaining: Number(b.remaining ?? Number(b.planned) - Number(b.spent)),
        util: Number(b.utilization || 0),
      }))
      .filter((row) => row.remaining < 2000 || row.util >= 90 || row.budget.penaltyRisk)
      .sort((a, b) => a.remaining - b.remaining)[0]
    return near ?? null
  }, [filteredBudgets])

  const selectedProjectLabel = useMemo(() => {
    if (filterProjectId === "all") return "All projects"
    return projects.find((p) => p.projectId === filterProjectId)?.projectName || "Project"
  }, [filterProjectId, projects])

  async function reload() {
    setError(null)
    const [s, b, t, p, profitabilityResponse] = await Promise.all([
      getFinanceSummary(),
      listBudgets(),
      listTimeEntries(),
      listProjects(),
      getProjectProfitability().catch((err) => {
        console.warn("[FinancePage] Failed to load profitability:", err)
        return { data: [] as ProjectProfitability[], financeAccess: false } as {
          data: ProjectProfitability[]
        } & ApiMeta
      }),
    ])
    const metaAccess =
      (s as ApiMeta).financeAccess === true ||
      (b as ApiMeta).financeAccess === true ||
      (profitabilityResponse as ApiMeta).financeAccess === true
    setFinanceAccess(metaAccess)
    setSummary(s.data ?? null)
    setBudgets(b.data ?? [])
    setEntries(t.data ?? [])
    setProfitability(profitabilityResponse.data ?? [])
    const nextProjects = normalizeProjects(p)
    setProjects(nextProjects)
    setProjectId((current) => {
      if (current && nextProjects.some((proj) => proj.projectId === current)) return current
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
        date: entryDate,
        billable,
        rate: parsedRate,
      })
      setShowTimeForm(false)
      setNote("")
      await reload()
      toast.success("Time entry logged")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to log time")
    } finally {
      setSaving(false)
    }
  }

  async function submitBudget() {
    if (!canWrite) return
    const selected = projects.find((p) => p.projectId === budgetProjectId)
    const planned = Number(budgetPlanned)
    const contractedMinimum = budgetContractedMinimum === "" ? 0 : Number(budgetContractedMinimum)
    if (!selected || !Number.isFinite(planned) || planned < 0) {
      toast.error("Select a project and enter a non-negative planned amount")
      return
    }
    if (!Number.isFinite(contractedMinimum) || contractedMinimum < 0) {
      toast.error("Contracted minimum must be a non-negative number")
      return
    }
    setSaving(true)
    try {
      await createBudget({
        projectId: selected.projectId,
        projectName: selected.projectName,
        planned,
        contractedMinimum,
        currency: budgetCurrency || "USD",
      })
      setShowBudgetForm(false)
      setBudgetPlanned("")
      setBudgetContractedMinimum("")
      await reload()
      toast.success("Budget created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create budget")
    } finally {
      setSaving(false)
    }
  }

  async function saveBudgetEdit() {
    if (!canWrite || !editingBudgetId) return
    const planned = Number(editingPlanned)
    const contractedMinimum =
      editingContractedMinimum === "" ? 0 : Number(editingContractedMinimum)
    if (!Number.isFinite(planned) || planned < 0) {
      toast.error("Enter a non-negative planned amount")
      return
    }
    setPendingItem(`budget:${editingBudgetId}`)
    try {
      await updateBudget(editingBudgetId, {
        planned,
        contractedMinimum: Number.isFinite(contractedMinimum) ? contractedMinimum : 0,
        currency: editingCurrency || "USD",
      })
      setEditingBudgetId(null)
      await reload()
      toast.success("Budget updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update budget")
    } finally {
      setPendingItem(null)
    }
  }

  async function saveEntryEdit() {
    if (!canWrite || !editingEntryId) return
    const parsedHours = Number(editingHours)
    const parsedRate = Number(editingRate)
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || !editingDate) {
      toast.error("Enter a valid date and hours greater than zero")
      return
    }
    setPendingItem(`time:${editingEntryId}`)
    try {
      await updateTimeEntry(editingEntryId, {
        hours: parsedHours,
        date: editingDate,
        rate: Number.isFinite(parsedRate) ? parsedRate : 0,
        note: editingNote,
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

  if (loading) {
    return (
      <div className="cosmos-finance-page flex flex-col gap-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="cosmos-finance-page">
      <div className="cosmos-finance-page__title-row">
        <div>
          <p className="cosmos-finance-page__eyebrow">
            Agency OS · {selectedProjectLabel}
          </p>
          <h1>Project Finance</h1>
        </div>
        <div className="cosmos-finance-page__actions">
          <Select
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
            aria-label="Filter by project"
            className="cosmos-finance-filter"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void retry()}
            disabled={refreshing}
          >
            <RefreshCwIcon className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={() => setShowBudgetForm(true)}>
              <PlusIcon className="size-3.5" />
              Add Budget
            </Button>
          ) : null}
          <Button
            size="sm"
            className="cosmos-finance-primary"
            onClick={() => setShowInvoiceDrawer(true)}
            disabled={!financeAccess}
            title={
              financeAccess
                ? "Create client invoice"
                : "Invoices are limited to Finance and organization admins"
            }
          >
            <PlusIcon className="size-3.5" />
            Create Invoice
          </Button>
        </div>
      </div>

      {error ? (
        <div className="cosmos-finance-page__error" role="alert">
          <span className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4" />
            {error}
          </span>
          <Button size="sm" variant="outline" onClick={() => void retry()} disabled={refreshing}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="cosmos-finance-kpis">
        <div className="cosmos-finance-kpi">
          <span className="cosmos-finance-kpi__label">Approved Budget</span>
          <strong className="cosmos-finance-kpi__value">{moneyExact(rollup.planned)}</strong>
          <span className="cosmos-finance-kpi__hint">
            {filterProjectId === "all"
              ? `${filteredBudgets.length} budget line${filteredBudgets.length === 1 ? "" : "s"}`
              : "From agency budget records"}
          </span>
        </div>
        <div className="cosmos-finance-kpi">
          <span className="cosmos-finance-kpi__label">Committed</span>
          <strong className="cosmos-finance-kpi__value cosmos-finance-kpi__value--muted">—</strong>
          <span className="cosmos-finance-kpi__hint">POs and contracts unavailable</span>
        </div>
        <div className="cosmos-finance-kpi">
          <span className="cosmos-finance-kpi__label">Actual</span>
          <strong className="cosmos-finance-kpi__value">{moneyExact(rollup.spent)}</strong>
          <span className="cosmos-finance-kpi__hint">
            {rollup.planned > 0 ? `${rollup.usedPct}% of budget` : "No planned budget"}
          </span>
        </div>
        <div className="cosmos-finance-kpi">
          <span className="cosmos-finance-kpi__label">Projected Margin</span>
          {financeAccess && rollup.marginPercent != null ? (
            <>
              <strong className="cosmos-finance-kpi__value">
                {Math.round(rollup.marginPercent)}%
              </strong>
              <span className="cosmos-finance-kpi__hint">Internal only · from time cost</span>
            </>
          ) : financeAccess ? (
            <>
              <strong className="cosmos-finance-kpi__value cosmos-finance-kpi__value--muted">—</strong>
              <span className="cosmos-finance-kpi__hint">No time-cost margin yet</span>
            </>
          ) : (
            <>
              <strong className="cosmos-finance-kpi__value cosmos-finance-kpi__value--muted">
                <LockIcon className="inline size-4" /> Restricted
              </strong>
              <span className="cosmos-finance-kpi__hint">Finance access required</span>
            </>
          )}
        </div>
      </div>

      {attentionBudget ? (
        <div className="cosmos-finance-banner" role="status">
          <div>
            <strong>
              {attentionBudget.budget.projectName} is near its limit
            </strong>
            <p>
              {moneyExact(attentionBudget.budget.spent)} spent of{" "}
              {moneyExact(attentionBudget.budget.planned)}. Remaining{" "}
              {moneyExact(attentionBudget.remaining)}.
              {attentionBudget.budget.penaltyRisk
                ? " Contracted minimum shortfall is open."
                : " Review before adding more spend."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilterProjectId(attentionBudget.budget.projectId)}
          >
            Review
          </Button>
        </div>
      ) : null}

      <div className="cosmos-finance-main">
        <section className="cosmos-finance-card cosmos-finance-lines">
          <div className="cosmos-finance-card__head">
            <div>
              <h2>Budget Lines</h2>
            </div>
            <div className="cosmos-finance-card__tools">
              <Badge variant="secondary">By Project</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled
                title="Export is not available yet"
              >
                <DownloadIcon className="size-3.5" />
                Export
              </Button>
            </div>
          </div>

          {filteredBudgets.length === 0 ? (
            <div className="cosmos-finance-empty">
              <p>No budget lines for this view</p>
              <span>
                Budgets come from agency-scoped finance records. Add a budget when you have write
                access — category / PO lines are not modeled yet.
              </span>
              {canWrite ? (
                <Button size="sm" onClick={() => setShowBudgetForm(true)}>
                  <PlusIcon className="size-3.5" />
                  Add Budget
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="cosmos-finance-table-wrap">
              <table className="cosmos-finance-table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Budget</th>
                    <th>Committed</th>
                    <th>Actual</th>
                    <th>Used</th>
                    <th>Remaining</th>
                    {canWrite ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredBudgets.map((b) => {
                    const used = Number(b.utilization || 0)
                    const rem = Number(b.remaining ?? Number(b.planned) - Number(b.spent))
                    const warn = rem < 2000 || used >= 90
                    return (
                      <tr key={b.budgetId}>
                        <td>
                          <div className="cosmos-finance-line-name">{b.projectName}</div>
                          {b.clientName ? (
                            <div className="cosmos-finance-line-meta">{b.clientName}</div>
                          ) : null}
                        </td>
                        <td>{moneyExact(b.planned)}</td>
                        <td className="cosmos-finance-muted" title="Purchase orders are not available">
                          —
                        </td>
                        <td>{moneyExact(b.spent)}</td>
                        <td>
                          <div className="cosmos-finance-used">
                            <span>{used}%</span>
                            <Progress value={Math.min(100, used)} className="h-1" />
                          </div>
                        </td>
                        <td className={cn(warn && "cosmos-finance-warn")}>{moneyExact(rem)}</td>
                        {canWrite ? (
                          <td className="cosmos-finance-row-actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingBudgetId(b.budgetId)
                                setEditingPlanned(String(b.planned))
                                setEditingContractedMinimum(String(b.contractedMinimum ?? 0))
                                setEditingCurrency(b.currency || "USD")
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "budget",
                                  id: b.budgetId,
                                  label: b.projectName,
                                })
                              }
                            >
                              Delete
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cosmos-finance-card cosmos-finance-chart">
          <div className="cosmos-finance-card__head">
            <h2>Spend Vs Plan</h2>
            <div className="cosmos-finance-legend">
              <span>
                <i className="cosmos-finance-legend__actual" /> Actual
              </span>
              <span>
                <i className="cosmos-finance-legend__plan" /> Plan
              </span>
            </div>
          </div>
          <div className="cosmos-finance-unavailable">
            <ShieldIcon className="size-5" />
            <p>Monthly spend series is not available</p>
            <span>
              The design shows plan vs actual over time. No time-bucketed finance API exists yet —
              nothing here is estimated.
            </span>
          </div>
        </section>
      </div>

      <section className="cosmos-finance-card cosmos-finance-time">
        <div className="cosmos-finance-card__head">
          <div>
            <h2>Time Entries</h2>
            <p className="cosmos-finance-card__sub">
              Agency-scoped hours used for actual cost when rates exist.
              {summary
                ? ` ${summary.billableHours}h billable · ${money(summary.revenue)} time revenue.`
                : null}
            </p>
          </div>
          {canWrite ? (
            <Button size="sm" variant="outline" onClick={() => setShowTimeForm(true)}>
              <PlusIcon className="size-3.5" />
              Log Time
            </Button>
          ) : null}
        </div>
        {entries.length === 0 ? (
          <div className="cosmos-finance-empty">
            <p>No time entries</p>
            <span>Log billable or non-billable hours against a project.</span>
          </div>
        ) : (
          <ul className="cosmos-finance-time-list">
            {entries.slice(0, 12).map((entry) => (
              <li key={entry.entryId}>
                <div>
                  <strong>{entry.projectName || "Project"}</strong>
                  <span>
                    {entry.date} · {entry.hours}h
                    {entry.billable ? " · billable" : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </span>
                </div>
                {canWrite ? (
                  <div className="cosmos-finance-row-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingEntryId(entry.entryId)
                        setEditingHours(String(entry.hours))
                        setEditingDate(entry.date)
                        setEditingRate(String(entry.rate))
                        setEditingNote(entry.note || "")
                        setEditingBillable(entry.billable)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDeleteTarget({
                          type: "time",
                          id: entry.entryId,
                          label: `${entry.projectName || "Entry"} · ${entry.hours}h`,
                        })
                      }
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {showInvoiceDrawer ? (
        <div className="cosmos-finance-drawer-scrim" onClick={() => setShowInvoiceDrawer(false)}>
          <aside
            className="cosmos-finance-drawer"
            role="dialog"
            aria-labelledby="finance-invoice-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <p className="cosmos-finance-page__eyebrow">{selectedProjectLabel} · Financials</p>
              <h2 id="finance-invoice-title">New Client Invoice</h2>
            </header>
            <div className="cosmos-finance-unavailable">
              <LockIcon className="size-5" />
              <p>Invoices are not available yet</p>
              <span>
                Designed create-invoice (Figma 111–112) needs an Invoice model, PO reference, and
                portal projection. No draft is created and nothing is sent.
              </span>
            </div>
            <footer>
              <Button variant="ghost" onClick={() => setShowInvoiceDrawer(false)}>
                Close
              </Button>
              <Button disabled title="Send for approval is not available">
                Send For Approval
              </Button>
            </footer>
          </aside>
        </div>
      ) : null}

      <EntityFormDialog
        open={showBudgetForm}
        onOpenChange={setShowBudgetForm}
        title="Add budget"
        description="Creates an agency-scoped budget for one project. Category lines and committed POs are not modeled yet."
        onSubmit={() => void submitBudget()}
        submitLabel="Create"
        pending={saving}
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fin-budget-project">Project</Label>
            <Select
              id="fin-budget-project"
              value={budgetProjectId}
              onChange={(e) => setBudgetProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-budget-planned">Planned</Label>
            <Input
              id="fin-budget-planned"
              type="number"
              min={0}
              value={budgetPlanned}
              onChange={(e) => setBudgetPlanned(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-budget-min">Contracted minimum (optional)</Label>
            <Input
              id="fin-budget-min"
              type="number"
              min={0}
              value={budgetContractedMinimum}
              onChange={(e) => setBudgetContractedMinimum(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-budget-currency">Currency</Label>
            <Input
              id="fin-budget-currency"
              value={budgetCurrency}
              onChange={(e) => setBudgetCurrency(e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </EntityFormDialog>

      <EntityFormDialog
        open={showTimeForm}
        onOpenChange={setShowTimeForm}
        title="Log time"
        description="Agency-scoped time entry against a project."
        onSubmit={() => void logTime()}
        submitLabel="Log"
        pending={saving}
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fin-time-project">Project</Label>
            <Select
              id="fin-time-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="fin-time-hours">Hours</Label>
              <Input
                id="fin-time-hours"
                type="number"
                min={0.25}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fin-time-date">Date</Label>
              <Input
                id="fin-time-date"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-time-rate">Rate</Label>
            <Input
              id="fin-time-rate"
              type="number"
              min={0}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="fin-time-billable"
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
            />
            <Label htmlFor="fin-time-billable">Billable</Label>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-time-note">Note</Label>
            <Input
              id="fin-time-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </EntityFormDialog>

      <EntityFormDialog
        open={Boolean(editingBudgetId)}
        onOpenChange={(open) => {
          if (!open) setEditingBudgetId(null)
        }}
        title="Edit budget"
        onSubmit={() => void saveBudgetEdit()}
        submitLabel="Save"
        pending={pendingItem?.startsWith("budget:")}
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="fin-edit-planned">Planned</Label>
            <Input
              id="fin-edit-planned"
              type="number"
              min={0}
              value={editingPlanned}
              onChange={(e) => setEditingPlanned(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-edit-min">Contracted minimum</Label>
            <Input
              id="fin-edit-min"
              type="number"
              min={0}
              value={editingContractedMinimum}
              onChange={(e) => setEditingContractedMinimum(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-edit-currency">Currency</Label>
            <Input
              id="fin-edit-currency"
              value={editingCurrency}
              onChange={(e) => setEditingCurrency(e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </EntityFormDialog>

      <EntityFormDialog
        open={Boolean(editingEntryId)}
        onOpenChange={(open) => {
          if (!open) setEditingEntryId(null)
        }}
        title="Edit time entry"
        onSubmit={() => void saveEntryEdit()}
        submitLabel="Save"
        pending={pendingItem?.startsWith("time:")}
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="fin-edit-hours">Hours</Label>
              <Input
                id="fin-edit-hours"
                type="number"
                min={0.25}
                step={0.25}
                value={editingHours}
                onChange={(e) => setEditingHours(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fin-edit-date">Date</Label>
              <Input
                id="fin-edit-date"
                type="date"
                value={editingDate}
                onChange={(e) => setEditingDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-edit-rate">Rate</Label>
            <Input
              id="fin-edit-rate"
              type="number"
              min={0}
              value={editingRate}
              onChange={(e) => setEditingRate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="fin-edit-billable"
              type="checkbox"
              checked={editingBillable}
              onChange={(e) => setEditingBillable(e.target.checked)}
            />
            <Label htmlFor="fin-edit-billable">Billable</Label>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fin-edit-note">Note</Label>
            <Input
              id="fin-edit-note"
              value={editingNote}
              onChange={(e) => setEditingNote(e.target.value)}
            />
          </div>
        </div>
      </EntityFormDialog>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={deleteTarget?.type === "budget" ? "Delete budget?" : "Delete time entry?"}
        description={
          deleteTarget
            ? `Remove ${deleteTarget.label}. This cannot be undone from the UI.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        pending={Boolean(pendingItem?.includes("-delete:"))}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
