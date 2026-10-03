import { useEffect, useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { EntityFormDialog } from "@/components/shared/entity-form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  getPortalOverview,
  portalDecide,
  type PortalOverviewData,
} from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { clearPortalUser, getPortalUser } from "@/pages"

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ?? "border-slate-800 bg-slate-900/60"}`}>
      <div className="text-muted-foreground text-[11px] uppercase tracking-widest">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</div>
      {sub && <div className="text-muted-foreground mt-0.5 text-xs">{sub}</div>}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-700/40",
  pending: "bg-amber-500/20 text-amber-400 border-amber-700/40",
  changes_requested: "bg-orange-500/20 text-orange-400 border-orange-700/40",
  rejected: "bg-red-500/20 text-red-400 border-red-700/40",
}

const HEALTH_COLORS: Record<string, string> = {
  on_track: "text-emerald-400",
  at_risk: "text-amber-400",
  off_track: "text-red-400",
}

export function PortalHomePage() {
  const navigate = useNavigate()
  const user = getPortalUser()

  const [overview, setOverview] = useState<PortalOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"approvals" | "projects" | "assets" | "events">("approvals")

  // Decision dialog
  const [decisionTarget, setDecisionTarget] = useState<any | null>(null)
  const [decisionNotes, setDecisionNotes] = useState("")
  const [decisionBusy, setDecisionBusy] = useState(false)

  useEffect(() => {
    if (!user?.clientId) return
    let cancelled = false
    async function load() {
      try {
        const res = await getPortalOverview(user.clientId)
        if (!cancelled) setOverview(res.data ?? null)
      } catch {
        if (!cancelled) toast.error("Failed to load portal data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [user?.clientId])

  if (!user) return <Navigate to="/portal/login" replace />

  async function decide(id: string, decision: string, notes?: string) {
    setDecisionBusy(true)
    try {
      await portalDecide(id, decision, notes, undefined, user.clientId, user.portalUserId)
      // Refresh overview
      const res = await getPortalOverview(user.clientId)
      setOverview(res.data ?? null)
      toast.success(decision === "approved" ? "✅ Approved!" : "Response submitted")
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed")
      return false
    } finally {
      setDecisionBusy(false)
    }
  }

  async function submitChangesRequest() {
    if (!decisionTarget) return
    const notes = decisionNotes.trim()
    if (!notes) { toast.error("Add notes explaining requested changes"); return }
    if (await decide(decisionTarget.approvalId, "changes_requested", notes)) {
      setDecisionTarget(null)
      setDecisionNotes("")
    }
  }

  function logout() {
    clearPortalUser()
    navigate("/portal/login", { replace: true })
  }

  const approvals = overview?.approvals ?? []
  const projects = overview?.projects ?? []
  const assets = overview?.assets ?? []
  const events = overview?.upcomingEvents ?? []
  const stats = overview?.stats

  const pendingCount = approvals.filter((a: any) => a.status === "pending" || a.status === "changes_requested").length

  const TABS: { key: "approvals" | "projects" | "assets" | "events"; label: string; badge?: number }[] = [
    { key: "approvals", label: "Approvals", badge: pendingCount || undefined },
    { key: "projects", label: "Projects" },
    { key: "assets", label: "Assets" },
    { key: "events", label: "Events" },
  ]

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 ring-1 ring-sky-500/40">
              <svg className="size-4 text-sky-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Cosmos Client Portal</div>
              <div className="text-xs text-slate-400">{user.clientName} · {user.name}</div>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* KPI row */}
        {loading ? (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl bg-slate-800" />)}
          </div>
        ) : (
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label="Active projects"
              value={stats?.activeProjectsCount ?? projects.length}
              accent="border-sky-800/40 bg-sky-950/30"
            />
            <KpiCard
              label="Pending approvals"
              value={stats?.pendingApprovalsCount ?? pendingCount}
              accent={pendingCount > 0 ? "border-amber-800/40 bg-amber-950/30" : "border-slate-800 bg-slate-900/60"}
            />
            <KpiCard
              label="Shared assets"
              value={assets.length}
            />
            <KpiCard
              label="Upcoming events"
              value={events.length}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-sky-900/40 text-sky-300 ring-1 ring-sky-700/50"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* --- APPROVALS TAB --- */}
        {tab === "approvals" && (
          <section className="flex flex-col gap-3">
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl bg-slate-800" />
            ) : approvals.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
                No open approvals — you're all caught up 🎉
              </Card>
            ) : (
              approvals.map((a: any) => (
                <Card key={a.approvalId} className="border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-white">{a.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLORS[a.status] ?? ""}`}
                        >
                          {a.status?.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-slate-500 capitalize">{a.entityType?.replace("_", " ")}</span>
                      </div>
                      {a.notes && (
                        <p className="mt-1.5 text-sm text-slate-400">{a.notes}</p>
                      )}
                    </div>
                    {(a.status === "pending" || a.status === "changes_requested") && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-700 text-white hover:bg-emerald-600"
                          disabled={decisionBusy}
                          onClick={() => void decide(a.approvalId, "approved")}
                        >
                          ✅ Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-700/50 text-amber-400 hover:bg-amber-950/40"
                          disabled={decisionBusy}
                          onClick={() => { setDecisionTarget(a); setDecisionNotes("") }}
                        >
                          ✏️ Request changes
                        </Button>
                      </div>
                    )}
                    {a.status === "approved" && <Badge className="border-emerald-700/40 bg-emerald-950/30 text-emerald-400">Approved</Badge>}
                  </div>
                </Card>
              ))
            )}
          </section>
        )}

        {/* --- PROJECTS TAB --- */}
        {tab === "projects" && (
          <section className="flex flex-col gap-3">
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl bg-slate-800" />
            ) : projects.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
                No active projects found.
              </Card>
            ) : (
              projects.map((p: any) => (
                <Card key={p.projectId} className="border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{p.status?.replace("_", " ")}</div>
                    </div>
                    {p.health && (
                      <span className={`text-sm font-semibold ${HEALTH_COLORS[p.health] ?? "text-slate-300"}`}>
                        {p.health === "on_track" ? "✅ On track" : p.health === "at_risk" ? "⚠️ At risk" : "🔴 Off track"}
                      </span>
                    )}
                  </div>
                  {/* Milestone pacing bar */}
                  {typeof p.progress === "number" && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                        <span>Milestone pacing</span>
                        <span>{p.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800">
                        <div
                          className="h-1.5 rounded-full bg-sky-500 transition-all"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {p.nextMilestone && (
                    <div className="mt-2 text-xs text-slate-400">
                      Next: <span className="text-slate-200">{p.nextMilestone}</span>
                    </div>
                  )}
                </Card>
              ))
            )}
          </section>
        )}

        {/* --- ASSETS TAB --- */}
        {tab === "assets" && (
          <section>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl bg-slate-800" />
            ) : assets.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
                No shared assets yet.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {assets.map((asset: any) => (
                  <Card key={asset.assetId} className="flex items-center gap-3 border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-lg">
                      {asset.fileType?.startsWith("image") ? "🖼️" :
                       asset.fileType?.includes("pdf") ? "📄" :
                       asset.fileType?.includes("video") ? "🎬" : "📁"}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">{asset.assetName}</div>
                      <div className="text-xs text-slate-400">
                        {asset.fileType} · v{asset.version}
                        {asset.status ? ` · ${asset.status}` : ""}
                      </div>
                    </div>
                    {asset.fileUrl && (
                      <a
                        href={asset.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto shrink-0 text-sky-400 hover:text-sky-300 text-xs underline"
                      >
                        View
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* --- EVENTS TAB --- */}
        {tab === "events" && (
          <section className="flex flex-col gap-3">
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl bg-slate-800" />
            ) : events.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
                No upcoming events.
              </Card>
            ) : (
              events.map((ev: any) => (
                <Card key={ev.eventId} className="border-slate-800 bg-slate-900/60 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">{ev.name ?? ev.title}</div>
                      <div className="text-xs text-slate-400">
                        {ev.venue ? `${ev.venue} · ` : ""}
                        {ev.startDate ? new Date(ev.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-sky-700/40 bg-sky-950/20 capitalize text-sky-400"
                    >
                      {ev.status?.replace("_", " ") ?? "upcoming"}
                    </Badge>
                  </div>
                  {ev.cueCount != null && (
                    <div className="mt-1.5 text-xs text-slate-400">{ev.cueCount} cues in rundown</div>
                  )}
                </Card>
              ))
            )}
          </section>
        )}
      </main>

      {/* Changes request dialog */}
      <EntityFormDialog
        open={Boolean(decisionTarget)}
        onOpenChange={(open) => {
          if (!open && !decisionBusy) {
            setDecisionTarget(null)
            setDecisionNotes("")
          }
        }}
        title="Request Changes"
        description={decisionTarget ? `Add notes for "${decisionTarget.title}".` : undefined}
        onSubmit={submitChangesRequest}
        submitLabel="Send request"
        pending={decisionBusy}
        submitDisabled={!decisionNotes.trim()}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="portal-decision-notes">Notes</Label>
          <Textarea
            id="portal-decision-notes"
            value={decisionNotes}
            onChange={(e) => setDecisionNotes(e.target.value)}
            placeholder="Explain what needs to be changed before approval."
            required
            autoFocus
          />
        </div>
      </EntityFormDialog>
    </div>
  )
}
