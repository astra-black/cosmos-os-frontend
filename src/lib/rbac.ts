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
    "/dashboard",
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
    "/dashboard",
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
    "/dashboard",
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
  creative: ["/", "/dashboard", "/projects", "/tasks", "/milestones", "/assets", "/approvals", "/activity", "/ai", "/settings"],
  client: ["/portal"],
}

export function normalizeRole(role: AppRole | null | undefined): string {
  if (!role) return "admin"
  const r = role.toLowerCase().trim().replace(/[\s-]+/g, "_")
  if (r.includes("admin") || r === "agency_admin" || r === "owner") return "admin"
  if (r.includes("pm") || r.includes("project_manager") || r.includes("manager")) return "pm"
  if (r.includes("producer")) return "producer"
  if (r.includes("op") || r.includes("operations") || r.includes("lead")) return "ops"
  if (r.includes("creative") || r.includes("designer") || r.includes("art")) return "creative"
  if (r.includes("client")) return "client"
  return "admin"
}

export function canAccessRoute(role: AppRole | null | undefined, pathname: string): boolean {
  if (!role) return false
  const norm = normalizeRole(role)
  if (norm === "admin") return true
  if (pathname === "/dashboard" || pathname === "/") return true
  const allowed = ROLE_ROUTES[norm] || ["*"]
  if (pathname.startsWith("/portal")) return norm === "client"
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
  const norm = normalizeRole(role)
  if (norm === "admin") return true
  switch (action) {
    case "manage_billing":
      return false
    case "manage_team":
      return norm === "pm"
    case "decide_approval":
      return ["pm", "producer"].includes(norm)
    case "write_ops":
      return ["ops", "producer", "pm"].includes(norm)
    case "write_crm":
      return ["pm", "producer"].includes(norm)
    default:
      return false
  }
}

export function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}
