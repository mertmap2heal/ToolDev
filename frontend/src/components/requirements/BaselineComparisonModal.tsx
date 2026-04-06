import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, ArrowLeftRight, Plus, Minus, Edit, FileText, Link2, Link2Off, AlertTriangle, Search, ChevronDown, ChevronRight, ExternalLink, Download, FileSpreadsheet } from 'lucide-react'
import { baselineService } from '../../services/baseline.service'
import { LINKAGE_V1 } from '../../config/featureFlags'
import type { BaselineComparison, RequirementComparisonItem, BaselineLinkChange } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

let autoTableModule: any = null
async function loadAutoTable() {
  if (!autoTableModule) {
    try {
      autoTableModule = await import('jspdf-autotable')
    } catch (error) {
      console.error('Failed to load jspdf-autotable:', error)
      throw new Error('PDF export is not available.')
    }
  }
  return autoTableModule.default || autoTableModule
}

type CompareTab = 'summary' | 'added' | 'removed' | 'modified' | 'links'

interface BaselineComparisonModalProps {
  projectId: string
  baselineAId: string
  baselineBId: string
  onClose: () => void
  /** Navigate to requirements page with baselineId and optional requirementId for focus */
  onViewInBaseline?: (baselineId: string, requirementId?: string) => void
}

function stripHtml(s: string | undefined): string {
  if (!s) return ''
  return s.replace(/<[^>]*>/g, '').trim()
}

function matchesSearch(item: RequirementComparisonItem, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.toLowerCase()
  return (
    (item.requirementId || '').toLowerCase().includes(lower) ||
    (item.title || '').toLowerCase().includes(lower) ||
    (stripHtml(item.description) || '').toLowerCase().includes(lower)
  )
}

function linkMatchesSearch(link: BaselineLinkChange, q: string): boolean {
  if (!q.trim()) return true
  const lower = q.toLowerCase()
  return (
    (link.sourceId || '').toLowerCase().includes(lower) ||
    (link.targetId || '').toLowerCase().includes(lower) ||
    (link.sourceType || '').toLowerCase().includes(lower) ||
    (link.targetType || '').toLowerCase().includes(lower) ||
    (link.linkType || '').toLowerCase().includes(lower)
  )
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  status: 'Status',
  category: 'Category',
  owner: 'Owner',
  verificationMethod: 'Verification Method',
  acceptanceCriteria: 'Acceptance Criteria',
  source: 'Source',
  stage: 'Stage',
}

interface ComparisonContentProps {
  comparison: BaselineComparison
  filterAndSort: {
    added: RequirementComparisonItem[]
    removed: RequirementComparisonItem[]
    modified: RequirementComparisonItem[]
    linksAdded: BaselineLinkChange[]
    linksRemoved: BaselineLinkChange[]
    linksSuspectChanged: BaselineLinkChange[]
  }
  activeTab: CompareTab
  sectionCollapsed: Record<string, boolean>
  toggleSection: (key: string) => void
  hasSearch: boolean
  onViewInBaseline?: (baselineId: string, requirementId?: string) => void
  baselineAId: string
  baselineBId: string
}

function ComparisonContent({
  comparison,
  filterAndSort,
  activeTab,
  sectionCollapsed,
  toggleSection,
  hasSearch,
  onViewInBaseline,
  baselineAId,
  baselineBId,
}: ComparisonContentProps) {
  const { added, removed, modified, linksAdded, linksRemoved, linksSuspectChanged } = filterAndSort
  const totalLinks = linksAdded.length + linksRemoved.length + linksSuspectChanged.length
  const showSection = (key: CompareTab) => activeTab === 'summary' || activeTab === key
  const isCollapsed = (key: string) => activeTab === 'summary' && sectionCollapsed[key]

  const renderReqRow = (
    req: RequirementComparisonItem,
    bgClass: string,
    borderClass: string,
    viewInA?: boolean,
    viewInB?: boolean
  ) => (
    <div key={req.id} className={clsx('p-3', bgClass)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{req.requirementId}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{req.title}</span>
          </div>
          {req.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
              {stripHtml(req.description).substring(0, 150)}
              {stripHtml(req.description).length > 150 ? '...' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {req.priority && (
            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 text-xs">
              {req.priority}
            </span>
          )}
          {req.status && (
            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 text-xs">
              {req.status}
            </span>
          )}
          {onViewInBaseline && viewInA && (
            <button
              onClick={() => onViewInBaseline(baselineAId, req.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
              title="View in Baseline A"
            >
              <ExternalLink size={12} /> A
            </button>
          )}
          {onViewInBaseline && viewInB && (
            <button
              onClick={() => onViewInBaseline(baselineBId, req.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
              title="View in Baseline B"
            >
              <ExternalLink size={12} /> B
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const renderModifiedRow = (req: RequirementComparisonItem) => {
    const fields = req.changedFields && req.changedFields.length > 0 ? req.changedFields : ['title', 'priority', 'status']
    const longTextFields = ['description', 'acceptanceCriteria']
    return (
      <div key={req.id} className="p-3 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{req.requirementId}</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{req.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {req.priority && (
              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 text-xs">
                {req.priority}
              </span>
            )}
            {req.status && (
              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 text-xs">
                {req.status}
              </span>
            )}
            {onViewInBaseline && (
              <>
                <button
                  onClick={() => onViewInBaseline(baselineAId, req.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                  title="View in Baseline A"
                >
                  <ExternalLink size={12} /> A
                </button>
                <button
                  onClick={() => onViewInBaseline(baselineBId, req.id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                  title="View in Baseline B"
                >
                  <ExternalLink size={12} /> B
                </button>
              </>
            )}
          </div>
        </div>
        {req.previous && (
          <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700 space-y-2">
            {fields.filter((f) => !longTextFields.includes(f)).map((field) => {
              const prev = (req.previous as unknown as Record<string, unknown>)?.[field]
              const curr = (req as unknown as Record<string, unknown>)?.[field]
              if (prev === undefined && curr === undefined) return null
              const prevStr = prev != null ? String(prev).trim() : ''
              const currStr = curr != null ? String(curr).trim() : ''
              if (prevStr === currStr) return null
              return (
                <div key={field} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{FIELD_LABELS[field] || field}:</span>{' '}
                  <span className="line-through text-red-600 dark:text-red-400">{prevStr || '—'}</span>
                  {' → '}
                  <span className="text-green-600 dark:text-green-400">{currStr || '—'}</span>
                </div>
              )
            })}
            {fields.filter((f) => longTextFields.includes(f)).map((field) => {
              const prev = (req.previous as unknown as Record<string, unknown>)?.[field]
              const curr = (req as unknown as Record<string, unknown>)?.[field]
              const prevStr = prev != null ? stripHtml(String(prev)) : ''
              const currStr = curr != null ? stripHtml(String(curr)) : ''
              if (prevStr === currStr) return null
              return (
                <details key={field} className="text-xs">
                  <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                    {FIELD_LABELS[field] || field} (changed)
                  </summary>
                  <div className="mt-1 pl-2 space-y-1 border-l-2 border-yellow-400 dark:border-yellow-600">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Previous: </span>
                      <span className="line-through text-red-600/80 dark:text-red-400/80">{prevStr.substring(0, 300)}{prevStr.length > 300 ? '...' : ''}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Current: </span>
                      <span className="text-green-600/80 dark:text-green-400/80">{currStr.substring(0, 300)}{currStr.length > 300 ? '...' : ''}</span>
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const totalLinksUnfiltered =
    (comparison.linksAdded?.length || 0) + (comparison.linksRemoved?.length || 0) + (comparison.linksSuspectChanged?.length || 0)
  const noChanges =
    comparison.added.length === 0 &&
    comparison.removed.length === 0 &&
    comparison.modified.length === 0 &&
    !(LINKAGE_V1 && totalLinksUnfiltered > 0)

  return (
    <div className="space-y-6">
      {/* Baseline Info - always when summary tab */}
      {(activeTab === 'summary' || noChanges) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Baseline A</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{comparison.baselineA.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
              Created: {format(new Date(comparison.baselineA.createdAt), 'PPp')}
            </p>
            {LINKAGE_V1 && comparison.baselineA.linksCount != null && (
              <p className="text-xs text-gray-500 dark:text-gray-500">{comparison.baselineA.linksCount} links</p>
            )}
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Baseline B</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{comparison.baselineB.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
              Created: {format(new Date(comparison.baselineB.createdAt), 'PPp')}
            </p>
            {LINKAGE_V1 && comparison.baselineB.linksCount != null && (
              <p className="text-xs text-gray-500 dark:text-gray-500">{comparison.baselineB.linksCount} links</p>
            )}
          </div>
        </div>
      )}

      {/* Summary counts */}
      {(activeTab === 'summary' || noChanges) && (
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Summary</h3>
          <div
            className={clsx(
              'grid gap-4',
              LINKAGE_V1 && totalLinks > 0 ? 'grid-cols-6' : 'grid-cols-3'
            )}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{comparison.added.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Req Added</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{comparison.removed.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Req Removed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{comparison.modified.length}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Req Modified</div>
            </div>
            {LINKAGE_V1 && totalLinksUnfiltered > 0 && (
              <>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{comparison.linksAdded?.length ?? 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Links Added</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{comparison.linksRemoved?.length ?? 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Links Removed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {comparison.linksSuspectChanged?.length ?? 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Suspect Changed</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {noChanges && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p>No differences found between the two baselines</p>
        </div>
      )}

      {/* Added */}
      {showSection('added') && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('added')}
            className={clsx(
              'flex items-center gap-2 mb-3 w-full text-left',
              activeTab !== 'summary' && 'cursor-default'
            )}
          >
            {activeTab === 'summary' && (
              <span className="text-gray-500">{sectionCollapsed.added ? <ChevronRight size={18} /> : <ChevronDown size={18} />}</span>
            )}
            <Plus className="text-green-600 dark:text-green-400" size={20} />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Added ({hasSearch ? `${added.length} of ${comparison.added.length}` : added.length})
            </h3>
          </button>
          {!isCollapsed('added') && (
            <div className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-green-50/50 dark:bg-green-900/10">
              {added.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No items{hasSearch ? ' match search' : ''}</div>
              ) : (
                <div className="divide-y divide-green-200 dark:divide-green-800">
                  {added.map((req) => renderReqRow(req, 'hover:bg-green-100/50 dark:hover:bg-green-900/20', '', false, true))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Removed */}
      {showSection('removed') && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('removed')}
            className={clsx(
              'flex items-center gap-2 mb-3 w-full text-left',
              activeTab !== 'summary' && 'cursor-default'
            )}
          >
            {activeTab === 'summary' && (
              <span className="text-gray-500">{sectionCollapsed.removed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}</span>
            )}
            <Minus className="text-red-600 dark:text-red-400" size={20} />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Removed ({hasSearch ? `${removed.length} of ${comparison.removed.length}` : removed.length})
            </h3>
          </button>
          {!isCollapsed('removed') && (
            <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden bg-red-50/50 dark:bg-red-900/10">
              {removed.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No items{hasSearch ? ' match search' : ''}</div>
              ) : (
                <div className="divide-y divide-red-200 dark:divide-red-800">
                  {removed.map((req) => renderReqRow(req, 'hover:bg-red-100/50 dark:hover:bg-red-900/20', '', true, false))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modified */}
      {showSection('modified') && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('modified')}
            className={clsx(
              'flex items-center gap-2 mb-3 w-full text-left',
              activeTab !== 'summary' && 'cursor-default'
            )}
          >
            {activeTab === 'summary' && (
              <span className="text-gray-500">{sectionCollapsed.modified ? <ChevronRight size={18} /> : <ChevronDown size={18} />}</span>
            )}
            <Edit className="text-yellow-600 dark:text-yellow-400" size={20} />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Modified ({hasSearch ? `${modified.length} of ${comparison.modified.length}` : modified.length})
            </h3>
          </button>
          {!isCollapsed('modified') && (
            <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg overflow-hidden bg-yellow-50/50 dark:bg-yellow-900/10">
              {modified.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No items{hasSearch ? ' match search' : ''}</div>
              ) : (
                <div className="divide-y divide-yellow-200 dark:divide-yellow-800">
                  {modified.map(renderModifiedRow)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Links */}
      {showSection('links') && LINKAGE_V1 && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection('links')}
            className={clsx(
              'flex items-center gap-2 mb-3 w-full text-left',
              activeTab !== 'summary' && 'cursor-default'
            )}
          >
            {activeTab === 'summary' && (
              <span className="text-gray-500">{sectionCollapsed.links ? <ChevronRight size={18} /> : <ChevronDown size={18} />}</span>
            )}
            <Link2 className="text-blue-500" size={20} />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Links ({linksAdded.length + linksRemoved.length + linksSuspectChanged.length}{' '}
              {hasSearch ? `of ${(comparison.linksAdded?.length || 0) + (comparison.linksRemoved?.length || 0) + (comparison.linksSuspectChanged?.length || 0)}` : ''} total)
            </h3>
          </button>
          {!isCollapsed('links') && (
            <div className="space-y-4">
              {linksAdded.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Added ({linksAdded.length})</h4>
                  <div className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-green-50/50 dark:bg-green-900/10 max-h-48 overflow-y-auto">
                    <div className="divide-y divide-green-200 dark:divide-green-800">
                      {linksAdded.map((link) => {
                        const sId = (link as any).sourceDisplayId || link.sourceId?.slice(0, 8)
                        const tId = (link as any).targetDisplayId || link.targetId?.slice(0, 8)
                        const sLabel = (link as any).sourceLabel || (link as any).sourceTitle
                        const tLabel = (link as any).targetLabel || (link as any).targetTitle
                        const line = `${link.sourceType}:${sId} → ${link.targetType}:${tId} [${link.linkType}]`
                        const detail = [sLabel ? `From: ${sLabel}` : null, tLabel ? `To: ${tLabel}` : null].filter(Boolean).join(' • ')
                        return (
                          <div key={link.id} className="p-2 text-sm font-mono" title={detail || line}>
                            <div>{line}</div>
                            {detail && <div className="mt-0.5 text-[11px] font-sans text-gray-600 dark:text-gray-300 truncate">{detail}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              {linksRemoved.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Removed ({linksRemoved.length})</h4>
                  <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden bg-red-50/50 dark:bg-red-900/10 max-h-48 overflow-y-auto">
                    <div className="divide-y divide-red-200 dark:divide-red-800">
                      {linksRemoved.map((link) => {
                        const sId = (link as any).sourceDisplayId || link.sourceId?.slice(0, 8)
                        const tId = (link as any).targetDisplayId || link.targetId?.slice(0, 8)
                        const sLabel = (link as any).sourceLabel || (link as any).sourceTitle
                        const tLabel = (link as any).targetLabel || (link as any).targetTitle
                        const line = `${link.sourceType}:${sId} → ${link.targetType}:${tId} [${link.linkType}]`
                        const detail = [sLabel ? `From: ${sLabel}` : null, tLabel ? `To: ${tLabel}` : null].filter(Boolean).join(' • ')
                        return (
                          <div key={link.id} className="p-2 text-sm font-mono" title={detail || line}>
                            <div>{line}</div>
                            {detail && <div className="mt-0.5 text-[11px] font-sans text-gray-600 dark:text-gray-300 truncate">{detail}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              {linksSuspectChanged.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">Suspect changed ({linksSuspectChanged.length})</h4>
                  <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden bg-amber-50/50 dark:bg-amber-900/10 max-h-48 overflow-y-auto">
                    <div className="divide-y divide-amber-200 dark:divide-amber-800">
                      {linksSuspectChanged.map((link) => {
                        const sId = (link as any).sourceDisplayId || link.sourceId?.slice(0, 8)
                        const tId = (link as any).targetDisplayId || link.targetId?.slice(0, 8)
                        const sLabel = (link as any).sourceLabel || (link as any).sourceTitle
                        const tLabel = (link as any).targetLabel || (link as any).targetTitle
                        const line = `${link.sourceType}:${sId} → ${link.targetType}:${tId} [${link.linkType}]`
                        const detail = [sLabel ? `From: ${sLabel}` : null, tLabel ? `To: ${tLabel}` : null].filter(Boolean).join(' • ')
                        return (
                          <div key={link.id} className="p-2 text-sm font-mono" title={detail || line}>
                            <div>{line}</div>
                            {detail && <div className="mt-0.5 text-[11px] font-sans text-gray-600 dark:text-gray-300 truncate">{detail}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              {totalLinks === 0 && (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No link changes{hasSearch ? ' match search' : ''}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BaselineComparisonModal({
  projectId,
  baselineAId,
  baselineBId,
  onClose,
  onViewInBaseline,
}: BaselineComparisonModalProps) {
  const [activeTab, setActiveTab] = useState<CompareTab>('summary')
  const [searchQuery, setSearchQuery] = useState('')
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({
    added: false,
    removed: false,
    modified: false,
    links: false,
  })
  const [sortBy, setSortBy] = useState<'id' | 'title'>('id')
  const [expandedModal, setExpandedModal] = useState(false)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const { data: comparison, isLoading } = useQuery({
    queryKey: ['baseline-comparison', projectId, baselineAId, baselineBId],
    queryFn: async () => {
      const response = await baselineService.compareBaselines(projectId, baselineAId, baselineBId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to compare baselines')
    },
    enabled: !!projectId && !!baselineAId && !!baselineBId,
  })

  const filterAndSort = useMemo(() => {
    if (!comparison) return { added: [], removed: [], modified: [], linksAdded: [], linksRemoved: [], linksSuspectChanged: [] }
    const added = comparison.added.filter((r) => matchesSearch(r, searchQuery))
    const removed = comparison.removed.filter((r) => matchesSearch(r, searchQuery))
    const modified = comparison.modified.filter((r) => matchesSearch(r, searchQuery))
    const linksAdded = (comparison.linksAdded || []).filter((l) => linkMatchesSearch(l, searchQuery))
    const linksRemoved = (comparison.linksRemoved || []).filter((l) => linkMatchesSearch(l, searchQuery))
    const linksSuspectChanged = (comparison.linksSuspectChanged || []).filter((l) => linkMatchesSearch(l, searchQuery))
    const sortFn = (a: RequirementComparisonItem, b: RequirementComparisonItem) => {
      if (sortBy === 'id') return (a.requirementId || a.id).localeCompare(b.requirementId || b.id)
      return (a.title || '').localeCompare(b.title || '')
    }
    return {
      added: [...added].sort(sortFn),
      removed: [...removed].sort(sortFn),
      modified: [...modified].sort(sortFn),
      linksAdded,
      linksRemoved,
      linksSuspectChanged,
    }
  }, [comparison, searchQuery, sortBy])

  const toggleSection = (key: string) => {
    setSectionCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleExportExcel = (comp: BaselineComparison, fs: typeof filterAndSort) => {
    const wb = XLSX.utils.book_new()
    const summaryData = [
      ['Baseline A', comp.baselineA.name, format(new Date(comp.baselineA.createdAt), 'PPp')],
      ['Baseline B', comp.baselineB.name, format(new Date(comp.baselineB.createdAt), 'PPp')],
      [],
      ['Req Added', comp.added.length],
      ['Req Removed', comp.removed.length],
      ['Req Modified', comp.modified.length],
      ['Links Added', comp.linksAdded?.length ?? 0],
      ['Links Removed', comp.linksRemoved?.length ?? 0],
      ['Links Suspect Changed', comp.linksSuspectChanged?.length ?? 0],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary')
    if (fs.added.length > 0) {
      const addedSheet = fs.added.map((r) => ({
        requirementId: r.requirementId,
        title: r.title,
        description: stripHtml(r.description),
        priority: r.priority,
        status: r.status,
        category: r.category,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(addedSheet), 'Added')
    }
    if (fs.removed.length > 0) {
      const removedSheet = fs.removed.map((r) => ({
        requirementId: r.requirementId,
        title: r.title,
        description: stripHtml(r.description),
        priority: r.priority,
        status: r.status,
        category: r.category,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(removedSheet), 'Removed')
    }
    if (fs.modified.length > 0) {
      const modifiedSheet = fs.modified.map((r) => ({
        requirementId: r.requirementId,
        title: r.title,
        description: stripHtml(r.description),
        priority: r.priority,
        status: r.status,
        category: r.category,
        previousTitle: r.previous?.title,
        previousPriority: r.previous?.priority,
        previousStatus: r.previous?.status,
        previousDescription: r.previous?.description ? stripHtml(String(r.previous.description)) : undefined,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modifiedSheet), 'Modified')
    }
    if (fs.linksAdded.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fs.linksAdded), 'Links Added')
    }
    if (fs.linksRemoved.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fs.linksRemoved), 'Links Removed')
    }
    if (fs.linksSuspectChanged.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fs.linksSuspectChanged), 'Links Suspect Changed')
    }
    XLSX.writeFile(wb, `baseline-comparison-${comp.baselineA.name}-vs-${comp.baselineB.name}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const handleExportPDF = async (comp: BaselineComparison, fs: typeof filterAndSort) => {
    const autoTable = await loadAutoTable()
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Baseline Comparison: ${comp.baselineA.name} vs ${comp.baselineB.name}`, 14, 20)
    doc.setFontSize(10)
    doc.text(`A: ${comp.baselineA.name} (${format(new Date(comp.baselineA.createdAt), 'PPp')})`, 14, 28)
    doc.text(`B: ${comp.baselineB.name} (${format(new Date(comp.baselineB.createdAt), 'PPp')})`, 14, 34)
    doc.text(`Added: ${comp.added.length}  Removed: ${comp.removed.length}  Modified: ${comp.modified.length}`, 14, 42)
    let y = 52
    if (fs.added.length > 0) {
      doc.setFontSize(12)
      doc.text('Added Requirements', 14, y)
      y += 6
      autoTable(doc, {
        startY: y,
        head: [['ID', 'Title', 'Priority', 'Status']],
        body: fs.added.map((r) => [r.requirementId || '', (r.title || '').substring(0, 40), r.priority || '', r.status || '']),
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }
    if (fs.removed.length > 0) {
      doc.setFontSize(12)
      doc.text('Removed Requirements', 14, y)
      y += 6
      autoTable(doc, {
        startY: y,
        head: [['ID', 'Title', 'Priority', 'Status']],
        body: fs.removed.map((r) => [r.requirementId || '', (r.title || '').substring(0, 40), r.priority || '', r.status || '']),
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }
    if (fs.modified.length > 0) {
      doc.setFontSize(12)
      doc.text('Modified Requirements', 14, y)
      y += 6
      autoTable(doc, {
        startY: y,
        head: [['ID', 'Title', 'Prev Title', 'Priority', 'Status']],
        body: fs.modified.map((r) => [
          r.requirementId || '',
          (r.title || '').substring(0, 25),
          (r.previous?.title || '').substring(0, 25),
          r.priority || '',
          r.status || '',
        ]),
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }
    if (fs.linksAdded.length > 0) {
      doc.setFontSize(12)
      doc.text('Links Added', 14, y)
      y += 6
      autoTable(doc, {
        startY: y,
        head: [['Source', 'Target', 'Type']],
        body: fs.linksAdded.map((l) => [`${l.sourceType}:${l.sourceId?.slice(0, 8)}`, `${l.targetType}:${l.targetId?.slice(0, 8)}`, l.linkType || '']),
      })
      y = (doc as any).lastAutoTable.finalY + 10
    }
    if (fs.linksRemoved.length > 0) {
      doc.setFontSize(12)
      doc.text('Links Removed', 14, y)
      y += 6
      autoTable(doc, {
        startY: y,
        head: [['Source', 'Target', 'Type']],
        body: fs.linksRemoved.map((l) => [`${l.sourceType}:${l.sourceId?.slice(0, 8)}`, `${l.targetType}:${l.targetId?.slice(0, 8)}`, l.linkType || '']),
      })
    }
    doc.save(`baseline-comparison-${comp.baselineA.name}-vs-${comp.baselineB.name}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={clsx(
          'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-h-[90vh] flex flex-col transition-all',
          expandedModal ? 'w-[95vw]' : 'w-[1100px]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Baseline Comparison
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Compare two baselines
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpandedModal(!expandedModal)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title={expandedModal ? 'Shrink' : 'Expand'}
            >
              {expandedModal ? <ChevronDown size={20} className="text-gray-600 dark:text-gray-400 rotate-90" /> : <ChevronRight size={20} className="text-gray-600 dark:text-gray-400 rotate-90" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs + Search */}
        {comparison && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {(['summary', 'added', 'removed', 'modified', 'links'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-medium capitalize',
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  )}
                >
                  {tab === 'summary' ? 'Summary' : tab === 'links' ? 'Links' : tab}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, title, description..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'id' | 'title')}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="id">Requirement ID</option>
                <option value="title">Title</option>
              </select>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Comparing baselines...
            </div>
          ) : !comparison ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Failed to load comparison
            </div>
          ) : (
            <ComparisonContent
              comparison={comparison}
              filterAndSort={filterAndSort}
              activeTab={activeTab}
              sectionCollapsed={sectionCollapsed}
              toggleSection={toggleSection}
              hasSearch={!!searchQuery.trim()}
              onViewInBaseline={onViewInBaseline}
              baselineAId={baselineAId}
              baselineBId={baselineBId}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="relative">
            {comparison && (
              <>
                <button
                  onClick={() => setExportDropdownOpen((o) => !o)}
                  disabled={isExporting}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Download size={16} />
                  Export report
                </button>
                {exportDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setExportDropdownOpen(false)} aria-hidden />
                    <div className="absolute left-0 bottom-full mb-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => {
                          setExportDropdownOpen(false)
                          handleExportExcel(comparison, filterAndSort)
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <FileSpreadsheet size={16} />
                        Excel
                      </button>
                      <button
                        onClick={async () => {
                          setExportDropdownOpen(false)
                          setIsExporting(true)
                          try {
                            await handleExportPDF(comparison, filterAndSort)
                          } finally {
                            setIsExporting(false)
                          }
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <FileText size={16} />
                        PDF
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
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
