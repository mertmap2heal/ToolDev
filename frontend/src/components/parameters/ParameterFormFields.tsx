/**
 * Type-aware form fields shared between CreateParameterModal and EditParameterModal.
 * Renders different controls based on the detected type category.
 */
import { useState, useCallback } from 'react'
import { Plus, Trash2, Settings } from 'lucide-react'
import UnitPicker from './UnitPicker'
import { TypeCombobox } from './TypeCombobox'

export interface ParameterFormValues {
  dataType: string
  defaultValue: string
  unit: string
  /** Stored as "+0.05/-0.02" (asymmetric) or "0.05" (symmetric) */
  tolerance: string
  minValue: string
  maxValue: string
  /** JSON-stringified [{name,value}] for enum types */
  enumValues: string
  /** Shape/size descriptor for vector/matrix types, e.g. "3x1" */
  dimensions: string
}

interface Props {
  projectId: string
  values: ParameterFormValues
  onChange: (field: keyof ParameterFormValues, value: string) => void
  /** Called when user wants to open the type management panel */
  onManageTypes?: () => void
}

// ── type category detection ────────────────────────────────────────────────

type TypeCategory = 'numeric' | 'boolean' | 'string' | 'enum' | 'vector' | 'other'

function detectCategory(dataType: string): TypeCategory {
  const t = dataType.trim().toLowerCase()
  if (!t) return 'other'
  if (/\benum\b/.test(t)) return 'enum'
  if (/\b(vector|matrix|array)\b/.test(t)) return 'vector'
  if (/\b(bool|boolean)\b/.test(t)) return 'boolean'
  if (/\b(string|str|char|text)\b/.test(t)) return 'string'
  if (/\b(float|double|int|uint|real|single|complex|fixed|q\d|s\d)\b/.test(t)) return 'numeric'
  return 'other'
}

// ── asymmetric tolerance helpers ───────────────────────────────────────────

function parseTolerance(raw: string): { pos: string; neg: string; symmetric: boolean } {
  const m = raw.match(/^\+([^/]+)\/-(.+)$/)
  if (m) return { pos: m[1], neg: m[2], symmetric: false }
  return { pos: raw.replace(/^[+-]/, ''), neg: raw.replace(/^[+-]/, ''), symmetric: true }
}

function formatTolerance(pos: string, neg: string): string {
  if (!pos && !neg) return ''
  if (pos === neg || !neg) return pos
  return `+${pos}/-${neg}`
}

// ── enum values editor ─────────────────────────────────────────────────────

interface EnumEntry { name: string; value: string }

function parseEnumValues(raw: string): EnumEntry[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as EnumEntry[]
  } catch { /* fall through */ }
  return []
}

function EnumEditor({
  raw,
  onChange,
}: {
  raw: string
  onChange: (val: string) => void
}) {
  const [entries, setEntries] = useState<EnumEntry[]>(() => parseEnumValues(raw) || [{ name: '', value: '' }])

  const commit = useCallback((next: EnumEntry[]) => {
    setEntries(next)
    onChange(JSON.stringify(next.filter(e => e.name.trim())))
  }, [onChange])

  const update = (idx: number, field: keyof EnumEntry, val: string) => {
    const next = entries.map((e, i) => i === idx ? { ...e, [field]: val } : e)
    commit(next)
  }

  const add = () => commit([...entries, { name: '', value: '' }])

  const remove = (idx: number) => {
    const next = entries.filter((_, i) => i !== idx)
    commit(next.length ? next : [{ name: '', value: '' }])
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-1">
        <span>Enum member name</span>
        <span>Numeric / string value</span>
        <span />
      </div>
      {entries.map((e, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <input
            type="text"
            value={e.name}
            onChange={ev => update(i, 'name', ev.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="IDLE"
          />
          <input
            type="text"
            value={e.value}
            onChange={ev => update(i, 'value', ev.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Add member
      </button>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'
const LABEL_CLS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left'

export function ParameterFormFields({ projectId, values, onChange, onManageTypes }: Props) {
  const category = detectCategory(values.dataType)
  const { pos: tolPos, neg: tolNeg } = parseTolerance(values.tolerance)

  const enumEntries = parseEnumValues(values.enumValues)
  const enumDefaultOptions = enumEntries.filter(e => e.name.trim())

  const showUnit = category === 'numeric' || category === 'vector' || category === 'other'
  const showTolerance = category === 'numeric' || category === 'other'
  const showMinMax = category === 'numeric' || category === 'vector' || category === 'other'
  const showEnum = category === 'enum'
  const showDimensions = category === 'vector'

  return (
    <div className="space-y-5">
      {/* Data Type */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={LABEL_CLS.replace(' mb-2', '')}>Data Type</label>
          {onManageTypes && (
            <button
              type="button"
              onClick={onManageTypes}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Settings className="w-3 h-3" />
              Manage types
            </button>
          )}
        </div>
        <TypeCombobox
          projectId={projectId}
          value={values.dataType}
          onChange={v => onChange('dataType', v)}
        />
        {category !== 'other' && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {category === 'numeric' && 'Numeric type — value, min/max, tolerance and unit fields are shown below.'}
            {category === 'boolean' && 'Boolean type — only true/false values apply.'}
            {category === 'string' && 'String type — numeric constraints are hidden.'}
            {category === 'enum' && 'Enum type — define members below and pick the default value.'}
            {category === 'vector' && 'Vector/matrix type — specify dimensions and unit below.'}
          </p>
        )}
      </div>

      {/* Default Value */}
      <div>
        <label className={LABEL_CLS}>Value / Default</label>
        {category === 'boolean' ? (
          <select
            value={values.defaultValue}
            onChange={e => onChange('defaultValue', e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">— not set —</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : category === 'enum' && enumDefaultOptions.length > 0 ? (
          <select
            value={values.defaultValue}
            onChange={e => onChange('defaultValue', e.target.value)}
            className={INPUT_CLS}
          >
            <option value="">— select default member —</option>
            {enumDefaultOptions.map(e => (
              <option key={e.name} value={e.name}>{e.name}{e.value ? ` (${e.value})` : ''}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={values.defaultValue}
            onChange={e => onChange('defaultValue', e.target.value)}
            className={INPUT_CLS}
            placeholder={category === 'enum' ? 'Define members below first' : 'Enter default value'}
          />
        )}
      </div>

      {/* Enum members editor */}
      {showEnum && (
        <div>
          <label className={LABEL_CLS}>Enum Members</label>
          <EnumEditor
            raw={values.enumValues}
            onChange={v => onChange('enumValues', v)}
          />
        </div>
      )}

      {/* Dimensions (vector/matrix) */}
      {showDimensions && (
        <div>
          <label className={LABEL_CLS}>Dimensions / Shape</label>
          <input
            type="text"
            value={values.dimensions}
            onChange={e => onChange('dimensions', e.target.value)}
            className={INPUT_CLS}
            placeholder="e.g., 3x1, 4x4, [3]"
          />
        </div>
      )}

      {/* Unit */}
      {showUnit && (
        <div>
          <label className={LABEL_CLS}>Unit</label>
          <UnitPicker value={values.unit} onChange={v => onChange('unit', v)} />
        </div>
      )}

      {/* Tolerance */}
      {showTolerance && (
        <div>
          <label className={LABEL_CLS}>Tolerance</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-green-600 dark:text-green-400 pointer-events-none select-none">+</span>
              <input
                type="number"
                value={tolPos}
                onChange={e => onChange('tolerance', formatTolerance(e.target.value, tolNeg))}
                className={`${INPUT_CLS} pl-7`}
                placeholder="upper (e.g. 0.05)"
                step="any"
                min="0"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-red-500 dark:text-red-400 pointer-events-none select-none">-</span>
              <input
                type="number"
                value={tolNeg}
                onChange={e => onChange('tolerance', formatTolerance(tolPos, e.target.value))}
                className={`${INPUT_CLS} pl-7`}
                placeholder="lower (e.g. 0.02)"
                step="any"
                min="0"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Leave both equal for symmetric tolerance. Asymmetric stores as +upper/-lower.
          </p>
        </div>
      )}

      {/* Min / Max */}
      {showMinMax && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>Min</label>
            <input
              type="text"
              value={values.minValue}
              onChange={e => onChange('minValue', e.target.value)}
              className={INPUT_CLS}
              placeholder="minimum"
            />
          </div>
          <div>
            <label className={LABEL_CLS}>Max</label>
            <input
              type="text"
              value={values.maxValue}
              onChange={e => onChange('maxValue', e.target.value)}
              className={INPUT_CLS}
              placeholder="maximum"
            />
          </div>
        </div>
      )}
    </div>
  )
}
