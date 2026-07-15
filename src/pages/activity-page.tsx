import { useEffect, useState } from "react"
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  MessageSquareIcon,
  UsersIcon,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listActivity } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { ActivityItem } from "@/types/agency"

function iconFor(type: string) {
  switch (type) {
    case "approval":
      return CheckCircle2Icon
    case "incident":
      return AlertTriangleIcon
    case "task":
      return ClipboardListIcon
    case "comment":
      return MessageSquareIcon
    case "team":
      return UsersIcon
    default:
      return ActivityIcon
  }
}

export function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await listActivity(80)
        if (!cancelled) setItems(res.data ?? [])
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load activity")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Activity"
        description="Cross-agency feed — deliveries, ops, approvals, and team changes."
      />

      {error ? (
        <Card className="border-destructive/40 text-destructive px-4 py-3 text-sm">{error}</Card>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ol className="relative flex flex-col">
          {items.map((item, i) => {
            const Icon = iconFor(item.type)
            return (
              <li key={item.activityId} className="relative flex gap-3 pb-4">
                <div className="relative flex w-8 shrink-0 flex-col items-center">
                  <div className="bg-primary/10 text-primary z-10 flex size-8 items-center justify-center rounded-full">
                    <Icon className="size-3.5" />
                  </div>
                  {i < items.length - 1 ? (
                    <div className="bg-border absolute top-8 bottom-0 w-px" />
                  ) : null}
                </div>
                <Card className="min-w-0 flex-1 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant="outline" className="h-5 capitalize">
                      {item.type}
                    </Badge>
                  </div>
                  {item.body ? (
                    <p className="text-muted-foreground mt-1 text-sm">{item.body}</p>
                  ) : null}
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 text-[11px]">
                    <span>{item.actor || "System"}</span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    {item.entityType ? (
                      <span className="font-mono">
                        {item.entityType}:{item.entityId}
                      </span>
                    ) : null}
                  </div>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
