import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronDown, Settings, FileText, Search, FolderOpen, Inbox, AlertCircle, GitPullRequest, Layers, ClipboardList, Link2, Plus, Edit2, Copy, ExternalLink, BarChart3, Unlink, Download, Sliders } from 'lucide-react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { functionService } from '../../services/function.service'
import { linkService } from '../../services/link.service'
import type { SystemFunction } from 'shared/types/engineering.types'
import type { Requirement } from 'shared/types/engineering.types'
import type { Link } from 'shared/types/linkage.types'
import { LINKAGE_V1 } from '../../config/featureFlags'
import {
  buildFunctionTree,
  flattenFunctionTree,
  type FunctionTreeNode,
} from '../../config/functionsTabs'
import clsx from 'clsx'

interface LinkLike {
  id?: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  targetLabel?: string
  targetTitle?: string
  targetDisplayId?: string
  sourceTitle?: string
  sourceDisplayId?: string
  sourceLabel?: string
  linkType?: string
  _displayTargetType?: string
}

export interface LinkedElementClickPayload {
  targetType: string
  targetId: string
  sourceType: string
  sourceId: string
  isOutgoing: boolean
  link: LinkLike
}

type TreeNode = FunctionTreeNode

interface FlatTreeItem {
  id: string
  type: 'function' | 'requirement' | 'unassigned' | 'linked_element' | 'no_linked_elements'
  name: string
  depth: number
  parentFunctionId: string | null
  hasChildren: boolean
  functionId?: string
  function?: SystemFunction
  requirementId?: string
  requirement?: Requirement
  link?: LinkLike
}

interface RequirementsFunctionsTreeProps {
  projectId: string
  requirements: Requirement[]
  selectedFunctionId: string | null
  onFunctionSelect: (functionId: string | null) => void
  allocationLinks: Link[]
  onRequirementClick?: (req: Requirement) => void
  onLinkedElementClick?: (payload: LinkedElementClickPayload) => void
  onDropRequirements: (requirementIds: string[], functionId: string | null) => Promise<void>
  isDropTarget: boolean
  onAddRequirementToFunction?: (functionId: string) => void
  onAddRequirementUnassigned?: () => void
  onEditRequirement?: (req: Requirement) => void
  onRemoveAllocation?: (reqId: string, functionId: string | null) => void
  onRemoveLink?: (linkId: string) => void
  onCreateChangeRequest?: (req: Requirement) => void
  onCreateIssue?: (req: Requirement) => void
  onOpenTraceabilityMatrix?: (focusReqId?: string) => void
  onExportForFunction?: (functionId: string, functionName?: string) => void
}

function buildFlatTree(
  tree: TreeNode[],
  requirements: Requirement[],
  allocationLinks: Link[],
  expandedNodes: Set<string>,
  expandedReqs: Set<string>,
  searchQuery: string,
  getLinksForReq: (req: Requirement) => LinkLike[]
): FlatTreeItem[] {
  const items: FlatTreeItem[] = []

  // reqId -> functionIds (requirements can allocate to multiple functions)
  const reqsByFunction = new Map<string, Requirement[]>()
  const allocatedReqIds = new Set<string>()
  for (const link of allocationLinks) {
    if (
      link.sourceType === 'requirement' &&
      link.targetType === 'function' &&
      link.linkType === 'allocated_to'
    ) {
      allocatedReqIds.add(link.sourceId)
      const list = reqsByFunction.get(link.targetId) || []
      const req = requirements.find((r) => r.id === link.sourceId)
      if (req && !list.some((r) => r.id === req.id)) list.push(req)
      reqsByFunction.set(link.targetId, list)
    }
  }
  const unassigned = requirements.filter((r) => !allocatedReqIds.has(r.id))

  const validFunctionIds = new Set(flattenFunctionTree(tree).map((f) => f.id))
  const lowerQuery = searchQuery.toLowerCase()

  function functionMatches(node: TreeNode): boolean {
    if (!searchQuery) return true
    const fn = node.function
    if ((fn.functionId || fn.name).toLowerCase().includes(lowerQuery)) return true
    const reqs = reqsByFunction.get(fn.id) || []
    if (reqs.some((r) => (r.requirementId || r.title).toLowerCase().includes(lowerQuery)))
      return true
    return node.children.some((c) => functionMatches(c))
  }

  function addFunction(node: TreeNode, depth: number) {
    if (searchQuery && !functionMatches(node)) return
    const fn = node.function
    const reqs = (reqsByFunction.get(fn.id) || []).filter((r) =>
      validFunctionIds.has(fn.id)
    )
    const hasChildren =
      node.children.length > 0 || reqs.length > 0

    items.push({
      id: `fn-${fn.id}`,
      type: 'function',
      name: fn.name,
      depth,
      parentFunctionId: null,
      hasChildren,
      functionId: fn.functionId || undefined,
      function: fn,
    })

    if (expandedNodes.has(fn.id)) {
      for (const child of node.children) {
        addFunction(child, depth + 1)
      }
      for (const req of reqs) {
        if (
          searchQuery &&
          !(req.requirementId || req.title).toLowerCase().includes(lowerQuery)
        )
          continue
        const reqLinks = getLinksForReq(req)
        const hasLinkedElements = reqLinks.length > 0
        items.push({
          id: `req-${req.id}-${fn.id}`,
          type: 'requirement',
          name: req.title,
          depth: depth + 1,
          parentFunctionId: fn.id,
          hasChildren: hasLinkedElements,
          requirementId: req.requirementId || undefined,
          requirement: req,
        })
        if (expandedReqs.has(req.id)) {
          if (hasLinkedElements) {
            for (const link of reqLinks) {
              const isOutgoing = link.sourceType === 'requirement' && link.sourceId === req.id
              const label = isOutgoing
                ? (link.targetLabel ?? link.targetTitle ?? link.targetDisplayId ?? `${link.targetType}:${link.targetId.slice(0, 8)}`)
                : (link.sourceLabel ?? link.sourceTitle ?? link.sourceDisplayId ?? `${link.sourceType}:${link.sourceId.slice(0, 8)}`)
              const targetType = isOutgoing ? link.targetType : link.sourceType
              const linkKey = link.id ?? `${link.sourceType}-${link.sourceId}-${link.targetType}-${link.targetId}`
              items.push({
                id: `link-${req.id}-${linkKey}-${fn.id}`,
                type: 'linked_element',
                name: label,
                depth: depth + 2,
                parentFunctionId: fn.id,
                hasChildren: false,
                link: { ...link, _displayTargetType: targetType } as LinkLike,
              })
            }
          } else {
            items.push({
              id: `no-links-${req.id}-${fn.id}`,
              type: 'no_linked_elements',
              name: 'No linked elements',
              depth: depth + 2,
              parentFunctionId: fn.id,
              hasChildren: false,
              requirement: req,
            } as FlatTreeItem)
          }
        }
      }
    }
  }

  for (const root of tree) {
    addFunction(root, 0)
  }

  const filteredUnassigned = searchQuery
    ? unassigned.filter((r) =>
        (r.requirementId || r.title).toLowerCase().includes(lowerQuery)
      )
    : unassigned

  if (filteredUnassigned.length > 0 || !searchQuery) {
    items.push({
      id: 'unassigned-header',
      type: 'unassigned',
      name: `Unassigned (${filteredUnassigned.length})`,
      depth: 0,
      parentFunctionId: null,
      hasChildren: filteredUnassigned.length > 0,
    })

    if (expandedNodes.has('unassigned')) {
      for (const req of filteredUnassigned) {
        const reqLinks = getLinksForReq(req)
        const hasLinkedElements = reqLinks.length > 0
        items.push({
          id: `req-${req.id}-unassigned`,
          type: 'requirement',
          name: req.title,
          depth: 1,
          parentFunctionId: null,
          hasChildren: hasLinkedElements,
          requirementId: req.requirementId || undefined,
          requirement: req,
        })
        if (expandedReqs.has(req.id)) {
          if (hasLinkedElements) {
            for (const link of reqLinks) {
              const isOutgoing = link.sourceType === 'requirement' && link.sourceId === req.id
              const label = isOutgoing
                ? (link.targetLabel ?? link.targetTitle ?? link.targetDisplayId ?? `${link.targetType}:${link.targetId.slice(0, 8)}`)
                : (link.sourceLabel ?? link.sourceTitle ?? link.sourceDisplayId ?? `${link.sourceType}:${link.sourceId.slice(0, 8)}`)
              const targetType = isOutgoing ? link.targetType : link.sourceType
              const linkKey = link.id ?? `${link.sourceType}-${link.sourceId}-${link.targetType}-${link.targetId}`
              items.push({
                id: `link-${req.id}-${linkKey}-unassigned`,
                type: 'linked_element',
                name: label,
                depth: 2,
                parentFunctionId: null,
                hasChildren: false,
                link: { ...link, _displayTargetType: targetType } as LinkLike,
              })
            }
          } else {
            items.push({
              id: `no-links-${req.id}-unassigned`,
              type: 'no_linked_elements',
              name: 'No linked elements',
              depth: 2,
              parentFunctionId: null,
              hasChildren: false,
              requirement: req,
            } as FlatTreeItem)
          }
        }
      }
    }
  }

  return items
}

type ContextMenuTarget = { type: 'function'; functionId: string; functionName?: string }
  | { type: 'requirement'; req: Requirement; parentFunctionId: string | null }
  | { type: 'linked_element'; link: LinkLike; payload: LinkedElementClickPayload }
  | { type: 'unassigned' }

export default function RequirementsFunctionsTree({
  projectId,
  requirements,
  selectedFunctionId,
  onFunctionSelect,
  allocationLinks,
  onRequirementClick,
  onLinkedElementClick,
  onDropRequirements,
  isDropTarget,
  onAddRequirementToFunction,
  onAddRequirementUnassigned,
  onEditRequirement,
  onRemoveAllocation,
  onRemoveLink,
  onCreateChangeRequest,
  onCreateIssue,
  onOpenTraceabilityMatrix,
  onExportForFunction,
}: RequirementsFunctionsTreeProps) {
  const navigate = useNavigate()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['unassigned']))
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ target: ContextMenuTarget; x: number; y: number } | null>(null)

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const linkQueries = useQueries({
    queries: requirements.flatMap((req) => [
      {
        queryKey: ['requirement-links-out', projectId, req.id],
        queryFn: async () => {
          const r = await linkService.getLinks(projectId, { sourceId: req.id })
          return r.success && r.data ? r.data : []
        },
        enabled: !!projectId && !!req.id && !!LINKAGE_V1,
      },
      {
        queryKey: ['requirement-links-in', projectId, req.id],
        queryFn: async () => {
          const r = await linkService.getLinks(projectId, { targetId: req.id })
          return r.success && r.data ? r.data : []
        },
        enabled: !!projectId && !!req.id && !!LINKAGE_V1,
      },
    ]),
  })

  // Include allocated_to for visibility when chevron expanded (bidirectional link display).
  // Merge allocationLinks so the function shows as linked element even when traceability API fails.
  const linksByReqId = useMemo(() => {
    const keyOf = (l: LinkLike) => l.id ?? `${l.sourceType}-${l.sourceId}-${l.targetType}-${l.targetId}`
    const funcMap = new Map(functions.map((f) => [f.id, f]))
    const reqMapForEnrich = new Map(requirements.map((r) => [r.id, r]))
    const reqByReqIdMap = new Map<string, Requirement>()
    requirements.forEach((r) => { if (r.requirementId) reqByReqIdMap.set(String(r.requirementId), r) })
    const isReqType = (t: string) => ['requirement', 'hazard', 'risk'].includes((t || '').toLowerCase())
    const findReq = (id: string) => reqMapForEnrich.get(id) ?? reqByReqIdMap.get(id) ?? requirements.find((r) => r.id === id || String(r.requirementId) === id)
    const enrichLink = (l: LinkLike): LinkLike => {
      let enriched = { ...l }
      if (isReqType(l.targetType) && !l.targetLabel && !l.targetTitle) {
        const r = findReq(l.targetId)
        if (r) {
          const displayId = r.requirementId || r.id.slice(0, 8)
          enriched = { ...enriched, targetLabel: `${displayId} - ${r.title}`, targetTitle: r.title, targetDisplayId: displayId }
        }
      }
      if (isReqType(l.sourceType) && !l.sourceLabel && !l.sourceTitle) {
        const r = findReq(l.sourceId)
        if (r) {
          const displayId = r.requirementId || r.id.slice(0, 8)
          enriched = { ...enriched, sourceLabel: `${displayId} - ${r.title}`, sourceTitle: r.title, sourceDisplayId: displayId }
        }
      }
      return enriched
    }
    const map = new Map<string, LinkLike[]>()
    requirements.forEach((req, i) => {
      const outIdx = i * 2
      const inIdx = i * 2 + 1
      const outgoing = (linkQueries[outIdx]?.data as LinkLike[] | undefined) ?? []
      const incoming = (linkQueries[inIdx]?.data as LinkLike[] | undefined) ?? []
      const seen = new Set<string>()
      const combined: LinkLike[] = []
      for (const l of [...outgoing, ...incoming]) {
        const k = keyOf(l)
        if (seen.has(k)) continue
        seen.add(k)
        combined.push(enrichLink(l))
      }
      // Merge allocation links (requirement -> function) so function appears when chevron expanded
      for (const link of allocationLinks) {
        if (
          link.sourceType === 'requirement' &&
          link.sourceId === req.id &&
          link.targetType === 'function' &&
          link.linkType === 'allocated_to'
        ) {
          const k = keyOf(link as LinkLike)
          if (seen.has(k)) continue
          seen.add(k)
          const fn = funcMap.get(link.targetId)
          const targetLabel = fn?.name ?? fn?.functionId ?? link.targetId.slice(0, 8)
          combined.push({
            ...link,
            targetLabel,
            targetTitle: targetLabel,
            targetDisplayId: fn?.functionId ?? link.targetId.slice(0, 8),
            _displayTargetType: 'function',
          } as LinkLike)
        }
      }
      map.set(req.id, combined)
    })
    return map
  }, [requirements, linkQueries, allocationLinks, functions])

  const functionTree = useMemo(() => buildFunctionTree(functions), [functions])

  useEffect(() => {
    if (functionTree.length > 0) {
      setExpandedNodes((prev) => {
        const next = new Set(prev)
        const expandAll = (nodes: TreeNode[]) => {
          for (const node of nodes) {
            next.add(node.function.id)
            if (node.children.length > 0) expandAll(node.children)
          }
        }
        expandAll(functionTree)
        return next
      })
    }
  }, [functionTree.length])

  const toggleReq = useCallback((reqId: string) => {
    setExpandedReqs((prev) => {
      const next = new Set(prev)
      if (next.has(reqId)) next.delete(reqId)
      else next.add(reqId)
      return next
    })
  }, [])

  const getLinksForReq = useCallback(
    (req: Requirement) => linksByReqId.get(req.id) ?? [],
    [linksByReqId]
  )

  const flatItems = useMemo(
    () =>
      buildFlatTree(
        functionTree,
        requirements,
        allocationLinks,
        expandedNodes,
        expandedReqs,
        searchQuery,
        getLinksForReq
      ),
    [functionTree, requirements, allocationLinks, expandedNodes, expandedReqs, searchQuery, getLinksForReq]
  )

  const hasAutoExpandedRef = useRef(false)
  useEffect(() => {
    if (!LINKAGE_V1 || hasAutoExpandedRef.current) return
    const toExpand = new Set<string>()
    for (const req of requirements) {
      if ((linksByReqId.get(req.id) ?? []).length > 0) toExpand.add(req.id)
    }
    if (toExpand.size === 0) return
    hasAutoExpandedRef.current = true
    setExpandedReqs((prev) => {
      const next = new Set(prev)
      toExpand.forEach((id) => next.add(id))
      return next
    })
  }, [requirements, linksByReqId])

  const reqCounts = useMemo(() => {
    const seenPerFunc = new Map<string, Set<string>>()
    for (const link of allocationLinks) {
      if (
        link.sourceType === 'requirement' &&
        link.targetType === 'function' &&
        link.linkType === 'allocated_to'
      ) {
        const set = seenPerFunc.get(link.targetId) || new Set<string>()
        set.add(link.sourceId)
        seenPerFunc.set(link.targetId, set)
      }
    }
    const counts = new Map<string, number>()
    seenPerFunc.forEach((set, funcId) => counts.set(funcId, set.size))
    return counts
  }, [allocationLinks])

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }, [])

  const handleFunctionClick = useCallback(
    (functionId: string | null) => {
      onFunctionSelect(selectedFunctionId === functionId ? null : functionId)
    },
    [onFunctionSelect, selectedFunctionId]
  )

  const handleDragStart = useCallback((e: React.DragEvent, requirementId: string) => {
    e.dataTransfer.setData('application/requirement-id', requirementId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      if (!isDropTarget) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverId(targetId)
    },
    [isDropTarget]
  )

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent, targetFunctionId: string | null) => {
      if (!isDropTarget) return
      e.preventDefault()
      setDragOverId(null)
      let ids: string[] = []
      const rawIds = e.dataTransfer.getData('application/requirement-ids')
      const singleId = e.dataTransfer.getData('application/requirement-id')
      if (rawIds) {
        try {
          const parsed = JSON.parse(rawIds)
          if (Array.isArray(parsed)) ids = parsed
        } catch {
          /* ignore */
        }
      }
      if (ids.length === 0 && singleId) ids = [singleId]
      if (ids.length === 0) return
      if (targetFunctionId === 'unassigned' || targetFunctionId === null) {
        onDropRequirements(ids, null)
      } else {
        onDropRequirements(ids, targetFunctionId)
      }
    },
    [isDropTarget, onDropRequirements]
  )

  return (
    <div className="flex flex-col h-[calc(100%-1rem)] m-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Settings className="w-4 h-4" />
          </div>
          Functions
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search functions..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl
              bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
              placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {functionTree.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No functions found.</p>
            <p className="mt-1 text-xs opacity-70">
              Create functions in the System Functions page first.
            </p>
          </div>
        ) : (
          flatItems.map((item) => {
            const isSelected =
              item.type === 'function' &&
              item.functionId &&
              item.function?.id === selectedFunctionId
            const isDragOver =
              (item.type === 'function' && dragOverId === item.function?.id) ||
              (item.type === 'unassigned' && dragOverId === 'unassigned')
            const dropTargetId =
              item.type === 'function'
                ? item.function?.id ?? null
                : item.type === 'unassigned'
                  ? 'unassigned'
                  : null
            const isExpanded =
              dropTargetId &&
              (dropTargetId === 'unassigned'
                ? expandedNodes.has('unassigned')
                : expandedNodes.has(dropTargetId))

            if (item.type === 'requirement') {
              const req = item.requirement!
              const reqLinks = linksByReqId.get(req.id) ?? []
              const hasLinkedElements = reqLinks.length > 0
              const isReqExpanded = expandedReqs.has(req.id)
              return (
                <div
                  key={item.id}
                  className="group flex items-center mx-2 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                  style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setContextMenu({ target: { type: 'requirement', req, parentFunctionId: item.parentFunctionId }, x: e.clientX, y: e.clientY })
                  }}
                >
                  <button
                    type="button"
                    aria-label={isReqExpanded ? 'Collapse linked elements' : 'Expand linked elements'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleReq(req.id)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex-shrink-0 relative z-20 w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer select-none text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    title={hasLinkedElements ? `${reqLinks.length} linked - click to ${isReqExpanded ? 'collapse' : 'expand'}` : 'Expand for linked elements'}
                  >
                    {isReqExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div
                    role={onRequirementClick ? 'button' : undefined}
                    tabIndex={onRequirementClick ? 0 : undefined}
                    onClick={() => onRequirementClick?.(req)}
                    onKeyDown={(e) => {
                      if (onRequirementClick && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        onRequirementClick(req)
                      }
                    }}
                    className={clsx(
                      'flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 rounded-lg',
                      isDropTarget ? 'cursor-grab' : '',
                      onRequirementClick ? 'cursor-pointer' : ''
                    )}
                    draggable={isDropTarget}
                    onDragStart={isDropTarget ? (e) => handleDragStart(e, req.id) : undefined}
                    title={onRequirementClick ? 'Click to preview' : undefined}
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                    <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px] flex-shrink-0">
                      {item.requirementId || '—'}
                    </span>
                    <span
                      className="text-gray-600 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    {hasLinkedElements && !isReqExpanded && (
                      <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                        +{reqLinks.length}
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            if (item.type === 'no_linked_elements') {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-1 mx-2 text-xs text-gray-400 dark:text-gray-500 italic"
                  style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
                >
                  <span>{item.name}</span>
                </div>
              )
            }

            if (item.type === 'linked_element') {
              const link = item.link!
              const displayType = link._displayTargetType ?? link.targetType
              const isOutgoing = link.sourceType === 'requirement' && link.sourceId
              const entityType = isOutgoing ? link.targetType : link.sourceType
              const entityId = isOutgoing ? link.targetId : link.sourceId
              const Icon =
                displayType === 'function'
                  ? Settings
                  : displayType === 'parameter'
                    ? Sliders
                    : displayType === 'issue'
                    ? AlertCircle
                    : displayType === 'change_request'
                      ? GitPullRequest
                      : displayType === 'requirement'
                        ? FileText
                        : displayType === 'use_case'
                          ? Layers
                          : displayType === 'test_plan' || displayType === 'test_case'
                            ? ClipboardList
                            : Link2
              const payload: LinkedElementClickPayload = {
                targetType: entityType,
                targetId: entityId,
                sourceType: link.sourceType,
                sourceId: link.sourceId,
                isOutgoing: !!isOutgoing,
                link,
              }
              const handleLinkClick = () => onLinkedElementClick?.(payload)
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={handleLinkClick}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setContextMenu({ target: { type: 'linked_element', link, payload }, x: e.clientX, y: e.clientY })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleLinkClick()
                    }
                  }}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1 mx-2 text-xs rounded-md border-l-2 ml-4 transition-colors',
                    onLinkedElementClick
                      ? 'cursor-pointer bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/20 hover:border-indigo-200 dark:hover:border-indigo-800'
                      : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                  )}
                  style={{ paddingLeft: `${item.depth * 16 + 8}px` }}
                  title={onLinkedElementClick ? 'Click to preview' : undefined}
                >
                  <Icon className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px] flex-shrink-0 capitalize">
                    {String(displayType).replace(/_/g, ' ')}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 truncate">{item.name}</span>
                </div>
              )
            }

            if (item.type === 'unassigned') {
              return (
                <div
                  key={item.id}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setContextMenu({ target: { type: 'unassigned' }, x: e.clientX, y: e.clientY })
                  }}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 mx-2 mt-2 text-sm rounded-lg cursor-pointer select-none border transition-all',
                    isDragOver
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400 z-10'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                  )}
                  onClick={() => {
                    toggleNode('unassigned')
                    handleFunctionClick(null)
                  }}
                  onDragOver={(e) => handleDragOver(e, 'unassigned')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => {
                    e.stopPropagation()
                    handleDrop(e, null)
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
                  )}
                  <Inbox className="w-4 h-4 opacity-70 flex-shrink-0" />
                  <span className="font-medium" title={item.name}>
                    {item.name}
                  </span>
                </div>
              )
            }

            const count = reqCounts.get(item.function!.id) || 0
            return (
              <div
                key={item.id}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setContextMenu({ target: { type: 'function', functionId: item.function!.id, functionName: item.name }, x: e.clientX, y: e.clientY })
                }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 mx-2 text-sm rounded-lg cursor-pointer select-none border transition-all',
                  isSelected &&
                    'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium shadow-sm',
                  !isSelected && 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100',
                  isDragOver && 'ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 z-10'
                )}
                style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
                onClick={() => {
                  toggleNode(item.function!.id)
                  handleFunctionClick(item.function!.id)
                }}
                onDragOver={(e) => handleDragOver(e, item.function!.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  e.stopPropagation()
                  handleDrop(e, item.function!.id)
                }}
              >
                {item.hasChildren ? (
                  <span
                    className={clsx(
                      'flex transition-transform duration-200',
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    )}
                  >
                    <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                  </span>
                ) : (
                  <span className="w-4 flex-shrink-0" />
                )}
                <Settings
                  className={clsx(
                    'w-4 h-4 flex-shrink-0',
                    isSelected ? 'text-indigo-500' : 'text-amber-500/80 dark:text-amber-400/80'
                  )}
                />
                <span
                  className="text-[10px] font-mono text-gray-400 dark:text-gray-500 flex-shrink-0"
                  title={item.function!.id}
                >
                  {item.functionId || item.function!.id.slice(0, 8)}
                </span>
                <span className="truncate flex-1" title={item.name}>
                  {item.name}
                </span>
                {count > 0 && (
                  <span
                    className={clsx(
                      'flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full transition-colors',
                      isSelected
                        ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {count}
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 text-xs text-center text-gray-400 dark:text-gray-500">
        Drag requirements here to allocate to functions
      </div>

      {contextMenu && (() => {
        const t = contextMenu.target
        return (
          <div
            className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {t.type === 'function' && (
              <>
                {onAddRequirementToFunction && (
                  <button onClick={() => { onAddRequirementToFunction(t.functionId); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <Plus size={14} /> Add new requirement to function
                  </button>
                )}
                <button onClick={() => { projectId && navigate(`/projects/${projectId}/functions?selectedId=${t.functionId}`); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                  <ExternalLink size={14} /> Open in Functions page
                </button>
                <button onClick={() => { navigator.clipboard.writeText(t.functionId); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                  <Copy size={14} /> Copy function ID
                </button>
                {onExportForFunction && (
                  <button onClick={() => { onExportForFunction(t.functionId, t.functionName); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <Download size={14} /> Export requirements for function
                  </button>
                )}
              </>
            )}
            {t.type === 'requirement' && (
              <>
                {onRequirementClick && (
                  <button onClick={() => { onRequirementClick(t.req); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <ExternalLink size={14} /> Open
                  </button>
                )}
                {onEditRequirement && !t.req.isLocked && (
                  <button onClick={() => { onEditRequirement(t.req); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <Edit2 size={14} /> Edit requirement
                  </button>
                )}
                {onRemoveAllocation && t.parentFunctionId && !t.req.isLocked && (
                  <button onClick={() => { onRemoveAllocation(t.req.id, t.parentFunctionId); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <Unlink size={14} /> Remove allocation
                  </button>
                )}
                <button onClick={() => { navigator.clipboard.writeText(t.req.requirementId || t.req.id); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                  <Copy size={14} /> Copy requirement ID
                </button>
                {onCreateChangeRequest && (
                  <button onClick={() => { onCreateChangeRequest(t.req); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <GitPullRequest size={14} /> Create change request
                  </button>
                )}
                {onCreateIssue && (
                  <button onClick={() => { onCreateIssue(t.req); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <AlertCircle size={14} /> Create issue
                  </button>
                )}
                {onOpenTraceabilityMatrix && (
                  <button onClick={() => { onOpenTraceabilityMatrix(t.req.id); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <BarChart3 size={14} /> View in traceability matrix
                  </button>
                )}
              </>
            )}
            {t.type === 'linked_element' && (
              <>
                <button onClick={() => { onLinkedElementClick?.(t.payload); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                  <ExternalLink size={14} /> View target
                </button>
                {onRemoveLink && t.link.id && (
                  <button onClick={() => { onRemoveLink(t.link.id!); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-left">
                    <Unlink size={14} /> Remove link
                  </button>
                )}
              </>
            )}
            {t.type === 'unassigned' && (
              <>
                {onAddRequirementUnassigned && (
                  <button onClick={() => { onAddRequirementUnassigned(); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-left">
                    <Plus size={14} /> Add new requirement
                  </button>
                )}
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}
