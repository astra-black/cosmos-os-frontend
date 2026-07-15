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
  ChevronRightIcon,
  ClipboardListIcon,
  ContactIcon,
  CreditCardIcon,
  FolderKanbanIcon,
  GitBranchIcon,
  ImagesIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  MegaphoneIcon,
  RadioIcon,
  SettingsIcon,
  ShieldAlertIcon,
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavLeaf = {
  kind: "leaf"
  to: string
  label: string
  icon: LucideIcon
  badge?: number
}

type NavFolder = {
  kind: "folder"
  id: string
  label: string
  icon: LucideIcon
  children: NavLeaf[]
}

type NavNode = NavLeaf | NavFolder

const navTree: NavNode[] = [
  { kind: "leaf", to: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { kind: "leaf", to: "/events", label: "Events", icon: CalendarDaysIcon },
  { kind: "leaf", to: "/activity", label: "Activity", icon: ActivityIcon },
  {
    kind: "folder",
    id: "crm",
    label: "CRM",
    icon: WorkflowIcon,
    children: [
      { kind: "leaf", to: "/crm", label: "Pipeline", icon: GitBranchIcon },
      { kind: "leaf", to: "/clients", label: "Accounts", icon: Building2Icon },
      { kind: "leaf", to: "/contacts", label: "Contacts", icon: ContactIcon },
    ],
  },
  {
    kind: "folder",
    id: "delivery",
    label: "Delivery",
    icon: FolderKanbanIcon,
    children: [
      { kind: "leaf", to: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { kind: "leaf", to: "/projects", label: "Projects", icon: FolderKanbanIcon },
      { kind: "leaf", to: "/tasks", label: "Tasks", icon: ListTodoIcon },
      { kind: "leaf", to: "/assets", label: "Assets", icon: ImagesIcon },
      { kind: "leaf", to: "/approvals", label: "Approvals", icon: CheckSquareIcon },
      { kind: "leaf", to: "/vendors", label: "Vendors", icon: TruckIcon },
      { kind: "leaf", to: "/portfolio", label: "Portfolio", icon: BriefcaseIcon },
      { kind: "leaf", to: "/finance", label: "Finance", icon: WalletIcon },
    ],
  },
  {
    kind: "folder",
    id: "ops",
    label: "Live ops",
    icon: RadioIcon,
    children: [
      { kind: "leaf", to: "/cues", label: "Cues & Timeline", icon: ClipboardListIcon },
      { kind: "leaf", to: "/crew", label: "Crew", icon: UsersIcon },
      { kind: "leaf", to: "/incidents", label: "Incidents", icon: AlertTriangleIcon },
      { kind: "leaf", to: "/analytics", label: "Analytics", icon: BarChart3Icon },
    ],
  },
  {
    kind: "folder",
    id: "system",
    label: "System",
    icon: SettingsIcon,
    children: [
      { kind: "leaf", to: "/teams", label: "Teams & roles", icon: UsersRoundIcon },
      { kind: "leaf", to: "/billing", label: "Billing", icon: CreditCardIcon },
      { kind: "leaf", to: "/monitoring", label: "Monitoring", icon: ShieldAlertIcon },
      { kind: "leaf", to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
]

function filterTreeByRole(tree: NavNode[], role: string | undefined): NavNode[] {
  return tree
    .map((node) => {
      if (node.kind === "leaf") {
        return canAccessRoute(role, node.to) ? node : null
      }
      const children = node.children.filter((c) => canAccessRoute(role, c.to))
      if (children.length === 0) return null
      return { ...node, children }
    })
    .filter(Boolean) as NavNode[]
}

function pathMatches(pathname: string, to: string) {
  if (to === "/") return pathname === "/"
  return pathname === to || pathname.startsWith(`${to}/`)
}

function folderHasActive(pathname: string, folder: NavFolder) {
  return folder.children.some((child) => pathMatches(pathname, child.to))
}

function useCloseMobileNav() {
  const { isMobile, setOpenMobile } = useSidebar()
  return () => {
    if (isMobile) setOpenMobile(false)
  }
}

function LeafLink({
  item,
  pathname,
}: {
  item: NavLeaf
  pathname: string
}) {
  const active = pathMatches(pathname, item.to)
  const closeMobile = useCloseMobileNav()
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        render={
          <NavLink to={item.to} end={item.to === "/"} onClick={closeMobile} />
        }
      >
        <item.icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {item.badge != null ? (
        <SidebarMenuBadge className="bg-primary/10 top-1/2! right-2 -translate-y-1/2! rounded-full">
          {item.badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}

function FolderNode({
  folder,
  pathname,
  open,
  onToggle,
}: {
  folder: NavFolder
  pathname: string
  open: boolean
  onToggle: () => void
}) {
  const activeBranch = folderHasActive(pathname, folder)
  const closeMobile = useCloseMobileNav()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={activeBranch && !open}
        onClick={onToggle}
        className={cn(activeBranch && "font-medium")}
        aria-expanded={open}
      >
        <folder.icon />
        <span className="flex-1">{folder.label}</span>
        <ChevronRightIcon
          className={cn(
            "text-sidebar-foreground/50 ml-auto size-3.5! transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </SidebarMenuButton>

      {open ? (
        <SidebarMenuSub className="border-sidebar-border/80 mr-0 ml-3.5 gap-0.5 border-l py-1">
          {folder.children.map((child) => {
            const active = pathMatches(pathname, child.to)
            return (
              <SidebarMenuSubItem key={child.to}>
                <SidebarMenuSubButton
                  size="sm"
                  isActive={active}
                  render={<NavLink to={child.to} onClick={closeMobile} />}
                >
                  <child.icon className="opacity-70" />
                  <span>{child.label}</span>
                  {child.badge != null ? (
                    <span className="bg-primary/10 text-sidebar-foreground ml-auto rounded-full px-1.5 text-[10px] font-medium tabular-nums">
                      {child.badge}
                    </span>
                  ) : null}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

const STORAGE_KEY = "cosmos.sidebarFolders"

function loadOpenFolders(defaults: string[]): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return { ...Object.fromEntries(defaults.map((id) => [id, false])), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return Object.fromEntries(defaults.map((id) => [id, false]))
}

export function AppSidebar({ incidentCount }: { incidentCount?: number }) {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()

  const tree = useMemo(() => {
    const withBadges = navTree.map((node) => {
      if (node.kind !== "folder" || node.id !== "ops") return node
      return {
        ...node,
        children: node.children.map((child) =>
          child.to === "/incidents" && incidentCount
            ? { ...child, badge: incidentCount }
            : child,
        ),
      }
    })
    return filterTreeByRole(withBadges, user?.role)
  }, [incidentCount, user?.role])

  const folderIds = useMemo(
    () => tree.filter((n): n is NavFolder => n.kind === "folder").map((f) => f.id),
    [tree],
  )

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() =>
    loadOpenFolders(folderIds),
  )

  // Auto-expand the folder that contains the active route
  useEffect(() => {
    const activeFolder = tree.find(
      (n): n is NavFolder => n.kind === "folder" && folderHasActive(pathname, n),
    )
    if (activeFolder && !openFolders[activeFolder.id]) {
      setOpenFolders((prev) => {
        const next = { ...prev, [activeFolder.id]: true }
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    }
  }, [pathname, tree, openFolders])

  function toggleFolder(id: string) {
    setOpenFolders((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <Sidebar>
      <SidebarHeader className="gap-0 px-3 py-3">
        <div className="flex items-center gap-2 px-1">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-bold">
            C
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold tracking-tight">Cosmos OS</div>
            <div className="text-muted-foreground truncate text-[11px]">Agency operating system</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup className="py-2">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {tree.map((node) => {
                if (node.kind === "leaf") {
                  return <LeafLink key={node.to} item={node} pathname={pathname} />
                }
                return (
                  <FolderNode
                    key={node.id}
                    folder={node}
                    pathname={pathname}
                    open={Boolean(openFolders[node.id])}
                    onToggle={() => toggleFolder(node.id)}
                  />
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
