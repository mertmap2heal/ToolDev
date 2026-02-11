import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Download, Filter, Target, Zap, Settings, AlertCircle } from 'lucide-react'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { traceabilityService } from '../../services/traceability.service'
import type { Requirement, SystemFunction, Issue } from 'shared/types/engineering.types'
import type { TraceLink } from 'shared/types/traceability.types'
import clsx from 'clsx'

interface ImpactAnalysisProps {
  projectId: string
  requirement: Requirement
  onClose: () => void
}

interface ImpactNode {
  id: string
  type: 'requirement' | 'function' | 'issue'
  name: string
  displayId: string
  level: number
  isSuspect?: boolean
  children: ImpactNode[]
}

/**
 * ImpactAnalysis component visualizes the downstream dependencies of a
 * requirement, showing what artifacts will be affected if the requirement
 * changes. Displays a hierarchical tree of impacted items.
 */
export default function ImpactAnalysis({ projectId, requirement, onClose }: ImpactAnalysisProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)

  // Fetch all requirements for child relationships
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch functions
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch issues
  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch trace links
  const { data: traceLinks = [] } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build impact tree
  const impactTree = useMemo((): ImpactNode => {
    const visited = new Set<string>()

    const buildNode = (
      id: string,
      type: 'requirement' | 'function' | 'issue',
      level: number
    ): ImpactNode | null => {
      const nodeKey = `${type}-${id}`
      if (visited.has(nodeKey)) return null
      visited.add(nodeKey)

      let name = ''
      let displayId = ''
      let isSuspect = false

      if (type === 'requirement') {
        const req = requirements.find((r) => r.id === id)
        if (!req) return null
        name = req.title
        displayId = req.requirementId || id.substring(0, 8)
      } else if (type === 'function') {
        const func = functions.find((f) => f.id === id)
        if (!func) return null
        name = func.name
        displayId = func.functionId || id.substring(0, 8)
        // Check if link to this function is suspect
        const link = traceLinks.find(
          (l) => l.targetId === id && l.sourceId === requirement.id
        )
        isSuspect = link?.isSuspect || false
      } else if (type === 'issue') {
        const issue = issues.find((i) => i.id === id)
        if (!issue) return null
        name = issue.title
        displayId = id.substring(0, 8)
      }

      const children: ImpactNode[] = []

      // Find child requirements
      if (type === 'requirement') {
        const childReqs = requirements.filter((r) => r.parentId === id)
        childReqs.forEach((child) => {
          const childNode = buildNode(child.id, 'requirement', level + 1)
          if (childNode) children.push(childNode)
        })
      }

      // Find linked functions (from trace links or sourceReqId)
      if (type === 'requirement') {
        // From trace links
        const linkedFuncIds = traceLinks
          .filter((l) => l.sourceType === 'requirement' && l.sourceId === id && l.targetType === 'function')
          .map((l) => l.targetId)

        // From direct sourceReqId
        const directLinkedFuncs = functions.filter((f) => f.sourceReqId === id)
        directLinkedFuncs.forEach((func) => {
          if (!linkedFuncIds.includes(func.id)) {
            linkedFuncIds.push(func.id)
          }
        })

        linkedFuncIds.forEach((funcId) => {
          const funcNode = buildNode(funcId, 'function', level + 1)
          if (funcNode) children.push(funcNode)
        })
      }

      // Find related issues
      if (type === 'function') {
        const relatedIssues = issues.filter((i) => i.relatedFunctionIds?.includes(id))
        relatedIssues.forEach((issue) => {
          const issueNode = buildNode(issue.id, 'issue', level + 1)
          if (issueNode) children.push(issueNode)
        })
      }

      return {
        id,
        type,
        name,
        displayId,
        level,
        isSuspect,
        children,
      }
    }

    // Build from the selected requirement
    const root = buildNode(requirement.id, 'requirement', 0)
    return root || {
      id: requirement.id,
      type: 'requirement',
      name: requirement.title,
      displayId: requirement.requirementId || requirement.id.substring(0, 8),
      level: 0,
      children: [],
    }
  }, [requirement, requirements, functions, issues, traceLinks])

  // Count impacts
  const impactStats = useMemo(() => {
    let childRequirements = 0
    let linkedFunctions = 0
    let relatedIssues = 0
    let suspectLinks = 0

    const countNodes = (node: ImpactNode) => {
      if (node.type === 'requirement' && node.level > 0) childRequirements++
      if (node.type === 'function') {
        linkedFunctions++
        if (node.isSuspect) suspectLinks++
      }
      if (node.type === 'issue') relatedIssues++
      node.children.forEach(countNodes)
    }

    countNodes(impactTree)

    return {
      childRequirements,
      linkedFunctions,
      relatedIssues,
      suspectLinks,
      totalImpacted: childRequirements + linkedFunctions + relatedIssues,
    }
  }, [impactTree])

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  // Expand all nodes
  const expandAll = () => {
    const allIds = new Set<string>()
    const collectIds = (node: ImpactNode) => {
      allIds.add(node.id)
      node.children.forEach(collectIds)
    }
    collectIds(impactTree)
    setExpandedNodes(allIds)
  }

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes(new Set(['root', impactTree.id]))
  }

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'requirement':
        return <Target size={14} className="text-blue-500" />
      case 'function':
        return <Settings size={14} className="text-green-500" />
      case 'issue':
        return <AlertCircle size={14} className="text-yellow-500" />
      default:
        return <Zap size={14} className="text-gray-500" />
    }
  }

  // Export impact report
  const exportReport = () => {
    const lines: string[] = [
      'Impact Analysis Report',
      `Requirement: ${requirement.requirementId || requirement.id} - ${requirement.title}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      '--- Summary ---',
      `Child Requirements: ${impactStats.childRequirements}`,
      `Linked Functions: ${impactStats.linkedFunctions}`,
      `Related Issues: ${impactStats.relatedIssues}`,
      `Suspect Links: ${impactStats.suspectLinks}`,
      `Total Impacted: ${impactStats.totalImpacted}`,
      '',
      '--- Impact Tree ---',
    ]

    const printNode = (node: ImpactNode, indent: string = '') => {
      const suspectMark = node.isSuspect ? ' [SUSPECT]' : ''
      lines.push(`${indent}[${node.type.toUpperCase()}] ${node.displayId}: ${node.name}${suspectMark}`)
      node.children.forEach((child) => printNode(child, indent + '  '))
    }

    printNode(impactTree)

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `impact_analysis_${requirement.requirementId || requirement.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Render tree node
  const renderNode = (node: ImpactNode): React.ReactNode => {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const isRoot = node.level === 0

    // Filter by suspect if enabled
    if (showSuspectOnly && !node.isSuspect && node.type !== 'requirement') {
      const hasSuspectDescendant = (n: ImpactNode): boolean => {
        if (n.isSuspect) return true
        return n.children.some(hasSuspectDescendant)
      }
      if (!hasSuspectDescendant(node)) return null
    }

    return (
      <div key={`${node.type}-${node.id}`} className="select-none">
        <div
          className={clsx(
            'flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors',
            isRoot ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50',
            node.isSuspect && 'bg-yellow-50 dark:bg-yellow-900/20'
          )}
          style={{ paddingLeft: `${node.level * 20 + 8}px` }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {hasChildren ? (
            <button className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
              {isExpanded ? (
                <ChevronDown size={14} className="text-gray-500" />
              ) : (
                <ChevronRight size={14} className="text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          {getTypeIcon(node.type)}

          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {node.displayId}
          </span>

          {node.isSuspect && (
            <AlertTriangle size={12} className="text-yellow-500" aria-label="Suspect link" />
          )}

          <span className={clsx(
            'text-sm truncate',
            isRoot ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'
          )}>
            {node.name}
          </span>

          {hasChildren && (
            <span className="text-xs text-gray-400 ml-auto">
              {node.children.length}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map(renderNode)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Zap className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Impact Analysis
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

        {/* Stats Bar */}
        <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Child Reqs:</span>{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">{impactStats.childRequirements}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Functions:</span>{' '}
            <span className="font-semibold text-green-600 dark:text-green-400">{impactStats.linkedFunctions}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Issues:</span>{' '}
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">{impactStats.relatedIssues}</span>
          </div>
          {impactStats.suspectLinks > 0 && (
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Suspect:</span>{' '}
              <span className="font-semibold text-orange-600 dark:text-orange-400">{impactStats.suspectLinks}</span>
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showSuspectOnly}
                onChange={(e) => setShowSuspectOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              Suspect Only
            </label>
            <button
              onClick={expandAll}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              Collapse
            </button>
            <button
              onClick={exportReport}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Impact Tree */}
        <div className="flex-1 overflow-y-auto p-4">
          {impactStats.totalImpacted === 0 ? (
            <div className="text-center py-8">
              <Target size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                No downstream impacts
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This requirement has no child requirements, linked functions, or related issues.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {renderNode(impactTree)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {impactStats.totalImpacted > 0 
              ? `${impactStats.totalImpacted} artifact(s) will be affected if this requirement changes.`
              : 'No downstream dependencies detected.'}
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
