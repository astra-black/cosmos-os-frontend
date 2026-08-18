import { useCallback, useEffect, useMemo, useState } from "react"
import { MailIcon, PencilIcon, PhoneIcon, PlusIcon, Trash2Icon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createCrmContact, deleteCrmContact, listClients, listCrmContacts, updateCrmContact } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { AgencyClient, CrmContact } from "@/types/agency"

const SAMPLE_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&h=120&q=80",
  "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=120&h=120&q=80",
]

export function CrmContactsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_crm")
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", clientId: "", title: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: "", email: "", title: "" })
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrmContact | null>(null)

  const reload = useCallback(async () => {
    setError(null)
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
    if (!form.name.trim() || !canWrite) return
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

  async function handleDelete(contact: CrmContact) {
    if (!canWrite) return
    setPendingId(`delete:${contact.contactId}`)
    try {
      await deleteCrmContact(contact.contactId)
      await reload()
      toast.success("Contact deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setPendingId(null)
      setDeleteTarget(null)
    }
  }

  function startEdit(contact: CrmContact) {
    setEditingId(contact.contactId)
    setEditForm({ name: contact.name, email: contact.email ?? "", title: contact.title ?? "" })
  }

  async function saveEdit() {
    if (!editingId || !canWrite) return
    if (!editForm.name.trim()) {
      toast.error("Contact name is required")
      return
    }
    if (editForm.email.trim() && !/^\S+@\S+\.\S+$/.test(editForm.email.trim())) {
      toast.error("Enter a valid email address")
      return
    }
    const contactId = editingId
    setPendingId(`edit:${contactId}`)
    try {
      await updateCrmContact(contactId, { name: editForm.name.trim(), email: editForm.email.trim(), title: editForm.title.trim() })
      setEditingId(null)
      await reload()
      toast.success("Contact updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Contacts"
        description="People at client accounts — decision makers and day-to-day."
        actions={
          canWrite ? <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            <PlusIcon className="size-3.5" />
            Add contact
          </Button> : undefined
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((contact) => {
            const initials = contact.name
              .split(/\s+/)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            const avatarIndex = Math.abs(
              contact.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
            ) % SAMPLE_AVATARS.length
            const avatarUrl = SAMPLE_AVATARS[avatarIndex]
            return (
              <Card
                key={contact.contactId}
                className="relative overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 bg-card border border-border rounded-xl p-5 flex flex-col justify-between min-h-[176px]"
              >
                {/* Background Watermark */}
                <UserRoundIcon className="absolute -bottom-8 -right-8 size-36 opacity-[0.02] text-foreground pointer-events-none select-none" />

                {/* Top Section: Profile Header */}
                  <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-11 border border-border shadow-sm">
                      <AvatarImage src={avatarUrl} alt={contact.name} />
                      <AvatarFallback className="bg-muted text-xs font-semibold leading-none">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm tracking-tight text-foreground">{contact.name}</span>
                        {contact.isPrimary && (
                          <Badge variant="default" className="h-4.5 text-[9px] px-1.5 uppercase font-bold tracking-wider">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-[11px] font-mono leading-none mt-1">
                        {contact.title || "Consultant"}
                      </div>
                    </div>
                  </div>

                  {canWrite ? <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-7" disabled={Boolean(pendingId)} onClick={() => startEdit(contact)} aria-label={`Edit ${contact.name}`}><PencilIcon className="size-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="size-7 text-destructive" disabled={Boolean(pendingId)} onClick={() => setDeleteTarget(contact)} aria-label={`Delete ${contact.name}`}><Trash2Icon className="size-3.5" /></Button>
                  </div> : null}
                  {/* Smartcard Chip Accent */}
                  <div className="opacity-40 shrink-0 select-none">
                    <svg className="size-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" className="text-muted/10" />
                    </svg>
                  </div>
                </div>

                {editingId === contact.contactId ? (
                  <div className="mt-3 grid gap-2">
                    <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" />
                    <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" />
                    <Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" />
                    <div className="flex gap-2"><Button size="sm" onClick={() => void saveEdit()} disabled={pendingId === `edit:${contact.contactId}` || !editForm.name.trim()}>Save</Button><Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={Boolean(pendingId)}>Cancel</Button></div>
                  </div>
                ) : null}

                {/* Card Divider Line */}
                <div className="w-full h-px border-t border-dashed border-border/80 my-4" />

                {/* Bottom Section: Details & Metadata */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                    {contact.clientName && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 mb-1">
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                          <line x1="9" y1="22" x2="9" y2="16" />
                          <line x1="15" y1="22" x2="15" y2="16" />
                          <line x1="9" y1="16" x2="15" y2="16" />
                          <path d="M8 6h2M8 10h2M14 6h2M14 10h2" />
                        </svg>
                        {contact.clientName}
                      </span>
                    )}

                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="inline-flex items-center gap-1.5 truncate hover:text-foreground transition-colors font-mono"
                      >
                        <MailIcon className="size-3 shrink-0 text-muted-foreground/60" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors font-mono"
                      >
                        <PhoneIcon className="size-3 shrink-0 text-muted-foreground/60" />
                        {contact.phone}
                      </a>
                    )}
                  </div>

                  {/* Metadata Row: Role Badge & Barcode */}
                  <div className="flex items-center justify-between gap-3 mt-1">
                    {contact.role ? (
                      <Badge variant="outline" className="text-[9px] font-mono capitalize tracking-wide h-5 py-0">
                        {contact.role.replace("_", " ")}
                      </Badge>
                    ) : (
                      <div />
                    )}

                    {/* Barcode Accent */}
                    <div className="flex items-center gap-[1px] opacity-15 shrink-0 select-none h-4.5">
                      <div className="w-[1px] h-full bg-foreground" />
                      <div className="w-[2px] h-full bg-foreground" />
                      <div className="w-[1px] h-full bg-foreground" />
                      <div className="w-[3px] h-full bg-foreground" />
                      <div className="w-[1px] h-full bg-foreground" />
                      <div className="w-[2px] h-full bg-foreground" />
                      <div className="w-[1px] h-full bg-foreground" />
                    </div>
                  </div>
                </div>

              </Card>
            )
          })}
        </div>
      )}
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !pendingId) setDeleteTarget(null) }}
        title={`Delete ${deleteTarget?.name ?? "contact"}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteTarget ? pendingId === `delete:${deleteTarget.contactId}` : false}
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget) : undefined}
      />
    </div>
  )
}
