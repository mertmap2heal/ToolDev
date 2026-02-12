import { useState } from 'react'
import { X, Edit2, Trash2, Paperclip, ChevronRight, ChevronDown, Link2, FileText, Check, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { changeRequestService } from '../../services/changeRequest.service'
import type { ChangeRequest, ChangeRequestAttachment } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface ChangeRequestDetailDrawerProps {
    isOpen: boolean
    changeRequest: ChangeRequest | null
    projectId: string
    onClose: () => void
    onEdit: (cr: ChangeRequest) => void
    onDelete: (cr: ChangeRequest) => void
}

export default function ChangeRequestDetailDrawer({
    isOpen,
    changeRequest,
    projectId,
    onClose,
    onEdit,
    onDelete,
}: ChangeRequestDetailDrawerProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'links' | 'activity'>('overview')
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'details']))

    const queryClient = useQueryClient()

    const { data: fullChangeRequest } = useQuery({
        queryKey: ['changeRequest', projectId, changeRequest?.id],
        queryFn: async () => {
            if (!changeRequest || !projectId) return null
            const response = await changeRequestService.getChangeRequest(projectId, changeRequest.id)
            return response.success && response.data ? response.data : null
        },
        enabled: isOpen && !!changeRequest && !!projectId,
    })

    const { data: attachments = [] } = useQuery({
        queryKey: ['change-request-attachments', projectId, changeRequest?.id],
        queryFn: async () => {
            if (!projectId || !changeRequest?.id) return []
            const response = await changeRequestService.getAttachments(projectId, changeRequest.id)
            return response.success && response.data ? response.data : []
        },
        enabled: isOpen && !!projectId && !!changeRequest?.id,
    })

    const displayCR = fullChangeRequest || changeRequest

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(section)) {
                newSet.delete(section)
            } else {
                newSet.add(section)
            }
            return newSet
        })
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical':
                return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            case 'high':
                return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
            case 'medium':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
            case 'low':
                return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            case 'rejected':
                return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            case 'in-review':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    if (!isOpen) return null

    return (
        <div
            className={clsx(
                'flex flex-col transition-all duration-300 ease-in-out overflow-hidden h-[calc(100%-1rem)] m-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm w-[32rem] flex-shrink-0'
            )}
        >
            {/* Header */}
            <div className="flex-none px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {displayCR?.crId || 'NEW'}
                        </span>
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium capitalize', getStatusColor(displayCR?.status || 'pending'))}>
                            {displayCR?.status || 'Pending'}
                        </span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={displayCR?.title}>
                        {displayCR?.title || 'No Title'}
                    </h2>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => displayCR && onEdit(displayCR)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Edit Change Request"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        onClick={() => displayCR && onDelete(displayCR)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete Change Request"
                    >
                        <Trash2 size={18} />
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-none px-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex space-x-1">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={clsx(
                            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                            activeTab === 'overview'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        )}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('links')}
                        className={clsx(
                            'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                            activeTab === 'links'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        )}
                    >
                        Attachments & Links
                        {attachments.length > 0 && (
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full text-xs">
                                {attachments.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                {activeTab === 'overview' && displayCR && (
                    <>
                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Priority</label>
                                <div className="flex items-center">
                                    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium capitalize', getPriorityColor(displayCR.priority))}>
                                        {displayCR.priority}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Owner</label>
                                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-medium">
                                        {(displayCR.owner || displayCR.requestedBy || '?')[0].toUpperCase()}
                                    </div>
                                    {displayCR.owner || 'Unassigned'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Requested By</label>
                                <div className="text-sm text-gray-900 dark:text-white">
                                    {displayCR.requestedBy || 'Unknown'}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Source Type</label>
                                <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1 capitalize">
                                    <Link2 size={12} className="text-blue-500" />
                                    {displayCR.sourceType}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <button
                                onClick={() => toggleSection('details')}
                                className="flex items-center gap-2 w-full text-left font-medium text-gray-900 dark:text-white mb-2"
                            >
                                {expandedSections.has('details') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                Detailed Analysis
                            </button>

                            {expandedSections.has('details') && (
                                <div className="pl-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <div>
                                            <span className="text-xs text-gray-500">Risk Assessment</span>
                                            <p className={clsx("text-sm font-medium mt-1 capitalize",
                                                displayCR.risk === 'critical' || displayCR.risk === 'high' ? 'text-red-600' : 'text-gray-900 dark:text-white'
                                            )}>
                                                {displayCR.risk || 'Not Assessed'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-gray-500">Estimated Effort</span>
                                            <p className="text-sm font-medium mt-1 capitalize text-gray-900 dark:text-white">
                                                {displayCR.effort || 'Not Estimated'}
                                            </p>
                                        </div>
                                    </div>

                                    {displayCR.justification && (
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Business Justification</label>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-800/30 p-2 rounded border border-gray-100 dark:border-gray-700">
                                                {displayCR.justification}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <button
                                onClick={() => toggleSection('description')}
                                className="flex items-center gap-2 w-full text-left font-medium text-gray-900 dark:text-white mb-2"
                            >
                                {expandedSections.has('description') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                Description & Requested Change
                            </button>
                            {expandedSections.has('description') && (
                                <div className="pl-6 text-sm text-gray-600 dark:text-gray-300 prose dark:prose-invert max-w-none">
                                    {displayCR.description ? (
                                        <div className="whitespace-pre-wrap">{displayCR.description}</div>
                                    ) : (
                                        <span className="text-gray-400 italic">No description provided</span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Target Item</h3>
                                <a href="#" className="hidden text-xs text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 flex items-center gap-0.5">
                                    View Source <Link2 size={10} />
                                </a>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start gap-3">
                                <div className="p-2 bg-white dark:bg-gray-800 rounded shadow-sm">
                                    <FileText size={18} className="text-blue-500" />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase font-semibold">{displayCR.sourceType}</div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{displayCR.sourceId}</div>
                                    {/* Note: We would need to fetch the source item title to show it here */}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'links' && displayCR && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Paperclip size={16} /> Attachments
                            </h3>
                            {attachments.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                                    <p className="text-sm text-gray-500">No attachments found</p>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {attachments.map((file: any) => (
                                        <li key={file.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400">
                                                    <FileText size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{file.fileName}</p>
                                                    <p className="text-xs text-gray-500">{format(new Date(file.createdAt), 'MMM d, yyyy')}</p>
                                                </div>
                                            </div>
                                            <a
                                                href={file.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                                Download
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Meta */}
            {displayCR && (
                <div className="flex-none px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <span>Created {format(new Date(displayCR.createdAt), 'MMM d, yyyy HH:mm')}</span>
                        <span>Last updated {format(new Date(displayCR.updatedAt), 'MMM d, HH:mm')}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
