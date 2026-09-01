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
  portalApprovals,
  portalAssets,
  portalDecide,
} from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { clearPortalUser, getPortalUser } from "@/pages"

export function PortalHomePage() {
  const navigate = useNavigate()
  const user = getPortalUser()
  const [approvals, setApprovals] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [decisionTarget, setDecisionTarget] = useState<any | null>(null)
  const [decisionNotes, setDecisionNotes] = useState("")
  const [decisionBusy, setDecisionBusy] = useState(false)

  useEffect(() => {
    if (!user?.clientId) return
    let cancelled = false
    async function load() {
      try {
        const [a, s] = await Promise.all([
          portalApprovals(user.clientId),
          portalAssets(user.clientId),
        ])
        if (!cancelled) {
          setApprovals((a.data as any[]) ?? [])
          setAssets((s.data as any[]) ?? [])
        }
      } catch {
        if (!cancelled) toast.error("Failed to load portal data")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user?.clientId])

  if (!user) return <Navigate to="/portal/login" replace />

  async function decide(id: string, decision: string, notes?: string) {
    if (user.role !== "client") {
      clearPortalUser()
      navigate("/portal/login", { replace: true })
      return false
    }
    setDecisionBusy(true)
    try {
      await portalDecide(id, decision, notes)
      const a = await portalApprovals(user.clientId)
      setApprovals((a.data as any[]) ?? [])
      toast.success(`Marked ${decision}`)
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
    if (!notes) {
      toast.error("Add notes explaining the requested changes")
      return
    }
    if (await decide(decisionTarget.approvalId, "changes_requested", notes)) {
      setDecisionTarget(null)
      setDecisionNotes("")
    }
  }

  function logout() {
    clearPortalUser()
    navigate("/portal/login", { replace: true })
  }

  return (
    <div className="bg-muted/30 min-h-dvh">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Cosmos Client Portal</div>
            <div className="text-muted-foreground text-xs">
              {user.clientName} · {user.name}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <section>
          <h1 className="text-xl font-semibold">Approvals</h1>
          <p className="text-muted-foreground text-sm">Review deliverables from your agency team.</p>
          {loading ? (
            <Skeleton className="mt-4 h-32 w-full" />
          ) : approvals.length === 0 ? (
            <Card className="text-muted-foreground mt-4 p-6 text-sm">No open items.</Card>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {approvals.map((a) => (
                <Card key={a.approvalId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-muted-foreground text-xs capitalize">
                      {a.status?.replace("_", " ")} · {a.entityType}
                    </div>
                  </div>
                  {(a.status === "pending" || a.status === "changes_requested") && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled={decisionBusy} onClick={() => void decide(a.approvalId, "approved")}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decisionBusy}
                        onClick={() => {
                          setDecisionTarget(a)
                          setDecisionNotes("")
                        }}
                      >
                        Request changes
                      </Button>
                    </div>
                  )}
                  {a.status === "approved" ? <Badge>Approved</Badge> : null}
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Shared assets</h2>
          {loading ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {assets.map((asset) => (
                <Card key={asset.assetId} className="p-4 text-sm">
                  <div className="font-medium">{asset.assetName}</div>
                  <div className="text-muted-foreground text-xs">
                    {asset.fileType} · v{asset.version} · {asset.status}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <EntityFormDialog
        open={Boolean(decisionTarget)}
        onOpenChange={(open) => {
          if (!open && !decisionBusy) {
            setDecisionTarget(null)
            setDecisionNotes("")
          }
        }}
        title="Request changes"
        description={decisionTarget ? `Add notes for ${decisionTarget.title}.` : undefined}
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
            onChange={(event) => setDecisionNotes(event.target.value)}
            placeholder="Explain what needs to be changed before approval."
            required
            autoFocus
          />
        </div>
      </EntityFormDialog>
    </div>
  )
}
