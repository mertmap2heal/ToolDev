import React from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Info,
    Search,
    ShieldAlert,
    Zap,
    Focus,
    Wrench
} from 'lucide-react';

interface AuditFinding {
    id: string;
    nodeId: string;
    level: 'CRITICAL' | 'WARNING' | 'OPTIMIZATION';
    category: 'CIRCULAR' | 'PERFORMANCE' | 'GOVERNANCE';
    title: string;
    description: string;
    fixable: boolean;
}

interface ArchitectureAuditorProps {
    findings: AuditFinding[];
    isOpen: boolean;
    onClose: () => void;
    onFocusNode: (nodeId: string) => void;
}

const ArchitectureAuditor: React.FC<ArchitectureAuditorProps> = ({ findings, isOpen, onClose, onFocusNode }) => {
    if (!isOpen) return null;

    const stats = {
        critical: findings.filter(f => f.level === 'CRITICAL').length,
        warning: findings.filter(f => f.level === 'WARNING').length,
        optimization: findings.filter(f => f.level === 'OPTIMIZATION').length,
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'WARNING': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'CIRCULAR': return <AlertTriangle size={14} />;
            case 'PERFORMANCE': return <Zap size={14} />;
            case 'GOVERNANCE': return <ShieldAlert size={14} />;
            default: return <Info size={14} />;
        }
    };

    return (
        <div className="absolute top-20 right-84 w-96 max-h-[calc(100vh-120px)] bg-[#0d1117]/95 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl flex flex-col z-50 animate-in slide-in-from-right-8 fade-in h-fit overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 bg-[#161b22]/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg">
                        <Search className="text-purple-400" size={16} />
                    </div>
                    <h2 className="text-sm font-bold text-gray-100 tracking-tight">Architecture Auditor</h2>
                </div>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-white transition-colors"
                >
                    <CheckCircle size={18} />
                </button>
            </div>

            {/* Stats Mini Bar */}
            <div className="px-4 py-2 border-b border-gray-800 flex gap-4 text-[10px] font-black tracking-widest uppercase">
                <span className="text-red-500">{stats.critical} Critical</span>
                <span className="text-amber-500">{stats.warning} Warnings</span>
                <span className="text-blue-500">{stats.optimization} Optims</span>
            </div>

            {/* Findings List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {findings.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                        <CheckCircle className="text-emerald-500 mb-3" size={32} />
                        <p className="text-xs font-bold text-gray-200 uppercase tracking-widest">Platform Healthy</p>
                        <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">No structural risks or performance bottlenecks detected in current snapshot.</p>
                    </div>
                ) : (
                    findings.map((finding) => (
                        <div
                            key={finding.id}
                            className={`p-3 rounded-xl border transition-all hover:bg-white/[0.02] group ${getLevelColor(finding.level)}`}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {getCategoryIcon(finding.category)}
                                    <span className="text-[10px] font-black uppercase tracking-widest">{finding.category}</span>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onFocusNode(finding.nodeId)}
                                        className="p-1 rounded bg-black/20 hover:bg-black/40 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                        title="Focus Node"
                                    >
                                        <Focus size={12} />
                                    </button>
                                    {finding.fixable && (
                                        <button
                                            className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 hover:text-emerald-100 transition-all"
                                            title="Quick Fix"
                                        >
                                            <Wrench size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <h3 className="text-xs font-bold text-gray-100 mb-1">{finding.title}</h3>
                            <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                                {finding.description}
                            </p>
                            <div className="mt-2 text-[9px] font-mono opacity-50">
                                Target: {finding.nodeId}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-black/20 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Live Engine Scanning...</span>
                </div>
            </div>
        </div>
    );
};

export default ArchitectureAuditor;
