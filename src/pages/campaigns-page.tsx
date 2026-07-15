import { useEffect, useMemo, useState } from "react"
import { MegaphoneIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { listCampaigns } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Campaign } from "@/types/agency"

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await listCampaigns()
        if (!cancelled) setCampaigns(res.data ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load campaigns")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (statusFilter === "all") return campaigns
    return campaigns.filter((c) => c.status === statusFilter)
  }, [campaigns, statusFilter])

  const totalBudget = filtered.reduce((s, c) => s + (c.budget ?? 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Campaigns"
        description="Client programs that group projects — budget, dates, and ownership."
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      <div className="bg-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
        <span>
          <span className="text-muted-foreground">Programs </span>
          <span className="font-semibold tabular-nums">{filtered.length}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Budget </span>
          <span className="font-semibold tabular-nums">
            ${Math.round(totalBudget / 1000)}k
          </span>
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {["all", "active", "planning", "completed"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              className="rounded-full capitalize"
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MegaphoneIcon className="size-8 opacity-40" />}
          title="No campaigns"
          description="Campaigns appear once delivery programs are planned."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((campaign) => {
            const projectCount = campaign.projectIds?.length ?? 0
            return (
              <Card key={campaign.campaignId} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-muted-foreground font-mono text-xs">
                      {campaign.campaignId}
                    </div>
                    <h2 className="mt-0.5 text-base font-semibold leading-snug">
                      {campaign.name}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">{campaign.clientName}</p>
                  </div>
                  <Badge className="capitalize shrink-0">{campaign.status}</Badge>
                </div>
                {campaign.objective ? (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {campaign.objective}
                  </p>
                ) : null}
                <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                  <span>
                    {campaign.startDate
                      ? new Date(campaign.startDate).toLocaleDateString()
                      : "—"}{" "}
                    →{" "}
                    {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "—"}
                  </span>
                  <span className="text-right tabular-nums">
                    {campaign.budget != null ? `$${campaign.budget.toLocaleString()}` : "—"}
                  </span>
                  <span>Owner: {campaign.owner || "—"}</span>
                  <span className="text-right">{projectCount} projects</span>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                    <span>Delivery weight</span>
                    <span className="tabular-nums">{Math.min(projectCount * 25, 100)}%</span>
                  </div>
                  <Progress value={Math.min(projectCount * 25, 100)} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
