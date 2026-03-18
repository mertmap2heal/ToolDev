import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Check, X, Info } from 'lucide-react'
import { parameterTypeService } from '../../services/parameterType.service'
import type { ParameterType, ParameterTypeTranslations } from 'shared/types/engineering.types'

interface Props {
  projectId: string
}

const TRANSLATION_KEYS: { key: keyof ParameterTypeTranslations; label: string }[] = [
  { key: 'c_header', label: 'C/C++' },
  { key: 'matlab',   label: 'MATLAB' },
  { key: 'python',   label: 'Python' },
  { key: 'ada',      label: 'Ada' },
  { key: 'simulink', label: 'Simulink' },
  { key: 'ros',      label: 'ROS' },
  { key: 'dds',      label: 'DDS/IDL' },
  { key: 'autosar',  label: 'AUTOSAR' },
  { key: 'xtce',     label: 'XTCE' },
]

const PRESET_COLORS = [
  '#0ea5e9','#0284c7','#7dd3fc',
  '#22c55e','#16a34a','#86efac',
  '#f59e0b','#d97706','#fcd34d',
  '#a78bfa','#f472b6','#818cf8',
  '#94a3b8','#64748b','#f87171',
]

interface TypeFormState {
  name: string
  description: string
  color: string
  translations: Record<string, string>
}

const EMPTY_FORM: TypeFormState = {
  name: '', description: '', color: '#0ea5e9',
  translations: Object.fromEntries(TRANSLATION_KEYS.map(k => [k.key, ''])),
}

function TypeForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: TypeFormState
  onSubmit: (data: TypeFormState) => void
  onCancel: () => void
  submitLabel: string
}) {
  const [form, setForm] = useState<TypeFormState>(initial)
  const [showTranslations, setShowTranslations] = useState(
    Object.values(initial.translations).some(v => v.trim())
  )

  const set = (field: keyof TypeFormState, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const setTranslation = (key: string, value: string) =>
    setForm(f => ({ ...f, translations: { ...f.translations, [key]: value } }))

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {/* Color picker */}
        <div className="flex-shrink-0">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Color</label>
          <div className="relative">
            <input
              type="color"
              value={form.color}
              onChange={e => set('color', e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5 bg-white dark:bg-gray-700"
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5 w-9">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className={`w-3 h-3 rounded-full border-2 transition-transform hover:scale-125 ${
                  form.color === c ? 'border-gray-800 dark:border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., RotationMatrix, Q15_Fixed"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Short description"
            />
          </div>
        </div>
      </div>

      {/* Translations (collapsible) */}
      <button
        type="button"
        onClick={() => setShowTranslations(s => !s)}
        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        <Info className="w-3.5 h-3.5" />
        {showTranslations ? 'Hide' : 'Add'} cross-language translations
      </button>

      {showTranslations && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pl-1">
          {TRANSLATION_KEYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 w-16 flex-shrink-0">{label}</span>
              <input
                type="text"
                value={form.translations[key] ?? ''}
                onChange={e => setTranslation(key, e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="type name"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={!form.name.trim()}
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

export function ParameterTypesPanel({ projectId }: Props) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['parameter-types', projectId],
    queryFn: () => parameterTypeService.getTypes(projectId).then(r => r.data ?? []),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['parameter-types', projectId] })

  const createMutation = useMutation({
    mutationFn: (form: TypeFormState) => parameterTypeService.createType(projectId, {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color || undefined,
      translations: Object.fromEntries(
        Object.entries(form.translations).filter(([, v]) => v.trim())
      ),
    }),
    onSuccess: () => { invalidate(); setAdding(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: TypeFormState }) =>
      parameterTypeService.updateType(projectId, id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color || undefined,
        translations: Object.fromEntries(
          Object.entries(form.translations).filter(([, v]) => v.trim())
        ),
      }),
    onSuccess: () => { invalidate(); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => parameterTypeService.deleteType(projectId, id),
    onSuccess: () => invalidate(),
  })

  const types = data ?? []
  const builtIns = types.filter(t => t.builtIn)
  const custom = types.filter(t => !t.builtIn)

  const typeToForm = (t: ParameterType): TypeFormState => ({
    name: t.name,
    description: t.description ?? '',
    color: t.color ?? '#0ea5e9',
    translations: Object.fromEntries(
      TRANSLATION_KEYS.map(k => [k.key, (t.translations as Record<string, string> | null | undefined)?.[k.key] ?? ''])
    ),
  })

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading types…</div>
  }

  return (
    <div className="space-y-4">
      {/* Custom types */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Project types</h4>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add type
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-3 p-3 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <TypeForm
              initial={EMPTY_FORM}
              onSubmit={form => createMutation.mutate(form)}
              onCancel={() => setAdding(false)}
              submitLabel="Create"
            />
          </div>
        )}

        {custom.length === 0 && !adding ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No custom types yet. Click "Add type" to define project-specific types.
          </p>
        ) : (
          <div className="space-y-1">
            {custom.map(t => (
              <div key={t.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {editingId === t.id ? (
                  <div className="p-3">
                    <TypeForm
                      initial={typeToForm(t)}
                      onSubmit={form => updateMutation.mutate({ id: t.id, form })}
                      onCancel={() => setEditingId(null)}
                      submitLabel="Save"
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
                    onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  >
                    {t.color && (
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    )}
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{t.name}</span>
                    {t.description && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-40">{t.description}</span>
                    )}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setEditingId(t.id) }}
                      className="p-1 text-gray-400 hover:text-blue-500 rounded transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate(t.id) }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Expanded translations */}
                {expandedId === t.id && !editingId && t.translations && (
                  <div className="px-3 pb-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-2">
                      {TRANSLATION_KEYS.map(({ key, label }) => {
                        const val = (t.translations as Record<string, string> | null | undefined)?.[key]
                        if (!val || val === 'N/A') return null
                        return (
                          <div key={key} className="flex gap-2 text-xs">
                            <span className="text-gray-400 w-16 flex-shrink-0">{label}</span>
                            <span className="font-mono text-gray-600 dark:text-gray-300">{val}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Built-in types (read-only, collapsible) */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold text-gray-500 dark:text-gray-400 list-none flex items-center gap-1 select-none">
          <span className="group-open:rotate-90 transition-transform inline-block">›</span>
          Standard built-in types ({builtIns.length})
        </summary>
        <div className="mt-2 space-y-0.5">
          {builtIns.map(t => (
            <details key={t.id} className="group/type">
              <summary className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 list-none select-none">
                {t.color && (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{t.name}</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500">▾</span>
              </summary>
              <div className="pl-7 pb-2">
                {t.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t.description}</p>
                )}
                {t.translations && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {TRANSLATION_KEYS.map(({ key, label }) => {
                      const val = (t.translations as Record<string, string> | null | undefined)?.[key]
                      if (!val || val === 'N/A') return null
                      return (
                        <div key={key} className="flex gap-2 text-xs">
                          <span className="text-gray-400 w-16 flex-shrink-0">{label}</span>
                          <span className="font-mono text-gray-600 dark:text-gray-300">{val}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </details>
    </div>
  )
}
