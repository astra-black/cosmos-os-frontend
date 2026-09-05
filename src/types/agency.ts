export type ApiEnvelope<T> = {
  success: boolean
  data: T
  count?: number
  message?: string
  error?: string
  timestamp?: string
}

export type AuthUser = {
  id: string
  email: string
  name: string
  role: string
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
  status: string
  priority: string
  dueDate?: string | null
  estimateHours?: number
  tags?: string[]
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
}

export type Approval = {
  approvalId: string
  title: string
  entityType: string
  entityId: string
  projectId?: string
  clientId?: string
  requester?: string
  reviewer?: string
  status: string
  priority?: string
  dueDate?: string
  notes?: string
  decidedAt?: string
  createdAt?: string
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

export type TeamMember = {
  memberId: string
  name: string
  email: string
  role: string
  title?: string
  team?: string
  status: string
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
  contactId?: string | null
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
