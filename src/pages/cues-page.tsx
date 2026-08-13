import { useCallback, useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CueRunSheet } from "@/components/ops/cue-run-sheet"
import { EventScopeBar } from "@/components/ops/event-scope-bar"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { withMutationFeedback } from "@/components/shared/mutation-feedback"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useEventScope } from "@/hooks/use-event-scope"
import {
  advanceCues,
  completeCue,
  createCue,
  deleteCue,
  listCues,
  resetCue,
  skipCue,
  startCue,
  updateCue,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Cue } from "@/types/agency"

export function CuesPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_ops")
  const { events, eventId, setEventId, selectedEvent, loadingEvents } = useEventScope()
  const [cues, setCues] = useState<Cue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCueId, setBusyCueId] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDuration, setNewDuration] = useState("10")
  const [newLocation, setNewLocation] = useState("")
  const [pendingCueId, setPendingCueId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cue | null>(null)

  const reload = useCallback(async () => {
    if (!eventId) return
    const cuesRes = await listCues(eventId)
    setCues(cuesRes.data ?? [])
  }, [eventId])

  /** Instant UI patch from mutation response, then hard-reload from server */
  function patchCueLocal(updated: Cue | null | undefined) {
    if (!updated?.cueId) return
    setCues((prev) =>
      prev.map((c) =>
        c.cueId === updated.cueId || c.id === updated.id ? { ...c, ...updated } : c,
      ),
    )
  }

  useEffect(() => {
    if (!eventId) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        await reload()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load cues")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [eventId, reload])

  async function handleStart(cue: Cue) {
    if (!eventId || !canWrite) return
    setBusyCueId(cue.cueId)
    try {
      const res = await startCue(eventId, cue.cueId)
      patchCueLocal(res.data)
      await reload()
      toast.success(`Started ${cue.name || cue.cueId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start cue")
      await reload().catch(() => undefined)
    } finally {
      setBusyCueId(null)
    }
  }

  async function handleComplete(cue: Cue) {
    if (!eventId || !canWrite) return
    setBusyCueId(cue.cueId)
    try {
      const res = await completeCue(eventId, cue.cueId)
      patchCueLocal(res.data)
      await reload()
      toast.success(`Completed ${cue.name || cue.cueId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not complete cue")
      await reload().catch(() => undefined)
    } finally {
      setBusyCueId(null)
    }
  }

  async function handleSkip(cue: Cue) {
    if (!eventId || !canWrite) return
    setBusyCueId(cue.cueId)
    try {
      const res = await skipCue(eventId, cue.cueId)
      patchCueLocal(res.data)
      await reload()
      toast.success(`Skipped ${cue.name || cue.cueId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not skip cue")
      await reload().catch(() => undefined)
    } finally {
      setBusyCueId(null)
    }
  }

  async function handleReset(cue: Cue) {
    if (!eventId || !canWrite) return
    setBusyCueId(cue.cueId)
    try {
      const res = await resetCue(eventId, cue.cueId)
      // Optimistically drop out of Live filter immediately
      patchCueLocal({
        ...cue,
        ...res.data,
        status: "pending",
        actualStartTime: undefined,
        actualEndTime: undefined,
      })
      await reload()
      toast.success(`Reset ${cue.name || cue.cueId} → pending`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reset cue")
      await reload().catch(() => undefined)
    } finally {
      setBusyCueId(null)
    }
  }

  async function handleAdvance() {
    if (!eventId || !canWrite) return
    setAdvancing(true)
    try {
      const res = await advanceCues(eventId)
      if (res.data?.cues) {
        setCues(res.data.cues)
      } else {
        await reload()
      }
      const started = res.data?.started
      toast.success(
        started
          ? `Now calling: ${started.name || started.cueId}`
          : res.message || "Advanced",
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not advance show")
    } finally {
      setAdvancing(false)
    }
  }

  async function handleAdd() {
    if (!eventId || !canWrite || !newName.trim()) return
    setAdding(true)
    try {
      // Schedule after last cue by default
      const last = [...cues].sort(
        (a, b) =>
          new Date(a.scheduledTime || 0).getTime() - new Date(b.scheduledTime || 0).getTime(),
      )[cues.length - 1]
      const base = last?.scheduledTime
        ? new Date(last.scheduledTime).getTime() + (last.duration || 10) * 60_000
        : Date.now()

      await createCue(eventId, {
        name: newName.trim(),
        duration: Number(newDuration) || 10,
        location: newLocation.trim() || undefined,
        scheduledTime: new Date(base).toISOString(),
        priority: "medium",
      })
      setNewName("")
      setNewLocation("")
      setNewDuration("10")
      setShowAdd(false)
      await reload()
      toast.success("Cue added to run sheet")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not add cue")
    } finally {
      setAdding(false)
    }
  }

  async function handleEdit(cue: Cue) {
    if (!eventId || !canWrite) return
    const name = window.prompt("Cue name", cue.name || cue.title || "")
    if (name == null || !name.trim() || name.trim() === (cue.name || cue.title)) return
    setPendingCueId(cue.cueId)
    try {
      await withMutationFeedback(updateCue(eventId, cue.cueId, { name: name.trim() }), {
        loading: "Updating cue...", success: "Cue updated",
        error: (err) => err instanceof ApiError ? err.message : "Could not update cue",
      })
      await reload()
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not update cue")
    } finally { setPendingCueId(null) }
  }

  async function handleDelete(cue: Cue) {
    if (!eventId || !canWrite) return
    setPendingCueId(cue.cueId)
    try {
      await withMutationFeedback(deleteCue(eventId, cue.cueId), {
        loading: "Deleting cue...", success: "Cue deleted",
        error: (err) => err instanceof ApiError ? err.message : "Could not delete cue",
      })
      await reload()
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Could not delete cue")
    } finally { setPendingCueId(null); setDeleteTarget(null) }
  }

  return (
    <div className="flex flex-col gap-5">
      <EventScopeBar
        title="Cues & Timeline"
        events={events}
        eventId={eventId}
        onEventChange={setEventId}
        loading={loadingEvents}
        selectedEvent={selectedEvent}
        compact
        trailing={
          canWrite ? (
            <Button
              size="sm"
              variant={showAdd ? "default" : "outline"}
              onClick={() => setShowAdd((v) => !v)}
            >
              <PlusIcon className="size-3.5" />
              Add cue
            </Button>
          ) : undefined
        }
      />

      {showAdd && canWrite ? (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Cue name</label>
            <Input
              placeholder="e.g. Q&A handoff"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
            />
          </div>
          <div className="flex w-24 flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Minutes</label>
            <Input
              type="number"
              min={1}
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">Location</label>
            <Input
              placeholder="Main stage"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={adding || !newName.trim()} onClick={() => void handleAdd()}>
            {adding ? "Adding…" : "Save cue"}
          </Button>
        </Card>
      ) : null}

      {!canWrite ? (
        <p className="text-muted-foreground text-xs">
          View only — ops write access requires ops, producer, pm, or admin.
        </p>
      ) : null}

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : (
        <CueRunSheet
          cues={cues}
          busyCueId={busyCueId}
          advancing={advancing}
          canWrite={canWrite}
          onStart={handleStart}
          onComplete={handleComplete}
          onSkip={handleSkip}
          onReset={handleReset}
           onAdvance={handleAdvance}
            onEdit={pendingCueId ? undefined : handleEdit}
            onDelete={pendingCueId ? undefined : (cue) => setDeleteTarget(cue)}
         />
      )}
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !pendingCueId) setDeleteTarget(null) }}
        title="Delete cue?"
        description={deleteTarget ? `This will permanently delete “${deleteTarget.name || deleteTarget.title || deleteTarget.cueId}”.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={Boolean(pendingCueId)}
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget) : undefined}
      />
    </div>
  )
}
