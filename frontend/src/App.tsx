import { BrowserRouter } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import DashboardPage from './pages/Dashboard/DashboardPage'
import RequirementsPage from './pages/Requirements/RequirementsPage'
import SystemFunctionsPage from './pages/SystemFunctions/SystemFunctionsPage'
import ArchitecturePage from './pages/Architecture/ArchitecturePage'
import VerificationPage from './pages/Verification/VerificationPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="projects/:projectId/requirements" element={<RequirementsPage />} />
          <Route path="projects/:projectId/functions" element={<SystemFunctionsPage />} />
          <Route path="projects/:projectId/architecture" element={<ArchitecturePage />} />
          <Route path="projects/:projectId/verification" element={<VerificationPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
