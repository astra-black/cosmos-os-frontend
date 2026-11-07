import { useCallback, useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  acknowledgeScheduleChangeRequest,
  applyScheduleChangeRequest,
  cancelScheduleChangeRequest,
  listScheduleChangeRequests,
  retryScheduleChangeNotifications,
  type ScheduleChangeRequest,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"

function toInputDate(value: string | null | undefined) {
  if (!value) return ""
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${mo}-${day}`
}

function formatDisplayDate(value: string | null | undefined) {
  const input = toInputDate(value)
  if (!input) return "No date"
  const [y, m, d] = input.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })
}

function formatWhen(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function statusLabel(status: string) {
  const s = status.toLowerCase()
  if (s === "applied") return "Applied"
  if (s === "cancelled") return "Cancelled"
  return "Pending"
}

function deliveryLabel(ack: ScheduleChangeRequest["acknowledgements"][number]) {
  const status = ack.deliveryStatus || (ack.notifiedAt ? "notified" : "unnotified")
  // Wording tracks notifiedAt (recorded successful push), not provider exactly-once delivery.
  if (status === "notified" || ack.notifiedAt) {
    return `recorded${ack.notifiedAt ? ` ${formatWhen(ack.notifiedAt)}` : ""}`
  }
  if (status === "unnotified_expired") {
    return "not recorded · retry window expired"
  }
  if (status === "unnotified_closed") {
    return "not recorded · request closed"
  }
  return "not recorded · retryable (may send again)"
}

export function ScheduleChangeRequestsPanel({
  refreshKey = 0,
  onApplied,
}: {
  refreshKey?: number
  onApplied?: () => void
}) {
  const { user } = useAuth()
  const role = user?.role || user?.permissionRole
  const canApply = canPerform(role, "apply_schedule_change")
  const canRetry = canPerform(role, "retry_schedule_notifications")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<ScheduleChangeRequest[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listScheduleChangeRequests()
      const rows = res.data ?? []
      setRequests(rows)
      setExpandedId((prev) => {
        if (prev && rows.some((r) => r.requestId === prev)) return prev
        return rows[0]?.requestId ?? null
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Schedule change requests could not be loaded."
      setError(message)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function runAction(
    requestId: string,
    action: "acknowledge" | "apply" | "cancel" | "retry",
  ) {
    setBusyId(requestId)
    try {
      if (action === "retry") {
        const res = await retryScheduleChangeNotifications(requestId)
        const result = res.data
        if (result?.request) {
          setRequests((prev) =>
            prev.map((row) => (row.requestId === requestId ? result.request! : row)),
          )
        } else {
          await load()
        }
        if (result && result.notified > 0 && result.failed === 0) {
          toast.success(
            `Recorded delivery for ${result.notified} acknowledgement${result.notified === 1 ? "" : "s"}`,
          )
        } else if (result && result.notified > 0) {
          toast.warning(
            `Recorded ${result.notified}; ${result.failed} still not recorded after send attempt`,
          )
        } else if (result && result.failed > 0) {
          toast.warning(
            "Send did not complete. Delivery stays unrecorded so retry can try again.",
          )
        } else {
          toast.message("No unrecorded deliveries to retry for this request")
        }
        return
      }

      let res
      if (action === "acknowledge") {
        res = await acknowledgeScheduleChangeRequest(requestId)
        toast.success("Acknowledgment recorded")
      } else if (action === "apply") {
        res = await applyScheduleChangeRequest(requestId)
        toast.success("Schedule dates applied")
        onApplied?.()
      } else {
        res = await cancelScheduleChangeRequest(requestId)
        toast.success("Schedule change request cancelled")
      }
      if (res.data) {
        setRequests((prev) =>
          prev.map((row) => (row.requestId === requestId ? res.data! : row)),
        )
      } else {
        await load()
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed"
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="cosmos-schedule-requests" aria-labelledby="schedule-change-requests-heading">
      <div className="cosmos-schedule-requests__head">
        <div>
          <h2 id="schedule-change-requests-heading">Schedule change requests</h2>
          <p>
            Proposed dates stay pending until acknowledgments complete and an authorized role applies
            them. Due dates are never changed on request creation. Delivery status is recorded after a
            successful send attempt; retries may send again if a prior send was not recorded.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="cosmos-schedule-requests__empty">
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" /> Loading requests…
        </p>
      ) : error ? (
        <p className="cosmos-schedule-requests__empty">{error}</p>
      ) : requests.length === 0 ? (
        <p className="cosmos-schedule-requests__empty">
          No schedule change requests yet. Use Request Schedule Change to propose new due dates.
        </p>
      ) : (
        <ul className="cosmos-schedule-requests__list">
          {requests.map((request) => {
            const open = expandedId === request.requestId
            const pending = request.status.toLowerCase() === "pending"
            const busy = busyId === request.requestId
            const complete = Boolean(request.acknowledgementsComplete)
            const canCancel = canApply || Boolean(request.viewerIsRequester)
            const ackCount = request.acknowledgements.length
            const doneCount = request.acknowledgements.filter((a) => a.acknowledgedAt).length
            const delivery = request.notificationDeliveryState
            const unnotified = delivery?.unnotified ??
              request.acknowledgements.filter((a) => a.retryEligible || a.deliveryStatus === "unnotified").length
            const expired = delivery?.expired ??
              request.acknowledgements.filter((a) => a.deliveryStatus === "unnotified_expired").length
            const notified = delivery?.notified ??
              request.acknowledgements.filter((a) => a.notifiedAt).length
            const retryEligible = Boolean(delivery?.retryEligible ?? unnotified > 0)
            const maxAge = delivery?.retryPolicy?.maxRequestAgeDays
            return (
              <li key={request.requestId} className={cn("cosmos-schedule-request", open && "is-open")}>
                <button
                  type="button"
                  className="cosmos-schedule-request__summary"
                  aria-expanded={open}
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === request.requestId ? null : request.requestId,
                    )
                  }
                >
                  <span className="cosmos-schedule-request__main">
                    <strong>{request.reason}</strong>
                    <small>
                      {request.items.length} item{request.items.length === 1 ? "" : "s"}
                      {request.requestedByName ? ` · ${request.requestedByName}` : ""}
                      {request.createdAt ? ` · ${formatWhen(request.createdAt)}` : ""}
                      {ackCount > 0
                        ? ` · delivery ${notified}/${ackCount} recorded${unnotified ? `, ${unnotified} unrecorded` : ""}${expired ? `, ${expired} expired` : ""}`
                        : ""}
                    </small>
                  </span>
                  <span
                    className={cn(
                      "cosmos-schedule-request__status",
                      `is-${request.status.toLowerCase()}`,
                    )}
                  >
                    {statusLabel(request.status)}
                  </span>
                </button>

                {open ? (
                  <div className="cosmos-schedule-request__detail">
                    <div className="cosmos-schedule-request__block">
                      <h3>Proposed dates</h3>
                      <ul>
                        {request.items.map((item) => (
                          <li key={item.itemId}>
                            <span>
                              <strong>{item.title}</strong>
                              <small>
                                {item.projectName || "Project"} · {item.entityType}
                              </small>
                            </span>
                            <span className="cosmos-schedule-request__dates">
                              <span className="is-struck">{formatDisplayDate(item.fromDate)}</span>
                              <span aria-hidden="true">→</span>
                              <span>{formatDisplayDate(item.toDate)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="cosmos-schedule-request__block">
                      <h3>
                        Acknowledgments
                        {ackCount > 0 ? ` · ${doneCount}/${ackCount}` : " · none required"}
                      </h3>
                      {ackCount === 0 ? (
                        <p className="cosmos-schedule-request__note">
                          No acknowledgees were selected. An authorized role may apply when ready.
                        </p>
                      ) : (
                        <>
                          <p className="cosmos-schedule-request__note">
                            Delivery {notified} recorded
                            {unnotified ? ` · ${unnotified} unrecorded (retryable; may send again)` : ""}
                            {expired
                              ? ` · ${expired} past ${maxAge ?? 30}-day retry window`
                              : ""}
                            . Status reflects recorded sends, not exactly-once provider delivery. Retry
                            does not change due dates or request status.
                          </p>
                          <ul>
                            {request.acknowledgements.map((ack) => (
                              <li key={ack.acknowledgementId}>
                                <span>
                                  <strong>{ack.memberName || "Team member"}</strong>
                                  <small>
                                    Delivery: {deliveryLabel(ack)}
                                    {" · "}
                                    Ack:{" "}
                                    {ack.acknowledgedAt
                                      ? `acknowledged ${formatWhen(ack.acknowledgedAt)}`
                                      : "pending"}
                                  </small>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>

                    {pending ? (
                      <div className="cosmos-schedule-request__actions">
                        {request.viewerCanAcknowledge ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void runAction(request.requestId, "acknowledge")}
                          >
                            {busy ? "Working…" : "Acknowledge"}
                          </Button>
                        ) : null}
                        {canRetry && retryEligible ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void runAction(request.requestId, "retry")}
                          >
                            {busy ? "Working…" : "Retry notifications"}
                          </Button>
                        ) : null}
                        {canApply ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy || !complete}
                            title={
                              complete
                                ? "Apply proposed due dates"
                                : "Waiting for all acknowledgments"
                            }
                            onClick={() => void runAction(request.requestId, "apply")}
                          >
                            {busy ? "Working…" : "Apply dates"}
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void runAction(request.requestId, "cancel")}
                          >
                            Cancel request
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
