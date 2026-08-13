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
  planned: number
  spent: number
  remaining: number
  utilization: number
  currency: string
}

export type CreateBudgetInput = {
  projectId: string
  projectName?: string
  planned: number
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

export async function updateBudget(budgetId: string, body: Partial<Pick<BudgetRow, "planned" | "currency">>) {
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

export async function aiAssist(prompt: string, context = "general") {
  return apiRequest<ApiEnvelope<{ reply: string; provider: string }>>(
    "/api/v1/agency/ai/assist",
    {
      method: "POST",
      body: JSON.stringify({ prompt, context }),
    },
  )
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
    }>
  >("/api/v1/portal/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
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
) {
  return apiRequest(`/api/v1/portal/approvals/${approvalId}/decide`, {
    method: "POST",
    auth: false,
    body: JSON.stringify({ decision, notes }),
  })
}
