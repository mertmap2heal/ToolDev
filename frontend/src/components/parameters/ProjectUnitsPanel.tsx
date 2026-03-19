import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { projectUnitService } from '../../services/projectUnit.service'
import type { ProjectUnit } from 'shared/types/engineering.types'

interface Props {
  projectId: string
}

const COMMON_CATEGORIES = ['length', 'mass', 'time', 'temperature', 'angle', 'velocity', 'pressure', 'frequency', 'voltage', 'current', 'force', 'energy', 'custom']

interface UnitFormState {
  name: string
  symbol: string
  description: string
  category: string
}

const EMPTY_FORM: UnitFormState = { name: '', symbol: '', description: '', category: '' }

function UnitForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: UnitFormState
  onSubmit: (data: UnitFormState) => void
  onCancel: () => void
  submitLabel: string
}) {
  const [form, setForm] = useState<UnitFormState>(initial)
  const set = (field: keyof UnitFormState, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Symbol *</label>
          <input
            type="text"
            value={form.symbol}
            onChange={e => set('symbol', e.target.value)}
            className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. psi, RPM"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. pounds per square inch"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
        <input
          type="text"
          list="unit-categories"
          value={form.category}
          onChange={e => set('category', e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="pressure, length, custom…"
        />
        <datalist id="unit-categories">
          {COMMON_CATEGORIES.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={e => set('description', e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Short description or SI equivalent"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={!form.name.trim() || !form.symbol.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  )
}

export function ProjectUnitsPanel({ projectId }: Props) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['project-units', projectId],
    queryFn: () => projectUnitService.getUnits(projectId).then(r => r.data ?? []),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['project-units', projectId] })

  const createMutation = useMutation({
    mutationFn: (form: UnitFormState) => projectUnitService.createUnit(projectId, {
      name: form.name.trim(),
      symbol: form.symbol.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
    }),
    onSuccess: () => { invalidate(); setAdding(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: UnitFormState }) =>
      projectUnitService.updateUnit(projectId, id, {
        name: form.name.trim(),
        symbol: form.symbol.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
      }),
    onSuccess: () => { invalidate(); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectUnitService.deleteUnit(projectId, id),
    onSuccess: () => invalidate(),
  })

  const unitToForm = (u: ProjectUnit): UnitFormState => ({
    name: u.name,
    symbol: u.symbol,
    description: u.description ?? '',
    category: u.category ?? '',
  })

  const units = data ?? []

  // Group by category
  const grouped = units.reduce<Record<string, ProjectUnit[]>>((acc, u) => {
    const cat = u.category || 'uncategorized'
    ;(acc[cat] = acc[cat] ?? []).push(u)
    return acc
  }, {})

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading units…</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Project units</h4>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Add unit
          </button>
        )}
      </div>

      {adding && (
        <div className="p-3 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/30">
          <UnitForm
            initial={EMPTY_FORM}
            onSubmit={form => createMutation.mutate(form)}
            onCancel={() => setAdding(false)}
            submitLabel="Create"
          />
        </div>
      )}

      {units.length === 0 && !adding ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No custom units yet. Click "Add unit" to define project-specific units.
        </p>
      ) : (
        Object.entries(grouped).map(([cat, catUnits]) => (
          <div key={cat}>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1 px-1">
              {cat}
            </div>
            <div className="space-y-0.5">
              {catUnits.map(u => (
                <div key={u.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {editingId === u.id ? (
                    <div className="p-3">
                      <UnitForm
                        initial={unitToForm(u)}
                        onSubmit={form => updateMutation.mutate({ id: u.id, form })}
                        onCancel={() => setEditingId(null)}
                        submitLabel="Save"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200 w-14 flex-shrink-0">{u.symbol}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex-1 truncate">{u.name}</span>
                      {u.description && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-28 hidden sm:block">{u.description}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingId(u.id)}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(u.id)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
