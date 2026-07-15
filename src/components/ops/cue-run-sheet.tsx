import { useEffect, useMemo, useState } from "react"
import {
  CheckIcon,
  CircleDotIcon,
  ClockIcon,
  ForwardIcon,
  Loader2Icon,
  MapPinIcon,
  PlayIcon,
  RadioIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SquareCheckIcon,
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
}) {
  const [filter, setFilter] = useState<Filter>("all")

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

      {visible.length === 0 ? (
        <div className="text-muted-foreground border-border rounded-xl border border-dashed py-16 text-center text-sm">
          No cues in this view.
        </div>
      ) : (
        <ol className="relative flex flex-col">
          {visible.map((cue, index) => {
            const meta = statusMeta(cue.status)
            const Icon = meta.icon
            const isLive = cue.status === "in_progress"
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
                      meta.rail,
                      isLive && "ring-primary/30 size-7 ring-4",
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
                    "mb-3 min-w-0 flex-1 rounded-xl border p-3 sm:p-4",
                    isLive && "border-primary/40 bg-primary/5 shadow-sm",
                    (cue.status === "completed" || cue.status === "skipped") && "opacity-70",
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
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
