import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  BellIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  FileCheckIcon,
  FilterIcon,
  Loader2Icon,
  MessageSquareIcon,
  MessageSquareWarningIcon,
  PlusIcon,
  SparklesIcon,
  UserIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { createApproval, decideApproval, listApprovals, nudgeApprovalClient } from "@/lib/api/agency"
import { ShareWithClientToggle } from "@/components/shared/share-with-client-toggle"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import { useClients, useProjects } from "@/hooks/use-agency-data"
import type { Approval } from "@/types/agency"
import { cn } from "@/lib/utils"

const ENTITY_TYPES = ["asset", "deliverable", "budget", "other"] as const
const PRIORITIES = ["low", "medium", "high", "critical"] as const
type ApprovalDecision = "approved" | "rejected" | "changes_requested"

export function ApprovalsPage() {
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
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
  const [nudgeBusyId, setNudgeBusyId] = useState<string | null>(null)

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

  const counts = useMemo(() => {
    return {
      total: approvals.length,
      pending: approvals.filter((a) => a.status === "pending").length,
      changes: approvals.filter((a) => a.status === "changes_requested").length,
      approved: approvals.filter((a) => a.status === "approved").length,
      rejected: approvals.filter((a) => a.status === "rejected").length,
      critical: approvals.filter((a) => a.priority === "critical").length,
    }
  }, [approvals])

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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Approvals & Proofs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review queue for creative assets, milestone deliverables, and client sign-offs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center p-1 rounded-full bg-surface-alt border border-border">
            <button
              onClick={() => setFilter("queue")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                filter === "queue"
                  ? "bg-[#270045] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Queue
              <span className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                filter === "queue" ? "bg-white/20 text-white" : "bg-border text-muted-foreground"
              )}>
                {counts.pending + counts.changes}
              </span>
            </button>
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
                filter === "all"
                  ? "bg-[#270045] text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
              <span className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                filter === "all" ? "bg-white/20 text-white" : "bg-border text-muted-foreground"
              )}>
                {counts.total}
              </span>
            </button>
          </div>

          {canRequest ? (
            <Button
              size="sm"
              onClick={() => setCreateOpen((open) => !open)}
              className="bg-[#270045] text-white hover:bg-[#3a006b] rounded-full px-4 h-9 shadow-xs"
            >
              <PlusIcon className="size-3.5 mr-1" />
              Request approval
            </Button>
          ) : null}
        </div>
      </div>

      {/* KPI Stat Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Awaiting Review</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">{counts.pending}</p>
          <div className="mt-1">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              counts.pending > 0 ? "bg-warning/15 text-warning" : "bg-surface-alt text-muted-foreground"
            )}>
              {counts.pending > 0 ? "Needs sign-off" : "Queue clear"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Changes Requested</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">{counts.changes}</p>
          <div className="mt-1">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              counts.changes > 0 ? "bg-orange/15 text-orange" : "bg-surface-alt text-muted-foreground"
            )}>
              {counts.changes > 0 ? "Revision active" : "None pending"}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Approved</p>
          <p className="font-sora text-2xl sm:text-3xl font-bold text-foreground leading-none">{counts.approved}</p>
          <div className="mt-1">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-success/15 text-success">
              Ready for release
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Critical Priority</p>
          <p className={cn(
            "font-sora text-2xl sm:text-3xl font-bold leading-none",
            counts.critical > 0 ? "text-destructive" : "text-foreground"
          )}>
            {counts.critical}
          </p>
          <div className="mt-1">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
              counts.critical > 0 ? "bg-destructive/15 text-destructive" : "bg-surface-alt text-muted-foreground"
            )}>
              {counts.critical > 0 ? "Urgent attention" : "Normal pacing"}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <Card className="flex items-center justify-between gap-3 border-destructive/40 px-4 py-3 text-sm">
          <span className="text-destructive">{error}</span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>Retry</Button>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title={filter === "queue" ? "Queue clear" : "No approvals found"}
          description={filter === "queue" ? "All proofs and items are currently reviewed." : "Create an approval request to initiate client or internal sign-off."}
        />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {queue.map((approval) => {
            const busy = busyId === approval.approvalId
            const open =
              approval.status === "pending" || approval.status === "changes_requested"
            return (
              <li key={approval.approvalId}>
                <Card
                  className={cn(
                    "p-5 rounded-2xl border border-border bg-card shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] hover:shadow-md transition-all flex flex-col gap-3",
                    approval.priority === "critical" && "border-l-4 border-l-destructive",
                    approval.priority === "high" && "border-l-4 border-l-orange"
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-muted-foreground font-mono text-[11px] font-medium">
                          {approval.approvalId.length > 12 ? `#${approval.approvalId.slice(0, 8)}` : approval.approvalId}
                        </span>

                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-surface-alt text-muted-foreground border border-border capitalize">
                          {approval.entityType}
                        </span>

                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                            approval.status === "approved"
                              ? "bg-success/15 text-success border border-success/20"
                              : approval.status === "changes_requested"
                              ? "bg-warning/15 text-warning border border-warning/20"
                              : approval.status === "rejected"
                              ? "bg-destructive/15 text-destructive border border-destructive/20"
                              : "bg-primary/15 text-primary border border-primary/20"
                          )}
                        >
                          {approval.status.replace("_", " ")}
                        </span>

                        {approval.priority ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              approval.priority === "critical"
                                ? "bg-destructive/15 text-destructive border border-destructive/20"
                                : approval.priority === "high"
                                ? "bg-orange/15 text-orange border border-orange/20"
                                : approval.priority === "medium"
                                ? "bg-primary/15 text-primary border border-primary/20"
                                : "bg-surface-alt text-muted-foreground border border-border"
                            )}
                          >
                            {approval.priority}
                          </span>
                        ) : null}
                      </div>

                      {/* Title */}
                      <h3 className="font-sora text-base font-semibold text-foreground leading-snug">
                        {approval.title}
                      </h3>

                      {/* Meta information */}
                      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        <span>
                          {approval.requester || "Staff"} → <span className="text-foreground font-medium">{approval.reviewer || "Client Reviewer"}</span>
                        </span>

                        {approval.dueDate && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="size-3 text-muted-foreground" />
                              due {new Date(approval.dueDate).toLocaleDateString()}
                            </span>
                          </>
                        )}

                        {approval.projectId && (
                          <>
                            <span>·</span>
                            <Link
                              to={`/projects/${approval.projectId}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {projects.find((p) => p.projectId === approval.projectId)?.projectName || "Project"}
                            </Link>
                          </>
                        )}

                        {approval.clientId && (
                          <>
                            <span>·</span>
                            <Link
                              to={`/clients/${approval.clientId}`}
                              className="text-primary hover:underline font-medium"
                            >
                              {clients.find((c) => c.clientId === approval.clientId)?.name || "Client"}
                            </Link>
                          </>
                        )}
                      </div>

                      {approval.notes ? (
                        <p className="text-muted-foreground mt-2 text-xs bg-surface-alt/60 p-2.5 rounded-lg border border-border/60">
                          {approval.notes}
                        </p>
                      ) : null}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {open && canDecide ? (
                        <>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => openDecision(approval, "approved")}
                            className="bg-[#7a5cc2] text-white hover:bg-[#6a4eb2] shadow-xs rounded-lg text-xs"
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
                            className="border-warning/30 text-warning hover:bg-warning/10 rounded-lg text-xs"
                          >
                            <MessageSquareWarningIcon className="size-3.5" />
                            Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => openDecision(approval, "rejected")}
                            className="border-destructive/30 text-destructive hover:bg-destructive/10 rounded-lg text-xs"
                          >
                            <XIcon className="size-3.5" />
                            Reject
                          </Button>
                        </>
                      ) : open && !canDecide ? (
                        <span className="text-muted-foreground text-xs italic">Review only</span>
                      ) : null}

                      {/* Comments toggle */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedId(selectedId === approval.approvalId ? null : approval.approvalId)}
                        className={cn(
                          "rounded-lg text-xs",
                          selectedId === approval.approvalId ? "bg-surface-alt text-primary font-semibold" : "text-muted-foreground"
                        )}
                      >
                        <MessageSquareIcon className="size-3.5 mr-1" />
                        Comments
                      </Button>

                      {approval.clientId && open ? (
                        <>
                          <ShareWithClientToggle
                            clientId={approval.clientId}
                            entityType="APPROVAL"
                            entityId={approval.approvalId}
                            clientVisible={approval.clientVisible}
                            size="sm"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={nudgeBusyId === approval.approvalId}
                            onClick={async () => {
                              setNudgeBusyId(approval.approvalId)
                              try {
                                const res = await nudgeApprovalClient(approval.approvalId)
                                toast.success(`Nudge sent to ${res.data?.to || "client"}`)
                              } catch (err) {
                                toast.error(err instanceof ApiError ? err.message : "Nudge failed")
                              } finally {
                                setNudgeBusyId(null)
                              }
                            }}
                            className="border-amber-700/40 text-amber-500 hover:bg-amber-500/10 gap-1 rounded-lg text-xs"
                          >
                            {nudgeBusyId === approval.approvalId ? (
                              <Loader2Icon className="size-3 animate-spin" />
                            ) : (
                              <BellIcon className="size-3" />
                            )}
                            Nudge
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {selectedId === approval.approvalId ? (
                    <div className="mt-3 pt-3 border-t border-border/60">
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
            <Label htmlFor="approval-form-project">Project</Label>
            <select
              id="approval-form-project"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">No linked project</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-client">Client</Label>
            <select
              id="approval-form-client"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="">No linked client</option>
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.name}
                </option>
              ))}
            </select>
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
