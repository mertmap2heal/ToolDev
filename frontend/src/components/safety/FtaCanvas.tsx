import { useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  useReactFlow,
  ReactFlowProvider,
  NodeTypes,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Plus, Maximize2, AlertTriangle, X } from 'lucide-react'
import FtaTopNode from './fta/FtaTopNode'
import FtaGateNode from './fta/FtaGateNode'
import FtaBasicNode from './fta/FtaBasicNode'
import { MOCK_FTA_NODES, MOCK_FTA_EDGES } from '../../data/mockSafety'

const nodeTypes: NodeTypes = {
  'fta-top': FtaTopNode,
  'fta-and': FtaGateNode,
  'fta-or': FtaGateNode,
  'fta-basic': FtaBasicNode,
}

function mapMockType(t: string): 'fta-top' | 'fta-and' | 'fta-or' | 'fta-basic' {
  if (t === 'top') return 'fta-top'
  if (t === 'and') return 'fta-and'
  if (t === 'or') return 'fta-or'
  return 'fta-basic'
}

const initialNodes: Node[] = MOCK_FTA_NODES.map((n) => ({
  id: n.id,
  type: mapMockType(n.type),
  position: n.position ?? { x: 0, y: 0 },
  data:
    n.type === 'and' || n.type === 'or'
      ? { label: n.label, gateType: n.type }
      : { label: n.label, description: n.description },
}))

const initialEdges: Edge[] = MOCK_FTA_EDGES.map((e) => ({
  id: e.id,
  source: e.source,
  target: e.target,
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed },
}))

let nextNodeId = 100

function FtaCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [panelName, setPanelName] = useState('')
  const [panelDesc, setPanelDesc] = useState('')
  const [panelLinkedHazard, setPanelLinkedHazard] = useState('')
  const [panelLinkedReq, setPanelLinkedReq] = useState('')
  const [panelLinkedIface, setPanelLinkedIface] = useState('')
  const [panelLinkedVer, setPanelLinkedVer] = useState('')
  const { fitView } = useReactFlow()

  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((prev) => addEdge(conn, prev))
    },
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    const d = node.data as { label?: string; description?: string }
    setPanelName(d?.label ?? '')
    setPanelDesc(d?.description ?? '')
    setPanelLinkedHazard('')
    setPanelLinkedReq('')
    setPanelLinkedIface('')
    setPanelLinkedVer('')
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const addNode = useCallback(
    (type: 'fta-top' | 'fta-and' | 'fta-or' | 'fta-basic') => {
      const id = `n${nextNodeId++}`
      const gateType = type === 'fta-and' ? 'and' : type === 'fta-or' ? 'or' : undefined
      setNodes((prev) => [
        ...prev,
        {
          id,
          type,
          position: { x: 250 + Math.random() * 100, y: prev.length * 80 },
          data:
            gateType
              ? { label: type === 'fta-and' ? 'AND' : 'OR', gateType }
              : { label: type === 'fta-top' ? 'New top event' : 'New basic event', description: '' },
        },
      ])
    },
    [setNodes]
  )

  const handleAutoLayout = useCallback(() => {
    fitView({ padding: 0.2 })
  }, [fitView])

  const topEvents = useMemo(
    () => nodes.filter((n) => n.type === 'fta-top'),
    [nodes]
  )
  const hasTop = topEvents.length > 0
  const topHasHazard = false
  const orphanIds = useMemo(() => {
    const targets = new Set(edges.map((e) => e.target))
    const sources = new Set(edges.map((e) => e.source))
    return nodes
      .filter((n) => !targets.has(n.id) && !sources.has(n.id))
      .map((n) => n.id)
  }, [nodes, edges])
  const orphans = orphanIds.length > 0

  return (
    <div className="flex h-[calc(100vh-14rem)] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={() => addNode('fta-top')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 text-sm"
          >
            <Plus size={14} /> Add Top
          </button>
          <button
            onClick={() => addNode('fta-and')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 text-sm"
          >
            <Plus size={14} /> AND
          </button>
          <button
            onClick={() => addNode('fta-or')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 text-sm"
          >
            <Plus size={14} /> OR
          </button>
          <button
            onClick={() => addNode('fta-basic')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 text-sm"
          >
            <Plus size={14} /> Basic
          </button>
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 text-sm ml-auto"
          >
            <Maximize2 size={14} /> Auto-layout
          </button>
        </div>
        {(hasTop === false || orphans || (hasTop && !topHasHazard)) && (
          <Panel position="top-left" className="mt-2 ml-2">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-2 text-xs space-y-1">
              {!hasTop && (
                <div className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={12} /> Missing top event
                </div>
              )}
              {orphans && (
                <div className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={12} /> Orphan nodes
                </div>
              )}
              {hasTop && !topHasHazard && (
                <div className="flex items-center gap-1 text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={12} /> Missing hazard link at top event
                </div>
              )}
            </div>
          </Panel>
        )}
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
          className="bg-gray-50 dark:bg-gray-900"
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>
      {selectedNode && (
        <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Node details</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <input
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
              <textarea
                value={panelDesc}
                onChange={(e) => setPanelDesc(e.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Node type</label>
              <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
                {selectedNode.type}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Linked Hazard (placeholder)</label>
              <select
                value={panelLinkedHazard}
                onChange={(e) => setPanelLinkedHazard(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">—</option>
                <option value="h1">HZD-001</option>
                <option value="h2">HZD-002</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Linked Requirement (placeholder)</label>
              <select
                value={panelLinkedReq}
                onChange={(e) => setPanelLinkedReq(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">—</option>
                <option value="r1">REQ-001</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Linked Interface (placeholder)</label>
              <select
                value={panelLinkedIface}
                onChange={(e) => setPanelLinkedIface(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">—</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Linked Verification (placeholder)</label>
              <select
                value={panelLinkedVer}
                onChange={(e) => setPanelLinkedVer(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">—</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FtaCanvas() {
  return (
    <ReactFlowProvider>
      <FtaCanvasInner />
    </ReactFlowProvider>
  )
}
