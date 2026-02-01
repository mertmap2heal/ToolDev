import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AIGuideChat from '../ai-guide/AIGuideChat'
import { useAIGuideStore } from '../../store/aiGuideStore'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'

export default function MainLayout() {
  const { isOpen } = useAIGuideStore()
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    if (authService.getToken() && !user) {
      authService.getCurrentUser().then((res) => {
        if (res.success && res.data) {
          setUser(res.data)
        }
      })
    }
  }, [user, setUser])

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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      <Sidebar />
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isOpen ? '' : ''}`}>
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 bg-gray-50 dark:bg-gray-950">
          <Outlet />
        </main>
      </div>
      {/* AI Guide Chat - Right Side Panel */}
      <AIGuideChat />
    </div>
  )
}
