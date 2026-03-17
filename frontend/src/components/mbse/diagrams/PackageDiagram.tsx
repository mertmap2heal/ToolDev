import { useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, FileText, Box, Settings, AlertCircle, GitPullRequest } from 'lucide-react'
import { requirementService } from '../../../services/requirement.service'
import { functionService } from '../../../services/function.service'
import { issueService } from '../../../services/issue.service'
import { changeRequestService } from '../../../services/changeRequest.service'
import DiagramExporter from '../shared/DiagramExporter'

interface PackageDiagramProps {
  projectId: string
}

/**
 * PackageDiagram implements a SysML Package Diagram (pkg)
 * showing the organization of model elements into packages.
 */
export default function PackageDiagram({ projectId }: PackageDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)

  // Fetch all data for package statistics
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Calculate package statistics
  const packages = useMemo(() => [
    {
      id: 'requirements',
      name: 'Requirements Package',
      icon: FileText,
      color: '#3b82f6',
      count: requirements.length,
      subpackages: [
        { name: 'Functional', count: requirements.filter(r => r.requirementType === 'functional').length },
        { name: 'Performance', count: requirements.filter(r => r.requirementType === 'performance').length },
        { name: 'Safety', count: requirements.filter(r => r.requirementType === 'safety').length },
        { name: 'Other', count: requirements.filter(r => !['functional', 'performance', 'safety'].includes(r.requirementType || '')).length },
      ].filter(s => s.count > 0),
    },
    {
      id: 'functions',
      name: 'Functions Package',
      icon: Settings,
      color: '#22c55e',
      count: functions.length,
      subpackages: [
        { name: 'Draft', count: functions.filter(f => f.status === 'draft').length },
        { name: 'In Progress', count: functions.filter(f => f.status === 'work-in-progress').length },
        { name: 'Done', count: functions.filter(f => f.status === 'done').length },
      ].filter(s => s.count > 0),
    },
    {
      id: 'issues',
      name: 'Issues Package',
      icon: AlertCircle,
      color: '#f59e0b',
      count: issues.length,
      subpackages: [
        { name: 'Open', count: issues.filter(i => i.status === 'open').length },
        { name: 'In Progress', count: issues.filter(i => i.status === 'in-progress').length },
        { name: 'Closed', count: issues.filter(i => i.status === 'closed').length },
      ].filter(s => s.count > 0),
    },
    {
      id: 'changes',
      name: 'Change Requests Package',
      icon: GitPullRequest,
      color: '#a855f7',
      count: changeRequests.length,
      subpackages: [
        { name: 'Pending', count: changeRequests.filter(c => c.status === 'pending').length },
        { name: 'Approved', count: changeRequests.filter(c => c.status === 'approved').length },
        { name: 'Rejected', count: changeRequests.filter(c => c.status === 'rejected').length },
      ].filter(s => s.count > 0),
    },
  ], [requirements, functions, issues, changeRequests])

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Package Diagram - Model Organization
          </span>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="package-diagram" />
      </div>

      {/* Diagram Canvas */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-8" ref={diagramRef}>
        <div className="max-w-5xl mx-auto">
          {/* Root Package */}
          <div className="border-2 border-gray-400 rounded-lg p-6 bg-white dark:bg-gray-800">
            {/* Package Tab */}
            <div className="flex items-center gap-2 -mt-10 mb-4">
              <div className="px-3 py-1 bg-gray-400 text-white text-sm font-semibold rounded-t flex items-center gap-2">
                <Package size={14} />
                Project Model
              </div>
            </div>

            {/* Sub-packages */}
            <div className="grid grid-cols-2 gap-6">
              {packages.map((pkg) => {
                const Icon = pkg.icon
                return (
                  <div
                    key={pkg.id}
                    className="border-2 rounded-lg p-4 bg-white dark:bg-gray-900"
                    style={{ borderColor: pkg.color }}
                  >
                    {/* Package Tab */}
                    <div className="flex items-center gap-2 -mt-8 mb-3">
                      <div
                        className="px-2 py-1 text-white text-xs font-semibold rounded-t flex items-center gap-1"
                        style={{ backgroundColor: pkg.color }}
                      >
                        <Icon size={12} />
                        {pkg.name}
                      </div>
                    </div>

                    {/* Package Content */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Total Elements
                        </span>
                        <span
                          className="text-lg font-bold"
                          style={{ color: pkg.color }}
                        >
                          {pkg.count}
                        </span>
                      </div>

                      {/* Sub-packages */}
                      {pkg.subpackages.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          {pkg.subpackages.map((sub, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <div
                                  className="w-2 h-2 rounded"
                                  style={{ backgroundColor: pkg.color + '60' }}
                                />
                                {sub.name}
                              </span>
                              <span className="text-gray-700 dark:text-gray-300 font-medium">
                                {sub.count}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Dependencies */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
                Package Dependencies
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="text-blue-500">Requirements</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-500">Functions</span>
                  <span className="text-gray-400 ml-1">(satisfy)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">Functions</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-amber-500">Issues</span>
                  <span className="text-gray-400 ml-1">(trace)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-blue-500">Requirements</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-purple-500">Change Requests</span>
                  <span className="text-gray-400 ml-1">(change)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Legend</div>
            <div className="flex gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-6 h-4 border-2 border-gray-400 rounded bg-white relative">
                  <div className="absolute -top-2 left-0 w-3 h-2 bg-gray-400 rounded-t"></div>
                </div>
                Package
              </span>
              <span className="flex items-center gap-1">
                <div className="w-6 h-0.5 bg-gray-400"></div>
                →
                Dependency
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
