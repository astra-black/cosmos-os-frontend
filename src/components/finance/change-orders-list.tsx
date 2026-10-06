import { useState } from "react"
import { CheckCircle2Icon, CopyIcon, DollarSignIcon, FileTextIcon, ExternalLinkIcon, ClockIcon, AlertTriangleIcon, XCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { ChangeOrder } from "@/lib/api/agency"

type ChangeOrdersListProps = {
  changeOrders: ChangeOrder[]
  loading?: boolean
  onRefresh?: () => void
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; icon: any }> = {
  APPROVED: { label: "Approved & Signed", badge: "border-emerald-700/50 bg-emerald-950/30 text-emerald-400", icon: CheckCircle2Icon },
  PENDING: { label: "Pending Sign-Off", badge: "border-amber-700/50 bg-amber-950/30 text-amber-400", icon: ClockIcon },
  CHANGES_REQUESTED: { label: "Changes Requested", badge: "border-orange-700/50 bg-orange-950/30 text-orange-400", icon: AlertTriangleIcon },
  REJECTED: { label: "Declined", badge: "border-red-700/50 bg-red-950/30 text-red-400", icon: XCircleIcon },
}

export function ChangeOrdersList({ changeOrders, loading }: ChangeOrdersListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCopyShareLink(co: ChangeOrder) {
    if (!co.shareUrl) {
      toast.error("Share URL not available")
      return
    }
    void navigator.clipboard.writeText(co.shareUrl)
    setCopiedId(co.id)
    toast.success("1-Click VIP sign-off review link copied to clipboard!")
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return <Card className="p-6 text-center text-sm text-slate-400">Loading Change Orders…</Card>
  }

  if (changeOrders.length === 0) {
    return (
      <Card className="border-dashed p-8 text-center text-sm text-slate-400">
        <FileTextIcon className="mx-auto size-8 opacity-40 mb-2" />
        No formal Change Orders issued yet for this project.
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {changeOrders.map((co) => {
        const config = STATUS_CONFIG[co.status] || STATUS_CONFIG.PENDING
        const Icon = config.icon

        return (
          <Card key={co.id} className="border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`gap-1 text-xs ${config.badge}`}>
                    <Icon className="size-3" />
                    {config.label}
                  </Badge>
                  <span className="font-mono text-xs text-slate-500">{co.changeOrderId}</span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-white">{co.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{co.description}</p>
              </div>

              {/* Cost Delta & Budget Impact */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-right">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Scope Delta</div>
                <div className={`mt-0.5 font-mono text-lg font-bold ${co.costDelta >= 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {co.costDelta >= 0 ? `+ $${co.costDelta.toLocaleString()}` : `- $${Math.abs(co.costDelta).toLocaleString()}`}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  New Total: <span className="font-semibold text-white">${co.newTotalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Scope breakdown if distinct */}
            {co.scopeDelta && co.scopeDelta !== co.description && (
              <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-300">
                <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                  Scope Items
                </div>
                <div className="whitespace-pre-wrap font-mono">{co.scopeDelta}</div>
              </div>
            )}

            {/* E-Signature Audit Record if Approved */}
            {co.status === "APPROVED" && (
              <div className="mt-4 rounded-xl border border-emerald-800/30 bg-emerald-950/20 p-3 text-xs text-emerald-300">
                <div className="font-semibold uppercase tracking-wider text-[10px] text-emerald-400 mb-1 flex items-center gap-1">
                  <CheckCircle2Icon className="size-3.5" />
                  Binding E-Signature Audit Log
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    Signed by <span className="font-semibold">{co.decidedBy || "Client"}</span>
                    {co.decidedAt ? ` on ${new Date(co.decidedAt).toLocaleString()}` : ""}
                    {co.clientIp ? ` (IP: ${co.clientIp})` : ""}
                  </div>
                  {co.signatureSvg && (
                    <div className="rounded bg-white/10 px-2 py-1">
                      <span className="text-[10px] font-mono text-slate-300">Digital Signature Verified</span>
                    </div>
                  )}
                </div>
                {co.decisionNotes && (
                  <p className="mt-1 text-slate-400 italic">"{co.decisionNotes}"</p>
                )}
              </div>
            )}

            {/* Action Bar (1-click VIP Review Link) */}
            {co.status === "PENDING" && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3 text-xs">
                <div className="text-slate-400">
                  Awaiting sign-off via client portal or direct link.
                </div>
                <div className="flex gap-2">
                  {co.shareUrl && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-700/40 text-amber-400 hover:bg-amber-950/40 gap-1.5"
                        onClick={() => handleCopyShareLink(co)}
                      >
                        <CopyIcon className="size-3" />
                        {copiedId === co.id ? "Copied Link!" : "Copy VIP Sign-Off Link"}
                      </Button>
                      <a
                        href={co.shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Open Link <ExternalLinkIcon className="size-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
