import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
  ReactFlowProvider,
  Connection,
  addEdge,
  useReactFlow,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  X,
  Plus,
  Trash2,
  Edit3,
  Save,
  Link as LinkIcon,
  Unlink,
  MousePointer2,
  Move,
  Square,
  Circle,
  FileText,
  Settings,
  GitBranch,
  AlertCircle,
  CheckCircle,
  Loader,
  Download,
  Undo,
  Redo,
  Copy,
  Scissors,
  Clipboard,
} from 'lucide-react'
import { requirementService } from '../../../services/requirement.service'
import { functionService } from '../../../services/function.service'
import { traceabilityService } from '../../../services/traceability.service'
import type { Requirement, SystemFunction } from 'shared/types/engineering.types'
import type { TraceLink, LinkType } from 'shared/types/traceability.types'
import clsx from 'clsx'

interface DiagramEditorProps {
  projectId: string
  onClose: () => void
}

type EditMode = 'select' | 'pan' | 'add-requirement' | 'add-function' | 'add-link' | 'delete'
type ElementType = 'requirement' | 'function'

interface ElementProperties {
  id: string
  type: ElementType
  title: string
  description?: string
  priority?: string
  status?: string
  requirementId?: string
  functionId?: string
}

interface UndoAction {
  type: 'add-node' | 'delete-node' | 'add-edge' | 'delete-edge' | 'update-node' | 'move-node'
  data: any
}

/**
 * Custom node component for editable requirements
 */
const EditableRequirementNode = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 min-w-[180px] shadow-sm',
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-blue-400',
        data.isNew && 'border-dashed'
      )}
    >
      <div className="text-[10px] text-blue-600 font-medium mb-1">«requirement»</div>
      <div className="font-mono text-xs text-gray-500 mb-1">{data.identifier || 'NEW'}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{data.label}</div>
      {data.priority && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className="px-1.5 py-0.5 text-[10px] rounded"
            style={{
              backgroundColor:
                data.priority === 'critical' ? '#fee2e2' :
                  data.priority === 'high' ? '#ffedd5' :
                    data.priority === 'medium' ? '#fef9c3' : '#dcfce7',
              color:
                data.priority === 'critical' ? '#dc2626' :
                  data.priority === 'high' ? '#ea580c' :
                    data.priority === 'medium' ? '#ca8a04' : '#16a34a',
            }}
          >
            {data.priority}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Custom node component for editable functions
 */
const EditableFunctionNode = ({ data, selected }: { data: any; selected: boolean }) => {
  return (
    <div
      className={clsx(
        'px-4 py-3 rounded-full border-2 bg-white dark:bg-gray-800 min-w-[160px] shadow-sm',
        selected ? 'border-green-500 ring-2 ring-green-200' : 'border-green-400',
        data.isNew && 'border-dashed'
      )}
    >
      <div className="text-center">
        <div className="text-[10px] text-green-600 font-medium mb-1">«function»</div>
        <div className="font-mono text-xs text-gray-500 mb-1">{data.identifier || 'NEW'}</div>
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{data.label}</div>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  requirement: EditableRequirementNode,
  function: EditableFunctionNode,
}

/**
 * DiagramEditor provides a canvas-based editing environment
 * for creating and modifying model elements directly on the diagram.
 * Implements industrial MBSE tool patterns from Cameo/Rhapsody.
 */
function DiagramEditorContent({ projectId, onClose }: DiagramEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [editMode, setEditMode] = useState<EditMode>('select')
  const [selectedElement, setSelectedElement] = useState<ElementProperties | null>(null)
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(true)
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoAction[]>([])
  const [pendingNodes, setPendingNodes] = useState<Node[]>([])
  const [pendingEdges, setPendingEdges] = useState<Edge[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [linkSourceNode, setLinkSourceNode] = useState<string | null>(null)
  const [showLinkTypeDialog, setShowLinkTypeDialog] = useState(false)
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  const [selectedLinkType, setSelectedLinkType] = useState<LinkType>('satisfies')
  const [editingProperties, setEditingProperties] = useState<ElementProperties | null>(null)

  const queryClient = useQueryClient()
  const reactFlowInstance = useReactFlow()

  // Fetch existing data
  const { data: requirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [], isLoading: loadingFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: traceLinks = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['trace-links', projectId],
    queryFn: async () => {
      const response = await traceabilityService.getTraceLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Build initial nodes and edges from data
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    let reqY = 50
    let funcY = 50

    // Create requirement nodes
    requirements.forEach((req, index) => {
      nodes.push({
        id: req.id,
        type: 'requirement',
        position: { x: 100, y: reqY },
        data: {
          label: req.title,
          identifier: req.requirementId,
          priority: req.priority,
          status: req.status,
          description: req.description,
        },
      })
      reqY += 120
    })

    // Create function nodes
    functions.forEach((func, index) => {
      nodes.push({
        id: func.id,
        type: 'function',
        position: { x: 500, y: funcY },
        data: {
          label: func.name,
          identifier: func.functionId,
          status: func.status,
          description: func.description,
        },
      })
      funcY += 100
    })

    // Create edges from trace links
    traceLinks.forEach((link) => {
      edges.push({
        id: link.id,
        source: link.sourceId,
        target: link.targetId,
        type: 'smoothstep',
        label: link.linkType,
        animated: link.isSuspect,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: link.isSuspect ? '#f59e0b' : '#6b7280' },
        labelStyle: { fill: '#6b7280', fontSize: 10 },
        data: { linkType: link.linkType, isSuspect: link.isSuspect },
      })
    })

    // Also add edges from function sourceReqId
    functions.forEach((func) => {
      if (func.sourceReqId && !edges.find((e) => e.source === func.sourceReqId && e.target === func.id)) {
        edges.push({
          id: `func-link-${func.id}`,
          source: func.sourceReqId,
          target: func.id,
          type: 'smoothstep',
          label: 'satisfies',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#6b7280' },
          labelStyle: { fill: '#6b7280', fontSize: 10 },
          data: { linkType: 'satisfies' },
        })
      }
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [requirements, functions, traceLinks])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    setPendingNodes([])
    setPendingEdges([])
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Create requirement mutation
  const createRequirementMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; priority?: string }) => {
      return requirementService.createRequirement(projectId, {
        title: data.title,
        description: data.description || '',
        priority: (data.priority as any) || 'medium',
        status: 'draft',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
    },
  })

  // Create function mutation
  const createFunctionMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; sourceReqId?: string }) => {
      return functionService.createFunction(projectId, {
        name: data.name,
        description: data.description || '',
        sourceReqId: data.sourceReqId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
    },
  })

  // Create trace link mutation
  const createTraceLinkMutation = useMutation({
    mutationFn: (data: { sourceId: string; targetId: string; linkType: LinkType }) => {
      return traceabilityService.createTraceLink(projectId, {
        sourceType: 'requirement',
        sourceId: data.sourceId,
        targetType: 'function',
        targetId: data.targetId,
        linkType: data.linkType,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    },
  })

  // Delete requirement mutation
  const deleteRequirementMutation = useMutation({
    mutationFn: (id: string) => requirementService.deleteRequirement(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
    },
  })

  // Delete function mutation
  const deleteFunctionMutation = useMutation({
    mutationFn: (id: string) => functionService.deleteFunction(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
    },
  })

  // Delete trace link mutation
  const deleteTraceLinkMutation = useMutation({
    mutationFn: (id: string) => traceabilityService.deleteTraceLink(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    },
  })

  // Handle canvas click for adding elements
  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (editMode !== 'add-requirement' && editMode !== 'add-function') return

      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!bounds) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      const newId = `new-${Date.now()}`
      const elementType: ElementType = editMode === 'add-requirement' ? 'requirement' : 'function'

      const newNode: Node = {
        id: newId,
        type: elementType,
        position,
        data: {
          label: elementType === 'requirement' ? 'New Requirement' : 'New Function',
          identifier: '',
          isNew: true,
        },
      }

      setNodes((nds) => [...nds, newNode])
      setPendingNodes((prev) => [...prev, newNode])
      setHasUnsavedChanges(true)

      // Add to undo stack
      setUndoStack((prev) => [...prev, { type: 'add-node', data: newNode }])
      setRedoStack([])

      // Select the new node for editing
      setSelectedElement({
        id: newId,
        type: elementType,
        title: elementType === 'requirement' ? 'New Requirement' : 'New Function',
      })
      setEditingProperties({
        id: newId,
        type: elementType,
        title: elementType === 'requirement' ? 'New Requirement' : 'New Function',
      })

      // Reset to select mode
      setEditMode('select')
    },
    [editMode, reactFlowInstance, setNodes]
  )

  // Handle node click
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (editMode === 'delete') {
        // Delete the node
        const isNewNode = pendingNodes.find((n) => n.id === node.id)
        if (isNewNode) {
          setNodes((nds) => nds.filter((n) => n.id !== node.id))
          setPendingNodes((prev) => prev.filter((n) => n.id !== node.id))
        } else {
          // Delete from database
          if (node.type === 'requirement') {
            deleteRequirementMutation.mutate(node.id)
          } else if (node.type === 'function') {
            deleteFunctionMutation.mutate(node.id)
          }
        }
        setUndoStack((prev) => [...prev, { type: 'delete-node', data: node }])
        setRedoStack([])
        return
      }

      if (editMode === 'add-link') {
        if (!linkSourceNode) {
          setLinkSourceNode(node.id)
        } else if (linkSourceNode !== node.id) {
          // Create connection
          setPendingConnection({
            source: linkSourceNode,
            target: node.id,
            sourceHandle: null,
            targetHandle: null,
          })
          setShowLinkTypeDialog(true)
          setLinkSourceNode(null)
        }
        return
      }

      // Select mode - show properties
      setSelectedElement({
        id: node.id,
        type: node.type as ElementType,
        title: node.data.label,
        description: node.data.description,
        priority: node.data.priority,
        status: node.data.status,
        requirementId: node.data.identifier,
        functionId: node.data.identifier,
      })
    },
    [editMode, linkSourceNode, pendingNodes, setNodes, deleteRequirementMutation, deleteFunctionMutation]
  )

  // Handle edge click for deletion
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (editMode === 'delete') {
        const isNewEdge = pendingEdges.find((e) => e.id === edge.id)
        if (isNewEdge) {
          setEdges((eds) => eds.filter((e) => e.id !== edge.id))
          setPendingEdges((prev) => prev.filter((e) => e.id !== edge.id))
        } else {
          deleteTraceLinkMutation.mutate(edge.id)
        }
        setUndoStack((prev) => [...prev, { type: 'delete-edge', data: edge }])
        setRedoStack([])
      }
    },
    [editMode, pendingEdges, setEdges, deleteTraceLinkMutation]
  )

  // Handle connection (edge creation)
  const onConnect = useCallback(
    (connection: Connection) => {
      setPendingConnection(connection)
      setShowLinkTypeDialog(true)
    },
    []
  )

  // Confirm link creation
  const confirmLinkCreation = useCallback(() => {
    if (!pendingConnection) return

    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: pendingConnection.source!,
      target: pendingConnection.target!,
      type: 'smoothstep',
      label: selectedLinkType,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#6b7280' },
      labelStyle: { fill: '#6b7280', fontSize: 10 },
      data: { linkType: selectedLinkType, isNew: true },
    }

    setEdges((eds) => addEdge(newEdge, eds))
    setPendingEdges((prev) => [...prev, newEdge])
    setHasUnsavedChanges(true)
    setUndoStack((prev) => [...prev, { type: 'add-edge', data: newEdge }])
    setRedoStack([])
    setShowLinkTypeDialog(false)
    setPendingConnection(null)
  }, [pendingConnection, selectedLinkType, setEdges])

  // Update node properties
  const updateNodeProperties = useCallback(
    (properties: ElementProperties) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === properties.id) {
            return {
              ...node,
              data: {
                ...node.data,
                label: properties.title,
                description: properties.description,
                priority: properties.priority,
                status: properties.status,
                identifier: properties.type === 'requirement' ? properties.requirementId : properties.functionId,
              },
            }
          }
          return node
        })
      )
      setHasUnsavedChanges(true)
      setEditingProperties(null)
      setSelectedElement(properties)
    },
    [setNodes]
  )

  // Save all pending changes
  const saveAllChanges = async () => {
    setIsSaving(true)
    try {
      // Save new nodes
      for (const node of pendingNodes) {
        if (node.type === 'requirement') {
          await createRequirementMutation.mutateAsync({
            title: node.data.label,
            description: node.data.description,
            priority: node.data.priority,
          })
        } else if (node.type === 'function') {
          await createFunctionMutation.mutateAsync({
            name: node.data.label,
            description: node.data.description,
          })
        }
      }

      // Save new edges (trace links)
      for (const edge of pendingEdges) {
        const sourceNode = nodes.find((n) => n.id === edge.source)
        const targetNode = nodes.find((n) => n.id === edge.target)
        if (sourceNode && targetNode) {
          await createTraceLinkMutation.mutateAsync({
            sourceId: edge.source,
            targetId: edge.target,
            linkType: edge.data?.linkType || 'satisfies',
          })
        }
      }

      setPendingNodes([])
      setPendingEdges([])
      setHasUnsavedChanges(false)

      // Refresh data
      await queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      await queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
      await queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Undo action
  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const action = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, action])

    switch (action.type) {
      case 'add-node':
        setNodes((nds) => nds.filter((n) => n.id !== action.data.id))
        setPendingNodes((prev) => prev.filter((n) => n.id !== action.data.id))
        break
      case 'delete-node':
        setNodes((nds) => [...nds, action.data])
        break
      case 'add-edge':
        setEdges((eds) => eds.filter((e) => e.id !== action.data.id))
        setPendingEdges((prev) => prev.filter((e) => e.id !== action.data.id))
        break
      case 'delete-edge':
        setEdges((eds) => [...eds, action.data])
        break
    }
  }, [undoStack, setNodes, setEdges])

  // Redo action
  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const action = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))
    setUndoStack((prev) => [...prev, action])

    switch (action.type) {
      case 'add-node':
        setNodes((nds) => [...nds, action.data])
        setPendingNodes((prev) => [...prev, action.data])
        break
      case 'delete-node':
        setNodes((nds) => nds.filter((n) => n.id !== action.data.id))
        break
      case 'add-edge':
        setEdges((eds) => [...eds, action.data])
        setPendingEdges((prev) => [...prev, action.data])
        break
      case 'delete-edge':
        setEdges((eds) => eds.filter((e) => e.id !== action.data.id))
        break
    }
  }, [redoStack, setNodes, setEdges])

  const isLoading = loadingReqs || loadingFuncs || loadingLinks

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Edit3 className="text-blue-500" size={20} />
              Diagram Editor
            </h2>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
              title="Undo"
            >
              <Undo size={16} />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-30"
              title="Redo"
            >
              <Redo size={16} />
            </button>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
            <button
              onClick={saveAllChanges}
              disabled={!hasUnsavedChanges || isSaving}
              className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-1"
            >
              {isSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              Save All
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Toolbar */}
          <div className="w-14 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-3 gap-1">
            <button
              onClick={() => setEditMode('select')}
              className={clsx(
                'p-2.5 rounded-lg transition-colors',
                editMode === 'select'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              title="Select (V)"
            >
              <MousePointer2 size={18} />
            </button>
            <button
              onClick={() => setEditMode('pan')}
              className={clsx(
                'p-2.5 rounded-lg transition-colors',
                editMode === 'pan'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              title="Pan (H)"
            >
              <Move size={18} />
            </button>
            <div className="h-px w-8 bg-gray-300 dark:bg-gray-600 my-2" />
            <button
              onClick={() => setEditMode('add-requirement')}
              className={clsx(
                'p-2.5 rounded-lg transition-colors',
                editMode === 'add-requirement'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              title="Add Requirement (R)"
            >
              <Square size={18} />
            </button>
            <button
              onClick={() => setEditMode('add-function')}
              className={clsx(
                'p-2.5 rounded-lg transition-colors',
                editMode === 'add-function'
                  ? 'bg-green-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              title="Add Function (F)"
            >
              <Circle size={18} />
            </button>
            <button
              onClick={() => setEditMode('add-link')}
              className={clsx(
                'p-2.5 rounded-lg transition-colors',
                editMode === 'add-link'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              title="Add Link (L)"
            >
              <LinkIcon size={18} />
            </button>
            <div className="h-px w-8 bg-gray-300 dark:bg-gray-600 my-2" />
            <button
              onClick={() => setEditMode('delete')}
              className={clsx(
                'p-2.5 rounded-lg transition-colors',
                editMode === 'delete'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              title="Delete (D)"
            >
              <Trash2 size={18} />
            </button>
          </div>

          {/* Canvas */}
          <div className="flex-1" ref={reactFlowWrapper}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <Loader className="animate-spin mr-2" size={20} />
                Loading diagram data...
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onPaneClick={handlePaneClick}
                nodeTypes={nodeTypes}
                fitView
                panOnDrag={editMode === 'pan' || editMode === 'select'}
                selectionOnDrag={editMode === 'select'}
                className={clsx(
                  'bg-gray-50 dark:bg-gray-900',
                  editMode === 'add-requirement' && 'cursor-crosshair',
                  editMode === 'add-function' && 'cursor-crosshair',
                  editMode === 'delete' && 'cursor-not-allowed',
                  editMode === 'add-link' && linkSourceNode && 'cursor-pointer'
                )}
              >
                <Controls />
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <MiniMap />
                <Panel position="top-left" className="text-xs text-gray-500 bg-white dark:bg-gray-800 px-2 py-1 rounded shadow">
                  Mode: <span className="font-medium text-gray-900 dark:text-white capitalize">{editMode.replace('-', ' ')}</span>
                  {editMode === 'add-link' && linkSourceNode && (
                    <span className="ml-2 text-purple-600">Click target node</span>
                  )}
                </Panel>
              </ReactFlow>
            )}
          </div>

          {/* Properties Panel */}
          {showPropertiesPanel && (
            <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Properties</h3>
                <button
                  onClick={() => setShowPropertiesPanel(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X size={14} />
                </button>
              </div>

              {selectedElement ? (
                <div className="flex-1 overflow-auto p-3 space-y-4">
                  {editingProperties?.id === selectedElement.id ? (
                    // Edit mode
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={editingProperties.title}
                          onChange={(e) => setEditingProperties({ ...editingProperties, title: e.target.value })}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {selectedElement.type === 'requirement' ? 'ID' : 'Function ID'}
                        </label>
                        <input
                          type="text"
                          value={selectedElement.type === 'requirement' ? editingProperties.requirementId || '' : editingProperties.functionId || ''}
                          onChange={(e) => {
                            if (selectedElement.type === 'requirement') {
                              setEditingProperties({ ...editingProperties, requirementId: e.target.value })
                            } else {
                              setEditingProperties({ ...editingProperties, functionId: e.target.value })
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Description
                        </label>
                        <textarea
                          value={editingProperties.description || ''}
                          onChange={(e) => setEditingProperties({ ...editingProperties, description: e.target.value })}
                          rows={3}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 resize-none"
                        />
                      </div>
                      {selectedElement.type === 'requirement' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Priority
                          </label>
                          <select
                            value={editingProperties.priority || 'medium'}
                            onChange={(e) => setEditingProperties({ ...editingProperties, priority: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => updateNodeProperties(editingProperties)}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                        >
                          Apply
                        </button>
                        <button
                          onClick={() => setEditingProperties(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    // View mode
                    <>
                      <div className="flex items-center gap-2">
                        {selectedElement.type === 'requirement' ? (
                          <FileText size={16} className="text-blue-500" />
                        ) : (
                          <Settings size={16} className="text-green-500" />
                        )}
                        <span className="text-xs text-gray-500 uppercase">{selectedElement.type}</span>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Title</div>
                        <div className="text-sm text-gray-900 dark:text-white">{selectedElement.title}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">
                          {selectedElement.type === 'requirement' ? 'ID' : 'Function ID'}
                        </div>
                        <div className="text-sm font-mono text-gray-900 dark:text-white">
                          {(selectedElement.type === 'requirement' ? selectedElement.requirementId : selectedElement.functionId) || 'Not set'}
                        </div>
                      </div>
                      {selectedElement.description && (
                        <div>
                          <div className="text-xs text-gray-500">Description</div>
                          <div className="text-sm text-gray-700 dark:text-gray-300">{selectedElement.description}</div>
                        </div>
                      )}
                      {selectedElement.priority && (
                        <div>
                          <div className="text-xs text-gray-500">Priority</div>
                          <div className="text-sm text-gray-900 dark:text-white capitalize">{selectedElement.priority}</div>
                        </div>
                      )}
                      <button
                        onClick={() => setEditingProperties(selectedElement)}
                        className="w-full mt-4 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex items-center justify-center gap-1"
                      >
                        <Edit3 size={14} />
                        Edit Properties
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400 p-4 text-center">
                  Select an element to view and edit its properties
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>{nodes.length} elements</span>
            <span>{edges.length} links</span>
            {pendingNodes.length > 0 && (
              <span className="text-amber-600">{pendingNodes.length} new elements</span>
            )}
            {pendingEdges.length > 0 && (
              <span className="text-amber-600">{pendingEdges.length} new links</span>
            )}
          </div>
          <div>
            Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">ESC</kbd> to deselect
          </div>
        </div>
      </div>

      {/* Link Type Dialog */}
      {showLinkTypeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[400px] p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Select Link Type
            </h3>
            <div className="space-y-2">
              {(['satisfies', 'implements', 'verifies', 'derives', 'refines', 'trace', 'allocate'] as LinkType[]).map((type) => (
                <label
                  key={type}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer',
                    selectedLinkType === type
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                >
                  <input
                    type="radio"
                    name="linkType"
                    value={type}
                    checked={selectedLinkType === type}
                    onChange={() => setSelectedLinkType(type)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-white capitalize">{type}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowLinkTypeDialog(false)
                  setPendingConnection(null)
                  setLinkSourceNode(null)
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmLinkCreation}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DiagramEditor(props: DiagramEditorProps) {
  return (
    <ReactFlowProvider>
      <DiagramEditorContent {...props} />
    </ReactFlowProvider>
  )
}
