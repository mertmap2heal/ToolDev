import { Link, useParams, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { projectService } from '../../services/project.service'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  
  // Fetch project name if we're on a project page
  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await projectService.getProject(projectId)
      return response.success && response.data ? response.data : null
    },
    enabled: !!projectId,
  })

  // Auto-generate breadcrumbs based on route
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (items) return items // Use provided items if available
    
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Home', path: '/' }
    ]

    if (pathSegments[0] === 'admin') {
      breadcrumbs.push({ label: 'Admin' })
      return breadcrumbs
    }

    if (pathSegments[0] === 'projects' && projectId) {
      // Add project name if available
      const projectName = projectData?.name || 'Project'
      breadcrumbs.push({ label: projectName })
      
      // Add current page (kebab-case to title case, e.g. configuration-management -> Configuration Management)
      if (pathSegments[2]) {
        const slug = pathSegments[2]
        const pageName = slug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
        breadcrumbs.push({ label: pageName })
      }
    }

    return breadcrumbs
  }

  const breadcrumbItems = generateBreadcrumbs()

  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.path ? (
            <Link to={item.path} className="hover:text-gray-900 dark:hover:text-white transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 dark:text-white font-medium">{item.label}</span>
          )}
          {index < breadcrumbItems.length - 1 && (
            <span className="text-gray-400 dark:text-gray-500">/</span>
          )}
        </div>
      ))}
    </nav>
  )
}
