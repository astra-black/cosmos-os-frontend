import { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArchiveIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FolderKanbanIcon,
  LayoutGridIcon,
  LoaderIcon,
  PencilIcon,
  PlusIcon,
  TableIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CreateProjectModal } from "@/components/modals"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog"
import { CommentsPanel } from "@/components/shared/comments-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectsDatatable } from "@/components/widgets/projects-datatable"
import { useClients, useMilestones, useProjects, useTasks } from "@/hooks/use-agency-data"
import { deleteProject, updateProject } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { canPerform } from "@/lib/rbac"
import type { Project } from "@/types/agency"
import { cn } from "@/lib/utils"

function money(n?: number | null) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

function avatarBg(name: string) {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return `hsl(${hue}deg 60% 45%)`
}

const FILTER_TABS = [
  { id: "All", label: "All" },
  { id: "InProgress", label: "In Progress" },
  { id: "Review", label: "In Review" },
  { id: "Approved", label: "Completed" },
  { id: "NotStarted", label: "Planning" },
  { id: "Archived", label: "On Hold" },
] as const

interface ProjectFormData {
  projectName: string
  clientId: string
  campaignId: string
  status: string
  startDate: string
  endDate: string
  weight: string
  budget: string
  description: string
}

const emptyForm: ProjectFormData = {
  projectName: "",
  clientId: "",
  campaignId: "",
  status: "NotStarted",
  startDate: "",
  endDate: "",
  weight: "",
  budget: "",
  description: "",
}

function getProjectHealth(project: Project) {
  if (project.status === "Approved" || project.status === "Complete") return "Completed"
  if (project.status === "Review") return "In Review"
  if (project.status === "InProgress") return "On Track"
  if (project.status === "Archived") return "On Hold"
  return "Planning"
}

function getHealthVariant(health: string): "success" | "warning" | "danger" | "purple" | "default" {
  const h = health.toLowerCase()
  if (h.includes("track") || h.includes("complete") || h.includes("won")) return "success"
  if (h.includes("risk") || h.includes("review") || h.includes("hold")) return "warning"
  if (h.includes("delayed") || h.includes("off") || h.includes("overdue") || h.includes("lost")) return "danger"
  return "purple"
}

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
  const { data: tasks } = useTasks()
  const { data: milestones } = useMilestones()

  const [activeTab, setActiveTab] = useState<string>("All")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
  const [isSaving, setIsSaving] = useState(false)
  const [pendingProject, setPendingProject] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState<ProjectFormData>(emptyForm)

  function openCreateDialog() {
    setCreateOpen(true)
  }

  function openEditDialog(project: Project, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
    setEditingProject(project)
    setForm({
      projectName: project.projectName,
      clientId: project.clientId || "",
      campaignId: project.campaignId || "",
      status: project.status || "NotStarted",
      startDate: project.startDate ? project.startDate.slice(0, 10) : "",
      endDate: project.endDate ? project.endDate.slice(0, 10) : "",
      weight: project.weight != null ? String(project.weight) : "",
      budget: project.budget != null ? String(project.budget) : "",
      description: project.description || "",
    })
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!form.projectName.trim() || !canWrite || !editingProject) return
    const weight = form.weight ? Number(form.weight) : 0
    const budget = form.budget ? Number(form.budget) : 0
    const startDate = form.startDate ? new Date(`${form.startDate}T00:00:00`) : null
    const endDate = form.endDate ? new Date(`${form.endDate}T00:00:00`) : null

    if (
      (startDate !== null && Number.isNaN(startDate.getTime())) ||
      (endDate !== null && Number.isNaN(endDate.getTime())) ||
      (form.startDate && form.endDate && form.startDate > form.endDate) ||
      (form.weight && (!Number.isFinite(weight) || weight < 0)) ||
      (form.budget && (!Number.isFinite(budget) || budget < 0))
    ) {
      toast.error("Please enter valid positive numbers and ensure end date is after start date.")
      return
    }

    setIsSaving(true)
    try {
      const client = clients.find((c) => c.clientId === form.clientId)
      await updateProject(editingProject.projectId, {
        projectName: form.projectName.trim(),
        clientId: form.clientId || null,
        clientName: client?.name || null,
        campaignId: form.campaignId.trim() || null,
        status: form.status,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        weight,
        budget,
        description: form.description.trim() || "",
      })
      toast.success("Project updated")
      setIsDialogOpen(false)
      setEditingProject(null)
      await reload()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !canWrite) return
    setPendingProject(`delete:${deleteTarget.id}`)
    try {
      await deleteProject(deleteTarget.id)
      await reload()
      if (selectedProject?.projectId === deleteTarget.id) {
        setSelectedProject(null)
      }
      setDeleteTarget(null)
      toast.success("Project deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setPendingProject(null)
    }
  }

  const filteredProjects = useMemo(() => {
    if (activeTab === "All") return projects
    return projects.filter((p) => p.status === activeTab)
  }, [projects, activeTab])

  // Selected project tasks & progress
  const selTasks = useMemo(() => {
    if (!selectedProject) return []
    return tasks.filter((t) => t.projectId === selectedProject.projectId)
  }, [selectedProject, tasks])

  const selMilestones = useMemo(() => {
    if (!selectedProject) return []
    return milestones.filter((m) => m.projectId === selectedProject.projectId)
  }, [selectedProject, milestones])

  const selCompletedTasks = useMemo(() => {
    return selTasks.filter((t) => t.status === "done").length
  }, [selTasks])

  const selProgress = useMemo(() => {
    if (!selectedProject) return 0
    if (selTasks.length > 0) {
      return Math.round((selCompletedTasks / selTasks.length) * 100)
    }
    if (selectedProject.status === "Approved" || selectedProject.status === "Complete") return 100
    if (selectedProject.status === "Review") return 80
    if (selectedProject.status === "InProgress") return 55
    return 10
  }, [selectedProject, selTasks, selCompletedTasks])

  return (
    <div className="flex flex-col gap-6">
      {/* Header matching Neon Studio */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sora text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Progress, owners and health across every engagement
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle View Mode */}
          <div className="flex items-center rounded-lg border border-border p-1 bg-surface-alt/40">
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "cards" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Card view"
            >
              <LayoutGridIcon className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "table" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              title="Table view"
            >
              <TableIcon className="size-4" />
            </button>
          </div>

          {canWrite && (
            <Button size="sm" onClick={openCreateDialog} className="font-semibold shadow-sm">
              <PlusIcon className="size-4 mr-1" />
              New project
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/5 text-destructive px-4 py-3 text-sm">
          {error}
        </Card>
      ) : null}

      {/* ── Status Filter Pills ──────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.id === "All"
              ? projects.length
              : projects.filter((p) => p.status === tab.id).length
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all select-none whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-surface-alt"
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : viewMode === "table" ? (
        <ProjectsDatatable
          data={filteredProjects}
          onRowClick={(p) => navigate(`/projects/${p.projectId}`)}
        />
      ) : (
        /* ── Grid + Detail Drawer Layout ───────────────────── */
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main Card Grid */}
          <div
            className={cn(
              "grid gap-4 w-full flex-1 transition-all duration-300",
              selectedProject ? "sm:grid-cols-1 md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
            )}
          >
            {filteredProjects.map((project) => {
              const pTasks = tasks.filter((t) => t.projectId === project.projectId)
              const completedCount = pTasks.filter((t) => t.status === "done").length
              const progress =
                pTasks.length > 0
                  ? Math.round((completedCount / pTasks.length) * 100)
                  : project.status === "Approved" || project.status === "Complete"
                    ? 100
                    : project.status === "Review"
                      ? 80
                      : project.status === "InProgress"
                        ? 55
                        : 10
              const health = getProjectHealth(project)
              const healthVar = getHealthVariant(health)
              const isSelected = selectedProject?.projectId === project.projectId

              return (
                <div
                  key={project.projectId}
                  onClick={() => setSelectedProject(project)}
                  className={cn(
                    "group relative cursor-pointer rounded-xl border bg-card overflow-hidden transition-all duration-200 select-none shadow-[0_1px_3px_0_rgba(39,0,69,0.06)] hover:shadow-md hover:border-primary/50",
                    isSelected ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border"
                  )}
                >
                  {/* Card Cover */}
                  <div
                    className="relative h-28 w-full p-3 flex items-start justify-between overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #270045 0%, #150026 100%)" }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={healthVar} className="shadow-xs font-semibold">
                        {health}
                      </Badge>
                      <Badge variant="purple" className="shadow-xs">
                        On Track
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canWrite && (
                        <button
                          onClick={(e) => openEditDialog(project, e)}
                          className="p-1 rounded-md bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-colors"
                          title="Edit project"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/projects/${project.projectId}`)
                        }}
                        className="p-1 rounded-md bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-colors"
                        title="Open full page"
                      >
                        <ExternalLinkIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-sora font-semibold text-base text-foreground truncate group-hover:text-primary transition-colors">
                        {project.projectName}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.clientName || "General Client"}
                      </p>
                    </div>

                    {/* Gradient Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">
                          {pTasks.length > 0 ? `${completedCount}/${pTasks.length} tasks` : "Progress"}
                        </span>
                        <span className="font-bold text-foreground">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-alt overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            background:
                              "linear-gradient(115deg, oklch(48% 0.23 295), oklch(58% 0.24 350), oklch(68% 0.18 50))",
                          }}
                        />
                      </div>
                    </div>

                    {/* Footer: Avatar stack + dates */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      <div className="flex -space-x-1.5">
                        {["Jules M", "Alex R", "Sam O"].map((name, i) => (
                          <div
                            key={i}
                            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card text-[9px] font-bold text-white shadow-xs"
                            style={{ background: avatarBg(name + project.projectName) }}
                            title={name}
                          >
                            {name.split(" ").map((n) => n[0]).join("")}
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] font-medium">
                        {project.startDate && project.endDate
                          ? `${new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(project.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : project.endDate
                            ? `Due ${project.endDate}`
                            : "Ongoing"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredProjects.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm text-muted-foreground bg-card rounded-xl border border-border p-8">
                <FolderKanbanIcon className="mx-auto size-8 text-muted-foreground/50 mb-2" />
                <p className="font-medium text-foreground">No projects found in this filter.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try switching to 'All' or create a new project.
                </p>
              </div>
            )}
          </div>

          {/* ── Slide-over Project Detail Drawer ────────────── */}
          {selectedProject && (
            <div className="w-full lg:w-[420px] shrink-0 rounded-2xl border border-border bg-card overflow-hidden shadow-xl flex flex-col sticky top-20 animate-in fade-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <h3 className="font-sora font-bold text-base text-foreground truncate">
                    {selectedProject.projectName}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedProject.clientName || "No Client Assigned"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2.5"
                    onClick={() => navigate(`/projects/${selectedProject.projectId}`)}
                  >
                    Workspace ↗
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => setSelectedProject(null)}
                    aria-label="Close drawer"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-160px)]">
                {/* Cover Banner */}
                <div
                  className="h-28 w-full rounded-xl p-3.5 flex items-start justify-between relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #270045 0%, #17002b 100%)" }}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={getHealthVariant(getProjectHealth(selectedProject))}>
                      {getProjectHealth(selectedProject)}
                    </Badge>
                    <Badge variant="purple">On Track</Badge>
                  </div>
                </div>

                {/* Description */}
                {selectedProject.description ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedProject.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No description provided.</p>
                )}

                {/* Overall Progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Overall progress</span>
                    <span className="font-bold text-foreground">{selProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-alt overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${selProgress}%`,
                        background:
                          "linear-gradient(115deg, oklch(48% 0.23 295), oklch(58% 0.24 350), oklch(68% 0.18 50))",
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {selCompletedTasks} of {selTasks.length} tasks complete
                    {selectedProject.endDate ? ` · Due ${selectedProject.endDate}` : ""}
                  </p>
                </div>

                {/* Team */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Team
                  </p>
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-alt/40 border border-border/50">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                      style={{ background: avatarBg(selectedProject.projectName + "Lead") }}
                    >
                      {user?.name ? user.name.slice(0, 2).toUpperCase() : "PM"}
                    </div>
                    <span className="text-xs font-medium text-foreground truncate">
                      {user?.name || "Project Lead"}
                    </span>
                    <Badge variant="purple" className="text-[10px] ml-auto shrink-0">
                      Lead
                    </Badge>
                  </div>
                </div>

                {/* 3 Metric Tiles */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border p-2.5 bg-surface-alt/40 text-center">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Budget</p>
                    <p className="font-sora text-sm font-bold text-foreground mt-0.5 truncate">
                      {money(selectedProject.budget)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-2.5 bg-surface-alt/40 text-center">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Actual Cost</p>
                    <p className="font-sora text-sm font-bold text-foreground mt-0.5 truncate">
                      {money(selectedProject.budget ? Math.round(selectedProject.budget * (selProgress / 100)) : 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-2.5 bg-surface-alt/40 text-center">
                    <p className="text-[9px] uppercase font-bold text-muted-foreground">Invoiced</p>
                    <p className="font-sora text-sm font-bold text-foreground mt-0.5 truncate">
                      {money(selectedProject.budget)}
                    </p>
                  </div>
                </div>

                {/* Tasks Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tasks ({selTasks.length})
                    </p>
                    <Link
                      to="/tasks"
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      All tasks →
                    </Link>
                  </div>
                  <div className="space-y-1.5">
                    {selTasks.slice(0, 4).map((t) => (
                      <div
                        key={t.taskId}
                        className="flex items-center justify-between p-2 rounded-lg border border-border/70 text-xs bg-surface-alt/20 gap-2"
                      >
                        <span className="truncate text-foreground font-medium">{t.title}</span>
                        <Badge
                          variant={t.status === "done" ? "success" : "purple"}
                          className="text-[10px] shrink-0"
                        >
                          {t.status === "done" ? "Done" : "In Progress"}
                        </Badge>
                      </div>
                    ))}
                    {selTasks.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-2 text-center">
                        No tasks assigned to this project.
                      </p>
                    )}
                  </div>
                </div>

                {/* Comments & Feedback */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <CommentsPanel
                    entityType="project"
                    entityId={selectedProject.projectId}
                    title="Comments & change requests"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Dialogs & Modals ─────────────────────────────────── */}
      <CreateProjectModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clients}
        onSuccess={() => {
          void reload()
          toast.success("Project created")
        }}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Update delivery details, budget and dates.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={form.projectName}
                onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="clientSelect">Client</Label>
                <Select
                  value={form.clientId}
                  onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {clients.map((c) => (
                    <option key={c.clientId} value={c.clientId}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="statusSelect">Status</Label>
                <Select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="NotStarted">Planning</option>
                  <option value="InProgress">In Progress</option>
                  <option value="Review">In Review</option>
                  <option value="Approved">Completed</option>
                  <option value="Archived">On Hold</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="budgetInput">Budget ($)</Label>
                <Input
                  id="budgetInput"
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weightInput">Weight</Label>
                <Input
                  id="weightInput"
                  type="number"
                  value={form.weight}
                  onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="descriptionInput">Description</Label>
              <Textarea
                id="descriptionInput"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete project"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
