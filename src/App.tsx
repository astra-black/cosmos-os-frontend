import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/app-shell"
import { useAuth } from "@/lib/auth"
import { canAccessRoute } from "@/lib/rbac"
import { ActivityPage } from "@/pages/activity-page"
import { AiAssistPage } from "@/pages/ai-assist-page"
import { AnalyticsPage } from "@/pages/analytics-page"
import { MonitoringPage } from "@/pages/monitoring-page"
import { ApprovalsPage } from "@/pages/approvals-page"
import { AssetsPage } from "@/pages/assets-page"
import { BillingPage } from "@/pages/billing-page"
import { CampaignsPage } from "@/pages/campaigns-page"
import { ClientsPage } from "@/pages/clients-page"
import { CrmContactsPage } from "@/pages/crm-contacts-page"
import { CrmPipelinePage } from "@/pages/crm-pipeline-page"
import { CrewPage } from "@/pages/crew-page"
import { CuesPage } from "@/pages/cues-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { EventDetailPage } from "@/pages/event-detail-page"
import { EventsPage } from "@/pages/events-page"
import { FinancePage } from "@/pages/finance-page"
import { IncidentsPage } from "@/pages/incidents-page"
import { LoginPage } from "@/pages/login-page"
import { MilestonesPage } from "@/pages/milestones-page"
import { PortalHomePage } from "@/pages/portal-home-page"
import { PortalLoginPage } from "@/pages/portal-login-page"
import { PortfolioPage } from "@/pages/portfolio-page"
import { ProjectDetailPage } from "@/pages/project-detail-page"
import { ProjectsPage } from "@/pages/projects-page"
import { SettingsPage } from "@/pages/settings-page"
import { TasksPage } from "@/pages/tasks-page"
import { TeamsPage } from "@/pages/teams-page"
import { VendorsPage } from "@/pages/vendors-page"
import { getPortalUser } from "@/pages/portal-login-page"

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
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!canAccessRoute(user?.role, location.pathname)) {
    return user?.role === "client" ? <Navigate to="/portal/login" replace /> : <AccessDenied />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal" element={<PortalRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:eventId" element={<EventDetailPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="crm" element={<CrmPipelinePage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="contacts" element={<CrmContactsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="clients/:clientId" element={<ClientsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="vendors" element={<VendorsPage />} />
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
