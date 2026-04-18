import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { io, Socket } from 'socket.io-client';
import {
  Activity,
  Database,
  Server,
  Globe,
  ShieldCheck,
  Zap,
  Settings,
  Trash2,
  Terminal,
  ChevronRight,
  RefreshCw,
  Plus,
  Radio,
  AlertTriangle,
  Fingerprint
} from 'lucide-react';
import WarRoomTerminal from './WarRoomTerminal';
import ArchitectureAuditor from './ArchitectureAuditor';
import CommandCenterSidebar from './CommandCenterSidebar';
import { ReactFlowProvider, useReactFlow } from 'reactflow';

// --- Custom Node Component ---
const CustomNode = ({ data, selected }: { data: any, selected: boolean }) => {
  const metrics = data.metrics || { latency: 0, load: 0, errors: 0 };

  const getHealthClass = () => {
    if (metrics.errors > 0 || metrics.latency > 500) return 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] bg-red-950/20';
    if (metrics.latency > 150 || metrics.load > 70) return 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)] bg-yellow-950/10';
    return 'border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)] bg-emerald-950/5';
  };

  const getPulseClass = () => {
    if (metrics.load > 85) return 'animate-heartbeat';
    if (metrics.load > 60) return 'animate-pulse-fast';
    return '';
  };

  const getIcon = () => {
    switch (data.type) {
      case 'ui': return <Globe size={18} className="text-blue-400" />;
      case 'api': return <Activity size={18} className="text-purple-400" />;
      case 'service': return <Server size={18} className="text-orange-400" />;
      case 'db': return <Database size={18} className="text-emerald-400" />;
      case 'auth': return <ShieldCheck size={18} className="text-indigo-400" />;
      case 'cache': return <Zap size={18} className="text-amber-400" />;
      default: return <Server size={18} className="text-gray-400" />;
    }
  };

  return (
    <div className={`
      px-5 py-4 rounded-2xl border-2 backdrop-blur-xl transition-all duration-500 min-w-[200px]
      ${getHealthClass()}
      ${getPulseClass()}
      ${selected ? 'ring-2 ring-white/50 scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)]' : ''}
    `}>
      <Handle type="target" position={Position.Left} className="!bg-blue-500 !w-2 !h-2 !border-none" />

      <div className="flex items-center gap-4">
        <div className="p-3 bg-gray-950/50 rounded-xl border border-white/5">
          {getIcon()}
        </div>
        <div>
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
            {data.type}
          </div>
          <div className="text-sm font-bold text-gray-100 tracking-tight whitespace-nowrap">
            {data.label}
          </div>
        </div>
      </div>

      {/* Metrics Mini-Bar */}
      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[10px] font-mono">
        <div className="flex gap-3">
          <span className={metrics.latency > 150 ? 'text-yellow-400' : 'text-emerald-400/80'}>
            {Math.round(metrics.latency)}ms
          </span>
          <span className={metrics.load > 70 ? 'text-orange-400' : 'text-gray-400'}>
            {Math.round(metrics.load)}%
          </span>
        </div>
        {metrics.errors > 0 ? (
          <span className="text-red-500 font-black animate-pulse">
            ERR: {metrics.errors}
          </span>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-purple-500 !w-2 !h-2 !border-none" />
    </div>
  );
};



// --- Impact Inspector (Future Task) ---
const ImpactInspector: React.FC<{ selectedId: string }> = ({ selectedId }) => (
  <div className="p-4 bg-gray-950/20 border-t border-gray-800">
    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
      <Fingerprint size={12} className="text-purple-400" />
      Impact Radius: {selectedId}
    </div>
    <div className="text-[9px] text-gray-400 italic">Tracing downstream dependencies...</div>
  </div>
);

// --- Schema Node Component ---
const SchemaNode = ({ id, data }: { id: string, data: any }) => {
  const metrics = data.metrics || { latency: 0, load: 0, errors: 0 };

  const getHealthClass = () => {
    if (metrics.errors > 0 || metrics.latency > 500) return 'border-red-500/60 shadow-[0_0_40px_rgba(239,68,68,0.2)] bg-red-950/10';
    if (metrics.latency > 150 || metrics.load > 70) return 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)] bg-yellow-950/5';
    return 'border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.15)]';
  };

  const getPulseClass = () => {
    if (metrics.load > 85) return 'animate-heartbeat';
    return '';
  };

  return (
    <div className={`bg-[#0d1117] border-2 rounded-xl overflow-hidden min-w-[280px] backdrop-blur-xl transition-all duration-700 ${getHealthClass()} ${getPulseClass()}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/40 via-gray-900/60 to-indigo-900/40 px-4 py-3 border-b border-purple-500/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className={metrics.errors > 0 ? 'text-red-400' : 'text-purple-400'} />
          <span className="text-xs font-black text-gray-100 uppercase tracking-[0.2em]">{data.label}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[9px]">
          <span className={metrics.latency > 150 ? 'text-yellow-400' : 'text-purple-400/60'}>{Math.round(metrics.latency)}ms</span>
          <div className={`w-2 h-2 rounded-full ${metrics.errors > 0 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
        </div>
      </div>

      {/* Fields List */}
      <div className="flex flex-col relative">
        {data.fields.map((field: any, i: number) => (
          <div
            key={field.name}
            className={`group px-4 py-2.5 flex justify-between items-center text-[11px] relative hover:bg-white/[0.03] transition-colors ${i !== data.fields.length - 1 ? 'border-b border-gray-800/30' : ''}`}
          >
            {/* Handles for field-level linking */}
            <Handle
              type="target"
              position={Position.Left}
              id={`${id}-${field.name}-target`}
              className="!w-2 !h-2 !-left-[5px] !border-none !bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
            />

            <div className="flex items-center gap-2 z-10">
              {field.pk && <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-md font-black border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">PK</span>}
              {field.fk && <span className="text-[9px] bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded-md font-black border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">FK</span>}
              <span className="text-gray-200 font-bold tracking-tight">{field.name}</span>
              {field.indexed && <Zap size={10} className="text-purple-400/60" />}
            </div>

            <div className="flex flex-col items-end gap-0.5 z-10">
              <span className="text-purple-400/80 font-mono font-bold lowercase">{field.type}</span>
              {field.default && <span className="text-[8px] text-gray-500 font-mono">def: {field.default}</span>}
              {field.nullable === false && <span className="text-[8px] text-red-500/60 font-black uppercase tracking-tighter">Required</span>}
            </div>

            <Handle
              type="source"
              position={Position.Right}
              id={`${id}-${field.name}`}
              className="!w-2 !h-2 !-right-[5px] !border-none !bg-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        ))}
      </div>

      {/* Live Preview Ticker */}
      {data.samples && (
        <div className="bg-black/40 px-4 py-2 border-t border-purple-500/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Activity size={10} className="text-emerald-500 animate-pulse" />
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Live Record Stream</span>
          </div>
          <div className="flex gap-2">
            {data.samples.map((s: string, idx: number) => (
              <span key={idx} className="text-[9px] font-mono text-emerald-400/70 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
  schema: SchemaNode,
};

const DataFlowAdminPanel: React.FC = () => {
  const [currentView, setCurrentView] = useState<'INFRA' | 'APP' | 'TRACE' | 'DATA' | 'SCHEMA'>('INFRA');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const socketRef = useRef<Socket | null>(null);
  const [logs, setLogs] = useState<{ id: string, time: string, msg: string, type: 'info' | 'warn' | 'error' }[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);
  const [auditFindings, setAuditFindings] = useState<any[]>([]);
  const [adminKpis, setAdminKpis] = useState({
    healthScore: 100,
    avgLatency: 0,
    avgLoad: 0,
    totalErrors: 0,
    totalNodes: 0,
    activeViews: 0
  });
  const [activeUsers, setActiveUsers] = useState([
    { id: '1', name: 'Admin Alpha', entity: 'System', location: 'London' },
    { id: '2', name: 'Eng Beta', entity: 'SupplyChain', location: 'New York' }
  ]);
  const [selectedElement, setSelectedElement] = useState<{ id: string, type: 'node' | 'edge' } | null>(null);

  const selectedNodeData = useMemo(() => {
    if (!selectedElement || selectedElement.type !== 'node') return null;
    const node = nodes.find(n => n.id === selectedElement.id);
    if (!node) return null;

    const upstream = edges
      .filter(e => e.target === node.id)
      .map(e => e.source);

    const downstream = edges
      .filter(e => e.source === node.id)
      .map(e => e.target);

    return {
      id: node.id,
      label: node.data.label,
      type: node.data.type,
      upstream,
      downstream
    };
  }, [selectedElement, nodes, edges]);

  const { setCenter } = useReactFlow();

  const handleFocusNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setCenter(node.position.x + 100, node.position.y + 50, { zoom: 1.5, duration: 1000 });
      setSelectedElement({ id: nodeId, type: 'node' });
    }
  }, [nodes, setCenter]);

  const addLog = useCallback((msg: string, type: 'info' | 'warn' | 'error' = 'info') => {
    setLogs((prev) => [
      { id: Math.random().toString(36), time: new Date().toLocaleTimeString(), msg, type },
      ...prev.slice(0, 49)
    ]);
  }, []);

  const handleCommand = useCallback((cmd: string) => {
    addLog(`Executing command: ${cmd}`, 'info');
    if (socketRef.current?.connected) {
      socketRef.current.emit('admin:command', { command: cmd });
    }
  }, [addLog]);

  useEffect(() => {
    // Issue #170: attach JWT from storage so the server can authenticate the
    // handshake and decide admin room membership by verified role (never by
    // a client-supplied query parameter).
    const token =
      (typeof localStorage !== 'undefined' && localStorage.getItem('token')) ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('token')) ||
      ''
    const socket = io('/', {
      path: '/socket.io',
      auth: { token },
      query: {
        view: currentView,
      }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      addLog(`Connected to ${currentView} view`, 'info');
    });

    socket.on('dataflow:init', (payload) => {
      if (payload.nodes && payload.edges) {
        setNodes(payload.nodes);
        setEdges(payload.edges);
      }
    });

    socket.on('dataflow:update', (payload) => {
      if (payload.view === currentView) {
        if (payload.nodes) setNodes(payload.nodes);
        if (payload.edges) setEdges(payload.edges);
      }
    });

    socket.on('admin:log', (log) => {
      setAdminLogs((prev) => [...prev, log].slice(-100));
    });

    socket.on('admin:audit', (payload) => {
      setAuditFindings(payload.findings);
      if (payload.findings.length > 0 && !isAuditorOpen) {
        addLog(`Architecture Auditor detected ${payload.findings.length} issues`, 'warn');
      }
    });

    socket.on('admin:kpi', (payload) => {
      setAdminKpis(payload);
    });

    socket.on('admin:users', (users) => {
      setActiveUsers(users);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentView, setNodes, setEdges, addLog]);

  const emitUpdate = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('dataflow:update', {
        view: currentView,
        nodes: newNodes,
        edges: newEdges
      });
    }
  }, [currentView]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const newEdges = addEdge({ ...connection, animated: true }, eds);
      emitUpdate(nodes, newEdges);
      return newEdges;
    });
    addLog(`Established link: ${connection.source} -> ${connection.target}`, 'info');
  }, [nodes, emitUpdate, addLog, setEdges]);

  const handleAddNode = () => {
    const types: ('ui' | 'api' | 'service' | 'db' | 'auth' | 'cache')[] = ['service', 'db', 'cache', 'api'];
    const type = types[Math.floor(Math.random() * types.length)];
    const id = `${type}-${Math.random().toString(36).substr(2, 4)}`;

    const newNode: Node = {
      id,
      type: 'custom',
      position: { x: Math.random() * 500, y: Math.random() * 500 },
      data: {
        label: `${type.toUpperCase()} Instance`,
        type,
        status: 'online',
        load: Math.floor(Math.random() * 100)
      },
    };

    setNodes((nds) => {
      const updated = [...nds, newNode];
      emitUpdate(updated, edges);
      return updated;
    });
    addLog(`Deployed new ${type} instance: ${id}`);
  };

  const handleRemoveSelected = () => {
    if (!selectedElement) return;

    if (selectedElement.type === 'node') {
      setNodes((nds) => {
        const updated = nds.filter((n) => n.id !== selectedElement.id);
        const filteredEdges = edges.filter(e => e.source !== selectedElement.id && e.target !== selectedElement.id);
        emitUpdate(updated, filteredEdges);
        return updated;
      });
      setEdges((eds) => eds.filter(e => e.source !== selectedElement.id && e.target !== selectedElement.id));
      addLog(`Decommissioned node: ${selectedElement.id}`, 'warn');
    } else {
      setEdges((eds) => {
        const updated = eds.filter((e) => e.id !== selectedElement.id);
        emitUpdate(nodes, updated);
        return updated;
      });
      addLog(`Severed communication path: ${selectedElement.id}`, 'warn');
    }
    setSelectedElement(null);
  };

  const onNodesDelete = useCallback(() => {
    addLog('Batch node deletion triggered', 'warn');
  }, [addLog]);

  return (
    <div className="h-screen w-full flex bg-[#0d1117] text-gray-200 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative">
        <header className="px-6 py-4 flex items-center justify-between border-b border-gray-800 bg-[#161b22]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="text-blue-500" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">System Data Flow</h1>
              <p className="text-xs text-gray-500 uppercase font-semibold">Real-time Platform Monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-[#0d1117] p-1 rounded-xl border border-gray-800 shadow-inner">
              {(['INFRA', 'APP', 'TRACE', 'DATA', 'SCHEMA'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setCurrentView(v)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${currentView === v
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="h-8 w-px bg-gray-800 mx-2" />

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddNode}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg active:scale-95"
              >
                <Plus size={16} />
                Provision Node
              </button>
              <button
                onClick={handleRemoveSelected}
                disabled={!selectedElement}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedElement
                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/50'
                  : 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed'
                  }`}
              >
                <Trash2 size={16} />
                Terminal Selected
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 bg-grid-gray-900">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedElement({ id: node.id, type: 'node' })}
            onEdgeClick={(_, edge) => setSelectedElement({ id: edge.id, type: 'edge' })}
            onPaneClick={() => setSelectedElement(null)}
            onNodesDelete={onNodesDelete}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              style: { strokeWidth: 2, stroke: '#3b82f6' },
              labelStyle: { fill: '#94a3b8', fontWeight: 600, fontSize: 10 },
              labelBgPadding: [8, 4],
              labelBgBorderRadius: 4,
              labelBgStyle: { fill: '#161b22', fillOpacity: 0.8 }
            }}
          >
            <Background color="#1f2937" gap={20} />
            <Controls className="bg-gray-900 border-gray-700 fill-white" />
            <MiniMap
              className="!bg-gray-900/80 !border-gray-700"
              maskColor="rgb(17, 24, 39, 0.7)"
              nodeColor={(n) => {
                const data = n.data as any;
                if (data.type === 'ui') return '#60a5fa';
                if (data.type === 'api') return '#a78bfa';
                if (data.type === 'db') return '#34d399';
                return '#9ca3af';
              }}
            />
            <Panel position="bottom-left" className="bg-gray-900/50 p-2 rounded-lg border border-gray-800 backdrop-blur-sm">
              <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> UI</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> API</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> SERVICE</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> DB</div>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>

      {/* Side Profile / Monitoring */}
      <div className="w-96 shrink-0 h-full shadow-2xl z-20">
        <CommandCenterSidebar
          kpis={adminKpis}
          logs={logs}
          activeUsers={activeUsers}
          selectedNode={selectedNodeData}
          onCommand={handleCommand}
          onFocusNode={handleFocusNode}
        />
      </div>

      <WarRoomTerminal
        logs={adminLogs}
        onClear={() => setAdminLogs([])}
        isOpen={isTerminalOpen}
        onToggle={() => setIsTerminalOpen(!isTerminalOpen)}
      />

      <ArchitectureAuditor
        findings={auditFindings}
        isOpen={isAuditorOpen}
        onClose={() => setIsAuditorOpen(false)}
        onFocusNode={handleFocusNode}
      />

      {/* Auditor Toggle Button (Fixed Position) */}
      {!isAuditorOpen && auditFindings.length > 0 && (
        <button
          onClick={() => setIsAuditorOpen(true)}
          className="absolute top-24 right-84 p-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-2xl z-40 animate-pulse transition-all active:scale-90 flex items-center gap-2 group"
        >
          <AlertTriangle size={20} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all text-xs font-bold whitespace-nowrap">
            {auditFindings.length} Alerts
          </span>
        </button>
      )}
    </div>
  );
};

export default () => (
  <ReactFlowProvider>
    <DataFlowAdminPanel />
  </ReactFlowProvider>
);

// --- CSS Animations ---
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes heartbeat {
      0% { transform: scale(1); box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
      14% { transform: scale(1.03); box-shadow: 0 0 40px rgba(239, 68, 68, 0.6); }
      28% { transform: scale(1); box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
      42% { transform: scale(1.03); box-shadow: 0 0 40px rgba(239, 68, 68, 0.6); }
      70% { transform: scale(1); box-shadow: 0 0 20px rgba(239, 68, 68, 0.4); }
    }
    .animate-heartbeat {
      animation: heartbeat 1.5s ease-in-out infinite;
    }
    @keyframes pulse-fast {
      0% { opacity: 0.8; }
      50% { opacity: 1; transform: scale(1.01); }
      100% { opacity: 0.8; }
    }
    .animate-pulse-fast {
      animation: pulse-fast 1s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}
