import { useCallback, useEffect, useMemo, useState } from "react"
import { ShieldIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listTeamMembers, updateTeamMember } from "@/lib/api/agency"
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Teams & roles"
        description="Org roster — teams, roles, and access for the agency OS."
      />

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
                {canManageTeam ? <Button size="sm" variant="outline" onClick={() => cycleRole(member)}>
                  Cycle role
                </Button> : null}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
