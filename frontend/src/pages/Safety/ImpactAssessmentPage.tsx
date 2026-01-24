import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { MOCK_IMPACT_ASSESSMENTS } from '../../data/mockSafety'
import type { ImpactAssessmentItem } from '../../types/safety.types'
import clsx from 'clsx'

export default function ImpactAssessmentPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<ImpactAssessmentItem | null>(null)

  const handleOpenChangeRequests = () => {
    if (projectId) navigate(`/projects/${projectId}/change-requests`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Impact Assessment
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Change Request → Safety impact. Placeholder UI; no enforcement.
        </p>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <h3 className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white">
            Change Requests
          </h3>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">CR</th>
                <th className="text-left py-2 px-4 font-medium text-gray-700 dark:text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_IMPACT_ASSESSMENTS.map((ia) => (
                <tr
                  key={ia.id}
                  onClick={() => setSelected(ia)}
                  className={clsx(
                    'border-t border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50',
                    selected?.id === ia.id && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{ia.changeRequestRef}</td>
                  <td className="py-2 px-4">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        ia.status === 'Assessed' && 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
                        ia.status === 'Pending' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
                        ia.status === 'Not Assessed' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      )}
                    >
                      {ia.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <div className="w-96 shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Detail</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">CR reference</span>
                <button
                  onClick={handleOpenChangeRequests}
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {selected.changeRequestRef}
                  <ExternalLink size={12} />
                </button>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block mb-1">Impacted hazards (mock)</span>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                  {selected.impactedHazardIds.length > 0
                    ? selected.impactedHazardIds.map((id) => <li key={id}>{id}</li>)
                    : <li className="text-gray-500">None</li>}
                </ul>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block mb-1">Impacted analyses (mock)</span>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300">
                  {selected.impactedAnalysisIds.length > 0
                    ? selected.impactedAnalysisIds.map((id) => <li key={id}>{id}</li>)
                    : <li className="text-gray-500">None</li>}
                </ul>
              </div>
              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1">Rationale</label>
                <textarea
                  defaultValue={selected.rationale}
                  placeholder="Optional"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
