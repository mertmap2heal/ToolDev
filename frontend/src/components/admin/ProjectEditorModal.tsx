import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { AdminProject, AdminUser } from '../../types/admin.types'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface ProjectEditorModalProps {
  project: AdminProject | null
  users: AdminUser[]
  onClose: () => void
  onSave: (name: string, members: string[], aiEnabled: boolean) => Promise<void>
}

export default function ProjectEditorModal({
  project,
  users,
  onClose,
  onSave,
}: ProjectEditorModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, true, () => onDiscardRef.current?.())
  const [name, setName] = useState(project?.name ?? '')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(project?.members ?? [])
  const [aiEnabled, setAiEnabled] = useState<boolean>(project?.aiEnabled ?? false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setName('')
    setSelectedMemberIds([])
    setAiEnabled(false)
    setSaveError(null)
  }

  useEffect(() => {
    setName(project?.name ?? '')
    setSelectedMemberIds(project?.members ?? [])
    setAiEnabled(project?.aiEnabled ?? false)
    setSaveError(null)
  }, [project])

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(name.trim(), selectedMemberIds, aiEnabled)
      setSaveError(null)
      resetDirty()
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setSaveError(null)
    guardClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {project ? 'Edit Project' : 'Create Project'}
          </h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Project name"
            />
          </div>
          <div>
            <label className="flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 cursor-pointer">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => { setAiEnabled(e.target.checked); markDirty() }}
                className="mt-0.5 rounded text-blue-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">AI features for this project</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Enables AI drafting, review, and impact analysis. Every AI action is logged with
                  provenance and is advisory only — humans sign off. Global admin env
                  <code className="mx-1 px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[11px]">FEATURES_AI_ENABLED</code>
                  must also be on.
                </p>
              </div>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Members
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
                      checked={selectedMemberIds.includes(u.id)}
                      onChange={() => toggleMember(u.id)}
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
        </div>
        {saveError && (
          <div className="px-6 py-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <p className="text-sm text-red-700 dark:text-red-300">{saveError}</p>
            <button
              type="button"
              onClick={() => setSaveError(null)}
              className="shrink-0 text-sm font-medium text-red-700 dark:text-red-300 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
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
