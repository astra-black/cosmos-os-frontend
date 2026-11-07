import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2Icon, RefreshCwIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { listProjectActivity } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { ProjectActivityItem } from "@/types/agency"
import { cn } from "@/lib/utils"

type EntityFilter = "all" | "PROJECT" | "TASK"
type ActorFilter = "all" | string

function actorInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

function entityLabel(entityType: string) {
  if (entityType === "PROJECT") return "Project"
  if (entityType === "TASK") return "Task"
  return entityType
}

function formatActivityTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const ms = Date.now() - date.getTime()
  if (ms < 0) return date.toLocaleString()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" })
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function ProjectActivityPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ProjectActivityItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<"initial" | "more" | null>(null)
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all")
  const [actorFilter, setActorFilter] = useState<ActorFilter>("all")
  const [reloadKey, setReloadKey] = useState(0)
  const projectIdRef = useRef(projectId)
  const mountedRef = useRef(false)
  projectIdRef.current = projectId

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setEntityFilter("all")
    setActorFilter("all")

    async function load() {
      setLoading(true)
      setLoadingMore(false)
      setError(null)
      setErrorKind(null)
      setItems([])
      setNextCursor(null)
      setHasMore(false)
      try {
        const res = await listProjectActivity(projectId, { limit: 25 })
        if (cancelled || projectIdRef.current !== projectId) return
        setItems(res.items ?? [])
        setNextCursor(res.nextCursor ?? null)
        setHasMore(Boolean(res.hasMore))
      } catch (err) {
        if (cancelled || projectIdRef.current !== projectId) return
        setError(err instanceof ApiError ? err.message : "Failed to load activity")
        setErrorKind("initial")
        setItems([])
        setNextCursor(null)
        setHasMore(false)
      } finally {
        if (!cancelled && projectIdRef.current === projectId) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, reloadKey])

  async function loadMore() {
    const forProject = projectId
    const cursor = nextCursor
    if (!cursor || loadingMore || loading) return
    setLoadingMore(true)
    setError(null)
    setErrorKind(null)
    try {
      const res = await listProjectActivity(forProject, {
        cursor,
        limit: 25,
      })
      if (!mountedRef.current || projectIdRef.current !== forProject) return
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id))
        const appended = (res.items ?? []).filter((item) => !seen.has(item.id))
        return [...prev, ...appended]
      })
      setNextCursor(res.nextCursor ?? null)
      setHasMore(Boolean(res.hasMore))
    } catch (err) {
      if (!mountedRef.current || projectIdRef.current !== forProject) return
      setError(err instanceof ApiError ? err.message : "Failed to load more activity")
      setErrorKind("more")
    } finally {
      if (mountedRef.current && projectIdRef.current === forProject) setLoadingMore(false)
    }
  }

  const actors = useMemo(() => {
    const names = new Set<string>()
    for (const item of items) {
      if (item.actor?.trim()) names.add(item.actor.trim())
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [items])

  useEffect(() => {
    if (actorFilter !== "all" && !actors.includes(actorFilter)) {
      setActorFilter("all")
    }
  }, [actors, actorFilter])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (entityFilter !== "all" && item.entityType !== entityFilter) return false
      if (actorFilter !== "all" && item.actor !== actorFilter) return false
      return true
    })
  }, [items, entityFilter, actorFilter])

  const filtersActive = entityFilter !== "all" || actorFilter !== "all"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter activity by type"
          className="h-8 w-auto min-w-[8.5rem] normal-case"
          value={entityFilter}
          onChange={(event) => setEntityFilter(event.target.value as EntityFilter)}
        >
          <option value="all">All Activity</option>
          <option value="PROJECT">Project</option>
          <option value="TASK">Task</option>
        </Select>
        <Select
          aria-label="Filter activity by person"
          className="h-8 w-auto min-w-[8.5rem] normal-case"
          value={actorFilter}
          onChange={(event) => setActorFilter(event.target.value)}
        >
          <option value="all">All People</option>
          {actors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <div className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive text-sm">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() => {
              if (errorKind === "more") {
                void loadMore()
              } else {
                setReloadKey((key) => key + 1)
              }
            }}
          >
            <RefreshCwIcon className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "flex min-h-14 items-center gap-3 py-3",
                index > 0 && "border-border/60 border-t",
              )}
            >
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-3/4 max-w-sm" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-5 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      ) : items.length === 0 && !error ? (
        <EmptyState
          title="No activity yet"
          description="Project and task changes for this project will appear here."
          className="py-12"
        />
      ) : filtered.length === 0 && !error ? (
        <EmptyState
          title="No matching activity"
          description={
            filtersActive
              ? "Try clearing the type or people filter. Filters apply to loaded activity only."
              : undefined
          }
          className="py-12"
        />
      ) : filtered.length > 0 ? (
        <ul className="flex flex-col">
          {filtered.map((item, index) => (
            <li
              key={item.id}
              className={cn(
                "flex min-h-14 items-center gap-2.5 py-3 sm:gap-3",
                index > 0 && "border-border/60 border-t",
              )}
            >
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="bg-muted text-[10px] font-semibold tracking-wide">
                  {actorInitials(item.actor || "System")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-[13px] leading-snug font-semibold">
                  <span>{item.actor || "System"}</span>
                  <span className="text-muted-foreground font-medium"> · </span>
                  <span className="text-foreground font-medium">{item.summary}</span>
                </p>
                <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">
                  {entityLabel(item.entityType)}
                  {item.timestamp ? ` · ${formatActivityTime(item.timestamp)}` : ""}
                </p>
              </div>
              <span
                className="bg-muted text-muted-foreground border-border/70 inline-flex size-5 shrink-0 items-center justify-center rounded-md border text-[9px] font-semibold tracking-wide uppercase"
                title={entityLabel(item.entityType)}
                aria-label={entityLabel(item.entityType)}
              >
                {item.entityType === "TASK" ? "T" : item.entityType === "PROJECT" ? "P" : "·"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!loading && hasMore ? (
        <div className="flex justify-center pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      ) : null}

      {filtersActive && !loading && items.length > 0 ? (
        <p className="text-muted-foreground text-center text-[11px]">
          Filters apply to loaded activity only.
        </p>
      ) : null}
    </div>
  )
}
