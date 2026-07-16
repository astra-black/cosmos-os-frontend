import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { LoaderIcon, MegaphoneIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { createCampaign, listCampaigns, listClients } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { AgencyClient, Campaign } from "@/types/agency"

export function CampaignsPage() {
  const { user } = useAuth()
  const canWrite = canPerform(user?.role, "write_crm")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [clients, setClients] = useState<AgencyClient[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "", clientId: "", budget: "" })

  const reload = useCallback(async () => {
    const res = await listCampaigns()
    setCampaigns(res.data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [, clientsRes] = await Promise.all([
          reload(),
          listClients().catch(() => ({ data: [] as AgencyClient[] })),
        ])
        if (!cancelled) setClients(clientsRes.data ?? [])
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
  }, [reload])

  const filtered = useMemo(() => {
    if (statusFilter === "all") return campaigns
    return campaigns.filter((c) => c.status === statusFilter)
  }, [campaigns, statusFilter])

  const totalBudget = filtered.reduce((s, c) => s + (c.budget ?? 0), 0)

  async function handleCreate() {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const client = clients.find((c) => c.clientId === form.clientId)
      await createCampaign({
        name: form.name.trim(),
        clientId: form.clientId || undefined,
        clientName: client?.name,
        budget: form.budget ? Number(form.budget) : 0,
        status: "planning",
      })
      await reload()
      setForm({ name: "", clientId: "", budget: "" })
      setShowCreate(false)
      toast.success("Campaign created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Campaigns"
        description="Client programs that group projects — budget, dates, and ownership."
        actions={
          canWrite ? (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <PlusIcon className="size-3.5" />
              New campaign
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {showCreate ? (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1">
            <label className="text-muted-foreground mb-1 block text-xs">Name</label>
            <Input
              placeholder="Campaign name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="min-w-[10rem]">
            <label className="text-muted-foreground mb-1 block text-xs">Client</label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {clients.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="text-muted-foreground mb-1 block text-xs">Budget</label>
            <Input
              type="number"
              placeholder="0"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
            />
          </div>
          <Button size="sm" disabled={creating || !form.name.trim()} onClick={handleCreate}>
            {creating ? <LoaderIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
            Create
          </Button>
        </Card>
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
          description="Create a program for a client to group delivery work."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((campaign) => {
            const projectIds = campaign.projectIds ?? []
            const projectCount = projectIds.length
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
                    <p className="text-muted-foreground mt-1 text-sm">
                      {campaign.clientId ? (
                        <Link
                          to={`/clients/${campaign.clientId}`}
                          className="hover:text-primary underline-offset-2 hover:underline"
                        >
                          {campaign.clientName || campaign.clientId}
                        </Link>
                      ) : (
                        campaign.clientName || "—"
                      )}
                    </p>
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
                {projectCount > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {projectIds.slice(0, 6).map((pid) => (
                      <Button
                        key={pid}
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full font-mono text-[11px]"
                        render={<Link to={`/projects/${pid}`} />}
                      >
                        {pid}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div>
                  <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                    <span>Linked projects</span>
                    <span className="tabular-nums">{projectCount}</span>
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
