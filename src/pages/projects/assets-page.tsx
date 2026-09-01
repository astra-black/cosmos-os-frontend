import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  CheckSquareIcon,
  FileIcon,
  FilterIcon,
  FolderOpenIcon,
  Loader2Icon,
  SearchIcon,
  UploadIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { CommentsPanel } from "@/components/shared/comments-panel"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssets, useProjects } from "@/hooks/use-agency-data"
import { createApproval, deleteAsset, updateAsset, uploadAsset } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Asset } from "@/types/agency"
import { cn } from "@/lib/utils"

function fileHref(url?: string | null) {
  if (!url) return null
  if (url.startsWith("http")) return url
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? ""
  return `${base}${url.startsWith("/") ? url : `/${url}`}`
}

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
const ASSET_TAGS = ["draft", "final", "hero", "social"] as const
const ASSET_STATUSES = ["draft", "in_review", "approved", "archived"] as const

type AssetEditForm = {
  assetName: string
  projectId: string
  version: string
  status: string
  tags: string
  fileType: string
  fileSize: string
  fileUrl: string
}

export function AssetsPage() {
  const { user } = useAuth()
  const canRequest =
    canPerform(user?.role, "write_crm") ||
    canPerform(user?.role, "write_ops") ||
    canPerform(user?.role, "decide_approval")

  const { data: assets, loading, error, reload: reloadAssets } = useAssets()
  const { data: projectsList } = useProjects()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [requestBusy, setRequestBusy] = useState(false)
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [editTarget, setEditTarget] = useState<Asset | null>(null)
  const [assetEditForm, setAssetEditForm] = useState<AssetEditForm>({
    assetName: "",
    projectId: "",
    version: "",
    status: "draft",
    tags: "",
    fileType: "",
    fileSize: "",
    fileUrl: "",
  })
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadProjectId, setUploadProjectId] = useState("")
  const [uploadVersion, setUploadVersion] = useState("1.0")
  const [uploadStatus, setUploadStatus] = useState("draft")
  const [uploadTags, setUploadTags] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!uploadProjectId && projectsList[0]?.projectId) {
      setUploadProjectId(projectsList[0].projectId)
    }
  }, [projectsList, uploadProjectId])

  async function onUploadFile(file: File) {
    if (!canRequest) return
    if (!uploadVersion.trim()) {
      toast.error("Enter an asset version")
      return
    }
    setUploadBusy(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("assetName", file.name)
      if (uploadProjectId) {
        form.append("projectId", uploadProjectId)
        const p = projectsList.find((x) => x.projectId === uploadProjectId)
        if (p) form.append("projectName", p.projectName)
      }
      form.append("version", uploadVersion.trim())
      form.append("status", uploadStatus)
      if (uploadTags.length > 0) form.append("tags", uploadTags.join(","))
      const res = await uploadAsset(form)
      await reloadAssets()
      if (res.data?.assetId) setSelectedId(res.data.assetId)
      toast.success("File uploaded", {
        description: res.data?.fileUrl || file.name,
      })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed")
    } finally {
      setUploadBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

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

  function assetId(asset: Asset) {
    return asset.assetId || asset.recordId || ""
  }

  function startEditAsset(asset: Asset) {
    if (!canRequest || !assetId(asset)) return
    setEditTarget(asset)
    setAssetEditForm({
      assetName: asset.assetName,
      projectId: asset.projectId ?? "",
      version: asset.version ?? "",
      status: asset.status ?? "draft",
      tags: asset.tags?.join(", ") ?? "",
      fileType: asset.fileType ?? "",
      fileSize: asset.fileSize == null ? "" : String(asset.fileSize),
      fileUrl: asset.fileUrl ?? "",
    })
  }

  async function saveAsset() {
    if (!editTarget || !canRequest || !assetId(editTarget)) return
    const name = assetEditForm.assetName.trim()
    const version = assetEditForm.version.trim()
    const fileType = assetEditForm.fileType.trim()
    const fileSize = assetEditForm.fileSize.trim()
    const fileUrl = assetEditForm.fileUrl.trim()
    if (!name) {
      toast.error("Asset name is required")
      return
    }
    if (!version) {
      toast.error("Asset version is required")
      return
    }
    if (!ASSET_STATUSES.includes(assetEditForm.status as (typeof ASSET_STATUSES)[number])) {
      toast.error("Select a valid asset status")
      return
    }
    if (fileSize && (!/^\d+$/.test(fileSize) || Number(fileSize) < 0)) {
      toast.error("File size must be a non-negative whole number")
      return
    }
    if (fileUrl && fileUrl !== (editTarget.fileUrl ?? "")) {
      try {
        new URL(fileUrl)
      } catch {
        toast.error("File URL must be a valid URL")
        return
      }
    }

    const projectId = assetEditForm.projectId.trim()
    const project = projectsList.find((item) => item.projectId === projectId)
    const projectName = project?.projectName ??
      (projectId === (editTarget.projectId ?? "") ? editTarget.projectName ?? null : null)
    const fileUrlChanged = fileUrl !== (editTarget.fileUrl ?? "")
    setPendingAssetId(assetId(editTarget))
    try {
      await updateAsset(assetId(editTarget), {
        assetName: name,
        projectId: projectId || null,
        projectName,
        version,
        status: assetEditForm.status,
        tags: assetEditForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        ...(fileType ? { fileType } : {}),
        ...(fileSize ? { fileSize: Number(fileSize) } : {}),
        ...(fileUrlChanged ? { fileUrl: fileUrl || null } : {}),
      })
      await reloadAssets()
      toast.success("Asset updated")
      setEditTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to update asset")
    } finally {
      setPendingAssetId(null)
    }
  }

  async function removeAsset() {
    if (!deleteTarget || !canRequest || !assetId(deleteTarget)) return
    const id = assetId(deleteTarget)
    setPendingAssetId(id)
    try {
      await deleteAsset(id)
      await reloadAssets()
      if (selectedId === id) setSelectedId(null)
      toast.success("Asset deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to delete asset")
    } finally {
      setPendingAssetId(null)
      setDeleteTarget(null)
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

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {/* Upload strip */}
      {canRequest ? (
        <Card className="flex flex-col gap-3 p-3">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onUploadFile(f)
            }}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
            value={uploadProjectId}
            onChange={(e) => setUploadProjectId(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm sm:max-w-[14rem]"
          >
            <option value="">No project</option>
            {projectsList.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName}
              </option>
            ))}
            </select>
            <Input placeholder="Version *" value={uploadVersion} onChange={(e) => setUploadVersion(e.target.value)} />
            <select
              value={uploadStatus}
              onChange={(e) => setUploadStatus(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="in_review">In review</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>
            <div className="border-input flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-2 text-xs">
              {ASSET_TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={uploadTags.includes(tag)}
                    onChange={(e) => setUploadTags((current) => e.target.checked ? [...current, tag] : current.filter((item) => item !== tag))}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            size="sm"
            disabled={uploadBusy}
            onClick={() => fileRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {uploadBusy ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <UploadIcon className="size-3.5" />
            )}
            Upload file
          </Button>
          <p className="text-muted-foreground text-xs sm:ml-auto">
            Max 25MB · stored on API server (/uploads)
          </p>
          </div>
        </Card>
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
              const id = assetId(asset)
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
                  {selectedAsset.fileUrl ? (
                    <a
                      href={fileHref(selectedAsset.fileUrl) || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm underline-offset-2 hover:underline"
                    >
                      Open file ({selectedAsset.originalFileName || selectedAsset.fileType})
                    </a>
                  ) : null}
                   {canRequest ? (
                     <div className="flex flex-wrap gap-2">
                       <Button
                         size="sm"
                         disabled={requestBusy || Boolean(pendingAssetId)}
                         onClick={() => void requestApproval(selectedAsset)}
                       >
                         {requestBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckSquareIcon className="size-3.5" />}
                         Request approval
                       </Button>
                        <Button size="sm" variant="outline" disabled={Boolean(pendingAssetId)} onClick={() => startEditAsset(selectedAsset)}>
                         <PencilIcon className="size-3.5" />Edit
                       </Button>
                       <Button size="sm" variant="destructive" disabled={Boolean(pendingAssetId)} onClick={() => setDeleteTarget(selectedAsset)}>
                         <Trash2Icon className="size-3.5" />Delete
                       </Button>
                     </div>
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
      <EntityFormDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open && !pendingAssetId) setEditTarget(null)
        }}
        title="Edit asset metadata"
        description="Update the asset details used for delivery and review."
        onSubmit={saveAsset}
        submitLabel="Save changes"
        pending={Boolean(editTarget && pendingAssetId === assetId(editTarget))}
        submitDisabled={!assetEditForm.assetName.trim() || !assetEditForm.version.trim()}
        maxWidth="max-w-2xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="asset-edit-name">Asset name</Label>
            <Input
              id="asset-edit-name"
              value={assetEditForm.assetName}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, assetName: event.target.value }))}
              placeholder="Asset name"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-edit-project">Project</Label>
            <Select
              id="asset-edit-project"
              value={assetEditForm.projectId}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, projectId: event.target.value }))}
            >
              <option value="">No project</option>
              {projectsList.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.projectName}
                </option>
              ))}
              {editTarget?.projectId && !projectsList.some((project) => project.projectId === editTarget.projectId) ? (
                <option value={editTarget.projectId}>
                  {editTarget.projectName || editTarget.projectId}
                </option>
              ) : null}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-edit-version">Version</Label>
            <Input
              id="asset-edit-version"
              value={assetEditForm.version}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, version: event.target.value }))}
              placeholder="1.0"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-edit-status">Status</Label>
            <Select
              id="asset-edit-status"
              value={assetEditForm.status}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, status: event.target.value }))}
            >
              {ASSET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-edit-tags">Tags</Label>
            <Input
              id="asset-edit-tags"
              value={assetEditForm.tags}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, tags: event.target.value }))}
              placeholder="hero, final"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-edit-type">File type</Label>
            <Input
              id="asset-edit-type"
              value={assetEditForm.fileType}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, fileType: event.target.value }))}
              placeholder="pdf"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="asset-edit-size">File size (bytes)</Label>
            <Input
              id="asset-edit-size"
              type="number"
              min="0"
              step="1"
              value={assetEditForm.fileSize}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, fileSize: event.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="asset-edit-url">File URL</Label>
            <Input
              id="asset-edit-url"
              type="url"
              value={assetEditForm.fileUrl}
              onChange={(event) => setAssetEditForm((form) => ({ ...form, fileUrl: event.target.value }))}
              placeholder="https://..."
            />
          </div>
        </div>
      </EntityFormDialog>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open && !pendingAssetId) setDeleteTarget(null) }}
        title="Delete asset?"
        description={deleteTarget ? `This will permanently delete “${deleteTarget.assetName}”.` : undefined}
        confirmLabel="Delete"
        destructive
        pending={Boolean(pendingAssetId)}
        onConfirm={removeAsset}
      />
    </div>
  )
}
