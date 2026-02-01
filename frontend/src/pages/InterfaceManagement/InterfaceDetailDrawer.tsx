import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, ChevronDown, ChevronRight, FileText, Settings, FolderTree, Boxes, CheckCircle2, AlertCircle, GitBranch, Layers, FileCheck, Edit2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { Interface, InterfaceType, InterfaceStatus, TechnicalCharacteristics } from './mockInterfaces'
import { ARTIFACT_ROUTES, MOCK_ARTIFACT_COUNTS, INTERFACE_STATUSES, getStatusColor } from './constants'
import PlaceholderModal from './PlaceholderModal'
import { format } from 'date-fns'

const DEFAULT_TIMELINE = [
  { label: 'Created', date: new Date().toISOString(), user: 'System' },
]

interface InterfaceDetailDrawerProps {
  isOpen: boolean
  interfaceItem: Interface | null
  onClose: () => void
  onEdit?: (item: Interface) => void
  onDelete?: (item: Interface) => void
  onStatusChange?: (item: Interface, newStatus: Interface['status']) => void
}

const ARTIFACT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Requirements: FileText,
  Functions: Settings,
  'PBS Elements': FolderTree,
  'MBSE Models': Boxes,
  Verification: CheckCircle2,
  Issues: AlertCircle,
  'Change Requests': GitBranch,
  'Configuration Management': Layers,
  Reports: FileCheck,
  'Configuration baseline': Layers,
}

function getInitialTechChars(item: Interface | null): Partial<TechnicalCharacteristics> {
  if (!item?.technicalCharacteristics) return {}
  return { ...item.technicalCharacteristics }
}

export default function InterfaceDetailDrawer({ isOpen, interfaceItem, onClose, onEdit, onDelete, onStatusChange }: InterfaceDetailDrawerProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [constraintsText, setConstraintsText] = useState('')
  const [techChars, setTechChars] = useState<Partial<TechnicalCharacteristics>>({})
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'linked']))
  const [isComingSoonOpen, setIsComingSoonOpen] = useState(false)

  useEffect(() => {
    if (interfaceItem) {
      setDescription(interfaceItem.description ?? '')
      setConstraintsText((interfaceItem.constraints ?? []).join(', '))
      setTechChars(getInitialTechChars(interfaceItem))
    }
  }, [interfaceItem])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateTechChar = (key: keyof TechnicalCharacteristics, value: string) => {
    setTechChars((prev) => ({ ...prev, [key]: value }))
  }

  const handleOpenArtifact = (artifactKey: string) => {
    const route = ARTIFACT_ROUTES[artifactKey]
    if (route && projectId && interfaceItem) {
      navigate(`/projects/${projectId}/${route}?from=interfaces&interfaceId=${interfaceItem.id}`)
    } else if (route && projectId) {
      navigate(`/projects/${projectId}/${route}?from=interfaces`)
    } else {
      setIsComingSoonOpen(true)
    }
  }

  const renderTechnicalFields = (type: InterfaceType) => {
    if (type === 'Data') {
      return (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Protocol</label>
            <input
              type="text"
              value={techChars.protocol ?? ''}
              onChange={(e) => updateTechChar('protocol', e.target.value)}
              placeholder="e.g. CAN 2.0B"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rate</label>
            <input
              type="text"
              value={techChars.rate ?? ''}
              onChange={(e) => updateTechChar('rate', e.target.value)}
              placeholder="e.g. 1 Mbps"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Latency</label>
            <input
              type="text"
              value={techChars.latency ?? ''}
              onChange={(e) => updateTechChar('latency', e.target.value)}
              placeholder="e.g. &lt; 5 ms"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )
    }
    if (type === 'Electrical') {
      return (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Voltage</label>
            <input
              type="text"
              value={techChars.voltage ?? ''}
              onChange={(e) => updateTechChar('voltage', e.target.value)}
              placeholder="e.g. 28V DC"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Current</label>
            <input
              type="text"
              value={techChars.current ?? ''}
              onChange={(e) => updateTechChar('current', e.target.value)}
              placeholder="e.g. 2A max"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )
    }
    if (type === 'Physical') {
      return (
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dimensions</label>
          <input
            type="text"
            value={techChars.dimensions ?? ''}
            onChange={(e) => updateTechChar('dimensions', e.target.value)}
            placeholder="e.g. 600mm x 400mm"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      )
    }
    if (type === 'Software') {
      return (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API Type</label>
            <input
              type="text"
              value={techChars.protocol ?? ''}
              onChange={(e) => updateTechChar('protocol', e.target.value)}
              placeholder="e.g. REST, gRPC"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Data Rate</label>
            <input
              type="text"
              value={techChars.rate ?? ''}
              onChange={(e) => updateTechChar('rate', e.target.value)}
              placeholder="e.g. 100 Hz"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )
    }
    if (type === 'HMI') {
      return (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Display Standard</label>
            <input
              type="text"
              value={techChars.protocol ?? ''}
              onChange={(e) => updateTechChar('protocol', e.target.value)}
              placeholder="e.g. ARINC 661"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Refresh Rate</label>
            <input
              type="text"
              value={techChars.rate ?? ''}
              onChange={(e) => updateTechChar('rate', e.target.value)}
              placeholder="e.g. 60 fps"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      )
    }
    return null
  }

  if (!interfaceItem) return null

  const timeline = interfaceItem.timeline && interfaceItem.timeline.length > 0
    ? interfaceItem.timeline
    : DEFAULT_TIMELINE

  return (
    <>
      <div
        className={clsx(
          'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        role="region"
        aria-label="Interface details"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{interfaceItem.id}</span>
                {onStatusChange ? (
                  <select
                    value={interfaceItem.status}
                    onChange={(e) => onStatusChange(interfaceItem, e.target.value as InterfaceStatus)}
                    onClick={(e) => e.stopPropagation()}
                    className={clsx(
                      'px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 bg-transparent',
                      getStatusColor(interfaceItem.status)
                    )}
                  >
                    {INTERFACE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(interfaceItem.status))}>
                    {interfaceItem.status}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{interfaceItem.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  onClick={() => onEdit(interfaceItem)}
                  className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Edit interface"
                >
                  <Edit2 size={20} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(interfaceItem)}
                  className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Delete interface"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {[
              { id: 'overview', title: 'Overview', content: true },
              { id: 'technical', title: 'Technical Characteristics', content: true },
              { id: 'custom', title: 'Custom Sections', content: !!(interfaceItem.customFields && Object.keys(interfaceItem.customFields).length > 0) },
              { id: 'constraints', title: 'Constraints', content: true },
              { id: 'linked', title: 'Linked Artifacts', content: true },
              { id: 'timeline', title: 'Timeline', content: true },
            ].filter((s) => s.id !== 'custom' || s.content).map(({ id, title }) => (
              <div key={id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{title}</span>
                  {expandedSections.has(id) ? (
                    <ChevronDown size={18} className="text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                {expandedSections.has(id) && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    {id === 'overview' && (
                      <>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Type</span>
                            <p className="font-medium text-gray-900 dark:text-white">{interfaceItem.type}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Owner</span>
                            <p className="font-medium text-gray-900 dark:text-white">{interfaceItem.owner}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Source Element</span>
                            <p className="font-medium text-gray-900 dark:text-white">{interfaceItem.sourceElement}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Target Element</span>
                            <p className="font-medium text-gray-900 dark:text-white">{interfaceItem.targetElement}</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                          </label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            placeholder="Enter description..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                      </>
                    )}
                    {id === 'technical' && renderTechnicalFields(interfaceItem.type)}
                    {id === 'custom' && interfaceItem.customFields && Object.keys(interfaceItem.customFields).length > 0 && (
                      <div className="space-y-2">
                        {Object.entries(interfaceItem.customFields).map(([key, value]) => (
                          <div key={key} className="flex gap-3 py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 min-w-[120px]">
                              {key}
                            </span>
                            <span className="text-sm text-gray-900 dark:text-white">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {id === 'constraints' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Constraints (tags / free text)
                        </label>
                        <input
                          type="text"
                          value={constraintsText}
                          onChange={(e) => setConstraintsText(e.target.value)}
                          placeholder="e.g. Max 1 Mbps, Redundant path"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    )}
                    {id === 'linked' && (
                      <div className="space-y-2">
                        {Object.keys(ARTIFACT_ROUTES).map((key) => {
                          const Icon = ARTIFACT_ICONS[key]
                          const count = MOCK_ARTIFACT_COUNTS[key] ?? 0
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                {Icon && <Icon size={16} className="text-gray-500 dark:text-gray-400" />}
                                <span className="text-sm text-gray-900 dark:text-white">{key}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">({count})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenArtifact(key)}
                                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                              >
                                Open
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {id === 'timeline' && (
                      <div className="space-y-3">
                        {timeline.map((entry, idx) => (
                          <div key={idx} className="flex gap-3">
                            <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.label}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(entry.date), 'PPp')} · {entry.user}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PlaceholderModal
        isOpen={isComingSoonOpen}
        onClose={() => setIsComingSoonOpen(false)}
        title="Coming soon"
        message="This feature will be implemented in a future release."
      />
    </>
  )
}
