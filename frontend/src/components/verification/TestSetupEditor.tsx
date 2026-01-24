import { useState, useCallback, useRef } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  MarkerType,
  NodeTypes,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Upload, Type, ArrowRight, Square, Circle, Trash2, Save, ArrowLeft } from 'lucide-react'
import type { Component, Interface } from './ComponentFormSection'

interface TestSetupEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { diagramData: any; photos: any[] }) => void
  formData: {
    name: string
    components: Component[]
    interfaces: Interface[]
  }
  initialDiagramData?: any
  initialPhotos?: any[]
}

// Custom node types
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

let nextNodeId = 1

export default function TestSetupEditor({
  isOpen,
  onClose,
  onSave,
  formData,
  initialDiagramData,
  initialPhotos = [],
}: TestSetupEditorProps) {
  const [photos, setPhotos] = useState<any[]>(initialPhotos)
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const [tool, setTool] = useState<'select' | 'text' | 'arrow' | 'component' | 'interface'>('select')
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialDiagramData?.nodes || []
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialDiagramData?.edges || []
  )
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onConnect = useCallback(
    (params: Connection) => {
      if (tool === 'arrow') {
        setEdges((eds) =>
          addEdge(
            {
              ...params,
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed },
              animated: false,
            },
            eds
          )
        )
      }
    },
    [tool, setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  function EditorInner() {
    const { screenToFlowPosition } = useReactFlow()

    const onPaneClick = useCallback(
      (event: React.MouseEvent) => {
        setSelectedNode(null)
        if (tool === 'text') {
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          })
          const newNode = {
            id: `text-${nextNodeId++}`,
            type: 'text',
            position,
            data: { text: 'New Text' },
          }
          setNodes((nds) => [...nds, newNode])
          setTool('select')
        }
      },
      [tool, setNodes, screenToFlowPosition]
    )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const photoData = {
          id: Date.now().toString() + Math.random(),
          fileName: file.name,
          fileUrl: reader.result as string,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        }
        setPhotos((prev) => [...prev, photoData])
        if (selectedPhoto === null) {
          setSelectedPhoto(0)
        }
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const photoData = {
          id: Date.now().toString() + Math.random(),
          fileName: file.name,
          fileUrl: reader.result as string,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        }
        setPhotos((prev) => [...prev, photoData])
        if (selectedPhoto === null) {
          setSelectedPhoto(0)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    if (selectedPhoto === index) {
      setSelectedPhoto(null)
    } else if (selectedPhoto !== null && selectedPhoto > index) {
      setSelectedPhoto(selectedPhoto - 1)
    }
  }

  const addComponentNode = (component: Component) => {
    const newNode: Node = {
      id: `component-${nextNodeId++}`,
      type: 'component',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: component.name,
        componentId: component.id,
        componentType: component.type,
      },
    }
    setNodes((nds) => [...nds, newNode])
    setTool('select')
  }

  const addInterfaceNode = (interface_: Interface) => {
    const newNode: Node = {
      id: `interface-${nextNodeId++}`,
      type: 'interface',
      position: { x: Math.random() * 400, y: Math.random() * 300 },
      data: {
        label: interface_.name,
        interfaceId: interface_.id,
        interfaceType: interface_.type,
      },
    }
    setNodes((nds) => [...nds, newNode])
    setTool('select')
  }

  const deleteSelected = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
      setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
      setSelectedNode(null)
    }
  }

    return (
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        className="bg-transparent"
      >
        <Controls />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    )
  }

  const handleSave = () => {
    const diagramData = {
      nodes,
      edges,
    }
    onSave({ diagramData, photos })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">2D Test Setup Editor</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formData.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Form
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save Setup
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Tools & Components */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Tools</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTool('select')}
                  className={`p-2 rounded-lg border transition-colors ${
                    tool === 'select'
                      ? 'bg-blue-100 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Select/Move"
                >
                  <Square size={18} />
                </button>
                <button
                  onClick={() => setTool('text')}
                  className={`p-2 rounded-lg border transition-colors ${
                    tool === 'text'
                      ? 'bg-blue-100 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Add Text"
                >
                  <Type size={18} />
                </button>
                <button
                  onClick={() => setTool('arrow')}
                  className={`p-2 rounded-lg border transition-colors ${
                    tool === 'arrow'
                      ? 'bg-blue-100 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Add Arrow"
                >
                  <ArrowRight size={18} />
                </button>
                {selectedNode && (
                  <button
                    onClick={deleteSelected}
                    className="p-2 rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete Selected"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Photo Upload */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Photos</h3>
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-3"
              >
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <Upload className="text-gray-400 mb-1" size={20} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 text-center">
                    Drop or click
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              {photos.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {photos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                        selectedPhoto === idx
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setSelectedPhoto(idx)}
                    >
                      <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {photo.fileName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {(photo.fileSize / 1024).toFixed(1)} KB
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removePhoto(idx)
                        }}
                        className="mt-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Components */}
            {formData.components.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-1 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Components</h3>
                <div className="space-y-2">
                  {formData.components.map((component) => (
                    <button
                      key={component.id}
                      onClick={() => addComponentNode(component)}
                      className="w-full text-left p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                    >
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{component.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{component.type}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Interfaces */}
            {formData.interfaces.length > 0 && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-1 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Interfaces</h3>
                <div className="space-y-2">
                  {formData.interfaces.map((interface_) => (
                    <button
                      key={interface_.id}
                      onClick={() => addInterfaceNode(interface_)}
                      className="w-full text-left p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-600 transition-colors"
                    >
                      <div className="text-xs font-medium text-gray-900 dark:text-white">{interface_.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{interface_.type}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col relative">
            {/* Background Photo */}
            {selectedPhoto !== null && photos[selectedPhoto] && (
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <img
                  src={photos[selectedPhoto].fileUrl}
                  alt={photos[selectedPhoto].fileName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}

            {/* ReactFlow Canvas */}
            <div className="flex-1 relative z-10">
              <ReactFlowProvider>
                <EditorInner />
              </ReactFlowProvider>
            </div>

            {/* Properties Panel */}
            {selectedNode && (
              <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg z-20 min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Properties</h4>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
                {selectedNode.type === 'text' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Text
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.text || ''}
                      onChange={(e) => {
                        setNodes((nds) =>
                          nds.map((n) =>
                            n.id === selectedNode.id ? { ...n, data: { ...n.data, text: e.target.value } } : n
                          )
                        )
                        setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, text: e.target.value } })
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
