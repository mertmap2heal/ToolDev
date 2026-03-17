import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import CreateParameterModal from './CreateParameterModal'
import type { Parameter } from 'shared/types/engineering.types'

interface ParameterPickerModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onSelect: (parameter: { id: string; name: string }) => void
}

export default function ParameterPickerModal({
  isOpen,
  onClose,
  projectId,
  onSelect,
}: ParameterPickerModalProps) {
  const [search, setSearch] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const { data: parameters = [], isLoading } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const res = await parameterService.getParameters(projectId)
      if (res.success && res.data) return res.data
      return []
    },
    enabled: isOpen && !!projectId,
  })

  const filtered = search.trim()
    ? parameters.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : parameters

  useEffect(() => {
    if (!isOpen) setSearch('')
  }, [isOpen])

  const handleSelect = (p: Parameter) => {
    onSelect({ id: p.id, name: p.name })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Insert parameter</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parameters..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          {projectId && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Plus size={16} />
              Create new parameter
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {isLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 p-4">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 p-4">
              {parameters.length === 0 ? 'No parameters in this project. Create one using the button above or from the Parameters page.' : 'No parameters match your search.'}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white flex flex-col gap-0.5"
                  >
                    <span className="font-medium">{p.name}</span>
                    {(p.defaultValue != null || p.unit) && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {p.defaultValue ?? '—'} {p.unit ?? ''}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {projectId && createModalOpen && createPortal(
        <CreateParameterModal
          isOpen={true}
          onClose={() => setCreateModalOpen(false)}
          projectId={projectId}
          overlayClassName="z-[101]"
          onCreated={(param) => {
            onSelect({ id: param.id, name: param.name })
            setCreateModalOpen(false)
            onClose()
          }}
        />,
        document.body
      )}
    </div>
  )
}
