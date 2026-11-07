import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { VendorDrawer } from "@/components/vendors/vendor-drawer"
import { VendorsCrewTabs } from "@/components/vendors/vendors-crew-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useVendors } from "@/hooks/use-agency-data"
import {
  createVendor,
  deleteVendor,
  updateVendor,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canAccessRoute, canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Vendor } from "@/types/agency"

const STATUSES = ["preferred", "active", "trial", "inactive"] as const
const CATEGORIES = ["staging", "av", "post", "guest_experience", "design", "general"] as const

type VendorForm = {
  name: string
  category: string
  contact: string
  email: string
  skills: string
  regions: string
  status: string
  rateCard: string
  notes: string
}

const emptyForm = (): VendorForm => ({
  name: "",
  category: "general",
  contact: "",
  email: "",
  skills: "",
  regions: "",
  status: "active",
  rateCard: "",
  notes: "",
})

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
}

/** Map API vendor status to Figma Availability labels without inventing booking windows. */
function availabilityLabel(status: string) {
  switch (status.toLowerCase()) {
    case "preferred":
    case "active":
      return { label: "Available", tone: "success" as const }
    case "trial":
      return { label: "Limited", tone: "warning" as const }
    case "inactive":
      return { label: "Unavailable", tone: "neutral" as const }
    default:
      return { label: status || "Unknown", tone: "neutral" as const }
  }
}

function specialtyLabel(category: string) {
  return (category || "general").replaceAll("_", " ")
}

function locationLabel(vendor: Vendor) {
  const regions = (vendor.regions ?? []).filter(Boolean)
  if (regions.length) return regions.join(" · ")
  return "—"
}

export function VendorsPage() {
  const navigate = useNavigate()
  const { vendorId } = useParams()
  const { user } = useAuth()
  const canView = canAccessRoute(user?.role, "/vendors")
  const canWrite = canPerform(user?.role, "write_crm")
  const agencyLabel = user?.agencyName?.trim() || "Workspace"

  const { data: vendors, loading, error, reload } = useVendors()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [region, setRegion] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [form, setForm] = useState<VendorForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const categories = useMemo(
    () => [...new Set([...CATEGORIES, ...vendors.map((v) => (v.category || "").toLowerCase()).filter(Boolean)])],
    [vendors],
  )
  const regions = useMemo(
    () => [...new Set(vendors.flatMap((v) => v.regions ?? []).filter(Boolean))].sort(),
    [vendors],
  )

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (category !== "all" && (v.category || "").toLowerCase() !== category) return false
      if (region !== "all" && !(v.regions ?? []).some((r) => r.toLowerCase() === region.toLowerCase())) {
        return false
      }
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${v.name} ${v.contact ?? ""} ${v.email ?? ""} ${v.category} ${(v.skills ?? []).join(" ")} ${(v.regions ?? []).join(" ")}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [vendors, category, region, search])

  /** Gate rate-card UI/payload the same way the API gates writes (finance / org admin). */
  const canEditRates = useMemo(() => {
    if (vendors.some((v) => v.financeAccess === true)) return true
    if (vendors.length === 0 && !loading) {
      const role = String(user?.role || "").toLowerCase()
      if (role === "admin" || role === "agency_admin") return true
      if (String(user?.permissionRole || "").toUpperCase() === "AGENCY_ADMIN") return true
      if (String(user?.jobFunction || "").toUpperCase() === "ADMIN") return true
    }
    return false
  }, [vendors, loading, user?.role, user?.permissionRole, user?.jobFunction])

  function openCreate() {
    if (!canWrite) return
    setEditing(null)
    setForm(emptyForm())
    setShowCreate(true)
  }

  async function handleSave() {
    if (!canWrite || !form.name.trim()) return
    setSaving(true)
    const skills = form.skills.split(",").map((s) => s.trim()).filter(Boolean)
    const regionList = form.regions.split(",").map((r) => r.trim()).filter(Boolean)
    const payload: Partial<Vendor> = {
      name: form.name.trim(),
      category: form.category,
      contact: form.contact.trim() || undefined,
      email: form.email.trim() || undefined,
      status: form.status,
      skills,
      regions: regionList,
      notes: form.notes.trim() || undefined,
    }
    if (canEditRates) {
      payload.rateCard = form.rateCard.trim() || undefined
    }
    try {
      if (editing) {
        await updateVendor(editing.vendorId, payload)
        toast.success("Vendor updated")
      } else {
        await createVendor(payload)
        toast.success("Vendor added")
      }
      setShowCreate(false)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !canWrite) return
    setDeleting(true)
    try {
      await deleteVendor(deleteTarget.vendorId)
      toast.success("Vendor deleted")
      setDeleteTarget(null)
      setShowCreate(false)
      if (vendorId === deleteTarget.vendorId) navigate("/vendors")
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  if (!canView) {
    return (
      <div className="cosmos-vc-page">
        <EmptyState
          title="Vendors is unavailable"
          description="Your role cannot open the vendor directory."
        />
      </div>
    )
  }


  return (
    <div className="cosmos-vc-page">
      <div className="cosmos-vc-page__head">
        <p className="cosmos-vc-page__eyebrow">{agencyLabel} · Workspace</p>
        <div className="cosmos-vc-page__title-row">
          <h1>Vendors &amp; Crew</h1>
          {canWrite ? (
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="size-3.5" />
              Add Vendor
            </Button>
          ) : null}
        </div>
      </div>

      <VendorsCrewTabs active="vendors" vendorCount={vendors.length} crewCount="—" />

      {error ? (
        <div className="cosmos-vc-page__error" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="cosmos-vc-directory">
        <div className="cosmos-vc-toolbar">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors, skills, crews"
            className="cosmos-vc-search"
            aria-label="Search vendors"
          />
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Specialty"
            className="cosmos-vc-filter"
          >
            <option value="all">Specialty</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {specialtyLabel(c)}
              </option>
            ))}
          </Select>
          <Select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Location"
            className="cosmos-vc-filter"
          >
            <option value="all">Location</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select
            value="all"
            disabled
            aria-label="Saved Group"
            className="cosmos-vc-filter"
            title="Saved Groups are not in the Agency OS API yet"
          >
            <option value="all">Saved Group · Unavailable</option>
          </Select>
        </div>

        {loading ? (
          <div className="cosmos-vc-directory__body space-y-3 p-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="cosmos-vc-directory__body p-4">
            <EmptyState
              title="No vendors in this view"
              description={
                canWrite
                  ? "Add a vendor or clear filters to populate the directory."
                  : "No vendor records match the current filters."
              }
            />
          </div>
        ) : (
          <div className="cosmos-vc-table-wrap">
            <table className="cosmos-vc-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Location</th>
                  <th>Availability</th>
                  <th>Projects</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((vendor) => {
                  const availability = availabilityLabel(vendor.status || "active")
                  return (
                    <tr key={vendor.vendorId}>
                      <td>
                        <div className="cosmos-vc-vendor-cell">
                          <span className="cosmos-vc-mark" aria-hidden>
                            {initials(vendor.name) || "?"}
                          </span>
                          <div>
                            <p className="cosmos-vc-vendor-name">{vendor.name}</p>
                            <p className="cosmos-vc-vendor-sub capitalize">
                              {specialtyLabel(vendor.category)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{locationLabel(vendor)}</td>
                      <td>
                        <span className={cn("cosmos-vc-status", `is-${availability.tone}`)}>
                          {availability.label}
                        </span>
                      </td>
                      <td>
                        <span
                          className="cosmos-vc-muted"
                          title="Project counts are on the vendor profile, not the directory list API"
                        >
                          —
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/vendors/${vendor.vendorId}`)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="cosmos-vc-footnote">
              Directory list never includes rate cards or contract amounts. Those appear only on the
              profile for roles with finance access.
            </p>
          </div>
        )}
      </div>

      {canWrite ? (
        <EntityFormDialog
          open={showCreate}
          onOpenChange={(open) => {
            if (!open && !saving) {
              setShowCreate(false)
              setEditing(null)
            }
          }}
          title={editing ? "Edit vendor" : "Add Vendor"}
          description="Vendor directory record for this organization."
          onSubmit={handleSave}
          submitLabel={editing ? "Save changes" : "Add vendor"}
          pending={saving}
          submitDisabled={!form.name.trim()}
          maxWidth="max-w-2xl"
        >
          <VendorFormFields
            form={form}
            onChange={(field, value) => setForm((f) => ({ ...f, [field]: value }))}
            showRate={canEditRates}
          />
        </EntityFormDialog>
      ) : null}

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null)
        }}
        title={`Delete “${deleteTarget?.name ?? ""}”?`}
        description="This removes the vendor record for your organization."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={confirmDelete}
      />

      <VendorDrawer
        vendorId={vendorId ?? null}
        open={Boolean(vendorId)}
        onClose={() => navigate("/vendors", { replace: true })}
        role={user?.role}
        agencyLabel={agencyLabel}
        onAssigned={() => void reload()}
      />
    </div>
  )
}

function VendorFormFields({
  form,
  onChange,
  showRate,
}: {
  form: VendorForm
  onChange: (field: keyof VendorForm, value: string) => void
  showRate: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="vendor-name">Name</Label>
        <Input
          id="vendor-name"
          value={form.name}
          onChange={(e) => onChange("name", e.target.value)}
          required
          className="h-10"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vendor-category">Specialty</Label>
        <Select
          id="vendor-category"
          value={form.category}
          onChange={(e) => onChange("category", e.target.value)}
          className="h-10"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {specialtyLabel(c)}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vendor-status">Status</Label>
        <Select
          id="vendor-status"
          value={form.status}
          onChange={(e) => onChange("status", e.target.value)}
          className="h-10"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vendor-contact">Contact</Label>
        <Input
          id="vendor-contact"
          value={form.contact}
          onChange={(e) => onChange("contact", e.target.value)}
          className="h-10"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vendor-email">Email</Label>
        <Input
          id="vendor-email"
          type="email"
          value={form.email}
          onChange={(e) => onChange("email", e.target.value)}
          className="h-10"
        />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="vendor-regions">Locations (comma-separated)</Label>
        <Input
          id="vendor-regions"
          value={form.regions}
          onChange={(e) => onChange("regions", e.target.value)}
          className="h-10"
        />
      </div>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="vendor-skills">Skills (comma-separated)</Label>
        <Input
          id="vendor-skills"
          value={form.skills}
          onChange={(e) => onChange("skills", e.target.value)}
          className="h-10"
        />
      </div>
      {showRate ? (
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="vendor-rate">Rate card</Label>
          <Input
            id="vendor-rate"
            value={form.rateCard}
            onChange={(e) => onChange("rateCard", e.target.value)}
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Visible only to Finance and organization admins on the vendor drawer.
          </p>
        </div>
      ) : null}
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="vendor-notes">Notes</Label>
        <Textarea
          id="vendor-notes"
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          className="min-h-20"
        />
      </div>
    </div>
  )
}
