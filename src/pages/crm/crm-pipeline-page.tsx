import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRightIcon,
  CalendarIcon,
  CopyIcon,
  LayoutGridIcon,
  ListIcon,
  Loader2Icon,
  MailIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  RocketIcon,
  SparklesIcon,
  Trash2Icon,
  TrendingUpIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { AiOutreachModal, DealDetailsSheet, LeadExtractionModal } from "@/components/modals"
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
import { enrichOpportunity } from "@/lib/api/outreach"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { AgencyClient, CrmSummary, Opportunity } from "@/types/agency"
import { cn } from "@/lib/utils"

function getDealContact(deal: Opportunity) {
  let name = deal.contactName || deal.primaryContact?.name
  let title = deal.contactTitle || deal.primaryContact?.title
  let email = deal.contactEmail || deal.primaryContact?.email
  let phone = deal.contactPhone || deal.primaryContact?.phone

  if (!email && deal.notes) {
    const emailMatch = deal.notes.match(/Email:\s*([^\s\n\r]+)/i)
    if (emailMatch) email = emailMatch[1].trim()
  }
  if (!title && deal.notes) {
    const titleMatch = deal.notes.match(/Title:\s*([^\n\r]+)/i)
    if (titleMatch) title = titleMatch[1].trim()
  }
  if (!phone && deal.notes) {
    const phoneMatch = deal.notes.match(/Phone:\s*([^\n\r]+)/i)
    if (phoneMatch) phone = phoneMatch[1].trim()
  }
  if (!name && deal.name?.includes(" — ")) {
    name = deal.name.split(" — ").slice(1).join(" — ").trim()
  }
  return { name, title, email, phone }
}

function cleanDealNotes(notes?: string | null): string {
  if (!notes) return ""
  return notes
    .replace(/Apollo\s*ID:[^\n\r]*/gi, "")
    .replace(/Source:\s*Apollo[^\n\r]*/gi, "")
    .replace(/Email:\s*[^\n\r]*/gi, "")
    .replace(/Title:\s*[^\n\r]*/gi, "")
    .replace(/Company:\s*[^\n\r]*/gi, "")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
}

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
  validationError,
}: {
  form: OpportunityForm
  clients: AgencyClient[]
  onChange: (field: keyof OpportunityForm, value: string) => void
  validationError?: string | null
}) {
  return (
    <div className="space-y-6">
      {validationError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <p className="font-medium">Check the highlighted details before saving.</p>
          <p className="mt-0.5 text-xs text-destructive/80">{validationError}</p>
        </div>
      ) : null}
      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Opportunity basics</p>
          <p className="text-xs text-muted-foreground">Identify the account and the current stage of the deal.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="opportunity-form-name">Opportunity name <span className="text-destructive">*</span></Label>
            <Input
              id="opportunity-form-name"
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="e.g. Website redesign — Acme"
              autoFocus
              required
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-client">Client</Label>
            <Select id="opportunity-form-client" value={form.clientId} onChange={(e) => onChange("clientId", e.target.value)} className="h-10">
          <option value="">Unassigned</option>
          {clients.map((client) => <option key={client.clientId} value={client.clientId}>{client.name}</option>)}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-stage">Stage</Label>
            <Select id="opportunity-form-stage" value={form.stage} onChange={(e) => onChange("stage", e.target.value)} className="h-10">
          {STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Commercials</p>
          <p className="text-xs text-muted-foreground">Use the values your team uses for forecasting.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-value">Estimated value <span className="text-destructive">*</span></Label>
            <Input id="opportunity-form-value" type="number" inputMode="decimal" min="0" step="any" value={form.value} onChange={(e) => onChange("value", e.target.value)} placeholder="0" required className="h-10" />
            <p className="text-[11px] text-muted-foreground">Enter 0 if the value is not confirmed yet.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-probability">Probability <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input id="opportunity-form-probability" type="number" inputMode="numeric" min="0" max="100" step="1" value={form.probability} onChange={(e) => onChange("probability", e.target.value)} placeholder="0–100" required className="h-10 pr-8" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-source">Source</Label>
            <Input id="opportunity-form-source" value={form.source} onChange={(e) => onChange("source", e.target.value)} placeholder="Referral, inbound, Apollo..." className="h-10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-close">Expected close</Label>
            <Input id="opportunity-form-close" type="date" value={form.expectedClose} onChange={(e) => onChange("expectedClose", e.target.value)} className="h-10" />
          </div>
        </div>
      </section>

      <section className="space-y-3 border-t border-border/60 pt-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Next action</p>
          <p className="text-xs text-muted-foreground">Keep the next step specific so the pipeline stays actionable.</p>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-next-step">Next step</Label>
            <Input id="opportunity-form-next-step" value={form.nextStep} onChange={(e) => onChange("nextStep", e.target.value)} placeholder="Schedule proposal review" className="h-10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opportunity-form-notes">Notes</Label>
            <Textarea id="opportunity-form-notes" value={form.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Context, decision makers, risks, or follow-up details..." className="min-h-28 resize-y" />
          </div>
        </div>
      </section>
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
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiModalMode, setAiModalMode] = useState<"proposal" | "followup">("proposal")
  const [aiTargetDeal, setAiTargetDeal] = useState<Opportunity | null>(null)
  const [leadExtractionModalOpen, setLeadExtractionModalOpen] = useState(false)
  const [selectedDetailDeal, setSelectedDetailDeal] = useState<Opportunity | null>(null)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")

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

  async function handleEnrichOpportunity(deal: Opportunity) {
    setEnrichingId(deal.opportunityId)
    try {
      const res = await enrichOpportunity(deal.opportunityId)
      if (res.data?.opportunityId) {
        const updated = res.data
        setDeals((prev) =>
          prev.map((d) => (d.opportunityId === updated.opportunityId ? { ...d, ...updated } : d))
        )
        if (selectedDetailDeal?.opportunityId === updated.opportunityId) {
          setSelectedDetailDeal((prev) => (prev ? { ...prev, ...updated } : updated))
        }
      } else {
        await reload()
      }
      const revealed = res.data?.enrichment
      if (revealed && !revealed.email && !revealed.phone && !revealed.linkedin) {
        toast.warning(revealed.message)
      } else {
        toast.success(
          revealed?.message || "Contact details revealed & enriched successfully",
        )
      }
      if (revealed?.phonePending) {
        window.setTimeout(() => {
          void reload().catch(() => undefined)
        }, 7000)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reveal contact details")
    } finally {
      setEnrichingId(null)
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
    setFormError(null)
    setEditingDeal(null)
    setShowCreate(true)
  }

  function openEdit(deal: Opportunity) {
    setForm(opportunityFormFromDeal(deal))
    setFormError(null)
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
      setFormError(validationError)
      toast.error(validationError)
      return
    }
    setFormError(null)
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            CRM Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sales desk — track opportunities across stages with probability weighting and conversion tools.
          </p>
        </div>
        {canWriteCrm ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLeadExtractionModalOpen(true)}
              className="rounded-full px-4 h-9 gap-2"
            >
              <SearchIcon className="size-3.5" />
              Extract Leads
            </Button>
            <Button
              size="sm"
              onClick={openCreate}
              className="bg-[#270045] text-white hover:bg-[#3a006b] rounded-full px-4 h-9 shadow-xs"
            >
              <PlusIcon className="size-3.5 mr-1" />
              New deal
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <Card className="border-destructive/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-destructive">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void reload().catch(() => undefined)}>Retry</Button>
          </div>
        </Card>
      ) : null}

      {/* Pipeline KPI Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Open Pipeline</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">
            {summary ? money(summary.pipelineValue) : "—"}
          </p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary">
              Total unweighted volume
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Weighted Forecast</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">
            {summary ? money(summary.weightedPipeline) : "—"}
          </p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-orange/15 text-orange">
              Probability adjusted
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Open Deals</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">
            {summary?.openDeals ?? "—"}
          </p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-surface-alt text-muted-foreground">
              Active opportunities
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Won YTD</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">
            {summary ? money(summary.wonValue) : "—"}
          </p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-success/15 text-success">
              Closed revenue
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Opportunities</p>
          <p className="text-xs text-muted-foreground">{deals.length} total opportunities</p>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-1 shadow-2xs" role="group" aria-label="Choose CRM view">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "kanban" ? "secondary" : "ghost"}
            onClick={() => setViewMode("kanban")}
            className="h-8 gap-1.5 px-2.5 text-xs"
            aria-pressed={viewMode === "kanban"}
          >
            <LayoutGridIcon className="size-3.5" />
            Kanban
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            onClick={() => setViewMode("list")}
            className="h-8 gap-1.5 px-2.5 text-xs"
            aria-pressed={viewMode === "list"}
          >
            <ListIcon className="size-3.5" />
            List
          </Button>
        </div>
      </div>

      {viewMode === "kanban" ? (loading ? (
        <div className="flex gap-4 overflow-x-auto pb-6 items-start scrollbar-thin">
          {STAGES.map((s) => (
            <Skeleton key={s.id} className="h-[580px] w-[320px] min-w-[320px] shrink-0 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-6 items-start scrollbar-thin">
          {lanes.map((lane) => (
            <section
              key={lane.id}
              className={cn(
                "bg-surface-alt/40 flex min-h-[520px] w-[320px] min-w-[320px] shrink-0 flex-col rounded-2xl border border-border/70 p-3.5",
                lane.id === "won" && "border-success/30 bg-success/5",
                lane.id === "lost" && "opacity-75"
              )}
            >
              <header className="mb-3 space-y-1 px-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-sora text-sm font-semibold text-foreground tracking-tight">{lane.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {lane.id === "lead" && canWriteCrm ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setLeadExtractionModalOpen(true)}
                        className="h-6 px-1.5 text-[11px] font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/15 gap-1 rounded-md"
                        title="Find leads"
                      >
                        <PlusIcon className="size-3" />
                        Find Leads
                      </Button>
                    ) : null}
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-surface border border-border text-foreground tabular-nums shadow-2xs">
                      {lane.items.length}
                    </span>
                  </div>
                </div>
                <div className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {money(lane.value)}
                </div>
              </header>

              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
                {lane.items.length === 0 ? (
                  lane.id === "lead" ? (
                    <div className="flex flex-1 flex-col items-center justify-center p-5 text-center rounded-xl border border-dashed border-sky-500/30 bg-sky-500/5 my-2 gap-2">
                      <div className="size-9 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400">
                        <SparklesIcon className="size-4.5" />
                      </div>
                      <p className="text-xs text-foreground font-semibold">No active leads</p>
                      <p className="text-[11px] text-muted-foreground leading-snug max-w-[170px]">
                        Search and import verified prospective clients directly into this pipeline.
                      </p>
                      {canWriteCrm ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLeadExtractionModalOpen(true)}
                          className="mt-1 h-7 text-xs border-sky-500/40 text-sky-400 hover:bg-sky-500/20 gap-1.5 rounded-lg font-medium"
                        >
                          <SearchIcon className="size-3" />
                          Find Leads
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-border/60 bg-surface/40 my-2">
                      <p className="text-xs text-muted-foreground font-medium">No deals in {lane.label}</p>
                    </div>
                  )
                ) : (
                  lane.items.map((deal) => {
                    const contact = getDealContact(deal)
                    const companyName = deal.clientName || (deal.name.includes(" — ") ? deal.name.split(" — ")[0].trim() : deal.name)
                    const opportunitySubject = deal.name.includes(" — ") ? deal.name.split(" — ").slice(1).join(" — ").trim() : (deal.clientName ? deal.name : null)
                    const cleanNotes = cleanDealNotes(deal.notes)

                    return (
                      <article
                        key={deal.opportunityId}
                        onClick={() => setSelectedDetailDeal(deal)}
                        className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col gap-2.5 cursor-pointer group"
                      >
                        {/* Top: Company Name + Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="min-w-0 flex-1 group/title"
                            title="Click to view full prospect intelligence & details"
                          >
                            <h3 className="font-sora text-sm font-bold text-foreground leading-snug truncate group-hover:text-primary transition-colors">
                              {companyName}
                            </h3>
                            {opportunitySubject && opportunitySubject !== contact.name ? (
                              <p className="text-xs text-muted-foreground truncate mt-0.5" title={opportunitySubject}>
                                {opportunitySubject}
                              </p>
                            ) : null}
                          </div>

                          {canWriteCrm ? (
                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-foreground"
                                onClick={() => openEdit(deal)}
                                aria-label={`Edit ${deal.name}`}
                              >
                                <PencilIcon className="size-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground hover:text-destructive"
                                disabled={deletingId === deal.opportunityId}
                                onClick={() => handleDelete(deal)}
                                aria-label={`Delete ${deal.name}`}
                              >
                                <Trash2Icon className="size-3" />
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        {/* Contact Details Block (Click to view full profile) */}
                        {(contact.name || contact.email || contact.phone) && (
                          <div
                            className="rounded-lg bg-surface-alt/70 border border-border/60 p-2 text-xs flex flex-col gap-1 cursor-pointer hover:bg-surface-alt hover:border-primary/40 transition-all group/contact shadow-2xs"
                            onClick={() => setSelectedDetailDeal(deal)}
                            title="Click to view full contact details & intelligence"
                          >
                            {contact.name && (
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <UserIcon className="size-3 text-primary/70 shrink-0 group-hover/contact:text-primary transition-colors" />
                                  <span className="font-semibold text-foreground truncate group-hover/contact:text-primary transition-colors">
                                    {contact.name}
                                  </span>
                                </div>
                                {contact.title && (
                                  <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[110px]" title={contact.title}>
                                    {contact.title}
                                  </span>
                                )}
                              </div>
                            )}

                            {contact.email ? (
                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                <a
                                  href={`mailto:${contact.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 truncate font-mono text-[11px]"
                                  title={`Send email to ${contact.email}`}
                                >
                                  <MailIcon className="size-3 shrink-0" />
                                  <span className="truncate">{contact.email}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(contact.email!)
                                    toast.success("Email copied to clipboard")
                                  }}
                                  className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0"
                                  title="Copy email"
                                >
                                  <CopyIcon className="size-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                                  <MailIcon className="size-3 opacity-60" />
                                  Email not revealed
                                </span>
                                <button
                                  type="button"
                                  disabled={enrichingId === deal.opportunityId}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleEnrichOpportunity(deal)
                                  }}
                                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 flex items-center gap-0.5"
                                >
                                  {enrichingId === deal.opportunityId ? "Revealing..." : "Reveal"}
                                </button>
                              </div>
                            )}

                            {contact.phone && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <PhoneIcon className="size-2.5 shrink-0" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Commercials + Probability */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                          <span className="font-sora text-sm font-bold text-foreground tabular-nums">
                            {deal.value > 0 ? money(deal.value) : <span className="text-xs text-muted-foreground font-normal">TBD</span>}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                              deal.stage === "won"
                                ? "bg-success/15 text-success border border-success/20"
                                : deal.stage === "lost"
                                ? "bg-destructive/15 text-destructive border border-destructive/20"
                                : deal.probability >= 70
                                ? "bg-success/15 text-success border border-success/20"
                                : deal.probability >= 40
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                : "bg-surface-alt text-muted-foreground border border-border"
                            )}
                          >
                            {deal.probability}%
                          </span>
                        </div>

                        {/* Meta: Close date & Owner */}
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-1">
                          <span className="truncate">{deal.owner || "Unassigned"}</span>
                          {deal.expectedClose && (
                            <span className="flex items-center gap-1 shrink-0">
                              <CalendarIcon className="size-3 text-muted-foreground" />
                              {new Date(deal.expectedClose).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Next Step / Notes snippet */}
                        {deal.nextStep ? (
                          <p className="text-[11px] text-muted-foreground bg-surface/80 p-1.5 rounded-md border border-border/50 line-clamp-2">
                            <span className="font-semibold text-foreground">Next:</span> {deal.nextStep}
                          </p>
                        ) : cleanNotes ? (
                          <p className="text-[11px] text-muted-foreground bg-surface/60 p-1.5 rounded-md border border-border/40 line-clamp-2 italic">
                            {cleanNotes.split("\n")[0]}
                          </p>
                        ) : null}

                        {/* Action buttons */}
                        {canWriteCrm ? (
                          <div className="flex flex-col gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              {contact.email ? (
                                <Button
                                  size="sm"
                                  className="h-7 flex-1 text-xs bg-sky-600 hover:bg-sky-500 text-white gap-1 rounded-lg font-medium shadow-2xs"
                                  onClick={() => {
                                    setAiTargetDeal(deal)
                                    setAiModalMode(lane.id === "lead" ? "proposal" : "followup")
                                    setAiModalOpen(true)
                                  }}
                                >
                                  <MailIcon className="size-3" />
                                  Send Email
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={enrichingId === deal.opportunityId}
                                  className="h-7 flex-1 text-xs border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 gap-1 rounded-lg font-medium shadow-2xs"
                                  onClick={() => void handleEnrichOpportunity(deal)}
                                  title="Reveal direct email and verified phone number"
                                >
                                  {enrichingId === deal.opportunityId ? (
                                    <Loader2Icon className="size-3 animate-spin" />
                                  ) : (
                                    <SparklesIcon className="size-3 text-amber-400" />
                                  )}
                                  Reveal Contact
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 gap-1 text-[11px] border-border text-foreground hover:bg-surface-alt rounded-lg"
                                onClick={() => {
                                  setAiTargetDeal(deal)
                                  setAiModalMode("proposal")
                                  setAiModalOpen(true)
                                }}
                              >
                                <SparklesIcon className="size-3 text-sky-400" />
                                Pitch
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] border-border text-foreground hover:bg-surface-alt rounded-lg"
                                onClick={() => {
                                  setAiTargetDeal(deal)
                                  setAiModalMode("followup")
                                  setAiModalOpen(true)
                                }}
                                title="Compose follow-up"
                              >
                                Follow-up
                              </Button>
                            </div>

                            {/* Stage Transitions */}
                            {lane.next ? (
                              <Button
                                size="sm"
                                className="h-7 w-full text-xs bg-[#270045] text-white hover:bg-[#3a006b] rounded-lg shadow-xs"
                                disabled={busyId === deal.opportunityId}
                                onClick={() => moveDeal(deal, lane.next!)}
                              >
                                {busyId === deal.opportunityId ? (
                                  <Loader2Icon className="size-3 animate-spin" />
                                ) : (
                                  <div className="flex items-center justify-center gap-1">
                                    <span>Move to {lane.next}</span>
                                    <ArrowRightIcon className="size-3" />
                                  </div>
                                )}
                              </Button>
                            ) : null}

                            {lane.id === "negotiation" ? (
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-7 flex-1 text-xs bg-success/20 text-success hover:bg-success/30 border border-success/30 rounded-lg font-semibold"
                                  disabled={busyId === deal.opportunityId}
                                  onClick={() => moveDeal(deal, "won")}
                                >
                                  Won
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 flex-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg font-semibold"
                                  disabled={busyId === deal.opportunityId}
                                  onClick={() => moveDeal(deal, "lost")}
                                >
                                  Lost
                                </Button>
                              </div>
                            ) : null}

                            {lane.id === "won" ? (
                              <Button
                                size="sm"
                                className="h-8 w-full text-xs bg-[#7a5cc2] text-white hover:bg-[#6a4eb2] rounded-lg shadow-xs gap-1.5"
                                disabled={busyId === deal.opportunityId}
                                onClick={() => void startDelivery(deal)}
                              >
                                {busyId === deal.opportunityId ? (
                                  <Loader2Icon className="size-3.5 animate-spin" />
                                ) : (
                                  <RocketIcon className="size-3.5" />
                                )}
                                Start delivery
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      )) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : deals.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-alt text-muted-foreground">
                <ListIcon className="size-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">No opportunities yet</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">Create a deal or extract leads to start building your pipeline.</p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_120px_120px_110px_44px] items-center gap-4 border-b border-border bg-surface-alt/50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Opportunity</span>
                <span>Contact</span>
                <span>Stage</span>
                <span>Value</span>
                <span>Close date</span>
                <span />
              </div>
              <div className="divide-y divide-border/70">
                {deals.map((deal) => {
                  const contact = getDealContact(deal)
                  const stage = STAGES.find((item) => item.id === deal.stage)
                  return (
                    <div
                      key={deal.opportunityId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedDetailDeal(deal)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") setSelectedDetailDeal(deal)
                      }}
                      className="grid cursor-pointer gap-3 px-4 py-3.5 transition-colors hover:bg-surface-alt/45 md:grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_120px_120px_110px_44px] md:items-center md:gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3 md:block">
                          <p className="truncate text-sm font-semibold text-foreground">{deal.name}</p>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-foreground md:hidden">{deal.value > 0 ? money(deal.value) : "TBD"}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{deal.owner || "Unassigned"}{deal.source ? ` · ${deal.source}` : ""}</p>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserIcon className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{contact.name || "No contact"}</p>
                          <p className="truncate">{contact.email || contact.phone || "Details not revealed"}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="w-fit gap-1.5 rounded-full text-[10px] font-semibold">
                        <span className={cn("size-1.5 rounded-full", deal.stage === "won" ? "bg-success" : deal.stage === "lost" ? "bg-destructive" : "bg-primary")} />
                        {stage?.label || deal.stage}
                      </Badge>
                      <div className="hidden text-sm font-bold tabular-nums text-foreground md:block">{deal.value > 0 ? money(deal.value) : "TBD"}</div>
                      <div className="hidden text-xs text-muted-foreground md:block">
                        {deal.expectedClose ? new Date(deal.expectedClose).toLocaleDateString() : "—"}
                      </div>
                      <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        {canWriteCrm ? (
                          <>
                            <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(deal)} aria-label={`Edit ${deal.name}`}>
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" disabled={deletingId === deal.opportunityId} onClick={() => handleDelete(deal)} aria-label={`Delete ${deal.name}`}>
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
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
          validationError={formError}
          onChange={(field, value) => {
            setFormError(null)
            setForm((current) => ({ ...current, [field]: value }))
          }}
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
      {aiTargetDeal && (
        <AiOutreachModal
          open={aiModalOpen}
          onOpenChange={setAiModalOpen}
          mode={aiModalMode}
          targetId={aiTargetDeal.opportunityId}
          targetName={aiTargetDeal.name}
          recipientEmail={getDealContact(aiTargetDeal).email || undefined}
          recipientName={getDealContact(aiTargetDeal).name || undefined}
        />
      )}
      <LeadExtractionModal
        open={leadExtractionModalOpen}
        onOpenChange={setLeadExtractionModalOpen}
        onSuccess={() => void reload().catch(() => undefined)}
      />
      <DealDetailsSheet
        open={Boolean(selectedDetailDeal)}
        onOpenChange={(open) => {
          if (!open) setSelectedDetailDeal(null)
        }}
        deal={selectedDetailDeal}
        nextStage={
          selectedDetailDeal
            ? STAGES.find((s) => s.id === selectedDetailDeal.stage)?.next
            : null
        }
        onMoveStage={(deal, next) => void moveDeal(deal, next)}
        onSendEmail={(deal) => {
          setAiTargetDeal(deal)
          setAiModalMode(deal.stage === "lead" ? "proposal" : "followup")
          setAiModalOpen(true)
        }}
        onEdit={(deal) => openEdit(deal)}
        onEnrich={handleEnrichOpportunity}
        enriching={enrichingId === selectedDetailDeal?.opportunityId}
      />
    </div>
  )
}
