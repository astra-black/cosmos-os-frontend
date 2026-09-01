import { useEffect, useState } from "react"
import { AlertTriangleIcon, PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
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
  listBudgets,
  listTimeEntries,
  updateBudget,
  updateTimeEntry,
  type BudgetRow,
  type TimeEntry,
} from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
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
  const [budgetCurrency, setBudgetCurrency] = useState("USD")
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)
  const [editingPlanned, setEditingPlanned] = useState("")
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

  async function reload() {
    setError(null)
    const [s, b, t, p] = await Promise.all([
      getFinanceSummary(),
      listBudgets(),
      listTimeEntries(),
      listProjects(),
    ])
    setSummary(s.data ?? null)
    setBudgets(b.data ?? [])
    setEntries(t.data ?? [])
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
    if (!project || !Number.isFinite(planned) || planned < 0) {
      toast.error("Select a project and enter a valid budget")
      return
    }
    setSaving(true)
    try {
      await createBudget({ projectId: project.projectId, projectName: project.projectName, planned, currency: budgetCurrency })
      setBudgetPlanned("")
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
    if (!Number.isFinite(planned) || planned < 0 || editingCurrency.trim().length !== 3) {
      toast.error("Enter a valid amount and 3-letter currency")
      return
    }
    setPendingItem(`budget-edit:${editingBudgetId}`)
    try {
      await updateBudget(editingBudgetId, { planned, currency: editingCurrency.toUpperCase() })
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Finance"
        description="Light finance — budgets, utilization, and time entries."
      />

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-muted-foreground text-xs">Planned</div>
          <div className="text-2xl font-semibold tabular-nums">
            {money(summary?.planned ?? 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-muted-foreground text-xs">Spent</div>
          <div className="text-2xl font-semibold tabular-nums">
            {money(summary?.spent ?? 0)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-muted-foreground text-xs">Billable hours</div>
          <div className="text-2xl font-semibold tabular-nums">
            {summary?.billableHours ?? 0}h
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-muted-foreground text-xs">Time revenue</div>
          <div className="text-2xl font-semibold tabular-nums">
            {money(summary?.revenue ?? 0)}
          </div>
        </Card>
      </div>

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
               <div key={b.budgetId} className="space-y-1.5">
                 <div className="flex justify-between text-sm">
                    <span className="font-medium">{b.projectName}</span>
                    <span className="text-muted-foreground flex items-center gap-2 tabular-nums">
                      {money(b.spent)} / {money(b.planned)} {canWrite ? <span className="flex items-center gap-1">
                        <Button size="icon-xs" variant="ghost" aria-label={`Edit ${b.projectName} budget`} onClick={() => { setEditingBudgetId(b.budgetId); setEditingPlanned(String(b.planned)); setEditingCurrency(b.currency) }} disabled={pendingItem === `budget-delete:${b.budgetId}`}><PencilIcon className="size-3" /></Button>
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
        description="Set the planned project budget. Spent, utilization, and remaining are calculated from finance data."
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
        <div className="grid gap-1.5 sm:grid-cols-2">
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
