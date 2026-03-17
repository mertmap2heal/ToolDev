import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, History, ChevronDown, ChevronRight, ArrowLeftRight, Clock, User, FileText, Tag, Trash2, RotateCcw, Plus, AlertCircle, GitPullRequest, ExternalLink, Check, FileStack, Unlink, Archive } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { versionService, VersionComparison, AuditEvent } from '../../services/version.service'
import type { Requirement, RequirementVersion } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface RequirementVersionHistoryProps {
  projectId: string
  requirement: Requirement
  onClose: () => void
}

/**
 * RequirementVersionHistory component displays the complete version history
 * of a requirement with the ability to view individual versions and compare
 * changes between versions using a diff view.
 */
export default function RequirementVersionHistory({
  projectId,
  requirement,
  onClose,
}: RequirementVersionHistoryProps) {
  const navigate = useNavigate()
  const [selectedVersions, setSelectedVersions] = useState<number[]>([])
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [filter, setFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Fetch version history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['requirement-versions', projectId, requirement.id],
    queryFn: async () => {
      const response = await versionService.getRequirementVersions(projectId, requirement.id)
      return response.success && response.data ? response.data : { versions: [], auditEvents: [] }
    },
    enabled: !!projectId && !!requirement.id,
  })

  const versions = historyData?.versions || []
  const auditEvents = historyData?.auditEvents || []

  // Fetch comparison data when comparing
  const { data: comparison, isLoading: loadingComparison } = useQuery({
    queryKey: ['version-comparison', projectId, requirement.id, selectedVersions],
    queryFn: async () => {
      if (selectedVersions.length !== 2) return null
      const [v1, v2] = selectedVersions.sort((a, b) => a - b)
      const response = await versionService.compareVersions(projectId, requirement.id, v1, v2)
      return response.success && response.data ? response.data : null
    },
    enabled: isComparing && selectedVersions.length === 2,
  })

  // Toggle version selection for comparison
  const toggleVersionSelection = (version: number) => {
    setSelectedVersions((prev) => {
      if (prev.includes(version)) {
        return prev.filter((v) => v !== version)
      }
      if (prev.length >= 2) {
        return [prev[1], version]
      }
      return [...prev, version]
    })
  }

  // Toggle expanded version details
  const toggleExpanded = (version: number) => {
    setExpandedVersion((prev) => (prev === version ? null : version))
  }

  // Get field display name
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      title: 'Title',
      description: 'Description',
      priority: 'Priority',
      status: 'Status',
      stage: 'Stage',
      owner: 'Owner',
      category: 'Category',
      source: 'Source',
      verificationMethod: 'Verification Method',
      acceptanceCriteria: 'Acceptance Criteria',
      tags: 'Tags',
    }
    return labels[field] || field
  }

  // Get icon and label for audit action
  const getActionDisplay = (action: string) => {
    switch (action) {
      case 'REQUIREMENT_DELETED_SOFT':
        return { icon: Trash2, label: 'moved to trash', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' }
      case 'REQUIREMENT_RESTORED':
        return { icon: RotateCcw, label: 'restored requirement', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' }
      case 'REQUIREMENT_CREATED':
        return { icon: Plus, label: 'created requirement', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' }
      case 'REQUIREMENT_PERMANENTLY_DELETED':
        return { icon: Trash2, label: 'permanently deleted', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' }
      case 'ISSUE_LINKED':
        return { icon: AlertCircle, label: 'linked issue', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800' }
      case 'CHANGE_REQUEST_LINKED':
        return { icon: GitPullRequest, label: 'linked change request', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' }
      case 'TEST_CASE_LINKED':
        return { icon: Check, label: 'linked test case', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' }
      case 'TEST_CASE_UNLINKED':
        return { icon: Unlink, label: 'unlinked test case', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800' }
      case 'TEST_PLAN_LINKED':
        return { icon: FileStack, label: 'linked test plan', color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-800' }
      case 'TEST_PLAN_UNLINKED':
        return { icon: Unlink, label: 'unlinked test plan', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800' }
      default:
        return { icon: FileText, label: action.toLowerCase().replace(/_/g, ' '), color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800' }
    }
  }

  // Render diff view for two versions
  const renderDiff = (comparison: VersionComparison) => {
    const { versionA, versionB, changedFields } = comparison

    const fields: (keyof RequirementVersion)[] = [
      'title',
      'description',
      'priority',
      'status',
      'stage',
      'owner',
      'category',
      'source',
      'verificationMethod',
      'acceptanceCriteria',
      'tags',
    ]

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700">
          <span>Version {versionA.version}</span>
          <ArrowLeftRight size={16} />
          <span>Version {versionB.version}</span>
        </div>

        {changedFields.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            No differences found between these versions.
          </p>
        ) : (
          <div className="space-y-3">
            {fields.map((field) => {
              const isChanged = changedFields.includes(field)
              if (!isChanged) return null

              const valueA = field === 'tags'
                ? (versionA.tags || []).join(', ') || '—'
                : (versionA[field] as string) || '—'
              const valueB = field === 'tags'
                ? (versionB.tags || []).join(', ') || '—'
                : (versionB[field] as string) || '—'

              return (
                <div key={field} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                    {getFieldLabel(field)}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                      <p className="text-xs text-red-500 dark:text-red-400 mb-1">Before (v{versionA.version})</p>
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                        {valueA}
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                      <p className="text-xs text-green-500 dark:text-green-400 mb-1">After (v{versionB.version})</p>
                      <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                        {valueB}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <History className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Version History
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {requirement.requirementId || requirement.id.substring(0, 8)} - {requirement.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {versions.length + auditEvents.length} event{versions.length + auditEvents.length !== 1 ? 's' : ''} recorded
            </span>
            <select value={filter} onChange={e => setFilter(e.target.value)} className="ml-4 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm">
              <option value="all">All</option>
              <option value="version">Versions</option>
              <option value="baselined">Baselined</option>
              <option value="audit">Audit Events</option>
              <option value="linked">Linked Artifacts</option>
              <option value="edit">Edits</option>
              <option value="delete">Deletes</option>
              <option value="restore">Restores</option>
            </select>
            <button
              onClick={async () => {
                setIsExporting(true);
                // Export logic (CSV)
                const timeline = [
                  ...versions.map(v => ({ type: 'version', data: v, date: new Date(v.createdAt) })),
                  ...auditEvents.map(e => ({ type: 'audit', data: e, date: new Date(e.performedAt) }))
                ].sort((a, b) => b.date.getTime() - a.date.getTime());
                const csvRows = [
                  'Type,Date,User,Action,Title,Reason,Details',
                  ...timeline.map(item => {
                    if (item.type === 'version') {
                      const v = item.data as RequirementVersion;
                      return `Version,${item.date.toISOString()},${v.changedByName || ''},Edit,${v.title},${v.changeReason || ''},Version ${v.version}`;
                    } else {
                      const e = item.data as AuditEvent;
                      return `Audit,${item.date.toISOString()},${e.performedByUser?.name || 'System'},${e.action},${e.newValue?.title || ''},${e.newValue?.reason || ''},${JSON.stringify(e.newValue)}`;
                    }
                  })
                ];
                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `requirement_version_history_${requirement.requirementId || requirement.id}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setIsExporting(false);
              }}
              className="ml-4 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              disabled={isExporting}
            >
              Export CSV
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsComparing(false)}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                !isComparing
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              Timeline
            </button>
            <button
              onClick={() => setIsComparing(true)}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                isComparing
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              Compare
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading version history...
            </div>
          ) : (versions.length === 0 && auditEvents.length === 0) ? (
            <div className="text-center py-8">
              <History size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                No version history
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Version history will be recorded when the requirement is updated.
              </p>
            </div>
          ) : isComparing ? (
            // Compare Mode
            <div className="space-y-4">
              {selectedVersions.length < 2 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                  Select two versions below to compare
                </div>
              )}

              {/* Version Selection */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => toggleVersionSelection(version.version)}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                      selectedVersions.includes(version.version)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    )}
                  >
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                      selectedVersions.includes(version.version)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    )}>
                      {version.version}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {version.title}
                        </p>
                        {version.baselineId && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            <Archive size={12} />
                            Baselined
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(version.createdAt), 'PPp')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Diff View */}
              {selectedVersions.length === 2 && (
                loadingComparison ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Loading comparison...
                  </div>
                ) : comparison ? (
                  renderDiff(comparison)
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Unable to load comparison
                  </div>
                )
              )}
            </div>
          ) : (
            // Timeline Mode
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

              <div className="space-y-4">
                {/* Current Version */}
                <div className="relative pl-10">
                  <div className="absolute left-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">
                        Current Version
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(requirement.updatedAt), 'PPp')}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">{requirement.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Status: {requirement.status} | Priority: {requirement.priority}
                    </p>
                  </div>
                </div>

                {/* Merge and sort versions and audit events by date, with filtering */}
                {(() => {
                  let timeline: Array<{ type: 'version' | 'audit'; data: any; date: Date }> = [
                    ...versions.map(v => ({ type: 'version' as const, data: v, date: new Date(v.createdAt) })),
                    ...auditEvents.map(e => ({ type: 'audit' as const, data: e, date: new Date(e.performedAt) })),
                  ].sort((a, b) => b.date.getTime() - a.date.getTime());
                  if (filter !== 'all') {
                    timeline = timeline.filter(item => {
                      if (filter === 'version') return item.type === 'version';
                      if (filter === 'baselined') return item.type === 'version' && !!(item.data as RequirementVersion).baselineId;
                      if (filter === 'audit') return item.type === 'audit';
                      if (filter === 'linked') return item.type === 'audit' && ['ISSUE_LINKED','CHANGE_REQUEST_LINKED','TEST_CASE_LINKED','TEST_PLAN_LINKED'].includes(item.data.action);
                      if (filter === 'edit') return item.type === 'version';
                      if (filter === 'delete') return item.type === 'audit' && ['REQUIREMENT_DELETED_SOFT','REQUIREMENT_PERMANENTLY_DELETED'].includes(item.data.action);
                      if (filter === 'restore') return item.type === 'audit' && item.data.action === 'REQUIREMENT_RESTORED';
                      return true;
                    });
                  }
                  return timeline.map((item, index) => {
                    if (item.type === 'version') {
                      const version = item.data as RequirementVersion;
                      return (
                        <div key={`version-${version.id}`} className="relative pl-10">
                          <div className={clsx(
                            'absolute left-2 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800',
                            version.baselineId ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                          )} />
                          <div className="bg-white dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Version {version.version}
                                </span>
                                {version.baselineId && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                    <Archive size={12} />
                                    Baselined
                                  </span>
                                )}
                                {version.changedByName && (
                                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <User size={12} />
                                    {version.changedByName}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {format(item.date, 'PPp')}
                              </span>
                            </div>
                            <div
                              className="cursor-pointer"
                              onClick={() => toggleExpanded(version.version)}
                            >
                              <div className="flex items-center gap-2">
                                {expandedVersion === version.version ? (
                                  <ChevronDown size={16} className="text-gray-500" />
                                ) : (
                                  <ChevronRight size={16} className="text-gray-500" />
                                )}
                                <p className="font-medium text-gray-900 dark:text-white">{version.title}</p>
                              </div>
                            </div>
                            {version.changeReason && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                                "{version.changeReason}"
                              </p>
                            )}
                            {expandedVersion === version.version && (
                              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                                {version.baselineId && (
                                  <div className="mb-3 p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Baseline</p>
                                    <p className="text-sm text-gray-900 dark:text-white">{version.baselineName ?? '—'}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{version.baselineId}</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onClose()
                                        navigate(`/projects/${projectId}/requirements?openBaselines=1&baselineId=${version.baselineId}`)
                                      }}
                                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      <ExternalLink size={14} />
                                      View baseline
                                    </button>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Status:</span>{' '}
                                    <span className="text-gray-900 dark:text-white">{version.status}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-gray-400">Priority:</span>{' '}
                                    <span className="text-gray-900 dark:text-white">{version.priority}</span>
                                  </div>
                                  {version.owner && (
                                    <div>
                                      <span className="text-gray-500 dark:text-gray-400">Owner:</span>{' '}
                                      <span className="text-gray-900 dark:text-white">{version.owner}</span>
                                    </div>
                                  )}
                                  {version.category && (
                                    <div>
                                      <span className="text-gray-500 dark:text-gray-400">Category:</span>{' '}
                                      <span className="text-gray-900 dark:text-white">{version.category}</span>
                                    </div>
                                  )}
                                </div>
                                {version.description && (
                                  <div className="mt-2">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Description:</p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                      {version.description.substring(0, 200)}
                                      {version.description.length > 200 && '...'}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      // Audit event
                      const event = item.data as AuditEvent;
                      const actionDisplay = getActionDisplay(event.action);
                      const ActionIcon = actionDisplay.icon;
                      return (
                        <div key={`audit-${event.id}`} className="relative pl-10">
                          <div className={`absolute left-2 w-4 h-4 ${actionDisplay.bg} rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${actionDisplay.color.replace('text-', 'bg-')}`} />
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-x-1.5 text-sm text-gray-900 dark:text-white">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {event.performedByUser?.name || 'System'}
                                  </span>
                                  <span className={`${actionDisplay.color} flex items-center gap-1`}>
                                    <ActionIcon size={14} className="inline-block" />
                                    {actionDisplay.label}
                                  </span>
                                  {/* Inline Entity Details if available */}
                                  {(event.action === 'ISSUE_LINKED' || event.action === 'CHANGE_REQUEST_LINKED' || event.action === 'TEST_CASE_LINKED' || event.action === 'TEST_PLAN_LINKED') && event.newValue && (
                                    <a
                                      href={
                                        event.action === 'ISSUE_LINKED' ? `/projects/${projectId}/issues/${event.newValue.issueId || event.newValue.id}` :
                                          event.action === 'CHANGE_REQUEST_LINKED' ? `/projects/${projectId}/change-requests/${event.newValue.id}?changeRequestId=${event.newValue.id}` :
                                            event.action === 'TEST_CASE_LINKED' ? `/verification?tab=test-cases&caseId=${event.newValue.testCaseId}` :
                                              event.action === 'TEST_PLAN_LINKED' ? `/verification?tab=test-plans&planId=${event.newValue.testPlanId}` :
                                                '#'
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      {event.newValue.issueKey || event.newValue.crId || event.newValue.testCaseKey || event.newValue.testPlanKey}
                                      <span className="opacity-75 font-normal">
                                        {event.newValue.title || event.newValue.name}
                                      </span>
                                    </a>
                                  )}
                                  {(event.action === 'TEST_CASE_UNLINKED' || event.action === 'TEST_PLAN_UNLINKED') && event.oldValue && (
                                    <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 line-through">
                                      {event.oldValue.testCaseKey || event.oldValue.testPlanKey}
                                      <span className="opacity-75">
                                        {event.oldValue.title || event.oldValue.name}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                {event.newValue?.reason && (
                                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                    "{event.newValue.reason}"
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                                {format(item.date, 'PPp')}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Version history tracks all changes, deletions, and restorations.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
