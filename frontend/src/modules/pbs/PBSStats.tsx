import { useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronUp, Layers, Activity, GitBranch, Link2, Paperclip } from 'lucide-react'
import clsx from 'clsx'
import type { PBSNode } from './types'
import { PBS_TYPES, PBS_STATUSES } from './types'

interface PBSStatsProps {
  nodes: PBSNode[]
}

interface Statistics {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  maxDepth: number
  rootCount: number
  withRelationships: number
  withAttachments: number
  totalAttachmentSize: number
}

function calculateStats(nodes: PBSNode[]): Statistics {
  const byType: Record<string, number> = {}
  const byStatus: Record<string, number> = {}

  // Initialize counters
  PBS_TYPES.forEach((t) => (byType[t] = 0))
  PBS_STATUSES.forEach((s) => (byStatus[s] = 0))

  let withRelationships = 0
  let withAttachments = 0
  let totalAttachmentSize = 0

  nodes.forEach((node) => {
    byType[node.type] = (byType[node.type] || 0) + 1
    byStatus[node.status] = (byStatus[node.status] || 0) + 1
    // Backward compatibility: relationships/attachments may not exist on old data
    if (node.relationships?.length > 0) withRelationships++
    if (node.attachments?.length > 0) {
      withAttachments++
      totalAttachmentSize += node.attachments.reduce((sum, a) => sum + a.size, 0)
    }
  })

  // Calculate max depth
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  let maxDepth = 0

  function getDepth(nodeId: string, visited: Set<string> = new Set()): number {
    if (visited.has(nodeId)) return 0 // Prevent cycles
    visited.add(nodeId)
    const node = nodeMap.get(nodeId)
    if (!node || !node.parentId) return 1
    return 1 + getDepth(node.parentId, visited)
  }

  nodes.forEach((n) => {
    const depth = getDepth(n.id)
    if (depth > maxDepth) maxDepth = depth
  })

  const rootCount = nodes.filter((n) => !n.parentId).length

  return {
    total: nodes.length,
    byType,
    byStatus,
    maxDepth,
    rootCount,
    withRelationships,
    withAttachments,
    totalAttachmentSize,
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const TYPE_COLORS: Record<string, string> = {
  System: 'bg-purple-500',
  Subsystem: 'bg-indigo-500',
  Assembly: 'bg-amber-500',
  Part: 'bg-gray-500',
  Software: 'bg-green-500',
  Document: 'bg-blue-500',
}

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-400',
  'In Work': 'bg-yellow-500',
  Released: 'bg-green-500',
  Obsolete: 'bg-red-500',
}

export default function PBSStats({ nodes }: PBSStatsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const stats = useMemo(() => calculateStats(nodes), [nodes])

  if (nodes.length === 0) return null

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <BarChart3 size={14} />
          <span className="font-medium">{stats.total} components</span>
          <span className="text-gray-400 dark:text-gray-500">·</span>
          <span>{stats.maxDepth} levels deep</span>
        </div>
        {isExpanded ? (
          <ChevronDown size={14} className="text-gray-400" />
        ) : (
          <ChevronUp size={14} className="text-gray-400" />
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Layers size={14} className="text-gray-400" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Root items</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{stats.rootCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <GitBranch size={14} className="text-gray-400" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Max depth</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{stats.maxDepth}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Link2 size={14} className="text-gray-400" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">With links</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{stats.withRelationships}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Paperclip size={14} className="text-gray-400" />
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Attachments</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {stats.withAttachments > 0 ? `${stats.withAttachments} (${formatBytes(stats.totalAttachmentSize)})` : '0'}
                </div>
              </div>
            </div>
          </div>

          {/* By Type */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={12} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">By Type</span>
            </div>
            <div className="space-y-1.5">
              {PBS_TYPES.filter((t) => stats.byType[t] > 0).map((type) => {
                const count = stats.byType[type]
                const percent = (count / stats.total) * 100
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-20 truncate">{type}</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full', TYPE_COLORS[type] || 'bg-gray-500')}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Status */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={12} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">By Status</span>
            </div>
            <div className="space-y-1.5">
              {PBS_STATUSES.filter((s) => stats.byStatus[s] > 0).map((status) => {
                const count = stats.byStatus[status]
                const percent = (count / stats.total) * 100
                return (
                  <div key={status} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400 w-20 truncate">{status}</span>
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full', STATUS_COLORS[status] || 'bg-gray-500')}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
