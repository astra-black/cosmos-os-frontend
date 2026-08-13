/**
 * Role-based access for Cosmos OS.
 * Roles: admin | pm | producer | ops | creative | client
 */

export type AppRole = "admin" | "pm" | "producer" | "ops" | "creative" | "client" | string

/** Routes a role may open (prefix match). Admin sees everything. */
const ROLE_ROUTES: Record<string, string[]> = {
  admin: ["*"],
  pm: [
    "/",
    "/events",
    "/activity",
    "/crm",
    "/clients",
    "/contacts",
    "/campaigns",
    "/projects",
    "/tasks",
    "/milestones",
    "/assets",
    "/approvals",
    "/vendors",
    "/portfolio",
    "/finance",
    "/ai",
    "/billing",
    "/teams",
    "/settings",
    "/monitoring",
  ],
  producer: [
    "/",
    "/events",
    "/activity",
    "/projects",
    "/tasks",
    "/milestones",
    "/assets",
    "/approvals",
    "/campaigns",
    "/cues",
    "/crew",
    "/ai",
    "/settings",
  ],
  ops: [
    "/",
    "/events",
    "/activity",
    "/cues",
    "/crew",
    "/incidents",
    "/analytics",
    "/monitoring",
    "/ai",
    "/settings",
  ],
  creative: ["/", "/projects", "/tasks", "/milestones", "/assets", "/approvals", "/activity", "/ai", "/settings"],
  client: ["/portal"],
}

export function canAccessRoute(role: AppRole | null | undefined, pathname: string): boolean {
  if (!role) return false
  const allowed = ROLE_ROUTES[role]
  if (!allowed) return false
  if (pathname.startsWith("/portal")) return role === "client"
  if (allowed.includes("*")) return true
  return allowed.some((route) => {
    if (route === "/") return pathname === "/"
    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

export function canPerform(
  role: AppRole | null | undefined,
  action: "manage_billing" | "decide_approval" | "manage_team" | "write_ops" | "write_crm",
): boolean {
  if (!role) return false
  if (role === "admin") return true
  switch (action) {
    case "manage_billing":
      return false
    case "manage_team":
      return role === "pm"
    case "decide_approval":
      return ["pm", "producer"].includes(role)
    case "write_ops":
      return ["ops", "producer", "pm"].includes(role)
    case "write_crm":
      return ["pm", "producer"].includes(role)
    default:
      return false
  }
}

export function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}
