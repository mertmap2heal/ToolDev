import { BrowserRouter } from 'react-router-dom'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import LandingOrApp from './components/LandingOrApp'
import LoginPage from './pages/Login/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import RequirementsPage from './pages/Requirements/RequirementsPage'
import RequirementsSettingsPage from './pages/Requirements/RequirementsSettingsPage'
import RequirementsDashboardPage from './pages/Requirements/RequirementsDashboardPage'
import SystemFunctionsPage from './pages/SystemFunctions/SystemFunctionsPage'
import ArchitecturePage from './pages/Architecture/ArchitecturePage'
import VerificationLayoutPage from './pages/Verification/VerificationLayoutPage'
import VerificationPage from './pages/Verification/VerificationPage'
import VerificationReportPage from './pages/Verification/VerificationReportPage'
import VerificationSettingsPage from './pages/Verification/VerificationSettingsPage'
import TemplatesLandingPage from './pages/Verification/TemplatesLandingPage'
import TemplateEditorPage from './pages/Verification/TemplateEditorPage'
import DocumentationPage from './pages/Documentation/DocumentationPage'
import ProjectLandingPage from './pages/ProjectLanding/ProjectLandingPage'
import StakeholderPage from './pages/Stakeholder/StakeholderPage'
import PBSPage from './modules/pbs/PBSPage'
import MBSEModelsPage from './pages/MBSEModels/MBSEModelsPage'
import ReportsPage from './pages/Reports/ReportsPage'
import IssueDashboard from './features/issues/pages/IssueDashboard'
import IssueDetailPage from './pages/Issues/IssueDetailPage'
import IssuesPage from './pages/Issues/IssuesPage'
import ParametersPage from './pages/Parameters/ParametersPage'
import ParameterSettingsPage from './pages/Parameters/ParameterSettingsPage'
import ChangeRequestsPage from './pages/ChangeRequests/ChangeRequestsPage'
import TasksPage from './pages/Tasks/TasksPage'
import TasksDashboardPage from './pages/Tasks/Dashboard/TasksDashboardPage'
import MyTasksPage from './pages/Tasks/MyTasks/MyTasksPage'
import TasksReportsPage from './pages/Tasks/Reports/TasksReportsPage'
import TaskTemplatesPage from './pages/Tasks/Templates/TaskTemplatesPage'
import TaskWorkflowsPage from './pages/Tasks/Workflows/TaskWorkflowsPage'
import TimeTrackingPage from './pages/Tasks/TimeTracking/TimeTrackingPage'
import TaskNotificationsPage from './pages/Tasks/Notifications/TaskNotificationsPage'
import TaskSettingsPage from './pages/Tasks/Settings/TaskSettingsPage'
import LifecycleManagementPage from './pages/LifecycleManagement/LifecycleManagementPage'
import ComplianceCheckPage from './pages/ComplianceCheck/ComplianceCheckPage'
import CertificationPage from './pages/Certification/CertificationPage'
import ValidationPage from './pages/Validation/ValidationPage'
import RiskManagementPage from './pages/RiskManagement/RiskManagementPage'
import InterfaceManagementPage from './pages/InterfaceManagement/InterfaceManagementPage'
import ConfigurationManagementPage from './pages/ConfigurationManagement/ConfigurationManagementPage'
import ArchivePage from './pages/Archive/ArchivePage'
import LifecycleStatusPage from './pages/LifecycleStatus/LifecycleStatusPage'
import SafetyLayoutPage from './pages/Safety/SafetyLayoutPage'
import SafetyOverviewPage from './pages/Safety/SafetyOverviewPage'
import HazardsPage from './pages/Safety/HazardsPage'
import SafetyAnalysesLandingPage from './pages/Safety/SafetyAnalysesLandingPage'
import AnalysisListPage from './pages/Safety/AnalysisListPage'
import CreateAnalysisWizardPage from './pages/Safety/CreateAnalysisWizardPage'
import EditAnalysisWizardPage from './pages/Safety/EditAnalysisWizardPage'
import FTAVisualPage from './pages/Safety/FTAVisualPage'
import TraceabilityPage from './pages/Safety/TraceabilityPage'
import ImpactAssessmentPage from './pages/Safety/ImpactAssessmentPage'
import LibrariesPage from './pages/Safety/LibrariesPage'
import ReviewsPage from './pages/Safety/ReviewsPage'
import AuditLogPage from './pages/Safety/AuditLogPage'
import ExportsPage from './pages/Safety/ExportsPage'
import SafetySettingsPage from './pages/Safety/SafetySettingsPage'
import MarkovPage from './pages/Safety/MarkovPage'
import ItemsPage from './pages/Inventory/Items/ItemsPage'
import WarehousesPage from './pages/Inventory/Warehouses/WarehousesPage'
import PurchasingPage from './pages/Inventory/Purchasing/PurchasingPage'
import SalesPage from './pages/Inventory/Sales/SalesPage'
import OperationsPage from './pages/Inventory/Operations/OperationsPage'
import InventoryReportsPage from './pages/Inventory/Reports/ReportsPage'
import InventoryDashboardPage from './pages/Inventory/Dashboard/DashboardPage'
import AdminRouteGuard from './components/admin/AdminRouteGuard'
import AdminPage from './pages/Admin/AdminPage'
import PlatformAdminRouteGuard from './components/platform-admin/PlatformAdminRouteGuard'
import PlatformAdminLayout from './components/platform-admin/PlatformAdminLayout'
import PlatformAdminPage from './pages/PlatformAdmin/PlatformAdminPage'
import CompaniesPage from './pages/PlatformAdmin/CompaniesPage'
import CreateCompanyAdminPage from './pages/PlatformAdmin/CreateCompanyAdminPage'
import CompanyLimitsPage from './pages/PlatformAdmin/CompanyLimitsPage'
import AuditLogsPage from './pages/PlatformAdmin/AuditLogsPage'
import DataFlowAdminPanel from './pages/PlatformAdmin/DataFlowAdminPanel'
import OrganizationPage from './pages/Organization/OrganizationPage'
import SettingsPage from './pages/Settings/SettingsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login - public route */}
        <Route path="/login" element={<LoginPage />} />
        {/* MBSE Models - Full page experience outside MainLayout */}
        <Route path="projects/:projectId/mbse-models" element={<MBSEModelsPage />} />
        {/* Landing when unauthenticated, app when authenticated */}
        <Route path="/" element={<LandingOrApp />}>
          {/* Platform Admin - dedicated layout, no MainLayout sidebar */}
          <Route path="platform-admin" element={<PlatformAdminRouteGuard />}>
            <Route element={<PlatformAdminLayout />}>
              <Route index element={<PlatformAdminPage />} />
              <Route path="create-company-admin" element={<CreateCompanyAdminPage />} />
              <Route path="companies" element={<CompaniesPage />} />
              <Route path="limits" element={<CompanyLimitsPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="data-flow" element={<DataFlowAdminPanel />} />
            </Route>
          </Route>
          <Route element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="organization" element={<OrganizationPage />} />
            <Route path="projects" element={<Navigate to="/" replace />} />
            <Route path="projects/:projectId" element={<ProjectLandingPage />} />
            <Route path="projects/:projectId/stakeholder" element={<StakeholderPage />} />
            <Route path="projects/:projectId/product-breakdown-structure" element={<PBSPage />} />
            <Route path="projects/:projectId/requirements/settings" element={<RequirementsSettingsPage />} />
            <Route path="projects/:projectId/requirements/dashboard" element={<RequirementsDashboardPage />} />
            <Route path="projects/:projectId/requirements" element={<RequirementsPage />} />
            <Route path="projects/:projectId/tasks" element={<TasksPage />} />
            <Route path="tasks">
            <Route index element={<TasksDashboardPage />} />
            <Route path="my-tasks" element={<MyTasksPage />} />
            <Route path="all" element={<TasksPage />} />
            <Route path="board" element={<TasksPage />} />
            <Route path="calendar" element={<TasksPage />} />
            <Route path="reports" element={<TasksReportsPage />} />
            <Route path="templates" element={<TaskTemplatesPage />} />
            <Route path="workflows" element={<TaskWorkflowsPage />} />
            <Route path="time-tracking" element={<TimeTrackingPage />} />
            <Route path="notifications" element={<TaskNotificationsPage />} />
              <Route path="settings" element={<TaskSettingsPage />} />
            </Route>
              <Route path="projects/:projectId/functions" element={<SystemFunctionsPage />} />
            <Route path="projects/:projectId/parameters/settings" element={<ParameterSettingsPage />} />
            <Route path="projects/:projectId/parameters" element={<ParametersPage />} />
            <Route path="projects/:projectId/change-requests" element={<ChangeRequestsPage />} />
            <Route path="projects/:projectId/architecture" element={<ArchitecturePage />} />
            <Route path="projects/:projectId/reports" element={<ReportsPage />} />
            <Route path="projects/:projectId/verification" element={<VerificationLayoutPage />}>
            <Route index element={<VerificationPage />} />
            <Route path="report/:entityType/:entityId" element={<VerificationReportPage />} />
            <Route path="settings" element={<VerificationSettingsPage />} />
            <Route path="templates" element={<TemplatesLandingPage />} />
              <Route path="templates/:templateId" element={<TemplateEditorPage />} />
            </Route>
              <Route path="projects/:projectId/issues/:issueId" element={<IssueDetailPage />} />
            <Route path="projects/:projectId/issues" element={<IssuesPage />} />
            <Route path="projects/:projectId/documentation" element={<DocumentationPage />} />
            <Route path="projects/:projectId/lifecycle-status" element={<LifecycleStatusPage />} />
            <Route path="projects/:projectId/certification" element={<CertificationPage />} />
            <Route path="projects/:projectId/validation" element={<ValidationPage />} />
            <Route path="projects/:projectId/risk-management" element={<RiskManagementPage />} />
            <Route path="projects/:projectId/interface-management" element={<InterfaceManagementPage />} />
            <Route path="projects/:projectId/configuration-management" element={<ConfigurationManagementPage />} />
            <Route path="projects/:projectId/archive" element={<ArchivePage />} />
            <Route path="projects/:projectId/audit" element={<AuditLogPage />} />
            <Route path="projects/:projectId/compliance-check" element={<ComplianceCheckPage />} />
            <Route path="projects/:projectId/safety-analysis" element={<SafetyLayoutPage />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<SafetyOverviewPage />} />
            <Route path="hazards" element={<HazardsPage />} />
            <Route path="analyses" element={<SafetyAnalysesLandingPage />} />
            <Route path="analyses/:method" element={<AnalysisListPage />} />
            <Route path="analyses/:method/new" element={<CreateAnalysisWizardPage />} />
            <Route path="analyses/:method/:id" element={<EditAnalysisWizardPage />} />
            <Route path="visual-analysis" element={<FTAVisualPage />} />
            <Route path="markov" element={<MarkovPage />} />
            <Route path="traceability" element={<TraceabilityPage />} />
            <Route path="impact-assessment" element={<ImpactAssessmentPage />} />
            <Route path="libraries" element={<LibrariesPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="exports" element={<ExportsPage />} />
              <Route path="settings" element={<SafetySettingsPage />} />
            </Route>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<AdminRouteGuard />}>
              <Route index element={<AdminPage />} />
            </Route>
            <Route path="inventory">
            <Route index element={<Navigate to="/inventory/items" replace />} />
            <Route path="items" element={<ItemsPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
            <Route path="purchasing" element={<PurchasingPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="reports" element={<InventoryReportsPage />} />
              <Route path="dashboard" element={<InventoryDashboardPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
