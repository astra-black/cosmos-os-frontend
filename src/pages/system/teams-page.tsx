import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckIcon, CopyIcon, Link2Icon, Loader2Icon, ShieldIcon, UserPlusIcon, UsersIcon } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"

const ROLES = ["admin", "pm", "producer", "ops", "creative", "client"] as const

export function TeamsPage() {
  const { user } = useAuth()
  const canManageTeam = canPerform(user?.role, "manage_team")
  const [members, setMembers] = useState<TeamMember[]>([])
  const [teamFilter, setTeamFilter] = useState("all")
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
    if (teamFilter === "all") return members
    return members.filter((m) => m.team === teamFilter)
  }, [members, teamFilter])

  async function cycleRole(member: TeamMember) {
    if (!canManageTeam) return
    const idx = ROLES.indexOf(member.role as (typeof ROLES)[number])
    const next = ROLES[(idx + 1) % ROLES.length]
    try {
      await updateTeamMember(member.memberId, { role: next })
      await reload()
      toast.success(`${member.name} → ${next}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    }
  }

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
          title="Teams & roles"
          description="Org roster — teams, roles, and access for the agency OS."
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
            Invite Member
          </Button>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      <div className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-sm">
        <span>
          <span className="text-muted-foreground">People </span>
          <span className="font-semibold tabular-nums">{members.length}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Active </span>
          <span className="font-semibold tabular-nums">
            {members.filter((m) => m.status === "active").length}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">Teams </span>
          <span className="font-semibold tabular-nums">{teams.length}</span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={teamFilter === "all" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTeamFilter("all")}
        >
          All teams
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

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<UsersIcon className="size-8 opacity-40" />} title="No members" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member) => {
            const initials = member.name
              .split(/\s+/)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
            return (
              <Card key={member.memberId} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{member.name}</div>
                    <div className="text-muted-foreground truncate text-xs">{member.email}</div>
                    <div className="text-muted-foreground mt-0.5 text-xs">{member.title}</div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "capitalize",
                      member.status === "invited" && "opacity-70",
                    )}
                  >
                    {member.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{member.team || "—"}</Badge>
                  <Badge className="gap-1 capitalize">
                    <ShieldIcon className="size-3" />
                    {member.role}
                  </Badge>
                </div>
                {canManageTeam ? (
                  <Button size="sm" variant="outline" onClick={() => cycleRole(member)}>
                    Cycle role
                  </Button>
                ) : null}
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
              Invite Team Member
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
                    <option value="AGENCY_ADMIN">Agency Admin</option>
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
    </div>
  )
}
