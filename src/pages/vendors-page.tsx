import { useEffect, useMemo, useState } from "react"
import { PlusIcon, StarIcon, TruckIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { createVendor, listVendors, updateVendor } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Vendor } from "@/types/agency"
import { cn } from "@/lib/utils"

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
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [category, setCategory] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    name: "",
    category: "general",
    contact: "",
    email: "",
    rateCard: "",
  })

  async function reload() {
    const res = await listVendors()
    setVendors(res.data ?? [])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load vendors")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

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
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
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
          {filtered.map((vendor) => (
            <Card key={vendor.vendorId} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug">{vendor.name}</h2>
                  <p className="text-muted-foreground text-xs capitalize">
                    {vendor.category.replace("_", " ")}
                  </p>
                </div>
                {canWrite ? (
                  <select
                    className={cn(
                      "h-7 shrink-0 rounded-full border px-2 text-[11px] font-medium capitalize outline-none",
                      vendor.status === "preferred" && "border-primary bg-primary/10 text-primary",
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
                      "capitalize",
                      vendor.status === "preferred" && "bg-primary/10 text-primary",
                    )}
                  >
                    {vendor.status}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <StarIcon className="size-3.5 fill-current opacity-70" />
                  <span className="tabular-nums font-medium text-foreground">
                    {vendor.rating?.toFixed(1) ?? "—"}
                  </span>
                </div>
                {canWrite ? (
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={cn(
                          "text-muted-foreground hover:text-foreground p-0.5",
                          (vendor.rating ?? 0) >= n && "text-foreground",
                        )}
                        disabled={busyId === vendor.vendorId}
                        onClick={() =>
                          void patchVendor(vendor, { rating: n }, `Rated ${n}/5`)
                        }
                        aria-label={`Rate ${n}`}
                      >
                        <StarIcon
                          className={cn(
                            "size-3.5",
                            (vendor.rating ?? 0) >= n && "fill-current",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="text-muted-foreground text-xs leading-relaxed">
                <div>{vendor.contact}</div>
                {vendor.email ? (
                  <a className="text-primary hover:underline" href={`mailto:${vendor.email}`}>
                    {vendor.email}
                  </a>
                ) : null}
                <div className="mt-1">{vendor.rateCard}</div>
              </div>

              {vendor.skills?.length ? (
                <div className="flex flex-wrap gap-1">
                  {vendor.skills.map((s) => (
                    <Badge key={s} variant="outline" className="h-5 font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="text-muted-foreground text-[11px]">
                {vendor.regions?.join(" · ")}
              </div>

              {canWrite ? (
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
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
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
