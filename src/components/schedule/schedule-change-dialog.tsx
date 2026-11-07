import { useEffect, useMemo, useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import {
  createScheduleChangeRequest,
  previewScheduleChangeImpact,
  type ScheduleChangeDependent,
  type ScheduleChangeRequest,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { TeamMember } from "@/types/agency"
import { cn } from "@/lib/utils"

export type ScheduleChangeCandidate = {
  key: string
  kind: "task" | "milestone"
  entityId: string
  projectId: string
  projectName: string
  title: string
  dueDate: string
}

function toInputDate(value: string) {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "No date"
  const input = toInputDate(value)
  if (!input) return "No date"
  const [y, m, d] = input.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })
}

function hasDateChange(candidate: ScheduleChangeCandidate, requested: string) {
  const current = toInputDate(candidate.dueDate)
  return Boolean(requested) && requested !== current
}

function deliveryToast(data: ScheduleChangeRequest | undefined, requestedAckCount: number) {
  const delivery = data?.notificationDelivery
  if (!requestedAckCount) {
    toast.success("Schedule change request recorded")
    return
  }
  if (!delivery) {
    toast.success("Schedule change request recorded")
    return
  }
  if (delivery.allNotified && delivery.notified > 0) {
    toast.success("Schedule change request recorded; acknowledgment delivery recorded for all selected members")
    return
  }
  if (delivery.notified > 0 && delivery.failed > 0) {
    toast.warning(
      `Request recorded. Delivery recorded for ${delivery.notified} of ${delivery.requested}; ${delivery.failed} still unrecorded for retry.`,
    )
    return
  }
  toast.warning(
    "Schedule change request recorded, but acknowledgment delivery was not recorded. Retry may send again.",
  )
}

export function ScheduleChangeDialog({
  open,
  onOpenChange,
  candidates,
  teamMembers,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: ScheduleChangeCandidate[]
  teamMembers: TeamMember[]
  onCreated?: (request: ScheduleChangeRequest) => void
}) {
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [reason, setReason] = useState("")
  const [acknowledgees, setAcknowledgees] = useState<string[]>([])
  const [dependents, setDependents] = useState<ScheduleChangeDependent[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    // Do not preselect items or dates — user must choose a real change.
    setSelected({})
    setReason("")
    setAcknowledgees([])
    setDependents([])
  }, [open, candidates])

  const selectedKeys = useMemo(() => Object.keys(selected), [selected])

  const changedCount = useMemo(
    () =>
      candidates.filter((c) => selected[c.key] != null && hasDateChange(c, selected[c.key])).length,
    [candidates, selected],
  )

  useEffect(() => {
    if (!open) return
    const taskIds = candidates
      .filter((c) => selected[c.key] && c.kind === "task")
      .map((c) => c.entityId)
    if (taskIds.length === 0) {
      setDependents([])
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    previewScheduleChangeImpact(taskIds)
      .then((res) => {
        if (!cancelled) setDependents(res.data?.dependents ?? [])
      })
      .catch(() => {
        if (!cancelled) setDependents([])
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, selectedKeys.join("|"), candidates])

  function toggleItem(item: ScheduleChangeCandidate) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[item.key] != null) delete next[item.key]
      else next[item.key] = toInputDate(item.dueDate)
      return next
    })
  }

  function toggleMember(memberId: string) {
    setAcknowledgees((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    )
  }

  async function onSubmit() {
    const changedItems = candidates
      .filter((c) => selected[c.key] != null && hasDateChange(c, selected[c.key]))
      .map((c) => ({
        entityType: c.kind,
        entityId: c.entityId,
        toDate: selected[c.key],
      }))
    if (changedItems.length === 0) {
      toast.error("Change at least one due date before submitting")
      return
    }
    if (reason.trim().length < 3) {
      toast.error("Add a reason for the change")
      return
    }
    setSubmitting(true)
    try {
      const res = await createScheduleChangeRequest({
        reason: reason.trim(),
        items: changedItems,
        acknowledgeeMemberIds: acknowledgees,
      })
      deliveryToast(res.data, acknowledgees.length)
      if (res.data) onCreated?.(res.data)
      onOpenChange(false)
      return res
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not submit schedule change"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCount = selectedKeys.length
  const summary =
    selectedCount === 0
      ? "Select dated tasks or milestones and set a new due date for at least one."
      : changedCount === 0
        ? `${selectedCount} item${selectedCount === 1 ? "" : "s"} selected — change at least one due date to continue.`
        : `${changedCount} date change${changedCount === 1 ? "" : "s"} ready. Dependent tasks keep their current dates unless you also change them.`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cosmos-schedule-change-dialog max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Change Schedule</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>

        <div className="cosmos-schedule-change-body">
          <div className="cosmos-schedule-change-list">
            {candidates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No dated project tasks or milestones are loaded for this view.
              </p>
            ) : (
              candidates.map((item) => {
                const on = selected[item.key] != null
                const changed = on && hasDateChange(item, selected[item.key])
                return (
                  <label
                    key={item.key}
                    className={cn("cosmos-schedule-change-row", on && "is-selected")}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleItem(item)}
                      aria-label={`Select ${item.title}`}
                    />
                    <span className="cosmos-schedule-change-row__main">
                      <strong>{item.title}</strong>
                      <small>
                        {item.projectName} · {item.kind}
                        {on && !changed ? " · set a new date" : ""}
                      </small>
                    </span>
                    <span className="cosmos-schedule-change-row__dates">
                      <span className={cn(changed && "is-struck")}>{formatDisplayDate(item.dueDate)}</span>
                      {on ? (
                        <>
                          <span aria-hidden="true">→</span>
                          <Input
                            type="date"
                            value={selected[item.key] || ""}
                            onChange={(e) =>
                              setSelected((prev) => ({ ...prev, [item.key]: e.target.value }))
                            }
                            className="h-8 w-[140px]"
                          />
                        </>
                      ) : null}
                    </span>
                  </label>
                )
              })
            )}
          </div>

          {previewLoading ? (
            <p className="cosmos-schedule-change-note">
              <Loader2Icon className="size-3.5 animate-spin" /> Checking task dependencies…
            </p>
          ) : dependents.length > 0 ? (
            <div className="cosmos-schedule-change-dependents">
              <p className="cosmos-schedule-change-note">
                {dependents.length} dependent task{dependents.length === 1 ? "" : "s"} linked by
                existing dependencies (current dates only; not auto-shifted):
              </p>
              <ul>
                {dependents.map((dep) => (
                  <li key={dep.taskId}>
                    <strong>{dep.title}</strong>
                    <small>
                      {dep.projectName || "Project"} · {formatDisplayDate(dep.dueDate)}
                      {dep.assigneeName ? ` · ${dep.assigneeName}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
          ) : selectedCount > 0 ? (
            <p className="cosmos-schedule-change-note">
              No dependent tasks with recorded dependencies were found for the selected tasks.
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="schedule-change-reason">Reason</Label>
            <Textarea
              id="schedule-change-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do these dates need to move?"
              rows={3}
            />
          </div>

          {teamMembers.length > 0 ? (
            <div className="grid gap-2">
              <Label>Ask to acknowledge</Label>
              <p className="text-muted-foreground text-xs">
                Optional. Teammates are marked notified only after in-app delivery succeeds.
                Completing acknowledgment is not available yet.
              </p>
              <div className="cosmos-schedule-change-acks">
                {teamMembers
                  .filter((m) => m.status?.toLowerCase() !== "inactive")
                  .map((member) => {
                    const on = acknowledgees.includes(member.memberId)
                    return (
                      <button
                        key={member.memberId}
                        type="button"
                        className={cn("cosmos-schedule-change-chip", on && "is-on")}
                        onClick={() => toggleMember(member.memberId)}
                      >
                        {member.name}
                      </button>
                    )
                  })}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={submitting || changedCount === 0}>
            {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Send for acknowledgment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
