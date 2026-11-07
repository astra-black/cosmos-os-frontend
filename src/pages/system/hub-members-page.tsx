/**
 * Hub · Members & Roles — Figma 00.04 · 03–04 (prototype flow 06)
 * Evidence: EXPERIENCE_ARCHITECTURE flow 06; build_v6_admin people/roles;
 * IDENTITY_ACCESS §5 / §8. MCP View-seat rate-limited — child node IDs not captured.
 *
 * Organization membership administration (permissionRole + invitations).
 * Distinct from Agency OS `/teams` (workspace team-name assignment).
 * Custom role templates / capability matrices are Designed but not modeled — shown unavailable.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  Link2Icon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { listTeamMembers, updateTeamMember } from "@/lib/api/agency"
import { createInvitation, listInvitations } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform, normalizeRole } from "@/lib/rbac"
import type { AgencyInvitation, TeamMember } from "@/types/agency"
import { cn } from "@/lib/utils"

type PermissionRole = "AGENCY_ADMIN" | "PROJECT_MANAGER" | "TEAM_MEMBER"
type JobFunction = "ADMIN" | "PM" | "PRODUCER" | "CREATIVE" | "OPS"
type TabKey = "members" | "invitations" | "roles"

const PERMISSION_ROLES: {
  id: PermissionRole
  label: string
  summary: string
  capabilities: string[]
}[] = [
  {
    id: "AGENCY_ADMIN",
    label: "Agency Admin",
    summary: "Full organization administration for this agency.",
    capabilities: [
      "Manage members and invitations",
      "Access all Agency OS routes",
      "Manage billing when entitled",
      "Configure organization settings",
    ],
  },
  {
    id: "PROJECT_MANAGER",
    label: "Project Manager",
    summary: "Delivery lead with CRM, finance, and team management.",
    capabilities: [
      "Invite and update team members",
      "CRM and project write access",
      "Approvals and schedule changes",
      "No billing administration",
    ],
  },
  {
    id: "TEAM_MEMBER",
    label: "Team Member",
    summary: "Scoped working access based on job function.",
    capabilities: [
      "Work inside assigned Agency OS areas",
      "Cannot invite or change org roles",
      "Cannot manage billing",
      "Job function further narrows routes",
    ],
  },
]

const JOB_FUNCTIONS: { id: JobFunction; label: string }[] = [
  { id: "ADMIN", label: "Admin" },
  { id: "PM", label: "Project Manager" },
  { id: "PRODUCER", label: "Producer" },
  { id: "CREATIVE", label: "Creative" },
  { id: "OPS", label: "Operations" },
]

function permissionLabel(value?: string | null) {
  const match = PERMISSION_ROLES.find((role) => role.id === value)
  if (match) return match.label
  if (!value) return "Team Member"
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function jobLabel(value?: string | null) {
  const match = JOB_FUNCTIONS.find((job) => job.id === value)
  if (match) return match.label
  if (!value) return "—"
  return value
}

function statusTone(status: string) {
  const s = status.toLowerCase()
  if (s === "active" || s === "accepted") return "success"
  if (s === "pending") return "info"
  if (s === "inactive" || s === "expired" || s === "revoked") return "neutral"
  return "neutral"
}

function dayLabel(date?: string | null) {
  if (!date) return "—"
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function HubMembersPage() {
  const { user } = useAuth()
  const role = normalizeRole(user?.role)
  const isAgencyAdmin = role === "admin"
  const canManage =
    isAgencyAdmin || canPerform(user?.role, "manage_team")
  const assignablePermissionRoles = isAgencyAdmin
    ? PERMISSION_ROLES
    : PERMISSION_ROLES.filter((item) => item.id !== "AGENCY_ADMIN")

  const [tab, setTab] = useState<TabKey>("members")
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<AgencyInvitation[]>([])
  const [membersStatus, setMembersStatus] = useState<"loading" | "ok" | "error">("loading")
  const [invitesStatus, setInvitesStatus] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [membersError, setMembersError] = useState<string | null>(null)
  const [invitesError, setInvitesError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [invitePermission, setInvitePermission] = useState<PermissionRole>("TEAM_MEMBER")
  const [inviteJob, setInviteJob] = useState<JobFunction>("OPS")
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)

  const [draftPermission, setDraftPermission] = useState<PermissionRole>("TEAM_MEMBER")
  const [draftJob, setDraftJob] = useState<JobFunction>("OPS")
  const [draftTeam, setDraftTeam] = useState("")
  const [draftStatus, setDraftStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const [savingMember, setSavingMember] = useState(false)

  const orgName = user?.agencyName || "Your organization"

  const loadMembers = useCallback(async () => {
    setMembersStatus("loading")
    setMembersError(null)
    try {
      const res = await listTeamMembers({ includeInactive: true })
      setMembers(res.data ?? [])
      setMembersStatus("ok")
    } catch (err) {
      setMembers([])
      setMembersStatus("error")
      setMembersError(err instanceof ApiError ? err.message : "Members could not be loaded.")
    }
  }, [])

  const loadInvitations = useCallback(async () => {
    if (!canManage) {
      setInvitesStatus("idle")
      setInvitations([])
      return
    }
    setInvitesStatus("loading")
    setInvitesError(null)
    try {
      const res = await listInvitations()
      setInvitations((res.data ?? []) as AgencyInvitation[])
      setInvitesStatus("ok")
    } catch (err) {
      setInvitations([])
      setInvitesStatus("error")
      setInvitesError(
        err instanceof ApiError ? err.message : "Invitations could not be loaded.",
      )
    }
  }, [canManage])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  useEffect(() => {
    if (tab === "invitations") void loadInvitations()
  }, [tab, loadInvitations])

  const selected = useMemo(
    () => members.find((member) => member.memberId === selectedId) || null,
    [members, selectedId],
  )

  useEffect(() => {
    if (!selected) return
    const perm = (selected.permissionRole || "TEAM_MEMBER").toUpperCase() as PermissionRole
    const job = (selected.jobFunction || selected.role || "OPS").toUpperCase() as JobFunction
    const allowedPerm = assignablePermissionRoles.some((item) => item.id === perm)
      ? perm
      : assignablePermissionRoles[0]?.id || "TEAM_MEMBER"
    setDraftPermission(
      PERMISSION_ROLES.some((item) => item.id === perm) && (isAgencyAdmin || perm !== "AGENCY_ADMIN")
        ? perm
        : allowedPerm,
    )
    setDraftJob(JOB_FUNCTIONS.some((item) => item.id === job) ? job : "OPS")
    setDraftTeam(selected.team || "")
    setDraftStatus(selected.status.toLowerCase() === "inactive" ? "INACTIVE" : "ACTIVE")
  }, [selected, assignablePermissionRoles, isAgencyAdmin])

  const selectedIsAgencyAdmin =
    (selected?.permissionRole || "").toUpperCase() === "AGENCY_ADMIN"
  const pmLockedOnAdmin = !isAgencyAdmin && selectedIsAgencyAdmin

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter((member) => {
      const status = member.status.toLowerCase()
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && status === "active") ||
        (statusFilter === "inactive" && status !== "active")
      const matchesSearch =
        !query ||
        [member.name, member.email, member.title, member.team, member.permissionRole, member.jobFunction]
          .some((value) => value?.toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    })
  }, [members, search, statusFilter])

  const counts = useMemo(() => {
    const active = members.filter((m) => m.status.toLowerCase() === "active").length
    const inactive = members.length - active
    const pending = invitations.filter((i) => i.status.toUpperCase() === "PENDING").length
    return { active, inactive, pending, total: members.length }
  }, [members, invitations])

  if (!canManage) {
    return (
      <div className="cosmos-home hub-admin">
        <div className="hub-admin-restricted" role="status">
          <ShieldIcon />
          <div>
            <strong>Members & Roles is restricted</strong>
            <p>
              Organization membership administration requires an Agency Admin or Project Manager
              seat with manage-team permission.
            </p>
            <Button size="sm" variant="outline" render={<Link to="/hub" />}>
              Back to Hub
            </Button>
          </div>
        </div>
      </div>
    )
  }

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault()
    setInviting(true)
    try {
      const res = await createInvitation({
        email: inviteEmail.trim() || undefined,
        permissionRole: invitePermission,
        jobFunction: inviteJob,
      })
      const token = res.data?.token
      if (!token) {
        toast.error("Invitation was not created.")
        return
      }
      setGeneratedLink(`${window.location.origin}/invite/${token}`)
      toast.success("Invitation created")
      if (tab === "invitations" || invitesStatus === "ok") await loadInvitations()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Invitation failed")
    } finally {
      setInviting(false)
    }
  }

  async function saveSelectedMember(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) return
    if (!isAgencyAdmin && draftPermission === "AGENCY_ADMIN") {
      toast.error("Only an Agency Admin may grant Agency Admin privileges")
      return
    }
    setSavingMember(true)
    try {
      const payload: Partial<TeamMember> & { status?: string } = {
        jobFunction: draftJob,
        team: draftTeam.trim() || undefined,
      }
      // PMs must not send role/status changes for existing Agency Admins.
      if (!pmLockedOnAdmin) {
        payload.permissionRole = draftPermission
        payload.status = draftStatus
      }
      const res = await updateTeamMember(selected.memberId, payload)
      const updated = res.data
      if (!updated?.memberId) {
        toast.error("Save was not confirmed by the server.")
        return
      }
      setMembers((prev) =>
        prev.map((member) => (member.memberId === updated.memberId ? { ...member, ...updated } : member)),
      )
      toast.success("Member updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update member")
    } finally {
      setSavingMember(false)
    }
  }

  return (
    <div
      className="cosmos-home hub-admin"
      data-figma="00.04 · 03–04 · Members & Roles"
      data-node-id-status="unconfirmed-mcp-rate-limited"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub">
            <ArrowLeftIcon /> Hub
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Administration
          </div>
          <h1>Members & Roles</h1>
          <p>
            Organization membership and access levels for this agency. Agency OS team names are
            edited here when needed; the workspace People page remains for day-to-day team grouping.
          </p>
        </div>
        <div className="hub-admin-actions">
          <Button size="sm" variant="outline" onClick={() => void loadMembers()}>
            <RefreshCwIcon /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setInviteEmail("")
              setInvitePermission("TEAM_MEMBER")
              setInviteJob("OPS")
              setGeneratedLink(null)
              setCopied(false)
              setInviteOpen(true)
            }}
          >
            <UserPlusIcon /> Invite Members
          </Button>
        </div>
      </header>

      <nav className="hub-admin-tabs" aria-label="Members sections">
        {(
          [
            ["members", `Members · ${counts.total}`],
            ["invitations", `Invitations${invitesStatus === "ok" ? ` · ${counts.pending}` : ""}`],
            ["roles", "Roles"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={cn(tab === key && "is-active")}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "members" ? (
        <section className="hub-members-layout">
          <div className="hub-members-main">
            <div className="hub-members-toolbar">
              <div className="hub-members-search">
                <SearchIcon />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search people"
                  aria-label="Search people"
                />
              </div>
              <div className="hub-members-filters">
                {(
                  [
                    ["all", `All ${counts.total}`],
                    ["active", `Active ${counts.active}`],
                    ["inactive", `Inactive ${counts.inactive}`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(statusFilter === key && "is-active")}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {membersStatus === "loading" ? (
              <div className="hub-members-loading">
                {[0, 1, 2, 3].map((n) => (
                  <Skeleton key={n} />
                ))}
              </div>
            ) : membersStatus === "error" ? (
              <div className="portal-section-error" role="alert">
                <div>
                  <strong>Members unavailable</strong>
                  <small>{membersError}</small>
                </div>
                <Button size="sm" variant="outline" onClick={() => void loadMembers()}>
                  <RefreshCwIcon /> Retry
                </Button>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="hub-admin-empty">
                <UsersIcon />
                <strong>No members match</strong>
                <small>Invite someone to this organization or clear filters.</small>
              </div>
            ) : (
              <div className="hub-members-table" role="table">
                <div className="hub-members-row is-head" role="row">
                  <span>Member</span>
                  <span>Access</span>
                  <span>Function</span>
                  <span>Team</span>
                  <span>Status</span>
                </div>
                {filteredMembers.map((member) => (
                  <button
                    key={member.memberId}
                    type="button"
                    role="row"
                    className={cn(
                      "hub-members-row",
                      selectedId === member.memberId && "is-selected",
                    )}
                    onClick={() => setSelectedId(member.memberId)}
                  >
                    <span className="hub-members-who">
                      <span className="hub-members-avatar">{initials(member.name)}</span>
                      <span>
                        <strong>{member.name}</strong>
                        <small>{member.email || "Email unavailable"}</small>
                      </span>
                    </span>
                    <span>{permissionLabel(member.permissionRole)}</span>
                    <span>{jobLabel(member.jobFunction || member.role)}</span>
                    <span>{member.team || "—"}</span>
                    <span className={cn("hub-status", `is-${statusTone(member.status)}`)}>
                      {member.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="hub-members-drawer">
            {selected ? (
              <form onSubmit={(event) => void saveSelectedMember(event)}>
                <div className="hub-members-drawer-head">
                  <span className="hub-members-avatar is-lg">{initials(selected.name)}</span>
                  <div>
                    <strong>{selected.name}</strong>
                    <small>{selected.email || "Email unavailable"}</small>
                  </div>
                  <span className={cn("hub-status", `is-${statusTone(selected.status)}`)}>
                    {selected.status}
                  </span>
                </div>

                <div className="hub-members-field">
                  <Label htmlFor="member-permission">Organization access</Label>
                  <select
                    id="member-permission"
                    value={
                      pmLockedOnAdmin
                        ? "AGENCY_ADMIN"
                        : draftPermission
                    }
                    disabled={pmLockedOnAdmin}
                    onChange={(event) =>
                      setDraftPermission(event.target.value as PermissionRole)
                    }
                  >
                    {pmLockedOnAdmin ? (
                      <option value="AGENCY_ADMIN">Agency Admin</option>
                    ) : (
                      assignablePermissionRoles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))
                    )}
                  </select>
                  {pmLockedOnAdmin ? (
                    <small>Only an Agency Admin may change this member&apos;s access level.</small>
                  ) : null}
                </div>

                <div className="hub-members-field">
                  <Label htmlFor="member-job">Job function</Label>
                  <select
                    id="member-job"
                    value={draftJob}
                    onChange={(event) => setDraftJob(event.target.value as JobFunction)}
                  >
                    {JOB_FUNCTIONS.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.label}
                      </option>
                    ))}
                  </select>
                  <small>
                    Job function is the Agency OS working role, not a custom capability template.
                  </small>
                </div>

                <div className="hub-members-field">
                  <Label htmlFor="member-team">Team name</Label>
                  <Input
                    id="member-team"
                    value={draftTeam}
                    onChange={(event) => setDraftTeam(event.target.value)}
                    placeholder="e.g. Production"
                    maxLength={80}
                  />
                  <small>
                    Free-text team label on the member record. Divisions and inherited permissions
                    are not modeled yet.
                  </small>
                </div>

                <div className="hub-members-field">
                  <Label htmlFor="member-status">Membership status</Label>
                  <select
                    id="member-status"
                    value={draftStatus}
                    disabled={pmLockedOnAdmin}
                    onChange={(event) =>
                      setDraftStatus(event.target.value as "ACTIVE" | "INACTIVE")
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  {pmLockedOnAdmin ? (
                    <small>Only an Agency Admin may change this member&apos;s status.</small>
                  ) : null}
                </div>

                <div className="hub-members-drawer-note">
                  <ShieldIcon />
                  <span>
                    {isAgencyAdmin
                      ? "Edition seat matrices, guest access, and custom role templates are not available on this account model."
                      : "Project Managers can manage members and invites, but cannot grant Agency Admin or change an Agency Admin’s access or status."}
                  </span>
                </div>

                <div className="hub-members-drawer-actions">
                  <Button type="submit" size="sm" disabled={savingMember}>
                    {savingMember ? <Loader2Icon className="animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              </form>
            ) : (
              <div className="hub-admin-empty">
                <UsersIcon />
                <strong>Select a member</strong>
                <small>Choose someone to review access, function, team, or status.</small>
              </div>
            )}
          </aside>
        </section>
      ) : null}

      {tab === "invitations" ? (
        <section className="hub-invites-panel">
          {invitesStatus === "loading" || invitesStatus === "idle" ? (
            <div className="hub-members-loading">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} />
              ))}
            </div>
          ) : invitesStatus === "error" ? (
            <div className="portal-section-error" role="alert">
              <div>
                <strong>Invitations unavailable</strong>
                <small>{invitesError}</small>
              </div>
              <Button size="sm" variant="outline" onClick={() => void loadInvitations()}>
                <RefreshCwIcon /> Retry
              </Button>
            </div>
          ) : invitations.length === 0 ? (
            <div className="hub-admin-empty">
              <Link2Icon />
              <strong>No invitations yet</strong>
              <small>Create an invite to add someone to this organization.</small>
            </div>
          ) : (
            <div className="hub-members-table">
              <div className="hub-members-row is-head">
                <span>Invite</span>
                <span>Access</span>
                <span>Function</span>
                <span>Invited by</span>
                <span>Status</span>
                <span>Expires</span>
              </div>
              {invitations.map((invite) => (
                <div key={invite.id} className="hub-members-row is-static">
                  <span>
                    <strong>{invite.email || "Open link invite"}</strong>
                    <small>Created {dayLabel(invite.createdAt)}</small>
                  </span>
                  <span>{permissionLabel(invite.permissionRole)}</span>
                  <span>{jobLabel(invite.jobFunction)}</span>
                  <span>{invite.invitedBy || "—"}</span>
                  <span className={cn("hub-status", `is-${statusTone(invite.status)}`)}>
                    {invite.status.toLowerCase()}
                  </span>
                  <span>{dayLabel(invite.expiresAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "roles" ? (
        <section className="hub-roles-panel">
          <div className="hub-roles-list">
            {PERMISSION_ROLES.map((roleDef) => {
              const holders = members.filter(
                (member) =>
                  (member.permissionRole || "TEAM_MEMBER").toUpperCase() === roleDef.id &&
                  member.status.toLowerCase() === "active",
              )
              return (
                <article key={roleDef.id} className="hub-role-card">
                  <header>
                    <strong>{roleDef.label}</strong>
                    <small>System role · {holders.length} active</small>
                  </header>
                  <p>{roleDef.summary}</p>
                  <ul>
                    {roleDef.capabilities.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              )
            })}
          </div>
          <div className="hub-admin-unavailable">
            <ShieldIcon />
            <div>
              <strong>Custom roles unavailable</strong>
              <p>
                Figma shows editable role templates and a capability matrix. This agency only has
                the three PermissionRole values above. Creating custom roles or assigning
                per-capability grants is not supported yet — no fabricated templates are shown.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Members</DialogTitle>
            <DialogDescription>
              Create an organization invitation. The member joins this agency after accepting —
              nothing is saved until the API confirms the invite.
            </DialogDescription>
          </DialogHeader>
          {!generatedLink ? (
            <form onSubmit={(event) => void handleInvite(event)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hub-invite-email">Email (optional)</Label>
                <Input
                  id="hub-invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="hub-invite-perm">Access</Label>
                  <select
                    id="hub-invite-perm"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={invitePermission}
                    onChange={(event) =>
                      setInvitePermission(event.target.value as PermissionRole)
                    }
                  >
                    {assignablePermissionRoles.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hub-invite-job">Function</Label>
                  <select
                    id="hub-invite-job"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={inviteJob}
                    onChange={(event) => setInviteJob(event.target.value as JobFunction)}
                  >
                    {JOB_FUNCTIONS.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviting}>
                  {inviting ? <Loader2Icon className="animate-spin" /> : <Link2Icon />}
                  Create invite
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Invitation confirmed. Share this link — it expires in 7 days.
              </p>
              <div className="flex gap-2">
                <Input readOnly value={generatedLink} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generatedLink)
                      setCopied(true)
                      toast.success("Copied")
                      setTimeout(() => setCopied(false), 2000)
                    } catch {
                      toast.error("Copy failed")
                    }
                  }}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setGeneratedLink(null)}>
                  Create another
                </Button>
                <Button type="button" onClick={() => setInviteOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Guard for accidental import without auth shell. */
export function HubMembersRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <HubMembersPage />
}
