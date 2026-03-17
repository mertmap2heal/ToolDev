import { useState, useMemo } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import type { PBSNode } from './types'
import { validatePBS, type ValidationIssue, type ValidationSeverity } from './validation'

interface PBSValidationProps {
  nodes: PBSNode[]
  onSelectNode?: (nodeId: string) => void
}

const SEVERITY_CONFIG: Record<
  ValidationSeverity,
  { icon: typeof AlertCircle; color: string; bgColor: string; borderColor: string; label: string }
> = {
  error: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Info',
  },
}

export default function PBSValidation({ nodes, onSelectNode }: PBSValidationProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const result = useMemo(() => validatePBS(nodes), [nodes])

  // Filter out dismissed and optionally info-level issues
  const visibleIssues = useMemo(() => {
    return result.issues.filter((issue) => {
      if (dismissedIds.has(issue.id)) return false
      if (!showInfo && issue.severity === 'info') return false
      return true
    })
  }, [result.issues, dismissedIds, showInfo])

  const visibleErrorCount = visibleIssues.filter((i) => i.severity === 'error').length
  const visibleWarningCount = visibleIssues.filter((i) => i.severity === 'warning').length
  const visibleInfoCount = showInfo ? visibleIssues.filter((i) => i.severity === 'info').length : 0

  const dismissIssue = (issueId: string) => {
    setDismissedIds((prev) => new Set([...prev, issueId]))
  }

  // Don't show if no visible issues
  if (visibleIssues.length === 0 && !showInfo) {
    // Check if there are info issues we're hiding
    const hiddenInfoCount = result.issues.filter(
      (i) => i.severity === 'info' && !dismissedIds.has(i.id)
    ).length
    
    if (hiddenInfoCount === 0) return null
    
    // Show minimal indicator that there are hidden info messages
    return (
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
      >
        <Info size={14} />
        {hiddenInfoCount} suggestion{hiddenInfoCount !== 1 ? 's' : ''} available
      </button>
    )
  }

  if (visibleIssues.length === 0) return null

  return (
    <div
      className={clsx(
        'rounded-lg border overflow-hidden transition-all',
        visibleErrorCount > 0
          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
          : visibleWarningCount > 0
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
          : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10'
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {visibleErrorCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertCircle size={14} />
              {visibleErrorCount} error{visibleErrorCount !== 1 ? 's' : ''}
            </span>
          )}
          {visibleWarningCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle size={14} />
              {visibleWarningCount} warning{visibleWarningCount !== 1 ? 's' : ''}
            </span>
          )}
          {visibleInfoCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              <Info size={14} />
              {visibleInfoCount} info
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!showInfo && result.infoCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowInfo(true)
              }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Show suggestions
            </button>
          )}
          {showInfo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowInfo(false)
              }}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Hide suggestions
            </button>
          )}
          {isExpanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Issues list */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {visibleIssues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              onSelect={onSelectNode}
              onDismiss={() => dismissIssue(issue.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function IssueRow({
  issue,
  onSelect,
  onDismiss,
}: {
  issue: ValidationIssue
  onSelect?: (nodeId: string) => void
  onDismiss: () => void
}) {
  const config = SEVERITY_CONFIG[issue.severity]
  const Icon = config.icon

  return (
    <div className="flex items-start gap-3 px-3 py-2 bg-white dark:bg-gray-800/50">
      <Icon size={16} className={clsx('shrink-0 mt-0.5', config.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-gray-900 dark:text-white">{issue.message}</p>
            {issue.suggestion && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {issue.suggestion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
        {issue.nodeId && issue.nodeCode && (
          <button
            type="button"
            onClick={() => onSelect?.(issue.nodeId!)}
            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ExternalLink size={12} />
            {issue.nodeCode} — {issue.nodeName || '(unnamed)'}
          </button>
        )}
      </div>
    </div>
  )
}
