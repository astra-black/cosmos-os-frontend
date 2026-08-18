import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CheckIcon, Loader2Icon, MessageSquareWarningIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createApproval, decideApproval, listApprovals } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Approval } from "@/types/agency"
import { cn } from "@/lib/utils"

const ENTITY_TYPES = ["asset", "deliverable", "budget", "other"] as const
const PRIORITIES = ["low", "medium", "high", "critical"] as const

export function ApprovalsPage() {
  const { user } = useAuth()
  const canDecide = canPerform(user?.role, "decide_approval")
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [filter, setFilter] = useState<"queue" | "all">("queue")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [decisionNotes, setDecisionNotes] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "",
    entityType: "asset",
    entityId: "",
    projectId: "",
    clientId: "",
    requester: user?.name ?? "",
    reviewer: "",
    dueDate: "",
    priority: "medium",
    notes: "",
  })

  const reload = useCallback(async () => {
    setError(null)
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
    if (!canDecide) return
    setBusyId(approval.approvalId)
    try {
      const notes = decisionNotes.trim()
      if (decision === "changes_requested" && !notes) {
        toast.error("Add notes explaining the requested changes")
        return
      }
      await decideApproval(approval.approvalId, decision, notes || undefined)
      await reload()
      setSelectedId(null)
      setDecisionNotes("")
      toast.success(`${approval.title} → ${decision.replace("_", " ")}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Decision failed")
    } finally {
      setBusyId(null)
    }
  }

  async function create() {
    if (!canDecide) return
    const title = form.title.trim()
    const entityId = form.entityId.trim()
    if (!title || !entityId || !ENTITY_TYPES.includes(form.entityType as (typeof ENTITY_TYPES)[number])) {
      setFormError("Title, entity type, and entity ID are required")
      return
    }
    if (!PRIORITIES.includes(form.priority as (typeof PRIORITIES)[number])) {
      setFormError("Select a valid priority")
      return
    }
    if (form.dueDate && Number.isNaN(Date.parse(form.dueDate))) {
      setFormError("Enter a valid due date")
      return
    }
    setFormError(null)
    setCreateBusy(true)
    try {
      await createApproval({
        title,
        entityType: form.entityType,
        entityId,
        ...(form.projectId.trim() ? { projectId: form.projectId.trim() } : {}),
        ...(form.clientId.trim() ? { clientId: form.clientId.trim() } : {}),
        ...(form.requester.trim() ? { requester: form.requester.trim() } : {}),
        ...(form.reviewer.trim() ? { reviewer: form.reviewer.trim() } : {}),
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
        priority: form.priority,
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      })
      await reload()
      setForm({
        title: "",
        entityType: "asset",
        entityId: "",
        projectId: "",
        clientId: "",
        requester: user?.name ?? "",
        reviewer: "",
        dueDate: "",
        priority: "medium",
        notes: "",
      })
      setCreateOpen(false)
      toast.success("Approval requested")
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create approval")
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Approvals"
        description="Review queue for assets, deliverables, and budget asks."
        actions={
          <div className="flex gap-1">
            {canDecide ? (
              <Button size="sm" className="rounded-full" onClick={() => setCreateOpen((open) => !open)}>
                <PlusIcon className="size-3.5" />
                Request approval
              </Button>
            ) : null}
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

      {createOpen && canDecide ? (
        <Card className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="font-semibold">Request an approval</h2>
            <p className="text-muted-foreground text-xs">Create a review item for an asset, deliverable, or budget ask.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Entity ID *" value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })} />
            <select className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
              {ENTITY_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
            </select>
            <select className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
              <option value="critical">Critical priority</option>
            </select>
            <Input placeholder="Project ID (optional)" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} />
            <Input placeholder="Client ID (optional)" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} />
            <Input placeholder="Requester (optional)" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} />
            <Input placeholder="Reviewer (optional)" value={form.reviewer} onChange={(e) => setForm({ ...form, reviewer: e.target.value })} />
            <Input type="date" aria-label="Due date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <textarea className="min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={createBusy} onClick={() => void create()}>
              {createBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              Create request
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card className="flex items-center justify-between gap-3 border-destructive/40 px-4 py-3 text-sm">
          <span className="text-destructive">{error}</span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>Retry</Button>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
       ) : queue.length === 0 ? (
         <EmptyState title={filter === "queue" ? "Queue clear" : "No approvals yet"} description={filter === "queue" ? "Nothing waiting for review." : "Create an approval request to start a review."} />
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
                        {selectedId === approval.approvalId ? (
                          <input
                            className="h-7 min-w-48 rounded-lg border border-input bg-transparent px-2 text-xs"
                            placeholder="Decision notes"
                            value={decisionNotes}
                            onChange={(e) => setDecisionNotes(e.target.value)}
                          />
                        ) : null}
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setSelectedId(approval.approvalId)
                            void decide(approval, "approved")
                          }}
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
                          onClick={() => {
                            setSelectedId(approval.approvalId)
                            void decide(approval, "changes_requested")
                          }}
                        >
                          <MessageSquareWarningIcon className="size-3.5" />
                          Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setSelectedId(approval.approvalId)
                            void decide(approval, "rejected")
                          }}
                        >
                          <XIcon className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    ) : open && !canDecide ? (
                      <p className="text-muted-foreground text-xs">View only — need PM/Producer</p>
                    ) : null}
                  </div>
                  {selectedId === approval.approvalId ? (
                    <div className="mt-3">
                      <CommentsPanel entityType="approval" entityId={approval.approvalId} title="Approval comments" />
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
