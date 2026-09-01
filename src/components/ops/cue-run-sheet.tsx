import { useEffect, useMemo, useState } from "react"
import {
  CheckIcon,
  CircleDotIcon,
  ClockIcon,
  ForwardIcon,
  ListIcon,
  Loader2Icon,
  MapPinIcon,
  PlayIcon,
  RadioIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SkipForwardIcon,
  SquareCheckIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Cue } from "@/types/agency"

type Filter = "all" | "live" | "upcoming" | "done" | "skipped"

function formatTime(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function statusMeta(status: string) {
  switch (status) {
    case "completed":
      return {
        label: "Done",
        rail: "bg-chart-2",
        chip: "bg-chart-2/15 text-foreground border-transparent",
        icon: CheckIcon,
      }
    case "in_progress":
      return {
        label: "Live",
        rail: "bg-primary",
        chip: "bg-primary text-primary-foreground border-transparent",
        icon: RadioIcon,
      }
    case "skipped":
      return {
        label: "Skipped",
        rail: "bg-muted-foreground/40",
        chip: "bg-muted text-muted-foreground border-transparent",
        icon: SkipForwardIcon,
      }
    default:
      return {
        label: status.replace("_", " "),
        rail: "bg-border",
        chip: "bg-muted text-muted-foreground border-transparent",
        icon: ClockIcon,
      }
  }
}

export function CueRunSheet({
  cues,
  className,
  busyCueId,
  advancing,
  canWrite = true,
  onStart,
  onComplete,
  onSkip,
  onReset,
  onAdvance,
  onEdit,
  onDelete,
}: {
  cues: Cue[]
  className?: string
  busyCueId?: string | null
  advancing?: boolean
  canWrite?: boolean
  onStart?: (cue: Cue) => void
  onComplete?: (cue: Cue) => void
  onSkip?: (cue: Cue) => void
  onReset?: (cue: Cue) => void
  onAdvance?: () => void
  onEdit?: (cue: Cue) => void
  onDelete?: (cue: Cue) => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list")

  // If the active filter becomes empty after a status change (e.g. reset while on Live),
  // fall back to Full run so the cue doesn't look "stuck" on a stale filter.
  const sorted = useMemo(
    () =>
      [...cues].sort(
        (a, b) =>
          new Date(a.scheduledTime || 0).getTime() - new Date(b.scheduledTime || 0).getTime(),
      ),
    [cues],
  )

  const counts = useMemo(() => {
    return {
      all: sorted.length,
      live: sorted.filter((c) => c.status === "in_progress").length,
      upcoming: sorted.filter((c) => c.status === "pending").length,
      done: sorted.filter((c) => c.status === "completed").length,
      skipped: sorted.filter((c) => c.status === "skipped").length,
    }
  }, [sorted])

  const visible = useMemo(() => {
    if (filter === "live") return sorted.filter((c) => c.status === "in_progress")
    if (filter === "upcoming") return sorted.filter((c) => c.status === "pending")
    if (filter === "done") return sorted.filter((c) => c.status === "completed")
    if (filter === "skipped") return sorted.filter((c) => c.status === "skipped")
    return sorted
  }, [sorted, filter])

  // Auto-leave empty filtered views after mutations (e.g. Reset while on Live)
  useEffect(() => {
    if (filter !== "all" && visible.length === 0 && sorted.length > 0) {
      setFilter("all")
    }
  }, [filter, visible.length, sorted.length])

  const completion =
    sorted.length === 0
      ? 0
      : Math.round(((counts.done + counts.skipped) / sorted.length) * 100)

  const liveCue = sorted.find((c) => c.status === "in_progress")
  const nextCue = sorted.find((c) => c.status === "pending")

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Full run", count: counts.all },
    { id: "live", label: "Live", count: counts.live },
    { id: "upcoming", label: "Upcoming", count: counts.upcoming },
    { id: "done", label: "Done", count: counts.done },
    { id: "skipped", label: "Skipped", count: counts.skipped },
  ]

  const anyBusy = Boolean(busyCueId) || advancing

  // Multi-track grouping and layout calculations
  const tracks = useMemo(() => {
    const depts = new Set<string>()
    visible.forEach((c) => {
      depts.add(c.departmentName || "General")
    })
    return Array.from(depts).sort()
  }, [visible])

  const timeRange = useMemo(() => {
    if (sorted.length === 0) {
      return { min: Date.now(), max: Date.now() + 3600000, total: 3600000 }
    }
    const times = sorted.map((c) => new Date(c.scheduledTime || Date.now()).getTime())
    const min = Math.min(...times)
    const endTimes = sorted.map((c) => {
      const start = new Date(c.scheduledTime || Date.now()).getTime()
      const durationMs = (c.duration || 10) * 60000
      return start + durationMs
    })
    const max = Math.max(...endTimes)
    return {
      min,
      max,
      total: Math.max(max - min, 60000),
    }
  }, [sorted])

  const ticks = useMemo(() => {
    const list: number[] = []
    const step = 15 * 60000 // 15-minute interval ticks
    const start = Math.floor(timeRange.min / step) * step
    for (let t = start; t <= timeRange.max; t += step) {
      list.push(t)
    }
    return list
  }, [timeRange])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Show caller desk */}
      <div className="bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 sm:col-span-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Now calling
          </span>
          {liveCue ? (
            <>
              <span className="text-lg leading-tight font-semibold">{liveCue.name}</span>
              <span className="text-muted-foreground text-sm">
                {formatTime(liveCue.scheduledTime)}
                {liveCue.departmentName ? ` · ${liveCue.departmentName}` : ""}
              </span>
              {canWrite ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {onComplete ? (
                    <Button
                      size="sm"
                      disabled={anyBusy}
                      onClick={() => onComplete(liveCue)}
                    >
                      {busyCueId === liveCue.cueId ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <SquareCheckIcon className="size-3.5" />
                      )}
                      Complete
                    </Button>
                  ) : null}
                  {onSkip ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={anyBusy}
                      onClick={() => onSkip(liveCue)}
                    >
                      <SkipForwardIcon className="size-3.5" />
                      Skip
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground text-sm">No live cue</span>
          )}
        </div>
        <div className="flex flex-col gap-1 border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Next up
          </span>
          {nextCue ? (
            <>
              <span className="font-medium">{nextCue.name}</span>
              <span className="text-muted-foreground text-sm">
                {formatTime(nextCue.scheduledTime)}
                {nextCue.location ? ` · ${nextCue.location}` : ""}
              </span>
              {canWrite && onStart ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={anyBusy}
                    onClick={() => onStart(nextCue)}
                  >
                    {busyCueId === nextCue.cueId ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <PlayIcon className="size-3.5" />
                    )}
                    Start
                  </Button>
                  {onSkip ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={anyBusy}
                      onClick={() => onSkip(nextCue)}
                    >
                      <SkipForwardIcon className="size-3.5" />
                      Skip
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground text-sm">End of run sheet</span>
          )}
        </div>
        <div className="flex flex-col justify-center gap-2 border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Run progress</span>
            <span className="tabular-nums font-medium">
              {counts.done + counts.skipped}/{sorted.length} · {completion}%
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${completion}%` }}
            />
          </div>
          {canWrite && onAdvance ? (
            <Button
              size="sm"
              className="mt-1 w-full"
              disabled={anyBusy || (!liveCue && !nextCue)}
              onClick={onAdvance}
            >
              {advancing ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <ForwardIcon className="size-3.5" />
              )}
              {liveCue ? "Advance show" : nextCue ? "Start show" : "Run complete"}
            </Button>
          ) : null}
          <p className="text-muted-foreground text-[11px] leading-snug">
            Advance completes the live cue and starts the next pending one.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? "default" : "outline"}
              onClick={() => setFilter(f.id)}
              className="rounded-full"
            >
              {f.label}
              <span className={cn("ml-1 tabular-nums opacity-70", filter === f.id && "opacity-90")}>
                {f.count}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border text-xs">
          <Button
            size="sm"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            onClick={() => setViewMode("list")}
            className="h-7 px-2.5 rounded-md text-xs"
          >
            <ListIcon className="size-3.5 mr-1" />
            List
          </Button>
          <Button
            size="sm"
            variant={viewMode === "timeline" ? "secondary" : "ghost"}
            onClick={() => setViewMode("timeline")}
            className="h-7 px-2.5 rounded-md text-xs"
          >
            <SlidersHorizontalIcon className="size-3.5 mr-1" />
            Timeline
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        visible.length === 0 ? (
          <div className="text-muted-foreground border-border rounded-xl border border-dashed py-16 text-center text-sm">
            No cues in this view.
          </div>
        ) : (
          <ol className="relative flex flex-col">
            {visible.map((cue, index) => {
              const meta = statusMeta(cue.status)
              const Icon = meta.icon
              const isLive = cue.status === "in_progress"
              const isNext = nextCue && cue.cueId === nextCue.cueId
              const isFuturePending = cue.status === "pending" && (!nextCue || cue.cueId !== nextCue.cueId)
              const isLast = index === visible.length - 1
              const busy = busyCueId === cue.cueId

              return (
                <li key={cue.cueId || cue.id} className="relative flex gap-4 pb-0">
                  <div className="w-14 shrink-0 pt-4 text-right sm:w-16">
                    <div
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        isLive && "text-primary",
                      )}
                    >
                      {formatTime(cue.scheduledTime)}
                    </div>
                    {cue.duration != null ? (
                      <div className="text-muted-foreground text-[11px] tabular-nums">
                        {cue.duration}m
                      </div>
                    ) : null}
                  </div>

                  <div className="relative flex w-6 shrink-0 flex-col items-center">
                    <div
                      className={cn(
                        "z-10 mt-4 flex size-6 items-center justify-center rounded-full border-2 border-background",
                        isLive ? "bg-red-500 ring-red-500/30 size-7 ring-4" :
                        isNext ? "bg-emerald-500 ring-emerald-500/20 ring-2" :
                        isFuturePending ? "bg-purple-500" : meta.rail,
                      )}
                    >
                      <Icon className="size-3 text-white dark:text-black" />
                    </div>
                    {!isLast ? (
                      <div className="bg-border absolute top-10 bottom-0 w-px grow" />
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      "relative mb-3 min-w-0 flex-1 rounded-xl border p-3 sm:p-4 overflow-hidden",
                      isLive ? "border-red-500/40 bg-gradient-to-t from-red-500/10 via-red-500/[0.02] to-card ring-1 ring-red-500/20 shadow-sm" :
                      isNext ? "border-emerald-500/40 bg-gradient-to-t from-emerald-500/10 via-emerald-500/[0.02] to-card" :
                      isFuturePending ? "border-purple-500/40 bg-gradient-to-t from-purple-500/10 via-purple-500/[0.02] to-card" :
                      (cue.status === "completed" || cue.status === "skipped") ? "border-border/60 bg-muted/20 opacity-70" :
                      "border-border bg-card",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground font-mono text-xs">
                            {cue.cueId}
                          </span>
                          <Badge className={cn("h-5 capitalize", meta.chip)}>{meta.label}</Badge>
                          {cue.priority && cue.priority !== "medium" ? (
                            <Badge variant="outline" className="h-5 capitalize">
                              {cue.priority}
                            </Badge>
                          ) : null}
                        </div>
                        <h3 className="mt-1 text-base font-semibold leading-snug">
                          {cue.name || cue.title}
                        </h3>
                        {cue.description ? (
                          <p className="text-muted-foreground mt-1 text-sm">{cue.description}</p>
                        ) : null}
                      </div>
                      {canWrite ? (
                        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          {cue.status === "pending" && onStart ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={anyBusy}
                              onClick={() => onStart(cue)}
                            >
                              {busy ? (
                                <Loader2Icon className="size-3.5 animate-spin" />
                              ) : (
                                <PlayIcon className="size-3.5" />
                              )}
                              Start
                            </Button>
                          ) : null}
                          {cue.status === "in_progress" && onComplete ? (
                            <Button
                              size="sm"
                              disabled={anyBusy}
                              onClick={() => onComplete(cue)}
                            >
                              {busy ? (
                                <Loader2Icon className="size-3.5 animate-spin" />
                              ) : (
                                <SquareCheckIcon className="size-3.5" />
                              )}
                              Complete
                            </Button>
                          ) : null}
                          {(cue.status === "pending" || cue.status === "in_progress") &&
                          onSkip ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={anyBusy}
                              onClick={() => onSkip(cue)}
                            >
                              <SkipForwardIcon className="size-3.5" />
                              Skip
                            </Button>
                          ) : null}
                          {(cue.status === "completed" ||
                            cue.status === "skipped" ||
                            cue.status === "in_progress") &&
                          onReset ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={anyBusy}
                              onClick={() => onReset(cue)}
                              title="Reset to pending"
                            >
                              <RotateCcwIcon className="size-3.5" />
                              Reset
                            </Button>
                          ) : null}
                          {onEdit ? <Button size="sm" variant="ghost" disabled={anyBusy} onClick={() => onEdit(cue)}><PencilIcon className="size-3.5" /> Edit</Button> : null}
                          {onDelete ? <Button size="sm" variant="ghost" disabled={anyBusy} onClick={() => onDelete(cue)}><Trash2Icon className="size-3.5 text-destructive" /> Delete</Button> : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {cue.departmentName ? (
                        <span className="inline-flex items-center gap-1">
                          <CircleDotIcon className="size-3" />
                          {cue.departmentName}
                        </span>
                      ) : null}
                      {cue.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="size-3" />
                          {cue.location}
                        </span>
                      ) : null}
                      {cue.actualStartTime ? (
                        <span>
                          Started {formatTime(cue.actualStartTime)}
                          {cue.actualEndTime ? ` → ${formatTime(cue.actualEndTime)}` : ""}
                        </span>
                      ) : null}
                    </div>
                    {isLive && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-500 via-red-400/50 to-transparent" />}
                    {isNext && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400/50 to-transparent" />}
                    {isFuturePending && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-purple-500 via-purple-400/50 to-transparent" />}
                  </div>
                </li>
              )
            })}
          </ol>
        )
      ) : (
        /* Horizontal Multi-track Timeline View */
        <div className="bg-card rounded-xl border overflow-hidden flex flex-col">
          {/* Timeline Scrollable Area */}
          <div className="overflow-x-auto">
            <div className="min-w-[1000px] relative flex flex-col select-none">
              
              {/* Time Ruler (Header Row) */}
              <div className="flex border-b border-border bg-muted/40 h-10 items-center">
                <div className="w-36 shrink-0 border-r border-border px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tracks
                </div>
                <div className="relative flex-1 h-full">
                  {ticks.map((tickTime) => {
                    const leftPercent = ((tickTime - timeRange.min) / timeRange.total) * 100
                    if (leftPercent < 0 || leftPercent > 100) return null
                    return (
                      <div
                        key={tickTime}
                        className="absolute top-0 bottom-0 flex flex-col justify-between pt-1 pb-1.5"
                        style={{ left: `${leftPercent}%` }}
                      >
                        <span className="text-[10px] font-mono font-medium -translate-x-1/2 text-muted-foreground leading-none">
                          {new Date(tickTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <div className="w-px h-1.5 bg-muted-foreground/30 -translate-x-1/2" />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Grid vertical lines overlay */}
              <div className="absolute top-10 bottom-0 left-36 right-0 pointer-events-none z-0">
                {ticks.map((tickTime) => {
                  const leftPercent = ((tickTime - timeRange.min) / timeRange.total) * 100
                  if (leftPercent <= 0 || leftPercent >= 100) return null
                  return (
                    <div
                      key={`grid-${tickTime}`}
                      className="absolute top-0 bottom-0 w-px border-r border-dashed border-muted/10"
                      style={{ left: `${leftPercent}%` }}
                    />
                  )
                })}
              </div>

              {/* Track rows */}
              {tracks.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No cues in this view.
                </div>
              ) : (
                tracks.map((trackName) => {
                  const trackCues = visible.filter((c) => (c.departmentName || "General") === trackName)
                  return (
                    <div key={trackName} className="flex border-b border-border last:border-0 min-h-[96px] items-stretch">
                      {/* Track Sidebar Label */}
                      <div className="w-36 shrink-0 border-r border-border bg-muted/10 p-3 flex flex-col justify-center">
                        <span className="text-xs font-semibold text-foreground truncate">{trackName}</span>
                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          {trackCues.length} {trackCues.length === 1 ? "cue" : "cues"}
                        </span>
                      </div>

                      {/* Track Horizontal Grid Area */}
                      <div className="relative flex-1 bg-muted/5 py-3 min-h-[96px] z-10">
                        {trackCues.map((cue) => {
                          const meta = statusMeta(cue.status)
                          const Icon = meta.icon
                          const isLive = cue.status === "in_progress"
                          const isNext = nextCue && cue.cueId === nextCue.cueId
                          const isFuturePending = cue.status === "pending" && (!nextCue || cue.cueId !== nextCue.cueId)
                          const busy = busyCueId === cue.cueId
                          
                          // Time position math
                          const cueStart = new Date(cue.scheduledTime || timeRange.min).getTime()
                          const cueDurMs = (cue.duration || 10) * 60000
                          
                          const leftPercent = ((cueStart - timeRange.min) / timeRange.total) * 100
                          const widthPercent = (cueDurMs / timeRange.total) * 100
                          
                          return (
                            <div
                              key={cue.cueId || cue.id}
                              className={cn(
                                "absolute top-3 bottom-3 rounded-lg border px-3 py-2 flex flex-col justify-between transition-all group overflow-hidden select-none hover:shadow-md",
                                isLive ? "border-red-500/40 bg-gradient-to-t from-red-500/10 via-red-500/[0.02] to-card ring-1 ring-red-500/20 shadow-sm" :
                                isNext ? "border-emerald-500/40 bg-gradient-to-t from-emerald-500/10 via-emerald-500/[0.02] to-card" :
                                isFuturePending ? "border-purple-500/40 bg-gradient-to-t from-purple-500/10 via-purple-500/[0.02] to-card" :
                                (cue.status === "completed" || cue.status === "skipped") ? "border-border/60 bg-muted/20 opacity-70" :
                                "border-border bg-card hover:border-muted-foreground/30"
                              )}
                              style={{
                                left: `${Math.max(0, Math.min(leftPercent, 98))}%`,
                                width: `${Math.max(5, Math.min(widthPercent, 100))}%`,
                                minWidth: "140px"
                              }}
                            >
                              {/* Cue Header (Name & Status icon) */}
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-mono text-muted-foreground">
                                      {cue.cueId}
                                    </span>
                                    {isLive && (
                                      <span className="relative flex h-1.5 w-1.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                      </span>
                                    )}
                                  </div>
                                  <h4 className={cn("text-xs font-semibold leading-tight mt-0.5 truncate", isLive && "text-red-500")}>
                                    {cue.name || cue.title}
                                  </h4>
                                </div>
                                <div className={cn("flex size-5 items-center justify-center rounded-full shrink-0",
                                  isLive ? "bg-red-500" : isNext ? "bg-emerald-500" : isFuturePending ? "bg-purple-500" : meta.rail
                                )}>
                                  <Icon className="size-2.5 text-white dark:text-black" />
                                </div>
                              </div>

                              {/* Timing & Location info */}
                              <div className="text-[10px] text-muted-foreground font-mono leading-none flex items-center justify-between gap-1.5 mt-1.5">
                                <span>{formatTime(cue.scheduledTime)} ({cue.duration || 10}m)</span>
                                {cue.location && <span className="truncate text-right">{cue.location}</span>}
                              </div>

                              {/* Bottom light accent */}
                              {isLive && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-500 via-red-400/50 to-transparent" />}
                              {isNext && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-emerald-500 via-emerald-400/50 to-transparent" />}
                              {isFuturePending && <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-purple-500 via-purple-400/50 to-transparent" />}

                              {/* Actions on hover/select */}
                              {canWrite && (
                                <div className="absolute inset-x-0 bottom-0 bg-background/95 border-t py-1 px-2 flex justify-end gap-1 translate-y-full group-hover:translate-y-0 transition-transform">
                                  {cue.status === "pending" && onStart && (
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="size-6 rounded-md"
                                      disabled={anyBusy}
                                      onClick={(e) => { e.stopPropagation(); onStart(cue); }}
                                      title="Start"
                                    >
                                      {busy ? (
                                        <Loader2Icon className="size-3 animate-spin" />
                                      ) : (
                                        <PlayIcon className="size-3 text-primary" />
                                      )}
                                    </Button>
                                  )}
                                  {cue.status === "in_progress" && onComplete && (
                                    <Button
                                      size="icon"
                                      className="size-6 rounded-md bg-chart-2 hover:bg-chart-2/90 text-white"
                                      disabled={anyBusy}
                                      onClick={(e) => { e.stopPropagation(); onComplete(cue); }}
                                      title="Complete"
                                    >
                                      {busy ? (
                                        <Loader2Icon className="size-3 animate-spin" />
                                      ) : (
                                        <CheckIcon className="size-3" />
                                      )}
                                    </Button>
                                  )}
                                  {(cue.status === "pending" || cue.status === "in_progress") && onSkip && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-6 rounded-md hover:bg-muted"
                                      disabled={anyBusy}
                                      onClick={(e) => { e.stopPropagation(); onSkip(cue); }}
                                      title="Skip"
                                    >
                                      <SkipForwardIcon className="size-3" />
                                    </Button>
                                  )}
                                   {(cue.status === "completed" || cue.status === "skipped" || cue.status === "in_progress") && onReset && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-6 rounded-md hover:bg-muted"
                                      disabled={anyBusy}
                                      onClick={(e) => { e.stopPropagation(); onReset(cue); }}
                                      title="Reset"
                                    >
                                      <RotateCcwIcon className="size-3" />
                                    </Button>
                                  )}
                                  {onEdit && <Button size="icon" variant="ghost" className="size-6 rounded-md" disabled={anyBusy} onClick={(e) => { e.stopPropagation(); onEdit(cue) }} title="Edit"><PencilIcon className="size-3" /></Button>}
                                  {onDelete && <Button size="icon" variant="ghost" className="size-6 rounded-md" disabled={anyBusy} onClick={(e) => { e.stopPropagation(); onDelete(cue) }} title="Delete"><Trash2Icon className="size-3 text-destructive" /></Button>}
                                </div>
                              )}

                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
