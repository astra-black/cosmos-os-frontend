import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { LoaderIcon, MegaphoneIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampaigns, useClients } from "@/hooks/use-agency-data"
import { createCampaign, deleteCampaign, updateCampaign } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
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
  const [editForm, setEditForm] = useState<CampaignForm>(emptyForm)
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
    setEditForm({ name: campaign.name, clientId: campaign.clientId || "", status: campaign.status, startDate: campaign.startDate?.slice(0, 10) || "", endDate: campaign.endDate?.slice(0, 10) || "", objective: campaign.objective || "", owner: campaign.owner || "", budget: campaign.budget == null ? "" : String(campaign.budget) })
  }

  async function handleEdit() {
    if (!editingId || !canWrite) return
    const validationError = validateCampaignForm(editForm)
    if (validationError) { toast.error(validationError); return }
    const budget = editForm.budget ? Number(editForm.budget) : 0
    setSavingId(editingId)
    try {
      const client = clients.find((c) => c.clientId === editForm.clientId)
      await updateCampaign(editingId, { name: editForm.name.trim(), clientId: editForm.clientId || null, clientName: client?.name, budget, status: editForm.status, startDate: editForm.startDate || null, endDate: editForm.endDate || null, objective: editForm.objective.trim(), owner: editForm.owner.trim() })
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
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
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

      {showCreate ? (
        <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="text-muted-foreground mb-1 block text-xs">Name</label>
            <Input
              placeholder="Campaign name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">Client</label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1 block text-xs">Budget</label>
            <Input
              type="number"
              placeholder="0"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
            />
          </div>
          <div><label className="text-muted-foreground mb-1 block text-xs">Status</label><select className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}>{CAMPAIGN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
          <div><label className="text-muted-foreground mb-1 block text-xs">StartDate</label><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></div>
          <div><label className="text-muted-foreground mb-1 block text-xs">EndDate</label><Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></div>
          <div><label className="text-muted-foreground mb-1 block text-xs">Owner</label><Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} /></div>
          <div className="sm:col-span-2"><label className="text-muted-foreground mb-1 block text-xs">Objective</label><Input value={form.objective} onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))} /></div>
          <Button size="sm" disabled={creating || !form.name.trim()} onClick={handleCreate}>
            {creating ? <LoaderIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
            Create
          </Button>
        </Card>
      ) : null}

      <div className="bg-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
        <span>
          <span className="text-muted-foreground">Programs </span>
          <span className="font-semibold tabular-nums">{filtered.length}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Budget </span>
          <span className="font-semibold tabular-nums">
            ${Math.round(totalBudget / 1000)}k
          </span>
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
           {["all", ...CAMPAIGN_STATUSES].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              className="rounded-full capitalize"
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
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
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((campaign) => {
            const projectIds = campaign.projectIds ?? []
            const projectCount = projectIds.length
            return (
              <Card key={campaign.campaignId} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-muted-foreground font-mono text-xs">
                      {campaign.campaignId}
                    </div>
                    <h2 className="mt-0.5 text-base font-semibold leading-snug">
                      {campaign.name}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {campaign.clientId ? (
                        <Link
                          to={`/clients/${campaign.clientId}`}
                          className="hover:text-primary underline-offset-2 hover:underline"
                        >
                          {campaign.clientName || campaign.clientId}
                        </Link>
                      ) : (
                        campaign.clientName || "—"
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize shrink-0">{campaign.status}</Badge>
                     {canWrite ? <><Button size="icon" variant="ghost" className="size-7" disabled={Boolean(savingId) || Boolean(deletingId)} onClick={() => startEdit(campaign)} aria-label={`Edit ${campaign.name}`}><PencilIcon className="size-3.5" /></Button><Button size="icon" variant="ghost" className="size-7 text-destructive" disabled={deletingId === campaign.campaignId || Boolean(savingId)} onClick={() => setDeleteTarget({ id: campaign.campaignId, name: campaign.name })} aria-label={`Delete ${campaign.name}`}><Trash2Icon className="size-3.5" /></Button></> : null}
                  </div>
                </div>
                 {editingId === campaign.campaignId ? <div className="grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4"><div className="sm:col-span-2"><label className="text-muted-foreground mb-1 block text-xs">Name</label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div><div><label className="text-muted-foreground mb-1 block text-xs">Client</label><select className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={editForm.clientId} onChange={(e) => setEditForm((f) => ({ ...f, clientId: e.target.value }))}><option value="">Unassigned</option>{clients.map((c) => <option key={c.clientId} value={c.clientId}>{c.name}</option>)}</select></div><div><label className="text-muted-foreground mb-1 block text-xs">Budget</label><Input type="number" min="0" value={editForm.budget} onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))} /></div><div><label className="text-muted-foreground mb-1 block text-xs">Status</label><select className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}>{CAMPAIGN_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div><div><label className="text-muted-foreground mb-1 block text-xs">StartDate</label><Input type="date" value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} /></div><div><label className="text-muted-foreground mb-1 block text-xs">EndDate</label><Input type="date" value={editForm.endDate} onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))} /></div><div><label className="text-muted-foreground mb-1 block text-xs">Owner</label><Input value={editForm.owner} onChange={(e) => setEditForm((f) => ({ ...f, owner: e.target.value }))} /></div><div className="sm:col-span-2"><label className="text-muted-foreground mb-1 block text-xs">Objective</label><Input value={editForm.objective} onChange={(e) => setEditForm((f) => ({ ...f, objective: e.target.value }))} /></div><div className="flex items-end gap-2"><Button size="sm" disabled={savingId === editingId || !editForm.name.trim()} onClick={() => void handleEdit()}>{savingId === editingId ? <LoaderIcon className="size-3.5 animate-spin" /> : null}Save</Button><Button size="sm" variant="ghost" disabled={savingId === editingId} onClick={() => setEditingId(null)}>Cancel</Button></div></div> : null}
                {campaign.objective ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {campaign.objective}
                  </p>
                ) : null}
                <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                  <span>
                    {campaign.startDate
                      ? new Date(campaign.startDate).toLocaleDateString()
                      : "—"}{" "}
                    →{" "}
                    {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "—"}
                  </span>
                  <span className="text-right tabular-nums">
                    {campaign.budget != null ? `$${campaign.budget.toLocaleString()}` : "—"}
                  </span>
                  <span>Owner: {campaign.owner || "—"}</span>
                  <span className="text-right">{projectCount} projects</span>
                </div>
                {projectCount > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {projectIds.slice(0, 6).map((pid) => (
                      <Button
                        key={pid}
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full font-mono text-[11px]"
                        render={<Link to={`/projects/${pid}`} />}
                      >
                        {pid}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div>
                  <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                    <span>Linked projects</span>
                    <span className="tabular-nums">{projectCount}</span>
                  </div>
                  <Progress value={Math.min(projectCount * 25, 100)} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <ConfirmationDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deletingId) setDeleteTarget(null) }} title="Delete campaign?" description={deleteTarget ? `This will permanently delete “${deleteTarget.name}”.` : undefined} confirmLabel="Delete" destructive pending={Boolean(deleteTarget && deletingId === deleteTarget.id)} onConfirm={handleDelete} />
    </div>
  )
}
