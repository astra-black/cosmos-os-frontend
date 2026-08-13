import { useMemo, useState } from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CrewMember, Department } from "@/types/agency"

const STATUS_LANES = [
  {
    id: "assigned",
    label: "Assigned",
    hint: "Invited / not confirmed",
    next: "confirmed" as const,
    nextLabel: "Confirm",
    prev: null,
    prevLabel: null,
    match: (s: string) => s === "assigned",
  },
  {
    id: "confirmed",
    label: "Confirmed",
    hint: "Booked, not on site",
    next: "on_site" as const,
    nextLabel: "Check in",
    prev: "assigned" as const,
    prevLabel: "Back",
    match: (s: string) => s === "confirmed",
  },
  {
    id: "on_site",
    label: "On site",
    hint: "Checked in",
    next: "complete" as const,
    nextLabel: "Complete",
    prev: "confirmed" as const,
    prevLabel: "Undo check-in",
    match: (s: string) => s === "on_site",
  },
  {
    id: "complete",
    label: "Complete",
    hint: "Shift done",
    next: null,
    nextLabel: null,
    prev: "on_site" as const,
    prevLabel: "Reopen",
    match: (s: string) => s === "complete",
  },
] as const

function CrewCard({
  member,
  busy,
  canWrite,
  onAdvance,
  onEdit,
  onDelete,
}: {
  member: CrewMember
  busy?: boolean
  canWrite?: boolean
  onAdvance?: (member: CrewMember, nextStatus: string) => void
  onEdit?: (member: CrewMember) => void
  onDelete?: (member: CrewMember) => void
}) {
  const initials = (member.name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const lane = STATUS_LANES.find((l) => l.match(member.status))

  return (
    <article className="bg-card rounded-lg border p-3 shadow-xs">
      <div className="flex items-start gap-2.5">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{member.name || member.crewId}</div>
          <div className="text-muted-foreground truncate text-xs">{member.role || "Crew"}</div>
        </div>
      </div>
      {member.departmentName ? (
        <div className="mt-2">
          <Badge variant="secondary" className="max-w-full truncate font-normal">
            {member.departmentName}
          </Badge>
        </div>
      ) : null}
      <div className="text-muted-foreground mt-2 flex flex-col gap-0.5 text-[11px]">
        {member.email ? (
          <span className="inline-flex items-center gap-1 truncate">
            <MailIcon className="size-3 shrink-0" />
            {member.email}
          </span>
        ) : null}
        {member.phone ? (
          <span className="inline-flex items-center gap-1">
            <PhoneIcon className="size-3 shrink-0" />
            {member.phone}
          </span>
        ) : null}
      </div>
      {canWrite && onAdvance && (lane?.next || lane?.prev) ? (
        <div className="mt-3 flex gap-1.5">
          {lane?.prev ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 flex-1 text-xs"
              disabled={busy}
              onClick={() => onAdvance(member, lane.prev!)}
              title={lane.prevLabel ?? "Back"}
            >
              {busy ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <ChevronLeftIcon className="size-3" />
              )}
              <span className="truncate">{lane.prevLabel}</span>
            </Button>
          ) : null}
          {lane?.next ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-xs"
              disabled={busy}
              onClick={() => onAdvance(member, lane.next!)}
            >
              {busy ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <ChevronRightIcon className="size-3" />
              )}
              {lane.nextLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      {canWrite && (onEdit || onDelete) ? <div className="mt-2 flex gap-1.5">
        {onEdit ? <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" disabled={busy} onClick={() => onEdit(member)}><PencilIcon className="size-3" /> Edit</Button> : null}
        {onDelete ? <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" disabled={busy} onClick={() => onDelete(member)}><Trash2Icon className="size-3 text-destructive" /> Delete</Button> : null}
      </div> : null}
    </article>
  )
}

export function CrewBoard({
  crew,
  departments,
  className,
  busyCrewId,
  canWrite = true,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  crew: CrewMember[]
  departments: Department[]
  className?: string
  busyCrewId?: string | null
  canWrite?: boolean
  onStatusChange?: (member: CrewMember, nextStatus: string) => void
  onEdit?: (member: CrewMember) => void
  onDelete?: (member: CrewMember) => void
}) {
  const [deptFilter, setDeptFilter] = useState<string>("all")

  const filtered = useMemo(() => {
    if (deptFilter === "all") return crew
    return crew.filter((c) => c.departmentId === deptFilter)
  }, [crew, deptFilter])

  const onSite = crew.filter((c) => c.status === "on_site").length
  const confirmed = crew.filter(
    (c) => c.status === "confirmed" || c.status === "on_site" || c.status === "complete",
  ).length

  const lanes = STATUS_LANES.map((lane) => ({
    ...lane,
    members: filtered.filter((c) => lane.match(c.status)),
  }))

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-3 text-sm sm:gap-x-6 sm:px-4">
        <div>
          <span className="text-muted-foreground">Headcount </span>
          <span className="font-semibold tabular-nums">{crew.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">On site </span>
          <span className="font-semibold tabular-nums">{onSite}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Confirmed+ </span>
          <span className="font-semibold tabular-nums">
            {confirmed}/{crew.length}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Departments </span>
          <span className="font-semibold tabular-nums">{departments.length}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        <aside className="xl:w-56 xl:shrink-0">
          <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Departments
          </div>
          <div className="-mx-1 flex flex-row gap-1.5 overflow-x-auto px-1 pb-1 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0">
            <Button
              size="sm"
              variant={deptFilter === "all" ? "default" : "outline"}
              className="justify-between whitespace-nowrap"
              onClick={() => setDeptFilter("all")}
            >
              All departments
              <span className="tabular-nums opacity-70">{crew.length}</span>
            </Button>
            {departments.map((dept) => {
              const count = crew.filter((c) => c.departmentId === dept.departmentId).length
              const onSiteDept = crew.filter(
                (c) => c.departmentId === dept.departmentId && c.status === "on_site",
              ).length
              return (
                <button
                  key={dept.departmentId}
                  type="button"
                  onClick={() => setDeptFilter(dept.departmentId)}
                  className={cn(
                    "hover:bg-muted/80 flex min-w-[9.5rem] flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors xl:min-w-0",
                    deptFilter === dept.departmentId
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: dept.color || "var(--primary)" }}
                    />
                    <span className="truncate text-sm font-medium">{dept.name}</span>
                  </div>
                  <div className="text-muted-foreground flex justify-between text-[11px]">
                    <span>{count} crew</span>
                    <span>{onSiteDept} on site</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Status board
            {deptFilter !== "all" ? (
              <span className="text-foreground font-normal normal-case">
                {" "}
                · {departments.find((d) => d.departmentId === deptFilter)?.name ?? "Department"}
              </span>
            ) : null}
          </div>
          {/* Mobile: horizontal scroll lanes; desktop: grid */}
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4">
            {lanes.map((lane) => (
              <section
                key={lane.id}
                className="bg-muted/40 flex min-h-64 w-[min(85vw,18rem)] shrink-0 flex-col rounded-xl border border-dashed p-2 md:w-auto md:min-w-0"
              >
                <header className="mb-2 flex items-start justify-between gap-2 px-1 pt-1">
                  <div>
                    <div className="text-sm font-semibold">{lane.label}</div>
                    <div className="text-muted-foreground text-[11px]">{lane.hint}</div>
                  </div>
                  <Badge variant="secondary" className="tabular-nums">
                    {lane.members.length}
                  </Badge>
                </header>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  {lane.members.length === 0 ? (
                    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1 py-8 text-center text-xs">
                      <UserIcon className="size-4 opacity-40" />
                      Empty
                    </div>
                  ) : (
                    lane.members.map((member) => (
                      <CrewCard
                        key={member.crewId || member.id}
                        member={member}
                        busy={busyCrewId === member.crewId}
                        canWrite={canWrite}
                        onAdvance={onStatusChange}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
