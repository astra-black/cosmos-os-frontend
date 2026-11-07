export type ApiEnvelope<T> = {
  success: boolean
  data: T
  count?: number
  message?: string
  error?: string
  timestamp?: string
  privatePhoneAccess?: boolean
  financeAccess?: boolean
}

export type AuthUser = {
  id: string
  userId?: string
  email: string
  name: string
  role: string
  title?: string | null
  phone?: string | null
  jobFunction?: string | null
  permissionRole?: string | null
  onboardingCompletedAt?: string | null
  photoUrl?: string
  avatarUrl?: string
  agencyId?: string
  agencyName?: string
  agencySlug?: string
  createdAt?: string
}

export type EventStatus =
  | "draft"
  | "planning"
  | "confirmed"
  | "live"
  | "completed"
  | "cancelled"

export type Event = {
  id: string
  eventId: string
  name: string
  type: string
  status: EventStatus
  startDate: string
  endDate: string
  location: string
  venue?: string
  description?: string
  organizerId?: string
  expectedAttendees?: number
  budget?: number
  actualCost?: number
  clientId?: string | null
  clientVisible?: boolean
  metadata?: Record<string, any>
  createdAt?: string
  updatedAt?: string
}

export type Project = {
  recordId?: string
  projectId: string
  projectName: string
  clientId?: string | null
  clientName?: string | null
  campaignId?: string | null
  status: string
  startDate?: string | null
  endDate?: string | null
  weight?: number
  assets?: string[]
  budget?: number
  description?: string
  clientVisible?: boolean
  createdAt?: string
  updatedAt?: string
}

export type Asset = {
  recordId?: string
  assetId: string
  assetName: string
  projectId?: string | null
  projectName?: string | null
  fileType?: string
  fileSize?: number
  version?: string
  status?: string
  tags?: string[]
  /** Public path or URL for downloaded file (local uploads: /uploads/...) */
  fileUrl?: string | null
  originalFileName?: string | null
  createdAt?: string
  updatedAt?: string
  /** Agency-controlled: whether this asset is visible in the client portal */
  clientVisible?: boolean
  clientId?: string | null
}

export type PortfolioClient = {
  clientId: string
  name: string
  industry?: string
  status?: string
  accountLead?: string
  projectsCount?: number
  assetsCount?: number
  health?: string
}

export type ClientPortfolio = {
  clientId: string
  clientName: string
  industry?: string
  accountLead?: string
  health?: string
  notes?: string
  summary: {
    activeProjects: number
    totalProjects: number
    totalBudget: number
    spentBudget?: number
    assetsDelivered: number
    healthScore: number
  }
  projects: Array<{
    projectId: string
    projectName: string
    status: string
    budget?: number
    spent?: number
    weight?: number
  }>
}

export type IncidentStats = {
  total: number
  byStatus: {
    open: number
    inProgress: number
    resolved: number
    escalated: number
  }
  bySeverity: {
    critical: number
    warning: number
    info: number
  }
  averageResolutionTime: number
  resolutionRate: string | number
}

export type EventAnalytics = {
  event: {
    id: string
    name: string
    type: string
    status: string
    startDate: string
    endDate: string
    budget?: number
    expectedAttendees?: number
  }
  cues: {
    total: number
    completed: number
    inProgress: number
    pending: number
    completionRate: string | number
  }
  crew: {
    total: number
    confirmed: number
    onSite: number
    complete: number
  }
  incidents: {
    total: number
    critical: number
    warning: number
    info: number
    resolved: number
    open: number
  }
  overall: {
    totalActivities: number
    healthScore: number
    onTrack: boolean
  }
}

export type MonitoringStats = {
  enabled: boolean
  activeAlerts: number
  totalAlerts: number
  criticalAlerts: number
  highAlerts: number
  mediumAlerts: number
  lowAlerts: number
}

export type Cue = {
  id?: string
  cueId: string
  eventId: string
  name?: string
  title?: string
  status: string
  priority?: string
  departmentId?: string
  departmentName?: string
  scheduledTime?: string
  duration?: number
  startTime?: string
  endTime?: string
  actualStartTime?: string
  actualEndTime?: string
  description?: string
  location?: string
  assignedTo?: string
  /** Agency-controlled: whether this cue is visible in the client portal rundown */
  clientVisible?: boolean
  clientId?: string | null
}

export type CueTimeline = {
  cues: Cue[]
  statistics: {
    total: number
    completed: number
    inProgress: number
    pending: number
    overdue: number
    completionRate: string | number
  }
}

export type Incident = {
  id?: string
  incidentId: string
  eventId: string
  title?: string
  description?: string
  severity: string
  status: string
  category?: string
  departmentId?: string
  departmentName?: string
  reportedBy?: string
  assignedTo?: string
  reportedAt?: string
  resolvedAt?: string
  resolution?: string
  location?: string
  costImpact?: number
  metadata?: {
    costImpact?: number
    [key: string]: any
  }
  createdAt?: string
  updatedAt?: string
}

export type CrewMember = {
  id?: string
  crewId: string
  eventId: string
  name?: string
  role?: string
  status: string
  departmentId?: string
  departmentName?: string
  email?: string
  phone?: string
  notes?: string
  assignedAt?: string
  confirmedAt?: string
  onSiteAt?: string
  completedAt?: string
}

export type Department = {
  id?: string
  departmentId: string
  eventId: string
  name: string
  description?: string
  color?: string
  headOfDepartment?: string
  contactEmail?: string
  contactPhone?: string
  status: string
  crewCount?: number
}

/** Agency delivery CRM client (fuller than portfolio summary) */
export type AgencyClient = {
  clientId: string
  name: string
  industry?: string
  stage: string
  accountLead?: string
  primaryContact?: string
  email?: string
  phone?: string
  health?: string
  arr?: number
  tags?: string[]
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export type CampaignStatus = "planning" | "active" | "completed" | "on_hold"

export type Campaign = {
  campaignId: string
  name: string
  clientId: string | null
  clientName?: string
  status: CampaignStatus
  startDate?: string | null
  endDate?: string | null
  budget?: number
  projectIds?: string[]
  objective?: string
  owner?: string
}

export type Task = {
  taskId: string
  title: string
  description?: string
  projectId?: string | null
  projectName?: string | null
  campaignId?: string | null
  assignee?: string
  assigneeMemberId?: string | null
  status: string
  priority: string
  dueDate?: string | null
  estimateHours?: number
  tags?: string[]
  dependencyIds?: string[]
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly"
    interval: number
    startDate: string
    endDate?: string | null
    byWeekday?: number
    dayOfMonth?: number
    maxOccurrences?: number
  } | null
}

export type MilestoneStatus = "upcoming" | "done" | "missed"

export type Milestone = {
  recordId?: string
  milestoneId: string
  name: string
  dueDate: string
  status: MilestoneStatus
  notes?: string
  projectId?: string | null
  project?: string | string[] | null
  /** Agency-controlled: whether this milestone is visible in the client portal */
  clientVisible?: boolean
  clientId?: string | null
}

export type Vendor = {
  vendorId: string
  name: string
  category: string
  status: string
  contact?: string
  email?: string
  rateCard?: string
  rating?: number
  regions?: string[]
  skills?: string[]
  notes?: string
  scorecard?: Partial<{
    quality: number | null
    onTimeDelivery: number | null
    budgetAccuracy: number | null
    communication: number | null
  }>
  projects?: Array<{
    projectId: string
    name: string
    clientName: string
    status: string
    startDate: string | null
    endDate: string | null
    contractAmount: number | null
  }>
  totalContracted?: number
  financeAccess?: boolean
  quotes?: VendorQuote[]
}

export type VendorQuote = {
  quoteId: string
  projectId: string
  projectName: string
  title: string
  request: string
  status: string
  dueAt: string | null
  createdAt: string | null
  response?: string
  amount?: number | null
  currency?: string
  shares: Array<{ shareId: string; expiresAt: string; revokedAt: string | null; createdAt: string }>
}

export type VendorSharedQuote = {
  quoteId: string
  title: string
  request: string
  projectName: string
  vendorName: string
  agencyName: string
  dueAt: string | null
  status: string
  expiresAt: string
}

export type ApprovalAssetFile = {
  fileId?: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  size?: number | null
}

export type Approval = {
  approvalId: string
  title: string
  entityType: string
  entityId: string
  assetId?: string
  assetName?: string
  assetFileType?: string
  assetUrl?: string
  assetVersion?: string
  assetStatus?: string
  assetFiles?: ApprovalAssetFile[]
  projectId?: string
  projectName?: string | null
  clientId?: string
  clientName?: string | null
  requester?: string
  reviewer?: string
  status: string
  priority?: string
  dueDate?: string
  notes?: string
  decidedAt?: string
  createdAt?: string
  /** Agency-controlled: whether this approval is visible in the client portal */
  clientVisible?: boolean
}

export type ActivityItem = {
  activityId: string
  type: string
  title: string
  body?: string
  actor?: string
  entityType?: string
  entityId?: string
  createdAt: string
}

/** Safe projection from GET /api/v1/agency/projects/:projectId/activity */
export type ProjectActivityItem = {
  id: string
  timestamp: string
  actor: string
  entityType: string
  entityId: string
  action: string
  summary: string
}

export type ProjectActivityResponse = {
  success: boolean
  projectId: string
  items: ProjectActivityItem[]
  nextCursor: string | null
  hasMore: boolean
  count: number
  error?: string
}

export type TeamMember = {
  memberId: string
  name: string
  email: string
  role: string
  jobFunction?: string | null
  permissionRole?: string | null
  title?: string
  team?: string
  phone?: string | null
  status: string
  createdAt?: string | null
  updatedAt?: string | null
}

export type AgencyInvitation = {
  id: string
  email?: string | null
  jobFunction: string
  permissionRole: string
  status: string
  expiresAt: string
  acceptedAt?: string | null
  createdAt?: string
  invitedBy?: string | null
  agencyName?: string | null
}

export type Comment = {
  commentId: string
  entityType: string
  entityId: string
  author: string
  body: string
  createdAt: string
}

export type CrmContact = {
  contactId: string
  clientId?: string | null
  clientName?: string
  name: string
  title?: string
  email?: string
  phone?: string
  role?: string
  isPrimary?: boolean
  contactDetails?: {
    department?: string
    seniority?: string
    city?: string
    state?: string
    country?: string
    linkedinUrl?: string
    twitterUrl?: string
  }
  portalSharedFields?: string[]
  privatePhoneAccess?: boolean
  projects?: Array<{
    projectId: string
    projectName: string
    clientName: string
    projectStatus: string
    role: string
    notes: string
  }>
}

export type OpportunityStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"

export type Opportunity = {
  opportunityId: string
  name: string
  clientId?: string | null
  clientName?: string
  clientIndustry?: string | null
  clientNotes?: string | null
  clientPhone?: string | null
  clientEmail?: string | null
  contactId?: string | null
  contactName?: string | null
  contactTitle?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  primaryContact?: {
    id: string
    name: string
    title?: string
    email?: string
    phone?: string
    emailStatus?: string
    linkedinUrl?: string
    twitterUrl?: string
    department?: string
    seniority?: string
    country?: string
    state?: string
    city?: string
    apolloId?: string
  } | null
  stage: OpportunityStage | string
  value: number
  probability: number
  owner?: string
  source?: string
  expectedClose?: string | null
  nextStep?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
  enrichment?: {
    email: boolean
    phone: boolean
    linkedin: boolean
    emailStatus?: string | null
    matchConfidence?: string | null
    requestId?: string | number | null
    phonePending?: boolean
    message: string
  }
}

export type CrmActivity = {
  crmActivityId: string
  clientId?: string | null
  opportunityId?: string | null
  type: string
  subject: string
  body?: string
  actor?: string
  at: string
}

export type CrmSummary = {
  accounts: number
  contacts: number
  openDeals: number
  pipelineValue: number
  weightedPipeline: number
  wonValue: number
  wonCount: number
}

/** Workspace messaging (00.10 · Messages). Separate from entity Comment. */
/** Producer Dashboard customize layout (00.10 · 55–58). */
export type DashboardWidgetId =
  | "kpi_active_projects"
  | "kpi_decisions"
  | "kpi_unread"
  | "kpi_portfolio_budget"
  | "projects"
  | "needs_you"
  | "spend_vs_plan"
  | "milestones"
  | "crew_attendance"
  | "unread_conversations"
  | "reviews_waiting"
  | "recent_feedback"
  | "invoices_over_time"
  | string

export type DashboardWidgetCatalogItem = {
  id: DashboardWidgetId
  label: string
  description: string
  access: "finance" | "reputation" | null
  locked: boolean
  dataAvailable: boolean
  addNeverGrantsAccess?: boolean
}

export type DashboardLayout = {
  version: number
  mode: "default" | "custom"
  widgets: DashboardWidgetId[]
  updatedAt?: string | null
  catalog?: DashboardWidgetCatalogItem[]
  defaults?: DashboardWidgetId[]
  persisted?: string
}

export type ConversationAudience = "INTERNAL" | "CLIENT" | "VENDOR" | "ANNOUNCEMENTS"
export type ConversationKind = "CHANNEL" | "DIRECT"

export type ConversationMemberSummary = {
  memberId: string
  name: string
  title?: string | null
  role?: string
  lastReadAt?: string | null
}

export type ConversationSummary = {
  conversationId: string
  kind: ConversationKind
  name: string
  slug: string
  displayName: string
  audience: ConversationAudience
  audienceLabel: string
  projectId?: string | null
  projectName?: string | null
  clientName?: string | null
  memberCount?: number | null
  unreadCount: number
  myRole?: string | null
  createdAt?: string
  updatedAt?: string
  members?: ConversationMemberSummary[]
  externalMembershipSupported?: boolean
  externalMembershipBlocker?: string
}

export type ConversationListPayload = {
  conversations: ConversationSummary[]
  groups: Record<string, ConversationSummary[]>
  viewer?: ConversationMemberSummary | null
}

export type ConversationMessage = {
  messageId: string
  conversationId: string
  body: string
  deleted?: boolean
  author: ConversationMemberSummary | null
  mentionMemberIds: string[]
  parentMessageId?: string | null
  replyCount: number
  createdTaskId?: string | null
  createdAt: string
  editedAt?: string | null
}

export type ConversationMessagesPage = {
  items: ConversationMessage[]
  nextCursor: string | null
  hasMore: boolean
  limit: number
}

export type RestrictedMention = {
  memberId: string
  name: string
  reason: string
  message: string
}

export type PostMessageResult = {
  message: ConversationMessage
  restrictedMentions: RestrictedMention[]
}
