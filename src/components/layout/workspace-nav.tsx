import { NavLink, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  CalendarDaysIcon,
  DollarSignIcon,
  EyeIcon,
  HandshakeIcon,
  LayersIcon,
  LayoutGridIcon,
  ListIcon,
  MessageSquareIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

import { useAuth } from "@/lib/auth"
import { canAccessRoute } from "@/lib/rbac"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  to: string
  icon: LucideIcon
  /** Extra path prefixes that count as active for this item. */
  match?: string[]
}

type NavGroup = {
  label: string
  items: NavItem[]
}

/**
 * Figma 00.10 WORK_NAV (build_collab.py + D-102 My Feedback rename).
 * Hierarchy matches frames 1271:25501 / 1270:25501.
 * Omitted (no existing route/product area): My Feedback.
 */
const WORKSPACE_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutGridIcon },
      { label: "Projects", to: "/projects", icon: LayersIcon },
      { label: "Work", to: "/tasks", icon: ListIcon },
      { label: "Schedule", to: "/schedule", icon: CalendarDaysIcon },
      { label: "Messages", to: "/messages", icon: MessageSquareIcon },
      { label: "Reviews", to: "/approvals", icon: EyeIcon },
      { label: "Finance", to: "/finance", icon: DollarSignIcon },
      { label: "Vendors & Crew", to: "/vendors", icon: UsersIcon, match: ["/vendors", "/crew"] },
      { label: "Live Events", to: "/events", icon: TicketIcon },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Relationships", to: "/crm", icon: HandshakeIcon, match: ["/crm", "/clients", "/contacts"] },
    ],
  },
]

function pathMatches(pathname: string, prefixes: string[]) {
  return prefixes.some((to) => pathname === to || pathname.startsWith(`${to}/`))
}

function itemActive(pathname: string, item: NavItem) {
  return pathMatches(pathname, item.match ?? [item.to])
}

/** Routes that use the collaboration workspace chrome (left nav). Hub Portal, Producer Dashboard, Settings, billing, monitoring, and spatial stage keep their own shells. */
export function shouldShowWorkspaceNav(pathname: string) {
  if (
    pathname === "/" ||
    pathname === "/hub" ||
    pathname.startsWith("/hub/") ||
    pathname === "/dashboard"
  ) {
    return false
  }
  if (pathname.startsWith("/settings")) return false
  if (pathname.startsWith("/billing")) return false
  if (pathname.startsWith("/monitoring")) return false
  if (pathname.includes("/spatial-stage")) return false
  return true
}

export function WorkspaceNav() {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()

  const groups = WORKSPACE_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessRoute(user?.role, item.to)),
  })).filter((group) => group.items.length > 0)

  return (
    <nav className="cosmos-workspace-nav" aria-label="Workspace">
      {groups.map((group) => (
        <div key={group.label} className="cosmos-workspace-nav__group">
          <div className="cosmos-workspace-nav__group-label">{group.label}</div>
          <ul className="cosmos-workspace-nav__list">
            {group.items.map((item) => {
              const active = itemActive(pathname, item)
              return (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/dashboard"}
                    className={cn("cosmos-workspace-nav__item", active && "is-active")}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
