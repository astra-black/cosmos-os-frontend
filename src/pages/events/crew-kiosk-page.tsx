import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CameraIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClockIcon,
  FilterIcon,
  KeyRoundIcon,
  LayersIcon,
  LockIcon,
  LogInIcon,
  LogOutIcon,
  Maximize2Icon,
  Minimize2Icon,
  QrCodeIcon,
  RadioIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UnlockIcon,
  UserCheckIcon,
  UserIcon,
  UsersIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useLiveOpsWs, type LiveOpsEvent } from "@/hooks/use-live-ops-ws"
import {
  checkInCrew,
  checkOutCrew,
  getEvent,
  getKioskData,
  kioskCheckInCrew,
  kioskCheckOutCrew,
  listCrew,
  listDepartments,
} from "@/lib/api/agency"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import type { CrewMember, Department, Event as AgencyEvent } from "@/types/agency"

type StatusFilter = "all" | "pending" | "on_site" | "complete"

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

function getDeptColor(deptName?: string) {
  const d = String(deptName || "").toLowerCase()
  if (d.includes("audio") || d.includes("sound")) return "border-blue-500/40 text-blue-400 bg-blue-500/10"
  if (d.includes("light")) return "border-amber-500/40 text-amber-400 bg-amber-500/10"
  if (d.includes("video") || d.includes("screen") || d.includes("graphics")) return "border-purple-500/40 text-purple-400 bg-purple-500/10"
  if (d.includes("stage") || d.includes("deck") || d.includes("floor") || d.includes("tech")) return "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
  if (d.includes("talent") || d.includes("host") || d.includes("camera")) return "border-pink-500/40 text-pink-400 bg-pink-500/10"
  return "border-zinc-700/80 text-zinc-300 bg-zinc-800/80"
}

export function CrewKioskPage() {
  const { eventId = "" } = useParams<{ eventId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  const urlPin = searchParams.get("pin") || ""
  const [activePin, setActivePin] = useState<string>(() => {
    if (urlPin) return urlPin
    return typeof window !== "undefined" ? sessionStorage.getItem(`kiosk_pin_${eventId}`) || "" : ""
  })

  const [isPinLocked, setIsPinLocked] = useState<boolean>(!isAuthenticated && !urlPin && !sessionStorage.getItem(`kiosk_pin_${eventId}`))
  const [pinInput, setPinInput] = useState<string>("")
  const [pinError, setPinError] = useState<string | null>(null)
  const [pinValidating, setPinValidating] = useState<boolean>(false)
  const [isStaff, setIsStaff] = useState<boolean>(isAuthenticated)

  const [event, setEvent] = useState<AgencyEvent | null>(null)
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all")
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [recentCheckedMember, setRecentCheckedMember] = useState<{
    member: CrewMember
    action: "checkin" | "checkout"
  } | null>(null)

  // Live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Audio beep feedback simulator
  const playFeedbackSound = useCallback((action: "checkin" | "checkout" | "error") => {
    if (!soundEnabled || typeof window === "undefined") return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      if (action === "checkin") {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.25)
      } else if (action === "checkout") {
        osc.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.1) // C5
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.25)
      } else {
        osc.frequency.setValueAtTime(300, ctx.currentTime) // Low buzz
        osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1)
        gain.gain.setValueAtTime(0.2, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.3)
      }
    } catch (_) {}
  }, [soundEnabled])

  // Load initial data (supports PIN or authenticated session)
  const loadData = useCallback(async (pinToUse?: string) => {
    if (!eventId) return
    setLoading(true)
    const pin = pinToUse !== undefined ? pinToUse : activePin

    try {
      const kioskRes = await getKioskData(eventId, pin || undefined)
      if (kioskRes.requiresPin) {
        setIsPinLocked(true)
        if (kioskRes.eventName) {
          setEvent((prev) => ({
            ...(prev || {}),
            id: eventId,
            eventId,
            name: kioskRes.eventName || "Live Event Roster",
            venue: kioskRes.venue || "Production Stage",
            startDate: kioskRes.startDate || "",
            status: "live",
            type: "production",
          } as any))
        }
        return
      }

      if (kioskRes.data) {
        setEvent(kioskRes.data.event as any)
        setCrew(kioskRes.data.crew)
        setDepartments(kioskRes.data.departments)
        setIsStaff(kioskRes.data.isStaff)
        setIsPinLocked(false)
        if (pin) {
          setActivePin(pin)
          sessionStorage.setItem(`kiosk_pin_${eventId}`, pin)
        }
      }
    } catch (err: any) {
      console.warn("Error loading crew kiosk data:", err)
      if (err?.status === 401 || err?.message?.includes("PIN")) {
        setIsPinLocked(true)
      } else {
        // Fallback to legacy endpoints if available
        try {
          const [evRes, crewRes, deptRes] = await Promise.all([
            getEvent(eventId).catch(() => ({ data: null })),
            listCrew(eventId).catch(() => ({ data: [] })),
            listDepartments(eventId).catch(() => ({ data: [] })),
          ])
          if (evRes?.data) setEvent(evRes.data)
          if (crewRes?.data) setCrew(crewRes.data)
          if (deptRes?.data) setDepartments(deptRes.data)
          setIsPinLocked(false)
        } catch (_) {
          setIsPinLocked(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [eventId, activePin])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // PIN Verification handler
  const handleVerifyPin = async (enteredPin: string) => {
    if (!enteredPin || enteredPin.length < 4 || pinValidating || !eventId) return
    setPinValidating(true)
    setPinError(null)

    try {
      const res = await getKioskData(eventId, enteredPin)
      if (res.requiresPin || !res.success) {
        setPinError("Incorrect Event PIN. Please check with the stage manager.")
        setPinInput("")
        playFeedbackSound("error")
        return
      }

      if (res.data) {
        setEvent(res.data.event as any)
        setCrew(res.data.crew)
        setDepartments(res.data.departments)
        setIsStaff(res.data.isStaff)
        setActivePin(enteredPin)
        sessionStorage.setItem(`kiosk_pin_${eventId}`, enteredPin)
        setIsPinLocked(false)
        setPinInput("")
        playFeedbackSound("checkin")
        toast.success("Kiosk Unlocked", { icon: "🔓" })
      }
    } catch (err: any) {
      setPinError(err?.message || "Invalid Event PIN")
      setPinInput("")
      playFeedbackSound("error")
    } finally {
      setPinValidating(false)
    }
  }

  const handlePinDigit = (digit: string) => {
    if (pinValidating) return
    setPinError(null)
    if (pinInput.length < 4) {
      const next = pinInput + digit
      setPinInput(next)
      if (next.length === 4) {
        void handleVerifyPin(next)
      }
    }
  }

  const handlePinBackspace = () => {
    if (pinValidating) return
    setPinInput((prev) => prev.slice(0, -1))
    setPinError(null)
  }

  const handlePinClear = () => {
    if (pinValidating) return
    setPinInput("")
    setPinError(null)
  }

  const handleLockKiosk = () => {
    sessionStorage.removeItem(`kiosk_pin_${eventId}`)
    setActivePin("")
    setPinInput("")
    setIsPinLocked(true)
    toast.info("Kiosk is now locked")
  }

  // Keyboard navigation when PIN pad is active
  useEffect(() => {
    if (!isPinLocked) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handlePinDigit(e.key)
      } else if (e.key === "Backspace") {
        handlePinBackspace()
      } else if (e.key === "Escape" || e.key === "c" || e.key === "C") {
        handlePinClear()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isPinLocked, pinInput, pinValidating])

  // Real-time live sync
  const handleWsEvent = useCallback(
    (wsEvent: LiveOpsEvent) => {
      if (!wsEvent || !wsEvent.type) return

      if (wsEvent.type === "CREW_CHECKED_IN") {
        const updated = wsEvent.data
        if (updated?.crewId || updated?.id) {
          const id = updated.crewId || updated.id
          setCrew((prev) =>
            prev.map((c) => (c.crewId === id || c.id === id ? { ...c, ...updated, status: "on_site" } : c)),
          )
          toast.success(`Check-In: ${updated.name || "Crew member"} is now on site`, {
            icon: "✅",
          })
        }
      } else if (wsEvent.type === "CREW_CHECKED_OUT") {
        const updated = wsEvent.data?.crew || wsEvent.data
        if (updated?.crewId || updated?.id) {
          const id = updated.crewId || updated.id
          setCrew((prev) =>
            prev.map((c) => (c.crewId === id || c.id === id ? { ...c, ...updated, status: "complete" } : c)),
          )
          toast.info(`Check-Out: ${updated.name || "Crew member"} completed shift`, {
            icon: "🏁",
          })
        }
      }
    },
    [],
  )

  const { isConnected } = useLiveOpsWs({
    eventId,
    onEvent: handleWsEvent,
  })

  // Check In Handler (supports both authenticated staff and PIN-gated kiosk)
  const handleCheckIn = async (member: CrewMember) => {
    const id = member.crewId || member.id
    if (!id || !eventId) return

    setActionBusyId(id)
    try {
      let updated: any
      if (activePin) {
        const res = await kioskCheckInCrew(eventId, id, activePin)
        updated = (res as any)?.data || res
      } else {
        const res = await checkInCrew(eventId, id)
        updated = (res as any)?.data || res
      }

      setCrew((prev) =>
        prev.map((c) =>
          (c.crewId === id || c.id === id)
            ? { ...c, ...(updated || {}), status: "on_site", onSiteAt: updated?.onSiteAt || new Date().toISOString() }
            : c,
        ),
      )
      playFeedbackSound("checkin")
      setRecentCheckedMember({ member: { ...member, ...(updated || {}) }, action: "checkin" })
      toast.success(`${member.name} checked in successfully!`)
    } catch (err: any) {
      toast.error(err.message || "Failed to check in crew member")
    } finally {
      setActionBusyId(null)
    }
  }

  // Check Out Handler
  const handleCheckOut = async (member: CrewMember) => {
    const id = member.crewId || member.id
    if (!id || !eventId) return

    setActionBusyId(id)
    try {
      let updated: any
      if (activePin) {
        const res = await kioskCheckOutCrew(eventId, id, activePin)
        updated = (res as any)?.data || res
      } else {
        const res = await checkOutCrew(eventId, id)
        updated = (res as any)?.data || res
      }

      setCrew((prev) =>
        prev.map((c) =>
          (c.crewId === id || c.id === id)
            ? { ...c, ...(updated || {}), status: "complete", completedAt: updated?.completedAt || new Date().toISOString() }
            : c,
        ),
      )
      playFeedbackSound("checkout")
      setRecentCheckedMember({ member: { ...member, ...(updated || {}) }, action: "checkout" })
      toast.success(`${member.name} checked out! Logged duration saved.`)
    } catch (err: any) {
      toast.error(err.message || "Failed to check out crew member")
    } finally {
      setActionBusyId(null)
    }
  }

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Department headcount calculations
  const deptStats = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; total: number; onSite: number; completed: number; pending: number }
    >()

    // Initialize with known departments
    for (const d of departments) {
      const key = d.departmentId || d.id || ""
      if (!key) continue
      map.set(key, {
        id: key,
        name: d.name,
        total: 0,
        onSite: 0,
        completed: 0,
        pending: 0,
      })
    }

    // Populate from crew roster
    for (const c of crew) {
      const deptKey = c.departmentId || "general"
      const deptName = c.departmentName || (c.departmentId ? departments.find((d) => (d.departmentId || d.id) === c.departmentId)?.name : "General") || "General"

      if (!map.has(deptKey)) {
        map.set(deptKey, {
          id: deptKey,
          name: deptName,
          total: 0,
          onSite: 0,
          completed: 0,
          pending: 0,
        })
      }

      const entry = map.get(deptKey)!
      entry.total++
      if (c.status === "on_site") {
        entry.onSite++
      } else if (c.status === "complete") {
        entry.completed++
      } else {
        entry.pending++
      }
    }

    return Array.from(map.values()).filter((d) => d.total > 0)
  }, [crew, departments])

  // Total counts
  const totalCount = crew.length
  const onSiteCount = crew.filter((c) => c.status === "on_site").length
  const completedCount = crew.filter((c) => c.status === "complete").length
  const pendingCount = totalCount - onSiteCount - completedCount
  const onSitePct = totalCount > 0 ? Math.round((onSiteCount / totalCount) * 100) : 0

  // Filtered crew members
  const filteredCrew = useMemo(() => {
    return crew.filter((m) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const nameMatch = m.name?.toLowerCase().includes(q)
        const roleMatch = m.role?.toLowerCase().includes(q)
        const deptMatch = m.departmentName?.toLowerCase().includes(q)
        if (!nameMatch && !roleMatch && !deptMatch) return false
      }

      // Department
      if (selectedDeptId !== "all") {
        if (m.departmentId !== selectedDeptId && m.departmentName?.toLowerCase() !== selectedDeptId.toLowerCase()) {
          return false
        }
      }

      // Status
      if (statusFilter === "pending") {
        return m.status !== "on_site" && m.status !== "complete"
      }
      if (statusFilter === "on_site") {
        return m.status === "on_site"
      }
      if (statusFilter === "complete") {
        return m.status === "complete"
      }

      return true
    })
  }, [crew, searchQuery, selectedDeptId, statusFilter])

  // 0. Locked PIN Pad Screen
  if (isPinLocked) {
    return (
      <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none font-sans">
        {/* Ambient neon backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-black pointer-events-none" />
        <div className="absolute -top-40 -left-40 size-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 size-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md flex flex-col items-center space-y-6">
          {/* Brand & Event Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-xl shadow-emerald-950/50 mb-1">
              <LockIcon className="size-7 animate-pulse" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                Live Check-in Kiosk
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {event?.name || "Event Check-In"}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xs mx-auto">
              {event?.venue || event?.location || "Main Production Venue"} · Enter 4-digit Event PIN to access roster
            </p>
          </div>

          {/* PIN Digit Indicators */}
          <div className="flex items-center gap-4 py-2">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pinInput.length > idx
              return (
                <div
                  key={idx}
                  className={cn(
                    "size-12 sm:size-14 rounded-xl border-2 flex items-center justify-center transition-all duration-200 text-2xl font-black font-mono",
                    isFilled
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/20 scale-105"
                      : "border-zinc-800 bg-zinc-900/80 text-zinc-600",
                    pinError && "border-destructive text-destructive"
                  )}
                >
                  {isFilled ? "●" : "○"}
                </div>
              )
            })}
          </div>

          {/* Error Message or Default Hint */}
          {pinError ? (
            <div className="flex items-center gap-1.5 text-xs text-destructive font-semibold bg-destructive/10 border border-destructive/30 px-3.5 py-2 rounded-lg text-center">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{pinError}</span>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 text-center font-mono">
              Default event PIN is <span className="text-zinc-300 font-bold">1234</span> unless customized
            </div>
          )}

          {/* Touch Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <Button
                key={digit}
                type="button"
                variant="outline"
                onClick={() => handlePinDigit(digit)}
                disabled={pinValidating}
                className="h-14 text-2xl font-black font-mono bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-white rounded-xl active:scale-95 transition-all shadow-md"
              >
                {digit}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={handlePinClear}
              disabled={pinValidating || pinInput.length === 0}
              className="h-14 text-xs font-bold uppercase tracking-wider bg-zinc-900/60 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-400 rounded-xl active:scale-95 transition-all"
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handlePinDigit("0")}
              disabled={pinValidating}
              className="h-14 text-2xl font-black font-mono bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-white rounded-xl active:scale-95 transition-all shadow-md"
            >
              0
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handlePinBackspace}
              disabled={pinValidating || pinInput.length === 0}
              className="h-14 text-sm font-bold bg-zinc-900/60 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700 text-zinc-400 rounded-xl active:scale-95 transition-all"
            >
              ⌫
            </Button>
          </div>

          {/* Footer Navigation */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-400 pt-2">
            <Link
              to={`/login?redirect=/events/${eventId}/checkin`}
              className="hover:text-emerald-400 underline underline-offset-4 transition-colors"
            >
              Agency Staff Login
            </Link>
            <span>•</span>
            <Link
              to={`/events/${eventId}`}
              className="hover:text-zinc-200 transition-colors"
            >
              Back to Event Hub
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col select-none font-sans">
      {/* 1. Kiosk High-Contrast Header Bar */}
      <header className="sticky top-0 z-30 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 px-4 sm:px-6 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Back & Event Info */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/events/${eventId}`)}
              className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white h-10 px-3 gap-1.5 shrink-0"
            >
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline font-semibold">Event Hub</span>
            </Button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Crew Kiosk
                </span>
                <h1 className="font-extrabold text-base sm:text-xl tracking-tight text-white truncate">
                  {event?.name || "Live Event Roster"}
                </h1>
              </div>
              <div className="text-xs text-zinc-400 flex items-center gap-2 truncate mt-0.5">
                <span>{event?.venue || event?.location || "Main Stage & Production"}</span>
                <span>•</span>
                <span className="font-mono text-zinc-300">
                  {crew.length} Rostered Call Staff
                </span>
              </div>
            </div>
          </div>

          {/* Right: Live Clock, WS indicator & Action Controls */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Live Real-Time Clock */}
            <div className="flex items-center gap-2 bg-zinc-950/80 border border-zinc-800 px-3 py-1.5 rounded-lg text-right">
              <ClockIcon className="size-4 text-emerald-400 animate-pulse hidden sm:inline" />
              <div className="font-mono font-black text-lg sm:text-2xl text-emerald-400 tracking-wider">
                {formatClockTime(now)}
              </div>
            </div>

            {/* Badge Scanner Modal Button */}
            <Button
              onClick={() => setScannerOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 px-3.5 gap-2 shadow-lg shadow-emerald-950/50"
            >
              <QrCodeIcon className="size-4" />
              <span className="hidden md:inline">Scan Badge / QR</span>
            </Button>

            {/* Lock Kiosk Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLockKiosk}
              title="Lock Kiosk Desk"
              className="h-10 px-3 border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 gap-1.5 hidden sm:flex"
            >
              <LockIcon className="size-3.5 text-zinc-400" />
              <span className="text-xs font-semibold">Lock</span>
            </Button>

            {/* Audio Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute audio feedback" : "Enable audio feedback"}
              className={cn(
                "h-10 w-10 border-zinc-700 bg-zinc-800 text-zinc-300",
                soundEnabled && "text-emerald-400 border-emerald-500/30",
              )}
            >
              {soundEnabled ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4 text-zinc-500" />}
            </Button>

            {/* Fullscreen Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="h-10 w-10 border-zinc-700 bg-zinc-800 text-zinc-300 hidden sm:flex"
            >
              {isFullscreen ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
            </Button>

            {/* WS Status Pill */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold",
                isConnected
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400",
              )}
            >
              <RadioIcon className={cn("size-3", isConnected && "animate-pulse")} />
              <span className="hidden lg:inline">{isConnected ? "Live Sync" : "Reconnecting"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Kiosk Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">
        {/* 2. Headcount & Department Status Overview Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Headcount Card */}
          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Call Roster</span>
              <UsersIcon className="size-4 text-zinc-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-4xl font-black text-white">{totalCount}</span>
              <span className="text-xs text-zinc-400">crews</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Shift scheduled for today
            </div>
          </Card>

          {/* On-Site Active Card */}
          <Card className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/30 border-emerald-500/30 p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">On Site Now</span>
              <div className="size-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-4xl font-black text-emerald-400">{onSiteCount}</span>
              <span className="text-xs text-emerald-300 font-bold">/ {totalCount} ({onSitePct}%)</span>
            </div>
            <Progress value={onSitePct} className="h-1.5 mt-2 [&>div]:bg-emerald-500" />
          </Card>

          {/* Pending Check-in Card */}
          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pending Check-In</span>
              <LogInIcon className="size-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-4xl font-black text-amber-400">{pendingCount}</span>
              <span className="text-xs text-zinc-400">awaiting</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Expected at venue
            </div>
          </Card>

          {/* Completed Shifts Card */}
          <Card className="bg-zinc-900 border-zinc-800 p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Completed Shifts</span>
              <CheckCircle2Icon className="size-4 text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-4xl font-black text-blue-400">{completedCount}</span>
              <span className="text-xs text-zinc-400">logged</span>
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Hours reconciled
            </div>
          </Card>
        </section>

        {/* 3. Department Breakdown Strip */}
        <section className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LayersIcon className="size-4 text-zinc-400" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-300">
                Department Headcount Breakdown
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              {deptStats.length} Active Departments
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {deptStats.map((dept) => {
              const isSelected = selectedDeptId === dept.id || selectedDeptId === dept.name
              const pct = dept.total > 0 ? Math.round((dept.onSite / dept.total) * 100) : 0
              const isFull = dept.onSite === dept.total

              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDeptId(isSelected ? "all" : dept.id)}
                  className={cn(
                    "text-left p-3 rounded-lg border transition-all duration-150 flex flex-col justify-between",
                    isSelected
                      ? "bg-zinc-800 border-emerald-500 shadow-md ring-1 ring-emerald-500/50"
                      : "bg-zinc-950/60 border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700",
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-zinc-200 truncate">{dept.name}</span>
                    {isFull && (
                      <span className="size-1.5 rounded-full bg-emerald-400" title="All checked in" />
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-base font-black tabular-nums text-white">
                      {dept.onSite}
                      <span className="text-xs font-normal text-zinc-400">/{dept.total}</span>
                    </span>
                    <span className={cn("text-[10px] font-bold", isFull ? "text-emerald-400" : "text-zinc-400")}>
                      {pct}%
                    </span>
                  </div>
                  <Progress value={pct} className="h-1 mt-1.5 [&>div]:bg-emerald-500" />
                </button>
              )
            })}
          </div>
        </section>

        {/* 4. Search & Filter Bar */}
        <section className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search crew name, role, department..."
              className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 pl-10 pr-9 h-12 text-base font-medium rounded-xl focus-visible:ring-emerald-500"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200"
              >
                <XIcon className="size-4" />
              </button>
            ) : null}
          </div>

          {/* Quick Filter Segmented Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
            {(
              [
                { id: "all", label: "All Crew", count: totalCount },
                { id: "pending", label: "Pending Check-In", count: pendingCount },
                { id: "on_site", label: "On Site", count: onSiteCount },
                { id: "complete", label: "Completed", count: completedCount },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5",
                    active
                      ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850",
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded text-[10px] font-mono",
                      active ? "bg-zinc-700 text-white" : "bg-zinc-950 text-zinc-500",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 5. Crew Member Touch Cards Grid */}
        <section className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl bg-zinc-900" />
              ))}
            </div>
          ) : filteredCrew.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/40 rounded-2xl border border-dashed border-zinc-800 text-center">
              <UserIcon className="size-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-bold text-zinc-300">No Crew Members Found</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                {searchQuery || statusFilter !== "all" || selectedDeptId !== "all"
                  ? "No crew match the current search or filters. Try clearing filters."
                  : "No crew have been assigned to this event yet."}
              </p>
              {(searchQuery || statusFilter !== "all" || selectedDeptId !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("")
                    setStatusFilter("all")
                    setSelectedDeptId("all")
                  }}
                  className="mt-4 border-zinc-700 bg-zinc-800 text-zinc-200"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredCrew.map((member) => {
                const id = member.crewId || member.id
                const isBusy = actionBusyId === id
                const isOnSite = member.status === "on_site"
                const isComplete = member.status === "complete"
                const isPending = !isOnSite && !isComplete

                // Compute duration if on site
                let durationText = ""
                if (isOnSite && member.onSiteAt) {
                  try {
                    const diffMs = now.getTime() - new Date(member.onSiteAt).getTime()
                    const diffHrs = Math.floor(diffMs / 3600000)
                    const diffMins = Math.floor((diffMs % 3600000) / 60000)
                    durationText = `${diffHrs}h ${diffMins}m on site`
                  } catch (_) {}
                } else if (isComplete && member.onSiteAt && member.completedAt) {
                  try {
                    const diffMs = new Date(member.completedAt).getTime() - new Date(member.onSiteAt).getTime()
                    const diffHrs = (diffMs / 3600000).toFixed(1)
                    durationText = `${diffHrs} hrs total`
                  } catch (_) {}
                }

                return (
                  <Card
                    key={id}
                    className={cn(
                      "p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-3 shadow-md",
                      isOnSite
                        ? "bg-gradient-to-br from-zinc-900 to-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20"
                        : isComplete
                        ? "bg-zinc-900/90 border-blue-500/30"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-700",
                    )}
                  >
                    {/* Header Info */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Initials Avatar */}
                        <div
                          className={cn(
                            "size-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border",
                            isOnSite
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : isComplete
                              ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                              : "bg-zinc-800 text-zinc-300 border-zinc-700",
                          )}
                        >
                          {member.name
                            ? member.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            : "CR"}
                        </div>

                        {/* Name & Role */}
                        <div className="min-w-0">
                          <h3 className="font-bold text-base text-white tracking-tight truncate">
                            {member.name || id}
                          </h3>
                          <p className="text-xs text-zinc-400 font-medium truncate">
                            {member.role || "Crew Specialist"}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize font-bold text-[11px] shrink-0",
                          isOnSite
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                            : isComplete
                            ? "border-blue-500/40 bg-blue-500/15 text-blue-400"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400",
                        )}
                      >
                        {isOnSite ? (
                          <span className="flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            On Site
                          </span>
                        ) : isComplete ? (
                          "Completed"
                        ) : (
                          "Pending"
                        )}
                      </Badge>
                    </div>

                    {/* Department & Time Info Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-zinc-800/80">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border",
                          getDeptColor(member.departmentName),
                        )}
                      >
                        {member.departmentName || "General"}
                      </span>

                      {/* Timing details */}
                      <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
                        {isOnSite && member.onSiteAt ? (
                          <>
                            <ClockIcon className="size-3 text-emerald-400" />
                            <span>In: {formatShortTime(member.onSiteAt)}</span>
                            {durationText && <span className="text-emerald-400 font-bold">({durationText})</span>}
                          </>
                        ) : isComplete && member.completedAt ? (
                          <>
                            <CheckCircle2Icon className="size-3 text-blue-400" />
                            <span>Out: {formatShortTime(member.completedAt)}</span>
                            {durationText && <span className="text-blue-400 font-bold">({durationText})</span>}
                          </>
                        ) : (
                          <span className="text-zinc-500">Not checked in</span>
                        )}
                      </div>
                    </div>

                    {/* Action 1-Tap Buttons */}
                    <div className="pt-1">
                      {isPending && (
                        <Button
                          onClick={() => handleCheckIn(member)}
                          disabled={isBusy}
                          className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                        >
                          <UserCheckIcon className="size-4" />
                          {isBusy ? "Checking In..." : "1-Tap Check In"}
                        </Button>
                      )}

                      {isOnSite && (
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            onClick={() => handleCheckOut(member)}
                            disabled={isBusy}
                            className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
                          >
                            <LogOutIcon className="size-4" />
                            {isBusy ? "Logging Out..." : "Check Out (Log Hours)"}
                          </Button>
                        </div>
                      )}

                      {isComplete && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                            <CheckCircle2Icon className="size-3.5 text-blue-400" />
                            <span>Time Entry Logged</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCheckIn(member)}
                            disabled={isBusy}
                            className="h-8 border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white text-xs"
                          >
                            Re-check In
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* 6. Interactive QR / Badge Scanner Simulation Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <QrCodeIcon className="size-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Badge & QR Check-In Scanner</h3>
                  <p className="text-xs text-zinc-400">Scan physical NFC badge or tap crew member below</p>
                </div>
              </div>
              <button
                onClick={() => setScannerOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <XIcon className="size-5" />
              </button>
            </div>

            {/* Scanner Viewfinder Simulation */}
            <div className="relative h-48 bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col items-center justify-center overflow-hidden">
              {/* Animated Laser Scanning Line */}
              <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-bounce top-4" />

              {/* Viewfinder Target Reticle */}
              <div className="size-32 border-2 border-dashed border-emerald-500/60 rounded-xl flex items-center justify-center relative">
                <CameraIcon className="size-8 text-emerald-500/40" />
                <div className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-emerald-400" />
              </div>

              <div className="mt-3 text-xs font-mono text-emerald-400/80 flex items-center gap-1.5">
                <SparklesIcon className="size-3 animate-spin" />
                Optical & RFID Sensor Active
              </div>
            </div>

            {/* Quick Badge Simulation List */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Simulate Badge Scan:
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-zinc-800">
                {crew.map((c) => {
                  const id = c.crewId || c.id
                  const isCheckedIn = c.status === "on_site"
                  return (
                    <button
                      key={id}
                      onClick={async () => {
                        if (isCheckedIn) {
                          await handleCheckOut(c)
                        } else {
                          await handleCheckIn(c)
                        }
                        setScannerOpen(false)
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-800 text-left transition-colors"
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{c.name}</div>
                        <div className="text-xs text-zinc-400">
                          {c.role} • {c.departmentName || "General"}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs capitalize font-bold",
                          isCheckedIn ? "border-emerald-500 text-emerald-400" : "border-zinc-700 text-zinc-300",
                        )}
                      >
                        {isCheckedIn ? "Tap to Check Out" : "Tap to Check In"}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
