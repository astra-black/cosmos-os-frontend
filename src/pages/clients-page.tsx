import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Building2Icon,
  MailIcon,
  PhoneIcon,
  PlusIcon,
  StickyNoteIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CommentsPanel } from "@/components/shared/comments-panel"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useClients } from "@/hooks/use-agency-data"
import {
  createClient,
  createCrmActivity,
  listCrmActivities,
  listCrmContacts,
  listOpportunities,
  updateClient,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type {
  CrmActivity,
  CrmContact,
  Opportunity,
} from "@/types/agency"
import { cn } from "@/lib/utils"

const STAGES = ["prospect", "onboarding", "active", "paused", "churned"] as const
type Tab = "overview" | "contacts" | "deals" | "activity" | "comments"

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
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [note, setNote] = useState("")

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

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await createClient({ name: newName.trim(), stage: "prospect" })
      await reloadClients()
      if (res.data?.clientId) selectClient(res.data.clientId)
      setNewName("")
      toast.success("Account created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  async function advanceStage(client: AgencyClient) {
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

  async function logNote() {
    if (!selectedId || !note.trim()) return
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
            <div className="flex w-full max-w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Input
                placeholder="New account name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full sm:w-44"
              />
              <Button size="sm" disabled={creating || !newName.trim()} onClick={handleCreate}>
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </div>
          ) : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
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
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {a.type}
                            </Badge>
                            <span className="text-sm font-medium">{a.subject}</span>
                          </div>
                          {a.body ? (
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
        </div>
      )}
    </div>
  )
}
