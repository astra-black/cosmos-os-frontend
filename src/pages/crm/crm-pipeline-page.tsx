import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRightIcon,
  CalendarIcon,
  CopyIcon,
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
import { AiOutreachModal, LeadExtractionModal } from "@/components/modals"
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
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiModalMode, setAiModalMode] = useState<"proposal" | "followup">("proposal")
  const [aiTargetDeal, setAiTargetDeal] = useState<Opportunity | null>(null)
  const [leadExtractionModalOpen, setLeadExtractionModalOpen] = useState(false)

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

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((s) => (
            <Skeleton key={s.id} className="h-80 w-[min(85vw,17rem)] shrink-0 rounded-2xl md:w-auto" />
          ))}
        </div>
      ) : (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 md:snap-none xl:grid-cols-3 2xl:grid-cols-6">
          {lanes.map((lane) => (
            <section
              key={lane.id}
              className={cn(
                "bg-surface-alt/40 flex min-h-[420px] w-[min(85vw,17rem)] shrink-0 snap-start flex-col rounded-2xl border border-border/70 p-3 md:w-auto md:min-w-0",
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
                        className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col gap-2.5"
                      >
                        {/* Top: Company Name + Actions */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-sora text-sm font-bold text-foreground leading-snug truncate" title={companyName}>
                              {companyName}
                            </h3>
                            {opportunitySubject && opportunitySubject !== contact.name ? (
                              <p className="text-xs text-muted-foreground truncate mt-0.5" title={opportunitySubject}>
                                {opportunitySubject}
                              </p>
                            ) : null}
                          </div>

                          {canWriteCrm ? (
                            <div className="flex items-center gap-0.5 shrink-0">
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

                        {/* Contact Details Block */}
                        {(contact.name || contact.email || contact.phone) && (
                          <div className="rounded-lg bg-surface-alt/70 border border-border/60 p-2 text-xs flex flex-col gap-1">
                            {contact.name && (
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <UserIcon className="size-3 text-primary/70 shrink-0" />
                                  <span className="font-semibold text-foreground truncate">{contact.name}</span>
                                </div>
                                {contact.title && (
                                  <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[110px]" title={contact.title}>
                                    {contact.title}
                                  </span>
                                )}
                              </div>
                            )}

                            {contact.email && (
                              <div className="flex items-center justify-between gap-1 pt-0.5">
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 truncate font-mono text-[11px]"
                                  title={`Send email to ${contact.email}`}
                                >
                                  <MailIcon className="size-3 shrink-0" />
                                  <span className="truncate">{contact.email}</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(contact.email!)
                                    toast.success("Email copied to clipboard")
                                  }}
                                  className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0"
                                  title="Copy email"
                                >
                                  <CopyIcon className="size-3" />
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
                          <div className="flex flex-col gap-1.5 pt-1">
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
                              ) : null}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 flex-1 gap-1 text-[11px] border-border text-foreground hover:bg-surface-alt rounded-lg"
                                onClick={() => {
                                  setAiTargetDeal(deal)
                                  setAiModalMode("proposal")
                                  setAiModalOpen(true)
                                }}
                              >
                                <SparklesIcon className="size-3 text-sky-400" />
                                {lane.id === "lead" ? "AI Pitch" : "Proposal"}
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
    </div>
  )
}
