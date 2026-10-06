import { useEffect, useState } from "react"
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  Link2Icon,
  Loader2Icon,
  MailIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import {
  createDirectShareToken,
  inviteClientPortalUser,
  listClientPortalUsers,
  resendClientPortalInvite,
  revokeClientPortalUser,
  listClientShareableItems,
  setClientItemVisibility,
  type ClientShareableItem,
  type ClientPortalUser,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { AgencyClient, CrmContact } from "@/types/agency"

interface ClientPortalAccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: AgencyClient
  contacts?: CrmContact[]
}

export function ClientPortalAccessModal({
  open,
  onOpenChange,
  client,
  contacts = [],
}: ClientPortalAccessModalProps) {
  const [activeTab, setActiveTab] = useState<"users" | "direct-link" | "sharing">("users")
  const [users, setUsers] = useState<ClientPortalUser[]>([])
  const [loading, setLoading] = useState(true)

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteTitle, setInviteTitle] = useState("")
  const [inviteRole, setInviteRole] = useState<"EXECUTIVE" | "APPROVER" | "VIEWER">("APPROVER")
  const [inviteBusy, setInviteBusy] = useState(false)

  // Direct Link Generator State
  const [linkEntityType, setLinkEntityType] = useState("EVENT_RUNDOWN")
  const [linkEntityTitle, setLinkEntityTitle] = useState("")
  const [linkExpiresHours, setLinkExpiresHours] = useState("72")
  const [generatedLink, setGeneratedLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [shareableItems, setShareableItems] = useState<ClientShareableItem[]>([])
  const [sharingLoading, setSharingLoading] = useState(false)
  const [sharingBusyId, setSharingBusyId] = useState<string | null>(null)

  const loadUsers = async () => {
    if (!client?.clientId) return
    setLoading(true)
    try {
      const res = await listClientPortalUsers(client.clientId)
      setUsers(res.data || [])
    } catch {
      toast.error("Failed to load portal users")
    } finally {
      setLoading(false)
    }
  }

  const loadShareableItems = async () => {
    setSharingLoading(true)
    try {
      const res = await listClientShareableItems(client.clientId)
      setShareableItems(res.data ?? [])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load client-sharing controls")
    } finally {
      setSharingLoading(false)
    }
  }

  useEffect(() => {
    if (open && client?.clientId) {
      void loadUsers()
      void loadShareableItems()
      setGeneratedLink(null)
    }
  }, [open, client?.clientId])

  const toggleVisibility = async (item: ClientShareableItem) => {
    setSharingBusyId(item.id)
    try {
      await setClientItemVisibility(client.clientId, item, !item.clientVisible)
      setShareableItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, clientVisible: !entry.clientVisible } : entry))
      toast.success(item.clientVisible ? "Hidden from client portal" : "Shared with client portal")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update sharing")
    } finally {
      setSharingBusyId(null)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Valid email is required")
      return
    }
    setInviteBusy(true)
    try {
      await inviteClientPortalUser(client.clientId, {
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        title: inviteTitle.trim() || undefined,
        role: inviteRole,
      })
      toast.success(`Invitation dispatched to ${inviteEmail}`)
      setInviteEmail("")
      setInviteName("")
      setInviteTitle("")
      await loadUsers()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invite")
    } finally {
      setInviteBusy(false)
    }
  }

  const handleSelectContact = (contactEmail: string) => {
    const matched = contacts.find((c) => c.email === contactEmail)
    if (matched) {
      setInviteEmail(matched.email || "")
      setInviteName(matched.name || "")
      setInviteTitle(matched.title || "")
    }
  }

  const handleResend = async (userId: string) => {
    try {
      await resendClientPortalInvite(client.clientId, userId)
      toast.success("Invitation resent successfully")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to resend invite")
    }
  }

  const handleRevoke = async (userId: string) => {
    if (!confirm("Are you sure you want to revoke portal access for this user?")) return
    try {
      await revokeClientPortalUser(client.clientId, userId)
      toast.success("Access revoked")
      await loadUsers()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke access")
    }
  }

  const handleGenerateDirectLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkEntityTitle.trim()) {
      toast.error("Please provide an item title")
      return
    }
    setLinkBusy(true)
    try {
      const res = await createDirectShareToken(client.clientId, {
        entityType: linkEntityType,
        // The current direct-review flow supports a descriptive, client-scoped
        // deliverable. Entity-specific integrations can supply a real ID later.
        entityId: client.clientId,
        entityTitle: linkEntityTitle.trim() || `${client.name} Deliverable`,
        expiresInHours: Number(linkExpiresHours) || 72,
      })
      setGeneratedLink({
        url: res.data.shareUrl,
        expiresAt: new Date(res.data.expiresAt).toLocaleDateString(),
      })
      toast.success("Direct sign-off link created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate link")
    } finally {
      setLinkBusy(false)
    }
  }

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedLink(true)
    toast.success("Link copied to clipboard")
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
              <KeyRoundIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Client Portal & Access Hub
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Manage external stakeholders, invitations, and review sign-offs for{" "}
                <span className="font-semibold text-zinc-200">{client.name}</span>.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="mt-4 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "users"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UsersIcon className="size-3.5" />
            Stakeholder Accounts ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("direct-link")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "direct-link"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Link2Icon className="size-3.5" />
            1-Click Direct Sign-off Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sharing")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
              activeTab === "sharing" ? "bg-sky-600 text-white shadow-md shadow-sky-600/30" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <UsersIcon className="size-3.5" />
            Client Sharing
          </button>
        </div>

        {activeTab === "users" ? (
          <div className="mt-4 space-y-5">
            {/* Invite Form */}
            <Card className="border-zinc-800/80 bg-zinc-900/40 p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-400">
                <PlusIcon className="size-3.5" />
                Invite New Stakeholder
              </h3>

              {contacts.length > 0 && (
                <div className="mt-2.5">
                  <Label className="text-[11px] text-zinc-400">Quick-Pick from CRM Contacts</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {contacts.filter((c) => c.email).map((c) => (
                      <button
                        key={c.contactId || c.email}
                        type="button"
                        onClick={() => handleSelectContact(c.email!)}
                        className="rounded-full border border-zinc-700/60 bg-zinc-800/50 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-sky-500 hover:text-white"
                      >
                        {c.name} ({c.email})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleInvite} className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-zinc-300">Email Address *</Label>
                  <Input
                    type="email"
                    required
                    placeholder="client@acme.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="mt-1 h-9 border-zinc-800 bg-zinc-950 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">Full Name</Label>
                  <Input
                    placeholder="Sarah Connor"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="mt-1 h-9 border-zinc-800 bg-zinc-950 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">Job Title</Label>
                  <Input
                    placeholder="VP Marketing"
                    value={inviteTitle}
                    onChange={(e) => setInviteTitle(e.target.value)}
                    className="mt-1 h-9 border-zinc-800 bg-zinc-950 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-300">Permission Role</Label>
                  <Select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="mt-1 h-9 border-zinc-800 bg-zinc-950 text-xs"
                  >
                    <option value="EXECUTIVE">Client Executive (Scope, Financials & Sign-off)</option>
                    <option value="APPROVER">Client Approver (Creative & Rundowns)</option>
                    <option value="VIEWER">Client Viewer (Read-only Spectator)</option>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={inviteBusy}
                    className="w-full gap-2 bg-sky-600 font-semibold hover:bg-sky-500 text-white"
                  >
                    {inviteBusy ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <MailIcon className="size-4" />
                    )}
                    Send Branded Portal Invitation
                  </Button>
                </div>
              </form>
            </Card>

            {/* Existing Users Table */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Active & Pending Stakeholders
              </h3>

              {loading ? (
                <div className="mt-3 flex h-24 items-center justify-center text-xs text-zinc-500">
                  <Loader2Icon className="size-4 animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">
                  No client portal accounts provisioned yet. Use the form above to send an invite.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {users.map((u) => (
                    <div
                      key={u.id || u.email}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-200 text-sm">{u.name || u.email}</span>
                          <Badge
                            variant="outline"
                            className={
                              u.status === "ACTIVE"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px]"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px]"
                            }
                          >
                            {u.status}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {u.role}
                          </Badge>
                        </div>
                        <div className="text-xs text-zinc-400 truncate">{u.email}</div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResend(u.id)}
                          className="h-8 gap-1.5 text-xs text-zinc-300 hover:text-white"
                          title="Resend Invitation Email"
                        >
                          <RefreshCwIcon className="size-3.5" />
                          Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevoke(u.id)}
                          className="h-8 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                          title="Revoke Access"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "direct-link" ? (
          /* Direct Review Link Generator */
          <div className="mt-4 space-y-5">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
              ⚡ <strong>Zero-Friction VIP Review Link</strong>: Generates an expiring cryptographically-signed link that allows busy executives to review and e-sign deliverables without logging in.
            </div>

            <form onSubmit={handleGenerateDirectLink} className="space-y-3">
              <div>
                <Label className="text-xs text-zinc-300">Target Deliverable Type</Label>
                <Select
                  value={linkEntityType}
                  onChange={(e) => setLinkEntityType(e.target.value)}
                  className="mt-1 h-9 border-zinc-800 bg-zinc-950 text-xs"
                >
                  <option value="EVENT_RUNDOWN">Live Event Master Rundown</option>
                  <option value="SPATIAL_STAGE">Spatial Stage 2D Blueprint</option>
                  <option value="CREATIVE_ASSET">Creative Asset / Video Proof</option>
                  <option value="BUDGET_APPROVAL">Scope Change Order / Budget</option>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-zinc-300">Item Title / Headline *</Label>
                <Input
                  required
                  placeholder="e.g., Cosmos Gala 2026 Run of Show (Final Cues)"
                  value={linkEntityTitle}
                  onChange={(e) => setLinkEntityTitle(e.target.value)}
                  className="mt-1 h-9 border-zinc-800 bg-zinc-950 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-300">Link Expiry Duration</Label>
                <Select
                  value={linkExpiresHours}
                  onChange={(e) => setLinkExpiresHours(e.target.value)}
                  className="mt-1 h-9 border-zinc-800 bg-zinc-950 text-xs"
                >
                  <option value="24">24 Hours (Urgent Showtime Approval)</option>
                  <option value="72">72 Hours (Standard 3-Day Window)</option>
                  <option value="168">7 Days (Weekly Review)</option>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={linkBusy}
                className="w-full gap-2 bg-amber-600 font-semibold hover:bg-amber-500 text-zinc-950"
              >
                {linkBusy ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <Link2Icon className="size-4" />
                )}
                Generate 1-Click VIP Review Link
              </Button>
            </form>

            {generatedLink && (
              <Card className="border-amber-500/40 bg-zinc-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">Shareable Sign-Off Link</span>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-300 text-[10px]">
                    Expires: {generatedLink.expiresAt}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={generatedLink.url}
                    className="h-9 border-zinc-800 bg-zinc-950 text-xs font-mono text-zinc-300 select-all"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(generatedLink.url)}
                    className="shrink-0 gap-1.5 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                  >
                    {copiedLink ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
                    {copiedLink ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(generatedLink.url, "_blank")}
                    className="shrink-0 border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
                    title="Open in new tab"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </Button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-sky-200">
              Items are private by default. Turn sharing on only for material the client should see.
            </div>
            {sharingLoading ? (
              <div className="flex h-24 items-center justify-center text-xs text-zinc-500"><Loader2Icon className="size-4 animate-spin" /></div>
            ) : shareableItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-500">No client-linked projects, assets, approvals, events, or cues yet.</div>
            ) : (
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {shareableItems.map((item) => (
                  <div key={`${item.entityType}-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-100">{item.name || item.title}</div>
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{item.entityType.replace("_", " ")}{item.subtitle ? ` · ${item.subtitle}` : ""}</div>
                    </div>
                    <Button size="sm" variant={item.clientVisible ? "default" : "outline"} disabled={sharingBusyId === item.id} onClick={() => void toggleVisibility(item)} className={item.clientVisible ? "bg-emerald-700 hover:bg-emerald-600" : "border-zinc-700"}>
                      {item.clientVisible ? "Shared" : "Private"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
