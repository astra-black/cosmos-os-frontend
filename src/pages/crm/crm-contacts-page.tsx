import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, Building2Icon, LockKeyholeIcon, MailIcon, MapPinIcon, PencilIcon, PhoneIcon, PlusIcon, Share2Icon, Trash2Icon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select } from "@/components/ui/select"
import { useProjects } from "@/hooks/use-agency-data"
import { assignCrmContactToProject, createCrmContact, deleteCrmContact, getCrmContact, listClients, listCrmContacts, updateCrmContact, updateCrmContactPortalAccess } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { AgencyClient, CrmContact } from "@/types/agency"

type ContactForm = {
  name: string
  title: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
  clientId: string
}

const emptyContactForm = (): ContactForm => ({
  name: "",
  title: "",
  email: "",
  phone: "",
  role: "day_to_day",
  isPrimary: false,
  clientId: "",
})

export function CrmContactsPage() {
  const navigate = useNavigate()
  const { contactId } = useParams()
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_crm")
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [privatePhoneAccess, setPrivatePhoneAccess] = useState(false)
  const [search, setSearch] = useState("")
  const [clientFilter, setClientFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contactFormMode, setContactFormMode] = useState<"create" | "edit" | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyContactForm)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CrmContact | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const [cRes, clRes] = await Promise.all([listCrmContacts(), listClients()])
    setContacts(cRes.data ?? [])
    setClients(clRes.data ?? [])
    setPrivatePhoneAccess(Boolean(cRes.privatePhoneAccess))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError("Contact records couldn’t be loaded. Check the data service connection and retry.")
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
    if (!canWrite) return
    if (!form.name.trim()) {
      toast.error("Contact name is required")
      return
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error("Enter a valid email address")
      return
    }
    setPendingId("create")
    try {
      await createCrmContact({
        name: form.name.trim(),
        email: form.email.trim(),
        title: form.title.trim(),
        phone: form.phone.trim(),
        role: form.role.trim(),
        isPrimary: form.isPrimary,
        clientId: form.clientId || clients[0]?.clientId,
      })
      setForm(emptyContactForm())
      setContactFormMode(null)
      await reload()
      toast.success("Contact added")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setPendingId(null)
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
    setForm({
      name: contact.name,
      title: contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      role: contact.role ?? "",
      isPrimary: Boolean(contact.isPrimary),
      clientId: contact.clientId ?? "",
    })
    setContactFormMode("edit")
  }

  async function saveEdit() {
    if (!editingId || !canWrite) return
    if (!form.name.trim()) {
      toast.error("Contact name is required")
      return
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error("Enter a valid email address")
      return
    }
    const contactId = editingId
    setPendingId(`edit:${contactId}`)
    try {
      await updateCrmContact(contactId, {
        name: form.name.trim(),
        title: form.title.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role.trim(),
        isPrimary: form.isPrimary,
        clientId: form.clientId || null,
      })
      setEditingId(null)
      setContactFormMode(null)
      await reload()
      toast.success("Contact updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    } finally {
      setPendingId(null)
    }
  }

  if (contactId) return <ContactProfilePage contactId={contactId} canWrite={canWrite} onBack={() => navigate("/contacts")} />

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Contacts"
        description="People at client accounts — decision makers and day-to-day."
        actions={
          canWrite ? <Button size="sm" onClick={() => { setForm(emptyContactForm()); setEditingId(null); setContactFormMode("create") }}>
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

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : error ? (
        <EmptyState icon={<UserRoundIcon className="size-8 opacity-40" />} title="Contact data unavailable" description="The contact service could not be reached. Retry after the connection is restored." />
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

                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => navigate(`/contacts/${contact.contactId}`)}>View profile</Button>
                    {canWrite ? <Button size="icon" variant="ghost" className="size-7" disabled={Boolean(pendingId)} onClick={() => startEdit(contact)} aria-label={`Edit ${contact.name}`}><PencilIcon className="size-3.5" /></Button> : null}
                    {canWrite ? <Button size="icon" variant="ghost" className="size-7 text-destructive" disabled={Boolean(pendingId)} onClick={() => setDeleteTarget(contact)} aria-label={`Delete ${contact.name}`}><Trash2Icon className="size-3.5" /></Button> : null}
                  </div>
                  {/* Smartcard Chip Accent */}
                  <div className="opacity-40 shrink-0 select-none">
                    <svg className="size-6 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="3" />
                      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" className="text-muted/10" />
                    </svg>
                  </div>
                </div>

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
      <EntityFormDialog
        open={contactFormMode !== null}
        onOpenChange={(open) => {
          if (!open && !pendingId) {
            setContactFormMode(null)
            setEditingId(null)
          }
        }}
        title={contactFormMode === "edit" ? "Edit contact" : "Add contact"}
        description="Keep contact details, account ownership, and relationship role current."
        onSubmit={contactFormMode === "edit" ? saveEdit : handleCreate}
        submitLabel={contactFormMode === "edit" ? "Save changes" : "Add contact"}
        pending={Boolean(pendingId)}
        submitDisabled={!form.name.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="contact-form-name">Name</Label>
            <Input id="contact-form-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contact-form-title">Title</Label>
            <Input id="contact-form-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Job title" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contact-form-email">Email</Label>
            <Input id="contact-form-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contact@example.com" />
          </div>
          {privatePhoneAccess ? <div className="grid gap-1.5">
            <Label htmlFor="contact-form-phone">Phone</Label>
            <Input id="contact-form-phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
          </div> : null}
          <div className="grid gap-1.5">
            <Label htmlFor="contact-form-role">Role</Label>
            <Input id="contact-form-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="e.g. decision maker" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contact-form-client">Client</Label>
            <select id="contact-form-client" className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm" value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
              <option value="">Unassigned</option>
              {clients.map((client) => <option key={client.clientId} value={client.clientId}>{client.name}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
          Primary contact
        </label>
      </EntityFormDialog>
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

const PORTAL_CONTACT_FIELDS = [
  ["name", "Name"],
  ["title", "Title"],
  ["role", "Relationship role"],
  ["email", "Email address"],
] as const

function ContactProfilePage({ contactId, canWrite, onBack }: { contactId: string; canWrite: boolean; onBack: () => void }) {
  const { data: projects } = useProjects()
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [shareFields, setShareFields] = useState<string[]>([])
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [projectRole, setProjectRole] = useState("")
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    const result = await getCrmContact(contactId)
    setContact(result.data)
    setShareFields(result.data.portalSharedFields ?? [])
  }, [contactId])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    void getCrmContact(contactId).then((result) => {
      if (active) {
        setContact(result.data)
        setShareFields(result.data.portalSharedFields ?? [])
      }
    }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [contactId])

  async function saveAccess() {
    setSaving(true)
    try {
      const result = await updateCrmContactPortalAccess(contactId, shareFields)
      setContact((current) => current ? { ...current, portalSharedFields: result.data.portalSharedFields ?? [] } : current)
      setAccessOpen(false)
      toast.success("Portal access updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Portal access could not be updated")
    } finally { setSaving(false) }
  }

  async function linkProject() {
    if (!projectId) return
    setSaving(true)
    try {
      await assignCrmContactToProject(contactId, { projectId, role: projectRole })
      await reload()
      setProjectOpen(false)
      setProjectId("")
      setProjectRole("")
      toast.success("Contact linked to project")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Project link could not be saved")
    } finally { setSaving(false) }
  }

  if (loading) return <div className="grid gap-5 xl:grid-cols-2"><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-52 rounded-xl" /></div>
  if (error || !contact) return <div className="flex flex-col gap-5"><PageHeader title="External Contact" description="Contact record details for this organization." actions={<Button size="sm" variant="outline" onClick={onBack}><ArrowLeftIcon className="size-3.5" />Back to contacts</Button>} /><EmptyState icon={<UserRoundIcon className="size-8 opacity-40" />} title={error ? "Contact data unavailable" : "Contact not found"} description={error ? "The contact service could not be reached. Retry after the connection is restored." : "This contact may have been removed or is outside your organization."} /></div>

  const initials = contact.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  const location = [contact.contactDetails?.city, contact.contactDetails?.state, contact.contactDetails?.country].filter(Boolean).join(", ")

  return <div className="flex flex-col gap-5">
    <PageHeader title={contact.name} description="External Contact · Shared record" actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={onBack}><ArrowLeftIcon className="size-3.5" />Back to contacts</Button>{contact.email ? <Button size="sm" onClick={() => { window.location.href = `mailto:${contact.email}` }}><MailIcon className="size-3.5" />Message</Button> : null}</div>} />
    <Card className="flex flex-wrap items-center gap-5 p-5 sm:p-7">
      <Avatar className="size-[72px] border border-border"><AvatarFallback className="bg-gradient-to-br from-[#8d52f4] to-[#eb6adf] font-display text-xl font-semibold text-white">{initials}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-semibold tracking-tight">{contact.name}</h2><Badge variant="outline">External contact</Badge></div><p className="mt-1 text-sm text-muted-foreground">{contact.title || "Contact"}{contact.clientName ? ` · ${contact.clientName}` : ""}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{contact.clientName ? <span className="inline-flex items-center gap-1.5"><Building2Icon className="size-3.5" />{contact.clientName}</span> : null}{location ? <span className="inline-flex items-center gap-1.5"><MapPinIcon className="size-3.5" />{location}</span> : null}</div></div>
    </Card>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.85fr)]">
      <Card className="p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><h3 className="font-display text-base font-semibold">Contact Details</h3><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Shared record</span></div><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {contact.clientName ? <div><dt className="text-xs text-muted-foreground">Client account</dt><dd className="mt-1 text-sm">{contact.clientName}</dd></div> : null}
        {contact.title ? <div><dt className="text-xs text-muted-foreground">Title</dt><dd className="mt-1 text-sm">{contact.title}</dd></div> : null}
        {contact.role ? <div><dt className="text-xs text-muted-foreground">Relationship role</dt><dd className="mt-1 text-sm capitalize">{contact.role.replaceAll("_", " ")}</dd></div> : null}
        {contact.email ? <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 break-all text-sm"><a className="text-primary hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></dd></div> : null}
        {contact.phone ? <div><dt className="text-xs text-muted-foreground">Personal phone</dt><dd className="mt-1 text-sm"><a className="inline-flex items-center gap-1.5 hover:text-primary" href={`tel:${contact.phone}`}><PhoneIcon className="size-3.5" />{contact.phone}</a></dd></div> : contact.privatePhoneAccess === false ? <div><dt className="text-xs text-muted-foreground">Personal phone</dt><dd className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><LockKeyholeIcon className="size-3.5" />Restricted · talent team only</dd></div> : null}
        {contact.contactDetails?.department ? <div><dt className="text-xs text-muted-foreground">Department</dt><dd className="mt-1 text-sm">{contact.contactDetails.department}</dd></div> : null}
      </dl></Card>
      <Card className="p-5 sm:p-6"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-display text-base font-semibold">Who Can See This Record</h3>{canWrite ? <Button size="sm" variant="ghost" onClick={() => setAccessOpen(true)}>Change</Button> : null}</div><div className="space-y-4">
        <div className="flex items-start gap-3"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><Building2Icon className="size-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">Organization members</p><p className="mt-0.5 text-xs text-muted-foreground">View access follows the signed-in member’s organization permissions.</p></div><Badge variant="outline">View</Badge></div>
        <div className="flex items-start gap-3 border-t pt-4"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><Share2Icon className="size-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{contact.clientName ? `${contact.clientName} portal` : "Client portal"}</p><p className="mt-0.5 text-xs text-muted-foreground">{contact.portalSharedFields?.length ? `Shared fields: ${contact.portalSharedFields.map((field) => PORTAL_CONTACT_FIELDS.find(([key]) => key === field)?.[1] ?? field).join(", ")}` : "No contact fields are shared with the client portal."}</p></div><Badge variant="outline">{contact.portalSharedFields?.length ? "Shared" : "Private"}</Badge></div>
        <div className="rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">Portal responses include only the selected contact fields and are scoped to this linked client account.</div>
      </div></Card>
    </div>
    <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-base font-semibold">Projects &amp; Relationship</h3><p className="mt-1 text-xs text-muted-foreground">Project links recorded for this contact.</p></div>{canWrite ? <Button size="sm" variant="outline" onClick={() => setProjectOpen(true)}><PlusIcon className="size-3.5" />Add to project</Button> : null}</div>
      {contact.projects?.length ? <div className="mt-4 divide-y">{contact.projects.map((project) => <div key={project.projectId} className="flex flex-wrap items-center justify-between gap-4 py-3"><div><p className="text-sm font-medium">{project.clientName ? `${project.clientName} · ` : ""}{project.projectName}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{project.role || "Contact"}{project.projectStatus ? ` · ${project.projectStatus}` : ""}</p>{project.notes ? <p className="mt-1 text-xs text-muted-foreground">{project.notes}</p> : null}</div></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No project relationships have been added.</p>}
    </Card>
    <Dialog open={accessOpen} onOpenChange={setAccessOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Client portal access</DialogTitle><DialogDescription>Select which contact fields appear in the portal for {contact.clientName || "the linked client"}.</DialogDescription></DialogHeader><div className="grid gap-3 py-2">{PORTAL_CONTACT_FIELDS.map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={shareFields.includes(key)} onChange={(event) => setShareFields((current) => event.target.checked ? [...current, key] : current.filter((field) => field !== key))} />{label}</label>)}</div><DialogFooter><Button variant="outline" onClick={() => setAccessOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void saveAccess()} disabled={saving}>{saving ? "Saving…" : "Save access"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={projectOpen} onOpenChange={setProjectOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Add contact to project</DialogTitle><DialogDescription>Link this contact to a project belonging to the same organization.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-1.5"><Label htmlFor="contact-project">Project</Label><Select id="contact-project" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Choose a project</option>{projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}</Select></div><div className="grid gap-1.5"><Label htmlFor="contact-project-role">Relationship to project</Label><Input id="contact-project-role" value={projectRole} onChange={(event) => setProjectRole(event.target.value)} placeholder="e.g. Lead contact" /></div></div><DialogFooter><Button variant="outline" onClick={() => setProjectOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void linkProject()} disabled={!projectId || saving}>{saving ? "Saving…" : "Add to project"}</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
