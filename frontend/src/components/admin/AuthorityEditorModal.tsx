import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Authority } from '../../types/admin.types'
import type { PermissionMap } from '../../types/admin.types'
import PermissionMatrix from './PermissionMatrix'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface AuthorityEditorModalProps {
  authority: Authority | null
  onClose: () => void
  onSave: (name: string, permissions: PermissionMap, opts?: { version?: string; deprecated?: boolean }) => Promise<void>
}

export default function AuthorityEditorModal({
  authority,
  onClose,
  onSave,
}: AuthorityEditorModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, true, () => onDiscardRef.current?.())
  const [name, setName] = useState(authority?.name ?? '')
  const [permissions, setPermissions] = useState<PermissionMap>(authority?.permissions ?? {})
  const [version, setVersion] = useState(authority?.version ?? '')
  const [deprecated, setDeprecated] = useState(authority?.deprecated ?? false)
  const [saving, setSaving] = useState(false)

  onDiscardRef.current = () => {
    setName('')
    setPermissions({})
    setVersion('')
    setDeprecated(false)
  }

  useEffect(() => {
    setName(authority?.name ?? '')
    setPermissions(authority?.permissions ?? {})
    setVersion(authority?.version ?? '')
    setDeprecated(authority?.deprecated ?? false)
  }, [authority])

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave(name.trim(), permissions, { version: version || undefined, deprecated })
      resetDirty()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {authority ? 'Edit Authority' : 'Create Authority'}
          </h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              type="button"
              onClick={guardClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Template name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Version (optional)
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                placeholder="1.0"
              />
            </div>
            <div className="flex items-center pt-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deprecated}
                  onChange={(e) => setDeprecated(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Deprecated</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permissions
            </label>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={guardClose}
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
      {warningDialog}
    </div>
  )
}
