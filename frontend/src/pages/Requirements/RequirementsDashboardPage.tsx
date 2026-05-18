import { useParams, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import ObjectiveCompletionMatrix from '../../components/common/ObjectiveCompletionMatrix'

// NX-7 (#460): the Requirements dashboard is the certification-native objective
// view (design-system.md §8.2 — "the objective view is the home view"). It
// shows the DO-178C objective-completion matrix, not requirement count tiles:
// every row advances the certification package. The count tiles + grouped
// status panels were removed; the dashboard body is <ObjectiveCompletionMatrix>.
export default function RequirementsDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()

  if (!projectId) {
    return <div className="p-6 text-ink-muted">Project not found</div>
  }

  const baseUrl = `/projects/${projectId}/requirements`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">Objective completion</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Certification objectives for this project, with the graph-derived completion state of
            each. Open an objective to see its requirements, verifications, and evidence.
          </p>
        </div>
        <Link
          to={baseUrl}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-primary hover:text-accent-primary-hover"
        >
          View all requirements
          <ChevronRight size={16} />
        </Link>
      </div>

      <ObjectiveCompletionMatrix projectId={projectId} />
    </div>
  )
}
