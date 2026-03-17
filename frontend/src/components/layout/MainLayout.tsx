import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Header from './Header'
import { BreadcrumbProvider } from '../../contexts/BreadcrumbContext'
import AIGuideChat from '../ai-guide/AIGuideChat'
import ForceChangePasswordModal from '../auth/ForceChangePasswordModal'
import { useAIGuideStore } from '../../store/aiGuideStore'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'
import { usePlatformAdminStore } from '../../store/platformAdminStore'

export default function MainLayout() {
  const { isOpen } = useAIGuideStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser } = useAuthStore()
  const { activeCompanyName } = usePlatformAdminStore()

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
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? '' : ''}`}>
          <Header />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4" style={{ backgroundColor: 'var(--theme-bg)' }}>
            <Outlet />
          </main>
        </div>
      </BreadcrumbProvider>
      {/* AI Guide Chat - Right Side Panel */}
      <AIGuideChat />
    </div>
  )
}
