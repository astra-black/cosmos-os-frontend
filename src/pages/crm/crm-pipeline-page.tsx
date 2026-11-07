import { useCallback, useEffect, useMemo, useState } from "react"
import { LockIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  createOpportunity,
  deleteOpportunity,
  getCrmSummary,
  listClients,
  listOpportunities,
  updateOpportunity,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canAccessRoute, canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { AgencyClient, CrmSummary, Opportunity } from "@/types/agency"

/** All opportunity stages supported by the CRM API. */
const STAGES = [
  { id: "lead", label: "Lead" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
] as const

/** Figma 00.10 · 125–126 board columns (build_collab c_pipeline). */
const BOARD_STAGE_IDS = ["qualified", "proposal", "negotiation", "won"] as const

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
  stage: "qualified",
  value: "",
  probability: "25",
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
  if (!values.value.trim() || !Number.isFinite(value) || value < 0) {
    return "Value must be a non-negative number"
  }
  const probability = Number(values.probability)
  if (
    !values.probability.trim() ||
    !Number.isFinite(probability) ||
    probability < 0 ||
    probability > 100
  ) {
    return "Probability must be between 0 and 100"
  }
  if (values.expectedClose && Number.isNaN(new Date(`${values.expectedClose}T00:00:00`).getTime())) {
    return "Expected close date is invalid"
  }
  return null
}

function money(n: number) {
  if (!Number.isFinite(n)) return "—"
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}M`
  }
  if (n >= 1_000) {
    const k = n / 1000
    return `$${k % 1 === 0 ? Math.round(k) : k.toFixed(1)}K`
  }
  return `$${Math.round(n)}`
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
}

function accountLabel(deal: Opportunity) {
  if (deal.clientName?.trim()) return deal.clientName.trim()
  if (deal.name.includes(" — ")) return deal.name.split(" — ")[0].trim()
  return deal.name
}

function dealSubtitle(deal: Opportunity) {
  if (deal.name.includes(" — ")) {
    const rest = deal.name.split(" — ").slice(1).join(" — ").trim()
    if (rest) return rest
  }
  if (deal.clientName && deal.name !== deal.clientName) return deal.name
  return null
}

function OpportunityFormFields({
  form,
  clients,
  onChange,
  validationError,
}: {
  form: OpportunityForm
  clients: AgencyClient[]
  onChange: (field: keyof OpportunityForm, value: string) => void
  validationError?: string | null
}) {
  return (
    <div className="space-y-5">
      {validationError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {validationError}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pipeline-opp-name">
            Opportunity name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pipeline-opp-name"
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="e.g. Festival series 2027 — Halcyon Live"
            autoFocus
            required
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pipeline-opp-client">Client</Label>
          <Select
            id="pipeline-opp-client"
            value={form.clientId}
            onChange={(e) => onChange("clientId", e.target.value)}
            className="h-10"
          >
            <option value="">Unassigned</option>
            {clients.map((client) => (
              <option key={client.clientId} value={client.clientId}>
                {client.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pipeline-opp-stage">Stage</Label>
          <Select
            id="pipeline-opp-stage"
            value={form.stage}
            onChange={(e) => onChange("stage", e.target.value)}
            className="h-10"
          >
            {STAGES.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pipeline-opp-value">
            Value <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pipeline-opp-value"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.value}
            onChange={(e) => onChange("value", e.target.value)}
            className="h-10"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pipeline-opp-probability">
            Probability <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pipeline-opp-probability"
            type="number"
            inputMode="numeric"
            min="0"
            max="100"
            step="1"
            value={form.probability}
            onChange={(e) => onChange("probability", e.target.value)}
            className="h-10"
            required
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pipeline-opp-next">Next step</Label>
          <Input
            id="pipeline-opp-next"
            value={form.nextStep}
            onChange={(e) => onChange("nextStep", e.target.value)}
            placeholder="Intro call held"
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pipeline-opp-source">Source</Label>
          <Input
            id="pipeline-opp-source"
            value={form.source}
            onChange={(e) => onChange("source", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pipeline-opp-close">Expected close</Label>
          <Input
            id="pipeline-opp-close"
            type="date"
            value={form.expectedClose}
            onChange={(e) => onChange("expectedClose", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pipeline-opp-notes">Notes</Label>
          <Textarea
            id="pipeline-opp-notes"
            value={form.notes}
            onChange={(e) => onChange("notes", e.target.value)}
            className="min-h-24 resize-y"
          />
        </div>
      </div>
    </div>
  )
}

export function CrmPipelinePage() {
  const { user } = useAuth()
  const canView = canAccessRoute(user?.role, "/crm")
  const canWriteCrm = canPerform(user?.role, "write_crm")
  const agencyLabel = user?.agencyName?.trim() || "this organization"

  const [deals, setDeals] = useState<Opportunity[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [summary, setSummary] = useState<CrmSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Opportunity | null>(null)
  const [viewingDeal, setViewingDeal] = useState<Opportunity | null>(null)
  const [form, setForm] = useState<OpportunityForm>(emptyOpportunityForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    if (!canView) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load pipeline")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [canView, reload])

  const lanes = useMemo(
    () =>
      BOARD_STAGE_IDS.map((id) => {
        const stage = STAGES.find((s) => s.id === id)!
        const items = deals.filter((d) => String(d.stage).toLowerCase() === id)
        return { ...stage, items }
      }),
    [deals],
  )

  const offBoard = useMemo(() => {
    const lead = deals.filter((d) => String(d.stage).toLowerCase() === "lead")
    const lost = deals.filter((d) => String(d.stage).toLowerCase() === "lost")
    return { lead, lost }
  }, [deals])

  const openCount = summary?.openDeals ?? deals.filter((d) => !["won", "lost"].includes(String(d.stage).toLowerCase())).length
  const wonCount = summary?.wonCount ?? deals.filter((d) => String(d.stage).toLowerCase() === "won").length

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

  async function moveDeal(deal: Opportunity, next: string) {
    if (!canWriteCrm || next === deal.stage) return
    setBusyId(deal.opportunityId)
    try {
      const patch: Partial<Opportunity> = { stage: next }
      if (next === "won") patch.probability = 100
      if (next === "lost") patch.probability = 0
      await updateOpportunity(deal.opportunityId, patch)
      await reload()
      toast.success(`${accountLabel(deal)} → ${STAGES.find((s) => s.id === next)?.label || next}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Stage update failed")
    } finally {
      setBusyId(null)
    }
  }

  function openCreate() {
    if (!canWriteCrm) return
    setForm(emptyOpportunityForm())
    setFormError(null)
    setEditingDeal(null)
    setViewingDeal(null)
    setShowCreate(true)
  }

  function openEdit(deal: Opportunity) {
    if (!canWriteCrm) return
    setForm(opportunityFormFromDeal(deal))
    setFormError(null)
    setViewingDeal(null)
    setEditingDeal(deal)
    setShowCreate(false)
  }

  function openCard(deal: Opportunity) {
    if (canWriteCrm) {
      openEdit(deal)
      return
    }
    setEditingDeal(null)
    setShowCreate(false)
    setViewingDeal(deal)
  }

  function clientNameFor(deal: Opportunity) {
    if (deal.clientName?.trim()) return deal.clientName.trim()
    if (!deal.clientId) return "Unassigned"
    return clients.find((c) => c.clientId === deal.clientId)?.name || "Assigned client"
  }

  async function handleCreate() {
    if (!canWriteCrm) return
    const validationError = validateOpportunityForm(form)
    if (validationError) {
      setFormError(validationError)
      toast.error(validationError)
      return
    }
    setFormError(null)
    setCreating(true)
    try {
      await createOpportunity({ ...opportunityPayload(form), owner: user?.name || "Unassigned" })
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
      setFormError(validationError)
      toast.error(validationError)
      return
    }
    setFormError(null)
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

  async function confirmDelete() {
    if (!deleteTarget || !canWriteCrm) return
    const deal = deleteTarget
    setDeletingId(deal.opportunityId)
    try {
      await deleteOpportunity(deal.opportunityId)
      await reload()
      setEditingDeal(null)
      toast.success("Opportunity deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  if (!canView) {
    return (
      <div className="cosmos-pipeline-page">
        <EmptyState
          title="Relationships is internal-only"
          description="Your role cannot open the sales pipeline. Ask an administrator if you need access."
        />
      </div>
    )
  }

  return (
    <div className="cosmos-pipeline-page">
      <div className="cosmos-pipeline-page__head">
        <div>
          <p className="cosmos-pipeline-page__eyebrow">{agencyLabel} · Workspace</p>
          <div className="cosmos-pipeline-page__title-row">
            <h1>Relationships</h1>
            {canWriteCrm ? (
              <Button size="sm" onClick={openCreate}>
                <PlusIcon className="size-3.5" />
                New Opportunity
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="cosmos-pipeline-internal">
        <span className="cosmos-pipeline-internal__chip">
          <LockIcon className="size-3" aria-hidden />
          Internal · {agencyLabel} Only
        </span>
        <p>
          Internal to {agencyLabel} sales and leadership. Never shown in client or vendor portals.
        </p>
      </div>

      {error ? (
        <div className="cosmos-pipeline-page__error" role="alert">
          <span>{error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLoading(true)
              void reload()
                .catch((err) =>
                  setError(err instanceof ApiError ? err.message : "Failed to load pipeline"),
                )
                .finally(() => setLoading(false))
            }}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="cosmos-pipeline-kpis">
        <article className="cosmos-pipeline-kpi">
          <p className="cosmos-pipeline-kpi__label">Open Pipeline</p>
          <p className="cosmos-pipeline-kpi__value">
            {loading && !summary ? "—" : money(summary?.pipelineValue ?? 0)}
          </p>
          <p className="cosmos-pipeline-kpi__sub">
            {loading && !summary
              ? "…"
              : `${openCount} ${openCount === 1 ? "opportunity" : "opportunities"}`}
          </p>
        </article>
        <article className="cosmos-pipeline-kpi">
          <p className="cosmos-pipeline-kpi__label">Weighted Forecast</p>
          <p className="cosmos-pipeline-kpi__value">
            {loading && !summary ? "—" : money(summary?.weightedPipeline ?? 0)}
          </p>
          <p className="cosmos-pipeline-kpi__sub">By stage probability</p>
        </article>
        <article className="cosmos-pipeline-kpi">
          <p className="cosmos-pipeline-kpi__label">Won This Quarter</p>
          <p className="cosmos-pipeline-kpi__value">
            {loading && !summary ? "—" : money(summary?.wonValue ?? 0)}
          </p>
          <p className="cosmos-pipeline-kpi__sub">
            {loading && !summary
              ? "…"
              : `${wonCount} ${wonCount === 1 ? "opportunity" : "opportunities"}`}
          </p>
          <p className="cosmos-pipeline-kpi__gap">
            Showing all closed won value — CRM summary has no quarter filter yet.
          </p>
        </article>
      </div>

      {loading ? (
        <div className="cosmos-pipeline-board cosmos-pipeline-board--loading">
          {BOARD_STAGE_IDS.map((id) => (
            <Skeleton key={id} className="h-[420px] min-w-[220px] flex-1 rounded-2xl" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          title="No opportunities yet"
          description={
            canWriteCrm
              ? "Create an opportunity to start the internal pipeline."
              : "No opportunities are recorded for this organization."
          }
        />
      ) : (
        <>
          <div className="cosmos-pipeline-board" role="list">
            {lanes.map((lane) => (
              <section key={lane.id} className="cosmos-pipeline-column" role="listitem">
                <header className="cosmos-pipeline-column__head">
                  <h2>{lane.label}</h2>
                  <span>{lane.items.length}</span>
                </header>
                <div className="cosmos-pipeline-column__cards">
                  {lane.items.length === 0 ? (
                    <p className="cosmos-pipeline-column__empty">No opportunities</p>
                  ) : (
                    lane.items.map((deal) => {
                      const owner = deal.owner?.trim() || "Unassigned"
                      const subtitle = dealSubtitle(deal)
                      return (
                        <article
                          key={deal.opportunityId}
                          className={cn(
                            "cosmos-pipeline-card",
                            busyId === deal.opportunityId && "is-busy",
                          )}
                        >
                          <button
                            type="button"
                            className="cosmos-pipeline-card__main"
                            onClick={() => openCard(deal)}
                            aria-label={
                              canWriteCrm
                                ? `Edit ${accountLabel(deal)}`
                                : `View ${accountLabel(deal)}`
                            }
                          >
                            <h3>{accountLabel(deal)}</h3>
                            {subtitle ? <p className="cosmos-pipeline-card__sub">{subtitle}</p> : null}
                            <div className="cosmos-pipeline-card__value-row">
                              <span className="cosmos-pipeline-card__value">
                                {deal.value > 0 ? money(deal.value) : "—"}
                              </span>
                              <span
                                className="cosmos-pipeline-card__av"
                                title={owner}
                                aria-hidden
                              >
                                {initials(owner) || "?"}
                              </span>
                            </div>
                            {deal.nextStep ? (
                              <p className="cosmos-pipeline-card__note">{deal.nextStep}</p>
                            ) : null}
                          </button>
                          {canWriteCrm ? (
                            <label className="cosmos-pipeline-card__stage">
                              <span className="sr-only">Move stage</span>
                              <Select
                                value={String(deal.stage).toLowerCase()}
                                disabled={busyId === deal.opportunityId}
                                onChange={(e) => void moveDeal(deal, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 text-xs"
                              >
                                {STAGES.map((stage) => (
                                  <option key={stage.id} value={stage.id}>
                                    {stage.label}
                                  </option>
                                ))}
                              </Select>
                            </label>
                          ) : null}
                        </article>
                      )
                    })
                  )}
                </div>
              </section>
            ))}
          </div>

          {offBoard.lead.length > 0 || offBoard.lost.length > 0 ? (
            <div className="cosmos-pipeline-offboard" role="region" aria-label="Additional API stages">
              <p>
                Lead and Lost are in the opportunity API but not on Figma frames 125–126.
                {offBoard.lead.length > 0
                  ? ` ${offBoard.lead.length} in Lead.`
                  : ""}
                {offBoard.lost.length > 0
                  ? ` ${offBoard.lost.length} in Lost.`
                  : ""}
              </p>
              <div className="cosmos-pipeline-offboard__list">
                {[...offBoard.lead, ...offBoard.lost].map((deal) => (
                  <button
                    key={deal.opportunityId}
                    type="button"
                    className="cosmos-pipeline-offboard__item"
                    onClick={() => openCard(deal)}
                    aria-label={
                      canWriteCrm
                        ? `Edit ${accountLabel(deal)}`
                        : `View ${accountLabel(deal)}`
                    }
                  >
                    <span>{accountLabel(deal)}</span>
                    <span>{STAGES.find((s) => s.id === String(deal.stage).toLowerCase())?.label || deal.stage}</span>
                    <span>{deal.value > 0 ? money(deal.value) : "—"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {canWriteCrm ? (
        <EntityFormDialog
          open={showCreate || editingDeal !== null}
          onOpenChange={(open) => {
            if (!open && !creating) {
              setShowCreate(false)
              setEditingDeal(null)
            }
          }}
          title={editingDeal ? "Edit opportunity" : "New Opportunity"}
          description="Internal sales record. Not visible in client or vendor portals."
          onSubmit={editingDeal ? handleEdit : handleCreate}
          submitLabel={editingDeal ? "Save changes" : "Create opportunity"}
          pending={creating}
          submitDisabled={!form.name.trim()}
          maxWidth="max-w-2xl"
        >
          <OpportunityFormFields
            form={form}
            clients={clients}
            validationError={formError}
            onChange={(field, value) => {
              setFormError(null)
              setForm((current) => ({ ...current, [field]: value }))
            }}
          />
          {editingDeal ? (
            <div className="mt-4 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                disabled={Boolean(deletingId)}
                onClick={() => setDeleteTarget(editingDeal)}
              >
                Delete opportunity
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Convert to project is available via API but not on Figma frames 125–126.
              </p>
            </div>
          ) : null}
        </EntityFormDialog>
      ) : null}

      <Dialog
        open={Boolean(viewingDeal) && !canWriteCrm}
        onOpenChange={(open) => {
          if (!open) setViewingDeal(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewingDeal ? accountLabel(viewingDeal) : "Opportunity"}</DialogTitle>
            <DialogDescription>
              Read-only view. Your role cannot edit Relationships pipeline records.
            </DialogDescription>
          </DialogHeader>
          {viewingDeal ? (
            <dl className="cosmos-pipeline-readonly">
              <div>
                <dt>Opportunity</dt>
                <dd>{viewingDeal.name}</dd>
              </div>
              <div>
                <dt>Client</dt>
                <dd>{clientNameFor(viewingDeal)}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>
                  {STAGES.find((s) => s.id === String(viewingDeal.stage).toLowerCase())?.label ||
                    viewingDeal.stage}
                </dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>{viewingDeal.value > 0 ? money(viewingDeal.value) : "—"}</dd>
              </div>
              <div>
                <dt>Probability</dt>
                <dd>{Number.isFinite(viewingDeal.probability) ? `${viewingDeal.probability}%` : "—"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{viewingDeal.owner?.trim() || "Unassigned"}</dd>
              </div>
              <div>
                <dt>Next step</dt>
                <dd>{viewingDeal.nextStep?.trim() || "—"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{viewingDeal.source?.trim() || "—"}</dd>
              </div>
              <div>
                <dt>Expected close</dt>
                <dd>
                  {viewingDeal.expectedClose
                    ? new Date(viewingDeal.expectedClose).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div className="cosmos-pipeline-readonly__notes">
                <dt>Notes</dt>
                <dd>{viewingDeal.notes?.trim() || "—"}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null)
        }}
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
