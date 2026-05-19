import { useEffect, useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import { BreadcrumbProvider } from '../../contexts/BreadcrumbContext'
import AIGuideChat from '../ai-guide/AIGuideChat'
import ForceChangePasswordModal from '../auth/ForceChangePasswordModal'
import { useAIGuideStore } from '../../store/aiGuideStore'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'
import { usePlatformAdminStore } from '../../store/platformAdminStore'
import { useLifecycleSync } from '../../hooks/useLifecycleSync'

/** Extract the project id/slug from a `/projects/:projectId/...` pathname. */
function projectIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/projects\/([^/]+)/)
  return m ? m[1]! : null
}

export default function MainLayout() {
  const { isOpen } = useAIGuideStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser } = useAuthStore()
  const { activeCompanyName } = usePlatformAdminStore()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // NX-11: hydrate the lifecycle store cache from the DB for the active
  // project, and run the one-time localStorage migration. Transparent to the
  // requirement modals / checklist builder that read the store synchronously.
  useLifecycleSync(projectIdFromPath(location.pathname))

  const isSuperiorAdmin = user?.role === 'SUPERIOR_ADMIN' || user?.isSuperiorAdmin === true
  useEffect(() => {
    if (user && isSuperiorAdmin && !activeCompanyName) {
      navigate('/platform-admin', { replace: true })
    }
  }, [user, isSuperiorAdmin, activeCompanyName, navigate])

  const handleForceChangePasswordSuccess = () => {
    authService.getCurrentUser().then((res) => {
      if (res.success && res.data) {
        setUser(res.data)
      }
    })
  }

  useEffect(() => {
    const handleTokenExpired = () => {
      navigate('/login', { replace: true })
    }

    window.addEventListener('token-expired', handleTokenExpired)

    return () => {
      window.removeEventListener('token-expired', handleTokenExpired)
    }
  }, [navigate])

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--theme-bg)' }}>
      {user?.mustChangePassword && (
        <ForceChangePasswordModal onSuccess={handleForceChangePasswordSuccess} />
      )}
      <BreadcrumbProvider>
        {/* Mobile overlay backdrop */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <Header onMobileMenuOpen={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4" style={{ backgroundColor: 'var(--theme-bg)' }}>
            <Outlet />
          </main>
          {/* RF-1 (D6): the always-on status strip is re-enabled. */}
          <StatusBar />
        </div>
      </BreadcrumbProvider>
      {/* AI Guide Chat - Right Side Panel */}
      <AIGuideChat />
    </div>
  )
}
