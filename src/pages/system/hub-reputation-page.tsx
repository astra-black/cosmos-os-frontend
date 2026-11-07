/**
 * Hub · Reviews & Reputation command center — Figma 00.08 (`1120:2`)
 *
 * Evidence: Computer Use selected group 00.08 · Feedback, Reviews & Reputation
 * (`1120:2`, dark+light grid) in Figma Desktop. Library/detail/reply structure from
 * FEEDBACK_REPUTATION §9.1 / build_reputation.py `library`/`detail`/`reply` /
 * build_rep_hub.py PLAN indices 3–7 (frames 03–08). Child frame node IDs and
 * pixel compare of zoomed 03–08 dark/light not claimed (MCP rate-limit + zoom).
 *
 * Slices: Overview shell (01–02) + Feedback library/detail (03–08) with real
 * FeedbackResponse API only. No Approval/Comment mapping, no fabricated
 * sentiment/ratings. Reply send + testimonial publish stay unavailable.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeftIcon,
  BarChart3Icon,
  CircleAlertIcon,
  InboxIcon,
  LayersIcon,
  LockIcon,
  MessageSquareQuoteIcon,
  PlugIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/lib/api/client"
import {
  getHubReputationCommandCenter,
  getHubReputationFeedbackDetail,
  listHubReputationFeedback,
  type HubFeedbackDetail,
  type HubFeedbackLibrary,
  type HubFeedbackListItem,
  type HubReputationCommandCenter,
  type HubReputationPanel,
} from "@/lib/api/platform"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

type RepSection =
  | "overview"
  | "analysis"
  | "inbox"
  | "feedback"
  | "requests"
  | "testimonials"
  | "sources"
  | "automation"

const TAB_ICONS: Record<RepSection, typeof StarIcon> = {
  overview: StarIcon,
  analysis: BarChart3Icon,
  inbox: InboxIcon,
  feedback: MessageSquareQuoteIcon,
  requests: SendIcon,
  testimonials: SparklesIcon,
  sources: PlugIcon,
  automation: ZapIcon,
}

function sectionFromPath(pathname: string): RepSection {
  if (pathname.includes("/analysis")) return "analysis"
  if (pathname.includes("/inbox")) return "inbox"
  if (pathname.includes("/feedback")) return "feedback"
  if (pathname.includes("/requests")) return "requests"
  if (pathname.includes("/testimonials")) return "testimonials"
  if (pathname.includes("/sources")) return "sources"
  if (pathname.includes("/automation")) return "automation"
  return "overview"
}

function Unavailable({
  title,
  children,
  measured,
}: {
  title: string
  children: ReactNode
  measured?: string
}) {
  return (
    <div className="hub-admin-unavailable hub-rep-unavailable" role="status">
      <CircleAlertIcon />
      <div>
        <div className="hub-rep-unavailable-head">
          <strong>{title}</strong>
          {measured ? (
            <span className={cn("hub-reports-chip", measured === "inferred" && "is-info")}>
              {measured === "inferred" ? "Inferred · unavailable" : "Measured · unavailable"}
            </span>
          ) : null}
        </div>
        <p>{children}</p>
      </div>
    </div>
  )
}

function PanelCard({ panel }: { panel: HubReputationPanel }) {
  return (
    <section className="hub-records-panel hub-rep-panel">
      <header className="hub-reports-panel-head">
        <h2>{panel.title}</h2>
        <span
          className={cn(
            "hub-reports-chip",
            panel.measuredOrInferred === "inferred" && "is-info",
          )}
        >
          {panel.measuredOrInferred === "inferred" ? "Inferred" : "Measured"}
        </span>
      </header>
      <Unavailable title="No reputation data" measured={panel.measuredOrInferred}>
        {panel.unavailableReason}
      </Unavailable>
    </section>
  )
}

function ReputationShell({
  title,
  description,
  actions,
  children,
  data,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
  data: HubReputationCommandCenter | null
}) {
  const location = useLocation()
  const section = sectionFromPath(location.pathname)
  const { user } = useAuth()
  const orgName = user?.agencyName || "Your organization"
  const tabs = data?.tabs || []

  return (
    <div
      className="cosmos-home hub-admin hub-reputation"
      data-figma="00.08 · Feedback, Reviews & Reputation"
      data-node-id="1120:2"
      data-evidence="computer-use-group-inspect"
      data-slice="command-center-overview"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub">
            <ArrowLeftIcon /> Hub
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Cosmos Hub · Organization
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="hub-admin-actions">{actions}</div> : null}
      </header>

      {tabs.length > 0 ? (
        <nav className="hub-admin-tabs hub-rep-tabs" aria-label="Reputation">
          {tabs.map((tab) => {
            const id = tab.id as RepSection
            const Icon = TAB_ICONS[id] || StarIcon
            return (
              <Link
                key={tab.id}
                to={tab.href}
                className={cn(section === id && "is-active")}
              >
                <Icon />
                {tab.title}
              </Link>
            )
          })}
        </nav>
      ) : null}

      {children}
    </div>
  )
}

function useReputationCenter() {
  const [data, setData] = useState<HubReputationCommandCenter | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await getHubReputationCommandCenter()
      setData(res.data ?? null)
      setStatus("ok")
    } catch (reason) {
      setData(null)
      setStatus("error")
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Reputation command center could not be loaded.",
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { data, status, error, load }
}

function NoAccess({ data }: { data: HubReputationCommandCenter | null }) {
  return (
    <ReputationShell
      title="Reviews & Reputation"
      description="Organization feedback, reviews and testimonials. Access follows Reputation capability rules."
      data={data}
    >
      <div className="hub-admin-restricted" role="status">
        <LockIcon />
        <div>
          <strong>Reputation is limited to organization leaders</strong>
          <p>
            You can use creative proof approvals in Agency OS when assigned. Organization
            reputation analytics and the feedback library are not available for your role
            {data?.noAccessFrames ? ` (designed as ${data.noAccessFrames})` : ""}. Ask an
            owner or administrator if you need the organization view.
          </p>
          <div className="hub-rep-related-actions">
            <Button size="sm" variant="outline" render={<Link to="/approvals" />}>
              Open creative approvals
            </Button>
            <Button size="sm" variant="ghost" render={<Link to="/hub" />}>
              Back to Hub
            </Button>
          </div>
        </div>
      </div>
    </ReputationShell>
  )
}

function OverviewBody({ data }: { data: HubReputationCommandCenter }) {
  const panels = data.overview?.panels || []
  const byId = useMemo(() => {
    const map = new Map(panels.map((p) => [p.id, p]))
    return map
  }, [panels])

  const kpis = byId.get("kpis")
  const trend = byId.get("trend")
  const attention = byId.get("needs-attention")
  const changed = byId.get("what-changed")
  const edition = byId.get("by-edition")
  const location = byId.get("by-location")
  const funnel = byId.get("testimonial-funnel")

  return (
    <div className="hub-rep-stack">
      <div className="hub-rep-scope">
        <div className="hub-account-seg" aria-label="Period">
          {(data.overview.periodOptions || ["90 Days"]).map((period) => (
            <button
              key={period}
              type="button"
              className={cn(period === data.overview.defaultPeriod && "is-active")}
              disabled
              title="Period filtering requires reputation read models"
            >
              {period}
            </button>
          ))}
        </div>
        <span className="hub-org-muted">vs prior period · unavailable</span>
        <div className="hub-rep-filters">
          {(data.overview.filtersUnavailable || []).map((label) => (
            <Button key={label} size="sm" variant="outline" disabled title="Filter unavailable">
              {label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="hub-rep-scope-action"
          disabled
          title={data.overview.actions.executiveSummary.reason}
        >
          <LayersIcon />
          Executive Summary
        </Button>
      </div>

      {data.scope === "own_projects" ? (
        <Unavailable title="Organization roll-ups are out of scope for your role">
          Producers see project-scoped feedback when Reputation records exist. Organization
          KPIs and cross-project trends stay unavailable rather than fabricating values.
        </Unavailable>
      ) : null}

      <div className="hub-rep-kpi-row">
        {(kpis
          ? [
              "Responses",
              "Response Rate",
              "Satisfaction",
              "NPS",
              "Open Follow-Ups",
            ]
          : []
        ).map((label) => (
          <div key={label} className="hub-records-panel hub-rep-kpi">
            <small>{label}</small>
            <strong>—</strong>
            <span>Not available</span>
          </div>
        ))}
      </div>
      {kpis ? (
        <Unavailable title="Measured KPIs unavailable" measured="measured">
          {kpis.unavailableReason}
        </Unavailable>
      ) : null}

      <div className="hub-rep-main-grid">
        <div className="hub-rep-main-col">
          {trend ? <PanelCard panel={trend} /> : null}
        </div>
        <div className="hub-rep-side-col">
          {attention ? <PanelCard panel={attention} /> : null}
          {changed ? <PanelCard panel={changed} /> : null}
        </div>
      </div>

      <div className="hub-rep-bottom-grid">
        {edition ? <PanelCard panel={edition} /> : null}
        {location ? <PanelCard panel={location} /> : null}
        {funnel ? <PanelCard panel={funnel} /> : null}
      </div>

      <section className="hub-records-panel">
        <header className="hub-reports-panel-head">
          <h2>Related surfaces</h2>
          <span className="hub-reports-chip">Not reputation data</span>
        </header>
        <ul className="hub-rep-related">
          {(data.relatedSurfaces || []).map((surface) => (
            <li key={surface.id}>
              <div>
                <strong>{surface.title}</strong>
                <p>{surface.note}</p>
              </div>
              <Button size="sm" variant="outline" render={<Link to={surface.href} />}>
                Open
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function TabUnavailablePage({
  tabId,
  data,
}: {
  tabId: RepSection
  data: HubReputationCommandCenter | null
}) {
  const tab = data?.tabs?.find((t) => t.id === tabId)
  const title = tab?.title || "Reviews & Reputation"
  return (
    <ReputationShell
      title={title}
      description={
        tab?.purpose ||
        "Hub Reviews & Reputation. This tab has no live records until Reputation entities are provisioned."
      }
      data={data}
      actions={
        <Button size="sm" variant="outline" render={<Link to="/hub/reputation" />}>
          Back to Overview
        </Button>
      }
    >
      <Unavailable title={`${title} unavailable`}>
        {tab?.unavailableReason ||
          "This Reputation surface is Designed in Figma but not backed by organization feedback records yet."}
        {tab?.frames ? ` Designed as ${tab.frames}.` : null}
      </Unavailable>
    </ReputationShell>
  )
}

function ReputationGate({
  children,
}: {
  children: (data: HubReputationCommandCenter) => ReactNode
}) {
  const { data, status, error, load } = useReputationCenter()

  if (status === "loading") {
    return (
      <div className="cosmos-home hub-admin hub-reputation">
        <header className="hub-admin-header">
          <div>
            <Link className="hub-admin-back" to="/hub">
              <ArrowLeftIcon /> Hub
            </Link>
            <h1>Reviews & Reputation</h1>
            <p>Loading command center…</p>
          </div>
        </header>
        <Skeleton className="h-10 w-full max-w-3xl" />
        <div className="hub-rep-kpi-row mt-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (status === "error" || !data) {
    return (
      <div className="cosmos-home hub-admin hub-reputation">
        <header className="hub-admin-header">
          <div>
            <Link className="hub-admin-back" to="/hub">
              <ArrowLeftIcon /> Hub
            </Link>
            <h1>Reviews & Reputation</h1>
            <p>The command center could not be loaded.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCwIcon />
            Retry
          </Button>
        </header>
        <Unavailable title="Reputation unavailable">{error}</Unavailable>
      </div>
    )
  }

  if (!data.access) {
    return <NoAccess data={data} />
  }

  return <>{children(data)}</>
}

export function HubReputationOverviewPage() {
  return (
    <ReputationGate>
      {(data) => (
        <ReputationShell
          title="Reviews & Reputation"
          description="Organization command center for feedback, reviews and testimonials. Missing measured data stays empty — creative approvals are a separate Agency OS surface."
          data={data}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled
                title={data.overview.actions.requestFeedback.reason}
              >
                <SendIcon />
                Request Feedback
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                <RefreshCwIcon />
                Refresh
              </Button>
            </>
          }
        >
          <OverviewBody data={data} />
        </ReputationShell>
      )}
    </ReputationGate>
  )
}

export function HubReputationAnalysisPage() {
  return (
    <ReputationGate>
      {(data) => <TabUnavailablePage tabId="analysis" data={data} />}
    </ReputationGate>
  )
}

export function HubReputationInboxPage() {
  return (
    <ReputationGate>
      {(data) => <TabUnavailablePage tabId="inbox" data={data} />}
    </ReputationGate>
  )
}

function FeedbackStatusChip({
  label,
  tone,
}: {
  label: string
  tone?: string
}) {
  return (
    <span
      className={cn(
        "hub-status",
        tone === "success" && "is-success",
        tone === "critical" && "is-critical",
        tone === "info" && "is-info",
        tone === "warning" && "is-warning",
        (!tone || tone === "neutral") && "is-neutral",
      )}
    >
      {label}
    </span>
  )
}

function FeedbackDetailDrawer({
  responseId,
  onClose,
}: {
  responseId: string
  onClose: () => void
}) {
  const [item, setItem] = useState<HubFeedbackDetail | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await getHubReputationFeedbackDetail(responseId)
      setItem(res.data?.item ?? null)
      setStatus("ok")
    } catch (reason) {
      setItem(null)
      setStatus("error")
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Feedback detail could not be loaded.",
      )
    }
  }, [responseId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="hub-rep-drawer-root" role="dialog" aria-modal="true" aria-label="Feedback detail">
      <button type="button" className="hub-rep-drawer-scrim" aria-label="Close detail" onClick={onClose} />
      <aside className="hub-rep-drawer" data-figma="00.08 · 05–06">
        <header className="hub-rep-drawer-head">
          <div>
            <p className="hub-rep-drawer-eyebrow">
              Feedback
              {item?.sourceLabel ? ` · ${item.sourceLabel}` : ""}
            </p>
            <h2>{item?.project?.name || "Feedback detail"}</h2>
            <p>Internal · organization scope</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">
            <XIcon />
          </Button>
        </header>

        <div className="hub-rep-drawer-body">
          {status === "loading" ? (
            <div className="hub-rep-stack">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}

          {status === "error" ? (
            <Unavailable title="Detail unavailable">
              {error}
              <div className="hub-rep-related-actions">
                <Button size="sm" variant="outline" onClick={() => void load()}>
                  <RefreshCwIcon />
                  Retry
                </Button>
              </div>
            </Unavailable>
          ) : null}

          {status === "ok" && item ? (
            <div className="hub-rep-stack">
              <div className="hub-rep-detail-person">
                <div className="hub-rep-avatar" aria-hidden>
                  {(item.respondent?.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong>{item.respondent?.name || "Unknown respondent"}</strong>
                  <p>
                    {[item.respondent?.title, item.respondent?.clientName]
                      .filter(Boolean)
                      .join(" · ") || "Contact record"}
                  </p>
                  <p className="hub-org-muted">
                    Contact ID (person) — not Client or TeamMember
                  </p>
                </div>
                <FeedbackStatusChip
                  label={item.statusLabel || item.status}
                  tone={item.statusTone}
                />
              </div>

              <section className="hub-records-panel hub-rep-quote">
                <p>{item.text ? `“${item.text}”` : "No free-text response recorded."}</p>
                <div className="hub-rep-quote-meta">
                  {[item.editionLabel, item.project?.name, item.sourceLabel, item.receivedAt ? new Date(item.receivedAt).toLocaleString() : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </section>

              <div className="hub-rep-detail-metrics">
                <section className="hub-records-panel">
                  <header className="hub-reports-panel-head">
                    <h2>Satisfaction</h2>
                    <span className="hub-reports-chip">Measured</span>
                  </header>
                  <strong className="hub-rep-metric-value">{item.scoreLabel}</strong>
                  <p className="hub-org-muted">
                    {item.ratings?.[0]?.questionPrompt ||
                      "Shown only when a satisfaction question was asked."}
                  </p>
                </section>
                <section className="hub-records-panel">
                  <header className="hub-reports-panel-head">
                    <h2>Sentiment</h2>
                    <span className="hub-reports-chip is-info">Inferred · unavailable</span>
                  </header>
                  <Unavailable title="Not analyzed" measured="inferred">
                    {item.sentimentUnavailableReason ||
                      item.analysis?.reason ||
                      "No Analyzer run is stored."}
                  </Unavailable>
                </section>
              </div>

              {item.ratings?.length ? (
                <section className="hub-records-panel">
                  <header className="hub-reports-panel-head">
                    <h2>Ratings asked</h2>
                    <span className="hub-reports-chip">Measured</span>
                  </header>
                  <ul className="hub-rep-rating-list">
                    {item.ratings.map((rating) => (
                      <li key={rating.id}>
                        <div>
                          <strong>{rating.questionPrompt}</strong>
                          <p>
                            {rating.questionId} · scale {rating.scale}
                          </p>
                        </div>
                        <span>{rating.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="hub-records-panel">
                <header className="hub-reports-panel-head">
                  <h2>Review & Feedback Analyzer</h2>
                  <span className="hub-reports-chip is-info">Inferred · unavailable</span>
                </header>
                <Unavailable title="Themes unavailable" measured="inferred">
                  {item.analysis?.reason}
                </Unavailable>
                <div className="hub-rep-related-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title={item.actions?.createFollowUp?.reason}
                  >
                    Create Follow-Up
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title={item.actions?.draftReply?.reason}
                  >
                    Draft Reply
                  </Button>
                </div>
              </section>

              <section className="hub-records-panel">
                <ul className="hub-rep-related">
                  <li>
                    <div>
                      <strong>Follow-up case</strong>
                      <p>
                        {item.followUp?.caseAvailable
                          ? "Open"
                          : item.followUp?.caseUnavailableReason}
                        {item.assignedMember
                          ? ` · Assigned to ${item.assignedMember.name}`
                          : ""}
                      </p>
                    </div>
                    <FeedbackStatusChip
                      label={item.assignedMember ? "Assigned" : "None"}
                      tone={item.assignedMember ? "info" : "neutral"}
                    />
                  </li>
                  <li>
                    <div>
                      <strong>Testimonial</strong>
                      <p>
                        Quote consent on response:{" "}
                        {item.consentToQuote ? "Yes" : "No"}.{" "}
                        {item.testimonial?.publicationUnavailableReason}
                      </p>
                    </div>
                    <FeedbackStatusChip
                      label={item.consentToQuote ? "Consent to quote" : "No Consent Yet"}
                      tone={item.consentToQuote ? "success" : "neutral"}
                    />
                  </li>
                </ul>
              </section>

              {item.relatedNote ? (
                <p className="hub-org-muted hub-rep-footnote">{item.relatedNote}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="hub-rep-drawer-foot">
          <Button
            size="sm"
            variant="outline"
            disabled
            title={item?.actions?.assign?.reason || "Assign unavailable"}
          >
            Assign
          </Button>
          <div className="hub-rep-drawer-foot-actions">
            <Button
              size="sm"
              variant="outline"
              disabled
              title={item?.actions?.requestTestimonial?.reason || "Unavailable"}
            >
              Request Testimonial
            </Button>
            <Button
              size="sm"
              disabled
              title={item?.actions?.reply?.reason || "Reply send unavailable"}
            >
              <SendIcon />
              Reply
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  )
}

function FeedbackLibraryBody({
  center,
  selectedId,
}: {
  center: HubReputationCommandCenter
  selectedId?: string
}) {
  const navigate = useNavigate()
  const [library, setLibrary] = useState<HubFeedbackLibrary | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [source, setSource] = useState("")
  const [responseStatus, setResponseStatus] = useState("")
  const [consent, setConsent] = useState("")

  useEffect(() => {
    const handle = window.setTimeout(() => setQDebounced(q.trim()), 280)
    return () => window.clearTimeout(handle)
  }, [q])

  const load = useCallback(async () => {
    setStatus("loading")
    setError(null)
    try {
      const res = await listHubReputationFeedback({
        q: qDebounced || undefined,
        source: source || undefined,
        status: responseStatus || undefined,
        consent: consent || undefined,
      })
      setLibrary(res.data ?? null)
      setStatus("ok")
    } catch (reason) {
      setLibrary(null)
      setStatus("error")
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Feedback library could not be loaded.",
      )
    }
  }, [qDebounced, source, responseStatus, consent])

  useEffect(() => {
    void load()
  }, [load])

  const items = library?.items || []

  return (
    <div className="hub-rep-stack" data-figma="00.08 · 03–04">
      <div className="hub-rep-scope hub-rep-feedback-toolbar">
        <div className="hub-rep-search">
          <SearchIcon />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search feedback"
            aria-label="Search feedback"
          />
        </div>
        <select
          className="hub-rep-select"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          aria-label="Source filter"
        >
          <option value="">Source</option>
          {(library?.filterOptions?.source || []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled title="Edition filter uses stored edition keys when present">
          Edition
        </Button>
        <select
          className="hub-rep-select"
          value={responseStatus}
          onChange={(event) => setResponseStatus(event.target.value)}
          aria-label="Status filter"
        >
          <option value="">Status</option>
          {(library?.filterOptions?.status || []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="hub-rep-select"
          value={consent}
          onChange={(event) => setConsent(event.target.value)}
          aria-label="Consent filter"
        >
          <option value="">Consent</option>
          {(library?.filterOptions?.consent || []).map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled
          title={
            library?.filterOptions?.sentiment?.reason ||
            "Sentiment filter requires Analyzer inference stores"
          }
        >
          Sentiment
        </Button>
        <Button size="sm" variant="outline" className="hub-rep-scope-action" onClick={() => void load()}>
          <RefreshCwIcon />
          Refresh
        </Button>
      </div>

      {center.scope === "own_projects" ? (
        <Unavailable title="Scoped to your projects and assigned items">
          Producers see Feedback Responses for projects they lead or are assigned to,
          plus items assigned to them for follow-up. Organization-wide rows stay hidden.
        </Unavailable>
      ) : null}

      {status === "loading" ? (
        <div className="hub-records-panel">
          <Skeleton className="h-10 w-full mb-3" />
          <Skeleton className="h-14 w-full mb-2" />
          <Skeleton className="h-14 w-full mb-2" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      {status === "error" ? (
        <Unavailable title="Feedback library unavailable">
          {error}
          <div className="hub-rep-related-actions">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCwIcon />
              Retry
            </Button>
          </div>
        </Unavailable>
      ) : null}

      {status === "ok" && library ? (
        <section className="hub-records-panel hub-rep-feedback-table-wrap">
          {library.provisioned === false ? (
            <Unavailable title="Schema pending">
              {library.emptyReason ||
                "Feedback Response tables are defined but not applied to this database yet."}
            </Unavailable>
          ) : items.length === 0 ? (
            <div className="hub-admin-empty" role="status">
              <MessageSquareQuoteIcon />
              <strong>No feedback in scope</strong>
              <small>
                {library.emptyReason ||
                  "The library stays empty until genuine Feedback Response records exist. Approvals and comments are not mapped here."}
              </small>
            </div>
          ) : (
            <div className="hub-rep-feedback-table" role="table" aria-label="Feedback library">
              <div className="hub-rep-feedback-row is-head" role="row">
                <span role="columnheader">Feedback</span>
                <span role="columnheader">Project</span>
                <span role="columnheader">Source</span>
                <span role="columnheader">Score</span>
                <span role="columnheader">Sentiment</span>
                <span role="columnheader">Status</span>
              </div>
              {items.map((row: HubFeedbackListItem) => (
                <button
                  key={row.id}
                  type="button"
                  role="row"
                  className={cn(
                    "hub-rep-feedback-row",
                    selectedId === row.id && "is-selected",
                  )}
                  onClick={() => navigate(`/hub/reputation/feedback/${row.id}`)}
                >
                  <span role="cell" className="hub-rep-feedback-main">
                    <span className="hub-rep-avatar is-sm" aria-hidden>
                      {(row.respondent?.name || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <strong>
                        {row.respondent?.name || "Unknown"}
                        {row.respondent?.clientName
                          ? ` · ${row.respondent.clientName}`
                          : ""}
                      </strong>
                      <small>
                        {row.excerpt
                          ? row.excerpt.length >= 140
                            ? `${row.excerpt}…`
                            : row.excerpt
                          : "No excerpt"}
                      </small>
                    </span>
                  </span>
                  <span role="cell">
                    {row.editionLabel ? (
                      <span className="hub-rep-edition">{row.editionLabel}</span>
                    ) : null}{" "}
                    {row.project?.name || "—"}
                  </span>
                  <span role="cell">{row.sourceLabel || row.source}</span>
                  <span role="cell">
                    <strong>{row.scoreLabel}</strong>
                  </span>
                  <span role="cell">
                    <span className="hub-reports-chip is-info">Inferred · —</span>
                  </span>
                  <span role="cell">
                    <FeedbackStatusChip
                      label={row.statusLabel || row.status}
                      tone={row.statusTone}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="hub-rep-footnote">
            <ShieldIcon /> Feedback from external people is visible only within your
            Reputation scope. Measured scores come from questions that were asked;
            sentiment is never invented.
            {typeof library.total === "number" ? ` · ${library.total} in scope` : null}
          </p>
        </section>
      ) : null}

      {selectedId ? (
        <FeedbackDetailDrawer
          responseId={selectedId}
          onClose={() => navigate("/hub/reputation/feedback")}
        />
      ) : null}
    </div>
  )
}

export function HubReputationFeedbackPage() {
  const { responseId } = useParams<{ responseId?: string }>()
  return (
    <ReputationGate>
      {(data) => (
        <ReputationShell
          title="Feedback"
          description="Organization feedback library. Responses are Contact-attributed person records with measured ratings only when a question was asked."
          data={data}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                disabled
                title="Feedback Request create/send requires consent checks and a delivery provider"
              >
                <SendIcon />
                Request Feedback
              </Button>
              <Button size="sm" variant="outline" render={<Link to="/hub/reputation" />}>
                Back to Overview
              </Button>
            </>
          }
        >
          <FeedbackLibraryBody center={data} selectedId={responseId} />
        </ReputationShell>
      )}
    </ReputationGate>
  )
}

export function HubReputationRequestsPage() {
  return (
    <ReputationGate>
      {(data) => <TabUnavailablePage tabId="requests" data={data} />}
    </ReputationGate>
  )
}

export function HubReputationTestimonialsPage() {
  return (
    <ReputationGate>
      {(data) => <TabUnavailablePage tabId="testimonials" data={data} />}
    </ReputationGate>
  )
}

export function HubReputationSourcesPage() {
  return (
    <ReputationGate>
      {(data) => <TabUnavailablePage tabId="sources" data={data} />}
    </ReputationGate>
  )
}

export function HubReputationAutomationPage() {
  return (
    <ReputationGate>
      {(data) => <TabUnavailablePage tabId="automation" data={data} />}
    </ReputationGate>
  )
}

export function HubReputationPage() {
  return <HubReputationOverviewPage />
}
