import { Link, Outlet, useLocation } from "react-router-dom"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { AppDock } from "@/components/layout/app-dock"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { GlobalSearch } from "@/components/layout/global-search"
import { NotificationsBell } from "@/components/layout/notifications-bell"
import { ThemeToggle } from "@/components/theme-toggle"
import { OnboardingProfileModal } from "@/components/shared/onboarding-profile-modal"
import { useAuth } from "@/lib/auth"
import { roleLabel } from "@/lib/rbac"
import { cn } from "@/lib/utils"

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/events": "Events",
  "/activity": "Activity",
  "/crm": "CRM pipeline",
  "/clients": "Accounts",
  "/contacts": "Contacts",
  "/campaigns": "Campaigns",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/portfolio": "Portfolio",
  "/assets": "Assets",
  "/approvals": "Approvals",
  "/vendors": "Vendors",
  "/cues": "Cues & Timeline",
  "/crew": "Crew & Departments",
  "/incidents": "Incidents",
  "/analytics": "Analytics",
  "/finance": "Finance",
  "/ai": "AI assist",
  "/billing": "Billing",
  "/teams": "Teams & roles",
  "/monitoring": "Monitoring",
  "/settings": "Settings",
  "/spatial-stage": "Spatial Stage",
}

function resolveTitle(pathname: string) {
  if (titles[pathname]) return titles[pathname]
  if (pathname.includes("/spatial-stage") || pathname === "/spatial-stage") return "Spatial Stage"
  if (pathname.startsWith("/events/")) return "Event detail"
  return "Cosmos OS"
}

function isSpatialStagePath(pathname: string) {
  return pathname === "/spatial-stage" || pathname.includes("/spatial-stage")
}

export function AppShell({ incidentCount }: { incidentCount?: number }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pageTitle = resolveTitle(location.pathname)
  const fullBleed = isSpatialStagePath(location.pathname)
  const initials = (user?.name || user?.email || "CO")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={cn("flex w-full relative", fullBleed ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      {/* Ambient background glow for authenticated portal */}
      <div className="glow" aria-hidden="true" />
      <SidebarProvider className={fullBleed ? "h-full min-h-0 overflow-hidden" : undefined}>
        <AppSidebar incidentCount={incidentCount} />
        <div className={cn("flex min-h-0 flex-1 flex-col", fullBleed && "h-full overflow-hidden")}>
          <header className="bg-card sticky top-0 z-50 border-b shrink-0">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 sm:px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="[&_svg]:size-5!" />
                <Separator
                  orientation="vertical"
                  className="hidden h-4! data-vertical:self-center sm:block"
                />
                <Breadcrumb className="hidden sm:block">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink render={<Link to="/" />}>Cosmos OS</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                {/* Compact title on small screens (breadcrumb is hidden) */}
                <h1 className="truncate text-sm font-medium sm:hidden">{pageTitle}</h1>
              </div>
              <div className="flex items-center gap-1">
                <GlobalSearch />
                <NotificationsBell />
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-lg">
                        <Avatar className="size-[inherit] rounded-[inherit] after:rounded-[inherit]">
                          <AvatarFallback className="rounded-[inherit]">{initials}</AvatarFallback>
                        </Avatar>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuItem disabled>
                        <div className="flex flex-col">
                          <span className="font-medium">{user?.name}</span>
                          <span className="text-muted-foreground text-xs">{user?.email}</span>
                          <span className="text-muted-foreground text-xs capitalize">
                            {roleLabel(user?.role || "user")}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem render={<Link to="/settings" />}>Settings</DropdownMenuItem>
                    <DropdownMenuItem render={<Link to="/billing" />}>Billing</DropdownMenuItem>
                    <DropdownMenuItem render={<Link to="/portal/login" />}>
                      Client portal
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <ShellMain fullBleed={fullBleed}>
            <Outlet />
          </ShellMain>
          {!fullBleed ? <AppDock /> : null}
        </div>
        <OnboardingProfileModal />
      </SidebarProvider>
    </div>
  )
}

/** Extra bottom padding only when the dock is visible (sidebar closed). */
function ShellMain({
  children,
  fullBleed = false,
}: {
  children: React.ReactNode
  fullBleed?: boolean
}) {
  const { state, isMobile, openMobile } = useSidebar()
  const dockVisible = isMobile ? !openMobile : state === "collapsed"

  if (fullBleed) {
    return (
      <main className="relative min-h-0 flex-1 overflow-hidden p-0">
        {children}
      </main>
    )
  }

  return (
    <main
      className={cn(
        "mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6",
        dockVisible
          ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-28"
          : "pb-6",
      )}
    >
      {children}
    </main>
  )
}

