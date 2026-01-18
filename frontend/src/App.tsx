import { BrowserRouter } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './pages/Dashboard/DashboardPage'
import RequirementsPage from './pages/Requirements/RequirementsPage'
import SystemFunctionsPage from './pages/SystemFunctions/SystemFunctionsPage'
import ArchitecturePage from './pages/Architecture/ArchitecturePage'
import VerificationPage from './pages/Verification/VerificationPage'
import DocumentationPage from './pages/Documentation/DocumentationPage'
import StakeholderPage from './pages/Stakeholder/StakeholderPage'
import MBSEModelsPage from './pages/MBSEModels/MBSEModelsPage'
import ReportsPage from './pages/Reports/ReportsPage'
import IssuesPage from './pages/Issues/IssuesPage'
import ParametersPage from './pages/Parameters/ParametersPage'
import ChangeRequestsPage from './pages/ChangeRequests/ChangeRequestsPage'
import TasksPage from './pages/Tasks/TasksPage'
import LifecycleManagementPage from './pages/LifecycleManagement/LifecycleManagementPage'
import ArchivePage from './pages/Archive/ArchivePage'
import LifecycleStatusPage from './pages/LifecycleStatus/LifecycleStatusPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* MBSE Models - Full page experience outside MainLayout */}
        <Route path="projects/:projectId/mbse-models" element={<MBSEModelsPage />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects/:projectId/stakeholder" element={<StakeholderPage />} />
          <Route path="projects/:projectId/requirements" element={<RequirementsPage />} />
          <Route path="projects/:projectId/tasks" element={<TasksPage />} />
          <Route path="projects/:projectId/functions" element={<SystemFunctionsPage />} />
          <Route path="projects/:projectId/parameters" element={<ParametersPage />} />
          <Route path="projects/:projectId/change-requests" element={<ChangeRequestsPage />} />
          <Route path="projects/:projectId/architecture" element={<ArchitecturePage />} />
          <Route path="projects/:projectId/reports" element={<ReportsPage />} />
          <Route path="projects/:projectId/verification" element={<VerificationPage />} />
          <Route path="projects/:projectId/issues" element={<IssuesPage />} />
          <Route path="projects/:projectId/documentation" element={<DocumentationPage />} />
          <Route path="projects/:projectId/lifecycle-status" element={<LifecycleStatusPage />} />
          <Route path="projects/:projectId/archive" element={<ArchivePage />} />
          <Route path="lifecycle" element={<LifecycleManagementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
