import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'

const DEFAULT_REQUIREMENT_TYPES = [
  'Functional',
  'Non-functional',
  'Performance',
  'Safety',
  'Interface',
  'Environmental',
  'Reliability',
  'Maintainability',
  'Security',
  'Usability',
]

interface CustomRequirementType {
  id: string
  typeName: string
  createdAt: string
}

interface RequirementTypesManagerProps {
  projectId: string
}

export default function RequirementTypesManager({ projectId }: RequirementTypesManagerProps) {
  const [newValue, setNewValue] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const queryClient = useQueryClient()

  const { data: customTypesRes, isLoading } = useQuery({
    queryKey: ['customRequirementTypes', projectId],
    queryFn: () => requirementService.getCustomRequirementTypes(projectId),
    enabled: !!projectId,
  })

  const customTypes: CustomRequirementType[] =
    customTypesRes?.success && customTypesRes.data
      ? (customTypesRes.data as CustomRequirementType[])
      : []

  const addMutation = useMutation({
    mutationFn: (typeName: string) => requirementService.addCustomRequirementType(projectId, typeName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customRequirementTypes', projectId] })
      setNewValue('')
      setShowAdd(false)
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to add requirement type')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (typeId: string) => requirementService.deleteCustomRequirementType(projectId, typeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customRequirementTypes', projectId] })
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to remove requirement type')
    },
  })

  const handleAdd = () => {
    const v = newValue.trim()
    if (!v) return
    addMutation.mutate(v)
  }

  type DisplayItem =
    | { id: string; typeName: string; isSystem: true }
    | { id: string; typeName: string; createdAt: string; isSystem: false }
  const customTypeNames = new Set(customTypes.map((t) => t.typeName.toLowerCase()))
  const systemItems: DisplayItem[] = DEFAULT_REQUIREMENT_TYPES.filter(
    (t) => !customTypeNames.has(t.toLowerCase())
  ).map((value) => ({ id: `system-${value}`, typeName: value, isSystem: true }))
  const customItems: DisplayItem[] = customTypes.map((t) => ({
    ...t,
    isSystem: false as const,
  }))
  const allTypes = [...systemItems, ...customItems].sort((a, b) =>
    a.typeName.localeCompare(b.typeName)
  )

  const handleRemove = (opt: DisplayItem) => {
    if (opt.isSystem) return
    const typeName = opt.typeName
    if (window.confirm(`Remove "${typeName}"? This will remove it from all dropdowns.`)) {
      removeMutation.mutate(opt.id)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Requirement Types
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Used when creating or editing requirements (e.g., Functional, Safety, Regulatory)
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-2 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add
          </button>
        )}
      </div>
      <div className="p-4 space-y-2">
        {showAdd && (
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') setShowAdd(false)
              }}
              placeholder="New requirement type"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newValue.trim() || addMutation.isPending}
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
            >
              {addMutation.isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false)
                setNewValue('')
              }}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : allTypes.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No options yet.</p>
        ) : (
          <ul className="space-y-1">
            {allTypes.map((opt) => (
              <li
                key={opt.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <span className="text-sm text-gray-900 dark:text-white">
                  {opt.typeName}
                  {opt.isSystem && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(system)</span>
                  )}
                </span>
                {!opt.isSystem && (
                  <button
                    type="button"
                    onClick={() => handleRemove(opt)}
                    disabled={removeMutation.isPending}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
