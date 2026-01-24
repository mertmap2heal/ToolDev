import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Edit2, CheckCircle, XCircle, FileText, Download } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import type { Component, Interface } from './ComponentFormSection'
import CustomDropdown from './CustomDropdown'
import ReactFlow, {
  Node,
  Edge,
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface TestSetupDetailDrawerProps {
  setup: any
  isOpen: boolean
  onClose: () => void
  projectId: string
}

// Reuse node types from editor
const TextNode = ({ data }: { data: any }) => {
  return (
    <div className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-xs">
      {data.text || 'Text'}
    </div>
  )
}

const ComponentNode = ({ data }: { data: any }) => {
  return (
    <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-400 rounded-lg min-w-[120px]">
      <div className="font-semibold text-blue-900 dark:text-blue-100 text-sm">{data.label || 'Component'}</div>
      {data.componentType && (
        <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">{data.componentType}</div>
      )}
    </div>
  )
}

const InterfaceNode = ({ data }: { data: any }) => {
  return (
    <div className="px-3 py-2 bg-green-100 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-400 rounded-lg min-w-[120px]">
      <div className="font-semibold text-green-900 dark:text-green-100 text-sm">{data.label || 'Interface'}</div>
      {data.interfaceType && (
        <div className="text-xs text-green-700 dark:text-green-300 mt-1">{data.interfaceType}</div>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  text: TextNode,
  component: ComponentNode,
  interface: InterfaceNode,
}

export default function TestSetupDetailDrawer({ setup, isOpen, onClose, projectId }: TestSetupDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'components' | 'interfaces' | 'diagram' | 'photos'>(
    'overview'
  )
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    environmentType: '',
    version: '',
  })
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch full setup details
  const { data: setupDetails } = useQuery({
    queryKey: ['test-setup', projectId, setup?.id],
    queryFn: async () => {
      if (!setup?.id) return null
      const response = await verificationService.getSetup(projectId, setup.id)
      return response.success ? response.data : null
    },
    enabled: isOpen && !!setup?.id,
  })

  const [nodes, setNodes] = useNodesState(setupDetails?.diagramData?.nodes || [])
  const [edges, setEdges] = useEdgesState(setupDetails?.diagramData?.edges || [])

  useEffect(() => {
    if (setupDetails?.diagramData) {
      setNodes(setupDetails.diagramData.nodes || [])
      setEdges(setupDetails.diagramData.edges || [])
    }
  }, [setupDetails, setNodes, setEdges])

  const updateSetupMutation = useMutation({
    mutationFn: (data: any) => verificationService.updateSetup(projectId, setup.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-setup', projectId, setup.id] })
      queryClient.invalidateQueries({ queryKey: ['test-setups', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setIsEditing(false)
    },
  })

  const approveSetupMutation = useMutation({
    mutationFn: () => verificationService.approveSetup(projectId, setup.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-setup', projectId, setup.id] })
      queryClient.invalidateQueries({ queryKey: ['test-setups', projectId] })
    },
  })

  const deprecateSetupMutation = useMutation({
    mutationFn: () => verificationService.deprecateSetup(projectId, setup.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-setup', projectId, setup.id] })
      queryClient.invalidateQueries({ queryKey: ['test-setups', projectId] })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'DEPRECATED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const statusOptions = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'DEPRECATED', label: 'Deprecated' },
  ]

  const currentSetup = setupDetails || setup
  const components = (currentSetup?.components as Component[]) || []
  const interfaces = (currentSetup?.interfaces as Interface[]) || []
  const photos = (currentSetup?.photos as any[]) || []

  useEffect(() => {
    if (currentSetup) {
      setEditData({
        name: currentSetup.name || '',
        description: currentSetup.description || '',
        environmentType: currentSetup.environmentType || '',
        version: currentSetup.version || '1.0',
      })
    }
  }, [currentSetup])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }

    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen])

  const handleSave = () => {
    updateSetupMutation.mutate(editData)
  }

  if (!isOpen || !setup) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-4xl h-full overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(currentSetup?.status || 'DRAFT')}`}>
                {currentSetup?.status || 'DRAFT'}
              </span>
              {currentSetup?.environmentType && (
                <span className="text-sm text-gray-500 dark:text-gray-400">{currentSetup.environmentType}</span>
              )}
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{currentSetup?.name}</h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                {currentSetup?.status === 'DRAFT' && (
                  <button
                    onClick={() => approveSetupMutation.mutate()}
                    disabled={approveSetupMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <CheckCircle size={14} />
                    Approve
                  </button>
                )}
                {currentSetup?.status === 'APPROVED' && (
                  <button
                    onClick={() => deprecateSetupMutation.mutate()}
                    disabled={deprecateSetupMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <XCircle size={14} />
                    Deprecate
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditData({
                      name: currentSetup?.name || '',
                      description: currentSetup?.description || '',
                      environmentType: currentSetup?.environmentType || '',
                      version: currentSetup?.version || '1.0',
                    })
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateSetupMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex gap-4">
            {(['overview', 'components', 'interfaces', 'diagram', 'photos'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status */}
              <div className="relative" ref={statusDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <div className={`px-4 py-2 rounded-lg ${getStatusColor(currentSetup?.status || 'DRAFT')}`}>
                  {statusOptions.find((opt) => opt.value === currentSetup?.status)?.label || currentSetup?.status}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                {isEditing ? (
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentSetup?.description || 'No description'}</p>
                )}
              </div>

              {/* Environment Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Environment Type
                </label>
                {isEditing ? (
                  <CustomDropdown
                    value={editData.environmentType}
                    onChange={(value) => setEditData({ ...editData, environmentType: value })}
                    optionType="ENVIRONMENT_TYPE"
                    projectId={projectId}
                    placeholder="Select environment type"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentSetup?.environmentType || 'Not specified'}</p>
                )}
              </div>

              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Version</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.version}
                    onChange={(e) => setEditData({ ...editData, version: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">v{currentSetup?.version || '1.0'}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'components' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Components ({components.length})
              </h3>
              {components.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No components defined</p>
              ) : (
                <div className="space-y-3">
                  {components.map((component: any, idx: number) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{component.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Type: {component.type}</div>
                      {component.manufacturer && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Manufacturer: {component.manufacturer}
                        </div>
                      )}
                      {component.model && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">Model: {component.model}</div>
                      )}
                      {component.specifications && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {component.specifications}
                        </div>
                      )}
                      {component.manual && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-gray-600 dark:text-gray-400" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Manual:
                            </span>
                            <a
                              href={component.manual.fileUrl}
                              download={component.manual.fileName}
                              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <Download size={14} />
                              {component.manual.fileName}
                            </a>
                            {component.manual.fileSize && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({(component.manual.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'interfaces' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Interfaces ({interfaces.length})
              </h3>
              {interfaces.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No interfaces defined</p>
              ) : (
                <div className="space-y-3">
                  {interfaces.map((interface_: any, idx: number) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">{interface_.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Type: {interface_.type}</div>
                      {interface_.protocol && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Protocol: {interface_.protocol}
                        </div>
                      )}
                      {interface_.description && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">{interface_.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagram' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Diagram</h3>
              {nodes.length === 0 && edges.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No diagram data</p>
              ) : (
                <div className="h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg">
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      className="bg-gray-50 dark:bg-gray-900"
                    >
                      <Controls />
                      <Background variant="dots" gap={12} size={1} />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Photos ({photos.length})</h3>
              {photos.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No photos uploaded</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo: any, idx: number) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                      <img
                        src={photo.fileUrl || photo.url}
                        alt={photo.fileName || photo.name}
                        className="w-full h-48 object-cover"
                      />
                      <div className="p-2 bg-gray-50 dark:bg-gray-700/50">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {photo.fileName || photo.name}
                        </div>
                        {photo.fileSize && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {(photo.fileSize / 1024).toFixed(1)} KB
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
