import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { BellIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/platform"

function relativeTime(iso?: string) {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms) || ms < 0) return ""
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationsBell() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)

  const reload = useCallback(async () => {
    try {
      const res = await listNotifications()
      setItems(res.data ?? [])
      setUnread(res.unread ?? (res.data ?? []).filter((n) => !n.read).length)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void reload()
    const t = setInterval(() => void reload(), 45_000)
    return () => clearInterval(t)
  }, [reload])

  async function onOpen(n: AppNotification) {
    if (!n.read) {
      try {
        await markNotificationRead(n.id)
        await reload()
      } catch {
        /* ignore */
      }
    }
    if (n.href) navigate(n.href)
  }

  async function readAll() {
    try {
      await markAllNotificationsRead()
      await reload()
    } catch {
      /* ignore */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <BellIcon className="size-4" />
            {unread > 0 ? (
              <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 ? (
            <button type="button" className="text-primary text-xs hover:underline" onClick={readAll}>
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="text-muted-foreground px-2 py-6 text-center text-xs">All caught up</div>
        ) : (
          items.slice(0, 10).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-0.5 py-2"
              onClick={() => void onOpen(n)}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}>
                  {n.title}
                </span>
                <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                  {relativeTime(n.createdAt)}
                </span>
              </div>
              {n.body ? (
                <span className="text-muted-foreground line-clamp-2 text-xs">{n.body}</span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
