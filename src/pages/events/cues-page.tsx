import { useCallback, useEffect, useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { CueRunSheet } from "@/components/ops/cue-run-sheet"
import { EventScopeBar } from "@/components/ops/event-scope-bar"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { withMutationFeedback } from "@/components/shared/mutation-feedback"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
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
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCue, setEditingCue] = useState<Cue | null>(null)
  const [pendingCueId, setPendingCueId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cue | null>(null)

  interface CueFormData {
    name: string
    duration: string
    location: string
    description: string
    priority: string
    departmentName: string
    assignedTo: string
  }

  const emptyForm: CueFormData = {
    name: "",
    duration: "10",
    location: "",
    description: "",
    priority: "medium",
    departmentName: "",
    assignedTo: "",
  }

  const [form, setForm] = useState<CueFormData>(emptyForm)

  function openCreateDialog() {
    setEditingCue(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  function openEditDialog(cue: Cue) {
    setEditingCue(cue)
    setForm({
      name: cue.name || cue.title || "",
      duration: String(cue.duration || 10),
      location: cue.location || "",
      description: cue.description || "",
      priority: cue.priority || "medium",
      departmentName: cue.departmentName || "",
      assignedTo: cue.assignedTo || "",
    })
    setIsDialogOpen(true)
  }

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

  async function handleSave() {
    if (!eventId || !canWrite || !form.name.trim()) return
    setIsSaving(true)
    try {
      if (editingCue) {
        await updateCue(eventId, editingCue.cueId, {
          name: form.name.trim(),
          duration: Number(form.duration) || 10,
          location: form.location.trim() || undefined,
          description: form.description.trim() || undefined,
          priority: form.priority || "medium",
          departmentName: form.departmentName.trim() || undefined,
          assignedTo: form.assignedTo.trim() || undefined,
        })
        toast.success("Cue updated")
      } else {
        const last = [...cues].sort(
          (a, b) =>
            new Date(a.scheduledTime || 0).getTime() - new Date(b.scheduledTime || 0).getTime(),
        )[cues.length - 1]
        const base = last?.scheduledTime
          ? new Date(last.scheduledTime).getTime() + (last.duration || 10) * 60_000
          : Date.now()

        await createCue(eventId, {
          name: form.name.trim(),
          duration: Number(form.duration) || 10,
          location: form.location.trim() || undefined,
          description: form.description.trim() || undefined,
          scheduledTime: new Date(base).toISOString(),
          priority: form.priority || "medium",
          departmentName: form.departmentName.trim() || undefined,
        })
        toast.success("Cue added to run sheet")
      }
      setIsDialogOpen(false)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed")
    } finally {
      setIsSaving(false)
    }
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
              onClick={openCreateDialog}
            >
              <PlusIcon className="size-3.5" />
              Add cue
            </Button>
          ) : undefined
        }
      />

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
            onEdit={pendingCueId ? undefined : openEditDialog}
            onDelete={pendingCueId ? undefined : (cue) => setDeleteTarget(cue)}
         />
      )}
      {/* Add / Edit Cue Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCue ? "Edit Cue" : "Add Cue"}</DialogTitle>
            <DialogDescription>
              {editingCue
                ? "Update cue name, timing, location, and assignment."
                : "Add a new cue to the run sheet. It will be scheduled after the last cue."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="cue-name">Cue Name *</Label>
              <Input
                id="cue-name"
                placeholder="e.g. Q&A handoff"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cue-duration">Duration (minutes)</Label>
                <Input
                  id="cue-duration"
                  type="number"
                  min={1}
                  placeholder="10"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cue-priority">Priority</Label>
                <Select
                  id="cue-priority"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cue-location">Location</Label>
                <Input
                  id="cue-location"
                  placeholder="Main stage"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cue-dept">Department</Label>
                <Input
                  id="cue-dept"
                  placeholder="e.g. Lighting"
                  value={form.departmentName}
                  onChange={(e) => setForm((f) => ({ ...f, departmentName: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cue-assigned">Assigned To</Label>
              <Input
                id="cue-assigned"
                placeholder="e.g. Marcus Reid"
                value={form.assignedTo}
                onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cue-desc">Notes</Label>
              <Textarea
                id="cue-desc"
                placeholder="Additional details or instructions..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving || !form.name.trim()}>
              {isSaving ? "Saving…" : editingCue ? "Save Changes" : "Add Cue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
