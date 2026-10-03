import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { decideDirectReview, validateDirectReviewToken } from "@/lib/api/platform"

type Phase = "loading" | "invalid" | "ready" | "decided"

const ENTITY_LABELS: Record<string, string> = {
  event_rundown: "Event Rundown",
  spatial_stage: "Spatial Stage Blueprint",
  creative_asset: "Creative Asset",
  budget: "Budget / Change Order",
}

const DECISION_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: "✅ Approved", color: "text-emerald-400" },
  changes_requested: { label: "⚠️ Changes Requested", color: "text-amber-400" },
  rejected: { label: "❌ Declined", color: "text-red-400" },
}

export function PortalDirectReviewPage() {
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""

  const [phase, setPhase] = useState<Phase>("loading")
  const [data, setData] = useState<any>(null)
  const [decidedVerb, setDecidedVerb] = useState<string>("")

  // Decision modal state
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState("")
  const [pendingDecision, setPendingDecision] = useState<"approved" | "changes_requested" | "rejected" | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setPhase("invalid"); return }
    let cancelled = false
    async function load() {
      try {
        const res = await validateDirectReviewToken(token)
        if (!cancelled) {
          if (res.data) {
            setData(res.data)
            setPhase("ready")
          } else {
            setPhase("invalid")
          }
        }
      } catch {
        if (!cancelled) setPhase("invalid")
      }
    }
    void load()
    return () => { cancelled = true }
  }, [token])

  function triggerDecision(decision: "approved" | "changes_requested" | "rejected") {
    setPendingDecision(decision)
    if (decision === "approved") {
      // Approve without notes prompt
      void submitDecision(decision, "")
    } else {
      setNotesOpen(true)
    }
  }

  async function submitDecision(decision: string, noteText: string) {
    setBusy(true)
    try {
      await decideDirectReview(token, decision, noteText)
      setDecidedVerb(decision)
      setPhase("decided")
      setNotesOpen(false)
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit decision")
    } finally {
      setBusy(false)
    }
  }

  function handleNotesSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notes.trim() && pendingDecision !== "approved") {
      toast.error("Please add notes for this decision.")
      return
    }
    void submitDecision(pendingDecision!, notes.trim())
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-500/40">
            <svg className="size-6 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">VIP Sign-Off Review</h1>
          <p className="mt-1 text-sm text-amber-300/70">Your approval is requested</p>
        </div>

        {/* Loading */}
        {phase === "loading" && (
          <Card className="border-amber-800/30 bg-slate-900/70 p-6 backdrop-blur-xl">
            <Skeleton className="mb-3 h-6 w-2/3 bg-slate-800" />
            <Skeleton className="mb-2 h-4 w-1/3 bg-slate-800" />
            <Skeleton className="h-28 w-full bg-slate-800" />
          </Card>
        )}

        {/* Invalid / expired */}
        {phase === "invalid" && (
          <Card className="border-red-800/40 bg-red-950/30 p-8 text-center backdrop-blur-xl">
            <p className="text-lg font-semibold text-red-400">This review link is invalid or has expired.</p>
            <p className="mt-2 text-sm text-slate-400">
              Contact your agency team to generate a new review link.
            </p>
          </Card>
        )}

        {/* Ready — show entity + action buttons */}
        {phase === "ready" && data && (
          <Card className="border-amber-800/30 bg-slate-900/70 backdrop-blur-xl">
            {/* Entity header */}
            <div className="border-b border-amber-800/20 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge className="mb-2 border-amber-700/50 bg-amber-950/40 text-amber-400">
                    {ENTITY_LABELS[data.entityType] ?? data.entityType}
                  </Badge>
                  <h2 className="text-xl font-semibold text-white">{data.entityTitle}</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    From <span className="text-slate-300">{data.agencyName}</span>
                    {data.clientName ? ` · ${data.clientName}` : ""}
                  </p>
                </div>
                {data.expiresAt && (
                  <div className="rounded-lg border border-amber-800/30 bg-amber-950/20 px-3 py-1.5 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-amber-400/70">Expires</div>
                    <div className="text-xs font-semibold text-amber-300">
                      {new Date(data.expiresAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Entity preview / description */}
            {data.description || data.notes ? (
              <div className="border-b border-amber-800/20 p-6">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {data.description ?? data.notes}
                </p>
              </div>
            ) : null}

            {/* Cue / rundown preview if event_rundown */}
            {data.entityType === "event_rundown" && Array.isArray(data.cues) && data.cues.length > 0 && (
              <div className="border-b border-amber-800/20 p-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-400/80">
                  Rundown Preview
                </h3>
                <div className="flex flex-col gap-1">
                  {data.cues.slice(0, 12).map((cue: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 odd:bg-slate-800/40"
                    >
                      <span className="w-14 shrink-0 font-mono text-xs text-amber-400">{cue.startTime ?? "--:--"}</span>
                      <span className="flex-1 text-sm text-slate-200">{cue.title ?? cue.label}</span>
                      {cue.duration && (
                        <span className="text-xs text-slate-500">{cue.duration}m</span>
                      )}
                    </div>
                  ))}
                  {data.cues.length > 12 && (
                    <p className="pt-1 text-center text-xs text-slate-500">
                      +{data.cues.length - 12} more cues
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="p-6">
              <p className="mb-4 text-sm text-slate-400">
                Your response is binding and will be logged with a timestamp.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-500"
                  disabled={busy}
                  onClick={() => triggerDecision("approved")}
                >
                  ✅ Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-amber-700/50 text-amber-400 hover:bg-amber-950/40"
                  disabled={busy}
                  onClick={() => triggerDecision("changes_requested")}
                >
                  ✏️ Request Changes
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-red-800/50 text-red-400 hover:bg-red-950/40"
                  disabled={busy}
                  onClick={() => triggerDecision("rejected")}
                >
                  ❌ Decline
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Decided */}
        {phase === "decided" && (
          <Card className="border-emerald-800/30 bg-slate-900/70 p-10 text-center backdrop-blur-xl">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40">
                <svg className="size-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>
            <p className={`text-xl font-bold ${DECISION_LABELS[decidedVerb]?.color ?? "text-white"}`}>
              {DECISION_LABELS[decidedVerb]?.label ?? "Decision recorded"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Your response has been recorded and sent to the agency team. You can close this tab.
            </p>
          </Card>
        )}

        {/* Notes modal (changes_requested / rejected) */}
        {notesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <Card className="w-full max-w-lg border-amber-800/40 bg-slate-900 p-6">
              <h2 className="mb-1 text-lg font-semibold text-white">
                {pendingDecision === "changes_requested" ? "Request Changes" : "Decline"}
              </h2>
              <p className="mb-4 text-sm text-slate-400">
                {pendingDecision === "changes_requested"
                  ? "Describe what needs to change before you can approve."
                  : "Briefly explain why you are declining."}
              </p>
              <form onSubmit={handleNotesSubmit} className="flex flex-col gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="review-notes" className="text-slate-300">Notes</Label>
                  <Textarea
                    id="review-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Your feedback…"
                    rows={4}
                    className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500"
                    autoFocus
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-slate-700"
                    onClick={() => { setNotesOpen(false); setPendingDecision(null) }}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-amber-600 text-white hover:bg-amber-500"
                    disabled={busy || !notes.trim()}
                  >
                    {busy ? "Submitting…" : "Submit Response"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
