import { useState, useEffect } from 'react'
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
  FolderTree,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'

interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  route: string
}

interface NavigationGroup {
  title: string
  items: NavigationItem[]
}

const navigationGroups: NavigationGroup[] = [
  {
    title: 'SYSTEM DEFINITION',
    items: [
      { id: 'stakeholder', label: 'Stakeholder', icon: Users, route: 'stakeholder' },
      { id: 'product-breakdown-structure', label: 'Product Breakdown Structure', icon: FolderTree, route: 'product-breakdown-structure' },
      { id: 'mbse-models', label: 'MBSE Models', icon: Boxes, route: 'mbse-models' },
      { id: 'functions', label: 'Functions', icon: Settings, route: 'functions' },
      { id: 'interface-management', label: 'Interfaces', icon: Network, route: 'interface-management' },
      { id: 'parameters', label: 'Parameters', icon: Sliders, route: 'parameters' },
    ],
  },
  {
    title: 'DEVELOPMENT & CONTROL',
    items: [
      { id: 'requirements', label: 'Requirements', icon: FileCheck, route: 'requirements' },
      { id: 'tasks', label: 'Tasks', icon: ClipboardList, route: 'tasks' },
      { id: 'change-requests', label: 'Change Requests', icon: GitBranch, route: 'change-requests' },
      { id: 'issues', label: 'Issues', icon: AlertCircle, route: 'issues' },
      { id: 'documentation', label: 'Documentation', icon: BookOpen, route: 'documentation' },
      { id: 'lifecycle-status', label: 'Lifecycle Status', icon: Activity, route: 'lifecycle-status' },
      { id: 'configuration-management', label: 'Configuration Management', icon: Layers, route: 'configuration-management' },
      { id: 'archive', label: 'Archive', icon: Archive, route: 'archive' },
    ],
  },
  {
    title: 'ASSURANCE & CERTIFICATION',
    items: [
      { id: 'verification', label: 'Verification', icon: CheckCircle2, route: 'verification' },
      { id: 'validation', label: 'Validation', icon: CheckCircle, route: 'validation' },
      { id: 'safety-analysis', label: 'Safety Analysis', icon: Shield, route: 'safety-analysis' },
      { id: 'risk-management', label: 'Risk Management', icon: AlertTriangle, route: 'risk-management' },
      { id: 'compliance-check', label: 'Compliance Check', icon: ShieldCheck, route: 'compliance-check' },
      { id: 'certification', label: 'Certification', icon: Award, route: 'certification' },
      { id: 'reports', label: 'Reports', icon: FileText, route: 'reports' },
    ],
  },
]

function getCurrentSectionFromPath(path: string): string | null {
  const match = path.match(/\/projects\/[^/]+\/([^/]+)/)
  return match ? match[1] : null
}

export default function ProjectNavigation() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const currentSection = getCurrentSectionFromPath(location.pathname)

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    new Set(navigationGroups.map((g) => g.title))
  )

  useEffect(() => {
    if (currentSection) {
      const group = navigationGroups.find((g) => g.items.some((i) => i.route === currentSection))
      if (group) {
        setExpandedGroups((prev) => new Set([...prev, group.title]))
      }
    }
  }, [currentSection])

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  const handleNavigation = (route: string) => {
    if (projectId) {
      if (route === 'tasks') {
        navigate(`/tasks/all?projectId=${projectId}`)
      } else {
        navigate(`/projects/${projectId}/${route}`)
      }
    }
  }

  return (
    <div className="space-y-2 mb-6">
      {navigationGroups.map((group) => {
        const isExpanded = expandedGroups.has(group.title)
        const sectionId = `nav-section-${group.title.replace(/\s+/g, '-').toLowerCase()}`

        return (
          <section key={group.title} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              aria-expanded={isExpanded}
              aria-controls={sectionId}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span>{group.title}</span>
              {isExpanded ? (
                <ChevronDown size={16} className="shrink-0" />
              ) : (
                <ChevronRight size={16} className="shrink-0" />
              )}
            </button>
            <div
              id={sectionId}
              role="region"
              aria-label={group.title}
              className={clsx('overflow-hidden transition-all duration-200', isExpanded ? 'max-h-[500px]' : 'max-h-0')}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 p-2 border-t border-gray-200 dark:border-gray-700">
                {group.items.map((item) => {
                  const Icon = item.icon

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigation(item.route)}
                      className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md cursor-pointer transition-all duration-200 min-h-[72px]"
                    >
                      <Icon
                        size={18}
                        className="mb-1.5 text-gray-600 dark:text-gray-400"
                      />
                      <span className="text-xs font-medium text-center leading-tight text-gray-700 dark:text-gray-300">
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        )
      })}
    </div>
  )
}
