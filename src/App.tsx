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
  EventDetailPage,
  EventsPage,
  FinancePage,
  IncidentsPage,
  LoginPage,
  MilestonesPage,
  PortalHomePage,
  PortalLoginPage,
  PortfolioPage,
  ProjectDetailPage,
  ProjectsPage,
  SettingsPage,
  TasksPage,
  TeamsPage,
  VendorsPage,
  getPortalUser,
  LandingPage
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
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!canAccessRoute(user?.role, location.pathname)) {
    return user?.role === "client" ? <Navigate to="/portal/login" replace /> : <AccessDenied />
  }
  return <Outlet />
}

function PublicRoute() {
  const { isAuthenticated } = useAuth()
  if (typeof window === "undefined") return <LandingPage />
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal" element={<PortalRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
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
