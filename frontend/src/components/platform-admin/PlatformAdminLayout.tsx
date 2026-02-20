import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Building2, Users, FileText, LogOut, UserPlus } from 'lucide-react'
import Logo from '../Logo'
import ForceChangePasswordModal from '../auth/ForceChangePasswordModal'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'
import { usePlatformAdminStore } from '../../store/platformAdminStore'
import CompanySelector from './CompanySelector'

const navItems = [
  { icon: UserPlus, label: 'Create company admin', path: '/platform-admin/create-company-admin' },
  { icon: Building2, label: 'Companies', path: '/platform-admin/companies' },
  { icon: Users, label: 'Company limits', path: '/platform-admin/limits' },
  { icon: FileText, label: 'Global audit logs', path: '/platform-admin/audit-logs' },
  { icon: Building2, label: 'Data flow', path: '/platform-admin/data-flow' },
]

export default function PlatformAdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, setUser } = useAuthStore()
  const { activeCompanyName, setActiveCompanyName } = usePlatformAdminStore()

  const handleForceChangePasswordSuccess = () => {
    authService.getCurrentUser().then((res) => {
      if (res.success && res.data) {
        setUser(res.data)
      }
    })
  }

  const handleLogout = () => {
    authService.logout()
    logout()
    setActiveCompanyName(null)
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {user?.mustChangePassword && (
        <ForceChangePasswordModal onSuccess={handleForceChangePasswordSuccess} />
      )}
      <aside
        className="w-56 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        aria-label="Platform admin navigation"
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <Link to="/platform-admin" className="flex items-center gap-2">
            <Logo size="sm" showText={true} />
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Platform Admin
          </p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <Link
            to="/platform-admin"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === '/platform-admin' || location.pathname === '/platform-admin/'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
          >
            <Building2 size={18} />
            Overview
          </Link>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <CompanySelector />
        </div>
        {activeCompanyName && (
          <div className="px-3 pb-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Operating as
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={activeCompanyName}>
              {activeCompanyName}
            </p>
          </div>
        )}
        <div className="p-2 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
