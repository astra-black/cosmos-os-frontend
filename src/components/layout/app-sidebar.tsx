import { useEffect, useMemo, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChart3Icon,
  BriefcaseIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  ContactIcon,
  CreditCardIcon,
  FileTextIcon,
  FolderKanbanIcon,
  GitBranchIcon,
  ImagesIcon,
  LayersIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  FlagIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  RadioIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrendingUpIcon,
  TruckIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
  WorkflowIcon,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { canAccessRoute } from "@/lib/rbac"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// ── Nav tree types ──────────────────────────────────────────

type NavLeaf = {
  kind: "leaf"
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

type NavGroup = {
  kind: "group"
  label: string
  items: NavLeaf[]
}

type NavNode = NavLeaf | NavGroup

// ── Nav groups — Neon Studio layout ────────────────────────

const navGroups: NavGroup[] = [
  {
    kind: "group",
    label: "WORKSPACE",
    items: [
      { kind: "leaf", to: "/dashboard",  label: "Dashboard",     icon: LayoutDashboardIcon },
      { kind: "leaf", to: "/projects",   label: "Projects",      icon: FolderKanbanIcon },
      { kind: "leaf", to: "/tasks",      label: "Tasks",         icon: ListTodoIcon },
      { kind: "leaf", to: "/milestones", label: "Milestones",    icon: FlagIcon },
    ],
  },
  {
    kind: "group",
    label: "LIVE OPERATIONS",
    items: [
      { kind: "leaf", to: "/events",     label: "Events",        icon: CalendarDaysIcon },
    ],
  },
  {
    kind: "group",
    label: "FINANCE",
    items: [
      { kind: "leaf", to: "/finance",    label: "Budget & Profit", icon: TrendingUpIcon },
      { kind: "leaf", to: "/billing",    label: "Invoices",        icon: FileTextIcon },
    ],
  },
  {
    kind: "group",
    label: "NETWORK",
    items: [
      { kind: "leaf", to: "/crm",        label: "CRM Pipeline",  icon: WorkflowIcon },
      { kind: "leaf", to: "/vendors",    label: "Vendors",       icon: TruckIcon },
    ],
  },
  {
    kind: "group",
    label: "COLLABORATE",
    items: [
      { kind: "leaf", to: "/assets",     label: "Files & Assets",icon: ImagesIcon },
      { kind: "leaf", to: "/approvals",  label: "Approvals",     icon: ShieldCheckIcon },
    ],
  },
  {
    kind: "group",
    label: "PLATFORM",
    items: [
      { kind: "leaf", to: "/ai",         label: "Astrid AI",     icon: SparklesIcon },
      { kind: "leaf", to: "/settings",   label: "Settings",      icon: SettingsIcon },
    ],
  },
]

// ── Helpers ─────────────────────────────────────────────────

function pathMatches(pathname: string, to: string) {
  if (to === "/") return pathname === "/"
  return pathname === to || pathname.startsWith(`${to}/`)
}

function filterGroupsByRole(groups: NavGroup[], role: string | undefined): NavGroup[] {
  return groups
    .map((group) => {
      const items = group.items.filter((item) => canAccessRoute(role, item.to))
      return items.length > 0 ? { ...group, items } : null
    })
    .filter(Boolean) as NavGroup[]
}

// ── Avatar color helper (deterministic from name) ───────────

function avatarBg(name: string) {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return `hsl(${hue}deg 60% 35%)`
}

// ── AppSidebar ───────────────────────────────────────────────

export function AppSidebar({ incidentCount }: { incidentCount?: number }) {
  const { user } = useAuth()
  const location = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()

  const filteredGroups = useMemo(
    () => filterGroupsByRole(navGroups, user?.role),
    [user?.role],
  )

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const initials = (user?.name || user?.email || "AB")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <Sidebar
      className="border-r-0"
      style={{ "--sidebar-width": "240px" } as React.CSSProperties}
    >
      {/* ── Brand header ──────────────────────────────────── */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          {/* AB Logo tile — always dark purple */}
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-sora font-bold text-sm select-none shadow-md"
            style={{ background: "#270045" }}
          >
            AB
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-sora font-semibold text-sm leading-tight truncate text-sidebar-foreground">
              Astra Black
            </p>
            <p className="text-[11px] leading-tight truncate text-sidebar-foreground/50">
              Agency OS
            </p>
          </div>
        </div>
      </SidebarHeader>

      {/* ── Nav groups ────────────────────────────────────── */}
      <SidebarContent className="px-2 py-3 overflow-y-auto">
        <nav className="space-y-5">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              {/* Section label */}
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                {group.label}
              </p>
              {/* Nav items */}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathMatches(location.pathname, item.to)
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.to === "/dashboard"}
                        onClick={closeOnMobile}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 relative",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary font-medium"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                        )}
                      >
                        <item.icon
                          size={15}
                          className={cn(
                            "shrink-0 transition-colors",
                            active
                              ? "text-sidebar-primary"
                              : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                          )}
                        />
                        <span>{item.label}</span>
                        {/* Badge for incidents */}
                        {item.to === "/incidents" && (incidentCount ?? 0) > 0 && (
                          <span
                            className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white bg-[#270045]"
                          >
                            {incidentCount}
                          </span>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── User footer ─────────────────────────────────── */}
        <div className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 mx-0 bg-sidebar-accent border border-sidebar-border">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: avatarBg(user?.name || "AB") }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate text-sidebar-foreground">
              {user?.name || user?.email || "User"}
            </p>
            <p className="text-[10px] capitalize truncate text-sidebar-foreground/50">
              {user?.role || "member"}
            </p>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}
