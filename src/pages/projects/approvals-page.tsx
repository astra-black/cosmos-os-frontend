import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CheckIcon, Loader2Icon, MessageSquareWarningIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { createApproval, decideApproval, listApprovals } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Approval } from "@/types/agency"
import { cn } from "@/lib/utils"

const ENTITY_TYPES = ["asset", "deliverable", "budget", "other"] as const
const PRIORITIES = ["low", "medium", "high", "critical"] as const
type ApprovalDecision = "approved" | "rejected" | "changes_requested"

export function ApprovalsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const scopedProjectId = searchParams.get("projectId") || ""
  const canDecide = canPerform(user?.role, "decide_approval")
  // Align with Assets: writers can request; only PM/Producer/Admin decide.
  const canRequest =
    canPerform(user?.role, "write_crm") ||
    canPerform(user?.role, "write_ops") ||
    canDecide
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [filter, setFilter] = useState<"queue" | "all">("queue")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [decisionTarget, setDecisionTarget] = useState<{ approval: Approval; decision: ApprovalDecision } | null>(null)
  const [decisionNotes, setDecisionNotes] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "",
    entityType: "asset",
    entityId: "",
    projectId: scopedProjectId,
    clientId: "",
    requester: user?.name ?? "",
    reviewer: "",
    dueDate: "",
    priority: "medium",
    notes: "",
  })

  useEffect(() => {
    if (!scopedProjectId) return
    setForm((current) => ({ ...current, projectId: scopedProjectId }))
    if (canRequest && searchParams.get("create") === "1") setCreateOpen(true)
  }, [scopedProjectId, canRequest, searchParams])

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
    decision: ApprovalDecision,
  ) {
    if (!canDecide) return
    const notes = decisionNotes.trim()
    if (decision === "changes_requested" && !notes) {
      toast.error("Add notes explaining the requested changes")
      return
    }
    setBusyId(approval.approvalId)
    try {
      await decideApproval(approval.approvalId, decision, notes || undefined)
      await reload()
      setDecisionTarget(null)
      setSelectedId(null)
      setDecisionNotes("")
      toast.success(`${approval.title} → ${decision.replace("_", " ")}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Decision failed")
    } finally {
      setBusyId(null)
    }
  }

  function openDecision(approval: Approval, decision: ApprovalDecision) {
    setSelectedId(approval.approvalId)
    setDecisionNotes("")
    setDecisionTarget({ approval, decision })
  }

  async function create() {
    if (!canRequest) return
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
        projectId: scopedProjectId,
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
            {canRequest ? (
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
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => openDecision(approval, "approved")}
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
                          onClick={() => openDecision(approval, "changes_requested")}
                        >
                          <MessageSquareWarningIcon className="size-3.5" />
                          Changes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => openDecision(approval, "rejected")}
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
      <EntityFormDialog
        open={createOpen && canRequest}
        onOpenChange={(open) => {
          if (!open && !createBusy) {
            setCreateOpen(false)
            setFormError(null)
          }
        }}
        title="Request an approval"
        description="Create a review item for an asset, deliverable, or budget ask."
        onSubmit={create}
        submitLabel="Create request"
        pending={createBusy}
        submitDisabled={!form.title.trim() || !form.entityId.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="approval-form-title">Title</Label>
            <Input id="approval-form-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Approval title" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-entity-id">Entity ID</Label>
            <Input id="approval-form-entity-id" value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })} placeholder="Asset or deliverable ID" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-entity-type">Entity type</Label>
            <select id="approval-form-entity-type" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
              {ENTITY_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-priority">Priority</Label>
            <select id="approval-form-priority" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-due-date">Due date</Label>
            <Input id="approval-form-due-date" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-project">Project ID</Label>
            <Input id="approval-form-project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="Optional" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-client">Client ID</Label>
            <Input id="approval-form-client" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="Optional" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-requester">Requester</Label>
            <Input id="approval-form-requester" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder="Optional" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-reviewer">Reviewer</Label>
            <Input id="approval-form-reviewer" value={form.reviewer} onChange={(e) => setForm({ ...form, reviewer: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="approval-form-notes">Notes</Label>
          <Textarea id="approval-form-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional context for the reviewer" />
        </div>
        {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
      </EntityFormDialog>
      <EntityFormDialog
        open={decisionTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busyId) {
            setDecisionTarget(null)
            setSelectedId(null)
            setDecisionNotes("")
          }
        }}
        title={decisionTarget ? `Decision: ${decisionTarget.decision.replace("_", " ")}` : "Approval decision"}
        description={decisionTarget ? `Add optional notes for ${decisionTarget.approval.title}. Notes are required when requesting changes.` : undefined}
        onSubmit={() => decisionTarget ? decide(decisionTarget.approval, decisionTarget.decision) : undefined}
        submitLabel={decisionTarget?.decision === "changes_requested" ? "Request changes" : decisionTarget?.decision === "approved" ? "Approve" : "Reject"}
        pending={Boolean(decisionTarget && busyId === decisionTarget.approval.approvalId)}
        submitDisabled={decisionTarget?.decision === "changes_requested" && !decisionNotes.trim()}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="approval-decision-notes">Decision notes</Label>
          <Textarea id="approval-decision-notes" value={decisionNotes} onChange={(e) => setDecisionNotes(e.target.value)} placeholder="Optional for approve or reject; required for requested changes" autoFocus />
        </div>
      </EntityFormDialog>
    </div>
  )
}
