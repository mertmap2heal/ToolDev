import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { 
  Users, 
  Boxes, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  FileCheck,
  Settings,
  BookOpen,
  Sliders,
  GitBranch,
  ClipboardList,
  Archive,
  Activity,
  Shield,
  ShieldCheck,
  Award,
  CheckCircle,
  AlertTriangle,
  Network,
  Layers,
} from 'lucide-react'
import clsx from 'clsx'

interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  route: string
}

const navigationItems: NavigationItem[] = [
  { id: 'stakeholder', label: 'Stakeholder', icon: Users, route: 'stakeholder' },
  { id: 'mbse-models', label: 'MBSE Models', icon: Boxes, route: 'mbse-models' },
  { id: 'requirements', label: 'Requirements', icon: FileCheck, route: 'requirements' },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList, route: 'tasks' },
  { id: 'functions', label: 'Functions', icon: Settings, route: 'functions' },
  { id: 'parameters', label: 'Parameters', icon: Sliders, route: 'parameters' },
  { id: 'change-requests', label: 'Change Requests', icon: GitBranch, route: 'change-requests' },
  { id: 'reports', label: 'Reports', icon: FileText, route: 'reports' },
  { id: 'verification', label: 'Verification', icon: CheckCircle2, route: 'verification' },
  { id: 'issues', label: 'Issues', icon: AlertCircle, route: 'issues' },
  { id: 'documentation', label: 'Documentation', icon: BookOpen, route: 'documentation' },
  { id: 'lifecycle-status', label: 'Lifecycle Status', icon: Activity, route: 'lifecycle-status' },
  { id: 'certification', label: 'Certification', icon: Award, route: 'certification' },
  { id: 'validation', label: 'Validation', icon: CheckCircle, route: 'validation' },
  { id: 'risk-management', label: 'Risk Management', icon: AlertTriangle, route: 'risk-management' },
  { id: 'interface-management', label: 'Interface Management', icon: Network, route: 'interface-management' },
  { id: 'configuration-management', label: 'Configuration Management', icon: Layers, route: 'configuration-management' },
  { id: 'safety-analysis', label: 'Safety Analysis', icon: Shield, route: 'safety-analysis' },
  { id: 'compliance-check', label: 'Compliance Check', icon: ShieldCheck, route: 'compliance-check' },
  { id: 'archive', label: 'Archive', icon: Archive, route: 'archive' },
]

export default function ProjectNavigation() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const getCurrentSection = () => {
    const path = location.pathname
    const match = path.match(/\/projects\/[^/]+\/([^/]+)/)
    return match ? match[1] : null
  }

  const currentSection = getCurrentSection()

  const handleNavigation = (route: string) => {
    if (projectId) {
      // Redirect tasks to unified task management module with project filter
      if (route === 'tasks') {
        navigate(`/tasks/all?projectId=${projectId}`)
      } else {
        navigate(`/projects/${projectId}/${route}`)
      }
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
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
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              )} 
            />
            <span className={clsx(
              'text-xs font-medium text-center',
              isActive
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300'
            )}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
