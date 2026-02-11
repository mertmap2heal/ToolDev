import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, Package, FileText, Search, FolderOpen, Inbox } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { componentService } from '../../services/component.service'
import { requirementService } from '../../services/requirement.service'
import { loadPBSAsync } from '../../modules/pbs/storage'
import type { ComponentTreeNode } from 'shared/types/project.types'
import type { Requirement } from 'shared/types/engineering.types'

interface RequirementsPBSTreeProps {
    projectId: string
    requirements: Requirement[]
    selectedComponentId: string | null
    onComponentSelect: (componentId: string | null) => void
}

interface FlatTreeItem {
    id: string
    type: 'component' | 'requirement' | 'unassigned'
    name: string
    depth: number
    parentComponentId: string | null
    hasChildren: boolean
    requirementId?: string // display ID for requirements
    componentId?: string
    requirement?: Requirement
}

/**
 * Flatten the component tree + requirements into a list for rendering.
 */
function buildFlatTree(
    tree: ComponentTreeNode[],
    requirements: Requirement[],
    expandedNodes: Set<string>,
    searchQuery: string
): FlatTreeItem[] {
    const items: FlatTreeItem[] = []

    // Build a map of componentId -> requirements
    const reqsByComponent = new Map<string, Requirement[]>()
    const unassigned: Requirement[] = []
    for (const req of requirements) {
        if (req.componentId) {
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

            // Add requirements under this component
            for (const req of reqs) {
                if (searchQuery && !(req.requirementId || req.title).toLowerCase().includes(lowerQuery)) continue
                items.push({
                    id: `req-${req.id}`,
                    type: 'requirement',
                    name: req.title,
                    depth: depth + 1,
                    parentComponentId: node.id,
                    hasChildren: false,
                    requirementId: req.requirementId || undefined,
                    requirement: req,
                })
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
                items.push({
                    id: `req-${req.id}`,
                    type: 'requirement',
                    name: req.title,
                    depth: 1,
                    parentComponentId: null,
                    hasChildren: false,
                    requirementId: req.requirementId || undefined,
                    requirement: req,
                })
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
}: RequirementsPBSTreeProps) {
    const queryClient = useQueryClient()
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['unassigned']))
    const [searchQuery, setSearchQuery] = useState('')
    const [dragOverId, setDragOverId] = useState<string | null>(null)
    const [pbsSynced, setPbsSynced] = useState(false)

    // Sync localStorage PBS data to components on first load
    useEffect(() => {
        if (!projectId || pbsSynced) return

        const syncPBS = async () => {
            try {
                const pbsData = await loadPBSAsync(projectId)
                if (pbsData.nodes.length > 0) {
                    await componentService.syncPBSToComponents(projectId, pbsData.nodes)
                    queryClient.invalidateQueries({ queryKey: ['components', projectId] })
                }
            } catch (err) {
                console.warn('Failed to sync PBS data:', err)
            } finally {
                setPbsSynced(true)
            }
        }

        syncPBS()
    }, [projectId, pbsSynced, queryClient])

    // Fetch component tree
    const { data: componentTree = [] } = useQuery({
        queryKey: ['components', projectId],
        queryFn: async () => {
            const response = await componentService.getComponentTree(projectId)
            return response.success && response.data ? response.data : []
        },
        enabled: !!projectId && pbsSynced,
    })

    // Auto-expand root nodes on first load
    useEffect(() => {
        if (componentTree.length > 0) {
            setExpandedNodes(prev => {
                const next = new Set(prev)
                for (const node of componentTree) {
                    next.add(node.id)
                }
                return next
            })
        }
    }, [componentTree])

    // Mutation for drag-and-drop component reassignment
    const assignComponentMutation = useMutation({
        mutationFn: ({ requirementId, componentId }: { requirementId: string; componentId: string | null }) =>
            requirementService.updateRequirementComponent(projectId, requirementId, componentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
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
        () => buildFlatTree(componentTree, requirements, expandedNodes, searchQuery),
        [componentTree, requirements, expandedNodes, searchQuery]
    )

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
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    PBS Components
                </h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search components..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              placeholder-gray-400 dark:placeholder-gray-500"
                    />
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-2">
                {flatItems.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No components found.</p>
                        <p className="mt-1 text-xs">Create components in the PBS page first.</p>
                    </div>
                )}
                {flatItems.map(item => {
                    const isSelected = item.type === 'component' && item.componentId === selectedComponentId
                    const isDragOver = item.type === 'component' && dragOverId === item.componentId
                    const isUnassignedDragOver = item.type === 'unassigned' && dragOverId === 'unassigned'
                    const nodeId = item.type === 'component' ? item.componentId! : item.type === 'unassigned' ? 'unassigned' : null
                    const isExpanded = nodeId ? expandedNodes.has(nodeId) : false

                    if (item.type === 'requirement') {
                        // Requirement row
                        return (
                            <div
                                key={item.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-grab hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                style={{ paddingLeft: `${item.depth * 16 + 12}px` }}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.requirement!.id)}
                            >
                                <FileText className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                <span className="text-gray-400 dark:text-gray-500 font-mono text-xs flex-shrink-0">
                                    {item.requirementId || '—'}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300 truncate" title={item.name}>
                                    {item.name}
                                </span>
                            </div>
                        )
                    }

                    if (item.type === 'unassigned') {
                        // Unassigned header
                        return (
                            <div
                                key={item.id}
                                className={`flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer select-none
                  border-t border-gray-200 dark:border-gray-700 mt-2
                  ${isUnassignedDragOver ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                  transition-colors`}
                                onClick={() => {
                                    toggleNode('unassigned')
                                    handleComponentClick(null)
                                }}
                                onDragOver={(e) => handleDragOver(e, 'unassigned')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, null)}
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                )}
                                <Inbox className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-500 dark:text-gray-400 font-medium">{item.name}</span>
                            </div>
                        )
                    }

                    // Component row
                    const count = reqCounts.get(item.componentId!) || 0
                    return (
                        <div
                            key={item.id}
                            className={`flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer select-none
                ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                ${isDragOver ? 'ring-1 ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''}
                transition-colors`}
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
                                isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                )
                            ) : (
                                <span className="w-4 flex-shrink-0" />
                            )}
                            <Package className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-amber-500 dark:text-amber-400'}`} />
                            <span className="truncate flex-1" title={item.name}>
                                {item.name}
                            </span>
                            {count > 0 && (
                                <span className="flex-shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5 text-xs font-medium">
                                    {count}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Footer info */}
            <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                Drag requirements to assign components
            </div>
        </div>
    )
}
