import { useCallback, useEffect, useMemo, useState } from "react"
import { MailIcon, PhoneIcon, PlusIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createCrmContact, listClients, listCrmContacts } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { AgencyClient, CrmContact } from "@/types/agency"

export function CrmContactsPage() {
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", clientId: "", title: "" })

  const reload = useCallback(async () => {
    const [cRes, clRes] = await Promise.all([listCrmContacts(), listClients()])
    setContacts(cRes.data ?? [])
    setClients(clRes.data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load contacts")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reload])

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (clientFilter !== "all" && c.clientId !== clientFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !`${c.name} ${c.email ?? ""} ${c.clientName ?? ""} ${c.title ?? ""}`
            .toLowerCase()
            .includes(q)
        )
          return false
      }
      return true
    })
  }, [contacts, clientFilter, search])

  async function handleCreate() {
    if (!form.name.trim()) return
    try {
      await createCrmContact({
        name: form.name.trim(),
        email: form.email,
        title: form.title,
        clientId: form.clientId || clients[0]?.clientId,
        role: "day_to_day",
      })
      setForm({ name: "", email: "", clientId: "", title: "" })
      setShowCreate(false)
      await reload()
      toast.success("Contact added")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Contacts"
        description="People at client accounts — decision makers and day-to-day."
        actions={
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            <PlusIcon className="size-3.5" />
            Add contact
          </Button>
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, account…"
          className="w-full sm:max-w-sm"
        />
        <select
          className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm sm:max-w-xs"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
        >
          <option value="all">All accounts</option>
          {clients.map((c) => (
            <option key={c.clientId} value={c.clientId}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {showCreate ? (
        <Card className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-5">
          <Input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <select
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
          >
            <option value="">Account…</option>
            {clients.map((c) => (
              <option key={c.clientId} value={c.clientId}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 sm:flex-none" disabled={!form.name.trim()} onClick={handleCreate}>
              Save
            </Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserRoundIcon className="size-8 opacity-40" />}
          title="No contacts"
          description="Add people to link deals and account activity."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => {
            const initials = contact.name
              .split(/\s+/)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            return (
              <Card key={contact.contactId} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{contact.name}</span>
                      {contact.isPrimary ? (
                        <Badge className="h-5">Primary</Badge>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-xs">{contact.title || "—"}</div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {contact.clientName || "No account"}
                    </div>
                  </div>
                </div>
                <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {contact.email ? (
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <MailIcon className="size-3 shrink-0" />
                      {contact.email}
                    </span>
                  ) : null}
                  {contact.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <PhoneIcon className="size-3 shrink-0" />
                      {contact.phone}
                    </span>
                  ) : null}
                </div>
                {contact.role ? (
                  <Badge variant="outline" className="w-fit capitalize">
                    {contact.role.replace("_", " ")}
                  </Badge>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
