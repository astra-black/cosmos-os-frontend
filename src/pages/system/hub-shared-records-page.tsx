/**
 * Hub · Shared Records — Figma 00.07 (group `557:8`)
 * Evidence: COSMOS_V7 12.6; build_v7_directory.py (Clients & Partners, Vendors,
 * Vendor Profile, External Contact). MCP View-seat rate-limited — child node IDs
 * not captured; dark/light twins generated in design-src.
 *
 * Real agency-scoped Client / Vendor / CrmContact only. Partners, Prospects,
 * cross-org connections, record-access rules, and fabricated activity/counts are
 * unavailable. Contact phones and vendor rates/contracts follow existing API gates.
 * Distinct from Agency OS `/clients`, `/contacts`, `/vendors` (workspace CRUD).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  Building2Icon,
  HandshakeIcon,
  LayersIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  RefreshCwIcon,
  SearchIcon,
  StarIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getClient,
  getCrmContact,
  getVendorProfile,
  listClients,
  listCrmContacts,
  listVendors,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canAccessRoute, canPerform } from "@/lib/rbac"
import type { AgencyClient, CrmContact, Vendor } from "@/types/agency"
import { cn } from "@/lib/utils"

type Section = "clients" | "vendors" | "contacts"
type ClientTab = "all" | "clients" | "partners" | "prospects"

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback
}

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n))
}

function HubRecordsShell({
  section,
  title,
  description,
  actions,
  children,
}: {
  section: Section
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { user } = useAuth()
  const orgName = user?.agencyName || "Your organization"

  return (
    <div
      className="cosmos-home hub-admin hub-records"
      data-figma="00.07 · Shared Records"
      data-node-id="557:8"
      data-node-id-status="group-confirmed-children-mcp-rate-limited"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub">
            <ArrowLeftIcon /> Hub
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Shared Records
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="hub-admin-actions">{actions}</div> : null}
      </header>

      <nav className="hub-records-sections" aria-label="Shared record types">
        <Link
          className={cn(section === "clients" && "is-active")}
          to="/hub/records/clients"
        >
          <UsersIcon /> Clients
        </Link>
        <Link
          className={cn(section === "vendors" && "is-active")}
          to="/hub/records/vendors"
        >
          <HandshakeIcon /> Vendors
        </Link>
        <Link
          className={cn(section === "contacts" && "is-active")}
          to="/hub/records/contacts"
        >
          <UserRoundIcon /> Contacts
        </Link>
      </nav>

      {children}
    </div>
  )
}

export function HubSharedRecordsPage() {
  return <HubClientsDirectory />
}

export function HubClientsDirectory() {
  const { user } = useAuth()
  const canOpenAgencyClients = canAccessRoute(user?.role, "/clients")
  const canWrite = canPerform(user?.role, "write_crm")
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<ClientTab>("all")

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await listClients()
      setClients(res.data ?? [])
      setStatus("ok")
    } catch (reason) {
      setClients([])
      setStatus("error")
      setError(errorMessage(reason, "Client records could not be loaded."))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((client) => {
      if (!q) return true
      return [client.name, client.industry, client.accountLead, client.primaryContact, client.stage]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [clients, search])

  return (
    <HubRecordsShell
      section="clients"
      title="Clients & Partners"
      description="Organization-owned client records for this agency. Partners and Prospects are designed connected-org types and are not modeled yet."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCwIcon /> Refresh
          </Button>
          <Button size="sm" variant="outline" disabled title="Import is not implemented">
            Import
          </Button>
          {canOpenAgencyClients && canWrite ? (
            <Button size="sm" render={<Link to="/clients" />}>
              Add Client
            </Button>
          ) : (
            <Button size="sm" disabled title="Create clients in Agency OS when CRM write is allowed">
              Add Client
            </Button>
          )}
        </>
      }
    >
      <div className="hub-admin-tabs hub-records-tabs">
        <button type="button" className={cn(tab === "all" && "is-active")} onClick={() => setTab("all")}>
          All <span>{clients.length}</span>
        </button>
        <button
          type="button"
          className={cn(tab === "clients" && "is-active")}
          onClick={() => setTab("clients")}
        >
          Clients <span>{clients.length}</span>
        </button>
        <button
          type="button"
          className={cn(tab === "partners" && "is-active")}
          onClick={() => setTab("partners")}
        >
          Partners <span>—</span>
        </button>
        <button
          type="button"
          className={cn(tab === "prospects" && "is-active")}
          onClick={() => setTab("prospects")}
        >
          Prospects <span>—</span>
        </button>
      </div>

      <div className="hub-records-toolbar">
        <div className="hub-members-search">
          <SearchIcon />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations and people"
            aria-label="Search clients"
          />
        </div>
        <span className="hub-records-count">
          {tab === "partners" || tab === "prospects"
            ? "Unavailable"
            : `${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {tab === "partners" || tab === "prospects" ? (
        <div className="hub-admin-unavailable" role="status">
          <HandshakeIcon />
          <div>
            <strong>{tab === "partners" ? "Partners unavailable" : "Prospects unavailable"}</strong>
            <p>
              {tab === "partners"
                ? "Partner organizations (connected orgs) are designed in Shared Records but are not first-class agency records yet."
                : "Prospects are illustrative in the directory generator and are not stored as agency shared records."}
            </p>
          </div>
        </div>
      ) : status === "loading" ? (
        <div className="hub-records-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="hub-records-card-skel" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="hub-admin-unavailable" role="alert">
          <Building2Icon />
          <div>
            <strong>Clients unavailable</strong>
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="hub-admin-empty">
          <Building2Icon />
          <strong>No clients yet</strong>
          <small>Agency clients will appear here when created in Agency OS.</small>
        </div>
      ) : (
        <div className="hub-records-grid">
          {filtered.map((client) => (
            <Link
              key={client.clientId}
              className="hub-records-card"
              to={`/hub/records/clients/${client.clientId}`}
            >
              <div className="hub-records-card-cover" />
              <div className="hub-records-card-body">
                <div className="hub-records-card-topline">
                  <span className="hub-records-avatar">{initials(client.name)}</span>
                  <span className="hub-reports-chip is-success">Client</span>
                </div>
                <strong>{client.name}</strong>
                <p>{client.industry || "No industry listed"}</p>
                <div className="hub-records-meta">
                  {client.primaryContact || client.accountLead ? (
                    <span>
                      <UserRoundIcon />
                      {client.primaryContact || client.accountLead}
                    </span>
                  ) : (
                    <span className="is-muted">
                      <UserRoundIcon /> No primary contact
                    </span>
                  )}
                  {client.stage ? (
                    <span>
                      <LayersIcon />
                      {client.stage}
                    </span>
                  ) : null}
                </div>
                <div className="hub-records-tags">
                  {(client.tags || []).slice(0, 3).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                  {(client.tags || []).length === 0 ? (
                    <span className="is-muted">No tags</span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </HubRecordsShell>
  )
}

export function HubClientDetailPage() {
  const { clientId = "" } = useParams()
  const { user } = useAuth()
  const canOpenAgency = canAccessRoute(user?.role, "/clients")
  const [client, setClient] = useState<AgencyClient | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clientId) return
    setStatus("loading")
    setError(null)
    try {
      const res = await getClient(clientId)
      setClient(res.data ?? null)
      setStatus(res.data ? "ok" : "error")
      if (!res.data) setError("Client not found.")
    } catch (reason) {
      setClient(null)
      setStatus("error")
      setError(errorMessage(reason, "Client could not be loaded."))
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <HubRecordsShell
      section="clients"
      title={client?.name || "Client"}
      description="Shared client record for this agency. Cross-organization partner links and edition extensions are not modeled."
      actions={
        <>
          <Button size="sm" variant="outline" render={<Link to="/hub/records/clients" />}>
            <ArrowLeftIcon /> Directory
          </Button>
          {canOpenAgency && client ? (
            <Button size="sm" variant="outline" render={<Link to={`/clients/${client.clientId}`} />}>
              Open in Agency OS
            </Button>
          ) : null}
        </>
      }
    >
      {status === "loading" ? (
        <Skeleton className="hub-records-detail-skel" />
      ) : status === "error" || !client ? (
        <div className="hub-admin-unavailable" role="alert">
          <Building2Icon />
          <div>
            <strong>Client unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="hub-records-detail">
          <section className="hub-records-panel">
            <header className="hub-reports-panel-head">
              <h2>Profile</h2>
              <span className="hub-reports-chip is-info">Shared Record · Agency</span>
            </header>
            <dl className="hub-records-kv">
              <div>
                <dt>Industry</dt>
                <dd>{client.industry || "—"}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{client.stage || "—"}</dd>
              </div>
              <div>
                <dt>Account lead</dt>
                <dd>{client.accountLead || "—"}</dd>
              </div>
              <div>
                <dt>Primary contact</dt>
                <dd>{client.primaryContact || "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{client.email || "—"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{client.phone || "—"}</dd>
              </div>
              <div>
                <dt>Tags</dt>
                <dd>{(client.tags || []).join(", ") || "—"}</dd>
              </div>
            </dl>
          </section>
          <section className="hub-records-panel">
            <header className="hub-reports-panel-head">
              <h2>Record access</h2>
            </header>
            <div className="hub-admin-unavailable" role="status">
              <LockIcon />
              <div>
                <strong>Access rules unavailable</strong>
                <p>
                  Designed share and editor matrices are not stored yet. This client remains
                  agency-scoped via authenticated membership.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </HubRecordsShell>
  )
}

export function HubVendorsDirectory() {
  const { user } = useAuth()
  const canOpenAgency = canAccessRoute(user?.role, "/vendors")
  const canWrite = canPerform(user?.role, "write_crm")
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all")

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await listVendors()
      setVendors(res.data ?? [])
      setStatus("ok")
    } catch (reason) {
      setVendors([])
      setStatus("error")
      setError(errorMessage(reason, "Vendor records could not be loaded."))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const statusOptions = useMemo(() => {
    const set = new Set(
      vendors.map((v) => String(v.status || "").trim()).filter(Boolean),
    )
    return ["all", ...Array.from(set).sort()]
  }, [vendors])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vendors.filter((vendor) => {
      if (statusFilter !== "all" && String(vendor.status || "") !== statusFilter) return false
      if (!q) return true
      return [vendor.name, vendor.category, vendor.contact, ...(vendor.skills || []), ...(vendor.regions || [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [vendors, search, statusFilter])

  return (
    <HubRecordsShell
      section="vendors"
      title="Vendors"
      description="Agency vendor directory. Rates and contract amounts stay finance-gated. Preferred / evaluating counts from the design are not invented."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCwIcon /> Refresh
          </Button>
          <Button size="sm" variant="outline" disabled title="Import is not implemented">
            Import
          </Button>
          {canOpenAgency && canWrite ? (
            <Button size="sm" render={<Link to="/vendors" />}>
              Add Vendor
            </Button>
          ) : (
            <Button size="sm" disabled>
              Add Vendor
            </Button>
          )}
        </>
      }
    >
      <div className="hub-admin-tabs hub-records-tabs">
        {statusOptions.map((option) => (
          <button
            key={option}
            type="button"
            className={cn(statusFilter === option && "is-active")}
            onClick={() => setStatusFilter(option)}
          >
            {option === "all" ? "All Vendors" : option}
            <span>
              {option === "all"
                ? vendors.length
                : vendors.filter((v) => String(v.status || "") === option).length}
            </span>
          </button>
        ))}
      </div>

      <div className="hub-records-toolbar">
        <div className="hub-members-search">
          <SearchIcon />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors, services and cities"
            aria-label="Search vendors"
          />
        </div>
        <span className="hub-records-count">
          {filtered.length} vendor{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {status === "loading" ? (
        <div className="hub-records-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="hub-records-card-skel" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="hub-admin-unavailable" role="alert">
          <HandshakeIcon />
          <div>
            <strong>Vendors unavailable</strong>
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="hub-admin-empty">
          <HandshakeIcon />
          <strong>No vendors yet</strong>
          <small>Agency vendors will appear here when created.</small>
        </div>
      ) : (
        <div className="hub-records-grid">
          {filtered.map((vendor) => (
            <Link
              key={vendor.vendorId}
              className="hub-records-card"
              to={`/hub/records/vendors/${vendor.vendorId}`}
            >
              <div className="hub-records-card-cover is-vendor" />
              <div className="hub-records-card-body">
                <div className="hub-records-card-topline">
                  <span className="hub-records-avatar">{initials(vendor.name)}</span>
                  <span className="hub-reports-chip is-info">{vendor.status || "Vendor"}</span>
                </div>
                <strong>{vendor.name}</strong>
                <p>{vendor.category || "No category"}</p>
                <div className="hub-records-meta">
                  {(vendor.regions || [])[0] ? (
                    <span>
                      <MapPinIcon />
                      {(vendor.regions || [])[0]}
                    </span>
                  ) : (
                    <span className="is-muted">
                      <MapPinIcon /> No region listed
                    </span>
                  )}
                  {vendor.rating != null ? (
                    <span>
                      <StarIcon />
                      {Number(vendor.rating).toFixed(1)}
                    </span>
                  ) : null}
                </div>
                <div className="hub-records-tags">
                  {(vendor.skills || []).slice(0, 3).map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                  {(vendor.skills || []).length === 0 ? (
                    <span className="is-muted">No skills listed</span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </HubRecordsShell>
  )
}

export function HubVendorDetailPage() {
  const { vendorId = "" } = useParams()
  const { user } = useAuth()
  const canOpenAgency = canAccessRoute(user?.role, "/vendors")
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!vendorId) return
    setStatus("loading")
    setError(null)
    try {
      const res = await getVendorProfile(vendorId)
      setVendor(res.data ?? null)
      setStatus(res.data ? "ok" : "error")
      if (!res.data) setError("Vendor not found.")
    } catch (reason) {
      setVendor(null)
      setStatus("error")
      setError(errorMessage(reason, "Vendor profile could not be loaded."))
    }
  }, [vendorId])

  useEffect(() => {
    void load()
  }, [load])

  const financeAccess = vendor?.financeAccess === true
  const score = vendor?.scorecard
  const hasScore =
    score &&
    [score.quality, score.onTimeDelivery, score.budgetAccuracy, score.communication].some(
      (v) => v != null,
    )

  return (
    <HubRecordsShell
      section="vendors"
      title={vendor?.name || "Vendor"}
      description="Shared vendor profile. Rate cards and contract amounts require Finance access."
      actions={
        <>
          <Button size="sm" variant="outline" render={<Link to="/hub/records/vendors" />}>
            <ArrowLeftIcon /> Directory
          </Button>
          {canOpenAgency && vendor ? (
            <Button size="sm" variant="outline" render={<Link to={`/vendors/${vendor.vendorId}`} />}>
              Open in Agency OS
            </Button>
          ) : null}
        </>
      }
    >
      {status === "loading" ? (
        <Skeleton className="hub-records-detail-skel" />
      ) : status === "error" || !vendor ? (
        <div className="hub-admin-unavailable" role="alert">
          <HandshakeIcon />
          <div>
            <strong>Vendor unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="hub-records-detail is-wide">
          <section className="hub-records-hero">
            <span className="hub-records-avatar is-lg">{initials(vendor.name)}</span>
            <div>
              <div className="hub-records-hero-title">
                <h2>{vendor.name}</h2>
                <span className="hub-reports-chip is-info">{vendor.status || "Vendor"}</span>
              </div>
              <div className="hub-records-meta">
                <span>
                  <LayersIcon />
                  {vendor.category || "—"}
                </span>
                {(vendor.regions || [])[0] ? (
                  <span>
                    <MapPinIcon />
                    {(vendor.regions || []).join(" · ")}
                  </span>
                ) : null}
                {vendor.rating != null ? (
                  <span>
                    <StarIcon />
                    {Number(vendor.rating).toFixed(1)}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <div className="hub-records-detail-row">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Profile</h2>
                <span className="hub-reports-chip is-info">Shared Record · Cosmos</span>
              </header>
              <dl className="hub-records-kv">
                <div>
                  <dt>Services</dt>
                  <dd>{(vendor.skills || []).join(", ") || "—"}</dd>
                </div>
                <div>
                  <dt>Primary contact</dt>
                  <dd>{vendor.contact || "—"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{vendor.email || "—"}</dd>
                </div>
                <div>
                  <dt>Rate card</dt>
                  <dd>
                    {financeAccess ? (
                      vendor.rateCard || "—"
                    ) : (
                      <span className="hub-records-locked">
                        <LockIcon /> Restricted · Finance only
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Insurance / COI</dt>
                  <dd className="hub-records-locked">
                    <LockIcon /> Not modeled in agency schema
                  </dd>
                </div>
              </dl>
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Agency OS · Vendor Scorecard</h2>
              </header>
              {hasScore ? (
                <ul className="hub-records-score">
                  <li>
                    <span>Quality</span>
                    <strong>{score?.quality ?? "—"}</strong>
                  </li>
                  <li>
                    <span>On-time delivery</span>
                    <strong>{score?.onTimeDelivery ?? "—"}</strong>
                  </li>
                  <li>
                    <span>Budget accuracy</span>
                    <strong>{score?.budgetAccuracy ?? "—"}</strong>
                  </li>
                  <li>
                    <span>Communication</span>
                    <strong>{score?.communication ?? "—"}</strong>
                  </li>
                </ul>
              ) : (
                <div className="hub-admin-unavailable" role="status">
                  <StarIcon />
                  <div>
                    <strong>Scorecard unavailable</strong>
                    <p>No scorecard values are stored for this vendor yet.</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="hub-records-detail-row">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Projects & Spend</h2>
              </header>
              {(vendor.projects || []).length === 0 ? (
                <div className="hub-admin-empty">
                  <LayersIcon />
                  <strong>No linked projects</strong>
                  <small>Project assignments appear when this vendor is attached to work.</small>
                </div>
              ) : (
                <ul className="hub-reports-toplist">
                  {(vendor.projects || []).map((project) => (
                    <li key={project.projectId}>
                      <div>
                        <strong>
                          <Link to={`/projects/${project.projectId}`}>{project.name}</Link>
                        </strong>
                        <small>
                          {project.clientName || "No client"} · {project.status}
                        </small>
                      </div>
                      <span>
                        {financeAccess
                          ? money(project.contractAmount)
                          : "Restricted"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!financeAccess ? (
                <p className="hub-records-footnote">
                  Contract amounts are redacted without Finance access (same gate as the vendor API).
                </p>
              ) : vendor.totalContracted != null ? (
                <p className="hub-records-footnote">
                  Total contracted {money(vendor.totalContracted)}
                </p>
              ) : null}
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Record access</h2>
              </header>
              <div className="hub-admin-unavailable" role="status">
                <LockIcon />
                <div>
                  <strong>Access matrix unavailable</strong>
                  <p>
                    Designed ownership, editor teams, and vendor-portal scopes are not stored as
                    first-class rules. Rates remain Finance-gated in the API.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </HubRecordsShell>
  )
}

export function HubContactsDirectory() {
  const { user } = useAuth()
  const canOpenAgency = canAccessRoute(user?.role, "/contacts")
  const canWrite = canPerform(user?.role, "write_crm")
  const [contacts, setContacts] = useState<CrmContact[]>([])
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await listCrmContacts()
      setContacts(res.data ?? [])
      setStatus("ok")
    } catch (reason) {
      setContacts([])
      setStatus("error")
      setError(errorMessage(reason, "Contact records could not be loaded."))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((contact) => {
      if (!q) return true
      return [contact.name, contact.email, contact.title, contact.clientName, contact.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [contacts, search])

  return (
    <HubRecordsShell
      section="contacts"
      title="Contacts"
      description="External contacts owned by this agency. Personal phones stay talent/admin gated. Contacts are not Cosmos users."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCwIcon /> Refresh
          </Button>
          {canOpenAgency && canWrite ? (
            <Button size="sm" render={<Link to="/contacts" />}>
              Add Contact
            </Button>
          ) : (
            <Button size="sm" disabled>
              Add Contact
            </Button>
          )}
        </>
      }
    >
      <div className="hub-records-toolbar">
        <div className="hub-members-search">
          <SearchIcon />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts"
            aria-label="Search contacts"
          />
        </div>
        <span className="hub-records-count">
          {filtered.length} contact{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {status === "loading" ? (
        <div className="hub-records-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="hub-records-row-skel" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="hub-admin-unavailable" role="alert">
          <UserRoundIcon />
          <div>
            <strong>Contacts unavailable</strong>
            <p>{error}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="hub-admin-empty">
          <UserRoundIcon />
          <strong>No contacts yet</strong>
          <small>External contacts will appear here when created.</small>
        </div>
      ) : (
        <div className="hub-records-list">
          {filtered.map((contact) => (
            <Link
              key={contact.contactId}
              className="hub-records-row"
              to={`/hub/records/contacts/${contact.contactId}`}
            >
              <span className="hub-records-avatar">{initials(contact.name)}</span>
              <div className="hub-records-row-copy">
                <strong>{contact.name}</strong>
                <small>
                  {[contact.title, contact.clientName].filter(Boolean).join(" · ") ||
                    "External contact"}
                </small>
              </div>
              <span className="hub-reports-chip is-neutral">No sign-in</span>
            </Link>
          ))}
        </div>
      )}
    </HubRecordsShell>
  )
}

export function HubContactDetailPage() {
  const { contactId = "" } = useParams()
  const { user } = useAuth()
  const canOpenAgency = canAccessRoute(user?.role, "/contacts")
  const [contact, setContact] = useState<CrmContact | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!contactId) return
    setStatus("loading")
    setError(null)
    try {
      const res = await getCrmContact(contactId)
      setContact(res.data ?? null)
      setStatus(res.data ? "ok" : "error")
      if (!res.data) setError("Contact not found.")
    } catch (reason) {
      setContact(null)
      setStatus("error")
      setError(errorMessage(reason, "Contact could not be loaded."))
    }
  }, [contactId])

  useEffect(() => {
    void load()
  }, [load])

  const phoneRestricted = contact?.privatePhoneAccess === false
  const details = contact?.contactDetails

  return (
    <HubRecordsShell
      section="contacts"
      title={contact?.name || "Contact"}
      description="External contact shared record. Restricted fields follow the contact phone privacy gate."
      actions={
        <>
          <Button size="sm" variant="outline" render={<Link to="/hub/records/contacts" />}>
            <ArrowLeftIcon /> Directory
          </Button>
          {canOpenAgency && contact ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link to={`/contacts/${contact.contactId}`} />}
            >
              Open in Agency OS
            </Button>
          ) : null}
        </>
      }
    >
      {status === "loading" ? (
        <Skeleton className="hub-records-detail-skel" />
      ) : status === "error" || !contact ? (
        <div className="hub-admin-unavailable" role="alert">
          <UserRoundIcon />
          <div>
            <strong>Contact unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="hub-records-detail is-wide">
          <section className="hub-records-hero">
            <span className="hub-records-avatar is-lg">{initials(contact.name)}</span>
            <div>
              <div className="hub-records-hero-title">
                <h2>{contact.name}</h2>
                <span className="hub-reports-chip is-neutral">External Contact · No Sign-In</span>
              </div>
              <p className="hub-records-hero-sub">
                {[contact.title, contact.clientName].filter(Boolean).join(" · ") ||
                  "External contact"}
              </p>
              <div className="hub-records-meta">
                {contact.clientName ? (
                  <span>
                    <Building2Icon />
                    {contact.clientName}
                  </span>
                ) : null}
                {details?.city || details?.state ? (
                  <span>
                    <MapPinIcon />
                    {[details?.city, details?.state, details?.country].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <div className="hub-records-detail-row">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Contact details</h2>
                <span className="hub-reports-chip is-info">Shared Record</span>
              </header>
              <dl className="hub-records-kv">
                <div>
                  <dt>Role</dt>
                  <dd>{contact.role || "—"}</dd>
                </div>
                <div>
                  <dt>Linked organization</dt>
                  <dd>{contact.clientName || "—"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`}>
                        <MailIcon /> {contact.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Personal phone</dt>
                  <dd>
                    {phoneRestricted ? (
                      <span className="hub-records-locked">
                        <LockIcon /> Restricted · Talent team only
                      </span>
                    ) : contact.phone ? (
                      <a href={`tel:${contact.phone}`}>
                        <PhoneIcon /> {contact.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Home address</dt>
                  <dd className="hub-records-locked">
                    <LockIcon /> Not stored in Cosmos
                  </dd>
                </div>
              </dl>
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Who can see this record</h2>
              </header>
              <div className="hub-admin-unavailable" role="status">
                <LockIcon />
                <div>
                  <strong>Access rules unavailable</strong>
                  <p>
                    Designed viewer/editor matrices and connected-organization shares are not
                    modeled. Visibility is agency membership plus field-level phone privacy.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="hub-records-detail-row">
            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Linked projects</h2>
              </header>
              {(contact.projects || []).length === 0 ? (
                <div className="hub-admin-empty">
                  <LayersIcon />
                  <strong>No project links</strong>
                  <small>Assignments appear when this contact is linked to projects.</small>
                </div>
              ) : (
                <ul className="hub-reports-toplist">
                  {(contact.projects || []).map((project) => (
                    <li key={`${project.projectId}-${project.role}`}>
                      <div>
                        <strong>
                          <Link to={`/projects/${project.projectId}`}>{project.projectName}</Link>
                        </strong>
                        <small>
                          {project.role || "—"} · {project.projectStatus}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="hub-records-panel">
              <header className="hub-reports-panel-head">
                <h2>Relationship timeline</h2>
              </header>
              <div className="hub-admin-unavailable" role="status">
                <LayersIcon />
                <div>
                  <strong>Activity unavailable</strong>
                  <p>
                    Cross-edition relationship activity is designed but not exposed as a shared
                    records feed.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </HubRecordsShell>
  )
}
