import { useState, useEffect } from "react"
import { AlertTriangleIcon, CheckCircle2Icon, ShieldAlertIcon, XIcon, CalendarIcon, UserIcon, ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { getAgencyConflicts, type ConflictItem } from "@/lib/api/agency"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function ConflictDetectorBanner({ eventId }: { eventId?: string }) {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [resolvedIds, setResolvedIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getAgencyConflicts(eventId)
        if (!cancelled && res.data?.conflicts) {
          setConflicts(res.data.conflicts)
        }
      } catch (_) {
        // Ignore background check failure
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
  }, [eventId])

  const activeConflicts = conflicts.filter((c) => !resolvedIds.includes(c.id))
  if (loading || activeConflicts.length === 0) return null

  const criticalCount = activeConflicts.filter((c) => c.severity === "CRITICAL").length

  const handleResolve = (id: string, name: string) => {
    setResolvedIds((prev) => [...prev, id])
    toast.success(`Conflict Override Applied`, {
      description: `Double-booking warning for ${name} acknowledged.`,
    })
  }

  return (
    <>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-sm transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0">
            <AlertTriangleIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-foreground">
                {activeConflicts.length} Double-Booking {activeConflicts.length === 1 ? "Conflict" : "Conflicts"} Detected
              </span>
              {criticalCount > 0 ? (
                <Badge variant="destructive" className="text-[10px] font-mono uppercase px-1.5 py-0">
                  {criticalCount} Critical
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Technicians or assets scheduled across overlapping dates in active events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsOpen(true)}
            className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/20 text-xs font-semibold gap-1.5 h-8"
          >
            <ShieldAlertIcon className="size-3.5" />
            Inspect Conflicts & Resolution
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
              <ShieldAlertIcon className="size-5 text-amber-500" />
              Cross-Event Conflict & Double-Booking Detector
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Review overlapping dates, crew double-bookings, and asset allocations across active events.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {activeConflicts.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl border p-4 space-y-3 transition-colors",
                  c.severity === "CRITICAL"
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-amber-500/30 bg-amber-500/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      <UserIcon className="size-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground flex items-center gap-2">
                        {c.entityName}
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {c.role || "Technician"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Overlapping Shift: {c.overlapDays} {c.overlapDays === 1 ? "day" : "days"}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={c.severity === "CRITICAL" ? "destructive" : "secondary"}
                    className="text-[10px] font-mono tracking-wider font-bold"
                  >
                    {c.severity}
                  </Badge>
                </div>

                {/* Overlapping Events Pair */}
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  {c.conflictingEvents.map((ev, idx) => (
                    <div
                      key={ev.id + idx}
                      className="rounded-lg border bg-background/80 p-3 space-y-1 text-xs"
                    >
                      <div className="font-bold text-foreground truncate">{ev.name}</div>
                      <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px]">
                        <CalendarIcon className="size-3 shrink-0 text-primary" />
                        {ev.startDate ? new Date(ev.startDate).toLocaleDateString() : "TBD"} ➔{" "}
                        {ev.endDate ? new Date(ev.endDate).toLocaleDateString() : "TBD"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Role: {ev.role || c.role}</div>
                    </div>
                  ))}
                </div>

                {/* Recommendation & Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                  <span className="text-muted-foreground italic flex-1 min-w-[200px]">
                    💡 {c.recommendation}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(c.id, c.entityName)}
                    className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 shrink-0"
                  >
                    <CheckCircle2Icon className="size-3.5" />
                    Acknowledge & Override
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20">
            <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
