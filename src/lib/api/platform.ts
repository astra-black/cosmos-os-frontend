import { apiRequest } from "@/lib/api/client"
import type { ApiEnvelope } from "@/types/agency"

export type SearchHit = {
  type: string
  id: string
  title: string
  subtitle?: string
  href: string
}

export type AppNotification = {
  id: string
  title: string
  body?: string
  type?: string
  href?: string
  read: boolean
  createdAt: string
}

export type TimeEntry = {
  entryId: string
  projectId?: string
  projectName?: string
  user: string
  hours: number
  date: string
  note?: string
  billable: boolean
  rate: number
}

export type BudgetRow = {
  budgetId: string
  projectId: string
  projectName: string
  clientName?: string | null
  planned: number
  spent: number
  contractedMinimum?: number
  remaining: number
  utilization: number
  minimumShortfall?: number
  pacingPct?: number
  daysUntilKickoff?: number | null
  is14DayAlert?: boolean
  penaltyRisk?: boolean
  penaltyRiskLevel?: "none" | "watch" | "high"
  currency: string
}

export type ProjectProfitability = {
  projectId: string
  projectName: string
  currency: string
  costAvailable: boolean
  planned: number
  actualTimeCost: number
  actualHours: number
  margin: number
  marginPercent: number | null
  forecastCost: number
  forecastMargin: number
  forecastMarginPercent: number | null
}

export type CreateBudgetInput = {
  projectId: string
  projectName?: string
  planned: number
  contractedMinimum?: number
  currency?: string
}

export type Tenant = {
  tenantId: string
  name: string
  plan: string
  seats: number
  seatsUsed: number
  billingEmail?: string
  status: string
  renewsAt?: string
  features: string[]
}

export type BillingPlan = {
  id: string
  name: string
  priceMonthly: number
  seats: number
  features: string[]
}

export async function globalSearch(q: string) {
  return apiRequest<ApiEnvelope<SearchHit[]>>(
    `/api/v1/agency/search?q=${encodeURIComponent(q)}`,
  )
}

export async function listNotifications() {
  return apiRequest<ApiEnvelope<AppNotification[]> & { unread?: number}>(
    "/api/v1/agency/notifications",
  )
}

export async function markNotificationRead(id: string) {
  return apiRequest(`/api/v1/agency/notifications/${id}/read`, { method: "POST" })
}

export async function markAllNotificationsRead() {
  return apiRequest("/api/v1/agency/notifications/read-all", { method: "POST" })
}

export async function getFinanceSummary() {
  return apiRequest<
    ApiEnvelope<{
      planned: number
      spent: number
      remaining: number
      hours: number
      billableHours: number
      revenue: number
    }>
  >("/api/v1/agency/finance/summary")
}

export async function getProjectProfitability() {
  return apiRequest<ApiEnvelope<ProjectProfitability[]>>("/api/v1/agency/finance/profitability")
}

export async function listTimeEntries() {
  return apiRequest<ApiEnvelope<TimeEntry[]>>("/api/v1/agency/finance/time")
}

export async function createTimeEntry(body: Partial<TimeEntry>) {
  return apiRequest<ApiEnvelope<TimeEntry>>("/api/v1/agency/finance/time", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateTimeEntry(
  entryId: string,
  body: Partial<Pick<TimeEntry, "hours" | "date" | "note" | "billable" | "rate">>,
) {
  return apiRequest<ApiEnvelope<TimeEntry>>(`/api/v1/agency/finance/time/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deleteTimeEntry(entryId: string) {
  return apiRequest(`/api/v1/agency/finance/time/${entryId}`, { method: "DELETE" })
}

export async function listBudgets() {
  return apiRequest<ApiEnvelope<BudgetRow[]>>("/api/v1/agency/finance/budgets")
}

export async function createBudget(body: CreateBudgetInput) {
  return apiRequest<ApiEnvelope<BudgetRow>>("/api/v1/agency/finance/budgets", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateBudget(budgetId: string, body: Partial<Pick<BudgetRow, "planned" | "contractedMinimum" | "currency">>) {
  return apiRequest<ApiEnvelope<BudgetRow>>(`/api/v1/agency/finance/budgets/${budgetId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function deleteBudget(budgetId: string) {
  return apiRequest(`/api/v1/agency/finance/budgets/${budgetId}`, { method: "DELETE" })
}

export async function getTenant() {
  return apiRequest<ApiEnvelope<Tenant>>("/api/v1/agency/tenant")
}

export async function listBillingPlans() {
  return apiRequest<ApiEnvelope<BillingPlan[]>>("/api/v1/agency/billing/plans")
}

export async function updateBillingPlan(planId: string) {
  return apiRequest<ApiEnvelope<Tenant>>("/api/v1/agency/billing/plan", {
    method: "POST",
    body: JSON.stringify({ planId }),
  })
}

export type AiAction =
  | { type: "create_task"; title: string; projectId?: string; projectName?: string; dueDate?: string; priority?: "low" | "medium" | "high" | "urgent"; description?: string; summary?: string }
  | { type: "create_notification"; title: string; body?: string; href?: string; summary?: string }
  | { type: "create_time_entry"; projectId?: string; projectName?: string; hours: number; date: string; note?: string; billable?: boolean; summary?: string }
  | { type: "create_opportunity"; name: string; clientId?: string; clientName?: string; value?: number; stage?: "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost"; nextStep?: string; notes?: string; summary?: string }
  | { type: "create_incident"; title: string; eventId?: string; eventName?: string; severity?: "critical" | "warning" | "info"; description?: string; summary?: string }
  | { type: "create_approval"; title: string; projectId?: string; projectName?: string; priority?: "low" | "medium" | "high" | "urgent"; notes?: string; summary?: string }
  | { type: "update_task"; taskId: string; title?: string; status?: "todo" | "in_progress" | "review" | "done" | "blocked"; priority?: "low" | "medium" | "high" | "urgent"; dueDate?: string | null; description?: string; summary?: string }
  | { type: "delete_task"; taskId: string; summary?: string }
  | { type: "update_client"; clientId: string; name?: string; stage?: string; health?: string; notes?: string; summary?: string }
  | { type: "delete_client"; clientId: string; summary?: string }
  | { type: "update_vendor"; vendorId: string; name?: string; status?: "preferred" | "active" | "trial" | "inactive"; category?: string; notes?: string; summary?: string }
  | { type: "delete_vendor"; vendorId: string; summary?: string }

export type AiAssistData = {
  reply: string
  provider: string
  proposedAction?: AiAction
  actionResult?: unknown
  links?: { label: string; href: string }[]
}

export type AiRecordSelection = {
  projectId?: string
  projectName?: string
  clientId?: string
  clientName?: string
  campaignId?: string
  campaignName?: string
  eventId?: string
  eventName?: string
  vendorId?: string
  vendorName?: string
  taskId?: string
  taskTitle?: string
}

export async function aiAssist(
  prompt: string,
  context = "general",
  action?: AiAction,
  selection?: AiRecordSelection,
) {
  return apiRequest<ApiEnvelope<AiAssistData>>(
    "/api/v1/agency/ai/assist",
    {
      method: "POST",
      body: JSON.stringify(action ? { prompt, context, action } : { prompt, context, selection }),
    },
  )
}

export type PortalOverviewData = {
  client: {
    id: string
    name: string
    industry?: string
    accountLead?: { name?: string; title?: string; phone?: string }
    agency?: { name?: string; logoUrl?: string }
  }
  stats: {
    activeProjectsCount: number
    pendingApprovalsCount: number
    sharedAssetsCount: number
    upcomingEventsCount: number
  }
  projects: Array<{ id: string; name: string; status: string }>
  campaigns: Array<{ id: string; name: string; status: string }>
  approvals: Array<{ id: string; title: string; status: string }>
  assets: Array<{ id: string; name: string; type: string }>
  upcomingEvents: Array<{ id: string; title: string; startDate: string }>
}

export type DirectReviewData = {
  token: string
  clientId: string
  entityType: string
  entityId: string
  entityTitle: string
  expiresAt: string
}

export async function portalLogin(email: string, password: string) {
  return apiRequest<
    ApiEnvelope<{
      id: string
      email: string
      name: string
      clientId: string
      clientName: string
      role: string
      portalRole?: string
    }> & { token?: string }
  >("/api/v1/portal/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  })
}

export async function validatePortalInviteToken(token: string) {
  return apiRequest<
    ApiEnvelope<{
      valid: boolean
      email: string
      name: string
      clientId: string
      clientName: string
      agencyName?: string
      role?: string
    }>
  >(`/api/v1/portal/validate-token?token=${encodeURIComponent(token)}`, { auth: false })
}

export async function acceptPortalInvite(data: { token: string; password: string; name?: string }) {
  return apiRequest<
    ApiEnvelope<{
      id: string
      email: string
      name: string
      clientId: string
      clientName: string
      role: string
      portalRole?: string
    }> & { token?: string }
  >("/api/v1/portal/accept-invite", {
    method: "POST",
    auth: false,
    body: JSON.stringify(data),
  })
}

export async function getPortalOverview(clientId: string) {
  return apiRequest<ApiEnvelope<PortalOverviewData>>(
    `/api/v1/portal/overview?clientId=${encodeURIComponent(clientId)}`,
    { auth: false, portalAuth: true },
  )
}

export async function getPortalEventRundown(eventId: string, clientId: string) {
  return apiRequest<
    ApiEnvelope<{
      event: { id: string; title: string; startAt?: string; endAt?: string; venue?: string }
      cues: Array<{ id: string; name: string; status: string; scheduledTime: string }>
    }>
  >(`/api/v1/portal/events/${eventId}/rundown?clientId=${encodeURIComponent(clientId)}`, {
    auth: false,
    portalAuth: true,
  })
}

export async function validateDirectReviewToken(token: string) {
  return apiRequest<ApiEnvelope<DirectReviewData>>(`/api/v1/portal/direct-review/${token}`, {
    auth: false,
  })
}

export async function decideDirectReview(token: string, decision: string, notes?: string) {
  return apiRequest(`/api/v1/portal/direct-review/${encodeURIComponent(token)}/decide`, {
    method: "POST",
    auth: false,
    body: JSON.stringify({ decision, notes }),
  })
}

export async function portalApprovals(clientId: string) {
  return apiRequest<ApiEnvelope<unknown[]>>(
    `/api/v1/portal/approvals?clientId=${encodeURIComponent(clientId)}`,
    { auth: false },
  )
}

export async function portalAssets(clientId: string) {
  return apiRequest<ApiEnvelope<unknown[]>>(
    `/api/v1/portal/assets?clientId=${encodeURIComponent(clientId)}`,
    { auth: false },
  )
}

export async function portalDecide(
  approvalId: string,
  decision: string,
  notes?: string,
  signatureSvg?: string,
  clientId?: string,
  portalUserId?: string,
) {
  return apiRequest(`/api/v1/portal/approvals/${approvalId}/decide`, {
    method: "POST",
    auth: false,
    portalAuth: true,
    body: JSON.stringify({ decision, notes, signatureSvg, clientId, portalUserId }),
  })
}

export { checkInCrew, checkOutCrew } from "@/lib/api/agency"
