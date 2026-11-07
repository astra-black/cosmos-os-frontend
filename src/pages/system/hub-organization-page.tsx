/**
 * Hub · Organization — Figma 00.06 (`557:7`)
 * Evidence: Computer Use selected group 00.06 · Organization (~20800×8500,
 * dark + light rows) in Figma Desktop; structure from COSMOS_V7 12.5 /
 * build_v7_admin.py + IDENTITY_ACCESS §8. Child frame IDs not claimed from
 * zoomed-out canvas.
 *
 * Supported: organization profile view; admin edit (name, legalName, description,
 * website, phone, headquarters, timezone, domain, billing email, logo); people
 * gallery from agency teamMembers with link to /hub/members for management.
 * Unavailable: verified-domain badge, View As Guest, cover/brand colors, teams/
 * divisions, edition access, usage/credits, plan/seats, SSO, change history API,
 * guest/portal admin, roles matrix beyond Members & Roles.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  Building2Icon,
  CircleAlertIcon,
  GlobeIcon,
  LayersIcon,
  Loader2Icon,
  MapPinIcon,
  PencilIcon,
  ShieldIcon,
  UploadIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getAgencyOrganization,
  updateAgencyOrganization,
  type AgencyOrganization,
} from "@/lib/api/auth"
import { listTeamMembers } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { normalizeRole, roleLabel } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type { TeamMember } from "@/types/agency"

type OrgSection =
  | "profile"
  | "edit"
  | "people"
  | "member"
  | "teams"
  | "editions"
  | "usage"

const NAV: {
  id: OrgSection
  label: string
  to: string
  icon: typeof Building2Icon
  group: string
  external?: boolean
}[] = [
  {
    id: "profile",
    label: "Organization Profile",
    to: "/hub/organization",
    icon: Building2Icon,
    group: "Organization",
  },
  {
    id: "people",
    label: "People",
    to: "/hub/organization/people",
    icon: UsersIcon,
    group: "Organization",
  },
  {
    id: "teams",
    label: "Teams & Divisions",
    to: "/hub/organization/teams",
    icon: LayersIcon,
    group: "Organization",
  },
  {
    id: "editions",
    label: "Edition Access",
    to: "/hub/organization/editions",
    icon: ShieldIcon,
    group: "Organization",
  },
  {
    id: "usage",
    label: "Usage & Credits",
    to: "/hub/organization/usage",
    icon: ZapIcon,
    group: "Billing",
  },
]

function sectionFromPath(pathname: string): OrgSection {
  if (pathname.includes("/organization/edit")) return "edit"
  if (pathname.includes("/organization/people/")) return "member"
  if (pathname.includes("/organization/people")) return "people"
  if (pathname.includes("/organization/teams")) return "teams"
  if (pathname.includes("/organization/editions")) return "editions"
  if (pathname.includes("/organization/usage")) return "usage"
  return "profile"
}

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "OR").trim()
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function isOrgAdmin(role?: string | null) {
  const norm = normalizeRole(role)
  return norm === "admin"
}

function UnavailableCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="hub-admin-unavailable" role="status">
      <CircleAlertIcon />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}

function Kv({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="hub-org-kv">
      <span>{label}</span>
      <strong>{value?.trim() ? value : "—"}</strong>
    </div>
  )
}

function OrgShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  const location = useLocation()
  const section = sectionFromPath(location.pathname)
  const { user } = useAuth()
  const orgName = user?.agencyName || "Your organization"

  const groups = useMemo(() => {
    const map = new Map<string, typeof NAV>()
    for (const item of NAV) {
      const list = map.get(item.group) || []
      list.push(item)
      map.set(item.group, list)
    }
    return Array.from(map.entries())
  }, [])

  return (
    <div
      className="cosmos-home hub-admin hub-organization"
      data-figma="00.06 · Organization"
      data-node-id="557:7"
      data-evidence="computer-use-group-inspect"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub">
            <ArrowLeftIcon /> Hub
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Administration
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="hub-admin-actions">{actions}</div> : null}
      </header>

      <div className="hub-account-layout">
        <aside className="hub-account-nav" aria-label="Organization administration">
          {groups.map(([group, items]) => (
            <div key={group} className="hub-account-nav-group">
              <small>{group}</small>
              {items.map((item) => {
                const Icon = item.icon
                const active =
                  section === item.id ||
                  (item.id === "profile" && section === "edit") ||
                  (item.id === "people" && section === "member")
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={cn(active && "is-active")}
                  >
                    <Icon />
                    {item.label}
                  </Link>
                )
              })}
              {group === "Organization" ? (
                <Link to="/hub/members">
                  <ShieldIcon />
                  Roles & Permissions
                </Link>
              ) : null}
            </div>
          ))}
        </aside>
        <div className="hub-account-main">{children}</div>
      </div>
    </div>
  )
}

function useOrganization() {
  const [agency, setAgency] = useState<AgencyOrganization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const res = await getAgencyOrganization()
      setAgency(res.data || null)
    } catch (err) {
      setAgency(null)
      setError(err instanceof ApiError ? err.message : "Unable to load organization")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  return { agency, setAgency, loading, error, reload }
}

export function HubOrganizationProfilePage() {
  const { user } = useAuth()
  const { agency, loading, error } = useOrganization()
  const admin = isOrgAdmin(user?.role)
  const name = agency?.name || user?.agencyName || "Organization"
  const logo = agency?.logoUrl || agency?.avatarUrl || null
  const members = agency?.teamMembers || []
  const memberCount = agency?.memberCount ?? members.length
  const previewMembers = members.slice(0, 6)

  return (
    <OrgShell
      title="Organization Profile"
      description="How this organization appears across Hub and Agency OS. Membership management stays on Members & Roles."
      actions={
        admin ? (
          <Button size="sm" render={<Link to="/hub/organization/edit" />}>
            <PencilIcon />
            Edit Profile
          </Button>
        ) : null
      }
    >
      {loading ? (
        <div className="hub-admin-empty">
          <Loader2Icon className="animate-spin" />
          <strong>Loading organization…</strong>
        </div>
      ) : error ? (
        <UnavailableCard title="Organization unavailable">{error}</UnavailableCard>
      ) : (
        <div className="hub-org-stack">
          <section className="hub-records-panel hub-org-hero">
            <div className="hub-org-hero-cover" aria-hidden="true" />
            <div className="hub-org-hero-body">
              <Avatar className="hub-org-logo">
                {logo ? <AvatarImage src={logo} alt="" /> : null}
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="hub-org-hero-copy">
                <div className="hub-org-title-row">
                  <h2>{name}</h2>
                  {agency?.status ? (
                    <span className="hub-reports-chip is-success">{agency.status}</span>
                  ) : null}
                </div>
                <div className="hub-org-meta">
                  {agency?.legalName ? (
                    <span>
                      <Building2Icon /> {agency.legalName}
                    </span>
                  ) : null}
                  {agency?.headquarters ? (
                    <span>
                      <MapPinIcon /> {agency.headquarters}
                    </span>
                  ) : null}
                  {agency?.website ? (
                    <span>
                      <GlobeIcon /> {agency.website}
                    </span>
                  ) : null}
                  <span>
                    <UsersIcon /> {memberCount} member{memberCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="hub-org-hero-actions">
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title="Guest projection is not available yet"
                >
                  View As Guest
                </Button>
                {admin ? (
                  <Button size="sm" render={<Link to="/hub/organization/edit" />}>
                    <PencilIcon />
                    Edit Profile
                  </Button>
                ) : (
                  <span className="hub-org-readonly">Read-only · Administrators can edit</span>
                )}
              </div>
            </div>
          </section>

          <div className="hub-account-split">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>About</h2>
              </header>
              <p className="hub-org-about">
                {agency?.description?.trim()
                  ? agency.description
                  : "No description has been set for this organization."}
              </p>
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Contact & Details</h2>
                <span className="hub-reports-chip">Visible to members</span>
              </header>
              <div className="hub-org-kv-list">
                <Kv label="Website" value={agency?.website} />
                <Kv
                  label="Email"
                  value={agency?.billingContactEmail || agency?.billingEmail}
                />
                <Kv label="Phone" value={agency?.phone} />
                <Kv label="Headquarters" value={agency?.headquarters} />
                <Kv label="Time Zone" value={agency?.timezone} />
                <Kv label="Legal Name" value={agency?.legalName} />
                <Kv label="Domain" value={agency?.domain} />
                <Kv label="Workspace" value={agency?.slug ? `/${agency.slug}` : null} />
              </div>
              {!agency?.domain ? (
                <UnavailableCard title="Domain verification unavailable">
                  Verified-domain status and SSO domain policy are Proposed. Domain text above is
                  storage only when set — no live verification badge is shown.
                </UnavailableCard>
              ) : null}
            </section>
          </div>

          <div className="hub-org-cards">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Structure</h2>
                <Button size="sm" variant="ghost" render={<Link to="/hub/organization/teams" />}>
                  Teams & Divisions
                </Button>
              </header>
              <UnavailableCard title="Teams & divisions unavailable">
                Organization teams, divisions, and permission inheritance are Designed but not
                backed by a teams hierarchy API yet.
              </UnavailableCard>
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Editions</h2>
                <Button
                  size="sm"
                  variant="ghost"
                  render={<Link to="/hub/organization/editions" />}
                >
                  Edition Access
                </Button>
              </header>
              <UnavailableCard title="Edition access unavailable">
                Edition licensing and seat assignment matrices are Proposed. Agency OS is the
                current workspace; no fabricated edition grants are shown.
              </UnavailableCard>
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>People</h2>
                <Button size="sm" variant="ghost" render={<Link to="/hub/organization/people" />}>
                  Directory
                </Button>
              </header>
              {previewMembers.length === 0 ? (
                <p className="hub-org-muted">No members returned for this organization.</p>
              ) : (
                <div className="hub-org-people-preview">
                  {previewMembers.map((m) => (
                    <Avatar key={m.id} className="hub-org-people-avatar">
                      <AvatarFallback>{initials(m.name, m.email)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {memberCount > previewMembers.length ? (
                    <span>+{memberCount - previewMembers.length}</span>
                  ) : null}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                render={<Link to="/hub/members" />}
              >
                Manage in Members & Roles
              </Button>
            </section>
          </div>
        </div>
      )}
    </OrgShell>
  )
}

export function HubOrganizationEditPage() {
  const { user, updateUser } = useAuth()
  const { agency, setAgency, loading, error, reload } = useOrganization()
  const admin = isOrgAdmin(user?.role)
  const logoRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState("")
  const [legalName, setLegalName] = useState("")
  const [description, setDescription] = useState("")
  const [website, setWebsite] = useState("")
  const [phone, setPhone] = useState("")
  const [headquarters, setHeadquarters] = useState("")
  const [timezone, setTimezone] = useState("")
  const [domain, setDomain] = useState("")
  const [billingContactEmail, setBillingContactEmail] = useState("")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoState, setLogoState] = useState<"idle" | "uploading" | "error">("idle")
  const [logoError, setLogoError] = useState<string | null>(null)

  useEffect(() => {
    if (!agency) return
    setName(agency.name || "")
    setLegalName(agency.legalName || "")
    setDescription(agency.description || "")
    setWebsite(agency.website || "")
    setPhone(agency.phone || "")
    setHeadquarters(agency.headquarters || "")
    setTimezone(agency.timezone || "")
    setDomain(agency.domain || "")
    setBillingContactEmail(agency.billingContactEmail || agency.billingEmail || "")
    setDirty(false)
  }, [agency])

  function markDirty() {
    setDirty(true)
  }

  async function save(e?: FormEvent) {
    e?.preventDefault()
    if (!admin) return
    if (!name.trim()) {
      toast.error("Display name is required")
      return
    }
    setSaving(true)
    try {
      const res = await updateAgencyOrganization({
        name: name.trim(),
        legalName: legalName.trim(),
        description: description.trim().slice(0, 280),
        website: website.trim(),
        phone: phone.trim(),
        headquarters: headquarters.trim(),
        timezone: timezone.trim(),
        domain: domain.trim(),
        billingContactEmail: billingContactEmail.trim(),
      })
      if (res.data) {
        setAgency(res.data)
        if (res.data.name) updateUser({ agencyName: res.data.name })
      }
      setDirty(false)
      toast.success("Organization saved")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save organization")
    } finally {
      setSaving(false)
    }
  }

  async function onLogoSelected(file: File | null) {
    if (!file || !admin) return
    if (!file.type.startsWith("image/")) {
      setLogoState("error")
      setLogoError("Choose an image file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoState("error")
      setLogoError("Logo must be 2 MB or smaller.")
      return
    }
    setLogoState("uploading")
    setLogoError(null)
    try {
      const form = new FormData()
      form.append("agencyLogo", file)
      form.append("name", name.trim() || agency?.name || "Organization")
      const res = await updateAgencyOrganization(form)
      if (res.data) setAgency(res.data)
      setLogoState("idle")
      toast.success("Logo uploaded")
    } catch (err) {
      setLogoState("error")
      setLogoError(err instanceof ApiError ? err.message : "Logo upload failed")
      toast.error(err instanceof ApiError ? err.message : "Logo upload failed")
    } finally {
      if (logoRef.current) logoRef.current.value = ""
    }
  }

  if (!admin) {
    return (
      <OrgShell
        title="Edit Organization Profile"
        description="Only Owners and Administrators can change organization details."
      >
        <UnavailableCard title="Administrator access required">
          Members see the organization profile in read-only mode. Ask an administrator to update
          organization details.
        </UnavailableCard>
        <Button size="sm" variant="outline" className="mt-3" render={<Link to="/hub/organization" />}>
          Back to profile
        </Button>
      </OrgShell>
    )
  }

  return (
    <OrgShell
      title="Edit Organization Profile"
      description="Identity and contact details stored for this organization. Plan, seats, brand colors, cover, and SSO are not editable here."
      actions={
        <>
          <Button size="sm" variant="outline" render={<Link to="/hub/organization" />}>
            Cancel
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Save Changes
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="hub-admin-empty">
          <Loader2Icon className="animate-spin" />
          <strong>Loading organization…</strong>
        </div>
      ) : error ? (
        <UnavailableCard title="Organization unavailable">
          {error}
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void reload()}>
            Retry
          </Button>
        </UnavailableCard>
      ) : (
        <div className="hub-account-split">
          <form className="hub-records-panel hub-account-form" onSubmit={(e) => void save(e)}>
            <header className="hub-reports-panel-head">
              <h2>Organization Details</h2>
              {dirty ? <span className="hub-reports-chip is-info">Unsaved changes</span> : null}
            </header>

            <div className="hub-account-section">
              <div className="hub-account-section-label">
                <strong>Identity</strong>
                <p>Shown across Cosmos Hub and Agency OS.</p>
              </div>
              <div className="hub-account-stack">
                <div className="hub-account-fields">
                  <div>
                    <Label htmlFor="org-name">Display Name *</Label>
                    <Input
                      id="org-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        markDirty()
                      }}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-legal">Legal Name</Label>
                    <Input
                      id="org-legal"
                      value={legalName}
                      onChange={(e) => {
                        setLegalName(e.target.value)
                        markDirty()
                      }}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="org-description">Description</Label>
                  <textarea
                    id="org-description"
                    className="hub-org-textarea"
                    value={description}
                    maxLength={280}
                    rows={4}
                    onChange={(e) => {
                      setDescription(e.target.value)
                      markDirty()
                    }}
                    disabled={saving}
                  />
                  <small>{description.length} of 280 characters</small>
                </div>
              </div>
            </div>

            <div className="hub-account-section">
              <div className="hub-account-section-label">
                <strong>Brand</strong>
                <p>Logo for the organization profile. Cover and brand colors are not available yet.</p>
              </div>
              <div className="hub-account-photo">
                <Avatar className="hub-org-logo-edit">
                  {agency?.logoUrl || agency?.avatarUrl ? (
                    <AvatarImage src={agency.logoUrl || agency.avatarUrl || ""} alt="" />
                  ) : null}
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="hub-account-photo-actions">
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => void onLogoSelected(e.target.files?.[0] || null)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={logoState === "uploading"}
                    onClick={() => logoRef.current?.click()}
                  >
                    {logoState === "uploading" ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <UploadIcon />
                    )}
                    Replace
                  </Button>
                  <Button type="button" size="sm" variant="ghost" disabled title="Logo removal API is not available">
                    Remove
                  </Button>
                  {logoError ? <small className="hub-account-error">{logoError}</small> : null}
                </div>
              </div>
              <UnavailableCard title="Cover & brand colors unavailable">
                Cover image, custom brand palette, and portal accent colors are Designed (level B
                branding) but not backed by organization brand APIs yet.
              </UnavailableCard>
            </div>

            <div className="hub-account-section">
              <div className="hub-account-section-label">
                <strong>Contact</strong>
                <p>Visible to members of this organization.</p>
              </div>
              <div className="hub-account-fields">
                <div>
                  <Label htmlFor="org-website">Website</Label>
                  <Input
                    id="org-website"
                    value={website}
                    onChange={(e) => {
                      setWebsite(e.target.value)
                      markDirty()
                    }}
                    disabled={saving}
                  />
                </div>
                <div>
                  <Label htmlFor="org-email">General Email</Label>
                  <Input
                    id="org-email"
                    type="email"
                    value={billingContactEmail}
                    onChange={(e) => {
                      setBillingContactEmail(e.target.value)
                      markDirty()
                    }}
                    disabled={saving}
                  />
                </div>
                <div>
                  <Label htmlFor="org-phone">Phone</Label>
                  <Input
                    id="org-phone"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      markDirty()
                    }}
                    disabled={saving}
                  />
                </div>
                <div>
                  <Label htmlFor="org-hq">Headquarters</Label>
                  <Input
                    id="org-hq"
                    value={headquarters}
                    onChange={(e) => {
                      setHeadquarters(e.target.value)
                      markDirty()
                    }}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="hub-account-section">
              <div className="hub-account-section-label">
                <strong>Regional</strong>
                <p>Defaults shown on the organization profile. Currency and SSO policy are unavailable.</p>
              </div>
              <div className="hub-account-fields">
                <div>
                  <Label htmlFor="org-tz">Time Zone</Label>
                  <Input
                    id="org-tz"
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value)
                      markDirty()
                    }}
                    disabled={saving}
                    placeholder="e.g. Pacific Time"
                  />
                </div>
                <div>
                  <Label htmlFor="org-domain">Domain</Label>
                  <Input
                    id="org-domain"
                    value={domain}
                    onChange={(e) => {
                      setDomain(e.target.value)
                      markDirty()
                    }}
                    disabled={saving}
                    placeholder="example.com"
                  />
                  <small>Stored for the organization. Domain verification is not live.</small>
                </div>
              </div>
              <UnavailableCard title="Plan, seats & currency unavailable">
                Subscription plan, seat counts, and billing currency cannot be changed through this
                profile. Entitlements remain Proposed — no fabricated seat meters are shown.
              </UnavailableCard>
            </div>
          </form>

          <div className="hub-account-stack">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Change History</h2>
              </header>
              <UnavailableCard title="Audit history unavailable">
                Organization profile change history requires the platform audit surface. No
                fabricated change log is shown.
              </UnavailableCard>
            </section>
            <div className="hub-org-perm-note">
              <ShieldIcon />
              <p>
                Only Owners and Administrators can change organization details. Members see the
                profile in read-only mode. Workspace slug{" "}
                <strong>{agency?.slug ? `/${agency.slug}` : "—"}</strong> is set at creation and
                cannot be renamed here.
              </p>
            </div>
          </div>
        </div>
      )}
    </OrgShell>
  )
}

export function HubOrganizationPeoplePage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await listTeamMembers()
        if (!cancelled) setMembers(res.data || [])
      } catch (err) {
        if (!cancelled) {
          setMembers([])
          setError(err instanceof ApiError ? err.message : "Unable to load people")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => {
      const hay = `${m.name || ""} ${m.email || ""} ${m.jobFunction || ""} ${m.permissionRole || ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [members, query])

  return (
    <OrgShell
      title="People"
      description="Members of this organization. Invite, role changes, and deactivation stay on Members & Roles — this directory does not replace that page."
      actions={
        <Button size="sm" render={<Link to="/hub/members" />}>
          Manage in Members & Roles
        </Button>
      }
    >
      {loading ? (
        <div className="hub-admin-empty">
          <Loader2Icon className="animate-spin" />
          <strong>Loading people…</strong>
        </div>
      ) : error ? (
        <UnavailableCard title="People unavailable">{error}</UnavailableCard>
      ) : (
        <>
          <div className="hub-org-people-bar">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, titles and roles"
              aria-label="Search people"
            />
            <span className="hub-org-muted">
              {filtered.length} of {members.length} members
            </span>
          </div>
          <UnavailableCard title="Guests, invitations & edition filters unavailable">
            Guest counts, invitation tabs, team filters, and edition access chips on people cards
            are Designed but not backed here. Use Members & Roles for invites and role management.
          </UnavailableCard>
          {filtered.length === 0 ? (
            <div className="hub-admin-empty">
              <UsersIcon />
              <strong>No people match</strong>
              <small>Try a different search or open Members & Roles.</small>
            </div>
          ) : (
            <div className="hub-org-people-grid">
              {filtered.map((m) => (
                <Link
                  key={m.memberId}
                  className="hub-org-person-card"
                  to={`/hub/organization/people/${encodeURIComponent(m.memberId)}`}
                >
                  <div className="hub-org-person-cover" aria-hidden="true" />
                  <Avatar className="hub-org-person-avatar">
                    <AvatarFallback>{initials(m.name, m.email)}</AvatarFallback>
                  </Avatar>
                  <strong>{m.name || "Unnamed"}</strong>
                  <span>{m.jobFunction || "No title"}</span>
                  <small>
                    {m.email || "Contact details not available"}
                  </small>
                  <div className="hub-org-person-foot">
                    <span>{roleLabel(String(m.permissionRole || m.role || "member"))}</span>
                    <span>{m.status || "—"}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </OrgShell>
  )
}

export function HubOrganizationMemberPage() {
  const { memberId } = useParams()
  const [member, setMember] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!memberId) return
      setLoading(true)
      setError(null)
      try {
        const res = await listTeamMembers()
        const list = res.data || []
        const found = list.find((m) => m.memberId === memberId) || null
        if (!cancelled) {
          setMember(found)
          if (!found) setError("Member not found in this organization")
        }
      } catch (err) {
        if (!cancelled) {
          setMember(null)
          setError(err instanceof ApiError ? err.message : "Unable to load member")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [memberId])

  return (
    <OrgShell
      title="Member Profile"
      description="Read-only membership details for this organization. Role changes happen in Members & Roles."
      actions={
        <>
          <Button size="sm" variant="outline" render={<Link to="/hub/organization/people" />}>
            Back to People
          </Button>
          <Button size="sm" render={<Link to="/hub/members" />}>
            Members & Roles
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="hub-admin-empty">
          <Loader2Icon className="animate-spin" />
          <strong>Loading member…</strong>
        </div>
      ) : error || !member ? (
        <UnavailableCard title="Member unavailable">{error || "Not found"}</UnavailableCard>
      ) : (
        <div className="hub-org-stack">
          <section className="hub-records-panel">
            <div className="hub-org-member-head">
              <Avatar className="hub-org-person-avatar-lg">
                <AvatarFallback>{initials(member.name, member.email)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="hub-org-title-row">
                  <h2>{member.name || "Unnamed"}</h2>
                  {member.status ? (
                    <span className="hub-reports-chip is-success">{member.status}</span>
                  ) : null}
                </div>
                <p>
                  {member.jobFunction || "No title"} ·{" "}
                  {roleLabel(String(member.permissionRole || member.role || "member"))}
                </p>
                <div className="hub-org-meta">
                  {member.email ? (
                    <span>
                      <GlobeIcon /> {member.email}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <div className="hub-account-split">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Profile</h2>
              </header>
              <div className="hub-org-kv-list">
                <Kv label="Display Name" value={member.name} />
                <Kv label="Email" value={member.email} />
                <Kv label="Title" value={member.jobFunction} />
                <Kv
                  label="Organization Role"
                  value={roleLabel(String(member.permissionRole || member.role || "member"))}
                />
                <Kv label="Status" value={member.status} />
              </div>
              <UnavailableCard title="Extended profile fields unavailable">
                Pronouns, bio, locale, and privacy-gated phone fields from the designed Member
                Profile are not on TeamMember yet.
              </UnavailableCard>
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Role & Access</h2>
              </header>
              <UnavailableCard title="Edition access & seats unavailable">
                Per-member edition grants, paid seat assignment, deactivate, and reset sign-in are
                not available on this Hub Organization surface. Use Members & Roles for role
                changes that the API supports.
              </UnavailableCard>
            </section>
          </div>
        </div>
      )}
    </OrgShell>
  )
}

function OrgUnavailableSection({
  title,
  description,
  reason,
}: {
  title: string
  description: string
  reason: ReactNode
}) {
  return (
    <OrgShell title={title} description={description}>
      <UnavailableCard title={`${title} unavailable`}>{reason}</UnavailableCard>
      <Button size="sm" variant="outline" className="mt-3" render={<Link to="/hub/organization" />}>
        Back to Organization Profile
      </Button>
    </OrgShell>
  )
}

export function HubOrganizationTeamsPage() {
  return (
    <OrgUnavailableSection
      title="Teams & Divisions"
      description="Organization structure and permission inheritance."
      reason={
        <>
          Teams, divisions, and inheritance chains are Designed in 00.06 but there is no
          organization teams hierarchy API. No fabricated studios or team counts are shown.
        </>
      }
    />
  )
}

export function HubOrganizationEditionsPage() {
  return (
    <OrgUnavailableSection
      title="Edition Access"
      description="Which editions this organization can use and who may enter them."
      reason={
        <>
          Edition licensing and the people × editions assignment matrix are Proposed
          (IDENTITY_ACCESS §8). Agency OS is the current workspace; no fabricated edition catalog
          is shown.
        </>
      }
    />
  )
}

export function HubOrganizationUsagePage() {
  return (
    <OrgUnavailableSection
      title="Usage & Credits"
      description="Extend Credits and native intelligence usage for this organization."
      reason={
        <>
          Usage meters, custom-agent credit charts, and billing alerts are Designed but not backed
          by a metering API. No fabricated credit totals are shown.
        </>
      }
    />
  )
}

export function HubOrganizationPage() {
  return <HubOrganizationProfilePage />
}
