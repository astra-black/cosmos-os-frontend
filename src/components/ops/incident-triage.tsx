import { useMemo, useState } from "react"
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  InfoIcon,
  Loader2Icon,
  MapPinIcon,
  RotateCcwIcon,
  UserIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Incident } from "@/types/agency"

type SeverityFilter = "all" | "critical" | "warning" | "info"
type StatusFilter = "active" | "all" | "resolved"

const severityOrder = { critical: 0, warning: 1, info: 2 }

function severityIcon(severity: string) {
  if (severity === "critical") return AlertOctagonIcon
  if (severity === "warning") return AlertTriangleIcon
  return InfoIcon
}

function severityStyles(severity: string) {
  if (severity === "critical") return "border-l-destructive bg-destructive/5 border-l-4"
  if (severity === "warning") return "border-l-chart-4 bg-chart-4/5 border-l-4"
  return "border-l-muted-foreground/40 border-l-4"
}

export function IncidentTriage({
  incidents,
  className,
  busyIncidentId,
  canWrite = true,
  onResolve,
  onEscalate,
  onReopen,
  onEdit,
  onDelete,
}: {
  incidents: Incident[]
  className?: string
  busyIncidentId?: string | null
  canWrite?: boolean
  onResolve?: (incident: Incident, resolution: string) => void
  onEscalate?: (incident: Incident) => void
  onReopen?: (incident: Incident) => void
  onEdit?: (incident: Incident) => void
  onDelete?: (incident: Incident) => void
}) {
  const [severity, setSeverity] = useState<SeverityFilter>("all")
  const [status, setStatus] = useState<StatusFilter>("active")

  const counts = useMemo(() => {
    const critical = incidents.filter((i) => i.severity === "critical").length
    const warning = incidents.filter((i) => i.severity === "warning").length
    const info = incidents.filter((i) => i.severity === "info").length
    const active = incidents.filter((i) => i.status !== "resolved").length
    return { critical, warning, info, active, total: incidents.length }
  }, [incidents])

  const queue = useMemo(() => {
    let list = [...incidents]
    if (status === "active") list = list.filter((i) => i.status !== "resolved")
    if (status === "resolved") list = list.filter((i) => i.status === "resolved")
    if (severity !== "all") list = list.filter((i) => i.severity === severity)
    list.sort((a, b) => {
      const sa = severityOrder[a.severity as keyof typeof severityOrder] ?? 9
      const sb = severityOrder[b.severity as keyof typeof severityOrder] ?? 9
      if (sa !== sb) return sa - sb
      return (
        new Date(b.reportedAt || b.createdAt || 0).getTime() -
        new Date(a.reportedAt || a.createdAt || 0).getTime()
      )
    })
    return list
  }, [incidents, severity, status])

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            {
              id: "critical" as const,
              label: "Critical",
              count: counts.critical,
              tone: "text-destructive",
            },
            {
              id: "warning" as const,
              label: "Warning",
              count: counts.warning,
              tone: "text-foreground",
            },
            {
              id: "info" as const,
              label: "Info",
              count: counts.info,
              tone: "text-muted-foreground",
            },
            {
              id: "all" as const,
              label: "Active queue",
              count: counts.active,
              tone: "text-primary",
            },
          ] as const
        ).map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => {
              if (tile.id === "all") {
                setSeverity("all")
                setStatus("active")
              } else {
                setSeverity(tile.id)
                setStatus("active")
              }
            }}
            className={cn(
              "bg-card hover:bg-muted/40 rounded-xl border px-3 py-3 text-left transition-colors sm:px-4",
              severity === tile.id ||
                (tile.id === "all" && severity === "all" && status === "active")
                ? "ring-ring ring-2"
                : "",
            )}
          >
            <div className="text-muted-foreground text-xs font-medium">{tile.label}</div>
            <div className={cn("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", tile.tone)}>
              {tile.count}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: "active" as const, label: "Active" },
            { id: "all" as const, label: "All" },
            { id: "resolved" as const, label: "Resolved" },
          ] as const
        ).map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={status === f.id ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setStatus(f.id)}
          >
            {f.label}
          </Button>
        ))}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {queue.length} shown
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {queue.length === 0 ? (
          <li className="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
            Queue clear for this filter.
          </li>
        ) : (
          queue.map((incident) => {
            const Icon = severityIcon(incident.severity)
            const isResolved = incident.status === "resolved"
            const busy = busyIncidentId === incident.incidentId
            return (
              <li
                key={incident.incidentId || incident.id}
                className={cn(
                  "bg-card rounded-xl border p-4",
                  severityStyles(incident.severity),
                  isResolved && "opacity-60",
                )}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      incident.severity === "critical" && "bg-destructive/15 text-destructive",
                      incident.severity === "warning" && "bg-chart-4/20 text-foreground",
                      incident.severity === "info" && "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground font-mono text-xs">
                        {incident.incidentId}
                      </span>
                      <Badge variant="outline" className="h-5 capitalize">
                        {incident.severity}
                      </Badge>
                      <Badge
                        className={cn(
                          "h-5 capitalize",
                          isResolved
                            ? "bg-chart-2/15 text-foreground"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {incident.status.replace("_", " ")}
                      </Badge>
                      {incident.category ? (
                        <span className="text-muted-foreground text-xs capitalize">
                          {incident.category}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-base font-semibold leading-snug">
                      {incident.title || incident.incidentId}
                    </h3>
                    {incident.description ? (
                      <p className="text-muted-foreground mt-1 text-sm">{incident.description}</p>
                    ) : null}
                    <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {incident.departmentName ? <span>{incident.departmentName}</span> : null}
                      {incident.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPinIcon className="size-3" />
                          {incident.location}
                        </span>
                      ) : null}
                      {incident.assignedTo || incident.reportedBy ? (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="size-3" />
                          {incident.assignedTo
                            ? `Owner: ${incident.assignedTo}`
                            : `By: ${incident.reportedBy}`}
                        </span>
                      ) : null}
                      {incident.reportedAt ? (
                        <span>
                          {new Date(incident.reportedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : null}
                      {isResolved ? (
                        <span className="text-foreground inline-flex items-center gap-1">
                          <CheckCircle2Icon className="size-3" />
                          {incident.resolution || "Resolved"}
                        </span>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {onEdit ? <Button size="sm" variant="ghost" onClick={() => onEdit(incident)}>Edit</Button> : null}
                        {onDelete ? <Button size="sm" variant="ghost" onClick={() => onDelete(incident)}>Delete</Button> : null}
                        {onResolve ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              onResolve(
                                incident,
                                `Resolved from ops desk · ${new Date().toLocaleTimeString()}`,
                              )
                            }
                          >
                            {busy ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2Icon className="size-3.5" />
                            )}
                            Resolve
                          </Button>
                        ) : null}
                        {onEscalate && incident.status !== "escalated" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onEscalate(incident)}
                          >
                            {busy ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <ArrowUpIcon className="size-3.5" />
                            )}
                            Escalate
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {canWrite && isResolved && onReopen ? (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onReopen(incident)}
                        >
                          {busy ? (
                            <Loader2Icon className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcwIcon className="size-3.5" />
                          )}
                          Reopen
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
