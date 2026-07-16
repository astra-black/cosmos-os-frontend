import { useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { listProjects, normalizeProjects } from "@/lib/api/agency"
import {
  createTimeEntry,
  getFinanceSummary,
  listBudgets,
  listTimeEntries,
  type BudgetRow,
  type TimeEntry,
} from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import type { Project } from "@/types/agency"

function money(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

export function FinancePage() {
  const { user } = useAuth()
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
  const [hours, setHours] = useState("1")
  const [note, setNote] = useState("")

  async function reload() {
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
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch {
        if (!cancelled) toast.error("Failed to load finance")
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
    const selected = projects.find((p) => p.projectId === projectId)
    if (!selected) {
      toast.error("Select a project first")
      return
    }
    try {
      await createTimeEntry({
        projectId: selected.projectId,
        projectName: selected.projectName,
        user: user?.name || "You",
        hours: Number(hours) || 1,
        note,
        billable: true,
        rate: 165,
        date: new Date().toISOString().slice(0, 10),
      })
      setNote("")
      await reload()
      toast.success("Time logged")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed")
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
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">Project budgets</h2>
          {budgets.length === 0 ? (
            <p className="text-muted-foreground text-sm">No budgets yet.</p>
          ) : (
            budgets.map((b) => (
              <div key={b.budgetId} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{b.projectName}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {money(b.spent)} / {money(b.planned)}
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

        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">Log time</h2>
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No projects available. Create a project before logging time.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select
                className="border-input bg-background h-8 min-w-[10rem] flex-1 rounded-lg border px-2 text-sm"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="" disabled>
                  Project…
                </option>
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.projectName}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                step="0.5"
                className="w-24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <Input
                className="min-w-[12rem] flex-1"
                placeholder="What did you work on?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button size="sm" onClick={() => void logTime()} disabled={!projectId}>
                <PlusIcon className="size-3.5" />
                Log
              </Button>
            </div>
          )}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No time entries yet.</p>
            ) : (
              entries.map((e) => (
                <div
                  key={e.entryId}
                  className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{e.projectName}</div>
                    <div className="text-muted-foreground text-xs">
                      {e.user} · {e.date}
                      {e.note ? ` · ${e.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold">{e.hours}h</span>
                    <Badge variant={e.billable ? "default" : "secondary"}>
                      {e.billable ? "Billable" : "Internal"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
