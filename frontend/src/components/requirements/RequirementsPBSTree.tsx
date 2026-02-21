import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, Package, FileText, Search, FolderOpen, Inbox, Settings, AlertCircle, GitPullRequest, Layers, ClipboardList, Link2 } from 'lucide-react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { componentService } from '../../services/component.service'
import { requirementService } from '../../services/requirement.service'
import { linkService } from '../../services/link.service'
import { loadPBSAsync } from '../../modules/pbs/storage'
import type { ComponentTreeNode } from 'shared/types/project.types'
import clsx from 'clsx'
import type { Requirement } from 'shared/types/engineering.types'
import { LINKAGE_V1 } from '../../config/featureFlags'

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
  linkType?: string
}

export interface LinkedElementClickPayload {
  targetType: string
  targetId: string
  sourceType: string
  sourceId: string
  isOutgoing: boolean
  link: LinkLike
}

interface RequirementsPBSTreeProps {
  projectId: string
  requirements: Requirement[]
  selectedComponentId: string | null
  onComponentSelect: (componentId: string | null) => void
  links?: LinkLike[]
  onLinkedElementClick?: (payload: LinkedElementClickPayload) => void
  onRequirementClick?: (req: Requirement) => void
}

interface FlatTreeItem {
  id: string
  type: 'component' | 'requirement' | 'unassigned' | 'linked_element' | 'no_linked_elements'
  name: string
  depth: number
  parentComponentId: string | null
  hasChildren: boolean
  requirementId?: string
  componentId?: string
  requirement?: Requirement
  link?: LinkLike
}

/** Collect all node IDs in the tree recursively */
function collectNodeIds(nodes: ComponentTreeNode[]): Set<string> {
    const ids = new Set<string>()
    function walk(n: ComponentTreeNode) {
        ids.add(n.id)
        if (n.children) n.children.forEach(walk)
    }
    nodes.forEach(walk)
    return ids
}

/**
 * Flatten the component tree + requirements + linked elements into a list for rendering.
 * Requirements whose componentId points to a missing/orphaned PBS node are shown as Unassigned.
 * When expanded, requirements show linked elements (functions, issues, change requests, etc.) under them.
 */
function buildFlatTree(
  tree: ComponentTreeNode[],
  requirements: Requirement[],
  expandedNodes: Set<string>,
  expandedReqs: Set<string>,
  searchQuery: string,
  getLinksForReq: (req: Requirement) => LinkLike[]
): FlatTreeItem[] {
    const items: FlatTreeItem[] = []
    const validComponentIds = collectNodeIds(tree)

    // Build a map of componentId -> requirements; treat orphaned componentIds as unassigned
    const reqsByComponent = new Map<string, Requirement[]>()
    const unassigned: Requirement[] = []
    for (const req of requirements) {
        if (req.componentId && validComponentIds.has(req.componentId)) {
            const list = reqsByComponent.get(req.componentId) || []
            list.push(req)
            reqsByComponent.set(req.componentId, list)
        } else {
            unassigned.push(req)
        }
    }

    const lowerQuery = searchQuery.toLowerCase()

    // Check if a component or its descendants have matching requirements
    function componentMatches(node: ComponentTreeNode): boolean {
        if (!searchQuery) return true
        if (node.name.toLowerCase().includes(lowerQuery)) return true
        const reqs = reqsByComponent.get(node.id) || []
        if (reqs.some(r => (r.requirementId || r.title).toLowerCase().includes(lowerQuery))) return true
        if (node.children) {
            return node.children.some(c => componentMatches(c))
        }
        return false
    }

    function addComponent(node: ComponentTreeNode, depth: number) {
        if (searchQuery && !componentMatches(node)) return

        const reqs = reqsByComponent.get(node.id) || []
        const hasChildren = (node.children && node.children.length > 0) || reqs.length > 0

        items.push({
            id: `comp-${node.id}`,
            type: 'component',
            name: node.name,
            depth,
            parentComponentId: null,
            hasChildren,
            componentId: node.id,
        })

        if (expandedNodes.has(node.id)) {
            // Add child components
            if (node.children) {
                for (const child of node.children) {
                    addComponent(child, depth + 1)
                }
            }

            // Add requirements under this component (with optional linked elements)
            for (const req of reqs) {
              if (searchQuery && !(req.requirementId || req.title).toLowerCase().includes(lowerQuery)) continue
              const reqLinks = getLinksForReq(req)
              const hasLinkedElements = reqLinks.length > 0
              items.push({
                id: `req-${req.id}`,
                type: 'requirement',
                name: req.title,
                depth: depth + 1,
                parentComponentId: node.id,
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
                      : (link.sourceTitle ?? link.sourceDisplayId ?? `${link.sourceType}:${link.sourceId.slice(0, 8)}`)
                    const targetType = isOutgoing ? link.targetType : link.sourceType
                    items.push({
                      id: `link-${req.id}-${link.id ?? `${link.sourceType}-${link.sourceId}-${link.targetType}-${link.targetId}`}`,
                      type: 'linked_element',
                      name: label,
                      depth: depth + 2,
                      parentComponentId: node.id,
                      hasChildren: false,
                      link: { ...link, _displayTargetType: targetType },
                    })
                  }
                } else {
                  items.push({
                    id: `no-links-${req.id}`,
                    type: 'no_linked_elements',
                    name: 'No linked elements',
                    depth: depth + 2,
                    parentComponentId: node.id,
                    hasChildren: false,
                    requirement: req,
                  } as FlatTreeItem)
                }
              }
            }
          }
        }

    for (const root of tree) {
        addComponent(root, 0)
    }

    // Add "Unassigned" section
    const filteredUnassigned = searchQuery
        ? unassigned.filter(r => (r.requirementId || r.title).toLowerCase().includes(lowerQuery))
        : unassigned

    if (filteredUnassigned.length > 0 || !searchQuery) {
        items.push({
            id: 'unassigned-header',
            type: 'unassigned',
            name: `Unassigned (${filteredUnassigned.length})`,
            depth: 0,
            parentComponentId: null,
            hasChildren: filteredUnassigned.length > 0,
        })

        if (expandedNodes.has('unassigned')) {
            for (const req of filteredUnassigned) {
              const reqLinks = getLinksForReq(req)
              const hasLinkedElements = reqLinks.length > 0
              items.push({
                id: `req-${req.id}`,
                type: 'requirement',
                name: req.title,
                depth: 1,
                parentComponentId: null,
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
                      : (link.sourceTitle ?? link.sourceDisplayId ?? `${link.sourceType}:${link.sourceId.slice(0, 8)}`)
                    const targetType = isOutgoing ? link.targetType : link.sourceType
                    items.push({
                      id: `link-${req.id}-${link.id ?? `${link.sourceType}-${link.sourceId}-${link.targetType}-${link.targetId}`}`,
                      type: 'linked_element',
                      name: label,
                      depth: 2,
                      parentComponentId: null,
                      hasChildren: false,
                      link: { ...link, _displayTargetType: targetType },
                    })
                  }
                } else {
                  items.push({
                    id: `no-links-${req.id}`,
                    type: 'no_linked_elements',
                    name: 'No linked elements',
                    depth: 2,
                    parentComponentId: null,
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

export default function RequirementsPBSTree({
  projectId,
  requirements,
  selectedComponentId,
  onComponentSelect,
  links = [],
  onLinkedElementClick,
  onRequirementClick,
}: RequirementsPBSTreeProps) {
  const queryClient = useQueryClient()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['unassigned']))
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set())

  // Fetch links per requirement using SAME API as Requirement Detail Drawer (sourceId + targetId)
  // This ensures we get the exact same links the drawer shows
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
  // Build map: reqId -> links[] (outgoing + incoming, deduped, excluding allocated_to->pbs_component)
  const linksByReqId = useMemo(() => {
    const exclude = (l: LinkLike) =>
      l.linkType === 'allocated_to' && (l.targetType === 'pbs_component' || l.sourceType === 'pbs_component')
    const keyOf = (l: LinkLike) => l.id ?? `${l.sourceType}-${l.sourceId}-${l.targetType}-${l.targetId}`
    const map = new Map<string, LinkLike[]>()
    const reqIds = requirements.map((r) => r.id)
    reqIds.forEach((reqId, i) => {
      const outIdx = i * 2
      const inIdx = i * 2 + 1
      const outgoing = ((linkQueries[outIdx]?.data as LinkLike[] | undefined) ?? []).filter((l) => !exclude(l))
      const incoming = ((linkQueries[inIdx]?.data as LinkLike[] | undefined) ?? []).filter((l) => !exclude(l))
      const seen = new Set<string>()
      const combined: LinkLike[] = []
      for (const l of [...outgoing, ...incoming]) {
        const k = keyOf(l)
        if (seen.has(k)) continue
        seen.add(k)
        combined.push(l)
      }
      map.set(reqId, combined)
    })
    return map
  }, [requirements, linkQueries])
  const [searchQuery, setSearchQuery] = useState('')
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [pbsSynced, setPbsSynced] = useState(false)

  const toggleReq = useCallback((reqId: string) => {
    setExpandedReqs((prev) => {
      const next = new Set(prev)
      if (next.has(reqId)) next.delete(reqId)
      else next.add(reqId)
      return next
    })
  }, [])

    // Sync PBS local storage to backend so requirement/function componentIds stay valid
    useEffect(() => {
        if (!projectId || pbsSynced) return

        const syncPBS = async () => {
            try {
                const pbsData = await loadPBSAsync(projectId)
                if (pbsData.nodes.length > 0) {
                    await componentService.syncPBSToComponents(projectId, pbsData.nodes)
                }
            } catch (err) {
                console.warn('Failed to sync PBS data:', err)
            } finally {
                setPbsSynced(true)
            }
        }

        syncPBS()
    }, [projectId, pbsSynced])

    // Use PBS menu (local storage) as source so PBS Components panel matches PBS page exactly
    const { data: componentTree = [] } = useQuery({
        queryKey: ['pbs-nodes', projectId],
        queryFn: async () => {
            const pbsData = await loadPBSAsync(projectId)
            const nodes = pbsData.nodes

            if (nodes.length > 0) {
                const nodeMap = new Map<string, any>()
                const rootNodes: any[] = []
                nodes.forEach(node => {
                    nodeMap.set(node.id, {
                        id: node.id,
                        projectId: projectId!,
                        parentId: node.parentId,
                        name: node.name,
                        description: node.description,
                        sortOrder: node.orderIndex ?? 0,
                        createdAt: node.createdAt,
                        updatedAt: node.updatedAt,
                        children: []
                    })
                })
                nodes.forEach(node => {
                    const component = nodeMap.get(node.id)
                    if (node.parentId && nodeMap.has(node.parentId)) {
                        nodeMap.get(node.parentId).children.push(component)
                    } else {
                        rootNodes.push(component)
                    }
                })
                const sortNodes = (n: any[]) => {
                    n.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    n.forEach(child => {
                        if (child.children?.length) sortNodes(child.children)
                    })
                }
                sortNodes(rootNodes)
                return rootNodes
            }

            // PBS empty: fall back to backend so requirements with componentIds still display
            const response = await componentService.getComponentTree(projectId!)
            return response.success && response.data ? response.data : []
        },
        enabled: !!projectId,
    })

    // Auto-expand all nodes when component tree loads or project changes (so requirements are visible)
    useEffect(() => {
        if (componentTree.length > 0) {
            setExpandedNodes(prev => {
                const next = new Set(prev)
                const expandAll = (nodes: any[]) => {
                    for (const node of nodes) {
                        next.add(node.id)
                        if (node.children && node.children.length > 0) expandAll(node.children)
                    }
                }
                expandAll(componentTree)
                return next
            })
        }
    }, [componentTree.length, projectId])

    // Mutation for drag-and-drop component reassignment
    const assignComponentMutation = useMutation({
        mutationFn: ({ requirementId, componentId }: { requirementId: string; componentId: string | null }) =>
            requirementService.updateRequirementComponent(projectId, requirementId, componentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
            queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
            queryClient.invalidateQueries({ queryKey: ['links', projectId] })
        },
        onError: (error: any) => {
            console.error('Failed to assign component:', error)
        },
    })

    const toggleNode = useCallback((nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev)
            if (next.has(nodeId)) {
                next.delete(nodeId)
            } else {
                next.add(nodeId)
            }
            return next
        })
    }, [])

    const handleComponentClick = useCallback((componentId: string | null) => {
        onComponentSelect(selectedComponentId === componentId ? null : componentId)
    }, [onComponentSelect, selectedComponentId])

    // Drag and drop handlers
    const handleDragStart = useCallback((e: React.DragEvent, requirementId: string) => {
        e.dataTransfer.setData('application/requirement-id', requirementId)
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverId(targetId)
    }, [])

    const handleDragLeave = useCallback(() => {
        setDragOverId(null)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent, targetComponentId: string | null) => {
        e.preventDefault()
        setDragOverId(null)
        const requirementId = e.dataTransfer.getData('application/requirement-id')
        if (!requirementId) return

        assignComponentMutation.mutate({
            requirementId,
            componentId: targetComponentId,
        })
    }, [assignComponentMutation])

  const flatItems = useMemo(
    () => buildFlatTree(componentTree, requirements, expandedNodes, expandedReqs, searchQuery, (req) => linksByReqId.get(req.id) ?? []),
    [componentTree, requirements, expandedNodes, expandedReqs, searchQuery, linksByReqId]
  )

  // Auto-expand requirements that have linked elements on first load only (so collapse stays collapsed)
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

    // Count requirements per component
    const reqCounts = useMemo(() => {
        const counts = new Map<string, number>()
        for (const req of requirements) {
            if (req.componentId) {
                counts.set(req.componentId, (counts.get(req.componentId) || 0) + 1)
            }
        }
        return counts
    }, [requirements])

    return (
        <div className="flex flex-col h-[calc(100%-1rem)] m-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                        <Package className="w-4 h-4" />
                    </div>
                    PBS Components
                </h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search components..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl
              bg-white dark:bg-gray-700/50 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
              placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                    />
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
                {flatItems.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No components found.</p>
                        <p className="mt-1 text-xs opacity-70">Create components in the PBS page first.</p>
                    </div>
                )}
                {flatItems.map(item => {
                    const isSelected = item.type === 'component' && item.componentId === selectedComponentId
                    const isDragOver = item.type === 'component' && dragOverId === item.componentId
                    const isUnassignedDragOver = item.type === 'unassigned' && dragOverId === 'unassigned'
                    const nodeId = item.type === 'component' ? item.componentId! : item.type === 'unassigned' ? 'unassigned' : null
                    const isExpanded = nodeId ? expandedNodes.has(nodeId) : false

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
                        >
                          <button
                            type="button"
                            aria-label={isReqExpanded ? 'Collapse linked elements' : 'Expand linked elements'}
                            onClick={(e) => { e.stopPropagation(); toggleReq(req.id) }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className={clsx(
                              'flex-shrink-0 relative z-20 w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer select-none',
                              'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500'
                            )}
                            title={hasLinkedElements ? `${reqLinks.length} linked - click to ${isReqExpanded ? 'collapse' : 'expand'}` : 'Expand for linked elements'}
                          >
                            {isReqExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <div
                            role={onRequirementClick ? 'button' : undefined}
                            tabIndex={onRequirementClick ? 0 : undefined}
                            onClick={() => onRequirementClick?.(req)}
                            onKeyDown={(e) => { if (onRequirementClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRequirementClick(req) } }}
                            className={clsx(
                              'flex flex-1 min-w-0 items-center gap-2 px-2 py-1.5 rounded-lg',
                              onRequirementClick ? 'cursor-pointer' : 'cursor-grab'
                            )}
                            draggable
                            onDragStart={(e) => handleDragStart(e, req.id)}
                            title={onRequirementClick ? 'Click to preview' : undefined}
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px] flex-shrink-0">
                            {item.requirementId || '—'}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors" title={item.name}>
                            {item.name}
                          </span>
                          {hasLinkedElements && !isReqExpanded && (
                            <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">+{reqLinks.length}</span>
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
                      const displayType = (link as { _displayTargetType?: string })._displayTargetType ?? link.targetType
                      const isOutgoing = link.sourceType === 'requirement' && link.sourceId
                      const entityType = isOutgoing ? link.targetType : link.sourceType
                      const entityId = isOutgoing ? link.targetId : link.sourceId
                      const Icon = displayType === 'function' ? Settings
                        : displayType === 'issue' ? AlertCircle
                        : displayType === 'change_request' ? GitPullRequest
                        : displayType === 'requirement' ? FileText
                        : displayType === 'use_case' ? Layers
                        : displayType === 'test_plan' || displayType === 'test_case' ? ClipboardList
                        : Link2
                      const handleClick = () => {
                        onLinkedElementClick?.({
                          targetType: entityType,
                          targetId: entityId,
                          sourceType: link.sourceType,
                          sourceId: link.sourceId,
                          isOutgoing: !!isOutgoing,
                          link,
                        })
                      }
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={handleClick}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-1 mx-2 text-xs rounded-md border-l-2 ml-4 transition-colors',
                            onLinkedElementClick
                              ? 'cursor-pointer bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-blue-50/80 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800'
                              : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                          )}
                          style={{ paddingLeft: `${item.depth * 16 + 8}px` }}
                          title={onLinkedElementClick ? 'Click to preview' : undefined}
                        >
                          <Icon className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-[10px] flex-shrink-0 capitalize">{String(displayType).replace(/_/g, ' ')}</span>
                          <span className="text-gray-600 dark:text-gray-300 truncate">{item.name}</span>
                        </div>
                      )
                    }

                    if (item.type === 'unassigned') {
                        // Unassigned header
                        return (
                            <div
                                key={item.id}
                                className={`flex items-center gap-2 px-3 py-2 mx-2 mt-2 text-sm rounded-lg cursor-pointer select-none border transition-all
                  ${isUnassignedDragOver
                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                onClick={() => {
                                    toggleNode('unassigned')
                                    handleComponentClick(null)
                                }}
                                onDragOver={(e) => handleDragOver(e, 'unassigned')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, null)}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />
                                )}
                                <Inbox className="w-4 h-4 opacity-70 flex-shrink-0" />
                                <span className="font-medium" title={item.name}>{item.name}</span>
                            </div>
                        )
                    }

                    // Component row
                    const count = reqCounts.get(item.componentId!) || 0
                    return (
                        <div
                            key={item.id}
                            className={`flex items-center gap-2 px-3 py-2 mx-2 text-sm rounded-lg cursor-pointer select-none border transition-all
                ${isSelected
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium shadow-sm'
                                    : 'border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-100'}
                ${isDragOver ? 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20 z-10' : ''}`}
                            style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
                            onClick={() => {
                                toggleNode(item.componentId!)
                                handleComponentClick(item.componentId!)
                            }}
                            onDragOver={(e) => handleDragOver(e, item.componentId!)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, item.componentId!)}
                        >
                            {item.hasChildren ? (
                                <span className={`flex transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                    <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
                                </span>
                            ) : (
                                <span className="w-4 flex-shrink-0" />
                            )}
                            <Package className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-amber-500/80 dark:text-amber-400/80'}`} />
                            <span className="truncate flex-1" title={item.name}>
                                {item.name}
                            </span>
                            {count > 0 && (
                                <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full transition-colors
                                    ${isSelected
                                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                    {count}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Footer info */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50 text-xs text-center text-gray-400 dark:text-gray-500">
                Drag requirements to assign components
            </div>
        </div>
    )
}
