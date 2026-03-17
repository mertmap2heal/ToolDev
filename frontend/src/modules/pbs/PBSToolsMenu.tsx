import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronDown,
    Link,
    GitMerge,
    Scale,
    ShieldAlert,
    Save,
    Clock,
    Upload,
    Download,
    FileCode,
    Printer,
    FileText,
    Wrench,
    Settings,
    FolderTree
} from 'lucide-react';
import clsx from 'clsx';

interface PBSToolsMenuProps {
    onExportCSV: () => void;
    onExportJSON: () => void;
    onImport: () => void;
    onPrint: () => void;
    hasNodes: boolean;
}

export default function PBSToolsMenu({
    onExportCSV,
    onExportJSON,
    onImport,
    onPrint,
    hasNodes,
}: PBSToolsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                    isOpen
                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300"
                        : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                )}
            >
                <Wrench size={16} />
                Tools & Engineering
                <ChevronDown size={14} className={clsx("transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden text-left origin-top-right animate-in fade-in slide-in-from-top-2 duration-200">

                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {/* Systems Engineering Group */}
                        <div className="py-2">
                            <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Systems Engineering
                            </div>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                                onClick={() => handleAction(() => alert('Traceability Matrix module coming soon.'))}
                            >
                                <Link size={16} className="text-blue-500" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Traceability Matrix</span>
                                    <span className="text-xs text-gray-500">Requirements & Functions</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-colors"
                                onClick={() => handleAction(() => alert('Interface Control Documents coming soon.'))}
                            >
                                <GitMerge size={16} className="text-indigo-500" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Interface Control (ICD)</span>
                                    <span className="text-xs text-gray-500">Manage internal/external interfaces</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 transition-colors"
                                onClick={() => handleAction(() => alert('Mass & Power Rollup coming soon.'))}
                            >
                                <Scale size={16} className="text-amber-500" />
                                <div className="flex flex-col">
                                    <span className="font-medium">Resource Budgets</span>
                                    <span className="text-xs text-gray-500">Mass, Power, Cost Rollup</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                                onClick={() => handleAction(() => alert('FMECA / Risk Analysis coming soon.'))}
                            >
                                <ShieldAlert size={16} className="text-red-500" />
                                <div className="flex flex-col">
                                    <span className="font-medium">FMECA / Risk Analysis</span>
                                    <span className="text-xs text-gray-500">Failure modes & criticality</span>
                                </div>
                            </button>
                        </div>

                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-3" />

                        {/* Configuration Management */}
                        <div className="py-2">
                            <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Config Management
                            </div>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors"
                                onClick={() => handleAction(() => alert('Baseline creation coming soon.'))}
                            >
                                <Save size={16} className="text-emerald-600" />
                                <span>Create Baseline Snapshot</span>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => handleAction(() => alert('Revision history coming soon.'))}
                            >
                                <Clock size={16} />
                                <span>View Change History</span>
                            </button>
                        </div>

                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-3" />

                        {/* Import / Export */}
                        <div className="py-2">
                            <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Data Exchange
                            </div>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => handleAction(onImport)}
                            >
                                <Upload size={16} className="text-gray-500" />
                                <span>Import Data...</span>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => handleAction(onExportCSV)}
                            >
                                <Download size={16} className="text-gray-500" />
                                <span>Export to CSV</span>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                onClick={() => handleAction(onExportJSON)}
                            >
                                <FileCode size={16} className="text-gray-500" />
                                <span>Export to JSON</span>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 transition-colors"
                                onClick={() => handleAction(() => alert('SysML Export coming soon.'))}
                            >
                                <Settings size={16} className="text-purple-500" />
                                <span>Export to SysML (v2)</span>
                            </button>
                        </div>

                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-3" />

                        {/* Reporting */}
                        <div className="py-2">
                            <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Reporting
                            </div>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!hasNodes}
                                onClick={() => handleAction(onPrint)}
                            >
                                <Printer size={16} className="text-gray-500" />
                                <span>Print Structure</span>
                            </button>
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-900/20 dark:hover:text-teal-400 transition-colors"
                                onClick={() => handleAction(() => alert('Specification generation coming soon.'))}
                            >
                                <FileText size={16} className="text-teal-500" />
                                <span>Generate Spec Document</span>
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
