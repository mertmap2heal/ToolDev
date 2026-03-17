import { useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, ExternalLink, FileText, Settings, AlertCircle, GitPullRequest, Layers, ClipboardList, Link2, Loader2, Sliders } from 'lucide-react'
import type { LinkedElementClickPayload } from './RequirementsPBSTree'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import { parameterService } from '../../services/parameter.service'

interface LinkedElementPreviewPopoverProps {
  payload: LinkedElementClickPayload
  projectId: string | undefined
  onViewDetails: () => void
  onClose: () => void
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'function':
      return Settings
    case 'parameter':
      return Sliders
    case 'issue':
      return AlertCircle
    case 'change_request':
      return GitPullRequest
    case 'requirement':
    case 'hazard':
    case 'risk':
      return FileText
    case 'use_case':
      return Layers
    case 'test_plan':
    case 'test_case':
      return ClipboardList
    default:
      return Link2
  }
}

function formatTypeLabel(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function formatLinkType(linkType: string): string {
  return linkType?.replace(/_/g, ' ') ?? ''
}

/** Strip HTML tags from content so plain text is shown (e.g. "<p>test</p>" → "test") */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export default function LinkedElementPreviewPopover({
  payload,
  projectId,
  onViewDetails,
  onClose,
}: LinkedElementPreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  const { targetType, targetId, sourceType, sourceId, isOutgoing, link } = payload
  const entityType = isOutgoing ? targetType : sourceType
  const entityId = isOutgoing ? targetId : sourceId
  const displayId = isOutgoing
    ? (link.targetDisplayId ?? link.targetLabel ?? link.targetTitle ?? entityId.slice(0, 8))
    : (link.sourceDisplayId ?? link.sourceTitle ?? entityId.slice(0, 8))
  const displayName = isOutgoing
    ? (link.targetLabel ?? link.targetTitle ?? link.targetDisplayId ?? `${entityType}:${entityId.slice(0, 8)}`)
    : (link.sourceTitle ?? link.sourceDisplayId ?? `${entityType}:${entityId.slice(0, 8)}`)

  const linkType = (link as { linkType?: string }).linkType
  const description = isOutgoing
    ? (link as { targetDescription?: string }).targetDescription
    : (link as { sourceDescription?: string }).sourceDescription

  const fetchableTypes = ['requirement', 'function', 'parameter', 'issue', 'change_request', 'hazard', 'risk']
  const canFetch = !!projectId && fetchableTypes.includes(entityType)

  const { data: entity, isLoading } = useQuery({
    queryKey: ['linked-element-preview', projectId, entityType, entityId],
    queryFn: async () => {
      if (!projectId) return null
      if (entityType === 'requirement' || entityType === 'hazard' || entityType === 'risk') {
        const r = await requirementService.getRequirement(projectId, entityId)
        return r.success ? r.data : null
      }
      if (entityType === 'function') {
        const r = await functionService.getFunction(projectId, entityId)
        return r.success ? r.data : null
      }
      if (entityType === 'parameter') {
        const r = await parameterService.getParameter(projectId, entityId)
        return r.success ? r.data : null
      }
      if (entityType === 'issue') {
        const r = await issueService.getIssue(projectId, entityId)
        return r.success ? r.data : null
      }
      if (entityType === 'change_request') {
        const r = await changeRequestService.getChangeRequest(projectId, entityId)
        return r.success ? r.data : null
      }
      return null
    },
    enabled: canFetch,
  })

  const status = entity && 'status' in entity ? (entity as { status?: string }).status : undefined
  const entityDescription = entity && 'description' in entity ? (entity as { description?: string }).description : undefined
  const fullDescription = entityDescription ?? description

  // Type-specific detail rows
  const detailRows: { label: string; value: string | undefined }[] = []
  if (entity) {
    const e = entity as unknown as Record<string, unknown>
    if (entityType === 'requirement' || entityType === 'hazard' || entityType === 'risk') {
      if (e.priority) detailRows.push({ label: 'Priority', value: String(e.priority) })
      if (e.owner) detailRows.push({ label: 'Owner', value: String(e.owner) })
      if (e.verificationStatus) detailRows.push({ label: 'Verification', value: String(e.verificationStatus) })
      if (e.verificationMethod) detailRows.push({ label: 'Method', value: String(e.verificationMethod) })
      if (e.requirementType) detailRows.push({ label: 'Type', value: String(e.requirementType).replace(/_/g, ' ') })
      if (e.requirementLevel) detailRows.push({ label: 'Level', value: String(e.requirementLevel) })
      if (e.reviewStatus) detailRows.push({ label: 'Review', value: String(e.reviewStatus) })
    } else if (entityType === 'function') {
      if (e.owner) detailRows.push({ label: 'Owner', value: String(e.owner) })
      if (e.criticality) detailRows.push({ label: 'Criticality', value: String(e.criticality) })
      if ((e.parent as { name?: string } | undefined)?.name) detailRows.push({ label: 'Parent', value: (e.parent as { name?: string }).name })
    } else if (entityType === 'issue') {
      if (e.priority) detailRows.push({ label: 'Priority', value: String(e.priority) })
      if (e.issueType) detailRows.push({ label: 'Type', value: String(e.issueType) })
      const assignee = e.assignee as { name?: string } | undefined
      if (assignee?.name) detailRows.push({ label: 'Assignee', value: assignee.name })
      if (e.dueDate) detailRows.push({ label: 'Due', value: String(e.dueDate).slice(0, 10) })
      const labels = e.labels as { name?: string }[] | undefined
      if (labels?.length) detailRows.push({ label: 'Labels', value: labels.map((l: { name?: string }) => l.name).filter(Boolean).join(', ') })
    } else if (entityType === 'change_request') {
      if (e.priority) detailRows.push({ label: 'Priority', value: String(e.priority) })
      if (e.requestedBy) detailRows.push({ label: 'Requested by', value: String(e.requestedBy) })
      if (e.owner) detailRows.push({ label: 'Owner', value: String(e.owner) })
      if (e.risk) detailRows.push({ label: 'Risk', value: String(e.risk) })
      if (e.effort) detailRows.push({ label: 'Effort', value: String(e.effort) })
    } else if (entityType === 'parameter') {
      if (e.defaultValue != null) detailRows.push({ label: 'Value', value: String(e.defaultValue) })
      if (e.unit) detailRows.push({ label: 'Unit', value: String(e.unit) })
      if (e.dataType) detailRows.push({ label: 'Data type', value: String(e.dataType) })
      if (e.status) detailRows.push({ label: 'Status', value: String(e.status) })
    }
    if (e.createdAt) detailRows.push({ label: 'Created', value: new Date(String(e.createdAt)).toLocaleDateString() })
    if (e.updatedAt) detailRows.push({ label: 'Updated', value: new Date(String(e.updatedAt)).toLocaleDateString() })
  }

  const Icon = getTypeIcon(entityType)
  const typeLabel = formatTypeLabel(entityType)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      ref={popoverRef}
      className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/90 p-4 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.3)] max-h-[50vh] overflow-y-auto"
      role="dialog"
      aria-label="Linked element preview"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {typeLabel}
              </span>
              {linkType && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {formatLinkType(linkType)}
                </span>
              )}
              {status && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                  {status}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white" title={displayName}>
              {displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono" title={entityId}>
              {displayId}
            </p>
            {isLoading && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 size={12} className="animate-spin" />
                <span>Loading details…</span>
              </div>
            )}
            {fullDescription && !isLoading && (
              <p
                className="text-xs text-gray-600 dark:text-gray-300 line-clamp-4 mt-1"
                title={stripHtml(fullDescription)}
              >
                {stripHtml(fullDescription)}
              </p>
            )}
            {detailRows.length > 0 && !isLoading && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2 border-t border-gray-200/60 dark:border-gray-700/60">
                {detailRows.map(({ label, value }) =>
                  value ? (
                    <div key={label} className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase shrink-0">{label}:</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate" title={value}>{value}</span>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 flex-shrink-0"
          aria-label="Close preview"
        >
          <X size={18} />
        </button>
      </div>
      <button
        type="button"
        onClick={onViewDetails}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
      >
        <ExternalLink size={14} />
        View full details
      </button>
    </div>
  )
}
