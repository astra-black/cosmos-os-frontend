import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Building2Icon,
  MailIcon,
  PhoneIcon,
  PlusIcon,
  PencilIcon,
  StickyNoteIcon,
  UserIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { CreateClientModal } from "@/components/modals"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useClients } from "@/hooks/use-agency-data"
import {
  createCrmActivity,
  deleteCrmActivity,
  listCrmActivities,
  listCrmContacts,
  listOpportunities,
  updateClient,
  updateCrmActivity,
  deleteClient,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type {
  AgencyClient,
  CrmActivity,
  CrmContact,
  Opportunity,
} from "@/types/agency"
import { cn } from "@/lib/utils"

const STAGES = ["prospect", "onboarding", "active", "paused", "churned"] as const
const HEALTH_OPTIONS = ["strong", "watch", "new", "risk"] as const
type Tab = "overview" | "contacts" | "deals" | "activity" | "comments"
type ClientForm = {
  name: string
  industry: string
  stage: string
  email: string
  phone: string
  health: string
  arr: string
  tags: string
  notes: string
}

const emptyClientForm = (): ClientForm => ({
  name: "",
  industry: "",
  stage: "prospect",
  email: "",
  phone: "",
  health: "",
  arr: "",
  tags: "",
  notes: "",
})

function clientFormFromClient(client: AgencyClient): ClientForm {
  return {
    name: client.name,
    industry: client.industry ?? "",
    stage: client.stage,
    email: client.email ?? "",
    phone: client.phone ?? "",
    health: client.health ?? "",
    arr: client.arr == null ? "" : String(client.arr),
    tags: client.tags?.join(", ") ?? "",
    notes: client.notes ?? "",
  }
}

function validateClientForm(values: ClientForm) {
  if (!values.name.trim()) return "Name is required"
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) return "Email is invalid"
  if (values.arr.trim()) {
    const arr = Number(values.arr)
    if (!Number.isFinite(arr) || arr < 0) return "ARR must be a non-negative number"
  }
  return null
}

function ClientFormFields({
  form,
  onChange,
}: {
  form: ClientForm
  onChange: (field: keyof ClientForm, value: string) => void
}) {
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="client-form-name">Name</Label>
          <Input id="client-form-name" value={form.name} onChange={(e) => onChange("name", e.target.value)} placeholder="Account name" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client-form-industry">Industry</Label>
          <Input id="client-form-industry" value={form.industry} onChange={(e) => onChange("industry", e.target.value)} placeholder="Industry" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client-form-stage">Stage</Label>
          <Select id="client-form-stage" value={form.stage} onChange={(e) => onChange("stage", e.target.value)}>
            {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client-form-email">Email</Label>
          <Input id="client-form-email" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} placeholder="contact@example.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client-form-phone">Phone</Label>
          <Input id="client-form-phone" type="tel" value={form.phone} onChange={(e) => onChange("phone", e.target.value)} placeholder="Phone number" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client-form-health">Health</Label>
          <Select id="client-form-health" value={form.health} onChange={(e) => onChange("health", e.target.value)}>
            <option value="">Not set</option>
            {HEALTH_OPTIONS.map((health) => <option key={health} value={health}>{health}</option>)}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client-form-arr">ARR</Label>
          <Input id="client-form-arr" type="number" min="0" step="any" value={form.arr} onChange={(e) => onChange("arr", e.target.value)} placeholder="0" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="client-form-tags">Tags</Label>
          <Input id="client-form-tags" value={form.tags} onChange={(e) => onChange("tags", e.target.value)} placeholder="retainer, priority, launch" />
          <p className="text-muted-foreground text-xs">Separate tags with commas.</p>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="client-form-notes">Notes</Label>
          <Textarea id="client-form-notes" value={form.notes} onChange={(e) => onChange("notes", e.target.value)} placeholder="Account notes" />
        </div>
      </div>
    </>
  )
}

function money(n?: number) {
  if (n == null) return "—"
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

export function ClientsPage() {
  const { clientId: routeClientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canWriteCrm = canPerform(user?.role, "write_crm")
  const {
    data: clients,
    loading,
    error,
    reload: reloadClients,
  } = useClients()
  const [selectedId, setSelectedId] = useState(routeClientId || "")
  const [stageFilter, setStageFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<Tab>("overview")
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [deals, setDeals] = useState<Opportunity[]>([])
  const [activities, setActivities] = useState<CrmActivity[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [clientFormMode, setClientFormMode] = useState<"edit" | null>(null)
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm)
  const [editClientTarget, setEditClientTarget] = useState<AgencyClient | null>(null)
  const [deleteClientTarget, setDeleteClientTarget] = useState<AgencyClient | null>(null)
  const [note, setNote] = useState("")
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [activityForm, setActivityForm] = useState({ subject: "", body: "" })
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null)
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<CrmActivity | null>(null)

  const selectClient = useCallback(
    (id: string, replace = false) => {
      setSelectedId(id)
      if (id) {
        navigate(`/clients/${id}`, { replace })
      } else {
        navigate("/clients", { replace })
      }
    },
    [navigate],
  )

  useEffect(() => {
    if (routeClientId) {
      setSelectedId(routeClientId)
      return
    }
    if (!selectedId && clients[0]) {
      selectClient(clients[0].clientId, true)
    }
  }, [clients, routeClientId, selectedId, selectClient])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    async function loadDetail() {
      setDetailLoading(true)
      try {
        const [cRes, dRes, aRes] = await Promise.all([
          listCrmContacts({ clientId: selectedId }),
          listOpportunities({ clientId: selectedId }),
          listCrmActivities({ clientId: selectedId }),
        ])
        if (cancelled) return
        setContacts(cRes.data ?? [])
        setDeals(dRes.data ?? [])
        setActivities(aRes.data ?? [])
      } catch {
        if (!cancelled) {
          setContacts([])
          setDeals([])
          setActivities([])
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!`${c.name} ${c.industry} ${c.accountLead}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [clients, stageFilter, search])

  const selected = clients.find((c) => c.clientId === selectedId) ?? null
  const openDealValue = deals
    .filter((d) => !["won", "lost"].includes(d.stage))
    .reduce((s, d) => s + (d.value || 0), 0)

  function openCreateClient() {
    setCreateClientOpen(true)
  }

  function openEditClient(client: AgencyClient) {
    setClientForm(clientFormFromClient(client))
    setEditClientTarget(client)
    setClientFormMode("edit")
  }

  function clientPayload(values: ClientForm): Partial<AgencyClient> {
    return {
      name: values.name.trim(),
      industry: values.industry.trim(),
      stage: values.stage,
      email: values.email.trim(),
      phone: values.phone.trim(),
      health: values.health,
      arr: values.arr.trim() ? Number(values.arr) : 0,
      tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      notes: values.notes.trim(),
    }
  }

  async function handleSaveClient() {
    if (!canWriteCrm || !editClientTarget) return
    const validationError = validateClientForm(clientForm)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSavingClient(true)
    try {
      const payload = clientPayload(clientForm)
      await updateClient(editClientTarget.clientId, payload)
      await reloadClients()
      setClientFormMode(null)
      setEditClientTarget(null)
      toast.success("Account updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setSavingClient(false)
    }
  }

  async function advanceStage(client: AgencyClient) {
    if (!canWriteCrm) return
    const idx = STAGES.indexOf(client.stage as (typeof STAGES)[number])
    const next = STAGES[Math.min(idx + 1, STAGES.length - 1)]
    try {
      await updateClient(client.clientId, { stage: next })
      await reloadClients()
      toast.success(`${client.name} → ${next}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    }
  }

  function handleDelete(client: AgencyClient) {
    if (!canWriteCrm) return
    setDeleteClientTarget(client)
  }

  async function confirmDeleteClient() {
    if (!deleteClientTarget || !canWriteCrm) return
    const client = deleteClientTarget
    setDeleting(true)
    try {
      await deleteClient(client.clientId)
      await reloadClients()
      selectClient("")
      toast.success("Account deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
      setDeleteClientTarget(null)
    }
  }

  async function logNote() {
    if (!canWriteCrm || !selectedId || !note.trim()) return
    try {
      await createCrmActivity({
        clientId: selectedId,
        type: "note",
        subject: "Account note",
        body: note.trim(),
        actor: "Cosmos OS",
      })
      setNote("")
      const aRes = await listCrmActivities({ clientId: selectedId })
      setActivities(aRes.data ?? [])
      toast.success("Note logged")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not log note")
    }
  }

  function startActivityEdit(activity: CrmActivity) {
    setEditingActivityId(activity.crmActivityId)
    setActivityForm({ subject: activity.subject, body: activity.body ?? "" })
  }

  async function saveActivityEdit() {
    if (!editingActivityId || !canWriteCrm || !selectedId) return
    if (!activityForm.subject.trim()) {
      toast.error("Activity subject is required")
      return
    }
    const activityId = editingActivityId
    setPendingActivityId(`edit:${activityId}`)
    try {
      await updateCrmActivity(activityId, { subject: activityForm.subject.trim(), body: activityForm.body.trim() })
      setEditingActivityId(null)
      const result = await listCrmActivities({ clientId: selectedId })
      setActivities(result.data ?? [])
      toast.success("Activity updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update activity")
    } finally {
      setPendingActivityId(null)
    }
  }

  async function deleteActivity() {
    if (!deleteActivityTarget || !canWriteCrm || !selectedId) return
    const activityId = deleteActivityTarget.crmActivityId
    setPendingActivityId(`delete:${activityId}`)
    try {
      await deleteCrmActivity(activityId)
      const result = await listCrmActivities({ clientId: selectedId })
      setActivities(result.data ?? [])
      toast.success("Activity deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete activity")
    } finally {
      setPendingActivityId(null)
      setDeleteActivityTarget(null)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: `Contacts (${contacts.length})` },
    { id: "deals", label: `Deals (${deals.length})` },
    { id: "activity", label: `Activity (${activities.length})` },
    { id: "comments", label: "Comments" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Accounts"
        description="CRM accounts — stage, health, contacts, deals, and activity log."
        actions={
          canWriteCrm ? (
            <Button size="sm" onClick={openCreateClient}>
              <PlusIcon className="size-3.5" />
              Add account
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-destructive">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void reloadClients()}>Retry</Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts…"
          className="w-full sm:max-w-xs"
        />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {["all", ...STAGES].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={stageFilter === s ? "default" : "outline"}
              className="shrink-0 rounded-full capitalize"
              onClick={() => setStageFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <aside
            className={cn(
              "flex flex-col gap-2 overflow-y-auto",
              /* On mobile: hide list when detail selected so detail gets full screen */
              selectedId ? "hidden max-h-none lg:flex lg:max-h-[70vh] lg:w-80 lg:shrink-0" : "max-h-[70vh] lg:w-80 lg:shrink-0",
            )}
          >
            {filtered.length === 0 ? (
              <EmptyState title="No accounts" description="Adjust filters or add an account." />
            ) : (
              filtered.map((client) => (
                <button
                  key={client.clientId}
                  type="button"
                  onClick={() => {
                    selectClient(client.clientId)
                    setTab("overview")
                  }}
                  className={cn(
                    "bg-card hover:bg-muted/50 rounded-xl border p-3 text-left transition-colors",
                    selectedId === client.clientId && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{client.name}</div>
                      <div className="text-muted-foreground text-xs">{client.industry}</div>
                    </div>
                    <Badge variant="secondary" className="capitalize shrink-0">
                      {client.stage}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-2 flex justify-between text-[11px]">
                    <span>{client.accountLead}</span>
                    <span className="tabular-nums">{money(client.arr)}</span>
                  </div>
                </button>
              ))
            )}
          </aside>

          <div className={cn("min-w-0 flex-1", !selectedId && "hidden lg:block")}>
            {!selected ? (
              <EmptyState
                icon={<Building2Icon className="size-8 opacity-40" />}
                title="Select an account"
              />
            ) : (
              <div className="flex flex-col gap-4">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-fit lg:hidden"
                  onClick={() => selectClient("")}
                >
                  ← Accounts
                </Button>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{selected.name}</h2>
                      <p className="text-muted-foreground font-mono text-xs">
                        {selected.clientId}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="capitalize">{selected.stage}</Badge>
                      <Badge variant="outline" className="capitalize">
                        {selected.health}
                      </Badge>
                       {selected.stage !== "churned" ? (
                         <Button size="sm" variant="outline" onClick={() => advanceStage(selected)}>
                           Advance stage
                         </Button>
                       ) : null}
                       {canWriteCrm ? (
                         <>
                           <Button size="icon" variant="ghost" className="size-8" onClick={() => openEditClient(selected)} aria-label={`Edit ${selected.name}`}>
                             <PencilIcon className="size-3.5" />
                           </Button>
                           <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={deleting} onClick={() => handleDelete(selected)} aria-label={`Delete ${selected.name}`}>
                             <Trash2Icon className="size-3.5" />
                           </Button>
                         </>
                       ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="text-muted-foreground text-[11px]">ARR</div>
                      <div className="font-semibold tabular-nums">{money(selected.arr)}</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="text-muted-foreground text-[11px]">Open pipeline</div>
                      <div className="font-semibold tabular-nums">{money(openDealValue)}</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="text-muted-foreground text-[11px]">Contacts</div>
                      <div className="font-semibold tabular-nums">{contacts.length}</div>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <div className="text-muted-foreground text-[11px]">Deals</div>
                      <div className="font-semibold tabular-nums">{deals.length}</div>
                    </div>
                  </div>
                </Card>

                <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {tabs.map((t) => (
                    <Button
                      key={t.id}
                      size="sm"
                      variant={tab === t.id ? "default" : "outline"}
                      className="shrink-0 rounded-full"
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>

                {detailLoading ? (
                  <Skeleton className="h-48 w-full rounded-xl" />
                ) : tab === "overview" ? (
                  <Card className="flex flex-col gap-4 p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="text-sm">
                        <div className="text-muted-foreground text-xs">Account lead</div>
                        <div className="mt-1 flex items-center gap-1.5 font-medium">
                          <UserIcon className="size-3.5" />
                          {selected.accountLead || "—"}
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="text-muted-foreground text-xs">Primary contact</div>
                        <div className="mt-1 font-medium">{selected.primaryContact || "—"}</div>
                        {selected.email ? (
                          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                            <MailIcon className="size-3" />
                            {selected.email}
                          </div>
                        ) : null}
                        {selected.phone ? (
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                            <PhoneIcon className="size-3" />
                            {selected.phone}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {selected.tags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {selected.tags.map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {selected.notes ? (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {selected.notes}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Log a quick account note…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void logNote()}
                      />
                      <Button size="sm" variant="outline" disabled={!note.trim()} onClick={logNote}>
                        <StickyNoteIcon className="size-3.5" />
                        Log
                      </Button>
                    </div>
                  </Card>
                ) : tab === "contacts" ? (
                  contacts.length === 0 ? (
                    <EmptyState title="No contacts on this account" />
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {contacts.map((c) => (
                        <Card key={c.contactId} className="p-4 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{c.name}</span>
                            {c.isPrimary ? <Badge className="h-5">Primary</Badge> : null}
                          </div>
                          <div className="text-muted-foreground text-xs">{c.title}</div>
                          <div className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                            {c.email ? <div>{c.email}</div> : null}
                            {c.phone ? <div>{c.phone}</div> : null}
                          </div>
                          {c.role ? (
                            <Badge variant="outline" className="mt-2 capitalize">
                              {c.role.replace("_", " ")}
                            </Badge>
                          ) : null}
                        </Card>
                      ))}
                    </div>
                  )
                ) : tab === "deals" ? (
                  deals.length === 0 ? (
                    <EmptyState title="No opportunities" description="Create deals on the Pipeline page." />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {deals.map((d) => (
                        <Card
                          key={d.opportunityId}
                          className="flex flex-wrap items-center justify-between gap-3 p-4"
                        >
                          <div>
                            <div className="font-medium">{d.name}</div>
                            <div className="text-muted-foreground text-xs">
                              {d.owner}
                              {d.nextStep ? ` · Next: ${d.nextStep}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold tabular-nums">{money(d.value)}</span>
                            <Badge className="capitalize">{d.stage}</Badge>
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {d.probability}%
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )
                ) : tab === "activity" ? (
                  activities.length === 0 ? (
                    <EmptyState title="No CRM activity yet" />
                  ) : (
                    <ol className="flex flex-col gap-2">
                       {activities.map((a) => (
                         <Card key={a.crmActivityId} className="p-3">
                           {editingActivityId === a.crmActivityId ? (
                             <div className="grid gap-2">
                               <Input value={activityForm.subject} onChange={(e) => setActivityForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Subject" />
                               <Input value={activityForm.body} onChange={(e) => setActivityForm((f) => ({ ...f, body: e.target.value }))} placeholder="Details" />
                               <div className="flex gap-2"><Button size="sm" onClick={() => void saveActivityEdit()} disabled={pendingActivityId === `edit:${a.crmActivityId}` || !activityForm.subject.trim()}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditingActivityId(null)} disabled={Boolean(pendingActivityId)}>Cancel</Button></div>
                             </div>
                           ) : null}
                           <div className="flex flex-wrap items-center gap-2">
                             <Badge variant="outline" className="capitalize">
                               {a.type}
                             </Badge>
                             <span className="text-sm font-medium">{a.subject}</span>
                             {canWriteCrm ? <span className="ml-auto flex gap-1"><Button size="icon-xs" variant="ghost" onClick={() => startActivityEdit(a)} disabled={Boolean(pendingActivityId)} aria-label={`Edit ${a.subject}`}><PencilIcon className="size-3" /></Button><Button size="icon-xs" variant="ghost" className="text-destructive" onClick={() => setDeleteActivityTarget(a)} disabled={Boolean(pendingActivityId)} aria-label={`Delete ${a.subject}`}><Trash2Icon className="size-3" /></Button></span> : null}
                           </div>
                           {a.body && editingActivityId !== a.crmActivityId ? (
                            <p className="text-muted-foreground mt-1 text-sm">{a.body}</p>
                          ) : null}
                          <div className="text-muted-foreground mt-2 text-[11px]">
                            {a.actor} · {new Date(a.at).toLocaleString()}
                          </div>
                        </Card>
                      ))}
                    </ol>
                  )
                ) : (
                  <CommentsPanel
                    entityType="client"
                    entityId={selected.clientId}
                    title="Account comments"
                  />
                )}
              </div>
            )}
       </div>
       <CreateClientModal
         open={createClientOpen}
         onOpenChange={setCreateClientOpen}
         onSuccess={async (client) => {
           await reloadClients()
           if (client.clientId) selectClient(client.clientId)
         }}
       />
       <EntityFormDialog
         open={clientFormMode === "edit"}
         onOpenChange={(open) => {
           if (!open && !savingClient) {
             setClientFormMode(null)
             setEditClientTarget(null)
           }
         }}
         title="Edit account"
         description="Keep account details, health, and commercial context in one place."
         onSubmit={handleSaveClient}
         submitLabel="Save changes"
         pending={savingClient}
         submitDisabled={!clientForm.name.trim()}
         maxWidth="max-w-2xl"
       >
         <ClientFormFields
           form={clientForm}
           onChange={(field, value) => setClientForm((current) => ({ ...current, [field]: value }))}
         />
       </EntityFormDialog>
       <ConfirmationDialog
         open={Boolean(deleteClientTarget)}
         onOpenChange={(open) => { if (!open && !deleting) setDeleteClientTarget(null) }}
         title={`Delete account "${deleteClientTarget?.name ?? ""}"?`}
         description="This action cannot be undone."
         confirmLabel="Delete"
         destructive
         pending={deleting}
         onConfirm={confirmDeleteClient}
       />
       <ConfirmationDialog
         open={Boolean(deleteActivityTarget)}
        onOpenChange={(open) => { if (!open && !pendingActivityId) setDeleteActivityTarget(null) }}
        title={`Delete ${deleteActivityTarget?.subject ?? "activity"}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteActivityTarget ? pendingActivityId === `delete:${deleteActivityTarget.crmActivityId}` : false}
        onConfirm={deleteActivity}
      />
    </div>
      )}
    </div>
  )
}
