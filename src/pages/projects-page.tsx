import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArchiveIcon,
  CheckCircle2Icon,
  FolderKanbanIcon,
  LoaderIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PortfolioSummaryCard } from "@/components/widgets/portfolio-summary-card"
import { ProjectsDatatable } from "@/components/widgets/projects-datatable"
import { StatisticsCard } from "@/components/widgets/statistics-card"
import { useClients, useProjects } from "@/hooks/use-agency-data"
import { createProject } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Project } from "@/types/agency"

const ACTIVE_STATUSES = new Set(["InProgress", "Review", "NotStarted"])

export function ProjectsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canWrite =
    canPerform(user?.role, "write_crm") || canPerform(user?.role, "write_ops")

  const {
    data: projects,
    loading,
    error,
    reload,
  } = useProjects()
  const { data: clients } = useClients()
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    projectName: "",
    clientId: "",
    budget: "",
  })

  const inProgress = projects.filter((p) => p.status === "InProgress").length
  const inReview = projects.filter((p) => p.status === "Review").length
  const approved = projects.filter((p) => p.status === "Approved").length
  const archived = projects.filter((p) => p.status === "Archived").length
  const active = projects.filter((p) => ACTIVE_STATUSES.has(p.status)).length
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0)
  const activeShare =
    projects.length === 0 ? 0 : Math.round((active / projects.length) * 100)

  const campaignLines = useMemo(() => {
    const byCampaign = new Map<string, { count: number; budget: number }>()
    for (const project of projects) {
      const key = project.campaignId || "Unassigned"
      const prev = byCampaign.get(key) ?? { count: 0, budget: 0 }
      byCampaign.set(key, {
        count: prev.count + 1,
        budget: prev.budget + (project.budget ?? 0),
      })
    }
    return [...byCampaign.entries()]
      .sort((a, b) => b[1].budget - a[1].budget)
      .slice(0, 4)
      .map(([campaign, stats]) => ({
        key: campaign,
        label: campaign,
        detail: `${stats.count} project${stats.count === 1 ? "" : "s"}`,
        value: stats.budget > 0 ? `$${Math.round(stats.budget / 1000)}k` : "—",
        progressPercentage: Math.min(
          100,
          totalBudget > 0 ? Math.round((stats.budget / totalBudget) * 100) : stats.count * 20,
        ),
      }))
  }, [projects, totalBudget])

  const statusLines = useMemo(() => {
    const order = ["InProgress", "Review", "NotStarted", "Approved", "Archived"]
    const counts = new Map<string, number>()
    for (const project of projects) {
      counts.set(project.status, (counts.get(project.status) ?? 0) + 1)
    }
    const total = projects.length || 1
    return order
      .filter((status) => counts.has(status))
      .map((status) => {
        const count = counts.get(status) ?? 0
        return {
          key: status,
          label: status,
          detail: "delivery status",
          value: String(count),
          progressPercentage: Math.round((count / total) * 100),
        }
      })
  }, [projects])

  async function handleCreate() {
    if (!form.projectName.trim()) return
    setCreating(true)
    try {
      const client = clients.find((c) => c.clientId === form.clientId)
      const res = await createProject({
        projectName: form.projectName.trim(),
        clientId: form.clientId || null,
        clientName: client?.name || null,
        budget: form.budget ? Number(form.budget) : 0,
        status: "NotStarted",
      })
      await reload()
      setForm({ projectName: "", clientId: "", budget: "" })
      setShowCreate(false)
      toast.success("Project created")
      if (res.data?.projectId) navigate(`/projects/${res.data.projectId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Projects"
        description="Delivery register — open a row for the full workspace."
        actions={
          canWrite ? (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <PlusIcon className="size-3.5" />
              New project
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
              placeholder="Project name"
              value={form.projectName}
              onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
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
          <Button size="sm" disabled={creating || !form.projectName.trim()} onClick={handleCreate}>
            {creating ? <LoaderIcon className="size-3.5 animate-spin" /> : <PlusIcon className="size-3.5" />}
            Create
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatisticsCard
              title="Active"
              value={String(active)}
              changePercentage={`${activeShare}% of book`}
              icon={<FolderKanbanIcon className="size-4" />}
            />
            <StatisticsCard
              title="In progress"
              value={String(inProgress)}
              changePercentage={`${inReview} in review`}
              icon={<LoaderIcon className="size-4" />}
            />
            <StatisticsCard
              title="Approved"
              value={String(approved)}
              changePercentage="delivery complete"
              icon={<CheckCircle2Icon className="size-4" />}
            />
            <StatisticsCard
              title="Archived"
              value={String(archived)}
              changePercentage={`$${Math.round(totalBudget / 1000)}k total budget`}
              icon={<ArchiveIcon className="size-4" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ProjectsDatatable
                data={projects}
                onRowClick={(p) => navigate(`/projects/${p.projectId}`)}
              />
            </div>
            <div className="flex flex-col gap-4">
              <PortfolioSummaryCard
                title="By campaign"
                headlineValue={String(campaignLines.length)}
                trend="up"
                percentage={activeShare}
                comparisonText="share of book"
                items={campaignLines}
              />
              <PortfolioSummaryCard
                title="By status"
                headlineValue={String(projects.length)}
                trend="up"
                percentage={100}
                comparisonText="all projects"
                items={statusLines}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
