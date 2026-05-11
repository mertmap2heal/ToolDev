import { BrowserRouter } from 'react-router-dom'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import LandingOrApp from './components/LandingOrApp'
import LoginPage from './pages/Login/LoginPage'
import PrivacyPolicy from './pages/Legal/PrivacyPolicy'
import TermsOfUse from './pages/Legal/TermsOfUse'
import DashboardPage from './pages/Dashboard/DashboardPage'
import RequirementsPage from './pages/Requirements/RequirementsPage'
import RequirementsSettingsPage from './pages/Requirements/RequirementsSettingsPage'
import RequirementsDashboardPage from './pages/Requirements/RequirementsDashboardPage'
import TraceabilityViewsPage from './pages/Requirements/TraceabilityViewsPage'
import SystemFunctionsPage from './pages/SystemFunctions/SystemFunctionsPage'
import ArchitecturePage from './pages/Architecture/ArchitecturePage'
import VerificationLayoutPage from './pages/Verification/VerificationLayoutPage'
import VerificationPage from './pages/Verification/VerificationPage'
import VerificationReportPage from './pages/Verification/VerificationReportPage'
import VerificationSettingsPage from './pages/Verification/VerificationSettingsPage'
import TemplatesLandingPage from './pages/Verification/TemplatesLandingPage'
import TemplateEditorPage from './pages/Verification/TemplateEditorPage'
import DocumentationPage from './pages/Documentation/DocumentationPage'
import HelpLayout from './pages/Help/HelpLayout'
import ProjectLandingPage from './pages/ProjectLanding/ProjectLandingPage'
import StakeholderPage from './pages/Stakeholder/StakeholderPage'
import PBSPage from './modules/pbs/PBSPage'
import MBSEModelsPage from './pages/MBSEModels/MBSEModelsPage'
import ReportsPage from './pages/Reports/ReportsPage'
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
import ComplianceCheckPage from './pages/ComplianceCheck/ComplianceCheckPage'
import CertificationPage from './pages/Certification/CertificationPage'
import ValidationPage from './pages/Validation/ValidationPage'
import ValidationSettingsPage from './pages/Validation/ValidationSettingsPage'
import DERView from './pages/Validation/DERView'
import BaselinesPage from './pages/Validation/BaselinesPage'
import ActivityPage from './pages/Validation/ActivityPage'
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
import AiInvocationsPage from './pages/Admin/AiInvocationsPage'
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
import PreviewLandingPage from './pages/PreviewLanding/PreviewLandingPage'
import { FeaturePackageProvider } from './contexts/FeaturePackageContext'
import FeatureGuard from './components/access/FeatureGuard'
import PackageSwitcher from './components/dev/PackageSwitcher'
import RouteErrorBoundary from './components/common/RouteErrorBoundary'

function App() {
  return (
    <BrowserRouter>
      <FeaturePackageProvider>
      <RouteErrorBoundary>
      <Routes>
        {/* Login - public route */}
        <Route path="/login" element={<LoginPage />} />
        {/* Preview landing (brand validation sample, public, unauthenticated) */}
        <Route path="/preview/landing" element={<PreviewLandingPage />} />
        {/* Legal - public static pages (accessible without authentication) */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        {/* MBSE Models - Full page experience outside MainLayout */}
        <Route path="projects/:projectId/mbse-models" element={<FeatureGuard moduleId="mbse-models"><MBSEModelsPage /></FeatureGuard>} />
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
            <Route path="projects/:projectId/stakeholder" element={<FeatureGuard moduleId="stakeholder"><StakeholderPage /></FeatureGuard>} />
            <Route path="projects/:projectId/product-breakdown-structure" element={<FeatureGuard moduleId="product-breakdown-structure"><PBSPage /></FeatureGuard>} />
            <Route path="projects/:projectId/requirements/settings" element={<FeatureGuard moduleId="requirements"><RequirementsSettingsPage /></FeatureGuard>} />
            <Route path="projects/:projectId/requirements/dashboard" element={<FeatureGuard moduleId="requirements"><RequirementsDashboardPage /></FeatureGuard>} />
            <Route path="projects/:projectId/requirements/traceability-views" element={<FeatureGuard moduleId="requirements"><TraceabilityViewsPage /></FeatureGuard>} />
            <Route path="projects/:projectId/requirements" element={<FeatureGuard moduleId="requirements"><RequirementsPage /></FeatureGuard>} />
            <Route path="projects/:projectId/tasks" element={<FeatureGuard moduleId="tasks"><TasksPage /></FeatureGuard>} />
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
              <Route path="projects/:projectId/functions" element={<FeatureGuard moduleId="functions"><SystemFunctionsPage /></FeatureGuard>} />
            <Route path="projects/:projectId/parameters/settings" element={<FeatureGuard moduleId="parameters"><ParameterSettingsPage /></FeatureGuard>} />
            <Route path="projects/:projectId/parameters" element={<FeatureGuard moduleId="parameters"><ParametersPage /></FeatureGuard>} />
            <Route path="projects/:projectId/change-requests" element={<FeatureGuard moduleId="change-requests"><ChangeRequestsPage /></FeatureGuard>} />
            <Route path="projects/:projectId/architecture" element={<ArchitecturePage />} />
            <Route path="projects/:projectId/reports" element={<ReportsPage />} />
            <Route path="projects/:projectId/verification" element={<FeatureGuard moduleId="verification"><VerificationLayoutPage /></FeatureGuard>}>
            <Route index element={<VerificationPage />} />
            <Route path="report/:entityType/:entityId" element={<VerificationReportPage />} />
            <Route path="settings" element={<VerificationSettingsPage />} />
            <Route path="templates" element={<TemplatesLandingPage />} />
              <Route path="templates/:templateId" element={<TemplateEditorPage />} />
            </Route>
              <Route path="projects/:projectId/issues/:issueId" element={<FeatureGuard moduleId="issues"><IssueDetailPage /></FeatureGuard>} />
            <Route path="projects/:projectId/issues" element={<FeatureGuard moduleId="issues"><IssuesPage /></FeatureGuard>} />
            <Route path="projects/:projectId/documentation" element={<FeatureGuard moduleId="documentation"><DocumentationPage /></FeatureGuard>} />
            <Route path="projects/:projectId/lifecycle-status" element={<FeatureGuard moduleId="lifecycle-status"><LifecycleStatusPage /></FeatureGuard>} />
            <Route path="projects/:projectId/certification" element={<FeatureGuard moduleId="certification"><CertificationPage /></FeatureGuard>} />
            <Route path="projects/:projectId/validation" element={<FeatureGuard moduleId="validation"><ValidationPage /></FeatureGuard>} />
            <Route path="projects/:projectId/validation/der" element={<FeatureGuard moduleId="validation"><DERView /></FeatureGuard>} />
            <Route path="projects/:projectId/validation/baselines" element={<FeatureGuard moduleId="validation"><BaselinesPage /></FeatureGuard>} />
            <Route path="projects/:projectId/validation/activity" element={<FeatureGuard moduleId="validation"><ActivityPage /></FeatureGuard>} />
            <Route path="projects/:projectId/validation/settings" element={<FeatureGuard moduleId="validation"><ValidationSettingsPage /></FeatureGuard>} />
            <Route path="projects/:projectId/risk-management" element={<FeatureGuard moduleId="risk-management"><RiskManagementPage /></FeatureGuard>} />
            <Route path="projects/:projectId/interface-management" element={<FeatureGuard moduleId="interface-management"><InterfaceManagementPage /></FeatureGuard>} />
            <Route path="projects/:projectId/configuration-management" element={<FeatureGuard moduleId="configuration-management"><ConfigurationManagementPage /></FeatureGuard>} />
            <Route path="projects/:projectId/archive" element={<FeatureGuard moduleId="archive"><ArchivePage /></FeatureGuard>} />
            <Route path="projects/:projectId/audit" element={<FeatureGuard moduleId="audit"><AuditLogPage /></FeatureGuard>} />
            <Route path="projects/:projectId/compliance-check" element={<FeatureGuard moduleId="compliance-check"><ComplianceCheckPage /></FeatureGuard>} />
            <Route path="projects/:projectId/safety-analysis" element={<FeatureGuard moduleId="safety-analysis"><SafetyLayoutPage /></FeatureGuard>}>
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
            <Route path="help" element={<HelpLayout />} />
            <Route path="help/:slug" element={<HelpLayout />} />
            <Route path="admin" element={<AdminRouteGuard />}>
              <Route index element={<AdminPage />} />
              <Route path="ai-invocations" element={<AiInvocationsPage />} />
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
      </RouteErrorBoundary>
      <PackageSwitcher />
      </FeaturePackageProvider>
    </BrowserRouter>
  )
}

export default App
