import { Link, useLocation } from "react-router-dom"
import {
  ActivityIcon,
  CalendarDaysIcon,
  FolderKanbanIcon,
  LayoutDashboardIcon,
  RadioIcon,
  SettingsIcon,
  WorkflowIcon,
} from "lucide-react"

import { Dock, DockIcon } from "@/components/ui/dock"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * Cosmos AI mark — orbital node (unique, not the usual brain/sparkles).
 */
function CosmosAiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Outer orbit */}
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(-28 12 12)"
      />
      {/* Inner orbit */}
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.55"
        transform="rotate(48 12 12)"
      />
      {/* Core */}
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
      {/* Satellite nodes */}
      <circle cx="19.2" cy="9.2" r="1.35" fill="currentColor" />
      <circle cx="6.4" cy="15.4" r="1.1" fill="currentColor" fillOpacity="0.85" />
      <circle cx="14.8" cy="18.6" r="0.9" fill="currentColor" fillOpacity="0.7" />
    </svg>
  )
}

/**
 * Magic UI–style dock: visible in both light and dark mode.
 * Only shown when the sidebar is collapsed / mobile sheet is closed.
 */
const MODULES = [
  { to: "/", label: "Home", icon: LayoutDashboardIcon },
  { to: "/events", label: "Events", icon: CalendarDaysIcon },
  { to: "/crm", label: "CRM", icon: WorkflowIcon },
  { to: "/projects", label: "Delivery", icon: FolderKanbanIcon },
  { to: "/cues", label: "Live ops", icon: RadioIcon },
  { to: "/activity", label: "Activity", icon: ActivityIcon },
] as const

const AI = { to: "/ai", label: "Astrid", icon: CosmosAiIcon } as const

const SYSTEM = [{ to: "/settings", label: "Settings", icon: SettingsIcon }] as const

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/"
  return pathname === to || pathname.startsWith(`${to}/`)
}

function DockLink({
  to,
  label,
  icon: Icon,
  active,
  accent,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  accent?: boolean
}) {
  return (
    <DockIcon
      className={cn(
        // Light mode: foreground tint bg so icons are visible on the light card backdrop
        "bg-foreground/[0.07] text-foreground transition-colors duration-150",
        // Dark mode: white tint
        "dark:bg-white/10 dark:text-white",
        // Hover
        "hover:bg-foreground/[0.12] dark:hover:bg-white/20",
        // Active: brand dark purple, white icon — crisp in both modes
        active && "!bg-[#270045] !text-white",
        // Accent ring for AI button
        accent && !active && "ring-1 ring-foreground/20 dark:ring-white/25",
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              to={to}
              aria-label={label}
              className="flex size-full items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="size-full max-h-[55%] max-w-[55%]" />
            </Link>
          }
        />
        <TooltipContent side="top">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </DockIcon>
  )
}

export function AppDock() {
  const { pathname } = useLocation()
  const { state, isMobile, openMobile } = useSidebar()
  const aiActive = isActive(pathname, AI.to)

  // Desktop: hide when sidebar expanded. Mobile: hide when sheet open.
  const sidebarActive = isMobile ? openMobile : state === "expanded"
  if (sidebarActive) return null

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-2 pb-[env(safe-area-inset-bottom)] sm:bottom-4 sm:px-3",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
      )}
    >
      {/* Desktop: magnifying dock inside a white/dark pill card */}
      <div className="pointer-events-auto max-sm:hidden">
        <TooltipProvider delay={200}>
          {/* Card backdrop gives contrast in light mode */}
          <div className="rounded-2xl border border-border bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur-xl dark:bg-card/85">
            <Dock direction="bottom" iconSize={44} magnification={0.45} distance={90}>
              {MODULES.map((item) => (
                <DockLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(pathname, item.to)}
                />
              ))}

              <Separator orientation="vertical" className="h-full max-h-8" />

              <DockLink
                to={AI.to}
                label={AI.label}
                icon={AI.icon}
                active={aiActive}
                accent
              />

              <Separator orientation="vertical" className="h-full max-h-8" />

              {SYSTEM.map((item) => (
                <DockLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  active={isActive(pathname, item.to)}
                />
              ))}
            </Dock>
          </div>
        </TooltipProvider>
      </div>

      {/* Mobile: compact pill dock — card bg for contrast */}
      <nav className="pointer-events-auto sm:hidden" aria-label="Primary modules">
        <div className="flex items-center gap-0.5 rounded-2xl border border-border bg-card/95 px-1.5 py-1 shadow-lg backdrop-blur-xl">
          {MODULES.slice(0, 4).map((item) => {
            const active = isActive(pathname, item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
                  "text-muted-foreground hover:text-foreground hover:bg-surface-alt",
                  active && "bg-[#270045] text-white",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="max-w-[3.25rem] truncate text-[9px] font-medium leading-none">
                  {item.label}
                </span>
              </Link>
            )
          })}
          <Link
            to={AI.to}
            aria-label={AI.label}
            aria-current={aiActive ? "page" : undefined}
            className={cn(
              "flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-surface-alt",
              aiActive && "bg-[#270045] text-white",
            )}
          >
            <CosmosAiIcon className="size-4 shrink-0" />
            <span className="text-[9px] font-medium leading-none">AI</span>
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            aria-current={isActive(pathname, "/settings") ? "page" : undefined}
            className={cn(
              "flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-surface-alt",
              isActive(pathname, "/settings") && "bg-[#270045] text-white",
            )}
          >
            <SettingsIcon className="size-4 shrink-0" />
            <span className="text-[9px] font-medium leading-none">More</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
