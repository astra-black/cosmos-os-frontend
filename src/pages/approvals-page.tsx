import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CheckIcon, Loader2Icon, MessageSquareWarningIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { decideApproval, listApprovals } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Approval } from "@/types/agency"
import { cn } from "@/lib/utils"

export function ApprovalsPage() {
  const { user } = useAuth()
  const canDecide = canPerform(user?.role, "decide_approval")
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [filter, setFilter] = useState<"queue" | "all">("queue")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await listApprovals()
    setApprovals(res.data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load approvals")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reload])

  const queue = useMemo(() => {
    const list =
      filter === "queue"
        ? approvals.filter((a) => a.status === "pending" || a.status === "changes_requested")
        : approvals
    return [...list].sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return (
        (order[a.priority as keyof typeof order] ?? 9) -
        (order[b.priority as keyof typeof order] ?? 9)
      )
    })
  }, [approvals, filter])

  async function decide(
    approval: Approval,
    decision: "approved" | "rejected" | "changes_requested",
  ) {
    setBusyId(approval.approvalId)
    try {
      await decideApproval(approval.approvalId, decision)
      await reload()
      toast.success(`${approval.title} → ${decision.replace("_", " ")}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Decision failed")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Approvals"
        description="Review queue for assets, deliverables, and budget asks."
        actions={
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filter === "queue" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter("queue")}
            >
              Queue
            </Button>
            <Button
              size="sm"
              variant={filter === "all" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState title="Queue clear" description="Nothing waiting for review." />
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.map((approval) => {
            const busy = busyId === approval.approvalId
            const open =
              approval.status === "pending" || approval.status === "changes_requested"
            return (
              <li key={approval.approvalId}>
                <Card
                  className={cn(
                    "p-4",
                    approval.priority === "critical" && "border-l-destructive border-l-4",
                    approval.priority === "high" && "border-l-chart-4 border-l-4",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground font-mono text-xs">
                          {approval.approvalId}
                        </span>
                        <Badge variant="outline" className="capitalize">
                          {approval.entityType}
                        </Badge>
                        <Badge className="capitalize">{approval.status.replace("_", " ")}</Badge>
                        {approval.priority ? (
                          <Badge variant="secondary" className="capitalize">
                            {approval.priority}
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-1 font-semibold">{approval.title}</h3>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {approval.requester} → {approval.reviewer}
                        {approval.dueDate
                          ? ` · due ${new Date(approval.dueDate).toLocaleDateString()}`
                          : ""}
                        {approval.projectId ? (
                          <>
                            {" · "}
                            <Link
                              to={`/projects/${approval.projectId}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {approval.projectId}
                            </Link>
                          </>
                        ) : null}
                        {approval.clientId ? (
                          <>
                            {" · "}
                            <Link
                              to={`/clients/${approval.clientId}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {approval.clientId}
                            </Link>
                          </>
                        ) : null}
                      </p>
                      {approval.notes ? (
                        <p className="text-muted-foreground mt-2 text-sm">{approval.notes}</p>
                      ) : null}
                    </div>
                    {open && canDecide ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => decide(approval, "approved")}
                        >
                          {busy ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <CheckIcon className="size-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => decide(approval, "changes_requested")}
                        >
                          <MessageSquareWarningIcon className="size-3.5" />
                          Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => decide(approval, "rejected")}
                        >
                          <XIcon className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    ) : open && !canDecide ? (
                      <p className="text-muted-foreground text-xs">View only — need PM/Producer</p>
                    ) : null}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
