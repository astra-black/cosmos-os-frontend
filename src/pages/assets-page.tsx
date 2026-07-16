import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  CheckSquareIcon,
  FileIcon,
  FilterIcon,
  FolderOpenIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CommentsPanel } from "@/components/shared/comments-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createApproval, listAssets, normalizeAssets } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Asset } from "@/types/agency"
import { cn } from "@/lib/utils"

function formatBytes(n?: number) {
  if (n == null || n <= 0) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const statusTone: Record<string, string> = {
  approved: "bg-chart-2/15 text-foreground",
  in_review: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground opacity-80",
}

export function AssetsPage() {
  const { user } = useAuth()
  const canRequest =
    canPerform(user?.role, "write_crm") ||
    canPerform(user?.role, "write_ops") ||
    canPerform(user?.role, "decide_approval")

  const [assets, setAssets] = useState<Asset[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [requestBusy, setRequestBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await listAssets()
        if (cancelled) return
        setAssets(normalizeAssets(response))
        setMessage(response.message ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load assets")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of assets) {
      if (a.projectId) map.set(a.projectId, a.projectName || a.projectId)
    }
    return [...map.entries()]
  }, [assets])

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false
      if (projectFilter !== "all" && a.projectId !== projectFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = `${a.assetName} ${a.assetId} ${a.projectName ?? ""} ${a.fileType ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [assets, statusFilter, projectFilter, search])

  const byType = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of filtered) {
      const t = (a.fileType || "other").toUpperCase()
      map.set(t, (map.get(t) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [filtered])

  const selectedAsset = useMemo(
    () =>
      selectedId
        ? filtered.find((a) => (a.assetId || a.recordId) === selectedId) ?? null
        : null,
    [filtered, selectedId],
  )

  async function requestApproval(asset: Asset) {
    if (!canRequest || !asset.assetId) return
    setRequestBusy(true)
    try {
      await createApproval({
        title: `Review: ${asset.assetName}`,
        entityType: "asset",
        entityId: asset.assetId,
        ...(asset.projectId ? { projectId: asset.projectId } : {}),
        priority: "medium",
      })
      toast.success("Approval requested", {
        description: "Open /approvals to review the queue",
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not request approval")
    } finally {
      setRequestBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Asset library</h1>
        <p className="text-muted-foreground text-sm">
          Delivery files by project — filters for status, type, and search.
        </p>
      </div>

      {message ? (
        <p className="text-muted-foreground text-xs">{message}</p>
      ) : null}
      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {/* Toolbar */}
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets, IDs, projects…"
            className="pl-9"
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
            <FilterIcon className="size-4 shrink-0" />
            Filters
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm sm:h-8 sm:w-auto"
          >
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="in_review">In review</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm sm:h-8 sm:max-w-48"
          >
            <option value="all">All projects</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Type chips */}
      {!loading && byType.length > 0 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {byType.map(([type, count]) => (
            <Badge key={type} variant="secondary" className="shrink-0 font-normal tabular-nums">
              {type} · {count}
            </Badge>
          ))}
          <span className="text-muted-foreground self-center shrink-0 text-xs tabular-nums">
            {filtered.length} of {assets.length}
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-sm">
          <FolderOpenIcon className="size-8 opacity-40" />
          No assets match filters.
          {error ? (
            <span className="text-xs">Check VITE_COSMOS_API_KEY matches middleware COSMOS_API_KEYS.</span>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2",
              selectedId && "hidden lg:grid",
            )}
          >
            {filtered.map((asset) => {
              const id = asset.assetId || asset.recordId || ""
              const selected = selectedId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className={cn(
                    "bg-card flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors sm:p-4",
                    selected && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                      <FileIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{asset.assetName}</div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {asset.assetId}
                      </div>
                    </div>
                    {asset.status ? (
                      <Badge
                        className={cn(
                          "h-5 shrink-0 capitalize",
                          statusTone[asset.status] ?? "bg-muted",
                        )}
                      >
                        {asset.status.replace("_", " ")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="uppercase">{asset.fileType || "—"}</span>
                    <span className="text-right tabular-nums">
                      {formatBytes(asset.fileSize)}
                    </span>
                    <span>v{asset.version || "—"}</span>
                    <span className="truncate text-right">
                      {asset.projectName || asset.projectId || "—"}
                    </span>
                  </div>
                  {asset.tags && asset.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {asset.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="h-5 font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
          <div
            className={cn(
              "lg:sticky lg:top-20 lg:self-start",
              !selectedId && "hidden lg:block",
            )}
          >
            {selectedId && selectedAsset ? (
              <div className="flex flex-col gap-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-fit lg:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  ← Assets
                </Button>
                <Card className="space-y-3 p-4">
                  <div>
                    <div className="font-medium">{selectedAsset.assetName}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {selectedAsset.assetId}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">
                      {selectedAsset.projectId ? (
                        <Link
                          to={`/projects/${selectedAsset.projectId}`}
                          className="text-primary underline-offset-2 hover:underline"
                        >
                          {selectedAsset.projectName || selectedAsset.projectId}
                        </Link>
                      ) : (
                        (selectedAsset.projectName || "—")
                      )}
                      {selectedAsset.status
                        ? ` · ${selectedAsset.status.replace("_", " ")}`
                        : ""}
                    </div>
                  </div>
                  {canRequest ? (
                    <Button
                      size="sm"
                      disabled={requestBusy}
                      onClick={() => void requestApproval(selectedAsset)}
                      className="w-full sm:w-auto"
                    >
                      {requestBusy ? (
                        <Loader2Icon className="size-3.5 animate-spin" />
                      ) : (
                        <CheckSquareIcon className="size-3.5" />
                      )}
                      Request approval
                    </Button>
                  ) : null}
                  {canRequest ? (
                    <p className="text-muted-foreground text-xs">
                      Creates a pending review in{" "}
                      <Link
                        to="/approvals"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        /approvals
                      </Link>
                      .
                    </p>
                  ) : null}
                </Card>
                <CommentsPanel
                  entityType="asset"
                  entityId={selectedId}
                  title="Asset comments"
                />
              </div>
            ) : (
              <Card className="text-muted-foreground p-6 text-center text-sm">
                Select an asset to view comments
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
