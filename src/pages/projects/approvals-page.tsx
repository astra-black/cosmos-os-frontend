import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  LayersIcon,
  Loader2Icon,
  LockIcon,
  MessageSquareWarningIcon,
  PlusIcon,
  ShieldIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { ShareWithClientToggle } from "@/components/shared/share-with-client-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  createApproval,
  createDirectShareToken,
  decideApproval,
  getAsset,
  listApprovals,
  nudgeApprovalClient,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import { useClients, useProjects } from "@/hooks/use-agency-data"
import type { Approval, Asset } from "@/types/agency"
import { cn } from "@/lib/utils"

const ENTITY_TYPES = ["asset", "deliverable", "budget", "other"] as const
const PRIORITIES = ["low", "medium", "high", "critical"] as const
type ApprovalDecision = "approved" | "rejected" | "changes_requested"
type SideTab = "comments" | "versions" | "details"
type ReviewKind = "video" | "deck" | "other"

function fileHref(url?: string | null) {
  if (!url) return null
  if (url.startsWith("http")) return url
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? ""
  return `${base}${url.startsWith("/") ? url : `/${url}`}`
}

function formatDue(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function classifyReview(approval: Approval, asset: Asset | null): ReviewKind {
  const hay = [
    approval.assetFileType,
    approval.assetUrl,
    approval.assetName,
    asset?.fileType,
    asset?.fileUrl,
    asset?.originalFileName,
    asset?.assetName,
    ...(approval.assetFiles || []).flatMap((f) => [f.mimeType, f.filename, f.url]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (/video\/|\/mp4|\.mp4|\.mov|\.webm|\.m4v|video/.test(hay)) return "video"
  if (
    /pdf|powerpoint|presentation|\.ppt|\.pptx|\.key|image\/|\.png|\.jpe?g|\.webp|\.gif|deck/.test(
      hay,
    )
  ) {
    return "deck"
  }
  if (approval.entityType === "deliverable") return "deck"
  return "other"
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ")
}

export function ApprovalsPage() {
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: clients } = useClients()
  const [searchParams] = useSearchParams()
  const scopedProjectId = searchParams.get("projectId") || ""
  const canDecide = canPerform(user?.role, "decide_approval")
  const canRequest =
    canPerform(user?.role, "write_crm") ||
    canPerform(user?.role, "write_ops") ||
    canDecide
  const canShare = canPerform(user?.role, "write_crm")

  const [approvals, setApprovals] = useState<Approval[]>([])
  const [filter, setFilter] = useState<"queue" | "all">("queue")
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [assetLoading, setAssetLoading] = useState(false)
  const [assetError, setAssetError] = useState<string | null>(null)
  const [sideTab, setSideTab] = useState<SideTab>("comments")
  const [deckFileIndex, setDeckFileIndex] = useState(0)

  const [decisionTarget, setDecisionTarget] = useState<{
    approval: Approval
    decision: ApprovalDecision
  } | null>(null)
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

  const [deliverOpen, setDeliverOpen] = useState(false)
  const [deliverBusy, setDeliverBusy] = useState(false)
  const [deliverExpiresHours, setDeliverExpiresHours] = useState(720)
  const [deliverResult, setDeliverResult] = useState<{
    shareUrl: string
    expiresAt: string
    sent: boolean
  } | null>(null)

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

  useEffect(() => {
    if (!selectedId && queue[0]) setSelectedId(queue[0].approvalId)
    if (selectedId && !approvals.some((a) => a.approvalId === selectedId)) {
      setSelectedId(queue[0]?.approvalId ?? null)
    }
  }, [queue, selectedId, approvals])

  const selected = useMemo(
    () => approvals.find((a) => a.approvalId === selectedId) ?? null,
    [approvals, selectedId],
  )

  const assetId = selected?.assetId || (selected?.entityType === "asset" ? selected.entityId : null)

  useEffect(() => {
    setDeckFileIndex(0)
    setSideTab("comments")
    setDeliverOpen(false)
    setDeliverResult(null)
    setAsset(null)
    setAssetError(null)
    if (!assetId) return
    if (selected?.assetUrl || selected?.assetFileType) {
      // List payload already carries asset summary; still try GET for freshest fileUrl.
    }
    let cancelled = false
    setAssetLoading(true)
    void getAsset(assetId)
      .then((res) => {
        if (!cancelled) setAsset(res.data ?? null)
      })
      .catch((err) => {
        if (!cancelled) {
          setAsset(null)
          setAssetError(err instanceof ApiError ? err.message : "Asset unavailable")
        }
      })
      .finally(() => {
        if (!cancelled) setAssetLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assetId, selected?.approvalId, selected?.assetUrl, selected?.assetFileType])

  const reviewKind = selected ? classifyReview(selected, asset) : "other"
  const mediaUrl =
    fileHref(asset?.fileUrl) ||
    fileHref(selected?.assetUrl) ||
    fileHref(selected?.assetFiles?.[deckFileIndex]?.url) ||
    null
  const versionLabel = asset?.version || selected?.assetVersion || "—"
  const open =
    selected?.status === "pending" || selected?.status === "changes_requested"
  const isApproved = selected?.status === "approved"

  const deckPages = useMemo(() => {
    const files = selected?.assetFiles?.filter((f) => f.url) || []
    if (files.length) return files
    if (mediaUrl) {
      return [
        {
          url: selected?.assetUrl || asset?.fileUrl || mediaUrl,
          filename: asset?.originalFileName || selected?.assetName || selected?.title || "File",
          mimeType: asset?.fileType || selected?.assetFileType || null,
        },
      ]
    }
    return []
  }, [selected, asset, mediaUrl])

  async function decide(approval: Approval, decision: ApprovalDecision) {
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
      setDecisionNotes("")
      toast.success(`${approval.title} → ${decision.replace("_", " ")}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Decision failed")
    } finally {
      setBusyId(null)
    }
  }

  function openDecision(approval: Approval, decision: ApprovalDecision) {
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

  async function createDeliveryLink() {
    if (!selected?.clientId || !canShare) return
    if (!isApproved) {
      toast.error("Delivery is only available after approval")
      return
    }
    if (!selected.clientVisible) {
      toast.error("Mark this approval visible to the client before creating a delivery link")
      return
    }
    setDeliverBusy(true)
    setDeliverResult(null)
    try {
      // Final Delivery always targets the APPROVAL so the server can enforce
      // APPROVED + clientVisible + agency/client tenancy.
      const res = await createDirectShareToken(selected.clientId, {
        entityType: "APPROVAL",
        entityId: selected.approvalId,
        entityTitle: selected.title,
        expiresInHours: deliverExpiresHours,
        purpose: "delivery",
      })
      const data = res.data
      if (!data?.shareUrl) throw new Error("No share URL returned")
      setDeliverResult({
        shareUrl: data.shareUrl,
        expiresAt: data.expiresAt,
        sent: Boolean(data.sent),
      })
      toast.success("Delivery link created — copy to share. Nothing was emailed.")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create delivery link")
    } finally {
      setDeliverBusy(false)
    }
  }

  const metaLine = selected
    ? [
        versionLabel !== "—" ? versionLabel : null,
        selected.requester || null,
        formatDue(selected.dueDate) ? `due ${formatDue(selected.dueDate)}` : null,
        selected.reviewer ? `reviewer: ${selected.reviewer}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : ""

  return (
    <div className="cosmos-reviews-page">
      <div className="cosmos-reviews-page__title-row">
        <div>
          <p className="cosmos-reviews-page__eyebrow">Reviews</p>
          <h1>Reviews</h1>
        </div>
        <div className="cosmos-reviews-page__actions">
          {canRequest ? (
            <Button size="sm" className="rounded-full" onClick={() => setCreateOpen(true)}>
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
      </div>

      {error ? (
        <div className="cosmos-reviews-page__error" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="cosmos-reviews-layout">
          <Skeleton className="h-[520px] rounded-2xl" />
          <Skeleton className="h-[520px] rounded-2xl" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title={filter === "queue" ? "Queue clear" : "No approvals yet"}
          description={
            filter === "queue"
              ? "Nothing waiting for review."
              : "Create an approval request to start a review."
          }
        />
      ) : (
        <div className="cosmos-reviews-layout">
          <aside className="cosmos-reviews-queue" aria-label="Review queue">
            <p className="cosmos-reviews-queue__label">
              {filter === "queue" ? "Waiting" : "All"} · {queue.length}
            </p>
            <ul>
              {queue.map((approval) => {
                const kind = classifyReview(approval, null)
                return (
                  <li key={approval.approvalId}>
                    <button
                      type="button"
                      className={cn(
                        "cosmos-reviews-queue__item",
                        selectedId === approval.approvalId && "is-active",
                      )}
                      onClick={() => setSelectedId(approval.approvalId)}
                    >
                      <span className="cosmos-reviews-queue__kind">{kind}</span>
                      <strong>{approval.title}</strong>
                      <span className="cosmos-reviews-queue__meta">
                        {statusLabel(approval.status)}
                        {approval.priority ? ` · ${approval.priority}` : ""}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>

          {selected ? (
            <section className="cosmos-reviews-workspace">
              <header className="cosmos-reviews-workspace__head">
                <div className="min-w-0">
                  <h2>{selected.title}</h2>
                  <p>{metaLine || "No asset metadata on this approval"}</p>
                </div>
                <div className="cosmos-reviews-workspace__head-actions">
                  {selected.clientVisible && selected.clientName ? (
                    <span className="cosmos-reviews-vis">
                      <EyeIcon className="size-3.5" />
                      Visible to {selected.clientName}
                    </span>
                  ) : selected.clientId ? (
                    <span className="cosmos-reviews-vis is-internal">
                      <LockIcon className="size-3.5" />
                      Internal until shared
                    </span>
                  ) : null}
                  {isApproved && selected.clientId && canShare ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDeliverResult(null)
                        setDeliverOpen(true)
                      }}
                    >
                      Deliver final files
                    </Button>
                  ) : null}
                </div>
              </header>

              <div
                className={cn(
                  "cosmos-reviews-workspace__body",
                  reviewKind === "deck" && "is-deck",
                )}
              >
                <div className="cosmos-reviews-stage">
                  {assetLoading ? (
                    <Skeleton className="cosmos-reviews-player h-[360px] w-full rounded-2xl" />
                  ) : reviewKind === "video" && mediaUrl ? (
                    <div className="cosmos-reviews-player">
                      <video
                        key={mediaUrl}
                        controls
                        src={mediaUrl}
                        className="cosmos-reviews-player__media"
                      >
                        <track kind="captions" />
                      </video>
                      <p className="cosmos-reviews-gap">
                        Timecode pins and moment-tagged comments are not stored yet — use Comments
                        below.
                      </p>
                    </div>
                  ) : reviewKind === "deck" && deckPages.length > 0 ? (
                    <div className="cosmos-reviews-deck">
                      {deckPages.length > 1 ? (
                        <div className="cosmos-reviews-deck__thumbs" aria-label="Pages">
                          {deckPages.map((page, index) => {
                            const href = fileHref(page.url) || "#"
                            const isImage = /image\//.test(page.mimeType || "") || /\.(png|jpe?g|webp|gif)$/i.test(page.filename || page.url || "")
                            return (
                              <button
                                key={`${page.url}-${index}`}
                                type="button"
                                className={cn(
                                  "cosmos-reviews-deck__thumb",
                                  deckFileIndex === index && "is-active",
                                )}
                                onClick={() => setDeckFileIndex(index)}
                              >
                                {isImage ? (
                                  <img src={href} alt="" />
                                ) : (
                                  <span>{index + 1}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                      <div className="cosmos-reviews-deck__page">
                        {(() => {
                          const page = deckPages[deckFileIndex]
                          const href = fileHref(page?.url)
                          if (!href) {
                            return (
                              <div className="cosmos-reviews-unavailable">
                                No file URL on this asset.
                              </div>
                            )
                          }
                          const isPdf = /pdf/i.test(page?.mimeType || "") || /\.pdf$/i.test(page?.filename || href)
                          const isImage =
                            /image\//.test(page?.mimeType || "") ||
                            /\.(png|jpe?g|webp|gif)$/i.test(page?.filename || href)
                          if (isPdf) {
                            return <iframe title="Deck preview" src={href} className="cosmos-reviews-deck__frame" />
                          }
                          if (isImage) {
                            return <img src={href} alt={selected.title} className="cosmos-reviews-deck__image" />
                          }
                          return (
                            <div className="cosmos-reviews-unavailable">
                              <p>Preview unavailable for this file type.</p>
                              <a href={href} target="_blank" rel="noreferrer">
                                Open file
                              </a>
                            </div>
                          )
                        })()}
                        <p className="cosmos-reviews-gap">
                          Page pins and multi-step approval chains are not in the schema — status is
                          a single decision on this record.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="cosmos-reviews-unavailable">
                      {assetError ? (
                        <p>{assetError}</p>
                      ) : !assetId ? (
                        <p>
                          This approval is not linked to an asset file ({selected.entityType}
                          {selected.entityId ? ` · ${selected.entityId.slice(0, 8)}` : ""}). Video and
                          deck previews need an asset with a stored URL.
                        </p>
                      ) : (
                        <p>
                          No playable or previewable file on this asset yet. Upload a file on Assets,
                          then reopen this review.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="cosmos-reviews-bar">
                    <div className="cosmos-reviews-bar__left">
                      <span className="cosmos-reviews-seg">{versionLabel}</span>
                      {mediaUrl ? (
                        <Button size="sm" variant="ghost" render={<a href={mediaUrl} download target="_blank" rel="noreferrer" />}>
                          <DownloadIcon className="size-3.5" />
                          Download
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled>
                          <DownloadIcon className="size-3.5" />
                          Download
                        </Button>
                      )}
                      {reviewKind === "deck" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          title="Version compare is unavailable — only the current asset version is stored"
                        >
                          <LayersIcon className="size-3.5" />
                          Compare
                        </Button>
                      ) : null}
                    </div>
                    <div className="cosmos-reviews-bar__right">
                      {open && canDecide ? (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyId === selected.approvalId}
                            onClick={() => openDecision(selected, "changes_requested")}
                          >
                            <MessageSquareWarningIcon className="size-3.5" />
                            Request Changes
                          </Button>
                          <Button
                            size="sm"
                            disabled={busyId === selected.approvalId}
                            onClick={() => openDecision(selected, "approved")}
                          >
                            {busyId === selected.approvalId ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <CheckIcon className="size-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === selected.approvalId}
                            onClick={() => openDecision(selected, "rejected")}
                          >
                            <XIcon className="size-3.5" />
                            Reject
                          </Button>
                        </>
                      ) : open && !canDecide ? (
                        <p className="cosmos-reviews-perm">View only — need PM/Producer to decide</p>
                      ) : (
                        <span className="cosmos-reviews-status capitalize">
                          {statusLabel(selected.status)}
                          {selected.decidedAt
                            ? ` · ${new Date(selected.decidedAt).toLocaleString()}`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <aside className="cosmos-reviews-side">
                  {reviewKind === "deck" ? (
                    <div className="cosmos-reviews-chain">
                      <div className="cosmos-reviews-chain__head">
                        <h3>Approval status</h3>
                        <span className="capitalize">{statusLabel(selected.status)}</span>
                      </div>
                      <ul>
                        <li>
                          <div>
                            <strong>{selected.requester || "Requester"}</strong>
                            <span>Prepared</span>
                          </div>
                          <span className="is-done">Recorded</span>
                        </li>
                        <li>
                          <div>
                            <strong>{selected.reviewer || "Reviewer"}</strong>
                            <span>Decision</span>
                          </div>
                          <span className={open ? "is-wait" : "is-done"}>
                            {open ? "Waiting" : statusLabel(selected.status)}
                          </span>
                        </li>
                      </ul>
                      <p className="cosmos-reviews-gap">
                        Multi-step chains are not modeled — only requester, reviewer, and one status
                        exist on this record.
                      </p>
                    </div>
                  ) : null}

                  <div className="cosmos-reviews-tabs" role="tablist">
                    {(
                      [
                        ["comments", "Comments"],
                        ["versions", "Versions"],
                        ["details", "Details"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={sideTab === id}
                        className={cn(sideTab === id && "is-active")}
                        onClick={() => setSideTab(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="cosmos-reviews-side__panel">
                    {sideTab === "comments" ? (
                      <CommentsPanel
                        entityType="approval"
                        entityId={selected.approvalId}
                        title="Comments"
                      />
                    ) : null}
                    {sideTab === "versions" ? (
                      <div className="cosmos-reviews-versions">
                        <div className="cosmos-reviews-versions__row is-active">
                          <strong>{versionLabel}</strong>
                          <span>Current asset version field</span>
                        </div>
                        <p className="cosmos-reviews-gap">
                          Historical version rows and compare are unavailable — Asset.version is a
                          single string.
                        </p>
                      </div>
                    ) : null}
                    {sideTab === "details" ? (
                      <dl className="cosmos-reviews-details">
                        <div>
                          <dt>Project</dt>
                          <dd>
                            {selected.projectId ? (
                              <Link to={`/projects/${selected.projectId}`}>
                                {selected.projectName ||
                                  projects.find((p) => p.projectId === selected.projectId)
                                    ?.projectName ||
                                  "Project"}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Client</dt>
                          <dd>
                            {selected.clientId
                              ? selected.clientName ||
                                clients.find((c) => c.clientId === selected.clientId)?.name ||
                                "Client"
                              : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt>Entity</dt>
                          <dd className="capitalize">
                            {selected.entityType}
                            {assetId ? ` · ${String(assetId).slice(0, 8)}` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt>Priority</dt>
                          <dd className="capitalize">{selected.priority || "—"}</dd>
                        </div>
                        {selected.notes ? (
                          <div>
                            <dt>Notes</dt>
                            <dd>{selected.notes}</dd>
                          </div>
                        ) : null}
                        {selected.clientId ? (
                          <div className="cosmos-reviews-details__share">
                            <ShareWithClientToggle
                              clientId={selected.clientId}
                              entityType="APPROVAL"
                              entityId={selected.approvalId}
                              clientVisible={selected.clientVisible}
                              size="sm"
                            />
                            {open ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={nudgeBusyId === selected.approvalId || !canShare}
                                onClick={async () => {
                                  setNudgeBusyId(selected.approvalId)
                                  try {
                                    const res = await nudgeApprovalClient(selected.approvalId)
                                    toast.success(`Nudge sent to ${res.data?.to || "client"}`)
                                  } catch (err) {
                                    toast.error(
                                      err instanceof ApiError ? err.message : "Nudge failed",
                                    )
                                  } finally {
                                    setNudgeBusyId(null)
                                  }
                                }}
                              >
                                {nudgeBusyId === selected.approvalId ? (
                                  <Loader2Icon className="size-3 animate-spin" />
                                ) : null}
                                Nudge client
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                  </div>
                </aside>
              </div>
            </section>
          ) : null}
        </div>
      )}

      {deliverOpen && selected ? (
        <div className="cosmos-reviews-modal" role="presentation">
          <button
            type="button"
            className="cosmos-reviews-modal__scrim"
            aria-label="Close delivery"
            onClick={() => !deliverBusy && setDeliverOpen(false)}
          />
          <div className="cosmos-reviews-modal__dialog" role="dialog" aria-labelledby="deliver-title">
            <h2 id="deliver-title">Deliver Final Files</h2>
            {isApproved ? (
              <div className="cosmos-reviews-banner is-success">
                <strong>Approval complete</strong>
                <span>
                  {selected.title} was approved
                  {selected.decidedAt
                    ? ` on ${new Date(selected.decidedAt).toLocaleString()}`
                    : ""}
                  {selected.reviewer ? ` by ${selected.reviewer}` : ""}.
                </span>
              </div>
            ) : (
              <div className="cosmos-reviews-banner is-warn">
                <strong>Not approved</strong>
                <span>Delivery requires an approved record.</span>
              </div>
            )}
            {!selected.clientVisible ? (
              <div className="cosmos-reviews-banner is-warn">
                <strong>Not client-visible</strong>
                <span>
                  Share with client must be on before a delivery link can be created. Internal notes
                  stay off the public link either way.
                </span>
              </div>
            ) : null}
            <dl className="cosmos-reviews-details">
              <div>
                <dt>Approval trail</dt>
                <dd>
                  Single decision · {statusLabel(selected.status)}
                  {isApproved ? " · locked for delivery" : ""}
                </dd>
              </div>
              <div>
                <dt>Usage rights</dt>
                <dd className="cosmos-reviews-gap">
                  Not recorded on this approval — unavailable.
                </dd>
              </div>
              <div>
                <dt>Final files</dt>
                <dd>
                  {mediaUrl ? (
                    <a href={mediaUrl} target="_blank" rel="noreferrer">
                      {asset?.assetName || selected.assetName || selected.title}
                    </a>
                  ) : (
                    "No file URL on linked asset — the public link will show unavailable until a file is stored and client-visible"
                  )}
                </dd>
              </div>
            </dl>
            <div className="cosmos-reviews-deliver-fields">
              <div>
                <Label>Deliver to</Label>
                <Input
                  value={
                    selected.clientName ||
                    clients.find((c) => c.clientId === selected.clientId)?.name ||
                    "Linked client"
                  }
                  readOnly
                />
                <p className="cosmos-reviews-gap">
                  Link is scoped to this client. Creating a link does not email or notify anyone.
                </p>
              </div>
              <div>
                <Label htmlFor="deliver-expires">Link expires</Label>
                <select
                  id="deliver-expires"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                  value={deliverExpiresHours}
                  onChange={(e) => setDeliverExpiresHours(Number(e.target.value))}
                >
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                </select>
              </div>
            </div>
            <p className="cosmos-reviews-note">
              <ShieldIcon className="size-3.5" />
              Creates a passwordless delivery token for an APPROVED, client-visible approval. The
              public page only exposes the client-visible file (if any). Vendor costs and internal
              notes are never included. No send/email runs from this action.
            </p>
            {deliverResult ? (
              <div className="cosmos-reviews-deliver-result">
                <div className="cosmos-reviews-banner is-success">
                  <strong>Link created</strong>
                  <span>
                    {deliverResult.sent
                      ? "Delivery notification was recorded."
                      : "Not sent — copy the URL and share it yourself. Email delivery is not wired."}
                  </span>
                </div>
                <Label>Share URL</Label>
                <Input value={deliverResult.shareUrl} readOnly />
                <p className="cosmos-reviews-gap">
                  Expires {new Date(deliverResult.expiresAt).toLocaleString()}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(deliverResult.shareUrl)
                      toast.success("Copied")
                    } catch {
                      toast.error("Could not copy")
                    }
                  }}
                >
                  Copy link
                </Button>
              </div>
            ) : null}
            <div className="cosmos-reviews-modal__footer">
              <Button
                variant="ghost"
                disabled={deliverBusy}
                onClick={() => setDeliverOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  deliverBusy ||
                  !isApproved ||
                  !selected.clientId ||
                  !canShare ||
                  !selected.clientVisible
                }
                onClick={() => void createDeliveryLink()}
              >
                {deliverBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                Create Delivery Link
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <EntityFormDialog
        open={createOpen && canRequest}
        onOpenChange={(openState) => {
          if (!openState && !createBusy) {
            setCreateOpen(false)
            setFormError(null)
          }
        }}
        title="Request an approval"
        description="Create a review item for an asset, deliverable, or budget ask. Project is required when using the database."
        onSubmit={create}
        submitLabel="Create request"
        pending={createBusy}
        submitDisabled={!form.title.trim() || !form.entityId.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="approval-form-title">Title</Label>
            <Input
              id="approval-form-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Approval title"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-entity-id">Entity ID</Label>
            <Input
              id="approval-form-entity-id"
              value={form.entityId}
              onChange={(e) => setForm({ ...form, entityId: e.target.value })}
              placeholder="Asset or deliverable ID"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-entity-type">Entity type</Label>
            <select
              id="approval-form-entity-type"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value })}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type[0].toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-priority">Priority</Label>
            <select
              id="approval-form-priority"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority[0].toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-due-date">Due date</Label>
            <Input
              id="approval-form-due-date"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
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
            <Input
              id="approval-form-requester"
              value={form.requester}
              onChange={(e) => setForm({ ...form, requester: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="approval-form-reviewer">Reviewer</Label>
            <Input
              id="approval-form-reviewer"
              value={form.reviewer}
              onChange={(e) => setForm({ ...form, reviewer: e.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="approval-form-notes">Notes</Label>
          <Textarea
            id="approval-form-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional context for the reviewer"
          />
        </div>
        {formError ? <p className="text-destructive text-xs">{formError}</p> : null}
      </EntityFormDialog>

      <EntityFormDialog
        open={decisionTarget !== null}
        onOpenChange={(openState) => {
          if (!openState && !busyId) {
            setDecisionTarget(null)
            setDecisionNotes("")
          }
        }}
        title={
          decisionTarget
            ? `Decision: ${decisionTarget.decision.replace("_", " ")}`
            : "Approval decision"
        }
        description={
          decisionTarget
            ? `Add optional notes for ${decisionTarget.approval.title}. Notes are required when requesting changes.`
            : undefined
        }
        onSubmit={() =>
          decisionTarget ? decide(decisionTarget.approval, decisionTarget.decision) : undefined
        }
        submitLabel={
          decisionTarget?.decision === "changes_requested"
            ? "Request changes"
            : decisionTarget?.decision === "approved"
              ? "Approve"
              : "Reject"
        }
        pending={Boolean(
          decisionTarget && busyId === decisionTarget.approval.approvalId,
        )}
        submitDisabled={
          decisionTarget?.decision === "changes_requested" && !decisionNotes.trim()
        }
      >
        <div className="grid gap-1.5">
          <Label htmlFor="approval-decision-notes">Decision notes</Label>
          <Textarea
            id="approval-decision-notes"
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
            placeholder="Optional for approve or reject; required for requested changes"
            autoFocus
          />
        </div>
      </EntityFormDialog>
    </div>
  )
}
