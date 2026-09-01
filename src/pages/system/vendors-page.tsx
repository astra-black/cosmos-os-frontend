import { useMemo, useState } from "react"
import {
  FileTextIcon,
  FilmIcon,
  HammerIcon,
  MailIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  StarIcon,
  TruckIcon,
  UserIcon,
  Volume2Icon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { Select } from "@/components/ui/select"
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

interface VendorFormData {
  name: string
  category: string
  contact: string
  email: string
  rateCard: string
  skills: string
  regions: string
  status: string
}

const emptyForm: VendorFormData = {
  name: "",
  category: "general",
  contact: "",
  email: "",
  rateCard: "",
  skills: "",
  regions: "",
  status: "trial",
}

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
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState<VendorFormData>(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

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

  function openCreateDialog() {
    setEditingVendor(null)
    setForm(emptyForm)
    setIsDialogOpen(true)
  }

  function openEditDialog(vendor: Vendor) {
    setEditingVendor(vendor)
    setForm({
      name: vendor.name,
      category: vendor.category || "general",
      contact: vendor.contact || "",
      email: vendor.email || "",
      rateCard: vendor.rateCard || "",
      skills: (vendor.skills || []).join(", "),
      regions: (vendor.regions || []).join(", "),
      status: vendor.status || "active",
    })
    setIsDialogOpen(true)
  }

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

  async function handleSave() {
    if (!form.name.trim() || !canWrite) return
    setIsSaving(true)
    const skills = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const regions = form.regions
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)

    try {
      if (editingVendor) {
        await updateVendor(editingVendor.vendorId, {
          name: form.name.trim(),
          category: form.category,
          contact: form.contact.trim() || undefined,
          email: form.email.trim() || undefined,
          rateCard: form.rateCard.trim() || undefined,
          status: form.status,
          skills,
          regions,
        })
        toast.success("Vendor updated")
      } else {
        await createVendor({
          name: form.name.trim(),
          category: form.category,
          contact: form.contact.trim() || undefined,
          email: form.email.trim() || undefined,
          rateCard: form.rateCard.trim() || undefined,
          status: form.status,
          skills,
          regions,
        })
        toast.success("Vendor added")
      }
      setIsDialogOpen(false)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || !canWrite) return
    const id = deleteTarget.vendorId
    try {
      await deleteVendor(id)
      await reload()
      toast.success("Vendor deleted")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Vendors"
        description="Preferred and active partners — staging, A/V, post, hospitality."
        actions={
          canWrite ? (
            <Button size="sm" onClick={openCreateDialog}>
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
                    {canWrite ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(vendor)}
                          aria-label={`Edit ${vendor.name}`}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive"
                          onClick={() => setDeleteTarget(vendor)}
                          aria-label={`Delete ${vendor.name}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </>
                    ) : null}
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

      {/* Add / Edit Vendor Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
            <DialogDescription>
              {editingVendor
                ? "Update partner details, rate cards, and capabilities."
                : "Register a new partner, staging provider, or creative vendor."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="vendor-name">Partner Name *</Label>
              <Input
                id="vendor-name"
                placeholder="e.g. Apex Stage Works"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="vendor-category">Category</Label>
                <Select
                  id="vendor-category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="vendor-status">Status</Label>
                <Select
                  id="vendor-status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="vendor-contact">Contact Person</Label>
                <Input
                  id="vendor-contact"
                  placeholder="e.g. Marcus Reid"
                  value={form.contact}
                  onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="vendor-email">Email Address</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  placeholder="vendor@company.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="vendor-rate">Rate Card / Pricing Model</Label>
              <Input
                id="vendor-rate"
                placeholder="e.g. $1,200/day · Fixed Kit"
                value={form.rateCard}
                onChange={(e) => setForm((f) => ({ ...f, rateCard: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="vendor-skills">Skills / Tags (comma separated)</Label>
                <Input
                  id="vendor-skills"
                  placeholder="Lighting, Truss, Rigging"
                  value={form.skills}
                  onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="vendor-regions">Regions (comma separated)</Label>
                <Input
                  id="vendor-regions"
                  placeholder="US-West, NYC, Global"
                  value={form.regions}
                  onChange={(e) => setForm((f) => ({ ...f, regions: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving || !form.name.trim()}>
              {isSaving ? "Saving…" : editingVendor ? "Save Changes" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Delete */}
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Vendor"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Vendor"
        destructive
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
