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
 * Magic UI–style dock: monochrome icons in soft circular tiles.
 * Visible only when the sidebar is closed (collapsed / mobile sheet shut).
 */
const MODULES = [
  { to: "/", label: "Home", icon: LayoutDashboardIcon },
  { to: "/events", label: "Events", icon: CalendarDaysIcon },
  { to: "/crm", label: "CRM", icon: WorkflowIcon },
  { to: "/projects", label: "Delivery", icon: FolderKanbanIcon },
  { to: "/cues", label: "Live ops", icon: RadioIcon },
  { to: "/activity", label: "Activity", icon: ActivityIcon },
] as const

const AI = { to: "/ai", label: "AI assist", icon: CosmosAiIcon } as const

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
        "bg-black/10 transition-colors duration-150 dark:bg-white/10",
        "hover:bg-white hover:text-black dark:hover:bg-white dark:hover:text-black",
        active && "bg-white/90 text-black ring-1 ring-white dark:bg-white/90",
        accent &&
          !active &&
          "bg-white/15 ring-1 ring-white/25 dark:bg-white/15 dark:ring-white/30",
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
      {/* Desktop: Magic UI magnifying dock */}
      <div className="pointer-events-auto max-sm:hidden">
        <TooltipProvider delay={200}>
          <div>
            <Dock direction="bottom" iconSize={48} magnification={0.5} distance={100}>
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

      {/* Mobile: compact dock */}
      <nav className="pointer-events-auto sm:hidden" aria-label="Primary modules">
        <div className="bg-background/90 border-border flex items-center gap-0.5 rounded-2xl border px-1.5 py-1 shadow-lg backdrop-blur-xl">
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
                  "bg-transparent text-muted-foreground",
                  "active:bg-white/20",
                  active && "bg-white text-black ring-1 ring-white dark:bg-white dark:text-black",
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
              "text-muted-foreground ring-1 ring-white/20",
              "active:bg-white/20",
              aiActive && "bg-white text-black ring-1 ring-white dark:bg-white dark:text-black",
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
              "flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl",
              "text-muted-foreground",
              isActive(pathname, "/settings") &&
                "bg-white text-black ring-1 ring-white dark:bg-white dark:text-black",
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
