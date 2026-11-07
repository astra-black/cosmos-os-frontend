import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "@/lib/auth"
import { canAccessRoute } from "@/lib/rbac"
import {
  ActivityPage,
  AiAssistPage,
  AnalyticsPage,
  MonitoringPage,
  ApprovalsPage,
  AssetsPage,
  BillingPage,
  CampaignsPage,
  ClientsPage,
  CrmContactsPage,
  CrmPipelinePage,
  CrewPage,
  CuesPage,
  DashboardPage,
  HubPortalPage,
  HubMembersPage,
  HubReportsPage,
  HubReportFinancialPage,
  HubReportProjectsPage,
  HubSharedRecordsPage,
  HubClientsDirectory,
  HubClientDetailPage,
  HubVendorsDirectory,
  HubVendorDetailPage,
  HubContactsDirectory,
  HubContactDetailPage,
  HubAccountPage,
  HubAccountSecurityPage,
  HubAccountPrivacyPage,
  HubAccountOrganizationsPage,
  HubAccountPreferencesPage,
  HubOrganizationPage,
  HubOrganizationEditPage,
  HubOrganizationPeoplePage,
  HubOrganizationMemberPage,
  HubOrganizationTeamsPage,
  HubOrganizationEditionsPage,
  HubOrganizationUsagePage,
  HubReputationPage,
  HubReputationAnalysisPage,
  HubReputationInboxPage,
  HubReputationFeedbackPage,
  HubReputationRequestsPage,
  HubReputationTestimonialsPage,
  HubReputationSourcesPage,
  HubReputationAutomationPage,
  EventDetailPage,
  EventsPage,
  FinancePage,
  IncidentsPage,
  LoginPage,
  ResetPasswordPage,
  MessagesPage,
  MilestonesPage,
  PortalHomePage,
  PortalLoginPage,
  PortalJoinPage,
  PortalDirectReviewPage,
  PortfolioPage,
  ProjectDetailPage,
  ProjectsPage,
  SchedulePage,
  SettingsPage,
  TasksPage,
  TeamsPage,
  VendorsPage,
  getPortalUser,
  LandingPage,
  AcceptInvitePage,
  StageDisplayPage,
  CrewKioskPage,
  SpatialStagePage,
  VendorQuotePage,
} from "@/pages"

function AccessDenied() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <p className="text-muted-foreground text-sm">You do not have access to this workspace.</p>
    </div>
  )
}

function PortalRoute() {
  return getPortalUser() ? <PortalHomePage /> : <Navigate to="/portal/login" replace />
}

function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  if (!canAccessRoute(user?.role, location.pathname)) {
    return user?.role === "client" ? <Navigate to="/portal/login" replace /> : <AccessDenied />
  }
  return <Outlet />
}

function PublicRoute() {
  const { isAuthenticated } = useAuth()
  if (typeof window === "undefined") return <LandingPage />
  return isAuthenticated ? <Navigate to="/hub" replace /> : <LandingPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route path="/join/:token" element={<AcceptInvitePage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal/join" element={<PortalJoinPage />} />
      <Route path="/portal/review" element={<PortalDirectReviewPage />} />
      <Route path="/portal" element={<PortalRoute />} />
      <Route path="/vendor-portal/quotes/:token" element={<VendorQuotePage />} />

      {/* Public / PIN-Gated Event Desks (auto-bypasses for authenticated staff) */}
      <Route path="events/:eventId/stage" element={<StageDisplayPage />} />
      <Route path="events/:eventId/display" element={<StageDisplayPage />} />
      <Route path="events/:eventId/crew-kiosk" element={<CrewKioskPage />} />
      <Route path="events/:eventId/checkin" element={<CrewKioskPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/hub" replace />} />
          <Route path="hub" element={<HubPortalPage />} />
          <Route path="hub/members" element={<HubMembersPage />} />
          <Route path="hub/reports" element={<HubReportsPage />} />
          <Route path="hub/reports/financial" element={<HubReportFinancialPage />} />
          <Route path="hub/reports/projects" element={<HubReportProjectsPage />} />
          <Route path="hub/records" element={<HubSharedRecordsPage />} />
          <Route path="hub/records/clients" element={<HubClientsDirectory />} />
          <Route path="hub/records/clients/:clientId" element={<HubClientDetailPage />} />
          <Route path="hub/records/vendors" element={<HubVendorsDirectory />} />
          <Route path="hub/records/vendors/:vendorId" element={<HubVendorDetailPage />} />
          <Route path="hub/records/contacts" element={<HubContactsDirectory />} />
          <Route path="hub/records/contacts/:contactId" element={<HubContactDetailPage />} />
          <Route path="hub/account" element={<HubAccountPage />} />
          <Route path="hub/account/security" element={<HubAccountSecurityPage />} />
          <Route path="hub/account/privacy" element={<HubAccountPrivacyPage />} />
          <Route path="hub/account/organizations" element={<HubAccountOrganizationsPage />} />
          <Route path="hub/account/preferences" element={<HubAccountPreferencesPage />} />
          <Route path="hub/organization" element={<HubOrganizationPage />} />
          <Route path="hub/organization/edit" element={<HubOrganizationEditPage />} />
          <Route path="hub/organization/people" element={<HubOrganizationPeoplePage />} />
          <Route path="hub/organization/people/:memberId" element={<HubOrganizationMemberPage />} />
          <Route path="hub/organization/teams" element={<HubOrganizationTeamsPage />} />
          <Route path="hub/organization/editions" element={<HubOrganizationEditionsPage />} />
          <Route path="hub/organization/usage" element={<HubOrganizationUsagePage />} />
          <Route path="hub/reputation" element={<HubReputationPage />} />
          <Route path="hub/reputation/analysis" element={<HubReputationAnalysisPage />} />
          <Route path="hub/reputation/inbox" element={<HubReputationInboxPage />} />
          <Route path="hub/reputation/feedback" element={<HubReputationFeedbackPage />} />
          <Route path="hub/reputation/feedback/:responseId" element={<HubReputationFeedbackPage />} />
          <Route path="hub/reputation/requests" element={<HubReputationRequestsPage />} />
          <Route path="hub/reputation/testimonials" element={<HubReputationTestimonialsPage />} />
          <Route path="hub/reputation/sources" element={<HubReputationSourcesPage />} />
          <Route path="hub/reputation/automation" element={<HubReputationAutomationPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="events/:eventId/finance" element={<EventDetailPage defaultTab="finance" />} />
          <Route path="events/:eventId/spatial-stage" element={<SpatialStagePage />} />
          <Route path="spatial-stage" element={<SpatialStagePage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="crm" element={<CrmPipelinePage />} />
          <Route path="crm/pipeline" element={<CrmPipelinePage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="contacts" element={<CrmContactsPage />} />
          <Route path="contacts/:contactId" element={<CrmContactsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="clients/:clientId" element={<ClientsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="vendors/:vendorId" element={<VendorsPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="ai" element={<AiAssistPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="cues" element={<CuesPage />} />
          <Route path="crew" element={<CrewPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="monitoring" element={<MonitoringPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
