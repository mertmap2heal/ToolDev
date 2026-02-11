import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  FileText,
  Settings,
  Users,
  Layers,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Tag,
  Link,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  AlertCircle,
} from 'lucide-react'
import { useMBSEStore } from '../../store/mbseStore'
import { traceabilityService } from '../../services/traceability.service'
import type { TraceLink } from 'shared/types/traceability.types'
import clsx from 'clsx'

interface PropertiesPanelProps {
  projectId: string
  onClose?: () => void
  className?: string
}

interface PropertyRowProps {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
}

/**
 * PropertyRow displays a single property label-value pair
 */
function PropertyRow({ label, value, icon }: PropertyRowProps) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {icon && <span className="flex-shrink-0 mt-0.5 text-gray-400">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
        <div className="text-sm text-gray-900 dark:text-white break-words">{value || '—'}</div>
      </div>
    </div>
  )
}

/**
 * StatusBadge renders a colored status indicator
 */
function StatusBadge({ status }: { status: string }) {
  const getStatusStyle = () => {
    const lowerStatus = status?.toLowerCase() || ''
    if (lowerStatus.includes('approved') || lowerStatus.includes('done') || lowerStatus.includes('verified')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    }
    if (lowerStatus.includes('review') || lowerStatus.includes('progress')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    }
    if (lowerStatus.includes('draft') || lowerStatus.includes('pending')) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
    if (lowerStatus.includes('reject') || lowerStatus.includes('fail')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }

  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', getStatusStyle())}>
      {status}
    </span>
  )
}

/**
 * PriorityBadge renders a colored priority indicator
 */
function PriorityBadge({ priority }: { priority: string }) {
  const getPriorityStyle = () => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', getPriorityStyle())}>
      {priority}
    </span>
  )
}

/**
 * CollapsibleSection wraps content in a collapsible container
 */
function CollapsibleSection({
  title,
  icon,
  children,
  defaultExpanded = true,
  badge,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultExpanded?: boolean
  badge?: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
          {badge}
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-gray-400" />
        ) : (
          <ChevronDown size={14} className="text-gray-400" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

/**
 * RelationshipItem displays a single trace link relationship
 */
function RelationshipItem({ link, direction }: { link: TraceLink; direction: 'incoming' | 'outgoing' }) {
  const targetName = direction === 'outgoing' 
    ? `${link.targetType}: ${link.targetId.substring(0, 8)}...`
    : `${link.sourceType}: ${link.sourceId.substring(0, 8)}...`

  return (
    <div className={clsx(
      'flex items-center gap-2 p-2 rounded text-sm',
      link.isSuspect 
        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
        : 'bg-gray-50 dark:bg-gray-700/50'
    )}>
      {direction === 'outgoing' ? (
        <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
      ) : (
        <ArrowLeft size={14} className="text-gray-400 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            {link.linkType}
          </span>
          {link.isSuspect && (
            <AlertTriangle size={12} className="text-amber-500" />
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {targetName}
        </div>
      </div>
    </div>
  )
}

/**
 * PropertiesPanel displays context-sensitive details about the selected model element
 * including attributes, relationships, and validation status
 */
export default function PropertiesPanel({
  projectId,
  onClose,
  className,
}: PropertiesPanelProps) {
  const { selectedElement } = useMBSEStore()

  // Fetch trace links for relationship display
  const { data: traceLinks = [] } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Filter relationships for selected element
  const { incomingLinks, outgoingLinks } = useMemo(() => {
    if (!selectedElement) return { incomingLinks: [], outgoingLinks: [] }
    
    // Extract the actual ID from the prefixed node ID (e.g., "req-abc123" -> "abc123")
    const elementId = selectedElement.id.includes('-') 
      ? selectedElement.id.split('-').slice(1).join('-')
      : selectedElement.id

    const incoming = traceLinks.filter((link) => link.targetId === elementId)
    const outgoing = traceLinks.filter((link) => link.sourceId === elementId)
    
    return { incomingLinks: incoming, outgoingLinks: outgoing }
  }, [selectedElement, traceLinks])

  // Render content based on element type
  const renderElementProperties = () => {
    if (!selectedElement || !selectedElement.data) {
      return null
    }

    const data = selectedElement.data as Record<string, unknown>

    switch (selectedElement.type) {
      case 'requirement':
        return (
          <>
            <CollapsibleSection title="Basic Information" icon={<Info size={14} className="text-blue-500" />}>
              <PropertyRow label="ID" value={data.requirementId as string} icon={<Tag size={12} />} />
              <PropertyRow label="Title" value={data.title as string} />
              <PropertyRow 
                label="Status" 
                value={data.status ? <StatusBadge status={data.status as string} /> : '—'} 
                icon={<Clock size={12} />}
              />
              <PropertyRow 
                label="Priority" 
                value={data.priority ? <PriorityBadge priority={data.priority as string} /> : '—'} 
              />
              <PropertyRow label="Type" value={data.requirementType as string} icon={<FileText size={12} />} />
              <PropertyRow label="Owner" value={data.owner as string} icon={<User size={12} />} />
            </CollapsibleSection>

            <CollapsibleSection title="Description" icon={<FileText size={14} className="text-gray-500" />} defaultExpanded={false}>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {(data.description as string) || 'No description provided'}
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Verification" icon={<CheckCircle size={14} className="text-green-500" />} defaultExpanded={false}>
              <PropertyRow 
                label="Verification Status" 
                value={data.verificationStatus ? <StatusBadge status={data.verificationStatus as string} /> : '—'} 
              />
              <PropertyRow label="Verification Method" value={data.verificationMethod as string} />
              <PropertyRow label="Acceptance Criteria" value={data.acceptanceCriteria as string} />
            </CollapsibleSection>
          </>
        )

      case 'function':
        return (
          <>
            <CollapsibleSection title="Basic Information" icon={<Info size={14} className="text-teal-500" />}>
              <PropertyRow label="ID" value={data.functionId as string} icon={<Tag size={12} />} />
              <PropertyRow label="Name" value={data.name as string} />
              <PropertyRow 
                label="Status" 
                value={data.status ? <StatusBadge status={data.status as string} /> : '—'} 
                icon={<Clock size={12} />}
              />
              <PropertyRow label="Owner" value={data.owner as string} icon={<User size={12} />} />
            </CollapsibleSection>

            <CollapsibleSection title="Description" icon={<FileText size={14} className="text-gray-500" />} defaultExpanded={false}>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {(data.description as string) || 'No description provided'}
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Verification" icon={<CheckCircle size={14} className="text-green-500" />} defaultExpanded={false}>
              <PropertyRow label="Verification Method" value={data.verificationMethod as string} />
            </CollapsibleSection>
          </>
        )

      case 'useCase':
        return (
          <>
            <CollapsibleSection title="Basic Information" icon={<Info size={14} className="text-pink-500" />}>
              <PropertyRow label="ID" value={data.useCaseId as string} icon={<Tag size={12} />} />
              <PropertyRow label="Name" value={data.name as string} />
              <PropertyRow 
                label="Status" 
                value={data.status ? <StatusBadge status={data.status as string} /> : '—'} 
                icon={<Clock size={12} />}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Description" icon={<FileText size={14} className="text-gray-500" />} defaultExpanded={false}>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {(data.description as string) || 'No description provided'}
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Flow" icon={<Layers size={14} className="text-purple-500" />} defaultExpanded={false}>
              <PropertyRow label="Preconditions" value={data.preconditions as string} />
              <PropertyRow label="Postconditions" value={data.postconditions as string} />
              <PropertyRow label="Main Flow" value={data.mainFlow as string} />
              <PropertyRow label="Alternative Flows" value={data.alternativeFlows as string} />
            </CollapsibleSection>
          </>
        )

      case 'diagram':
        return (
          <CollapsibleSection title="Diagram Information" icon={<Info size={14} className="text-indigo-500" />}>
            <PropertyRow label="Name" value={selectedElement.name} />
            <PropertyRow label="Type" value={selectedElement.id.replace('diagram-', '').toUpperCase()} />
            <PropertyRow label="Description" value={data.description as string} />
          </CollapsibleSection>
        )

      default:
        return (
          <div className="p-4 text-sm text-gray-500">
            Element properties not available for this type
          </div>
        )
    }
  }

  const getElementIcon = () => {
    switch (selectedElement?.type) {
      case 'requirement':
        return <FileText size={16} className="text-blue-500" />
      case 'function':
        return <Settings size={16} className="text-teal-500" />
      case 'useCase':
        return <Users size={16} className="text-pink-500" />
      case 'diagram':
        return <Layers size={16} className="text-indigo-500" />
      default:
        return <FileText size={16} className="text-gray-500" />
    }
  }

  const totalRelationships = incomingLinks.length + outgoingLinks.length
  const suspectCount = [...incomingLinks, ...outgoingLinks].filter((l) => l.isSuspect).length

  return (
    <div className={clsx('flex flex-col h-full bg-white dark:bg-gray-800', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Info size={16} className="text-gray-500" />
          Properties
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedElement ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
            <Layers size={32} className="mb-3 opacity-50" />
            <p className="text-sm text-center">Select an element in the Model Browser or diagram to view its properties</p>
          </div>
        ) : (
          <>
            {/* Element header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {getElementIcon()}
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {selectedElement.name}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                {selectedElement.type}
              </div>
            </div>

            {/* Element properties */}
            {renderElementProperties()}

            {/* Relationships section */}
            {selectedElement.type !== 'diagram' && selectedElement.type !== 'category' && (
              <CollapsibleSection 
                title="Relationships" 
                icon={<Link size={14} className="text-purple-500" />}
                badge={
                  totalRelationships > 0 ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                        {totalRelationships}
                      </span>
                      {suspectCount > 0 && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <AlertTriangle size={10} />
                          {suspectCount}
                        </span>
                      )}
                    </span>
                  ) : null
                }
              >
                {totalRelationships === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No relationships found
                  </p>
                ) : (
                  <div className="space-y-2">
                    {outgoingLinks.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                          <ArrowRight size={12} />
                          Outgoing ({outgoingLinks.length})
                        </div>
                        <div className="space-y-1.5">
                          {outgoingLinks.slice(0, 5).map((link) => (
                            <RelationshipItem key={link.id} link={link} direction="outgoing" />
                          ))}
                          {outgoingLinks.length > 5 && (
                            <p className="text-xs text-gray-400 text-center">
                              +{outgoingLinks.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {incomingLinks.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
                          <ArrowLeft size={12} />
                          Incoming ({incomingLinks.length})
                        </div>
                        <div className="space-y-1.5">
                          {incomingLinks.slice(0, 5).map((link) => (
                            <RelationshipItem key={link.id} link={link} direction="incoming" />
                          ))}
                          {incomingLinks.length > 5 && (
                            <p className="text-xs text-gray-400 text-center">
                              +{incomingLinks.length - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CollapsibleSection>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {selectedElement && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          ID: {selectedElement.id}
        </div>
      )}
    </div>
  )
}
