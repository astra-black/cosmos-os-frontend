import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react"

import {
  ScheduleChangeDialog,
  type ScheduleChangeCandidate,
} from "@/components/schedule/schedule-change-dialog"
import { ScheduleChangeRequestsPanel } from "@/components/schedule/schedule-change-requests-panel"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useTeamMembers } from "@/hooks/use-agency-data"
import { listMilestones, listProjects, listTasks } from "@/lib/api/agency"
import type { Milestone, Project, Task } from "@/types/agency"
import { cn } from "@/lib/utils"

type ViewMode = "week" | "month"

type ScheduleEntry = {
  id: string
  kind: "task" | "milestone"
  entityId: string
  projectId: string
  projectName: string
  title: string
  subtitle: string
  dateKey: string
  dueDate: string
  href: string
  status: string
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null
  // Prefer date-only / leading YYYY-MM-DD to avoid timezone drift for calendar placement.
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return startOfDay(parsed)
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Monday-start week containing the anchor date. */
function weekDays(anchor: Date): Date[] {
  const base = startOfDay(anchor)
  const dow = (base.getDay() + 6) % 7 // Mon=0 … Sun=6
  const monday = new Date(base)
  monday.setDate(base.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const startPad = (first.getDay() + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - startPad)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
}

function formatRangeLabel(days: Date[]) {
  if (days.length === 0) return ""
  const a = days[0]
  const b = days[days.length - 1]
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  if (sameMonth) {
    return `${a.getDate()} – ${b.getDate()} ${a.toLocaleDateString(undefined, { month: "short" })} ${a.getFullYear()}`
  }
  const left = a.toLocaleDateString(undefined, { day: "numeric", month: "short" })
  const right = b.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  return `${left} – ${right}`
}

function formatMonthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}

function projectLabel(entry: { projectId?: string | null; projectName?: string | null }, projects: Project[]) {
  if (entry.projectName) return entry.projectName
  if (!entry.projectId) return ""
  return projects.find((p) => p.projectId === entry.projectId)?.projectName || "Project"
}

function milestoneProjectId(m: Milestone): string | null {
  if (m.projectId) return m.projectId
  if (typeof m.project === "string" && m.project) return m.project
  if (Array.isArray(m.project) && m.project[0]) return m.project[0]
  return null
}

export function SchedulePage() {
  const [view, setView] = useState<ViewMode>("week")
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [projectFilter, setProjectFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [undatedCount, setUndatedCount] = useState(0)
  const [changeOpen, setChangeOpen] = useState(false)
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0)
  const { data: teamMembers } = useTeamMembers()

  function reloadSchedule() {
    setLoading(true)
    setError(null)
    Promise.all([
      listTasks().catch((err) => {
        console.warn("[Schedule] tasks failed:", err)
        return null
      }),
      listMilestones().catch((err) => {
        console.warn("[Schedule] milestones failed:", err)
        return null
      }),
      listProjects().catch((err) => {
        console.warn("[Schedule] projects failed:", err)
        return null
      }),
    ]).then(([taskRes, milestoneRes, projectRes]) => {
      const nextTasks = taskRes?.data ?? []
      const nextMilestones = milestoneRes?.data ?? []
      const nextProjects = projectRes?.data ?? projectRes?.projects ?? []
      setTasks(nextTasks)
      setMilestones(nextMilestones)
      setProjects(nextProjects)

      const undatedTasks = nextTasks.filter((t) => t.projectId && !parseDateOnly(t.dueDate ?? null)).length
      const undatedMilestones = nextMilestones.filter((m) => milestoneProjectId(m) && !parseDateOnly(m.dueDate)).length
      setUndatedCount(undatedTasks + undatedMilestones)

      if (!taskRes && !milestoneRes) {
        setError("Schedule data could not be loaded.")
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    reloadSchedule()
  }, [])

  const entries = useMemo(() => {
    const out: ScheduleEntry[] = []

    for (const task of tasks) {
      if (!task.projectId) continue
      const due = parseDateOnly(task.dueDate ?? null)
      if (!due) continue
      if (projectFilter !== "all" && task.projectId !== projectFilter) continue
      const project = projectLabel(task, projects)
      out.push({
        id: `task-${task.taskId}`,
        kind: "task",
        entityId: task.taskId,
        projectId: task.projectId,
        projectName: project,
        title: task.title,
        subtitle: `${project} · ${task.status.replace(/_/g, " ")}`,
        dateKey: toDateKey(due),
        dueDate: task.dueDate as string,
        href: `/projects/${task.projectId}`,
        status: task.status,
      })
    }

    for (const milestone of milestones) {
      const projectId = milestoneProjectId(milestone)
      if (!projectId) continue
      const due = parseDateOnly(milestone.dueDate)
      if (!due) continue
      if (projectFilter !== "all" && projectId !== projectFilter) continue
      const project = projects.find((p) => p.projectId === projectId)?.projectName || "Project"
      out.push({
        id: `milestone-${milestone.milestoneId}`,
        kind: "milestone",
        entityId: milestone.milestoneId,
        projectId,
        projectName: project,
        title: milestone.name,
        subtitle: `${project} · ${milestone.status}`,
        dateKey: toDateKey(due),
        dueDate: milestone.dueDate,
        href: `/projects/${projectId}`,
        status: milestone.status,
      })
    }

    return out.sort((a, b) => a.title.localeCompare(b.title))
  }, [tasks, milestones, projects, projectFilter])

  const changeCandidates: ScheduleChangeCandidate[] = useMemo(
    () =>
      entries.map((entry) => ({
        key: entry.id,
        kind: entry.kind,
        entityId: entry.entityId,
        projectId: entry.projectId,
        projectName: entry.projectName,
        title: entry.title,
        dueDate: entry.dueDate,
      })),
    [entries],
  )

  const days = useMemo(
    () => (view === "week" ? weekDays(anchor) : monthGrid(anchor)),
    [anchor, view],
  )

  const todayKey = toDateKey(startOfDay(new Date()))
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.dateKey) ?? []
      list.push(entry)
      map.set(entry.dateKey, list)
    }
    return map
  }, [entries])

  const visibleCount = useMemo(() => {
    const keys = new Set(days.map(toDateKey))
    return entries.filter((e) => keys.has(e.dateKey)).length
  }, [days, entries])

  function shift(delta: number) {
    setAnchor((prev) => {
      const next = new Date(prev)
      if (view === "week") next.setDate(prev.getDate() + delta * 7)
      else next.setMonth(prev.getMonth() + delta)
      return startOfDay(next)
    })
  }

  return (
    <div className="cosmos-schedule-page">
      <div className="cosmos-schedule-page__head">
        <div>
          <p className="cosmos-schedule-page__eyebrow">Workspace</p>
          <h1>Schedule</h1>
          <p className="cosmos-schedule-page__lede">
            Cross-project calendar of tasks and milestones with real due dates. Undated items stay off the board.
          </p>
        </div>
      </div>

      <div className="cosmos-schedule-toolbar">
        <div className="cosmos-schedule-seg" role="tablist" aria-label="Calendar view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "week"}
            className={cn(view === "week" && "is-active")}
            onClick={() => setView("week")}
          >
            Week
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "month"}
            className={cn(view === "month" && "is-active")}
            onClick={() => setView("month")}
          >
            Month
          </button>
        </div>

        <div className="cosmos-schedule-range">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <span>{view === "week" ? formatRangeLabel(days.slice(0, 7)) : formatMonthLabel(anchor)}</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
        </div>

        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Filter by project"
          className="cosmos-schedule-project-filter normal-case"
        >
          <option value="all">All Projects</option>
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.projectName}
            </option>
          ))}
        </Select>

        <span className="cosmos-schedule-toolbar__spacer" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || changeCandidates.length === 0}
          onClick={() => setChangeOpen(true)}
        >
          Request Schedule Change
        </Button>
      </div>

      {undatedCount > 0 ? (
        <p className="cosmos-schedule-note">
          {undatedCount} project-linked task{undatedCount === 1 ? "" : "s"} or milestone{undatedCount === 1 ? "" : "s"} without a due date {undatedCount === 1 ? "is" : "are"} hidden.
        </p>
      ) : null}

      {loading ? (
        <div className="cosmos-schedule-board cosmos-schedule-board--week">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="cosmos-schedule-day">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-3 h-14 w-full rounded-[10px]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Schedule unavailable" description={error} />
      ) : visibleCount === 0 ? (
        <EmptyState
          title="No dated items in this range"
          description="Only tasks and milestones with a due date and project association appear here. Events and cues are omitted until they carry a project link."
          action={
            <Button size="sm" variant="outline" render={<Link to="/tasks" />}>
              Open Work
            </Button>
          }
        />
      ) : (
        <div
          className={cn(
            "cosmos-schedule-board",
            view === "week" ? "cosmos-schedule-board--week" : "cosmos-schedule-board--month",
          )}
        >
          {days.map((day) => {
            const key = toDateKey(day)
            const items = byDay.get(key) ?? []
            const isToday = key === todayKey
            const inMonth = day.getMonth() === anchor.getMonth()
            return (
              <div
                key={key}
                className={cn(
                  "cosmos-schedule-day",
                  isToday && "is-today",
                  view === "month" && !inMonth && "is-outside",
                )}
              >
                <div className={cn("cosmos-schedule-day__label", isToday && "is-today")}>
                  {view === "week" ? formatDayLabel(day) : day.getDate()}
                </div>
                <div className="cosmos-schedule-day__items">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      to={item.href}
                      className={cn(
                        "cosmos-schedule-card",
                        item.kind === "milestone" && "is-milestone",
                      )}
                    >
                      <span className="cosmos-schedule-card__glyph" aria-hidden="true" data-edition="agency" />
                      <span className="cosmos-schedule-card__text">
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {loading ? (
        <p className="cosmos-schedule-foot">
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" /> Loading schedule…
        </p>
      ) : !error ? (
        <p className="cosmos-schedule-foot">
          Showing {visibleCount} dated item{visibleCount === 1 ? "" : "s"}
          {projectFilter !== "all" ? " for the selected project" : " across projects"}.
          {" "}
          Requested date changes stay pending until acknowledgments complete and dates are explicitly applied.
        </p>
      ) : null}

      <ScheduleChangeRequestsPanel
        refreshKey={requestsRefreshKey}
        onApplied={reloadSchedule}
      />

      <ScheduleChangeDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        candidates={changeCandidates}
        teamMembers={teamMembers}
        onCreated={() => setRequestsRefreshKey((n) => n + 1)}
      />
    </div>
  )
}
