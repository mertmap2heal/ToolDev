import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  LayoutDashboard,
  AlertTriangle,
  FileSearch,
  GitBranch,
  Network,
  Scale,
  Library,
  CheckCircle2,
  History,
  Download,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface NavigationItem {
  id: string
  label: string
  icon: LucideIcon
  route: string
}

const navigationItems: NavigationItem[] = [
  { id: 'overview', label: 'Safety Overview', icon: LayoutDashboard, route: 'overview' },
  { id: 'hazards', label: 'Hazards', icon: AlertTriangle, route: 'hazards' },
  { id: 'analyses', label: 'Safety Analyses', icon: FileSearch, route: 'analyses' },
  { id: 'visual-analysis', label: 'Visual Analysis (FTA)', icon: GitBranch, route: 'visual-analysis' },
  { id: 'traceability', label: 'Traceability', icon: Network, route: 'traceability' },
  { id: 'impact-assessment', label: 'Impact Assessment', icon: Scale, route: 'impact-assessment' },
  { id: 'libraries', label: 'Libraries', icon: Library, route: 'libraries' },
  { id: 'reviews', label: 'Reviews & Approvals', icon: CheckCircle2, route: 'reviews' },
  { id: 'audit-log', label: 'Audit Log', icon: History, route: 'audit-log' },
  { id: 'exports', label: 'Exports', icon: Download, route: 'exports' },
  { id: 'settings', label: 'Safety Settings', icon: Settings, route: 'settings' },
]

export default function SafetyNavigation() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const getCurrentSection = () => {
    const path = location.pathname
    const match = path.match(/\/projects\/[^/]+\/safety-analysis\/([^/]+)/)
    return match ? match[1] : null
  }

  const currentSection = getCurrentSection()

  const handleNavigation = (route: string) => {
    if (projectId) {
      navigate(`/projects/${projectId}/safety-analysis/${route}`)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Safety Analysis</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = currentSection === item.route

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.route)}
              className={clsx(
                'flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 min-h-[100px]',
                isActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md cursor-pointer'
              )}
            >
              <Icon
                size={24}
                className={clsx(
                  'mb-2',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                )}
              />
              <span
                className={clsx(
                  'text-xs font-medium text-center',
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
