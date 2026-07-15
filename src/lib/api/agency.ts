import { apiRequest } from "@/lib/api/client"
import type {
  ActivityItem,
  AgencyClient,
  ApiEnvelope,
  Approval,
  Asset,
  AuthUser,
  Campaign,
  ClientPortfolio,
  Comment,
  CrmActivity,
  CrmContact,
  CrmSummary,
  CrewMember,
  Opportunity,
  Cue,
  CueTimeline,
  Department,
  Event,
  EventAnalytics,
  Incident,
  IncidentStats,
  MonitoringStats,
  PortfolioClient,
  Project,
  Task,
  TeamMember,
  Vendor,
} from "@/types/agency"

export async function login(email: string, password: string) {
  return apiRequest<
    ApiEnvelope<{
      user: AuthUser
      accessToken: string
      refreshToken: string
    }>
  >("/api/v1/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  })
}

export async function listEvents(params: { page?: number; limit?: number; status?: string } = {}) {
  const query = new URLSearchParams()
  if (params.page != null) query.set("page", String(params.page))
  if (params.limit != null) query.set("limit", String(params.limit))
  if (params.status) query.set("status", params.status)
  const suffix = query.toString() ? `?${query}` : ""
  return apiRequest<ApiEnvelope<Event[]>>(`/api/v1/agency/events${suffix}`)
}

export async function getEvent(eventId: string) {
  return apiRequest<ApiEnvelope<Event>>(`/api/v1/agency/events/${eventId}`)
}

export async function listProjects() {
  return apiRequest<{
    success?: boolean
    message?: string
    data?: Project[]
    projects?: Project[]
    projectsCount?: number
  }>("/api/v1/agency/projects")
}

export async function listAssets(params: { projectId?: string; status?: string; search?: string } = {}) {
  const query = new URLSearchParams()
  if (params.projectId) query.set("projectId", params.projectId)
  if (params.status) query.set("status", params.status)
  if (params.search) query.set("search", params.search)
  const suffix = query.toString() ? `?${query}` : ""
  return apiRequest<{
    success?: boolean
    message?: string
    data?: Asset[]
    assets?: Asset[]
    assetsCount?: number
  }>(`/api/v1/agency/assets${suffix}`, { apiKey: true })
}

export async function listPortfolioClients() {
  return apiRequest<ApiEnvelope<PortfolioClient[]>>("/api/v1/agency/portfolio", {
    apiKey: true,
  })
}

export async function getClientPortfolio(clientId: string) {
  return apiRequest<ApiEnvelope<ClientPortfolio>>(`/api/v1/agency/portfolio/${clientId}`, {
    apiKey: true,
  })
}

export async function getIncidentStats(eventId: string) {
  return apiRequest<ApiEnvelope<IncidentStats>>(
    `/api/v1/agency/incidents/events/${eventId}/incidents/stats`,
  )
}

export async function listIncidents(eventId: string) {
  return apiRequest<ApiEnvelope<Incident[]>>(
    `/api/v1/agency/incidents/events/${eventId}/incidents`,
  )
}

export async function resolveIncident(
  incidentId: string,
  resolution: string,
  eventId?: string,
) {
  return apiRequest<ApiEnvelope<Incident>>(
    `/api/v1/agency/incidents/incidents/${incidentId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ resolution, eventId }),
    },
  )
}

export async function escalateIncident(incidentId: string, eventId?: string) {
  return apiRequest<ApiEnvelope<Incident>>(
    `/api/v1/agency/incidents/incidents/${incidentId}/escalate`,
    {
      method: "POST",
      body: JSON.stringify({ eventId }),
    },
  )
}

export async function reopenIncident(incidentId: string, eventId?: string) {
  return apiRequest<ApiEnvelope<Incident>>(
    `/api/v1/agency/incidents/incidents/${incidentId}/reopen`,
    {
      method: "POST",
      body: JSON.stringify({ eventId }),
    },
  )
}

export async function createIncident(
  eventId: string,
  body: {
    title: string
    description?: string
    severity?: string
    category?: string
    location?: string
  },
) {
  return apiRequest<ApiEnvelope<Incident>>(
    `/api/v1/agency/incidents/events/${eventId}/incidents`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  )
}

export async function listCues(eventId: string) {
  return apiRequest<ApiEnvelope<Cue[]>>(`/api/v1/agency/cues/events/${eventId}/cues`)
}

export async function getCueTimeline(eventId: string) {
  return apiRequest<ApiEnvelope<CueTimeline>>(
    `/api/v1/agency/cues/events/${eventId}/cues/timeline`,
  )
}

export async function startCue(eventId: string, cueId: string) {
  return apiRequest<ApiEnvelope<Cue>>(
    `/api/v1/agency/cues/events/${eventId}/cues/${cueId}/start`,
    { method: "POST" },
  )
}

export async function completeCue(eventId: string, cueId: string) {
  return apiRequest<ApiEnvelope<Cue>>(
    `/api/v1/agency/cues/events/${eventId}/cues/${cueId}/complete`,
    { method: "POST" },
  )
}

export async function skipCue(eventId: string, cueId: string) {
  return apiRequest<ApiEnvelope<Cue>>(
    `/api/v1/agency/cues/events/${eventId}/cues/${cueId}/skip`,
    { method: "POST" },
  )
}

export async function resetCue(eventId: string, cueId: string) {
  return apiRequest<ApiEnvelope<Cue>>(
    `/api/v1/agency/cues/events/${eventId}/cues/${cueId}/reset`,
    { method: "POST" },
  )
}

export async function advanceCues(eventId: string) {
  return apiRequest<
    ApiEnvelope<{ completed: Cue | null; started: Cue | null; cues: Cue[] }>
  >(`/api/v1/agency/cues/events/${eventId}/cues/advance`, { method: "POST" })
}

export async function createCue(
  eventId: string,
  body: {
    name: string
    description?: string
    scheduledTime?: string
    duration?: number
    priority?: string
    location?: string
    departmentName?: string
  },
) {
  return apiRequest<ApiEnvelope<Cue>>(`/api/v1/agency/cues/events/${eventId}/cues`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function listCrew(eventId: string) {
  return apiRequest<ApiEnvelope<CrewMember[]>>(
    `/api/v1/agency/departments/events/${eventId}/crew`,
  )
}

export async function updateCrewStatus(
  crewId: string,
  status: string,
  eventId?: string,
) {
  return apiRequest<ApiEnvelope<CrewMember>>(
    `/api/v1/agency/departments/crew/${crewId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, eventId }),
    },
  )
}

export async function listDepartments(eventId: string) {
  return apiRequest<ApiEnvelope<Department[]>>(
    `/api/v1/agency/departments/events/${eventId}/departments`,
  )
}

export async function getEventAnalytics(eventId: string) {
  return apiRequest<ApiEnvelope<EventAnalytics>>(
    `/api/v1/agency/analytics/events/${eventId}/analytics`,
  )
}

export async function getMonitoringStats() {
  return apiRequest<MonitoringStats | ApiEnvelope<MonitoringStats> | { stats?: MonitoringStats }>(
    "/api/v1/agency/monitoring/stats",
  )
}

export async function getHealth() {
  return apiRequest<{
    status: string
    monitoring?: MonitoringStats
    environment?: string
    version?: string
  }>("/health", { auth: false })
}

// —— Agency delivery ——
export async function listClients() {
  return apiRequest<ApiEnvelope<AgencyClient[]>>("/api/v1/agency/clients")
}

export async function createClient(body: Partial<AgencyClient>) {
  return apiRequest<ApiEnvelope<AgencyClient>>("/api/v1/agency/clients", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateClient(clientId: string, body: Partial<AgencyClient>) {
  return apiRequest<ApiEnvelope<AgencyClient>>(`/api/v1/agency/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function listCampaigns() {
  return apiRequest<ApiEnvelope<Campaign[]>>("/api/v1/agency/campaigns")
}

export async function listTasks(params: { status?: string; projectId?: string } = {}) {
  const q = new URLSearchParams()
  if (params.status) q.set("status", params.status)
  if (params.projectId) q.set("projectId", params.projectId)
  const suffix = q.toString() ? `?${q}` : ""
  return apiRequest<ApiEnvelope<Task[]>>(`/api/v1/agency/tasks${suffix}`)
}

export async function updateTask(taskId: string, body: Partial<Task>) {
  return apiRequest<ApiEnvelope<Task>>(`/api/v1/agency/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function createTask(body: Partial<Task>) {
  return apiRequest<ApiEnvelope<Task>>("/api/v1/agency/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function listVendors(params: { category?: string; status?: string } = {}) {
  const q = new URLSearchParams()
  if (params.category) q.set("category", params.category)
  if (params.status) q.set("status", params.status)
  const suffix = q.toString() ? `?${q}` : ""
  return apiRequest<ApiEnvelope<Vendor[]>>(`/api/v1/agency/vendors${suffix}`)
}

export async function updateVendor(vendorId: string, body: Partial<Vendor>) {
  return apiRequest<ApiEnvelope<Vendor>>(`/api/v1/agency/vendors/${vendorId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function createVendor(body: Partial<Vendor>) {
  return apiRequest<ApiEnvelope<Vendor>>("/api/v1/agency/vendors", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function listApprovals(params: { status?: string } = {}) {
  const q = new URLSearchParams()
  if (params.status) q.set("status", params.status)
  const suffix = q.toString() ? `?${q}` : ""
  return apiRequest<ApiEnvelope<Approval[]>>(`/api/v1/agency/approvals${suffix}`)
}

export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected" | "changes_requested",
  notes?: string,
) {
  return apiRequest<ApiEnvelope<Approval>>(`/api/v1/agency/approvals/${approvalId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision, notes }),
  })
}

export async function listActivity(limit = 50) {
  return apiRequest<ApiEnvelope<ActivityItem[]>>(`/api/v1/agency/activity?limit=${limit}`)
}

export async function listTeamMembers() {
  return apiRequest<ApiEnvelope<TeamMember[]>>("/api/v1/agency/teams/members")
}

export async function updateTeamMember(memberId: string, body: Partial<TeamMember>) {
  return apiRequest<ApiEnvelope<TeamMember>>(`/api/v1/agency/teams/members/${memberId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

export async function listComments(entityType?: string, entityId?: string) {
  const q = new URLSearchParams()
  if (entityType) q.set("entityType", entityType)
  if (entityId) q.set("entityId", entityId)
  const suffix = q.toString() ? `?${q}` : ""
  return apiRequest<ApiEnvelope<Comment[]>>(`/api/v1/agency/comments${suffix}`)
}

export async function createComment(body: {
  entityType: string
  entityId: string
  author?: string
  body: string
}) {
  return apiRequest<ApiEnvelope<Comment>>("/api/v1/agency/comments", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function createEvent(body: Partial<Event>) {
  return apiRequest<ApiEnvelope<Event>>("/api/v1/agency/events", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// —— CRM ——
export async function getCrmSummary() {
  return apiRequest<ApiEnvelope<CrmSummary>>("/api/v1/agency/crm/summary")
}

export async function listOpportunities(params: {
  stage?: string
  clientId?: string
  owner?: string
} = {}) {
  const q = new URLSearchParams()
  if (params.stage) q.set("stage", params.stage)
  if (params.clientId) q.set("clientId", params.clientId)
  if (params.owner) q.set("owner", params.owner)
  const suffix = q.toString() ? `?${q}` : ""
  return apiRequest<ApiEnvelope<Opportunity[]>>(`/api/v1/agency/crm/opportunities${suffix}`)
}

export async function createOpportunity(body: Partial<Opportunity>) {
  return apiRequest<ApiEnvelope<Opportunity>>("/api/v1/agency/crm/opportunities", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function updateOpportunity(opportunityId: string, body: Partial<Opportunity>) {
  return apiRequest<ApiEnvelope<Opportunity>>(
    `/api/v1/agency/crm/opportunities/${opportunityId}`,
    { method: "PATCH", body: JSON.stringify(body) },
  )
}

export async function listCrmContacts(params: { clientId?: string; search?: string } = {}) {
  const q = new URLSearchParams()
  if (params.clientId) q.set("clientId", params.clientId)
  if (params.search) q.set("search", params.search)
  const suffix = q.toString() ? `?${q}` : ""
  return apiRequest<ApiEnvelope<CrmContact[]>>(`/api/v1/agency/crm/contacts${suffix}`)
}

export async function createCrmContact(body: Partial<CrmContact>) {
  return apiRequest<ApiEnvelope<CrmContact>>("/api/v1/agency/crm/contacts", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function listCrmActivities(params: {
  clientId?: string
  opportunityId?: string
} = {}) {
  const q = new URLSearchParams()
  if (params.clientId) q.set("clientId", params.clientId)
  if (params.opportunityId) q.set("opportunityId", params.opportunityId)
  const suffix = q.toString() ? `?${q}` : ""
  return apiRequest<ApiEnvelope<CrmActivity[]>>(`/api/v1/agency/crm/activities${suffix}`)
}

export async function createCrmActivity(body: Partial<CrmActivity>) {
  return apiRequest<ApiEnvelope<CrmActivity>>("/api/v1/agency/crm/activities", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function normalizeProjects(payload: Awaited<ReturnType<typeof listProjects>>): Project[] {
  if (Array.isArray(payload.projects)) return payload.projects
  if (Array.isArray(payload.data)) return payload.data
  return []
}

export function normalizeAssets(payload: Awaited<ReturnType<typeof listAssets>>): Asset[] {
  if (Array.isArray(payload.assets)) return payload.assets
  if (Array.isArray(payload.data)) return payload.data
  return []
}

export function normalizeMonitoringStats(
  payload: Awaited<ReturnType<typeof getMonitoringStats>>,
): MonitoringStats | null {
  if (!payload || typeof payload !== "object") return null
  if ("stats" in payload && payload.stats && typeof payload.stats === "object") {
    return payload.stats as MonitoringStats
  }
  if ("data" in payload && payload.data) {
    return payload.data as MonitoringStats
  }
  if ("enabled" in payload) {
    return payload as MonitoringStats
  }
  return null
}
