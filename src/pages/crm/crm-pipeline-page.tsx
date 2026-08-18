import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2Icon, PlusIcon, RocketIcon, Trash2Icon, TrendingUpIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  convertOpportunity,
  createOpportunity,
  getCrmSummary,
  listClients,
  listOpportunities,
  updateOpportunity,
  deleteOpportunity,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { AgencyClient, CrmSummary, Opportunity } from "@/types/agency"
import { cn } from "@/lib/utils"

const STAGES = [
  { id: "lead", label: "Lead", next: "qualified" },
  { id: "qualified", label: "Qualified", next: "proposal" },
  { id: "proposal", label: "Proposal", next: "negotiation" },
  { id: "negotiation", label: "Negotiation", next: "won" },
  { id: "won", label: "Won", next: null },
  { id: "lost", label: "Lost", next: null },
] as const

function money(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

export function CrmPipelinePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canWriteCrm = canPerform(user?.role, "write_crm")
  const [deals, setDeals] = useState<Opportunity[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [summary, setSummary] = useState<CrmSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: "", clientId: "", value: "" })

  const reload = useCallback(async () => {
    setError(null)
    const [oppRes, sumRes, clientRes] = await Promise.all([
      listOpportunities(),
      getCrmSummary(),
      listClients(),
    ])
    setDeals(oppRes.data ?? [])
    setSummary(sumRes.data ?? null)
    setClients(clientRes.data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load CRM")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reload])

  const lanes = useMemo(
    () =>
      STAGES.map((stage) => {
        const items = deals.filter((d) => d.stage === stage.id)
        const value = items.reduce((s, d) => s + (d.value || 0), 0)
        return { ...stage, items, value }
      }),
    [deals],
  )

  async function moveDeal(deal: Opportunity, next: string) {
    if (!canWriteCrm) return
    setBusyId(deal.opportunityId)
    try {
      const patch: Partial<Opportunity> = { stage: next }
      if (next === "won") patch.probability = 100
      if (next === "lost") patch.probability = 0
      await updateOpportunity(deal.opportunityId, patch)
      await reload()
      toast.success(`${deal.name} → ${next}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Move failed")
    } finally {
      setBusyId(null)
    }
  }

  async function startDelivery(deal: Opportunity) {
    if (!canWriteCrm) return
    setBusyId(deal.opportunityId)
    try {
      const res = await convertOpportunity(deal.opportunityId)
      const projectId = res.data?.project?.projectId
      toast.success(
        projectId
          ? `Delivery started — project ${res.data?.project?.projectName || projectId}`
          : "Delivery started",
      )
      await reload()
      if (projectId) {
        navigate(`/projects/${projectId}`)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Convert failed")
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(deal: Opportunity) {
    if (!canWriteCrm || !window.confirm(`Delete opportunity "${deal.name}"? This cannot be undone.`)) return
    setDeletingId(deal.opportunityId)
    try {
      await deleteOpportunity(deal.opportunityId)
      await reload()
      toast.success("Opportunity deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCreate() {
    if (!form.name.trim() || !canWriteCrm) return
    try {
      await createOpportunity({
        name: form.name.trim(),
        clientId: form.clientId || clients[0]?.clientId,
        value: Number(form.value) || 0,
        stage: "lead",
        probability: 15,
        owner: "Unassigned",
      })
      setForm({ name: "", clientId: "", value: "" })
      setShowCreate(false)
      await reload()
      toast.success("Opportunity created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="CRM pipeline"
        description="Sales desk — opportunities by stage with weighted pipeline value."
        actions={
          canWriteCrm ? (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <PlusIcon className="size-3.5" />
              New deal
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-destructive">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void reload().catch(() => undefined)}>Retry</Button>
          </div>
        </Card>
      ) : null}

      {/* Pipeline KPIs — compact strip, not dashboard clone */}
      <div className="bg-card grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-4">
        <div>
          <div className="text-muted-foreground text-xs">Open pipeline</div>
          <div className="text-xl font-semibold tabular-nums">
            {summary ? money(summary.pipelineValue) : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Weighted</div>
          <div className="text-xl font-semibold tabular-nums">
            {summary ? money(summary.weightedPipeline) : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Open deals</div>
          <div className="text-xl font-semibold tabular-nums">{summary?.openDeals ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Won YTD</div>
          <div className="flex items-center gap-1 text-xl font-semibold tabular-nums">
            <TrendingUpIcon className="size-4 opacity-60" />
            {summary ? money(summary.wonValue) : "—"}
          </div>
        </div>
      </div>

      {showCreate ? (
        <Card className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
          <Input
            placeholder="Deal name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
          >
            <option value="">Client…</option>
            {clients.map((c) => (
              <option key={c.clientId} value={c.clientId}>
                {c.name}
              </option>
            ))}
          </select>
          <Input
            placeholder="Value (USD)"
            type="number"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 sm:flex-none" disabled={!form.name.trim()} onClick={handleCreate}>
              Create
            </Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible xl:grid-cols-6">
          {STAGES.map((s) => (
            <Skeleton key={s.id} className="h-80 w-[min(85vw,16rem)] shrink-0 rounded-xl md:w-auto" />
          ))}
        </div>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 md:snap-none xl:grid-cols-3 2xl:grid-cols-6">
          {lanes.map((lane) => (
            <section
              key={lane.id}
              className={cn(
                "bg-muted/40 flex min-h-72 w-[min(85vw,16rem)] shrink-0 snap-start flex-col rounded-xl border border-dashed p-2 md:w-auto md:min-w-0",
                lane.id === "won" && "border-chart-2/40",
                lane.id === "lost" && "opacity-80",
              )}
            >
              <header className="mb-2 space-y-0.5 px-1 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{lane.label}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {lane.items.length}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-[11px] tabular-nums">
                  {money(lane.value)}
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {lane.items.length === 0 ? (
                  <EmptyState title="Empty" className="border-0 py-8" />
                ) : (
                  lane.items.map((deal) => (
                    <article
                      key={deal.opportunityId}
                      className="bg-card rounded-lg border p-3 shadow-xs"
                    >
                       <div className="flex items-start justify-between gap-1">
                         <div className="text-sm font-medium leading-snug">{deal.name}</div>
                         {canWriteCrm ? <Button size="icon" variant="ghost" className="size-6 shrink-0 text-destructive" disabled={deletingId === deal.opportunityId} onClick={() => void handleDelete(deal)} aria-label={`Delete ${deal.name}`}><Trash2Icon className="size-3" /></Button> : null}
                       </div>
                      <div className="text-muted-foreground mt-1 truncate text-xs">
                        {deal.clientName || "—"}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-semibold tabular-nums">{money(deal.value)}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {deal.probability}%
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-1 truncate text-[11px]">
                        {deal.owner}
                        {deal.expectedClose
                          ? ` · close ${new Date(deal.expectedClose).toLocaleDateString()}`
                          : ""}
                      </div>
                      {deal.nextStep ? (
                        <p className="text-muted-foreground mt-2 line-clamp-2 text-[11px]">
                          Next: {deal.nextStep}
                        </p>
                      ) : null}
                      {canWriteCrm && lane.next ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 w-full text-xs"
                          disabled={busyId === deal.opportunityId}
                          onClick={() => moveDeal(deal, lane.next!)}
                        >
                          {busyId === deal.opportunityId ? (
                            <Loader2Icon className="size-3 animate-spin" />
                          ) : null}
                          → {lane.next}
                        </Button>
                      ) : null}
                      {canWriteCrm && lane.id === "negotiation" ? (
                        <div className="mt-1.5 flex gap-1">
                          <Button
                            size="sm"
                            className="h-7 flex-1 text-xs"
                            disabled={busyId === deal.opportunityId}
                            onClick={() => moveDeal(deal, "won")}
                          >
                            Won
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 flex-1 text-xs"
                            disabled={busyId === deal.opportunityId}
                            onClick={() => moveDeal(deal, "lost")}
                          >
                            Lost
                          </Button>
                        </div>
                      ) : null}
                      {canWriteCrm && lane.id === "won" ? (
                        <Button
                          size="sm"
                          className="mt-2 h-7 w-full text-xs"
                          disabled={busyId === deal.opportunityId}
                          onClick={() => void startDelivery(deal)}
                        >
                          {busyId === deal.opportunityId ? (
                            <Loader2Icon className="size-3 animate-spin" />
                          ) : (
                            <RocketIcon className="size-3" />
                          )}
                          Start delivery
                        </Button>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
