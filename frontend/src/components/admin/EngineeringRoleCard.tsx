import { useState } from 'react'
import { Shield, ChevronDown, ChevronUp, Pencil, Trash2, Users } from 'lucide-react'
import type { EngineeringRole } from '../../types/admin.types'

interface EngineeringRoleCardProps {
    role: EngineeringRole
    onEdit: (role: EngineeringRole) => void
    onDelete: (role: EngineeringRole) => void
}

export default function EngineeringRoleCard({ role, onEdit, onDelete }: EngineeringRoleCardProps) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 shadow-sm hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/30 dark:to-indigo-500/30 flex items-center justify-center">
                            <Shield size={18} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {role.name}
                            </h3>
                            {role.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                    {role.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => onEdit(role)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Edit role"
                        >
                            <Pencil size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(role)}
                            disabled={role.isSystem}
                            className={`p-1.5 rounded-lg transition-colors ${role.isSystem
                                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                    : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                }`}
                            title={role.isSystem ? 'System role cannot be deleted' : 'Delete role'}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* User Count Badge */}
                <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700/50 text-xs font-medium text-gray-600 dark:text-gray-300">
                        <Users size={12} />
                        <span>{role.userCount} user{role.userCount !== 1 ? 's' : ''}</span>
                    </div>
                    {role.isSystem && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            System
                        </span>
                    )}
                </div>
            </div>

            {/* Expandable User List */}
            {role.userCount > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700/50">
                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                        <span>{expanded ? 'Hide' : 'Show'} assigned users</span>
                        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {expanded && role.assignedUsers && (
                        <div className="px-4 pb-3 space-y-1.5">
                            {role.assignedUsers.map((u) => (
                                <div
                                    key={u.id}
                                    className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"
                                >
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <span className="truncate">{u.name || u.email}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
