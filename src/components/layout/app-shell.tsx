import { useEffect } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { ChevronDownIcon, LayoutGridIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GlobalSearch } from "@/components/layout/global-search"
import { NotificationsBell } from "@/components/layout/notifications-bell"
import { shouldShowWorkspaceNav, WorkspaceNav } from "@/components/layout/workspace-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { OnboardingProfileModal } from "@/components/shared/onboarding-profile-modal"
import { useAuth } from "@/lib/auth"
import { canAccessRoute, canPerform, normalizeRole, roleLabel } from "@/lib/rbac"
import { cn } from "@/lib/utils"

const titles: Record<string, string> = {
  "/hub": "Hub",
  "/hub/members": "Members & Roles",
  "/hub/reports": "Reports",
  "/hub/reports/financial": "Financial Summary",
  "/hub/reports/projects": "Projects & Productions",
  "/hub/records": "Shared Records",
  "/hub/records/clients": "Clients & Partners",
  "/hub/records/vendors": "Vendors",
  "/hub/records/contacts": "Contacts",
  "/hub/account": "Personal Account",
  "/hub/account/security": "Sign-In & Security",
  "/hub/account/privacy": "Privacy & Visibility",
  "/hub/account/organizations": "Organizations",
  "/hub/account/preferences": "Preferences",
  "/hub/organization": "Organization",
  "/hub/organization/edit": "Edit Organization",
  "/hub/organization/people": "People",
  "/hub/organization/teams": "Teams & Divisions",
  "/hub/organization/editions": "Edition Access",
  "/hub/organization/usage": "Usage & Credits",
  "/hub/reputation": "Reviews & Reputation",
  "/hub/reputation/analysis": "Reputation Analysis",
  "/hub/reputation/inbox": "Reputation Inbox",
  "/hub/reputation/feedback": "Feedback Library",
  "/hub/reputation/requests": "Feedback Requests",
  "/hub/reputation/testimonials": "Testimonials",
  "/hub/reputation/sources": "Reputation Sources",
  "/hub/reputation/automation": "Reputation Automation",
  "/dashboard": "Dashboard",
  "/events": "Live events",
  "/activity": "Activity",
  "/crm": "Pipeline",
  "/clients": "Clients",
  "/contacts": "Contacts",
  "/campaigns": "Campaigns",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/messages": "Messages",
  "/schedule": "Schedule",
  "/portfolio": "Portfolio",
  "/assets": "Assets",
  "/approvals": "Creative reviews",
  "/vendors": "Vendors",
  "/cues": "Cues & timeline",
  "/crew": "Crew & departments",
  "/incidents": "Incidents",
  "/analytics": "Analytics",
  "/finance": "Finance",
  "/ai": "Astrid",
  "/billing": "Plan & seats",
  "/teams": "People",
  "/monitoring": "Monitoring",
  "/settings": "Settings",
  "/spatial-stage": "Spatial stage",
}

function resolveTitle(pathname: string) {
  if (titles[pathname]) return titles[pathname]
  if (pathname.startsWith("/hub/records/clients/")) return "Client record"
  if (pathname.startsWith("/hub/records/vendors/")) return "Vendor profile"
  if (pathname.startsWith("/hub/records/contacts/")) return "External contact"
  if (pathname.startsWith("/hub/organization/people/")) return "Member Profile"
  if (pathname.startsWith("/hub/reputation/feedback/")) return "Feedback Detail"
  if (pathname.startsWith("/events/")) return "Event detail"
  if (pathname.startsWith("/projects/")) return "Project"
  if (pathname.startsWith("/vendors/")) return "Vendor profile"
  if (pathname.startsWith("/contacts/")) return "External contact"
  return "Cosmos"
}

function isSpatialStagePath(pathname: string) {
  return pathname === "/spatial-stage" || pathname.includes("/spatial-stage")
}

function CosmosMark() {
  return (
    <span className="cosmos-brand-mark" aria-hidden="true">
      <img src="/cosmos-mark.svg" alt="" />
    </span>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pageTitle = resolveTitle(location.pathname)
  const isHub =
    location.pathname === "/hub" || location.pathname.startsWith("/hub/")
  const fullBleed = isSpatialStagePath(location.pathname)
  const showWorkspaceNav = !fullBleed && !isHub && shouldShowWorkspaceNav(location.pathname)
  const showSectionNav = !fullBleed && !isHub && !showWorkspaceNav
  const initials = (user?.name || user?.email || "CO")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const role = normalizeRole(user?.role)
  const canOrgSettings = role === "admin" || canPerform(user?.role, "manage_team")
  const canBilling = canAccessRoute(user?.role, "/billing")
  const orgName = user?.agencyName || "Your organization"

  useEffect(() => {
    try {
      const preferences = JSON.parse(
        localStorage.getItem("cosmos.display-preferences") || "{}",
      ) as { reduceMotion?: boolean; increaseContrast?: boolean; largeText?: boolean }
      document.documentElement.dataset.cosmosReduceMotion = String(
        preferences.reduceMotion === true,
      )
      document.documentElement.dataset.cosmosHighContrast = String(
        preferences.increaseContrast === true,
      )
      document.documentElement.dataset.cosmosLargeText = String(preferences.largeText === true)
    } catch {
      document.documentElement.dataset.cosmosReduceMotion = "false"
      document.documentElement.dataset.cosmosHighContrast = "false"
      document.documentElement.dataset.cosmosLargeText = "false"
    }
  }, [])

  return (
    <div
      className={cn(
        "cosmos-app",
        fullBleed && "cosmos-app--fullbleed",
        showWorkspaceNav && "cosmos-app--workspace",
        isHub && "cosmos-app--hub",
      )}
    >
      <header className="cosmos-topbar">
        <Link className="cosmos-wordmark" to="/hub" aria-label="Cosmos Hub">
          <CosmosMark />
          <span>cosmos</span>
        </Link>
        <span className="cosmos-topbar-divider" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="cosmos-org-switch">
                <Avatar className="cosmos-org-avatar">
                  <AvatarFallback>{orgName.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="cosmos-org-label">
                  <strong className="cosmos-org-name">{orgName}</strong>
                  <small>Agency OS</small>
                </span>
                <ChevronDownIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem disabled>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{orgName}</span>
                <span className="text-muted-foreground text-xs">
                  Only organization on this account
                </span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              Switch organization unavailable — multi-org membership is not supported yet
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/hub/reputation" />}>
              Reviews & Reputation
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/hub/reports" />}>
              Reports
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/hub/records" />}>
              Shared Records
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/hub/organization" />}>
              Organization
            </DropdownMenuItem>
            {canOrgSettings ? (
              <>
                <DropdownMenuItem render={<Link to="/hub/members" />}>
                  Members & Roles
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/settings" />}>
                  Agency OS settings
                </DropdownMenuItem>
              </>
            ) : null}
            {canBilling ? (
              <DropdownMenuItem render={<Link to="/billing" />}>Plan & seats</DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        {isHub ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="cosmos-edition-switch">
                  <span className="cosmos-edition-switch__glyph">
                    <LayoutGridIcon />
                  </span>
                  <span>
                    <small>EDITIONS</small>
                    <strong>Agency OS</strong>
                  </span>
                  <ChevronDownIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuItem render={<Link to="/dashboard" />}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">Agency OS</span>
                  <span className="text-muted-foreground text-xs">
                    Active · Open workspace home
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Edition switcher with context is not available — only Agency OS is licensed on
                this account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="cosmos-edition-switch">
                  <span className="cosmos-edition-switch__glyph">
                    <img src="/figma-editions.svg" alt="" />
                  </span>
                  <span>
                    <small>EDITION</small>
                    <strong>Agency OS</strong>
                  </span>
                  <ChevronDownIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem render={<Link to="/dashboard" />}>
                Agency OS · Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/hub" />}>Back to Cosmos Hub</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Other editions are not on this account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="cosmos-topbar-spacer" />
        <GlobalSearch />
        <Link to="/ai" className="cosmos-astrid-link">
          <img src="/figma-astrid.svg" alt="" />
          <span>Astrid</span>
        </Link>
        <NotificationsBell />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="cosmos-profile-button">
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="cosmos-profile-name">{user?.name || "Account"}</span>
                <ChevronDownIcon />
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
            <DropdownMenuItem render={<Link to="/hub/account" />}>
              Personal Account
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/hub" />}>Cosmos Hub</DropdownMenuItem>
            <DropdownMenuItem render={<Link to="/settings" />}>Settings</DropdownMenuItem>
            {canBilling ? (
              <DropdownMenuItem render={<Link to="/billing" />}>Plan & seats</DropdownMenuItem>
            ) : null}
            <DropdownMenuItem render={<Link to="/portal/login" />}>
              Client portal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {showWorkspaceNav ? (
        <div className="cosmos-shell cosmos-shell--with-nav">
          <WorkspaceNav />
          <div className="cosmos-shell-main">
            <main className="cosmos-route-content">
              <Outlet />
            </main>
          </div>
        </div>
      ) : (
        <>
          {showSectionNav ? (
            <nav className="cosmos-section-nav" aria-label="Workspace navigation">
              <Link to="/hub">Hub</Link>
              <span>/</span>
              <Link
                className={cn(location.pathname === "/dashboard" && "is-current")}
                to="/dashboard"
              >
                Agency OS
              </Link>
              <span>/</span>
              <span className="is-current">{pageTitle}</span>
            </nav>
          ) : null}
          <main
            className={cn(
              "cosmos-route-content",
              fullBleed && "cosmos-route-content--fullbleed",
            )}
          >
            <Outlet />
          </main>
        </>
      )}
      <OnboardingProfileModal />
    </div>
  )
}
