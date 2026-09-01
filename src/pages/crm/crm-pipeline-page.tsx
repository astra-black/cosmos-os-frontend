import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2Icon, PencilIcon, PlusIcon, RocketIcon, Trash2Icon, TrendingUpIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
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
type OpportunityForm = {
  name: string
  clientId: string
  stage: string
  value: string
  probability: string
  source: string
  expectedClose: string
  nextStep: string
  notes: string
}

const emptyOpportunityForm = (): OpportunityForm => ({
  name: "",
  clientId: "",
  stage: "lead",
  value: "",
  probability: "15",
  source: "",
  expectedClose: "",
  nextStep: "",
  notes: "",
})

function opportunityFormFromDeal(deal: Opportunity): OpportunityForm {
  return {
    name: deal.name,
    clientId: deal.clientId ?? "",
    stage: deal.stage,
    value: String(deal.value ?? 0),
    probability: String(deal.probability ?? 0),
    source: deal.source ?? "",
    expectedClose: deal.expectedClose?.slice(0, 10) ?? "",
    nextStep: deal.nextStep ?? "",
    notes: deal.notes ?? "",
  }
}

function validateOpportunityForm(values: OpportunityForm) {
  if (!values.name.trim()) return "Name is required"
  const value = Number(values.value)
  if (!values.value.trim() || !Number.isFinite(value) || value < 0) return "Value must be a non-negative number"
  const probability = Number(values.probability)
  if (!values.probability.trim() || !Number.isFinite(probability) || probability < 0 || probability > 100) {
    return "Probability must be between 0 and 100"
  }
  if (values.expectedClose && Number.isNaN(new Date(`${values.expectedClose}T00:00:00`).getTime())) {
    return "Expected close date is invalid"
  }
  return null
}

function OpportunityFormFields({
  form,
  clients,
  onChange,
}: {
  form: OpportunityForm
  clients: AgencyClient[]
  onChange: (field: keyof OpportunityForm, value: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="opportunity-form-name">Name</Label>
        <Input id="opportunity-form-name" value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Opportunity name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="opportunity-form-client">Client</Label>
        <Select id="opportunity-form-client" value={form.clientId} onChange={(e) => onChange("clientId", e.target.value)}>
          <option value="">Unassigned</option>
          {clients.map((client) => <option key={client.clientId} value={client.clientId}>{client.name}</option>)}
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="opportunity-form-stage">Stage</Label>
        <Select id="opportunity-form-stage" value={form.stage} onChange={(e) => onChange("stage", e.target.value)}>
          {STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="opportunity-form-value">Value</Label>
        <Input id="opportunity-form-value" type="number" min="0" step="any" value={form.value} onChange={(e) => onChange("value", e.target.value)} placeholder="0" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="opportunity-form-probability">Probability</Label>
        <Input id="opportunity-form-probability" type="number" min="0" max="100" step="1" value={form.probability} onChange={(e) => onChange("probability", e.target.value)} placeholder="0-100" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="opportunity-form-source">Source</Label>
        <Input id="opportunity-form-source" value={form.source} onChange={(e) => onChange("source", e.target.value)} placeholder="Referral, inbound, ..." />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="opportunity-form-close">Expected close</Label>
        <Input id="opportunity-form-close" type="date" value={form.expectedClose} onChange={(e) => onChange("expectedClose", e.target.value)} />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="opportunity-form-next-step">Next step</Label>
        <Input id="opportunity-form-next-step" value={form.nextStep} onChange={(e) => onChange("nextStep", e.target.value)} placeholder="Schedule proposal review" />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="opportunity-form-notes">Notes</Label>
        <Textarea id="opportunity-form-notes" value={form.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Opportunity notes" />
      </div>
    </div>
  )
}

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
  const [creating, setCreating] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Opportunity | null>(null)
  const [form, setForm] = useState<OpportunityForm>(emptyOpportunityForm)
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null)

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

  function handleDelete(deal: Opportunity) {
    if (!canWriteCrm) return
    setDeleteTarget(deal)
  }

  async function confirmDelete() {
    if (!deleteTarget || !canWriteCrm) return
    const deal = deleteTarget
    setDeletingId(deal.opportunityId)
    try {
      await deleteOpportunity(deal.opportunityId)
      await reload()
      toast.success("Opportunity deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  function openCreate() {
    setForm(emptyOpportunityForm())
    setEditingDeal(null)
    setShowCreate(true)
  }

  function openEdit(deal: Opportunity) {
    setForm(opportunityFormFromDeal(deal))
    setEditingDeal(deal)
    setShowCreate(false)
  }

  function opportunityPayload(values: OpportunityForm): Partial<Opportunity> {
    return {
      name: values.name.trim(),
      clientId: values.clientId || null,
      stage: values.stage,
      value: Number(values.value),
      probability: Number(values.probability),
      source: values.source.trim(),
      expectedClose: values.expectedClose || null,
      nextStep: values.nextStep.trim(),
      notes: values.notes.trim(),
    }
  }

  async function handleCreate() {
    if (!canWriteCrm) return
    const validationError = validateOpportunityForm(form)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setCreating(true)
    try {
      await createOpportunity({ ...opportunityPayload(form), owner: "Unassigned" })
      setShowCreate(false)
      await reload()
      toast.success("Opportunity created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  async function handleEdit() {
    if (!editingDeal || !canWriteCrm) return
    const validationError = validateOpportunityForm(form)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setCreating(true)
    try {
      await updateOpportunity(editingDeal.opportunityId, opportunityPayload(form))
      setEditingDeal(null)
      await reload()
      toast.success("Opportunity updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="CRM pipeline"
        description="Sales desk — opportunities by stage with weighted pipeline value."
        actions={
          canWriteCrm ? (
            <Button size="sm" onClick={openCreate}>
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
                          {canWriteCrm ? (
                            <span className="flex shrink-0 gap-0.5">
                              <Button size="icon" variant="ghost" className="size-6" onClick={() => openEdit(deal)} aria-label={`Edit ${deal.name}`}>
                                <PencilIcon className="size-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="size-6 text-destructive" disabled={deletingId === deal.opportunityId} onClick={() => handleDelete(deal)} aria-label={`Delete ${deal.name}`}>
                                <Trash2Icon className="size-3" />
                              </Button>
                            </span>
                          ) : null}
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
      <EntityFormDialog
        open={showCreate || editingDeal !== null}
        onOpenChange={(open) => {
          if (!open && !creating) {
            setShowCreate(false)
            setEditingDeal(null)
          }
        }}
        title={editingDeal ? "Edit opportunity" : "New opportunity"}
        description="Capture the commercial details and next action for this deal."
        onSubmit={editingDeal ? handleEdit : handleCreate}
        submitLabel={editingDeal ? "Save changes" : "Create opportunity"}
        pending={creating}
        submitDisabled={!form.name.trim()}
        maxWidth="max-w-2xl"
      >
        <OpportunityFormFields
          form={form}
          clients={clients}
          onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
        />
      </EntityFormDialog>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null) }}
        title={`Delete opportunity "${deleteTarget?.name ?? ""}"?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={Boolean(deleteTarget && deletingId === deleteTarget.opportunityId)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
