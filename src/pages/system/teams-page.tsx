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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 65%, 45%)`
}

function getRoleBadgeClass(role: string) {
  switch (role) {
    case "admin":
      return "bg-primary/15 text-primary"
    case "pm":
      return "bg-blue/15 text-blue"
    case "producer":
      return "bg-[#7a5cc2]/15 text-[#7a5cc2]"
    case "ops":
      return "bg-warning/15 text-warning"
    case "creative":
      return "bg-pink-500/15 text-pink-500"
    case "client":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-surface-alt text-muted-foreground"
  }
}

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
            className="gap-2 shrink-0 bg-[#270045] hover:bg-[#3b0066] text-white"
          >
            <UserPlusIcon className="size-4" />
            Invite Member
          </Button>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
          <span className="font-sora font-bold text-2xl text-foreground">{members.length}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Admins</span>
          <span className="font-sora font-bold text-2xl text-foreground">
            {members.filter((m) => m.role === "admin").length}
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">PMs</span>
          <span className="font-sora font-bold text-2xl text-foreground">
            {members.filter((m) => m.role === "pm").length}
          </span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Active</span>
          <span className="font-sora font-bold text-2xl text-success">
            {members.filter((m) => m.status === "active" && m.role !== "client").length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> {filtered.length === 1 ? "member" : "members"}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              teamFilter === "all"
                ? "bg-[#270045] text-white border border-[#270045]"
                : "border border-border bg-transparent text-foreground hover:bg-surface-alt"
            )}
            onClick={() => setTeamFilter("all")}
          >
            All teams
          </button>
          {teams.map((t) => (
            <button
              key={t}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                teamFilter === t
                  ? "bg-[#270045] text-white border border-[#270045]"
                  : "border border-border bg-transparent text-foreground hover:bg-surface-alt"
              )}
              onClick={() => setTeamFilter(t!)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
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
              <div
                key={member.memberId}
                className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]"
              >
                <div
                  className="size-11 rounded-full flex items-center justify-center text-white font-sora font-semibold text-sm shrink-0 shadow-xs"
                  style={{ backgroundColor: getAvatarColor(member.name) }}
                >
                  {initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-sora font-semibold text-sm text-foreground truncate">
                      {member.name}
                    </span>
                    {member.status === "invited" ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/15 text-warning shrink-0">
                        Invited
                      </span>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground truncate text-xs mt-0.5">
                    {member.title ? `${member.title} · ` : ""}{member.team || "No team"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize inline-flex items-center gap-1",
                        getRoleBadgeClass(member.role)
                      )}
                    >
                      <ShieldIcon className="size-2.5" />
                      {member.role}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate font-mono">
                      {member.email}
                    </span>
                  </div>
                </div>

                {canManageTeam ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0 h-8 px-2 hover:bg-surface-alt"
                    onClick={() => cycleRole(member)}
                    title="Cycle role"
                  >
                    Cycle
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite Member Right-side Drawer */}
      <Sheet open={inviteOpen} onOpenChange={setInviteOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card border-l border-border shadow-2xl"
        >
          <SheetHeader className="p-6 border-b border-border bg-card pr-12 shrink-0">
            <SheetTitle className="flex items-center gap-2 font-sora text-xl font-bold text-foreground">
              <UserPlusIcon className="size-5 text-primary" />
              Invite Team Member
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Generate a shareable invite link for a new colleague to join this agency.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
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
                </div>
              </form>
            ) : (
              <div className="space-y-4">
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

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
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
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
