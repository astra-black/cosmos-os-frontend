import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Event } from "@/types/agency"
import { cn } from "@/lib/utils"

type EventScopeBarProps = {
  title: string
  description?: string
  events: Event[]
  eventId: string
  onEventChange: (eventId: string) => void
  loading?: boolean
  selectedEvent?: Event | null
  /** Compact toolbar for ops desks (default true for specialized pages) */
  compact?: boolean
  trailing?: ReactNode
  className?: string
}

export function EventScopeBar({
  title,
  description,
  events,
  eventId,
  onEventChange,
  loading,
  selectedEvent,
  compact = true,
  trailing,
  className,
}: EventScopeBarProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && !compact ? (
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          ) : null}
          {compact && selectedEvent ? (
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {selectedEvent.name}
              <span className="text-muted-foreground/70">
                {" "}
                · {selectedEvent.eventId}
                {selectedEvent.venue ? ` · ${selectedEvent.venue}` : ""}
              </span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {trailing}
          {loading ? (
            <Skeleton className="h-9 w-56" />
          ) : (
            <select
              aria-label="Operating event"
              value={eventId}
              onChange={(e) => onEventChange(e.target.value)}
              className="border-input bg-background h-9 min-w-48 max-w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {events.length === 0 ? <option value="">No events</option> : null}
              {events.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.name}
                </option>
              ))}
            </select>
          )}
          {selectedEvent ? (
            <>
              <Badge className="capitalize">{selectedEvent.status}</Badge>
              <Link
                to={`/events/${selectedEvent.eventId}`}
                className="text-primary text-sm font-medium whitespace-nowrap hover:underline"
              >
                Detail
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
