import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckIcon, CopyIcon, Link2Icon, Loader2Icon, SearchIcon, UserPlusIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { listTeamMembers, updateTeamMember } from "@/lib/api/agency"
import { createInvitation } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"
import type { TeamMember } from "@/types/agency"
import { useAuth } from "@/lib/auth"
import { canPerform, normalizeRole } from "@/lib/rbac"

export function TeamsPage() {
  const { user } = useAuth()
  const isAgencyAdmin = normalizeRole(user?.role) === "admin"
  const canManageTeam = isAgencyAdmin || canPerform(user?.role, "manage_team")
  const [members, setMembers] = useState<TeamMember[]>([])
  const [teamFilter, setTeamFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [activeView, setActiveView] = useState<"people" | "teams">("people")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [permissionRole, setPermissionRole] = useState<"AGENCY_ADMIN" | "PROJECT_MANAGER" | "TEAM_MEMBER">("TEAM_MEMBER")
  const [jobFunction, setJobFunction] = useState<"ADMIN" | "PM" | "PRODUCER" | "CREATIVE" | "OPS">("OPS")
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingTeamMember, setEditingTeamMember] = useState<TeamMember | null>(null)
  const [teamDraft, setTeamDraft] = useState("")
  const [savingTeam, setSavingTeam] = useState(false)

  const reload = useCallback(async () => {
    const res = await listTeamMembers()
    setMembers(res.data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load team")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reload])

  const teams = useMemo(() => [...new Set(members.map((m) => m.team).filter(Boolean))], [members])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter((member) => {
      const matchesTeam = teamFilter === "all" || member.team === teamFilter
      const matchesSearch = !query || [member.name, member.title, member.team, member.role, member.email]
        .some((value) => value?.toLowerCase().includes(query))
      return matchesTeam && matchesSearch
    })
  }, [members, teamFilter, search])

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await createInvitation({
        email: inviteEmail.trim() || undefined,
        permissionRole,
        jobFunction,
      })

      const token = res.data?.token
      if (token) {
        const link = `${window.location.origin}/invite/${token}`
        setGeneratedLink(link)
        toast.success("Invite link generated!")
      } else {
        toast.error("Failed to retrieve invite token.")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate invite.")
    } finally {
      setInviting(false)
    }
  }

  const copyToClipboard = async () => {
    if (!generatedLink) return
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      toast.success("Invite link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link.")
    }
  }

  async function saveTeamAssignment(event: React.FormEvent) {
    event.preventDefault()
    if (!editingTeamMember || !canManageTeam) return
    setSavingTeam(true)
    try {
      await updateTeamMember(editingTeamMember.memberId, { team: teamDraft.trim() })
      await reload()
      setEditingTeamMember(null)
      toast.success("Team assignment updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update team assignment")
    } finally {
      setSavingTeam(false)
    }
  }

  const resetInviteModal = () => {
    setInviteEmail("")
    setPermissionRole("TEAM_MEMBER")
    setJobFunction("OPS")
    setGeneratedLink(null)
    setCopied(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title={activeView === "people" ? "People" : "Teams & Divisions"}
          description={activeView === "people" ? "Agency OS members in this workspace." : "Organize members into teams within this workspace."}
        />
        {canManageTeam && (
          <Button
            onClick={() => {
              resetInviteModal()
              setInviteOpen(true)
            }}
            className="gap-2 shrink-0"
          >
            <UserPlusIcon className="size-4" />
            Invite Members
          </Button>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      <div className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-sm">
          <span>
            <span className="text-muted-foreground">Active members </span>
          <span className="font-semibold tabular-nums">{members.length}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Teams </span>
          <span className="font-semibold tabular-nums">{teams.length}</span>
        </span>
      </div>

      <div className="flex gap-2 border-b pb-3">
        <Button size="sm" variant={activeView === "people" ? "default" : "ghost"} onClick={() => setActiveView("people")}>People</Button>
        <Button size="sm" variant={activeView === "teams" ? "default" : "ghost"} onClick={() => setActiveView("teams")}>Teams &amp; Divisions</Button>
      </div>

      {activeView === "people" ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input aria-label="Search people, titles and teams" placeholder="Search people, titles and teams" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={teamFilter === "all" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTeamFilter("all")}
        >
          Team · All
        </Button>
        {teams.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={teamFilter === t ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setTeamFilter(t!)}
          >
            {t}
          </Button>
        ))}
        </div>
      </div> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : activeView === "teams" ? (
        teams.length === 0 ? (
          <EmptyState icon={<UsersIcon className="size-8 opacity-40" />} title="No teams assigned" description={canManageTeam ? "Assign a team to a member from the People view to create the first team group." : "No active members have a team assignment yet."} />
        ) : (
          <div className="cosmos-people-grid">
            {teams.map((team) => {
              const teamMembers = members.filter((member) => member.team === team)
              return <Card key={team} className="cosmos-person-card p-5">
                <div className="flex items-start justify-between gap-3"><div><span className="cosmos-account-preview-label">MEMBER TEAM</span><h2 className="mt-2 text-base font-semibold">{team}</h2></div><Badge variant="secondary">{teamMembers.length} {teamMembers.length === 1 ? "member" : "members"}</Badge></div>
                <div className="mt-4 flex flex-col gap-3">{teamMembers.map((member) => <div key={member.memberId} className="flex items-center gap-3 border-t pt-3"><Avatar><AvatarFallback>{member.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><strong className="block truncate text-sm">{member.name}</strong><span className="text-muted-foreground block truncate text-xs">{member.title || member.role}</span></div></div>)}</div>
              </Card>
            })}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState icon={<UsersIcon className="size-8 opacity-40" />} title="No members" />
      ) : (
        <div className="cosmos-people-grid">
          {filtered.map((member) => {
            const initials = member.name
              .split(/\s+/)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            return (
              <Card key={member.memberId} className="cosmos-person-card">
                <div className="cosmos-person-card-cover" />
                <div className="cosmos-person-card-content">
                  <div className="cosmos-person-card-top">
                    <Avatar className="cosmos-person-avatar"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                    <Badge variant="secondary" className="capitalize">{member.status}</Badge>
                  </div>
                  <div className="cosmos-person-card-identity">
                    <strong>{member.name}</strong>
                    <span>{member.title || member.role || "Team member"}</span>
                    <span>{member.team || "No team assigned"}</span>
                  </div>
                  {member.email ? <div className="cosmos-person-card-contact">{member.email}</div> : <div className="cosmos-person-card-contact">Contact details unavailable</div>}
                  <div className="cosmos-person-card-footer"><span>Agency OS · Function</span><Badge variant="outline" className="capitalize">{member.role || "Member"}</Badge></div>
                  {canManageTeam ? <Button variant="ghost" size="sm" className="self-start" onClick={() => { setEditingTeamMember(member); setTeamDraft(member.team || "") }}>{member.team ? "Change team" : "Assign team"}</Button> : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlusIcon className="size-5 text-primary" />
              Invite Members
            </DialogTitle>
            <DialogDescription>
              Generate a shareable invite link for a new colleague to join this agency.
            </DialogDescription>
          </DialogHeader>

          {!generatedLink ? (
            <form onSubmit={handleGenerateInvite} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="inviteEmail">Recipient Email (Optional)</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  If left blank, anyone with the link can sign up with their email.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="permissionRole">Access Level</Label>
                  <select
                    id="permissionRole"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={permissionRole}
                    onChange={(e) => setPermissionRole(e.target.value as any)}
                  >
                    <option value="TEAM_MEMBER">Team Member</option>
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    {isAgencyAdmin ? (
                      <option value="AGENCY_ADMIN">Agency Admin</option>
                    ) : null}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="jobFunction">Job Function</Label>
                  <select
                    id="jobFunction"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={jobFunction}
                    onChange={(e) => setJobFunction(e.target.value as any)}
                  >
                    <option value="OPS">Operations</option>
                    <option value="CREATIVE">Creative</option>
                    <option value="PRODUCER">Producer</option>
                    <option value="PM">Project Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviting} className="gap-2">
                  {inviting ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Link2Icon className="size-4" />
                      Generate Invite Link
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm text-foreground">
                <p className="font-medium text-primary mb-1">Invite link ready!</p>
                <p className="text-xs text-muted-foreground">
                  Send this link to your teammate. It is valid for 7 days.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Shareable URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={generatedLink} className="font-mono text-xs select-all bg-muted/40" />
                  <Button type="button" variant="secondary" onClick={copyToClipboard} className="shrink-0 gap-1.5">
                    {copied ? <CheckIcon className="size-4 text-emerald-500" /> : <CopyIcon className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetInviteModal()
                  }}
                >
                  Create Another
                </Button>
                <Button type="button" onClick={() => setInviteOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingTeamMember)} onOpenChange={(open) => { if (!open && !savingTeam) setEditingTeamMember(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTeamMember?.team ? "Change team" : "Assign a team"}</DialogTitle>
            <DialogDescription>Team names are saved on the member profile. The current workspace does not have separate division records or inherited team permissions.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void saveTeamAssignment(event)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label htmlFor="member-team">Team name</Label><Input id="member-team" value={teamDraft} onChange={(event) => setTeamDraft(event.target.value)} placeholder="e.g. Production" maxLength={80} /></div>
            <DialogFooter><Button type="button" variant="outline" disabled={savingTeam} onClick={() => setEditingTeamMember(null)}>Cancel</Button><Button type="submit" disabled={savingTeam}>{savingTeam ? <Loader2Icon className="size-4 animate-spin" /> : null}Save team</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
