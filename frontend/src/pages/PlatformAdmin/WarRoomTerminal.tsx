import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, ChevronDown, ChevronUp, Radio } from 'lucide-react';

interface LogEntry {
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    data?: any;
}

interface WarRoomTerminalProps {
    logs: LogEntry[];
    onClear: () => void;
    isOpen: boolean;
    onToggle: () => void;
}

const WarRoomTerminal: React.FC<WarRoomTerminalProps> = ({ logs, onClear, isOpen, onToggle }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'ERROR': return 'text-red-400';
            case 'WARN': return 'text-yellow-400';
            case 'DEBUG': return 'text-blue-400';
            default: return 'text-emerald-400';
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={onToggle}
                className="fixed bottom-6 right-6 z-50 p-4 bg-gray-900/90 border border-purple-500/30 rounded-full shadow-2xl hover:bg-purple-900/40 transition-all group animate-pulse"
            >
                <Terminal className="text-purple-400 group-hover:scale-110 transition-transform" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-0 right-0 w-[450px] h-[600px] z-[100] bg-gray-950/95 border-l border-t border-purple-500/20 shadow-2xl flex flex-col font-mono text-xs overflow-hidden backdrop-blur-xl translate-y-0 transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-purple-500/20 bg-gray-900/50">
                <div className="flex items-center gap-2 text-purple-400">
                    <Radio size={14} className="animate-pulse" />
                    <span className="font-black uppercase tracking-widest">Live War Room Terminal</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`transition-colors ${autoScroll ? 'text-emerald-400' : 'text-gray-500'}`}
                    >
                        {autoScroll ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                    <button onClick={onClear} className="text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                    </button>
                    <button onClick={onToggle} className="text-gray-500 hover:text-white transition-colors">
                        [X]
                    </button>
                </div>
            </div>

            {/* Log Content */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-1 selection:bg-purple-500/30"
            >
                {logs.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2 opacity-50">
                        <Terminal size={32} />
                        <p className="animate-pulse">Awaiting system events...</p>
                    </div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="group border-l-2 border-transparent hover:border-purple-500/40 pl-2 transition-colors">
                        <div className="flex items-start gap-2">
                            <span className="text-gray-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <span className={`font-bold shrink-0 ${getLevelColor(log.level)}`}>{log.level}</span>
                            <span className="text-gray-300 break-words">{log.message}</span>
                        </div>
                        {log.data && (
                            <pre className="mt-1 ml-16 text-[10px] text-gray-500 bg-gray-900/50 p-2 rounded border border-gray-800 hidden group-hover:block overflow-x-auto">
                                {JSON.stringify(log.data, null, 2)}
                            </pre>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-purple-500/10 bg-gray-900/30 flex justify-between text-[10px] text-gray-600 uppercase font-black tracking-tighter">
                <span>Channel: ADMIN_LOGS</span>
                <span>Events: {logs.length}</span>
            </div>
        </div>
    );
};

export default WarRoomTerminal;
