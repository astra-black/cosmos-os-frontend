import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { MegaphoneIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns, useClients } from "@/hooks/use-agency-data"
import { createCampaign, deleteCampaign, updateCampaign } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Campaign, CampaignStatus } from "@/types/agency"

const CAMPAIGN_STATUSES: CampaignStatus[] = ["planning", "active", "completed", "on_hold"]
type CampaignForm = { name: string; clientId: string; status: CampaignStatus; startDate: string; endDate: string; objective: string; owner: string; budget: string }
const emptyForm = (): CampaignForm => ({ name: "", clientId: "", status: "planning", startDate: "", endDate: "", objective: "", owner: "", budget: "" })
function validateCampaignForm(values: CampaignForm) {
  if (!values.name.trim()) return "Name is required"
  if (values.startDate && Number.isNaN(new Date(`${values.startDate}T00:00:00`).getTime())) return "Start date is invalid"
  if (values.endDate && Number.isNaN(new Date(`${values.endDate}T00:00:00`).getTime())) return "End date is invalid"
  if (values.startDate && values.endDate && values.startDate > values.endDate) return "Start date must be before or equal to end date"
  const budget = values.budget ? Number(values.budget) : 0
  if (!Number.isFinite(budget) || budget < 0) return "Budget must be a non-negative number"
  return null
}

function CampaignFormFields({
  form,
  clients,
  onChange,
}: {
  form: CampaignForm
  clients: { clientId: string; name: string }[]
  onChange: (field: keyof CampaignForm, value: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="campaign-form-name">Name</Label>
        <Input id="campaign-form-name" value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Campaign name" required />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="campaign-form-client">Client</Label>
        <select id="campaign-form-client" className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={form.clientId} onChange={(e) => onChange("clientId", e.target.value)}>
          <option value="">Unassigned</option>
          {clients.map((client) => <option key={client.clientId} value={client.clientId}>{client.name}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="campaign-form-status">Status</Label>
        <select id="campaign-form-status" className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={form.status} onChange={(e) => onChange("status", e.target.value)}>
          {CAMPAIGN_STATUSES.map((status) => <option key={status} value={status}>{status.replace("_", " ")}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="campaign-form-start">Start date</Label>
        <Input id="campaign-form-start" type="date" value={form.startDate} onChange={(e) => onChange("startDate", e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="campaign-form-end">End date</Label>
        <Input id="campaign-form-end" type="date" value={form.endDate} onChange={(e) => onChange("endDate", e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="campaign-form-budget">Budget</Label>
        <Input id="campaign-form-budget" type="number" min="0" step="any" value={form.budget} onChange={(e) => onChange("budget", e.target.value)} placeholder="0" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="campaign-form-owner">Owner</Label>
        <Input id="campaign-form-owner" value={form.owner} onChange={(e) => onChange("owner", e.target.value)} placeholder="Owner name" />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="campaign-form-objective">Objective</Label>
        <Input id="campaign-form-objective" value={form.objective} onChange={(e) => onChange("objective", e.target.value)} placeholder="Campaign objective" />
      </div>
    </div>
  )
}

export function CampaignsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_crm")
  const { data: campaigns, loading, error, reload } = useCampaigns()
  const { data: clients } = useClients()
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState<CampaignForm>(emptyForm)

  const filtered = useMemo(() => {
    if (statusFilter === "all") return campaigns
    return campaigns.filter((c) => c.status === statusFilter)
  }, [campaigns, statusFilter])

  const totalBudget = filtered.reduce((s, c) => s + (c.budget ?? 0), 0)

  async function handleCreate() {
    if (!canWrite) return
    const validationError = validateCampaignForm(form)
    if (validationError) { toast.error(validationError); return }
    setCreating(true)
    try {
      const client = clients.find((c) => c.clientId === form.clientId)
      await createCampaign({
        name: form.name.trim(),
        clientId: form.clientId || undefined,
        clientName: client?.name,
        budget: form.budget ? Number(form.budget) : 0,
        status: form.status,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        objective: form.objective.trim(),
        owner: form.owner.trim(),
      })
      await reload()
      setForm(emptyForm())
      setShowCreate(false)
      toast.success("Campaign created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  function startEdit(campaign: Campaign) {
    setEditingId(campaign.campaignId)
    setForm({ name: campaign.name, clientId: campaign.clientId || "", status: campaign.status, startDate: campaign.startDate?.slice(0, 10) || "", endDate: campaign.endDate?.slice(0, 10) || "", objective: campaign.objective || "", owner: campaign.owner || "", budget: campaign.budget == null ? "" : String(campaign.budget) })
  }

  async function handleEdit() {
    if (!editingId || !canWrite) return
    const validationError = validateCampaignForm(form)
    if (validationError) { toast.error(validationError); return }
    const budget = form.budget ? Number(form.budget) : 0
    setSavingId(editingId)
    try {
      const client = clients.find((c) => c.clientId === form.clientId)
      await updateCampaign(editingId, { name: form.name.trim(), clientId: form.clientId || null, clientName: client?.name, budget, status: form.status, startDate: form.startDate || null, endDate: form.endDate || null, objective: form.objective.trim(), owner: form.owner.trim() })
      await reload()
      setEditingId(null)
      toast.success("Campaign updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !canWrite) return
    const campaignId = deleteTarget.id
    setDeletingId(campaignId)
    try {
      await deleteCampaign(campaignId)
      await reload()
      setDeleteTarget(null)
      toast.success("Campaign deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Campaigns"
        description="Client programs that group projects — budget, dates, and ownership."
        actions={
          canWrite ? (
            <Button
              size="sm"
              className="bg-[#270045] hover:bg-[#3b0066] text-white"
              onClick={() => { setForm(emptyForm()); setEditingId(null); setShowCreate(true) }}
            >
              <PlusIcon className="size-3.5" />
              New campaign
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-destructive">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void reload()}>Retry</Button>
          </div>
        </Card>
      ) : null}

      <div className="bg-card rounded-xl border border-border p-4 flex flex-wrap gap-6 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
        <div>
          <div className="text-xs text-muted-foreground uppercase">Total Campaigns</div>
          <div className="font-sora font-bold text-lg">{campaigns.length}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase">Active</div>
          <div className="font-sora font-bold text-lg text-success">
            {campaigns.filter((c) => c.status === "active").length}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase">Total Budget</div>
          <div className="font-sora font-bold text-lg tabular-nums">
            ${Math.round(campaigns.reduce((s, c) => s + (c.budget ?? 0), 0) / 1000)}k
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase">Completed</div>
          <div className="font-sora font-bold text-lg">
            {campaigns.filter((c) => c.status === "completed").length}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> {filtered.length === 1 ? "campaign" : "campaigns"}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", ...CAMPAIGN_STATUSES].map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-[#270045] text-white border border-[#270045]"
                  : "border border-border bg-transparent text-foreground hover:bg-surface-alt"
              )}
              onClick={() => setStatusFilter(s)}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MegaphoneIcon className="size-8 opacity-40" />}
          title="No campaigns"
          description="Create a program for a client to group delivery work."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((campaign) => {
            const projectIds = campaign.projectIds ?? []
            const projectCount = projectIds.length
            return (
              <div
                key={campaign.campaignId}
                className="rounded-xl border border-border bg-card overflow-hidden flex flex-col shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]"
              >
                {/* Card top */}
                <div className="rounded-t-xl px-4 py-3.5 flex items-start justify-between bg-gradient-to-r from-[#270045] to-[#1a002e] gap-2">
                  <div className="min-w-0">
                    <div className="text-white/60 font-mono text-[11px]">
                      {campaign.campaignId.length > 12 ? `#${campaign.campaignId.slice(0, 8)}` : campaign.campaignId}
                    </div>
                    <h2 className="font-sora font-semibold text-sm text-white leading-snug truncate mt-0.5">
                      {campaign.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        campaign.status === "active" && "bg-success/20 text-success",
                        campaign.status === "planning" && "bg-blue/20 text-blue",
                        campaign.status === "completed" && "bg-white/15 text-white text-xs",
                        campaign.status === "on_hold" && "bg-warning/20 text-warning"
                      )}
                    >
                      {campaign.status.replace("_", " ")}
                    </span>
                    {canWrite ? (
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-white/60 hover:text-white hover:bg-white/10"
                          disabled={Boolean(savingId) || Boolean(deletingId)}
                          onClick={() => startEdit(campaign)}
                          aria-label={`Edit ${campaign.name}`}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-white/60 hover:text-white hover:bg-white/10"
                          disabled={deletingId === campaign.campaignId || Boolean(savingId)}
                          onClick={() => setDeleteTarget({ id: campaign.campaignId, name: campaign.name })}
                          aria-label={`Delete ${campaign.name}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 flex flex-col gap-3 flex-1">
                  <div>
                    <div className="text-sm font-medium">
                      {campaign.clientId ? (
                        <Link
                          to={`/clients/${campaign.clientId}`}
                          className="hover:text-primary underline-offset-2 hover:underline"
                        >
                          {campaign.clientName || "Client"}
                        </Link>
                      ) : (
                        campaign.clientName || "—"
                      )}
                    </div>
                    {campaign.objective ? (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {campaign.objective}
                      </p>
                    ) : null}
                  </div>

                  {/* Date range + budget (text-xs grid grid-cols-2) */}
                  <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                    <span>
                      {campaign.startDate
                        ? new Date(campaign.startDate).toLocaleDateString()
                        : "—"}{" "}
                      →{" "}
                      {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "—"}
                    </span>
                    <span className="text-right font-medium text-foreground tabular-nums">
                      {campaign.budget != null ? `$${campaign.budget.toLocaleString()}` : "—"}
                    </span>
                    <span>Owner: {campaign.owner || "—"}</span>
                    <span className="text-right">{projectCount} projects</span>
                  </div>

                  {/* Linked project IDs */}
                  {projectCount > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {projectIds.slice(0, 6).map((pid) => (
                        <Link
                          key={pid}
                          to={`/projects/${pid}`}
                          className="rounded-full bg-surface-alt border border-border text-[11px] font-mono px-2 py-0.5 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          {pid}
                        </Link>
                      ))}
                    </div>
                  ) : null}

                  {/* Progress bar */}
                  <div className="mt-auto pt-1">
                    <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                      <span>Linked projects</span>
                      <span className="tabular-nums font-mono">{projectCount} / 10</span>
                    </div>
                    <Progress value={Math.min((projectCount / 10) * 100, 100)} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <EntityFormDialog
        open={showCreate || editingId !== null}
        onOpenChange={(open) => {
          if (!open && !creating && !savingId) {
            setShowCreate(false)
            setEditingId(null)
          }
        }}
        title={editingId ? "Edit campaign" : "New campaign"}
        description="Set the campaign client, schedule, budget, objective, and owner."
        onSubmit={editingId ? handleEdit : handleCreate}
        submitLabel={editingId ? "Save changes" : "Create campaign"}
        pending={creating || Boolean(savingId)}
        submitDisabled={!form.name.trim()}
        maxWidth="max-w-2xl"
      >
        <CampaignFormFields
          form={form}
          clients={clients}
          onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
        />
      </EntityFormDialog>
      <ConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null) }} title="Delete campaign?" description={deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined} confirmLabel="Delete" destructive pending={Boolean(deleteTarget && deletingId === deleteTarget.id)} onConfirm={handleDelete} />
    </div>
  )
}
