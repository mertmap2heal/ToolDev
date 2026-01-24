import { useState } from 'react'
import { Plus, Copy, CheckSquare } from 'lucide-react'
import { MOCK_TEMPLATES } from '../../data/mockSafety'

export default function LibrariesPage() {
  const [createModal, setCreateModal] = useState(false)
  const [cloneModal, setCloneModal] = useState<string | null>(null)
  const [applyModal, setApplyModal] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Libraries</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Templates only. Create / Clone / Apply are UI stubs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t.name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {t.type}
              </span>
            </div>
            {t.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t.description}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCloneModal(t.id)}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <Copy size={14} /> Clone
              </button>
              <button
                onClick={() => setApplyModal(t.id)}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <CheckSquare size={14} /> Apply
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setCreateModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
      >
        <Plus size={16} /> Create template
      </button>

      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Create template (placeholder)</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">UI stub.</p>
            <button onClick={() => setCreateModal(false)} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Close</button>
          </div>
        </div>
      )}
      {cloneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Clone template (placeholder)</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">UI stub.</p>
            <button onClick={() => setCloneModal(null)} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Close</button>
          </div>
        </div>
      )}
      {applyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Apply template (placeholder)</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">UI stub.</p>
            <button onClick={() => setApplyModal(null)} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
