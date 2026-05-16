import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronDown,
    Upload,
    Download,
    FileCode,
    Printer,
    Wrench
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
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
