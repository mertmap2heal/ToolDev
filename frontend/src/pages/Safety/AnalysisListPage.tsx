import { useParams, useNavigate } from 'react-router-dom'
import { Plus, ExternalLink, Copy } from 'lucide-react'
import { MOCK_ANALYSES, MOCK_METHOD_METADATA } from '../../data/mockSafety'
import type { SafetyMethod } from '../../types/safety.types'
import { format } from 'date-fns'

const METHOD_IDS: SafetyMethod[] = [
  'FHA',
  'PSSA',
  'SSA',
  'FMEA',
  'FTA',
  'CCA',
  'Markov',
]

export default function AnalysisListPage() {
  const { projectId, method } = useParams<{ projectId: string; method: string }>()
  const navigate = useNavigate()

  const methodKey = (method ?? '').toUpperCase() as SafetyMethod
  const isValidMethod = METHOD_IDS.includes(methodKey)
  const meta = MOCK_METHOD_METADATA.find((m) => m.id === methodKey)
  const analyses = isValidMethod ? (MOCK_ANALYSES[methodKey] ?? []) : []

  const handleCreate = () => {
    if (projectId && isValidMethod) {
      navigate(`/projects/${projectId}/safety-analysis/analyses/${method}/new`)
    }
  }

  const handleOpen = (id: string) => {
    if (projectId && isValidMethod) {
      navigate(`/projects/${projectId}/safety-analysis/analyses/${method}/${id}`)
    }
  }

  const handleDuplicate = () => {
    alert('Duplicate will be implemented later. UI only.')
  }

  if (!isValidMethod) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Unknown method</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Method &quot;{method}&quot; not found. Use FHA, PSSA, SSA, FMEA, FTA, CCA, or Markov.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {meta?.name ?? methodKey} — Analyses
          </h2>
          {meta && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {meta.description}
            </p>
          )}
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Create New
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                ID
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                Title
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                Baseline
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                Linked Hazards
              </th>
              <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                Updated
              </th>
              <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {analyses.map((a) => (
              <tr
                key={a.id}
                className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="py-3 px-4 font-mono text-gray-900 dark:text-white">{a.id}</td>
                <td className="py-3 px-4 text-gray-900 dark:text-white">{a.title}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {a.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                  {a.baselineName ?? '—'}
                </td>
                <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                  {a.linkedHazardsCount}
                </td>
                <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                  {format(new Date(a.updatedAt), 'PP')}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpen(a.id)}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      Open
                    </button>
                    <button
                      onClick={handleDuplicate}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Duplicate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {analyses.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No analyses yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  )
}
