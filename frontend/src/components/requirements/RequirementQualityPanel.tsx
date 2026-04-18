import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  X,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  ExternalLink,
  Link as LinkIcon,
  Loader,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  EyeOff,
  Eye,
  Download,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/api'
import { requirementService } from '../../services/requirement.service'
import { linkService } from '../../services/link.service'
import { authService } from '../../services/auth.service'
import { verificationService } from '../../services/verification.service'
import {
  type LinkageTargetType,
  LINKAGE_TARGET_OPTIONS,
  LINK_TYPE_MAP,
  linkageTargetOptionFor,
} from '../../linkage/requirementLinkDialogConfig'
import type { ApiResponse } from 'shared/types/api.types'
import type { UpdateRequirementDto } from 'shared/types/engineering.types'
import type { EntitySummary } from 'shared/types/linkage.types'
import { invalidateLinkCaches } from '../../utils/invalidateLinkCaches'
import RichTextEditor from '../common/RichTextEditor'
import clsx from 'clsx'
import {
  fetchQualityDismissals,
  upsertQualityDismissals,
  deleteQualityDismissal,
  deleteAllDismissalsForRequirement,
  clearAllDismissalsForProject,
  bulkSkipWarnings,
  type QualityDismissalRow,
} from '../../services/requirementQualityWorkbench'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { qualityWorkbenchSqueezeStyle } from './qualityWorkbenchLayout'
import { downloadQualityCsv, downloadQualityPdf } from '../../utils/exportQualityReport'

// ─── Types ───────────────────────────────────────────────────────────

interface ValidationIssue {
  message: string
  severity: 'error' | 'warning'
  fixType: 'field' | 'trace' | 'info'
  fixField?: string
  fixLinkType?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  issues: ValidationIssue[]
  score: number
}

interface RequirementQualityCheck {
  requirementId: string
  displayId: string | null
  title: string
  validation: ValidationResult
}

export type ProjectQualityCompare =
  | {
      hasPrevious: false
      avgScoreDelta: number
      avgScorePrevious: number | null
      avgScoreCurrent: number
      improvedCount: number
      regressedCount: number
      previousCapturedAt: string | null
    }
  | {
      hasPrevious: true
      avgScoreDelta: number
      avgScorePrevious: number | null
      avgScoreCurrent: number
      improvedCount: number
      regressedCount: number
      previousCapturedAt: string | null
    }

interface ProjectValidationResult {
  requirements: RequirementQualityCheck[]
  circularDependencies: string[][]
  duplicateIds: string[]
  compare?: ProjectQualityCompare
}

type SeverityFilter = 'all' | 'errors' | 'warnings' | 'passing'
type ScoreFilter = 'all' | 'critical' | 'needs_work' | 'good' | 'excellent'
type FixTypeFilter = 'all' | 'field' | 'trace' | 'info'
type SortMode = 'score_asc' | 'score_desc' | 'title_asc'

// ─── Props ───────────────────────────────────────────────────────────

interface RequirementQualityPanelProps {
  projectId: string
  onClose: () => void
  onRequirementClick?: (requirementId: string) => void
  onRequirementUpdated?: () => void
  /** Deep link: pre-select this requirement when data loads */
  initialSelectedRequirementId?: string | null
  /** Label for exported filenames */
  projectDisplayName?: string
  /** Shrink workbench to the left when the full editor is open beside it */
  squeezeForSideEditor?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────

const defaultRequirementTypes = ['Functional', 'Non-functional', 'Performance', 'Safety', 'Interface']
const defaultLevels = ['System', 'Subsystem', 'Component']
const defaultRiskValues = ['Low', 'Medium', 'High', 'Critical']
const defaultComplexityValues = ['Low', 'Medium', 'High']

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getScoreBgColor(score: number) {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/20'
  if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20'
  return 'bg-red-100 dark:bg-red-900/20'
}

function linkTypeToTargetType(linkType: string): LinkageTargetType | null {
  switch (linkType) {
    case 'allocated_to': return 'pbs_component'
    case 'verified_by': return 'test_case'
    case 'documented_in': return 'document'
    default: return null
  }
}

function linkTypeToLabel(linkType: string): string {
  switch (linkType) {
    case 'allocated_to': return 'PBS Component'
    case 'verified_by': return 'Test Case'
    case 'documented_in': return 'Document'
    default: return linkType
  }
}

function issueKey(issue: ValidationIssue): string {
  return `${issue.severity}:${issue.message}`
}

function loadDismissedIssues(projectId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(`quality-dismissed-${projectId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function computeAdjustedScore(check: RequirementQualityCheck, dismissed: Set<string>): number {
  const issues = check.validation.issues ?? []
  if (issues.length === 0) return check.validation.score
  const dismissedCount = issues.filter(i => dismissed.has(issueKey(i))).length
  if (dismissedCount === 0) return check.validation.score
  const boost = (100 - check.validation.score) * (dismissedCount / issues.length)
  return Math.min(100, Math.round(check.validation.score + boost))
}

// ─── Inline Trace Link Creator ───────────────────────────────────────

function InlineTraceLinkCreator({
  projectId,
  requirementId,
  fixLinkType,
  onCreated,
}: {
  projectId: string
  requirementId: string
  fixLinkType: string
  onCreated: () => void
}) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTarget, setSelectedTarget] = useState<EntitySummary | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const targetType = linkTypeToTargetType(fixLinkType)
  const targetOpt = targetType ? linkageTargetOptionFor(targetType) : null

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['quality-link-targets', projectId, targetType, debouncedSearch],
    queryFn: async () => {
      if (!targetOpt) return []
      return targetOpt.adapter.search(debouncedSearch, projectId)
    },
    enabled: expanded && !!targetOpt && !!projectId,
  })

  const normType = (s: string) => s.toLowerCase().replace(/-/g, '_')
  const filtered = useMemo(
    () => targetType ? results.filter(t => normType(t.type) === normType(targetType)) : results,
    [results, targetType],
  )

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTarget || !targetType) throw new Error('No target selected')
      return linkService.createLink(projectId, {
        sourceType: 'requirement',
        sourceId: requirementId,
        targetType: targetType,
        targetId: selectedTarget.id,
        linkType: LINK_TYPE_MAP[targetType] || fixLinkType,
      })
    },
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
      setSelectedTarget(null)
      setSearchQuery('')
      setExpanded(false)
      onCreated()
    },
  })

  if (!targetType || !targetOpt) return null

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <LinkIcon size={12} />
        Add {linkTypeToLabel(fixLinkType)}
      </button>
    )
  }

  return (
    <div className="mt-2 border border-blue-200 dark:border-blue-700 rounded-lg p-3 bg-blue-50/50 dark:bg-blue-900/10">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${linkTypeToLabel(fixLinkType).toLowerCase()}s...`}
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => { setExpanded(false); setSelectedTarget(null); setSearchQuery('') }}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-32 overflow-y-auto space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader size={14} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-2">No targets found</div>
        ) : (
          filtered.slice(0, 20).map(target => (
            <button
              key={target.id}
              onClick={() => setSelectedTarget(target)}
              className={clsx(
                'w-full text-left px-2 py-1.5 text-xs rounded transition-colors',
                selectedTarget?.id === target.id
                  ? 'bg-blue-100 dark:bg-blue-800/30 text-blue-800 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <span className="font-medium">{target.label || target.id.substring(0, 8)}</span>
              {target.description && <span className="ml-1.5 text-gray-500 dark:text-gray-400">— {target.description}</span>}
            </button>
          ))
        )}
      </div>

      {selectedTarget && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Selected: <strong>{selectedTarget.label || selectedTarget.id.substring(0, 8)}</strong>
          </span>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? <Loader size={12} className="animate-spin" /> : <LinkIcon size={12} />}
            Create Link
          </button>
        </div>
      )}
      {createMutation.isError && (
        <p className="mt-1 text-xs text-red-500">Failed to create link. Please try again.</p>
      )}
    </div>
  )
}

// ─── Issues List (extracted to avoid IIFE in JSX) ────────────────────

function IssuesList({
  issues,
  errors,
  warnings,
  renderFieldEditor,
  dismissedKeys,
  resolved,
  onSkip,
  onUnskip,
  showDismissed,
  onToggleDismissed,
  getSkipReason,
}: {
  issues?: ValidationIssue[]
  errors: string[]
  warnings: string[]
  renderFieldEditor: (issue: ValidationIssue, isFirst: boolean) => JSX.Element | null
  dismissedKeys: Set<string>
  resolved: ValidationIssue[]
  onSkip: (issue: ValidationIssue) => void
  onUnskip: (key: string) => void
  showDismissed: boolean
  onToggleDismissed: () => void
  getSkipReason?: (issueKey: string) => string | undefined
}) {
  if (issues && issues.length > 0) {
    const activeIssues = issues.filter(i => !dismissedKeys.has(issueKey(i)))
    const skippedIssues = issues.filter(i => dismissedKeys.has(issueKey(i)))
    const seenFields = new Set<string>()

    const activeKeys = new Set(issues.map(i => issueKey(i)))
    const uniqueResolved = resolved.filter(i => !activeKeys.has(issueKey(i)))

    return (
      <div className="space-y-3">
        {activeIssues.length > 0 ? (
          activeIssues.map((issue, idx) => {
            const key = issueKey(issue)
            const fieldKey = issue.fixField ?? issue.fixLinkType ?? ''
            const isFirstForField = fieldKey ? !seenFields.has(fieldKey) : true
            if (fieldKey) seenFields.add(fieldKey)
            return (
              <div
                key={`a-${idx}`}
                className={clsx(
                  'border rounded-lg p-3',
                  issue.severity === 'error'
                    ? 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10'
                    : 'border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10'
                )}
              >
                <div className="flex items-start gap-2">
                  {issue.severity === 'error' ? (
                    <AlertCircle size={14} className="text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-yellow-500 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={clsx(
                        'text-sm',
                        issue.severity === 'error'
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-yellow-700 dark:text-yellow-300'
                      )}>
                        {issue.message}
                      </p>
                      <button
                        type="button"
                        onClick={() => onSkip(issue)}
                        title="Skip this suggestion (won't affect score)"
                        aria-label="Skip this suggestion"
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <EyeOff size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {issue.fixField && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {issue.fixField}
                        </span>
                      )}
                      {issue.fixLinkType && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                          {issue.fixLinkType}
                        </span>
                      )}
                      <span className={clsx(
                        'text-xs px-1.5 py-0.5 rounded',
                        issue.fixType === 'field' && 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
                        issue.fixType === 'trace' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                        issue.fixType === 'info' && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                      )}>
                        {issue.fixType === 'field' ? 'Edit Field' : issue.fixType === 'trace' ? 'Add Link' : 'Info'}
                      </span>
                    </div>
                    {renderFieldEditor(issue, isFirstForField)}
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle size={24} className="text-green-500 dark:text-green-400 mb-2" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {skippedIssues.length > 0 ? 'All remaining issues skipped' : 'All checks passing'}
            </p>
            {skippedIssues.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {skippedIssues.length} suggestion{skippedIssues.length > 1 ? 's' : ''} skipped
              </p>
            )}
          </div>
        )}

        {uniqueResolved.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={14} className="text-green-500 dark:text-green-400" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                Resolved ({uniqueResolved.length})
              </span>
            </div>
            <div className="space-y-1.5">
              {uniqueResolved.map((issue, idx) => (
                <div key={`r-${idx}`} className="border border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10 rounded-lg p-2.5 opacity-75">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={12} className="text-green-500 dark:text-green-400 flex-shrink-0" />
                    <p className="text-xs text-green-700 dark:text-green-400 line-through">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {skippedIssues.length > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            <button
              onClick={onToggleDismissed}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors w-full"
            >
              {showDismissed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <EyeOff size={12} />
              Skipped ({skippedIssues.length})
            </button>
            {showDismissed && (
              <div className="mt-2 space-y-1.5">
                {skippedIssues.map((issue, idx) => (
                  <div key={`s-${idx}`} className="border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-2.5 opacity-60">
                    <div className="flex items-start gap-2">
                      {issue.severity === 'error' ? (
                        <AlertCircle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-through">{issue.message}</p>
                        {getSkipReason?.(issueKey(issue)) && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">
                            Reason: {getSkipReason(issueKey(issue))}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onUnskip(issueKey(issue))}
                        title="Restore this suggestion"
                        aria-label="Restore this suggestion"
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle size={32} className="text-green-500 dark:text-green-400 mb-3" />
        <p className="text-sm font-medium text-green-700 dark:text-green-400">All checks passing</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This requirement meets all quality criteria</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {errors.map((err, idx) => (
        <div key={`e-${idx}`} className="border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{err}</p>
        </div>
      ))}
      {warnings.map((warn, idx) => (
        <div key={`w-${idx}`} className="border border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">{warn}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────

export default function RequirementQualityPanel({
  projectId,
  onClose,
  onRequirementClick,
  onRequirementUpdated,
  initialSelectedRequirementId,
  projectDisplayName = 'Project',
  squeezeForSideEditor = false,
}: RequirementQualityPanelProps) {
  const queryClient = useQueryClient()

  // ─── State ───
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all')
  const [fixTypeFilter, setFixTypeFilter] = useState<FixTypeFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('score_asc')
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<UpdateRequirementDto>>>({})
  const [activeTab, setActiveTab] = useState<'requirements' | 'project'>('requirements')
  const [resolvedIssues, setResolvedIssues] = useState<Record<string, ValidationIssue[]>>({})
  const [showDismissed, setShowDismissed] = useState(false)
  const [skipTarget, setSkipTarget] = useState<{ reqId: string; issue: ValidationIssue } | null>(null)
  const [skipReasonDraft, setSkipReasonDraft] = useState('')
  const [clearAllSkipsConfirmOpen, setClearAllSkipsConfirmOpen] = useState(false)
  const preRevalidationSnapshot = useRef<Record<string, ValidationIssue[]>>({})
  const localDismissalsMigrated = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)
  const panelInnerRef = useRef<HTMLDivElement>(null)

  // ─── Data fetching ───
  const {
    data: projectValidation,
    isLoading,
    isFetching,
    isError: qualityLoadError,
    dataUpdatedAt,
    refetch,
    error: qualityLoadErr,
  } = useQuery({
    queryKey: ['requirement-quality', projectId],
    queryFn: async () => {
      const response = await apiClient.get<ProjectValidationResult>(`/requirement-validation/${projectId}`)
      if (response.success && response.data) return response.data
      if (response.success && Array.isArray(response.data)) {
        return {
          requirements: response.data as unknown as RequirementQualityCheck[],
          circularDependencies: [],
          duplicateIds: [],
        }
      }
      return { requirements: [], circularDependencies: [], duplicateIds: [] }
    },
    enabled: !!projectId,
    retry: 1,
  })

  const { data: dismissalRows = [], isSuccess: dismissalsLoaded } = useQuery({
    queryKey: ['quality-dismissals', projectId],
    queryFn: () => fetchQualityDismissals(projectId),
    enabled: !!projectId,
  })

  const qualityChecks = projectValidation?.requirements ?? []
  const circularDependencies = projectValidation?.circularDependencies ?? []
  const duplicateIds = projectValidation?.duplicateIds ?? []
  const compareRun = projectValidation?.compare

  const dismissedIssues = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const r of dismissalRows) {
      if (!m[r.requirementId]) m[r.requirementId] = []
      m[r.requirementId].push(r.issueKey)
    }
    return m
  }, [dismissalRows])

  /** One-way migration: merge legacy localStorage dismissals into API once */
  useEffect(() => {
    if (!dismissalsLoaded || localDismissalsMigrated.current) return
    localDismissalsMigrated.current = true
    const local = loadDismissedIssues(projectId)
    const serverPairs = new Set(dismissalRows.map((r) => `${r.requirementId}\t${r.issueKey}`))
    const items: Array<{ requirementId: string; issueKey: string; reason?: null }> = []
    for (const [reqId, keys] of Object.entries(local)) {
      for (const k of keys) {
        if (!serverPairs.has(`${reqId}\t${k}`)) items.push({ requirementId: reqId, issueKey: k, reason: null })
      }
    }
    if (items.length > 0) {
      upsertQualityDismissals(projectId, items).then((res) => {
        if (res.success) {
          try {
            localStorage.removeItem(`quality-dismissed-${projectId}`)
          } catch { /* ignore */ }
          queryClient.invalidateQueries({ queryKey: ['quality-dismissals', projectId] })
        }
      })
    } else {
      try {
        if (Object.keys(local).length > 0) localStorage.removeItem(`quality-dismissed-${projectId}`)
      } catch { /* ignore */ }
    }
  }, [dismissalsLoaded, projectId, dismissalRows, queryClient])

  const { data: selectedRequirementData } = useQuery({
    queryKey: ['requirement-detail-quality', projectId, selectedId],
    queryFn: async () => {
      if (!selectedId) return null
      const response = await requirementService.getRequirement(projectId, selectedId)
      return response.success && response.data ? response.data : null
    },
    enabled: !!projectId && !!selectedId,
  })

  const { data: adminUsersRes } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => authService.getUsers(),
  })
  const adminUsers = adminUsersRes?.success ? adminUsersRes.data || [] : []

  const { data: verificationMethodOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'VERIFICATION_METHOD'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'VERIFICATION_METHOD')) as ApiResponse<{ value: string }[]>,
    enabled: !!projectId,
  })
  const verificationMethodValues = (verificationMethodOptions?.success && verificationMethodOptions?.data ? verificationMethodOptions.data : []) as { value: string }[]

  const { data: levelOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'REQUIREMENT_LEVEL'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'REQUIREMENT_LEVEL')) as ApiResponse<{ value: string }[]>,
    enabled: !!projectId,
  })
  const levelValues = (levelOptions?.success && levelOptions?.data ? levelOptions.data : []) as { value: string }[]

  const { data: customTypesData } = useQuery({
    queryKey: ['customRequirementTypes', projectId],
    queryFn: async () => {
      const response = await requirementService.getCustomRequirementTypes(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })
  const availableRequirementTypes = useMemo(() => {
    const merged = [...defaultRequirementTypes]
    if (customTypesData) {
      const items = customTypesData as Array<string | { name?: string; value?: string }>
      items.forEach((item) => {
        const name = typeof item === 'string' ? item : item.name || item.value
        if (name && !merged.some(t => t.toLowerCase() === name.toLowerCase())) merged.push(name)
      })
    }
    return merged
  }, [customTypesData])

  const { data: riskOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'RISK'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'RISK')) as ApiResponse<{ value: string }[]>,
    enabled: !!projectId,
  })
  const riskValues = (riskOptions?.success && riskOptions?.data ? riskOptions.data : []) as { value: string }[]

  const { data: complexityOptions } = useQuery<ApiResponse<{ value: string }[]>>({
    queryKey: ['custom-options', projectId, 'COMPLEXITY'],
    queryFn: async () => (await verificationService.getCustomOptions(projectId, 'COMPLEXITY')) as ApiResponse<{ value: string }[]>,
    enabled: !!projectId,
  })
  const complexityValues = (complexityOptions?.success && complexityOptions?.data ? complexityOptions.data : []) as { value: string }[]

  // ─── Mutations ───
  const updateMutation = useMutation({
    mutationFn: async ({ requirementId, updates }: { requirementId: string; updates: UpdateRequirementDto }) => {
      return requirementService.updateRequirement(projectId, requirementId, updates)
    },
    onSuccess: (_data, variables) => {
      setPendingEdits(prev => {
        const next = { ...prev }
        delete next[variables.requirementId]
        return next
      })
    },
  })

  const revalidateMutation = useMutation({
    mutationFn: async (requirementId: string) => {
      const response = await apiClient.get<ValidationResult & { compare?: unknown }>(
        `/requirement-validation/${projectId}/requirement/${requirementId}`
      )
      if (!response.success || !response.data) throw new Error('Revalidation failed')
      const raw = response.data as ValidationResult & { compare?: unknown }
      const { compare: _c, ...validation } = raw
      return { requirementId, validation: validation as ValidationResult }
    },
    onSuccess: (result) => {
      const prevIssues = preRevalidationSnapshot.current[result.requirementId] ?? []
      delete preRevalidationSnapshot.current[result.requirementId]

      if (prevIssues.length > 0) {
        const newKeys = new Set((result.validation.issues ?? []).map(i => issueKey(i)))
        const nowResolved = prevIssues.filter(i => !newKeys.has(issueKey(i)))
        if (nowResolved.length > 0) {
          setResolvedIssues(prev => {
            const existing = (prev[result.requirementId] ?? []).filter(ri => !newKeys.has(issueKey(ri)))
            return { ...prev, [result.requirementId]: [...existing, ...nowResolved] }
          })
        }
      }

      queryClient.setQueryData(['requirement-quality', projectId], (old: ProjectValidationResult | undefined) => {
        if (!old) return old
        return {
          ...old,
          requirements: old.requirements.map(check =>
            check.requirementId === result.requirementId
              ? { ...check, validation: result.validation }
              : check
          ),
        }
      })
    },
  })

  const snapshotAndRevalidate = useCallback((reqId: string) => {
    const check = qualityChecks.find(c => c.requirementId === reqId)
    if (check?.validation.issues) {
      preRevalidationSnapshot.current[reqId] = [...check.validation.issues]
    }
    revalidateMutation.mutate(reqId)
  }, [qualityChecks, revalidateMutation])

  // ─── Filtering & Sorting ───
  const filteredChecks = useMemo(() => {
    let list = [...qualityChecks]

    if (searchText.trim()) {
      const q = searchText.toLowerCase().trim()
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.requirementId.toLowerCase().includes(q) ||
        (c.displayId && c.displayId.toLowerCase().includes(q))
      )
    }

    if (severityFilter !== 'all') {
      list = list.filter(c => {
        if (severityFilter === 'errors') return c.validation.errors.length > 0
        if (severityFilter === 'warnings') return c.validation.warnings.length > 0 && c.validation.errors.length === 0
        if (severityFilter === 'passing') return c.validation.isValid && c.validation.warnings.length === 0
        return true
      })
    }

    if (scoreFilter !== 'all') {
      list = list.filter(c => {
        if (scoreFilter === 'critical') return c.validation.score < 40
        if (scoreFilter === 'needs_work') return c.validation.score >= 40 && c.validation.score < 70
        if (scoreFilter === 'good') return c.validation.score >= 70 && c.validation.score < 90
        if (scoreFilter === 'excellent') return c.validation.score >= 90
        return true
      })
    }

    if (fixTypeFilter !== 'all') {
      list = list.filter(c =>
        c.validation.issues?.some(i => i.fixType === fixTypeFilter)
      )
    }

    list.sort((a, b) => {
      if (sortMode === 'score_asc') return a.validation.score - b.validation.score
      if (sortMode === 'score_desc') return b.validation.score - a.validation.score
      return a.title.localeCompare(b.title)
    })

    return list
  }, [qualityChecks, searchText, severityFilter, scoreFilter, fixTypeFilter, sortMode])

  const selectedCheck = useMemo(
    () => qualityChecks.find(c => c.requirementId === selectedId) ?? null,
    [qualityChecks, selectedId],
  )

  const selectedIndex = useMemo(
    () => filteredChecks.findIndex(c => c.requirementId === selectedId),
    [filteredChecks, selectedId],
  )

  const dismissMutation = useMutation({
    mutationFn: async (payload: { requirementId: string; issueKey: string; reason: string | null }) => {
      const res = await upsertQualityDismissals(projectId, [payload])
      if (!res.success) throw new Error(res.error || 'Save failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-dismissals', projectId] })
    },
  })

  const undismissMutation = useMutation({
    mutationFn: async ({ requirementId, issueKey }: { requirementId: string; issueKey: string }) => {
      const res = await deleteQualityDismissal(projectId, requirementId, issueKey)
      if (!res.success) throw new Error(res.error || 'Restore failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-dismissals', projectId] })
    },
  })

  const bulkSkipWarningsMutation = useMutation({
    mutationFn: async (requirementId: string) => {
      const res = await bulkSkipWarnings(projectId, requirementId)
      if (!res.success) throw new Error(res.error || 'Bulk skip failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-dismissals', projectId] })
    },
  })

  const clearRequirementDismissalsMutation = useMutation({
    mutationFn: async (requirementId: string) => {
      const res = await deleteAllDismissalsForRequirement(projectId, requirementId)
      if (!res.success) throw new Error(res.error || 'Clear failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-dismissals', projectId] })
    },
  })

  const clearProjectDismissalsMutation = useMutation({
    mutationFn: async () => {
      const res = await clearAllDismissalsForProject(projectId)
      if (!res.success) throw new Error(res.error || 'Clear failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-dismissals', projectId] })
    },
  })

  const dismissalReasonMap = useMemo(() => {
    const m: Record<string, Record<string, string>> = {}
    for (const r of dismissalRows) {
      if (!m[r.requirementId]) m[r.requirementId] = {}
      if (r.reason) m[r.requirementId][r.issueKey] = r.reason
    }
    return m
  }, [dismissalRows])

  useFocusTrap(panelInnerRef, true)

  const getDismissedKeysForReq = useCallback((reqId: string): Set<string> => {
    return new Set(dismissedIssues[reqId] ?? [])
  }, [dismissedIssues])

  const getAdjustedScore = useCallback((check: RequirementQualityCheck): number => {
    return computeAdjustedScore(check, getDismissedKeysForReq(check.requirementId))
  }, [getDismissedKeysForReq])

  const openSkipModal = useCallback((reqId: string, issue: ValidationIssue) => {
    setSkipTarget({ reqId, issue })
    setSkipReasonDraft('')
  }, [])

  const confirmSkipWithReason = useCallback(() => {
    if (!skipTarget) return
    const keyStr = issueKey(skipTarget.issue)
    dismissMutation.mutate(
      {
        requirementId: skipTarget.reqId,
        issueKey: keyStr,
        reason: skipReasonDraft.trim() || null,
      },
      {
        onSuccess: () => {
          setSkipTarget(null)
          setSkipReasonDraft('')
        },
      }
    )
  }, [skipTarget, skipReasonDraft, dismissMutation])

  const handleUnskipIssue = useCallback(
    (reqId: string, key: string) => {
      undismissMutation.mutate({ requirementId: reqId, issueKey: key })
    },
    [undismissMutation]
  )

  const getSkipReasonForSelected = useCallback(
    (ik: string) => {
      if (!selectedId) return undefined
      const row = dismissalRows.find((r) => r.requirementId === selectedId && r.issueKey === ik)
      return row?.reason ?? undefined
    },
    [dismissalRows, selectedId]
  )

  // ─── Stats ───
  const adjustedOverallScore = qualityChecks.length > 0
    ? Math.round(qualityChecks.reduce((sum, c) => sum + getAdjustedScore(c), 0) / qualityChecks.length)
    : 0
  const totalDismissedCount = Object.values(dismissedIssues).reduce((sum, keys) => sum + keys.length, 0)
  const passingCount = qualityChecks.filter(c => {
    const adjScore = getAdjustedScore(c)
    return adjScore >= 100 || (c.validation.isValid && c.validation.warnings.length === 0)
  }).length
  const errorCount = qualityChecks.reduce((sum, c) => sum + c.validation.errors.length, 0)
  const warningCount = qualityChecks.reduce((sum, c) => sum + c.validation.warnings.length, 0)
  const progressPct = qualityChecks.length > 0 ? Math.round((passingCount / qualityChecks.length) * 100) : 0

  // ─── Navigation ───
  const navigateIssue = useCallback((direction: 'prev' | 'next') => {
    if (filteredChecks.length === 0) return
    const issueChecks = filteredChecks.filter(c => c.validation.errors.length > 0 || c.validation.warnings.length > 0)
    if (issueChecks.length === 0) return

    if (!selectedId) {
      setSelectedId(issueChecks[0].requirementId)
      return
    }

    const currentIdx = issueChecks.findIndex(c => c.requirementId === selectedId)
    let nextIdx: number
    if (currentIdx === -1) {
      nextIdx = 0
    } else if (direction === 'next') {
      nextIdx = (currentIdx + 1) % issueChecks.length
    } else {
      nextIdx = (currentIdx - 1 + issueChecks.length) % issueChecks.length
    }
    setSelectedId(issueChecks[nextIdx].requirementId)
  }, [filteredChecks, selectedId])

  // ─── Keyboard handling ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (clearAllSkipsConfirmOpen && e.key === 'Escape') {
        e.preventDefault()
        setClearAllSkipsConfirmOpen(false)
        return
      }
      if (skipTarget && e.key === 'Escape') {
        e.preventDefault()
        setSkipTarget(null)
        setSkipReasonDraft('')
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
        return
      if ((e.target as HTMLElement)?.getAttribute?.('contenteditable') === 'true') return

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        if (filteredChecks.length === 0) return
        const nextIdx = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, filteredChecks.length - 1)
        setSelectedId(filteredChecks[nextIdx].requirementId)
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        if (filteredChecks.length === 0) return
        const nextIdx = selectedIndex <= 0 ? 0 : selectedIndex - 1
        setSelectedId(filteredChecks[nextIdx].requirementId)
      } else if (e.key === 'Escape') {
        if (selectedId) {
          setSelectedId(null)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filteredChecks, selectedIndex, selectedId, onClose, skipTarget, clearAllSkipsConfirmOpen])

  // ─── Scroll selected into view ───
  useEffect(() => {
    if (!selectedId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-req-id="${selectedId}"]`)
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  const deepLinkSelectDone = useRef(false)
  useEffect(() => {
    if (!initialSelectedRequirementId || deepLinkSelectDone.current) return
    if (isLoading && qualityChecks.length === 0) return
    const hit = qualityChecks.some((c) => c.requirementId === initialSelectedRequirementId)
    if (hit) {
      setSelectedId(initialSelectedRequirementId)
      deepLinkSelectDone.current = true
    }
  }, [initialSelectedRequirementId, qualityChecks, isLoading])

  // ─── Edit helpers ───
  const currentEdits = selectedId ? (pendingEdits[selectedId] ?? {}) : {}

  const getFieldValue = useCallback((field: string) => {
    if (!selectedId) return ''
    const edits = pendingEdits[selectedId]
    if (edits && field in edits) return (edits as any)[field] ?? ''
    if (selectedRequirementData) return (selectedRequirementData as any)[field] ?? ''
    return ''
  }, [selectedId, pendingEdits, selectedRequirementData])

  const setFieldValue = useCallback((field: string, value: any) => {
    if (!selectedId) return
    setPendingEdits(prev => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] || {}), [field]: value },
    }))
  }, [selectedId])

  const hasEdits = selectedId ? Object.keys(pendingEdits[selectedId] ?? {}).length > 0 : false

  const handleSaveAndRevalidate = useCallback(async () => {
    if (!selectedId || !hasEdits) {
      if (selectedId) snapshotAndRevalidate(selectedId)
      return
    }
    try {
      await updateMutation.mutateAsync({ requirementId: selectedId, updates: currentEdits as UpdateRequirementDto })
      snapshotAndRevalidate(selectedId)
      onRequirementUpdated?.()
    } catch { /* handled by mutation error state */ }
  }, [selectedId, hasEdits, currentEdits, updateMutation, snapshotAndRevalidate, onRequirementUpdated])

  const isSaving = updateMutation.isPending || revalidateMutation.isPending

  // ─── Render helpers ───
  const renderFieldEditor = (issue: ValidationIssue, isFirst: boolean) => {
    if (issue.fixType === 'trace' && issue.fixLinkType && selectedId) {
      return (
        <InlineTraceLinkCreator
          projectId={projectId}
          requirementId={selectedId}
          fixLinkType={issue.fixLinkType}
          onCreated={() => snapshotAndRevalidate(selectedId)}
        />
      )
    }

    if (issue.fixType !== 'field' || !issue.fixField) return null

    if (!isFirst) {
      const editedVal = getFieldValue(issue.fixField)
      const hasVal = editedVal && (typeof editedVal === 'string' ? editedVal.trim().length > 0 : true)
      return hasVal ? (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle size={10} />
          Edited above
        </div>
      ) : null
    }

    const field = issue.fixField
    const value = getFieldValue(field)

    switch (field) {
      case 'title':
        return (
          <input
            type="text"
            value={value}
            onChange={e => setFieldValue(field, e.target.value)}
            placeholder="Enter title..."
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )

      case 'description':
      case 'acceptanceCriteria':
        return (
          <div className="mt-2">
            <RichTextEditor
              content={value}
              onChange={(content: string) => setFieldValue(field, content)}
              className="min-h-[80px] max-h-[150px] overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>
        )

      case 'owner':
        return (
          <select
            value={value}
            onChange={e => setFieldValue(field, e.target.value || undefined)}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select owner</option>
            {adminUsers.map((user: any) => (
              <option key={user.id} value={user.name || user.email}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        )

      case 'verificationMethod':
        return (
          <select
            value={value}
            onChange={e => setFieldValue(field, e.target.value || undefined)}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select verification method</option>
            {verificationMethodValues.map(o => (
              <option key={o.value} value={o.value}>{o.value}</option>
            ))}
          </select>
        )

      case 'requirementType':
        return (
          <select
            value={value}
            onChange={e => setFieldValue(field, e.target.value || undefined)}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select requirement type</option>
            {availableRequirementTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )

      case 'requirementLevel': {
        const lvlOpts = levelValues.length > 0 ? levelValues.map(o => o.value) : defaultLevels
        return (
          <select
            value={value}
            onChange={e => setFieldValue(field, e.target.value || undefined)}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select level</option>
            {lvlOpts.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )
      }

      case 'rationale':
        return (
          <textarea
            value={value}
            onChange={e => setFieldValue(field, e.target.value)}
            placeholder="Enter rationale..."
            rows={3}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        )

      case 'stakeholders':
        return (
          <input
            type="text"
            value={value ? (Array.isArray(value) ? value.join(', ') : value) : ''}
            onChange={e => {
              const stakeholders = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)
              setFieldValue(field, stakeholders.length > 0 ? stakeholders : undefined)
            }}
            placeholder="Comma-separated stakeholders..."
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )

      case 'complexity': {
        const cOpts = complexityValues.length > 0 ? complexityValues.map(o => o.value) : defaultComplexityValues
        return (
          <select
            value={value}
            onChange={e => setFieldValue(field, e.target.value || undefined)}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select complexity</option>
            {cOpts.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )
      }

      case 'risk': {
        const rOpts = riskValues.length > 0 ? riskValues.map(o => o.value) : defaultRiskValues
        return (
          <select
            value={value}
            onChange={e => setFieldValue(field, e.target.value || undefined)}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select risk</option>
            {rOpts.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )
      }

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={e => setFieldValue(field, e.target.value)}
            placeholder={`Enter ${field}...`}
            className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )
    }
  }

  const showLoadingSkeleton = isLoading && !projectValidation
  const showStaleBanner = Boolean(qualityLoadError && projectValidation)

  // ─── Render ───
  return (
    <div
      className={clsx(
        'fixed z-50 flex items-center justify-center bg-black/50',
        squeezeForSideEditor ? 'left-0 top-0 bottom-0 min-w-0 overflow-x-hidden' : 'inset-0'
      )}
      style={squeezeForSideEditor ? qualityWorkbenchSqueezeStyle() : undefined}
      data-testid="requirement-quality-workbench"
      role="dialog"
      aria-modal="true"
      aria-label="Requirement Quality Workbench"
      aria-describedby="rq-quality-help"
    >
      <div
        ref={panelInnerRef}
        tabIndex={-1}
        className={clsx(
          'relative flex h-[90vh] flex-col rounded-lg bg-white shadow-xl outline-none dark:bg-gray-800',
          squeezeForSideEditor ? 'w-[95%] max-w-[min(1200px,100%)]' : 'w-[95vw]'
        )}
      >
        <p id="rq-quality-help" className="sr-only">
          Keyboard: Escape clears the selected requirement or closes the workbench. Tab moves focus within the dialog.
        </p>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Requirement Quality Workbench</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">SMART criteria and quality validation — fix issues in place</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadQualityCsv(projectDisplayName, qualityChecks, dismissedIssues, dismissalReasonMap)
              }
              disabled={showLoadingSkeleton}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Export CSV"
              aria-label="Export quality report as CSV"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={() =>
                downloadQualityPdf(
                  projectDisplayName,
                  qualityChecks,
                  dismissedIssues,
                  dismissalReasonMap,
                  compareRun,
                  adjustedOverallScore
                )
              }
              disabled={showLoadingSkeleton}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Export PDF"
              aria-label="Export quality report as PDF"
            >
              <span className="text-xs font-semibold px-0.5">PDF</span>
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Re-analyze all"
              aria-label="Re-analyze all requirements"
              data-testid="rq-quality-refresh-all"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close workbench"
              data-testid="rq-quality-close"
            >
              <X size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {showStaleBanner && (
          <div className="px-5 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
            <span>Could not refresh quality data. Showing last successful results.</span>
            <button
              type="button"
              className="text-xs font-medium underline focus-visible:ring-2 focus-visible:ring-amber-500 rounded"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        )}

        {/* Summary bar */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${getScoreColor(adjustedOverallScore)}`}>{adjustedOverallScore}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Avg Score</span>
              </div>
              {compareRun?.hasPrevious && (
                <span className="text-xs text-gray-500 dark:text-gray-400" title={compareRun.previousCapturedAt ?? undefined}>
                  vs last run: {compareRun.avgScoreDelta >= 0 ? '+' : ''}
                  {compareRun.avgScoreDelta} avg
                  {compareRun.improvedCount > 0 && ` · ${compareRun.improvedCount} improved`}
                  {compareRun.regressedCount > 0 && ` · ${compareRun.regressedCount} regressed`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{qualityChecks.length}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Requirements</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Errors</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{warningCount}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Warnings</span>
            </div>
            {totalDismissedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-gray-500 dark:text-gray-400">{totalDismissedCount}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Skipped</span>
              </div>
            )}
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 underline focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              onClick={() => setClearAllSkipsConfirmOpen(true)}
              disabled={clearProjectDismissalsMutation.isPending || totalDismissedCount === 0}
            >
              Clear all skips
            </button>
            <div className="flex-1" />
            {/* Progress bar */}
            <div className="flex items-center gap-2 min-w-[200px]">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {passingCount}/{qualityChecks.length} passing
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('requirements')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'requirements'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            Requirements ({filteredChecks.length})
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'project'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              (circularDependencies.length > 0 || duplicateIds.length > 0) && activeTab !== 'project' && 'text-red-500 dark:text-red-400'
            )}
          >
            Project Issues
            {(circularDependencies.length > 0 || duplicateIds.length > 0) && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                {circularDependencies.length + duplicateIds.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'requirements' ? (
          showLoadingSkeleton ? (
            <div className="flex-1 flex gap-4 p-4 overflow-hidden animate-pulse">
              <div className="w-[40%] flex flex-col gap-2 border-r border-gray-200 dark:border-gray-700 pr-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                ))}
              </div>
              <div className="flex-1 flex flex-col gap-3">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Left pane — issue list */}
            <div className="w-[40%] flex flex-col border-r border-gray-200 dark:border-gray-700">
              {/* Filter bar */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    placeholder="Search by title or ID..."
                    data-testid="rq-quality-search"
                    aria-label="Search requirements by title or ID"
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={severityFilter}
                    onChange={e => setSeverityFilter(e.target.value as SeverityFilter)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Severity</option>
                    <option value="errors">Errors</option>
                    <option value="warnings">Warnings Only</option>
                    <option value="passing">Passing</option>
                  </select>
                  <select
                    value={scoreFilter}
                    onChange={e => setScoreFilter(e.target.value as ScoreFilter)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Scores</option>
                    <option value="critical">Critical (0-39)</option>
                    <option value="needs_work">Needs Work (40-69)</option>
                    <option value="good">Good (70-89)</option>
                    <option value="excellent">Excellent (90+)</option>
                  </select>
                  <select
                    value={fixTypeFilter}
                    onChange={e => setFixTypeFilter(e.target.value as FixTypeFilter)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Issue Types</option>
                    <option value="field">Field Issues</option>
                    <option value="trace">Missing Links</option>
                    <option value="info">Informational</option>
                  </select>
                  <select
                    value={sortMode}
                    onChange={e => setSortMode(e.target.value as SortMode)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="score_asc">Worst First</option>
                    <option value="score_desc">Best First</option>
                    <option value="title_asc">Title A-Z</option>
                  </select>
                </div>
              </div>

              {/* List */}
              <div ref={listRef} className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader size={20} className="animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Analyzing requirements...</span>
                  </div>
                ) : filteredChecks.length === 0 ? (
                  <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
                    {qualityChecks.length === 0 ? 'No requirements to analyze' : 'No results match your filters'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {filteredChecks.map(check => {
                      const isSelected = check.requirementId === selectedId
                      const errCnt = check.validation.errors.length
                      const warnCnt = check.validation.warnings.length
                      const adjScore = getAdjustedScore(check)
                      const skippedCnt = (dismissedIssues[check.requirementId] ?? []).length
                      return (
                        <button
                          key={check.requirementId}
                          data-req-id={check.requirementId}
                          onClick={() => setSelectedId(isSelected ? null : check.requirementId)}
                          className={clsx(
                            'w-full text-left px-4 py-3 transition-colors',
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-2 border-l-transparent'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {check.title}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                                {check.displayId || check.requirementId.substring(0, 8)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              {errCnt > 0 && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded">
                                  <AlertCircle size={10} />
                                  {errCnt}
                                </span>
                              )}
                              {warnCnt > 0 && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20 rounded">
                                  <AlertTriangle size={10} />
                                  {warnCnt}
                                </span>
                              )}
                              {skippedCnt > 0 && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                                  <EyeOff size={10} />
                                  {skippedCnt}
                                </span>
                              )}
                              <span className={clsx(
                                'px-2 py-0.5 rounded text-xs font-bold',
                                getScoreBgColor(adjScore),
                                getScoreColor(adjScore),
                              )}>
                                {adjScore}
                              </span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right pane — fix detail */}
            <div className="w-[60%] flex flex-col">
              {!selectedCheck ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <Search size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a requirement to view and fix issues</p>
                    <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">Use arrow keys or click to navigate</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Fix pane header */}
                  <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                          {selectedCheck.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {selectedCheck.displayId || selectedCheck.requirementId.substring(0, 12)}
                          </span>
                          {(() => {
                            const adjScore = getAdjustedScore(selectedCheck)
                            const baseScore = selectedCheck.validation.score
                            const boosted = adjScore > baseScore
                            return (
                              <span className={clsx(
                                'px-2 py-0.5 rounded-full text-xs font-bold',
                                getScoreBgColor(adjScore),
                                getScoreColor(adjScore),
                              )}>
                                {adjScore}/100
                                {boosted && (
                                  <span className="ml-1 text-gray-400 font-normal">({baseScore} base)</span>
                                )}
                              </span>
                            )
                          })()}
                          {(dismissedIssues[selectedCheck.requirementId]?.length ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <EyeOff size={11} />
                              {dismissedIssues[selectedCheck.requirementId].length} skipped
                            </span>
                          )}
                          {getAdjustedScore(selectedCheck) >= 100 && (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle size={12} />
                              All checks passing
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {onRequirementClick && (
                          <button
                            onClick={() => onRequirementClick(selectedCheck.requirementId)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Open full editor"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Issues list */}
                  <div className="flex-1 overflow-y-auto px-5 py-3">
                    <IssuesList
                      issues={selectedCheck.validation.issues}
                      errors={selectedCheck.validation.errors}
                      warnings={selectedCheck.validation.warnings}
                      renderFieldEditor={renderFieldEditor}
                      dismissedKeys={getDismissedKeysForReq(selectedCheck.requirementId)}
                      resolved={resolvedIssues[selectedCheck.requirementId] ?? []}
                      onSkip={(issue) => openSkipModal(selectedCheck.requirementId, issue)}
                      onUnskip={(key) => handleUnskipIssue(selectedCheck.requirementId, key)}
                      showDismissed={showDismissed}
                      onToggleDismissed={() => setShowDismissed(prev => !prev)}
                      getSkipReason={getSkipReasonForSelected}
                    />
                  </div>

                  {/* Action bar */}
                  <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigateIssue('prev')}
                        disabled={filteredChecks.length <= 1}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
                        title="Previous issue (Arrow Up / k)"
                      >
                        <ArrowUp size={12} />
                        Previous
                      </button>
                      <button
                        onClick={() => navigateIssue('next')}
                        disabled={filteredChecks.length <= 1}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
                        title="Next issue (Arrow Down / j)"
                      >
                        Next
                        <ArrowDown size={12} />
                      </button>
                      {selectedIndex >= 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {selectedIndex + 1} / {filteredChecks.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {(selectedCheck.validation.issues ?? []).some((i) => i.severity === 'warning') && (
                        <button
                          type="button"
                          onClick={() => bulkSkipWarningsMutation.mutate(selectedCheck.requirementId)}
                          disabled={bulkSkipWarningsMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          Skip all warnings
                        </button>
                      )}
                      {(dismissedIssues[selectedCheck.requirementId]?.length ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => clearRequirementDismissalsMutation.mutate(selectedCheck.requirementId)}
                          disabled={clearRequirementDismissalsMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                          Clear skips (req.)
                        </button>
                      )}
                      {(updateMutation.isError || revalidateMutation.isError) && (
                        <span className="text-xs text-red-500">Save failed. Try again.</span>
                      )}
                      <button
                        type="button"
                        onClick={() => snapshotAndRevalidate(selectedCheck.requirementId)}
                        disabled={isSaving}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
                        title="Re-validate this requirement"
                      >
                        <RotateCcw size={12} className={revalidateMutation.isPending ? 'animate-spin' : ''} />
                        Re-validate
                      </button>
                      <button
                        onClick={handleSaveAndRevalidate}
                        disabled={isSaving || !hasEdits}
                        className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 transition-colors"
                      >
                        {isSaving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
                        Save & Re-validate
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          )
        ) : (
          /* Project-level issues tab */
          <div className="flex-1 overflow-y-auto p-5">
            {circularDependencies.length === 0 && duplicateIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle size={32} className="text-green-500 dark:text-green-400 mb-3" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">No project-level issues</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No circular dependencies or duplicate IDs found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {circularDependencies.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-500" />
                      Circular Dependencies ({circularDependencies.length})
                    </h3>
                    <div className="space-y-2">
                      {circularDependencies.map((cycle, idx) => (
                        <div key={idx} className="border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10 rounded-lg p-3">
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Cycle: {cycle.map(id => id.substring(0, 8)).join(' → ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {duplicateIds.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-yellow-500" />
                      Duplicate Requirement IDs ({duplicateIds.length})
                    </h3>
                    <div className="space-y-2">
                      {duplicateIds.map((id, idx) => (
                        <div key={idx} className="border border-yellow-200 dark:border-yellow-800/50 bg-yellow-50/50 dark:bg-yellow-900/10 rounded-lg p-3">
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Duplicate ID: <span className="font-mono font-medium">{id}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {clearAllSkipsConfirmOpen && (
          <div
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setClearAllSkipsConfirmOpen(false)
            }}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="rq-clear-skips-title"
              aria-describedby="rq-clear-skips-desc"
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 border border-gray-200 dark:border-gray-700"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 id="rq-clear-skips-title" className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Clear all skips?
              </h3>
              <p id="rq-clear-skips-desc" className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                This removes every skipped quality suggestion for this project for your account. You can skip items again later if needed.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => setClearAllSkipsConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-red-500"
                  disabled={clearProjectDismissalsMutation.isPending}
                  onClick={() => {
                    clearProjectDismissalsMutation.mutate(undefined, {
                      onSuccess: () => setClearAllSkipsConfirmOpen(false),
                    })
                  }}
                >
                  {clearProjectDismissalsMutation.isPending ? 'Clearing…' : 'Clear all skips'}
                </button>
              </div>
            </div>
          </div>
        )}
        {skipTarget && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setSkipTarget(null)
                setSkipReasonDraft('')
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="rq-skip-reason-title"
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 border border-gray-200 dark:border-gray-700"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 id="rq-skip-reason-title" className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Skip suggestion
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-4">
                {skipTarget.issue.message}
              </p>
              <label htmlFor="rq-skip-reason" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason (optional)
              </label>
              <textarea
                id="rq-skip-reason"
                value={skipReasonDraft}
                onChange={(e) => setSkipReasonDraft(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Accepted risk for this release"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => {
                    setSkipTarget(null)
                    setSkipReasonDraft('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="rq-quality-confirm-skip"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-blue-500"
                  onClick={() => confirmSkipWithReason()}
                  disabled={dismissMutation.isPending}
                >
                  {dismissMutation.isPending ? 'Saving…' : 'Confirm skip'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
