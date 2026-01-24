import { useNavigate, useParams } from 'react-router-dom'
import { Shield, ExternalLink } from 'lucide-react'

interface SafetyLinkPanelProps {
  variant:
    | 'linked'
    | 'impact'
    | 'relevance'
    | 'evidence'
    | 'coverage'
    | 'impact-status'
    | 'report-pack'
    | 'by-phase'
    | 'archived'
  count?: number
  badge?: string
  ctaOnly?: boolean
}

const LABELS: Record<string, { label: string; cta: string }> = {
  linked: { label: 'Linked Safety Items', cta: 'Open Safety' },
  impact: { label: 'Safety Impact', cta: 'Open Safety' },
  relevance: { label: 'Safety Relevance', cta: 'Open Safety' },
  evidence: { label: 'Safety Evidence', cta: 'Open Safety' },
  coverage: { label: 'Safety Coverage', cta: 'Open Safety' },
  'impact-status': { label: 'Safety Impact Status', cta: 'Open Safety' },
  'report-pack': { label: 'Safety Report Pack', cta: 'Open Safety' },
  'by-phase': { label: 'Safety by Phase', cta: 'Open Safety' },
  archived: { label: 'Archived Safety Items', cta: 'Open Safety' },
}

export default function SafetyLinkPanel({
  variant,
  count = 0,
  badge,
  ctaOnly = false,
}: SafetyLinkPanelProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { label, cta } = LABELS[variant] ?? { label: 'Safety', cta: 'Open Safety' }

  const handleOpen = () => {
    if (projectId) navigate(`/projects/${projectId}/safety-analysis`)
  }

  if (ctaOnly) {
    return (
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium"
      >
        <Shield size={14} />
        {cta}
        <ExternalLink size={12} />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <Shield size={16} className="text-gray-500 dark:text-gray-400" />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      {badge != null ? (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400">
          {badge}
        </span>
      ) : (
        <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
      )}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 ml-1 px-2 py-1 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
      >
        {cta}
        <ExternalLink size={10} />
      </button>
    </div>
  )
}
