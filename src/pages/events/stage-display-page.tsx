import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  ExpandIcon,
  FlameIcon,
  ForwardIcon,
  LayoutGridIcon,
  Maximize2Icon,
  Minimize2Icon,
  PauseIcon,
  PlayIcon,
  RadioIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  SkipForwardIcon,
  SparklesIcon,
  TimerIcon,
  TvIcon,
  UserIcon,
  Volume2Icon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLiveOpsWs, type LiveOpsEvent } from "@/hooks/use-live-ops-ws"
import {
  advanceCues,
  completeCue,
  getEvent,
  listCues,
  resetCue,
  skipCue,
  startCue,
} from "@/lib/api/agency"
import { cn } from "@/lib/utils"
import type { Cue, Event as AgencyEvent } from "@/types/agency"

type ViewMode = "rundown" | "split" | "timer"

function pad(n: number) {
  return String(Math.floor(Math.abs(n))).padStart(2, "0")
}

function formatDurationSeconds(totalSeconds: number, forceHours = false) {
  const isNegative = totalSeconds < 0
  const abs = Math.abs(totalSeconds)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = Math.floor(abs % 60)

  const prefix = isNegative ? "-" : ""
  if (h > 0 || forceHours) {
    return `${prefix}${pad(h)}:${pad(m)}:${pad(s)}`
  }
  return `${prefix}${pad(m)}:${pad(s)}`
}

function formatClockTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function formatShortTime(iso?: string) {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  } catch {
    return "—"
  }
}

function getDeptColor(deptName?: string, isLiveRow = false) {
  if (isLiveRow) {
    return "bg-white/20 text-white border-white/30"
  }
  const d = String(deptName || "").toLowerCase()
  if (d.includes("audio") || d.includes("sound")) return "bg-blue-500/15 text-blue-400 border-blue-500/30"
  if (d.includes("light")) return "bg-amber-500/15 text-amber-400 border-amber-500/30"
  if (d.includes("video") || d.includes("screen") || d.includes("graphics")) return "bg-purple-500/15 text-purple-400 border-purple-500/30"
  if (d.includes("stage") || d.includes("floor") || d.includes("tech")) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
  if (d.includes("talent") || d.includes("host") || d.includes("speaker")) return "bg-pink-500/15 text-pink-400 border-pink-500/30"
  return "bg-zinc-800/80 text-zinc-300 border-zinc-700/60"
}

export function StageDisplayPage() {
  const { eventId = "" } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<AgencyEvent | null>(null)
  const [cues, setCues] = useState<Cue[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("rundown")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [now, setNow] = useState<Date>(new Date())
  const [autoScroll, setAutoScroll] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)

  const activeCueRef = useRef<HTMLDivElement | null>(null)
  const rundownScrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Reload cues & event details
  const loadData = useCallback(async () => {
    if (!eventId) return
    try {
      const [evRes, cuesRes] = await Promise.all([
        getEvent(eventId).catch(() => ({ data: null })),
        listCues(eventId).catch(() => ({ data: [] })),
      ])
      if (evRes?.data) setEvent(evRes.data)
      if (cuesRes?.data) setCues(cuesRes.data)
    } catch (err) {
      console.warn("Failed loading stage display data:", err)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Real-time live clock ticker (every 500ms)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 500)
    return () => clearInterval(timer)
  }, [])

  // Handle WebSocket live-sync
  const handleWsEvent = useCallback(
    (wsEvent: LiveOpsEvent) => {
      if (!wsEvent || !wsEvent.type) return

      if (
        [
          "CUE_STARTED",
          "CUE_ADVANCED",
          "CUE_COMPLETED",
          "CUE_UPDATED",
          "CUE_CREATED",
          "CUE_DELETED",
          "CUE_RESET",
          "CUE_SKIPPED",
        ].includes(wsEvent.type)
      ) {
        void loadData()
      }
    },
    [loadData],
  )

  const { isConnected } = useLiveOpsWs({
    eventId,
    onEvent: handleWsEvent,
    enabled: Boolean(eventId),
  })

  // Sorted cues by scheduled time or sequence
  const sortedCues = useMemo(() => {
    return [...cues].sort((a, b) => {
      const timeA = new Date(a.scheduledTime || 0).getTime()
      const timeB = new Date(b.scheduledTime || 0).getTime()
      if (timeA !== timeB) return timeA - timeB
      return (Number((a as any).sequence) || 0) - (Number((b as any).sequence) || 0)
    })
  }, [cues])

  // Identify Live Cue, Next Cue, and Completed Count
  const liveCue = useMemo(
    () => sortedCues.find((c) => String(c.status).toLowerCase() === "in_progress"),
    [sortedCues],
  )

  const liveCueIndex = useMemo(() => {
    if (!liveCue) return -1
    return sortedCues.findIndex((c) => (c.cueId || c.id) === (liveCue.cueId || liveCue.id))
  }, [sortedCues, liveCue])

  const nextCue = useMemo(() => {
    if (!liveCue) {
      return sortedCues.find((c) => String(c.status).toLowerCase() === "pending") || null
    }
    return sortedCues.slice(liveCueIndex + 1).find((c) => String(c.status).toLowerCase() === "pending") || null
  }, [sortedCues, liveCue, liveCueIndex])

  const completedCuesCount = useMemo(
    () => sortedCues.filter((c) => String(c.status).toLowerCase() === "completed").length,
    [sortedCues],
  )

  // Timing metrics for active segment
  const activeSegmentMetrics = useMemo(() => {
    if (!liveCue) return null

    const durationMinutes = Math.max(1, Number(liveCue.duration) || 5)
    const totalDurationSeconds = durationMinutes * 60

    let elapsedSeconds = 0
    if (liveCue.actualStartTime) {
      const startMs = new Date(liveCue.actualStartTime).getTime()
      if (!isNaN(startMs)) {
        elapsedSeconds = Math.max(0, (now.getTime() - startMs) / 1000)
      }
    } else if (liveCue.scheduledTime) {
      const schedMs = new Date(liveCue.scheduledTime).getTime()
      const diffMs = now.getTime() - schedMs
      if (!isNaN(schedMs) && diffMs >= 0 && diffMs < 12 * 3600 * 1000) {
        elapsedSeconds = diffMs / 1000
      }
    }

    if (elapsedSeconds > 86400) {
      elapsedSeconds = 0
    }

    const remainingSeconds = totalDurationSeconds - elapsedSeconds
    const isOvertime = remainingSeconds < 0
    const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalDurationSeconds) * 100))

    return {
      totalDurationSeconds,
      elapsedSeconds,
      remainingSeconds,
      isOvertime,
      progressPercent,
    }
  }, [liveCue, now])

  // Overall Show Timeline Metrics for Rundown Scrubber
  const showTimelineMetrics = useMemo(() => {
    if (sortedCues.length === 0) return { percent: 0, totalDurationMin: 0, elapsedMin: 0 }

    const totalDurationMin = sortedCues.reduce((sum, c) => sum + (Number(c.duration) || 5), 0)
    const completedMin = sortedCues
      .filter((c) => String(c.status).toLowerCase() === "completed")
      .reduce((sum, c) => sum + (Number(c.duration) || 5), 0)

    const activeMin = activeSegmentMetrics
      ? Math.min(Number(liveCue?.duration || 5), activeSegmentMetrics.elapsedSeconds / 60)
      : 0

    const currentElapsedMin = completedMin + activeMin
    const percent = totalDurationMin > 0 ? Math.min(100, Math.max(0, (currentElapsedMin / totalDurationMin) * 100)) : 0

    return {
      percent,
      totalDurationMin,
      elapsedMin: Math.round(currentElapsedMin),
    }
  }, [sortedCues, liveCue, activeSegmentMetrics])

  // Schedule Drift calculation
  const showDrift = useMemo(() => {
    if (!liveCue && !nextCue) return null
    const refCue = liveCue || nextCue
    if (!refCue?.scheduledTime) return null

    const scheduledDate = new Date(refCue.scheduledTime).getTime()
    const targetDate = refCue.actualStartTime
      ? new Date(refCue.actualStartTime).getTime()
      : now.getTime()

    if (isNaN(scheduledDate) || isNaN(targetDate)) return null

    const diffMinutes = Math.round((targetDate - scheduledDate) / 60000)
    if (Math.abs(diffMinutes) > 720) return null

    return {
      minutes: Math.abs(diffMinutes),
      isBehind: diffMinutes > 1,
      isAhead: diffMinutes < -1,
      isOnTime: Math.abs(diffMinutes) <= 1,
      rawMinutes: diffMinutes,
    }
  }, [liveCue, nextCue, now])

  // Auto-scroll rundown to active cue
  useEffect(() => {
    if (autoScroll && activeCueRef.current && rundownScrollContainerRef.current) {
      activeCueRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }, [liveCue, autoScroll])

  // Handlers with (eventId, cueId) signature
  const handleAdvance = useCallback(async () => {
    if (!eventId || actionBusy) return
    setActionBusy(true)
    try {
      await advanceCues(eventId)
      toast.success("Advanced to next cue")
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || "Failed to advance cue")
    } finally {
      setActionBusy(false)
    }
  }, [eventId, actionBusy, loadData])

  const handleStartCue = useCallback(
    async (cue: Cue) => {
      const cueId = cue.cueId || cue.id
      if (!eventId || !cueId || actionBusy) return
      setActionBusy(true)
      try {
        await startCue(eventId, cueId)
        toast.success(`Live: ${cue.name || cue.title}`)
        await loadData()
      } catch (err: any) {
        toast.error(err?.message || "Failed to start cue")
      } finally {
        setActionBusy(false)
      }
    },
    [eventId, actionBusy, loadData],
  )

  const handleCompleteLive = useCallback(async () => {
    const cueId = liveCue?.cueId || liveCue?.id
    if (!eventId || !cueId || actionBusy) return
    setActionBusy(true)
    try {
      await completeCue(eventId, cueId)
      toast.success(`Completed: ${liveCue?.name || liveCue?.title}`)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete cue")
    } finally {
      setActionBusy(false)
    }
  }, [eventId, liveCue, actionBusy, loadData])

  const handleResetLive = useCallback(async () => {
    const cueId = liveCue?.cueId || liveCue?.id
    if (!eventId || !cueId || actionBusy) return
    setActionBusy(true)
    try {
      await resetCue(eventId, cueId)
      toast.info(`Reset: ${liveCue?.name || liveCue?.title}`)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset cue")
    } finally {
      setActionBusy(false)
    }
  }, [eventId, liveCue, actionBusy, loadData])

  const handleSkipCue = useCallback(
    async (cue: Cue) => {
      const cueId = cue.cueId || cue.id
      if (!eventId || !cueId || actionBusy) return
      setActionBusy(true)
      try {
        await skipCue(eventId, cueId)
        toast.info(`Skipped: ${cue.name || cue.title}`)
        await loadData()
      } catch (err: any) {
        toast.error(err?.message || "Failed to skip cue")
      } finally {
        setActionBusy(false)
      }
    },
    [eventId, actionBusy, loadData],
  )

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener("fullscreenchange", onFsChange)
    return () => document.removeEventListener("fullscreenchange", onFsChange)
  }, [])

  // Keyboard Hotkeys
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.code === "Space") {
        e.preventDefault()
        void handleAdvance()
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault()
        if (liveCue) void handleCompleteLive()
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault()
        if (liveCue) void handleResetLive()
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === "1") {
        setViewMode("rundown")
      } else if (e.key === "2") {
        setViewMode("split")
      } else if (e.key === "3") {
        setViewMode("timer")
      } else if (e.key === "Escape" && !document.fullscreenElement) {
        navigate(`/events/${eventId || ""}`)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleAdvance, handleCompleteLive, handleResetLive, toggleFullscreen, liveCue, eventId, navigate])

  // Group cues by section / phase
  const cueGroups = useMemo(() => {
    const groups: { name: string; items: { cue: Cue; globalIndex: number }[] }[] = []
    let currentGroup = { name: "Run of Show", items: [] as { cue: Cue; globalIndex: number }[] }

    sortedCues.forEach((cue, index) => {
      const section = (cue as any).category || (cue as any).section || (cue as any).phase
      if (section && section !== currentGroup.name && currentGroup.items.length > 0) {
        groups.push(currentGroup)
        currentGroup = { name: section, items: [] }
      } else if (section && currentGroup.items.length === 0) {
        currentGroup.name = section
      }
      currentGroup.items.push({ cue, globalIndex: index })
    })

    if (currentGroup.items.length > 0) {
      groups.push(currentGroup)
    }

    return groups.length > 0 ? groups : [{ name: "Run of Show", items: sortedCues.map((c, i) => ({ cue: c, globalIndex: i })) }]
  }, [sortedCues])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#08090c] font-sans text-zinc-100 antialiased select-none overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-36 bg-gradient-to-b from-blue-500/5 via-rose-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* ============================================================ */}
      {/* TOP NAVIGATION & TELEMETRY HEADER                            */}
      {/* ============================================================ */}
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#1b1f28] bg-[#0d0f14]/95 px-4 sm:px-6 backdrop-blur-xl">
        {/* Left: Event Identity & Exit Button */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 text-zinc-400 hover:bg-[#181c25] hover:text-zinc-100 rounded-xl transition-all"
            onClick={() => navigate(eventId ? `/events/${eventId}` : "/events")}
            title="Exit Stage View (Esc)"
          >
            <ArrowLeftIcon className="size-4" />
          </Button>

          <div className="flex items-center gap-3 min-w-0">
            <span className="font-extrabold text-sm sm:text-base text-zinc-100 truncate tracking-tight">
              {event?.name || "Stage Operator Display"}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141720] border border-[#232836] text-[11px] shadow-xs">
              <span
                className={cn(
                  "size-2 rounded-full",
                  isConnected ? "bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.9)]" : "bg-red-500",
                )}
              />
              <span className="text-zinc-400 font-mono text-[10px] tracking-wide font-semibold">
                {isConnected ? "LIVE WS" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: BIG BOLD Local Clock & Drift */}
        <div className="hidden md:flex items-center gap-4 font-mono">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#13161f] border border-[#242938] shadow-inner">
            <ClockIcon className="size-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
            <span className="text-zinc-100 font-black text-sm sm:text-base tracking-widest tabular-nums">
              {formatClockTime(now)}
            </span>
          </div>

          {showDrift && (
            <div
              className={cn(
                "px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs",
                showDrift.isOnTime && "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                showDrift.isBehind && "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse",
                showDrift.isAhead && "bg-blue-500/15 text-blue-400 border-blue-500/30",
              )}
            >
              <span>
                {showDrift.isOnTime
                  ? "✓ ON SCHEDULE"
                  : showDrift.isBehind
                    ? `DELAY: +${showDrift.minutes}m`
                    : `AHEAD: -${showDrift.minutes}m`}
              </span>
            </div>
          )}
        </div>

        {/* Right: View Mode Switcher & Fullscreen Action */}
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl bg-[#13161f] p-1 border border-[#242938] shadow-inner">
            <button
              onClick={() => setViewMode("rundown")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "rundown"
                  ? "bg-[#2b3140] text-white shadow-sm ring-1 ring-white/10"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              title="Rundown Studio View (1)"
            >
              Rundown
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "split"
                  ? "bg-[#2b3140] text-white shadow-sm ring-1 ring-white/10"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              title="Operator Split Console (2)"
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode("timer")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "timer"
                  ? "bg-[#2b3140] text-white shadow-sm ring-1 ring-white/10"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
              title="Confidence Stage Timer (3)"
            >
              Big Timer
            </button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 text-zinc-400 hover:bg-[#181c25] hover:text-zinc-100 rounded-xl"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
          >
            {isFullscreen ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
          </Button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* MAIN VIEW AREA                                               */}
      {/* ============================================================ */}
      <main className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-zinc-400 text-xs font-mono">Syncing Stage Rundown...</p>
            </div>
          </div>
        ) : viewMode === "rundown" ? (
          /* ============================================================ */
          /* VIEW MODE 1: RUNDOWN STUDIO PRO (INSPIRED BY RUNDOWNSTUDIO)   */
          /* ============================================================ */
          <div className="h-full flex flex-col p-3 sm:p-5 overflow-hidden max-w-7xl mx-auto w-full">
            {/* Rundown Studio Outer Console Frame */}
            <div className="h-full flex flex-col rounded-2xl border border-[#1f242f] bg-[#0e1015]/90 shadow-2xl backdrop-blur-md overflow-hidden">
              {/* Header Control & Timeline Scrubber Bar with BIGGER CLOCK */}
              <div className="p-4 sm:p-6 border-b border-[#1b1f28] bg-gradient-to-b from-[#13161e]/90 to-[#0e1015]/90 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-mono font-extrabold tracking-widest text-zinc-400 uppercase">
                      {event?.name || "Run of Show"}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                      <span>{sortedCues.length} Total Cues</span>
                      <span>·</span>
                      <span className="text-emerald-400 font-semibold">{completedCuesCount} Completed</span>
                      {liveCue && (
                        <>
                          <span>·</span>
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-rose-500 animate-ping" />
                            1 Cue Live
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5">
                    {/* Big Bold Live Clock Pill with Smooth Glowing Aura */}
                    <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-[#161a24] border border-[#2b3244] shadow-lg shadow-black/40 ring-1 ring-white/5">
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]" />
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                          {activeSegmentMetrics?.isOvertime ? "OVERRUN" : "SEGMENT TIMER"}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-2xl sm:text-3xl lg:text-4xl font-black tabular-nums tracking-tight leading-none",
                            activeSegmentMetrics?.isOvertime
                              ? "text-rose-400 drop-shadow-[0_0_20px_rgba(244,63,94,0.5)]"
                              : "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]",
                          )}
                        >
                          {activeSegmentMetrics
                            ? formatDurationSeconds(activeSegmentMetrics.remainingSeconds)
                            : formatClockTime(now).slice(0, 5)}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="default"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold h-11 px-5 rounded-xl shadow-lg shadow-emerald-950/50 text-sm tracking-wide transition-all active:scale-95"
                      disabled={actionBusy}
                      onClick={handleAdvance}
                    >
                      <ForwardIcon className="size-4 mr-2" />
                      Advance (Space)
                    </Button>
                  </div>
                </div>

                {/* Dual-Tone Gradient Progress Scrubber Track with Glowing Needle */}
                <div className="relative w-full h-3.5 rounded-full bg-[#161922] border border-[#262c3b] overflow-visible shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 transition-all duration-700 ease-out shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                    style={{ width: `${showTimelineMetrics.percent}%` }}
                  />
                  {/* Scrubber Pin / Needle Marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -ml-2.5 size-5 rounded-full bg-rose-500 border-2 border-white shadow-[0_0_12px_rgba(244,63,94,0.9)] transition-all duration-700 ease-out flex items-center justify-center"
                    style={{ left: `${showTimelineMetrics.percent}%` }}
                  >
                    <div className="size-1.5 rounded-full bg-white animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Rundown Rows List */}
              <div
                ref={rundownScrollContainerRef}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth"
              >
                {cueGroups.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-2">
                    {/* Section Header */}
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <span className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400">
                        {group.name}
                      </span>
                      <div className="flex-1 h-px bg-[#1e232e]" />
                    </div>

                    {/* Cue Rows */}
                    <div className="space-y-1.5">
                      {group.items.map(({ cue: c, globalIndex: idx }) => {
                        const isLive = liveCue && (c.cueId || c.id) === (liveCue.cueId || liveCue.id)
                        const isDone = String(c.status).toLowerCase() === "completed"

                        return (
                          <div
                            key={c.cueId || c.id || idx}
                            ref={isLive ? activeCueRef : null}
                            className={cn(
                              "group flex flex-col md:flex-row md:items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all duration-300 gap-2.5 cursor-pointer",
                              isLive
                                ? "bg-[#f43f5e] text-white shadow-xl shadow-rose-950/50 ring-2 ring-rose-400/60 scale-[1.008]"
                                : isDone
                                  ? "bg-[#111319]/70 border border-[#1b1e27] opacity-60 hover:opacity-100"
                                  : "bg-[#14161d] border border-[#1e232e] hover:bg-[#191c25] hover:border-[#282e3d] text-zinc-200",
                            )}
                            onClick={() => !isLive && handleStartCue(c)}
                          >
                            {/* Left Data Pills & Title */}
                            <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap min-w-0">
                              {/* Index Pill */}
                              <div
                                className={cn(
                                  "h-8 min-w-[2.2rem] px-2 rounded-lg flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-xs",
                                  isLive ? "bg-white/20 text-white" : "bg-[#1c202a] text-zinc-400",
                                )}
                              >
                                {idx + 1}
                              </div>

                              {/* Start Time Pill */}
                              <div
                                className={cn(
                                  "h-8 px-2.5 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 tracking-tight shadow-xs",
                                  isLive ? "bg-white/20 text-white" : "bg-[#181b24] text-zinc-300",
                                )}
                              >
                                {formatShortTime(c.scheduledTime)}
                              </div>

                              {/* Duration / Remaining Pill */}
                              <div
                                className={cn(
                                  "h-8 px-3 rounded-lg flex items-center justify-center font-mono font-extrabold text-xs shrink-0 shadow-xs",
                                  isLive
                                    ? "bg-white/25 text-white ring-1 ring-white/20"
                                    : "bg-[#181b24] text-zinc-400",
                                )}
                              >
                                {isLive && activeSegmentMetrics
                                  ? formatDurationSeconds(activeSegmentMetrics.remainingSeconds)
                                  : `${c.duration || 5}m`}
                              </div>

                              {/* Segment Name */}
                              <div className="font-extrabold text-sm sm:text-base truncate min-w-[150px] px-1">
                                {c.name || c.title}
                              </div>

                              {/* Department Badge */}
                              {c.departmentName && (
                                <div
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-mono font-semibold shrink-0 border",
                                    getDeptColor(c.departmentName, isLive),
                                  )}
                                >
                                  [{c.departmentName}]
                                </div>
                              )}

                              {/* Notes / Description */}
                              {c.description && (
                                <div
                                  className={cn(
                                    "text-xs truncate max-w-md hidden xl:block",
                                    isLive ? "text-rose-100 italic" : "text-zinc-400",
                                  )}
                                >
                                  {c.description}
                                </div>
                              )}
                            </div>

                            {/* Right Action Control */}
                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                              {isLive ? (
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-8 bg-white text-rose-600 hover:bg-rose-50 font-black text-xs px-3.5 rounded-lg shadow-md transition-all active:scale-95"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void handleCompleteLive()
                                    }}
                                  >
                                    <CheckCircle2Icon className="size-3.5 mr-1" />
                                    Complete
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-white hover:bg-white/20 text-xs px-2.5 rounded-lg font-semibold"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void handleResetLive()
                                    }}
                                  >
                                    Reset
                                  </Button>
                                </div>
                              ) : isDone ? (
                                <span className="flex items-center gap-1 text-emerald-400 font-mono text-xs font-bold px-2.5 py-1">
                                  <CheckCircle2Icon className="size-3.5" /> Done
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 opacity-0 group-hover:opacity-100 text-xs text-zinc-300 hover:bg-[#232836] rounded-lg transition-opacity font-semibold"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleStartCue(c)
                                  }}
                                >
                                  <PlayIcon className="size-3 mr-1" /> Go Live
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Quick Action Bar */}
              <div className="p-3 border-t border-[#1b1f28] bg-[#0c0d12] flex items-center justify-between text-xs font-mono text-zinc-500">
                <div className="flex items-center gap-3">
                  <span>Hotkeys:</span>
                  <span className="text-zinc-300"><kbd className="px-1.5 py-0.5 rounded bg-[#1b1f28] border border-[#272d3b]">Space</kbd> Advance</span>
                  <span className="text-zinc-300"><kbd className="px-1.5 py-0.5 rounded bg-[#1b1f28] border border-[#272d3b]">P</kbd> Complete</span>
                  <span className="text-zinc-300"><kbd className="px-1.5 py-0.5 rounded bg-[#1b1f28] border border-[#272d3b]">R</kbd> Reset</span>
                  <span className="text-zinc-300"><kbd className="px-1.5 py-0.5 rounded bg-[#1b1f28] border border-[#272d3b]">F</kbd> Fullscreen</span>
                </div>
                <span>View: 1=Rundown · 2=Split · 3=Timer</span>
              </div>
            </div>
          </div>
        ) : viewMode === "timer" ? (
          /* ============================================================ */
          /* VIEW MODE 2: GIANT STAGE TIMER (CONFIDENCE MONITOR)           */
          /* ============================================================ */
          <div className="h-full flex flex-col items-center justify-between p-6 sm:p-12 text-center bg-radial from-[#151924] via-[#0b0c10] to-[#07080b] overflow-hidden">
            {/* Top Active Segment Title */}
            <div className="flex flex-col items-center gap-3 max-w-5xl">
              <div className="flex items-center gap-2.5">
                <Badge
                  className={cn(
                    "px-3.5 py-1 text-sm font-black uppercase tracking-widest border shadow-lg",
                    liveCue
                      ? "bg-rose-500 text-white border-rose-400 animate-pulse shadow-rose-950/60"
                      : "bg-[#1c202a] text-zinc-400 border-zinc-700",
                  )}
                >
                  {liveCue ? "🔴 LIVE ON AIR" : "STANDBY"}
                </Badge>
                {liveCue?.departmentName && (
                  <Badge variant="outline" className={cn("px-3 py-1 text-xs font-bold", getDeptColor(liveCue.departmentName))}>
                    {liveCue.departmentName}
                  </Badge>
                )}
              </div>
              <h2 className="text-3xl sm:text-5xl lg:text-7xl font-black tracking-tight text-zinc-100 drop-shadow-md line-clamp-2">
                {liveCue?.name || liveCue?.title || nextCue?.name || "Standby for Show Call"}
              </h2>
              {liveCue?.location && (
                <p className="text-zinc-400 text-base sm:text-xl font-semibold tracking-wide">
                  📍 {liveCue.location}
                  {liveCue.assignedTo ? ` · Lead: ${liveCue.assignedTo}` : ""}
                </p>
              )}
            </div>

            {/* Giant Center Countdown Timer with Extraordinary Glow */}
            <div className="flex flex-col items-center justify-center my-auto w-full px-4 overflow-hidden">
              <div
                className={cn(
                  "font-mono font-black tabular-nums tracking-tighter leading-none transition-all duration-300 max-w-full truncate select-none",
                  "text-[clamp(4.5rem,15vw,13rem)]",
                  !activeSegmentMetrics && "text-zinc-500",
                  activeSegmentMetrics &&
                    !activeSegmentMetrics.isOvertime &&
                    activeSegmentMetrics.remainingSeconds <= 30 &&
                    "text-amber-400 drop-shadow-[0_0_50px_rgba(251,191,36,0.45)] animate-pulse",
                  activeSegmentMetrics &&
                    !activeSegmentMetrics.isOvertime &&
                    activeSegmentMetrics.remainingSeconds > 30 &&
                    "text-emerald-400 drop-shadow-[0_0_60px_rgba(52,211,153,0.35)]",
                  activeSegmentMetrics &&
                    activeSegmentMetrics.isOvertime &&
                    "text-rose-500 drop-shadow-[0_0_75px_rgba(244,63,94,0.55)] animate-pulse",
                )}
              >
                {activeSegmentMetrics
                  ? formatDurationSeconds(activeSegmentMetrics.remainingSeconds)
                  : nextCue?.duration
                    ? formatDurationSeconds(Number(nextCue.duration) * 60)
                    : "00:00"}
              </div>

              {activeSegmentMetrics?.isOvertime && (
                <Badge
                  variant="secondary"
                  className="mt-4 bg-rose-500/25 text-rose-300 border border-rose-500/40 text-base sm:text-xl font-mono px-5 py-2 uppercase font-black tracking-wider animate-bounce shadow-xl shadow-rose-950/50"
                >
                  ⚠️ TIME OVERRUN (+{formatDurationSeconds(Math.abs(activeSegmentMetrics.remainingSeconds))})
                </Badge>
              )}
            </div>

            {/* Bottom Progress Bar & Next Up Bar */}
            <div className="w-full max-w-4xl flex flex-col gap-4">
              {activeSegmentMetrics && (
                <div className="w-full h-4 rounded-full bg-[#151821] overflow-hidden border border-[#252b3a] shadow-inner">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full shadow-md",
                      activeSegmentMetrics.isOvertime
                        ? "bg-rose-500 shadow-rose-500/50"
                        : activeSegmentMetrics.remainingSeconds <= 30
                          ? "bg-amber-400 shadow-amber-400/50"
                          : "bg-emerald-400 shadow-emerald-400/50",
                    )}
                    style={{ width: `${activeSegmentMetrics.progressPercent}%` }}
                  />
                </div>
              )}

              {nextCue && (
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl border border-[#1f242f] bg-[#11141b]/90 backdrop-blur-md text-sm shadow-xl">
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-zinc-400 uppercase font-mono font-black tracking-wider text-xs">
                      NEXT UP:
                    </span>
                    <span className="font-bold text-zinc-100 truncate text-base">{nextCue.name || nextCue.title}</span>
                    {nextCue.departmentName && (
                      <Badge variant="outline" className={cn("text-xs font-semibold", getDeptColor(nextCue.departmentName))}>
                        {nextCue.departmentName}
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono text-zinc-400 text-xs font-bold shrink-0">
                    ⏱️ {nextCue.duration || 5} min
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* VIEW MODE 3: OPERATOR SPLIT VIEW (DEFAULT BROADCAST CONSOLE) */
          /* ============================================================ */
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1a1e27]">
            {/* Left Column (60%): Focus Cue, Giant Clocks, Director Notes & Controls */}
            <div className="lg:col-span-7 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto">
              <div className="flex flex-col gap-6">
                {/* Active Live Cue Hero Section */}
                <div
                  className={cn(
                    "p-6 sm:p-7 rounded-2xl border transition-all duration-500 relative overflow-hidden backdrop-blur-md shadow-2xl",
                    liveCue
                      ? "bg-gradient-to-br from-[#161922] via-[#12141c] to-rose-950/25 border-rose-500/40 ring-1 ring-rose-500/20"
                      : "bg-[#111319] border-[#1f242f]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          "px-3 py-1 text-xs font-black uppercase tracking-wider border",
                          liveCue
                            ? "bg-rose-500 text-white border-transparent animate-pulse shadow-md shadow-rose-950/60"
                            : "bg-[#1a1d26] text-zinc-400 border-zinc-700",
                        )}
                      >
                        {liveCue ? "🔴 LIVE ON STAGE" : "STANDBY"}
                      </Badge>
                      {liveCue?.departmentName && (
                        <Badge variant="outline" className={cn("text-xs font-bold", getDeptColor(liveCue.departmentName))}>
                          {liveCue.departmentName}
                        </Badge>
                      )}
                    </div>

                    <span className="font-mono text-xs text-zinc-400 font-semibold">
                      Duration: {liveCue?.duration || 5} min
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-100 mb-2">
                    {liveCue?.name || liveCue?.title || nextCue?.name || "Waiting for Show Call"}
                  </h2>

                  {liveCue?.location && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300 font-medium mb-4">
                      <span>📍 {liveCue.location}</span>
                      {liveCue.assignedTo && <span>👤 Host/Talent: {liveCue.assignedTo}</span>}
                    </div>
                  )}

                  {liveCue?.description && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#0a0b0f]/80 border border-[#1d222d] text-sm text-zinc-300 italic font-mono">
                      Director Cue: "{liveCue.description}"
                    </div>
                  )}

                  {/* Countdown Timer Display */}
                  <div className="mt-6 flex flex-col items-center sm:items-start overflow-hidden">
                    <div className="text-xs font-mono font-extrabold uppercase tracking-widest text-zinc-400 mb-1.5">
                      {activeSegmentMetrics?.isOvertime ? "TIME OVERRUN" : "SEGMENT COUNTDOWN"}
                    </div>
                    <div
                      className={cn(
                        "font-mono font-black tabular-nums tracking-tighter leading-none max-w-full truncate select-none",
                        "text-6xl sm:text-8xl lg:text-9xl",
                        !activeSegmentMetrics && "text-zinc-500",
                        activeSegmentMetrics &&
                          !activeSegmentMetrics.isOvertime &&
                          activeSegmentMetrics.remainingSeconds <= 30 &&
                          "text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.4)] animate-pulse",
                        activeSegmentMetrics &&
                          !activeSegmentMetrics.isOvertime &&
                          activeSegmentMetrics.remainingSeconds > 30 &&
                          "text-emerald-400 drop-shadow-[0_0_45px_rgba(52,211,153,0.3)]",
                        activeSegmentMetrics && activeSegmentMetrics.isOvertime && "text-rose-500 drop-shadow-[0_0_55px_rgba(244,63,94,0.5)] animate-pulse",
                      )}
                    >
                      {activeSegmentMetrics
                        ? formatDurationSeconds(activeSegmentMetrics.remainingSeconds)
                        : "00:00"}
                    </div>

                    {/* Progress Bar */}
                    {activeSegmentMetrics && (
                      <div className="w-full mt-4 h-3 rounded-full bg-[#171b24] overflow-hidden border border-[#232836]">
                        <div
                          className={cn(
                            "h-full transition-all duration-300 rounded-full",
                            activeSegmentMetrics.isOvertime
                              ? "bg-rose-500"
                              : activeSegmentMetrics.remainingSeconds <= 30
                                ? "bg-amber-400"
                                : "bg-emerald-400",
                          )}
                          style={{ width: `${activeSegmentMetrics.progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Next Up Cue Preview Card */}
                {nextCue && (
                  <div className="p-4 sm:p-5 rounded-2xl border border-[#1f242f] bg-[#101218]/90 flex items-center justify-between gap-4 shadow-lg">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase font-mono font-extrabold tracking-widest text-zinc-500 mb-0.5">
                        UP NEXT IN QUEUE
                      </div>
                      <div className="font-extrabold text-base text-zinc-100 truncate">
                        {nextCue.name || nextCue.title}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-2 mt-1">
                        {nextCue.departmentName && (
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", getDeptColor(nextCue.departmentName))}>
                            {nextCue.departmentName}
                          </Badge>
                        )}
                        {nextCue.location && <span>📍 {nextCue.location}</span>}
                        {nextCue.assignedTo && <span>👤 {nextCue.assignedTo}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 font-mono">
                      <span className="text-xs text-zinc-400 font-semibold">⏱️ {nextCue.duration || 5} min</span>
                      {nextCue.scheduledTime && (
                        <span className="text-xs font-bold text-zinc-300">
                          {formatShortTime(nextCue.scheduledTime)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Stage Caller Action Controls & Hotkeys Bar */}
              <div className="pt-6 mt-6 border-t border-[#1b1f28]">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base tracking-wide shadow-xl shadow-emerald-950/60 rounded-xl transition-all active:scale-95"
                    disabled={actionBusy}
                    onClick={handleAdvance}
                  >
                    <ForwardIcon className="size-5 mr-2" />
                    ADVANCE CUE (Space)
                  </Button>

                  {liveCue && (
                    <>
                      <Button
                        size="lg"
                        variant="secondary"
                        className="h-14 px-5 bg-[#1a1d26] text-zinc-200 hover:bg-[#252a36] border border-[#262c3b] font-bold rounded-xl"
                        disabled={actionBusy}
                        onClick={handleCompleteLive}
                        title="Mark Current Cue Done (P)"
                      >
                        <CheckCircle2Icon className="size-5 mr-1.5" />
                        Complete (P)
                      </Button>

                      <Button
                        size="lg"
                        variant="ghost"
                        className="h-14 px-4 text-zinc-400 hover:text-zinc-200 hover:bg-[#181c25] rounded-xl font-semibold"
                        disabled={actionBusy}
                        onClick={handleResetLive}
                        title="Reset Current Cue (R)"
                      >
                        <RotateCcwIcon className="size-4 mr-1.5" />
                        Reset
                      </Button>
                    </>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>Hotkeys: Space=Advance · P=Complete · R=Reset · F=Fullscreen</span>
                  <span>1/2/3=View Modes</span>
                </div>
              </div>
            </div>

            {/* Right Column (40%): Live Rundown Feed */}
            <div className="lg:col-span-5 flex flex-col h-full bg-[#0b0c10] p-4 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#1b1f28] text-xs uppercase font-mono font-bold tracking-wider text-zinc-400">
                <span>Rundown Stream ({sortedCues.length})</span>
                <span className="text-[11px] font-normal text-zinc-500">Auto-Scroll Locked</span>
              </div>

              <div
                ref={rundownScrollContainerRef}
                className="flex-1 overflow-y-auto divide-y divide-[#171a22] pr-1 pt-2 space-y-1 scroll-smooth"
              >
                {sortedCues.map((c, idx) => {
                  const isLive = liveCue && (c.cueId || c.id) === (liveCue.cueId || liveCue.id)
                  const isDone = String(c.status).toLowerCase() === "completed"

                  return (
                    <div
                      key={c.cueId || c.id || idx}
                      ref={isLive ? activeCueRef : null}
                      className={cn(
                        "p-3 rounded-xl transition-all cursor-pointer",
                        isLive && "bg-[#f43f5e] text-white shadow-md font-medium ring-1 ring-rose-400/50",
                        isDone && "opacity-50 hover:opacity-80 bg-[#111319]",
                        !isLive && !isDone && "hover:bg-[#151820] border border-transparent",
                      )}
                      onClick={() => !isLive && handleStartCue(c)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("font-mono text-xs font-bold", isLive ? "text-white" : "text-zinc-400")}>
                              #{idx + 1}
                            </span>
                            <span
                              className={cn(
                                "font-bold text-sm truncate",
                                isLive ? "text-white" : isDone ? "text-zinc-400" : "text-zinc-200",
                              )}
                            >
                              {c.name || c.title}
                            </span>
                          </div>
                          <div className={cn("text-[11px] flex items-center gap-2 mt-1", isLive ? "text-rose-100" : "text-zinc-400")}>
                            {c.departmentName && (
                              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 font-semibold", getDeptColor(c.departmentName, isLive))}>
                                {c.departmentName}
                              </Badge>
                            )}
                            {c.scheduledTime && <span>{formatShortTime(c.scheduledTime)}</span>}
                            <span>{c.duration || 5}m</span>
                          </div>
                        </div>

                        {isLive ? (
                          <Badge className="bg-white text-rose-600 font-mono text-[9px] uppercase font-black">
                            LIVE
                          </Badge>
                        ) : isDone ? (
                          <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
