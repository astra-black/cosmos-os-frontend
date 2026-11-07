import { useEffect, useMemo, useState } from "react"
import { LockIcon, MessageSquareIcon, PlusIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import {
  assignVendorToProject,
  getVendorProfile,
  listProjects,
  normalizeProjects,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { canPerform } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { Project, Vendor } from "@/types/agency"

type VendorDrawerProps = {
  vendorId: string | null
  open: boolean
  onClose: () => void
  role?: string | null
  agencyLabel?: string
  onAssigned?: () => void
}

function projectLabel(project: Project) {
  const name = project.projectName || (project as { name?: string }).name || "Untitled project"
  return project.clientName ? `${project.clientName} · ${name}` : name
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
}

function specialtyLabel(category: string) {
  return (category || "general").replaceAll("_", " ")
}

function locationLabel(vendor: Vendor) {
  const regions = (vendor.regions ?? []).filter(Boolean)
  if (regions.length) return regions.map((r) => r.replaceAll("_", " ")).join(", ")
  return "—"
}

function availabilityLabel(status: string) {
  switch ((status || "").toLowerCase()) {
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

function assessmentLabel(rating?: number | null) {
  if (rating == null || Number.isNaN(Number(rating)) || Number(rating) <= 0) return null
  const n = Number(rating)
  if (n >= 4.5) return `Strong · ${n.toFixed(1)}`
  if (n >= 3.5) return `Solid · ${n.toFixed(1)}`
  if (n >= 2.5) return `Mixed · ${n.toFixed(1)}`
  return `Needs attention · ${n.toFixed(1)}`
}

function scoreLine(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—"
  return `${Number(value).toFixed(1)} / 5`
}

/**
 * Figma 00.10 · 81–82 Vendor Drawer (right sheet over directory).
 * Dark `1143:25501` · Light `1144:25501` · 560px panel.
 */
export function VendorDrawer({
  vendorId,
  open,
  onClose,
  role,
  agencyLabel = "Workspace",
  onAssigned,
}: VendorDrawerProps) {
  const canWrite = canPerform(role, "write_crm")
  const [profile, setProfile] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (!open || !vendorId) {
      setProfile(null)
      setError(null)
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    void getVendorProfile(vendorId)
      .then((res) => {
        if (!active) return
        setProfile(res.data ?? null)
        if (!res.data) setError("Vendor not found")
      })
      .catch((err) => {
        if (!active) return
        setProfile(null)
        setError(err instanceof ApiError ? err.message : "Vendor profile unavailable")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, vendorId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !assignOpen) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, assignOpen, onClose])

  const financeOk = profile?.financeAccess === true
  const availability = availabilityLabel(profile?.status || "active")
  const projectCount = profile?.projects?.length ?? 0
  const sinceYear = useMemo(() => {
    const years = (profile?.projects ?? [])
      .map((p) => (p.startDate ? new Date(p.startDate).getFullYear() : null))
      .filter((y): y is number => typeof y === "number" && !Number.isNaN(y))
    if (!years.length) return null
    return Math.min(...years)
  }, [profile?.projects])

  const contactLine = [profile?.contact?.trim(), profile?.email?.trim()].filter(Boolean).join(" · ")
  const hasContact = Boolean(profile?.email?.trim() || profile?.contact?.trim())
  const assessment = assessmentLabel(profile?.rating)

  async function openAssign() {
    if (!canWrite || !vendorId) return
    setAssignOpen(true)
    setProjectId("")
    setProjectsLoading(true)
    try {
      const res = await listProjects()
      const list = normalizeProjects(res)
      const assigned = new Set((profile?.projects ?? []).map((p) => p.projectId))
      setProjects(list.filter((p) => !assigned.has(p.projectId)))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load projects")
      setProjects([])
    } finally {
      setProjectsLoading(false)
    }
  }

  async function handleAssign() {
    if (!canWrite || !vendorId || !projectId) return
    setAssigning(true)
    try {
      await assignVendorToProject(vendorId, { projectId, status: "assigned" })
      toast.success("Vendor assigned to project")
      setAssignOpen(false)
      const refreshed = await getVendorProfile(vendorId)
      setProfile(refreshed.data ?? null)
      onAssigned?.()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Assignment failed")
    } finally {
      setAssigning(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="cosmos-vendor-drawer-scrim"
        role="presentation"
        onClick={() => {
          if (!assignOpen) onClose()
        }}
      >
        <aside
          className="cosmos-vendor-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={profile?.name ? `Vendor · ${profile.name}` : "Vendor"}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="cosmos-vendor-drawer__head">
            <div>
              <p className="cosmos-vendor-drawer__eyebrow">Vendor</p>
              <h2>{loading ? "Loading…" : profile?.name || "Vendor"}</h2>
            </div>
            <button type="button" aria-label="Close vendor drawer" onClick={onClose}>
              <XIcon className="size-4" />
            </button>
          </header>

          <div className="cosmos-vendor-drawer__body">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : error ? (
              <div className="cosmos-vendor-drawer__error" role="alert">
                <span>{error}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (!vendorId) return
                    setLoading(true)
                    setError(null)
                    void getVendorProfile(vendorId)
                      .then((res) => setProfile(res.data ?? null))
                      .catch((err) =>
                        setError(err instanceof ApiError ? err.message : "Vendor profile unavailable"),
                      )
                      .finally(() => setLoading(false))
                  }}
                >
                  Retry
                </Button>
              </div>
            ) : profile ? (
              <>
                <section className="cosmos-vendor-drawer__hero">
                  <span className="cosmos-vc-mark cosmos-vendor-drawer__mark" aria-hidden>
                    {initials(profile.name) || "?"}
                  </span>
                  <div>
                    <h3>{profile.name}</h3>
                    <p className="capitalize">
                      {specialtyLabel(profile.category)}
                      {locationLabel(profile) !== "—" ? ` · ${locationLabel(profile)}` : ""}
                    </p>
                    <div className="cosmos-vendor-drawer__badges">
                      {hasContact ? (
                        <span className={cn("cosmos-vc-status", "is-success")}>Contact on file</span>
                      ) : (
                        <span className={cn("cosmos-vc-status", "is-neutral")}>No contact on file</span>
                      )}
                      <span className={cn("cosmos-vc-status", `is-${availability.tone}`)}>
                        {availability.label}
                      </span>
                    </div>
                  </div>
                </section>

                {profile.skills?.length ? (
                  <div className="cosmos-vendor-drawer__tags">
                    {profile.skills.map((skill) => (
                      <span key={skill} className="cosmos-vendor-drawer__tag capitalize">
                        {skill.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                ) : null}

                <dl className="cosmos-vendor-drawer__pairs">
                  <div>
                    <dt>Contact</dt>
                    <dd>
                      {contactLine ? (
                        profile.email ? (
                          <a href={`mailto:${profile.email}`}>{contactLine}</a>
                        ) : (
                          contactLine
                        )
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Availability</dt>
                    <dd>
                      {availability.label}
                      <span className="cosmos-vc-muted"> · from vendor status</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Projects with you</dt>
                    <dd>
                      {projectCount === 0
                        ? "None yet"
                        : sinceYear
                          ? `${projectCount} · since ${sinceYear}`
                          : `${projectCount}`}
                    </dd>
                  </div>
                </dl>

                <section className="cosmos-vendor-drawer__card">
                  <div className="cosmos-vendor-drawer__card-head">
                    <h4>Internal Performance</h4>
                    <span className="cosmos-vendor-drawer__vis">Internal · {agencyLabel} only</span>
                  </div>
                  <dl className="cosmos-vendor-drawer__pairs is-compact">
                    <div>
                      <dt>On-time delivery</dt>
                      <dd>{scoreLine(profile.scorecard?.onTimeDelivery)}</dd>
                    </div>
                    <div>
                      <dt>Bills returned</dt>
                      <dd className="cosmos-vc-muted" title="Not tracked by the Agency OS vendor API">
                        — · Not tracked
                      </dd>
                    </div>
                    <div>
                      <dt>Team assessment</dt>
                      <dd>{assessment || "—"}</dd>
                    </div>
                  </dl>
                  <p className="cosmos-vendor-drawer__note">
                    Internal assessments are separate from client reviews and are never shown to the
                    vendor.
                  </p>
                </section>

                <section
                  className={cn(
                    "cosmos-vendor-drawer__rates",
                    !financeOk && "is-restricted",
                  )}
                >
                  <div className="cosmos-vendor-drawer__rates-head">
                    <LockIcon className="size-3.5" aria-hidden />
                    <span>Rates · Finance Access</span>
                  </div>
                  {!financeOk ? (
                    <p className="cosmos-vendor-drawer__rates-lock">
                      Restricted to Finance and organization admins. Rate cards, quote amounts, and
                      contracted totals are not returned by the API for your role.
                    </p>
                  ) : (
                    <dl className="cosmos-vendor-drawer__pairs is-compact">
                      <div>
                        <dt>Rate card</dt>
                        <dd>{profile.rateCard?.trim() || "—"}</dd>
                      </div>
                      <div>
                        <dt>Contracted total</dt>
                        <dd>
                          {profile.totalContracted != null
                            ? `$${Number(profile.totalContracted).toLocaleString()}`
                            : "—"}
                        </dd>
                      </div>
                      {profile.projects?.length ? (
                        <div>
                          <dt>Project links</dt>
                          <dd>
                            <ul className="cosmos-vendor-drawer__project-list">
                              {profile.projects.map((project) => (
                                <li key={project.projectId}>
                                  <span>
                                    {project.clientName ? `${project.clientName} · ` : ""}
                                    {project.name}
                                  </span>
                                  <span>
                                    {project.contractAmount == null
                                      ? "—"
                                      : `$${project.contractAmount.toLocaleString()}`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                      {profile.quotes?.length ? (
                        <div>
                          <dt>Quotes</dt>
                          <dd>
                            <ul className="cosmos-vendor-drawer__project-list">
                              {profile.quotes.map((quote) => (
                                <li key={quote.quoteId}>
                                  <span>
                                    {quote.title}
                                    {quote.projectName ? ` · ${quote.projectName}` : ""}
                                  </span>
                                  <span>
                                    {quote.amount == null
                                      ? quote.status
                                      : `${quote.currency || "$"}${Number(quote.amount).toLocaleString()}`}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  )}
                </section>
              </>
            ) : null}
          </div>

          <footer className="cosmos-vendor-drawer__footer">
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Vendor messaging is not connected in Agency OS yet"
            >
              <MessageSquareIcon className="size-3.5" />
              Message · Unavailable
            </Button>
            {canWrite ? (
              <Button size="sm" onClick={() => void openAssign()} disabled={!profile || loading}>
                <PlusIcon className="size-3.5" />
                Assign To Project
              </Button>
            ) : (
              <Button size="sm" disabled title="Assigning vendors requires CRM write access">
                Assign To Project
              </Button>
            )}
          </footer>
        </aside>
      </div>

      <EntityFormDialog
        open={assignOpen}
        onOpenChange={(next) => {
          if (!next && !assigning) setAssignOpen(false)
        }}
        title="Assign To Project"
        description="Links this vendor to an agency project. Contract amounts stay Finance-gated on the server."
        onSubmit={handleAssign}
        submitLabel="Assign"
        pending={assigning}
        submitDisabled={!projectId || projectsLoading}
      >
        <div className="grid gap-2">
          <Label htmlFor="vendor-assign-project">Project</Label>
          {projectsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No unassigned projects available, or projects could not be loaded.
            </p>
          ) : (
            <Select
              id="vendor-assign-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {projectLabel(project)}
                </option>
              ))}
            </Select>
          )}
        </div>
      </EntityFormDialog>
    </>
  )
}
