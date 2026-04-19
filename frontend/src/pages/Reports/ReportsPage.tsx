import { useParams } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'

/**
 * #280: the search + filter shells did nothing. Replace with a single
 * Coming Soon card. The SafetyLinkPanel (which IS wired) stays visible
 * so the one working feature on this page is still reachable.
 */
export default function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reports</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Generated report packs and dashboards.
          </p>
        </div>
        {projectId && <SafetyLinkPanel variant="report-pack" ctaOnly />}
      </div>

      <div className="p-8 rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-center">
        <Hammer size={36} className="mx-auto mb-3 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Coming soon
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          The Reports module is not yet implemented. Tracking for a
          future release — use the Export menu on each module page in
          the meantime.
        </p>
      </div>
    </div>
  )
}
