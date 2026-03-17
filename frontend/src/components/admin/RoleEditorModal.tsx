import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { AdminUser, Role } from '../../types/admin.types'
import type { PermissionMap } from '../../types/admin.types'
import PermissionMatrix from './PermissionMatrix'

interface RoleEditorModalProps {
  role: Role | null
  users: AdminUser[]
  onClose: () => void
  onSave: (name: string, defaultPermissions: PermissionMap, selectedUserIds?: string[]) => Promise<void>
}

export default function RoleEditorModal({ role, users, onClose, onSave }: RoleEditorModalProps) {
  const [name, setName] = useState(role?.name ?? '')
  const [permissions, setPermissions] = useState<PermissionMap>(role?.defaultPermissions ?? {})
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(role?.name ?? '')
    setPermissions(role?.defaultPermissions ?? {})
    if (role) {
      setSelectedUserIds(users.filter((u) => u.roles.includes(role.id)).map((u) => u.id))
    } else {
      setSelectedUserIds([])
    }
  }, [role, users])

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim(), permissions, role ? selectedUserIds : undefined)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {role ? 'Edit Role' : 'Create Role'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Role name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default permissions
            </label>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </div>
          {role && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Users with this role
              </label>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-gray-50 dark:bg-gray-900/50">
                {users.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No users available.</p>
                ) : (
                  users.map((u) => (
                    <label
                      key={u.id}
                      className="inline-flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer text-gray-900 dark:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm font-medium">{u.username}</span>
                      {u.name && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">({u.name})</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
