import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import AIGuideChat from '../ai-guide/AIGuideChat'
import { useAIGuideStore } from '../../store/aiGuideStore'
import { ensureAuthenticated } from '../../utils/autoAuth'

export default function MainLayout() {
  const { isOpen } = useAIGuideStore()
  
  useEffect(() => {
    // Ensure user is authenticated on mount
    ensureAuthenticated().catch((error) => {
      console.error('Failed to authenticate:', error)
    })

    // Listen for token expiration events
    const handleTokenExpired = async () => {
      console.log('Token expired, attempting re-authentication...')
      await ensureAuthenticated()
    }

    window.addEventListener('token-expired', handleTokenExpired)
    
    return () => {
      window.removeEventListener('token-expired', handleTokenExpired)
    }
  }, [])
  
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
