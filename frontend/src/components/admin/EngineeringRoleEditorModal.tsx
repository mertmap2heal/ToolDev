import { useEffect, useState, useRef } from 'react'
import { X, Search } from 'lucide-react'
import type { EngineeringRole, AdminUser } from '../../types/admin.types'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface EngineeringRoleEditorModalProps {
    role: EngineeringRole | null // null = create mode
    users: AdminUser[]
    initialAssignedUserIds: string[]
    onClose: () => void
    onSave: (data: {
        name: string
        description: string
        selectedUserIds: string[]
    }) => Promise<void>
}

export default function EngineeringRoleEditorModal({
    role,
    users,
    initialAssignedUserIds,
    onClose,
    onSave,
}: EngineeringRoleEditorModalProps) {
    const onDiscardRef = useRef<() => void>()
    const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, true, () => onDiscardRef.current?.())
    const guardCloseRef = useRef(guardClose)
    guardCloseRef.current = guardClose
    const [name, setName] = useState(role?.name ?? '')
    const [description, setDescription] = useState(role?.description ?? '')
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
        new Set(initialAssignedUserIds)
    )
    const [userSearch, setUserSearch] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    onDiscardRef.current = () => {
        setName('')
        setDescription('')
        setSelectedUserIds(new Set())
        setUserSearch('')
        setError('')
    }

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') guardCloseRef.current()
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [])

    const filteredUsers = users.filter((u) => {
        if (!userSearch) return true
        const q = userSearch.toLowerCase()
        return (
            (u.name ?? '').toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q)
        )
    })

    const toggleUser = (id: string) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        const trimmed = name.trim()
        if (!trimmed) {
            setError('Role name is required')
            return
        }
        setSaving(true)
        try {
            await onSave({
                name: trimmed,
                description: description.trim(),
                selectedUserIds: Array.from(selectedUserIds),
            })
            resetDirty()
            onClose()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save role')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={guardClose} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {role ? 'Edit Engineering Role' : 'Create Engineering Role'}
                    </h2>
                    <div className="flex items-center gap-2">
                        {draftBanner}
                        <button
                            type="button"
                            onClick={guardClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        {error && (
                            <div className="px-3 py-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                {error}
                            </div>
                        )}

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Role Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); markDirty() }}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="e.g. Flight Test Engineer"
                                autoFocus
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                placeholder="Optional description of the role"
                            />
                        </div>

                        {/* User Assignment */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Assign Users ({selectedUserIds.size} selected)
                            </label>
                            <div className="relative mb-2">
                                <Search
                                    size={14}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                />
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Search users..."
                                />
                            </div>
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
                                {filteredUsers.length === 0 ? (
                                    <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                        No users found
                                    </p>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <label
                                            key={u.id}
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedUserIds.has(u.id)}
                                                onChange={() => toggleUser(u.id)}
                                                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm text-gray-900 dark:text-white truncate">
                                                    {u.name || u.username}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    {u.username}
                                                </p>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={guardClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                        >
                            {saving ? 'Saving...' : role ? 'Update Role' : 'Create Role'}
                        </button>
                    </div>
                </form>
            </div>
            {warningDialog}
        </div>
    )
}
