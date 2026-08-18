import { useMemo, useState } from "react"
import {
  FileTextIcon,
  FilmIcon,
  HammerIcon,
  MailIcon,
  PaletteIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TruckIcon,
  UserIcon,
  Volume2Icon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useVendors } from "@/hooks/use-agency-data"
import { createVendor, deleteVendor, updateVendor } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Vendor } from "@/types/agency"
import { cn } from "@/lib/utils"

function getCategoryIcon(category: string) {
  switch (category?.toLowerCase()) {
    case "staging":
      return HammerIcon
    case "av":
      return Volume2Icon
    case "post":
      return FilmIcon
    case "guest_experience":
      return SparklesIcon
    case "design":
      return PaletteIcon
    default:
      return TruckIcon
  }
}

const STATUSES = ["preferred", "active", "trial", "inactive"] as const
const CATEGORIES = [
  "staging",
  "av",
  "post",
  "guest_experience",
  "design",
  "general",
] as const

export function VendorsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_crm")
  const {
    data: vendors,
    setData: setVendors,
    loading,
    error,
    reload,
  } = useVendors()
  const [category, setCategory] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    name: "",
    category: "general",
    contact: "",
    email: "",
    rateCard: "",
  })

  const categories = useMemo(() => {
    return [...new Set([...CATEGORIES, ...vendors.map((v) => v.category)])]
  }, [vendors])

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (category !== "all" && v.category !== category) return false
      if (statusFilter !== "all" && v.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const hay =
          `${v.name} ${v.contact ?? ""} ${v.email ?? ""} ${v.category} ${(v.skills ?? []).join(" ")}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [vendors, category, statusFilter, search])

  const preferred = vendors.filter((v) => v.status === "preferred").length

  async function patchVendor(vendor: Vendor, body: Partial<Vendor>, label: string) {
    if (!canWrite) return
    setBusyId(vendor.vendorId)
    setVendors((prev) =>
      prev.map((v) => (v.vendorId === vendor.vendorId ? { ...v, ...body } : v)),
    )
    try {
      const res = await updateVendor(vendor.vendorId, body)
      if (res.data) {
        setVendors((prev) =>
          prev.map((v) => (v.vendorId === vendor.vendorId ? { ...v, ...res.data } : v)),
        )
      }
      await reload()
      toast.success(label)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
      await reload().catch(() => undefined)
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreate() {
    if (!form.name.trim() || !canWrite) return
    try {
      await createVendor({
        name: form.name.trim(),
        category: form.category,
        contact: form.contact,
        email: form.email,
        rateCard: form.rateCard,
        status: "trial",
      })
      setForm({ name: "", category: "general", contact: "", email: "", rateCard: "" })
      setShowAdd(false)
      await reload()
      toast.success("Vendor added")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    }
  }

  async function handleDelete(vendor: Vendor) {
    if (!canWrite || !window.confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return
    setDeletingId(vendor.vendorId)
    try {
      await deleteVendor(vendor.vendorId)
      await reload()
      toast.success("Vendor deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Vendors"
        description="Preferred and active partners — staging, A/V, post, hospitality."
        actions={
          canWrite ? (
            <Button
              size="sm"
              variant={showAdd ? "default" : "outline"}
              onClick={() => setShowAdd((v) => !v)}
            >
              <PlusIcon className="size-3.5" />
              Add vendor
            </Button>
          ) : undefined
        }
      />

      <div className="bg-card flex flex-wrap gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-sm">
        <div>
          <span className="text-muted-foreground">Partners </span>
          <span className="font-semibold tabular-nums">{vendors.length}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Preferred </span>
          <span className="font-semibold tabular-nums">{preferred}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Showing </span>
          <span className="font-semibold tabular-nums">{filtered.length}</span>
        </div>
      </div>

      {showAdd && canWrite ? (
        <Card className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          <Input
            placeholder="Vendor name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm capitalize"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
          <Input
            placeholder="Contact"
            value={form.contact}
            onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
          />
          <Input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Rate card"
            value={form.rateCard}
            onChange={(e) => setForm((f) => ({ ...f, rateCard: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.name.trim()} onClick={() => void handleCreate()}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-destructive/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-destructive">{error}</span>
            <Button size="sm" variant="outline" onClick={() => void reload()}>Retry</Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, contact, skill…"
          className="w-full sm:max-w-sm"
        />
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
          <Button
            size="sm"
            variant={category === "all" ? "default" : "outline"}
            className="shrink-0 rounded-full"
            onClick={() => setCategory("all")}
          >
            All
          </Button>
          {categories.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={category === c ? "default" : "outline"}
              className="shrink-0 rounded-full capitalize"
              onClick={() => setCategory(c)}
            >
              {c.replace("_", " ")}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", ...STATUSES] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "secondary" : "ghost"}
              className="h-7 rounded-full capitalize text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<TruckIcon className="size-8 opacity-40" />} title="No vendors" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((vendor) => {
            const CategoryIcon = getCategoryIcon(vendor.category)
            return (
              <Card
                key={vendor.vendorId}
                className="relative overflow-hidden pl-5 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 bg-card border border-border rounded-xl p-5 flex flex-col justify-between min-h-[220px]"
              >
                {/* Status indicator strip on the left edge */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-[4px]",
                  vendor.status === "preferred" && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]",
                  vendor.status === "active" && "bg-primary",
                  vendor.status === "trial" && "bg-cyan-500",
                  vendor.status === "inactive" && "bg-muted-foreground/30"
                )} />

                {/* Background Category Watermark */}
                <CategoryIcon className="absolute -bottom-8 -right-8 size-32 opacity-[0.02] text-foreground pointer-events-none select-none" />

                {/* Top Section: Header */}
                  <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-sm tracking-tight text-foreground truncate">{vendor.name}</h2>
                    <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider mt-1">
                      {vendor.category.replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                  {canWrite ? (
                    <select
                      className={cn(
                        "h-6 shrink-0 rounded-full border px-2 text-[10px] font-mono font-medium capitalize outline-none bg-background cursor-pointer",
                        vendor.status === "preferred" && "border-amber-500/40 bg-amber-500/10 text-amber-500",
                        vendor.status === "active" && "border-primary/40 bg-primary/10 text-primary",
                        vendor.status === "trial" && "border-cyan-500/40 bg-cyan-500/10 text-cyan-500",
                      )}
                      value={vendor.status}
                      disabled={busyId === vendor.vendorId}
                      onChange={(e) =>
                        void patchVendor(
                          vendor,
                          { status: e.target.value },
                          `${vendor.name} → ${e.target.value}`,
                        )
                      }
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge
                      className={cn(
                        "capitalize text-[9px] font-mono py-0 h-4.5 px-2",
                        vendor.status === "preferred" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                        vendor.status === "active" ? "bg-primary/10 text-primary border-primary/30" :
                        "bg-muted text-muted-foreground border-transparent",
                      )}
                      variant="outline"
                    >
                      {vendor.status}
                    </Badge>
                  )}
                  {canWrite ? <Button size="icon" variant="ghost" className="size-7 text-destructive" disabled={deletingId === vendor.vendorId} onClick={() => void handleDelete(vendor)} aria-label={`Delete ${vendor.name}`}><Trash2Icon className="size-3.5" /></Button> : null}
                  </div>
                </div>

                {/* Rating Bar */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1 text-[11px] bg-muted/50 w-fit px-2 py-0.5 rounded border border-border/40 font-mono">
                    <StarIcon className={cn("size-3 fill-amber-500 text-amber-500", !vendor.rating && "fill-none text-muted-foreground/40")} />
                    <span className="font-bold text-foreground">
                      {vendor.rating?.toFixed(1) ?? "0.0"}
                    </span>
                  </div>
                  {canWrite ? (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={cn(
                            "text-muted-foreground/40 hover:text-amber-500 p-0.5 transition-colors",
                            (vendor.rating ?? 0) >= n && "text-amber-500",
                          )}
                          disabled={busyId === vendor.vendorId}
                          onClick={() =>
                            void patchVendor(vendor, { rating: n }, `Rated ${n}/5`)
                          }
                          aria-label={`Rate ${n}`}
                        >
                          <StarIcon
                            className={cn(
                              "size-3",
                              (vendor.rating ?? 0) >= n && "fill-current",
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Divider Line */}
                <div className="w-full h-px border-t border-dashed border-border/80 my-3" />

                {/* Contact Info Details */}
                <div className="flex flex-col gap-1 text-[11px] text-muted-foreground min-w-0">
                  {vendor.contact && (
                    <div className="inline-flex items-center gap-1.5 truncate">
                      <UserIcon className="size-3 shrink-0 text-muted-foreground/60" />
                      {vendor.contact}
                    </div>
                  )}
                  {vendor.email && (
                    <a
                      className="inline-flex items-center gap-1.5 truncate text-primary hover:underline font-mono"
                      href={`mailto:${vendor.email}`}
                    >
                      <MailIcon className="size-3 shrink-0 text-muted-foreground/60" />
                      {vendor.email}
                    </a>
                  )}
                  {vendor.rateCard && (
                    <div className="inline-flex items-center gap-1.5 bg-muted/40 w-fit px-2 py-0.5 rounded border border-border/40 font-mono mt-1">
                      <FileTextIcon className="size-3 text-muted-foreground/60 shrink-0" />
                      {vendor.rateCard}
                    </div>
                  )}
                </div>

                {/* Skills tags */}
                {vendor.skills?.length ? (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {vendor.skills.map((s) => (
                      <Badge key={s} variant="outline" className="h-4.5 text-[9px] font-normal font-mono py-0 px-1.5">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {/* Regions */}
                {vendor.regions?.length ? (
                  <div className="text-muted-foreground text-[10px] font-mono mt-2 uppercase tracking-wide">
                    {vendor.regions.join(" · ")}
                  </div>
                ) : null}

                {/* Actions at bottom */}
                {canWrite && (
                  <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-[11px] h-7"
                      disabled={busyId === vendor.vendorId}
                      onClick={() =>
                        void patchVendor(
                          vendor,
                          {
                            status:
                              vendor.status === "preferred" ? "active" : "preferred",
                          },
                          vendor.status === "preferred"
                            ? "Removed preferred"
                            : "Marked preferred",
                        )
                      }
                    >
                      {vendor.status === "preferred" ? "Unprefer" : "Prefer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-[11px] h-7"
                      disabled={busyId === vendor.vendorId}
                      onClick={() =>
                        void patchVendor(
                          vendor,
                          { status: "inactive" },
                          `${vendor.name} inactive`,
                        )
                      }
                    >
                      Deactivate
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
