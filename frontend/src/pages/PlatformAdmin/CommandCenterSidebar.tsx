import React from 'react';
import {
    Activity,
    Terminal,
    Users,
    Zap,
    ShieldCheck,
    Database,
    BarChart3,
    Cpu,
    Fingerprint,
    Command,
    ArrowUpRight,
    ArrowDownRight,
    MousePointer2,
    Trash2,
    RefreshCw,
    Power
} from 'lucide-react';

interface KPIState {
    healthScore: number;
    avgLatency: number;
    avgLoad: number;
    totalErrors: number;
    totalNodes: number;
    activeViews: number;
}

interface LogEntry {
    id: string;
    time: string;
    msg: string;
    type: 'info' | 'warn' | 'error';
}

interface CommandCenterSidebarProps {
    kpis: KPIState;
    logs: LogEntry[];
    activeUsers: { id: string, name: string, entity: string, location: string }[];
    selectedNode: { id: string, label: string, type: string, upstream: string[], downstream: string[] } | null;
    onCommand: (cmd: string) => void;
    onFocusNode: (nodeId: string) => void;
}

const CommandCenterSidebar: React.FC<CommandCenterSidebarProps> = ({
    kpis,
    logs,
    activeUsers,
    selectedNode,
    onCommand,
    onFocusNode
}) => {
    const getHealthColor = (score: number) => {
        if (score > 85) return 'text-emerald-500';
        if (score > 60) return 'text-amber-500';
        return 'text-red-500';
    };

    return (
        <div className="h-full flex flex-col bg-[#0d1117] border-l border-gray-800 shadow-2xl overflow-hidden font-sans">
            {/* 1. KPI Scorecard Section */}
            <div className="p-6 border-b border-gray-800 bg-gradient-to-b from-[#161b22] to-transparent">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="text-blue-400" size={14} />
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Platform Vitals</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 p-5 bg-gray-900/50 border border-gray-800 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className={`text-4xl font-black mb-1 transition-colors ${getHealthColor(kpis.healthScore)}`}>
                            {kpis.healthScore}%
                        </div>
                        <div className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Health Index</div>
                    </div>

                    <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-2xl text-center">
                        <div className="text-xl font-bold text-gray-200">{kpis.avgLatency}ms</div>
                        <div className="text-[8px] font-bold text-gray-500 uppercase">Avg Latency</div>
                    </div>

                    <div className="p-4 bg-gray-900/40 border border-gray-800 rounded-2xl text-center">
                        <div className="text-xl font-bold text-gray-200">{kpis.avgLoad}%</div>
                        <div className="text-[8px] font-bold text-gray-500 uppercase">Sys Load</div>
                    </div>
                </div>
            </div>

            {/* 2. Impact Inspector (Conditional) */}
            {selectedNode && (
                <div className="p-6 border-b border-gray-800 bg-purple-500/5 animate-in slide-in-from-right-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Fingerprint className="text-purple-400" size={14} />
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Impact Inspector</h3>
                    </div>
                    <div className="text-xs font-bold text-white mb-3">{selectedNode.label}</div>

                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center gap-1 text-[8px] font-black text-gray-500 uppercase mb-1">
                                <ArrowUpRight size={10} className="text-emerald-500" /> Upstream
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {selectedNode.upstream.length > 0 ? selectedNode.upstream.map(id => (
                                    <button key={id} onClick={() => onFocusNode(id)} className="text-[9px] px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 hover:text-white">{id}</button>
                                )) : <span className="text-[9px] text-gray-600 italic">None</span>}
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1 text-[8px] font-black text-gray-500 uppercase mb-1">
                                <ArrowDownRight size={10} className="text-blue-500" /> Downstream
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {selectedNode.downstream.length > 0 ? selectedNode.downstream.map(id => (
                                    <button key={id} onClick={() => onFocusNode(id)} className="text-[9px] px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 text-gray-400 hover:text-white">{id}</button>
                                )) : <span className="text-[9px] text-gray-600 italic">None</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Quick Actions Palette */}
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                    <Command size={14} className="text-blue-400" />
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Command Palette</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'flush', label: 'Flush Cache', icon: <RefreshCw size={12} /> },
                        { id: 'gc', label: 'GC Run', icon: <Trash2 size={12} /> },
                        { id: 'deploy', label: 'Rollout', icon: <Zap size={12} /> },
                        { id: 'halt', label: 'Halt Sys', icon: <Power size={12} /> },
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => onCommand(btn.label)}
                            className="flex items-center gap-2 p-2 bg-gray-900/50 border border-gray-800 rounded-lg hover:bg-blue-600/10 hover:border-blue-500/30 transition-all text-[10px] font-bold text-gray-400 hover:text-blue-400"
                        >
                            {btn.icon}
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Live User Map */}
            <div className="p-6 border-b border-gray-800 bg-[#161b22]/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="text-emerald-400" size={14} />
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Sessions</h3>
                    </div>
                    <span className="text-[10px] font-black text-emerald-500">{activeUsers.length}</span>
                </div>
                <div className="space-y-3">
                    {activeUsers.slice(0, 3).map(user => (
                        <div key={user.id} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[8px] font-black text-emerald-500 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                                    {user.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-300">{user.name}</span>
                                    <span className="text-[8px] text-gray-600 uppercase font-black">{user.entity} • {user.location}</span>
                                </div>
                            </div>
                            <MousePointer2 size={10} className="text-emerald-500/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. System Trace (Footer Section) */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3 bg-[#161b22]/30">
                    <Terminal size={14} className="text-blue-400" />
                    <h2 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Trace Stream</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[9px] text-gray-500 custom-scrollbar">
                    {logs.slice(0, 20).map(log => (
                        <div key={log.id} className="flex gap-2">
                            <span className="opacity-30">[{log.time}]</span>
                            <span className={log.type === 'error' ? 'text-red-500' : log.type === 'warn' ? 'text-amber-500' : 'text-blue-400/70'}>
                                {log.msg}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CommandCenterSidebar;
