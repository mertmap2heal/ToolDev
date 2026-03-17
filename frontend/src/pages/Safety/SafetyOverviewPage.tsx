import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  FileSearch,
  GitBranch,
  Link2,
  Plus,
  BarChart3,
} from 'lucide-react'
import { projectService } from '../../services/project.service'
import {
  MOCK_HAZARDS,
  MOCK_HAZARD_BY_SEVERITY,
  MOCK_METHOD_METADATA,
  MOCK_TOP_BLOCKERS,
} from '../../data/mockSafety'

export default function SafetyOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await projectService.getProject(projectId)
      return response.success && response.data ? response.data : null
    },
    enabled: !!projectId,
  })

  const totalHazards = MOCK_HAZARDS.length
  const totalAnalyses = MOCK_METHOD_METADATA.reduce(
    (acc, m) => acc + m.draftCount + m.inReviewCount + m.approvedCount,
    0
  )
  const missingLinks = MOCK_HAZARDS.filter(
    (h) =>
      h.linkedRequirementsCount === 0 ||
      h.linkedVerificationCount === 0 ||
      h.linkedInterfacesCount === 0
  ).length

  const handleQuickAction = (action: string) => {
    if (!projectId) return
    switch (action) {
      case 'hazard':
        navigate(`/projects/${projectId}/safety-analysis/hazards`)
        break
      case 'analysis':
        navigate(`/projects/${projectId}/safety-analysis/analyses`)
        break
      case 'fta':
        navigate(`/projects/${projectId}/safety-analysis/visual-analysis`)
        break
      case 'markov':
        navigate(`/projects/${projectId}/safety-analysis/markov`)
        break
      default:
        break
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Safety Overview
      </h2>

      {/* Context */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Context</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Project:</span>{' '}
            <span className="text-gray-900 dark:text-white">
              {projectData?.name ?? 'Project'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">System:</span>{' '}
            <span className="text-gray-600 dark:text-gray-300">
              Coming from System Structure
            </span>
          </div>
          <div>
            <label className="text-gray-500 dark:text-gray-400 mr-2">Baseline:</label>
            <select className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option>— Select baseline —</option>
              <option>BL-001</option>
              <option>BL-002</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <AlertTriangle size={16} />
            Total Hazards
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalHazards}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <BarChart3 size={16} />
            Hazards by Severity
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Catastrophic: {MOCK_HAZARD_BY_SEVERITY.Catastrophic ?? 0} · Major:{' '}
            {MOCK_HAZARD_BY_SEVERITY.Major ?? 0}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <FileSearch size={16} />
            Total Analyses
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalAnalyses}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <Link2 size={16} />
            Missing Links
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{missingLinks}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Blockers */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
            Top Blockers
          </h3>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {MOCK_TOP_BLOCKERS.map((b) => (
              <li
                key={b.id}
                className="px-4 py-3 flex items-center justify-between text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">{b.label}</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">{b.count}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h3>
          <div className="p-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleQuickAction('hazard')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Create Hazard
            </button>
            <button
              onClick={() => handleQuickAction('analysis')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Create Safety Analysis
            </button>
            <button
              onClick={() => handleQuickAction('fta')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              <GitBranch size={16} />
              Create Fault Tree
            </button>
            <button
              onClick={() => handleQuickAction('markov')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              <BarChart3 size={16} />
              Create Markov Model
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
