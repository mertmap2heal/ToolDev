import { useState } from 'react'
import { Search, Filter, MoreVertical, Play, Trash2, Settings2, ChevronDown, ChevronUp, Users, BarChart3, FileDown, ListChecks, LogOut } from 'lucide-react'
import { format } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ProjectGrid from '../../components/projects/ProjectGrid'
import CreateProjectButton from '../../components/projects/CreateProjectButton'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import ProjectTeamModal from '../../components/projects/ProjectTeamModal'
import { projectService } from '../../services/project.service'
import { useProjectStore } from '../../store/projectStore'
import type { Project } from 'shared/types/project.types'

// --- New: Analytics & Audit Log Modal ---
import { useMemo } from 'react'

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterValue, setFilterValue] = useState('all')
  const [sortValue, setSortValue] = useState('name')
  const [showRunningOnly, setShowRunningOnly] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null)
  const [teamModalProject, setTeamModalProject] = useState<Project | null>(null)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [analyticsModalProject, setAnalyticsModalProject] = useState<Project | null>(null)
  const [auditLogModalProject, setAuditLogModalProject] = useState<Project | null>(null)
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)
  const { setProjects, projects } = useProjectStore()
  const queryClient = useQueryClient()

  const { data: projectsData, isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectService.getProjects()
      if (!response.success) {
        const msg = response.error || 'Failed to load projects'
        console.error('Error fetching projects:', msg)
        throw new Error(msg)
      }
      const list = response.data ?? []
      setProjects(list)
      return list
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => projectService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setProjectToDelete(null)
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete project error:', error)
      alert(error?.error || 'Failed to delete project')
      setProjectToDelete(null)
      setDeleteConfirmation(null)
    },
  })

  const handleDeleteClick = (e: React.MouseEvent, projectId: string, projectName: string) => {
    e.stopPropagation()
    setDeleteConfirmation({ id: projectId, name: projectName })
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      setProjectToDelete(deleteConfirmation.id)
      deleteProjectMutation.mutate(deleteConfirmation.id)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmation(null)
    setProjectToDelete(null)
  }

  let displayedProjects = projectsData || projects || []
  if (filterValue !== 'all') displayedProjects = displayedProjects.filter(p => p.status === filterValue)
  if (dateRange) {
    displayedProjects = displayedProjects.filter(p => {
      const updated = new Date(p.updatedAt)
      return updated >= new Date(dateRange.from) && updated <= new Date(dateRange.to)
    })
  }
  const runningProjects = displayedProjects.filter(p => p.status === 'active')
  const totalProjects = displayedProjects.length
  const totalProgress = displayedProjects.length > 0
    ? Math.round(displayedProjects.reduce((sum, p) => sum + p.progress, 0) / displayedProjects.length)
    : 0
  // --- Bulk Actions ---
  const handleSelectProject = (id: string, checked: boolean) => {
    setSelectedProjectIds((prev) => checked ? [...prev, id] : prev.filter(pid => pid !== id))
  }
  const handleSelectAll = (checked: boolean) => {
    setSelectedProjectIds(checked ? displayedProjects.map(p => p.id) : [])
  }
  const handleBulkDelete = () => {
    if (selectedProjectIds.length === 0) return
    selectedProjectIds.forEach(id => deleteProjectMutation.mutate(id))
    setSelectedProjectIds([])
  }
  const handleBulkExport = async () => {
    const res = await projectService.exportProjects()
    if (res.success) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'projects-export.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Overview Stats Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Projects</h2>
          <a href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Give feedback
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400 text-left">Total Projects</span>
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white text-left">
              {totalProjects}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400 text-left">Active Projects</span>
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white text-left">
              {runningProjects.length}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-600 dark:text-gray-400 text-left">Average Progress</span>
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-white text-left">
              {totalProgress}%
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <a href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Show charts
          </a>
        </div>
      </div>

      {/* Projects Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Search and Filter Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 items-center">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterValue}
            onChange={e => setFilterValue(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <input
            type="date"
            value={dateRange?.from || ''}
            onChange={e => setDateRange(r => ({ from: e.target.value, to: r?.to ?? '' }))}
            className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <input
            type="date"
            value={dateRange?.to || ''}
            onChange={e => setDateRange(r => ({ from: r?.from ?? '', to: e.target.value }))}
            className="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={() => setShowRunningOnly(v => !v)}>
            <Filter size={16} className={showRunningOnly ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'} />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" onClick={() => setShowBulkMenu(v => !v)}>
            <ListChecks size={16} className={showBulkMenu ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'} />
          </button>
          {showBulkMenu && (
            <div className="absolute z-10 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 flex flex-col gap-2">
              <button onClick={handleBulkDelete} className="flex items-center gap-2 text-red-600 hover:underline"><Trash2 size={16} /> Delete Selected</button>
              <button onClick={handleBulkExport} className="flex items-center gap-2 text-blue-600 hover:underline"><FileDown size={16} /> Export Selected</button>
            </div>
          )}
        </div>

        {/* Projects Table */}
        {isLoading ? (
          <div className="p-8 text-left text-gray-500 dark:text-gray-400">
            Loading projects...
          </div>
        ) : error ? (
          <div className="p-8 text-left">
            <p className="text-red-600 dark:text-red-400 mb-2 font-medium">
              {error instanceof Error ? error.message : 'Error loading projects.'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Check that the backend is running, the database is connected, and you are logged in.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Retry
              </button>
              <a
                href="/api/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
              >
                Check backend health
              </a>
            </div>
            <details className="text-sm text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 mb-2">
                Troubleshooting steps
              </summary>
              <ol className="list-decimal list-inside space-y-1 mt-2">
                <li>Start the backend: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">cd backend && npm run dev</code></li>
                <li>Ensure PostgreSQL is running (e.g. <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">docker compose up -d</code>)</li>
                <li>If you were logged out, go to the login page and sign in again</li>
              </ol>
            </details>
          </div>
        ) : displayedProjects.length === 0 ? (
          <div className="p-8 text-left text-gray-500 dark:text-gray-400">
            <p className="mb-4">No projects found.</p>
            <CreateProjectButton />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" checked={selectedProjectIds.length === displayedProjects.length && displayedProjects.length > 0} onChange={e => handleSelectAll(e.target.checked)} />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {displayedProjects
                    .filter(p => !showRunningOnly || p.status === 'active')
                    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((project) => (
                      <tr
                        key={project.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => window.location.href = `/projects/${project.slug ?? project.id}`}
                      >
                        <td className="px-4 py-3">
                          <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" checked={selectedProjectIds.includes(project.id)} onChange={e => handleSelectProject(project.id, e.target.checked)} onClick={e => e.stopPropagation()} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${project.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="font-medium text-gray-900 dark:text-white">{project.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${project.status === 'active'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : project.status === 'completed'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                            {project.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${project.progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{project.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {project.domain}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setTeamModalProject(project)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Manage team"
                            >
                              <Users size={16} className="text-gray-600 dark:text-gray-400" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Analytics" onClick={() => setAnalyticsModalProject(project)}>
                              <BarChart3 size={16} className="text-blue-600 dark:text-blue-400" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Audit Log" onClick={() => setAuditLogModalProject(project)}>
                              <LogOut size={16} className="text-gray-600 dark:text-gray-400" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                              <Settings2 size={16} className="text-gray-600 dark:text-gray-400" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                              <Play size={16} className="text-gray-600 dark:text-gray-400" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                              <MoreVertical size={16} className="text-gray-600 dark:text-gray-400" />
                            </button>
                            {/* Analytics Modal */}
                            {analyticsModalProject && (
                              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                                  <h2 className="text-xl font-bold mb-4">Project Analytics: {analyticsModalProject.name}</h2>
                                  {/* TODO: Fetch and display analytics data here */}
                                  <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={() => setAnalyticsModalProject(null)}>Close</button>
                                </div>
                              </div>
                            )}
                            {/* Audit Log Modal */}
                            {auditLogModalProject && (
                              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                                  <h2 className="text-xl font-bold mb-4">Audit Log: {auditLogModalProject.name}</h2>
                                  {/* TODO: Fetch and display audit log data here */}
                                  <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={() => setAuditLogModalProject(null)}>Close</button>
                                </div>
                              </div>
                            )}
                            <button
                              onClick={(e) => handleDeleteClick(e, project.id, project.name)}
                              disabled={deleteProjectMutation.isPending && projectToDelete === project.id}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete project"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {displayedProjects.filter(p => !showRunningOnly || p.status === 'active').length} items
                </span>
                <CreateProjectButton />
              </div>
            </div>
          </>
        )}
      </div>
      <DeleteConfirmationModal
        isOpen={deleteConfirmation !== null}
        projectName={deleteConfirmation?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={deleteProjectMutation.isPending}
      />
      <ProjectTeamModal
        project={teamModalProject}
        onClose={() => setTeamModalProject(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
      />
    </div>
  )
}
