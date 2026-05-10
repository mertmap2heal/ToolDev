/**
 * Type-aware form fields shared between CreateParameterModal and EditParameterModal.
 * Renders different controls based on the detected type category.
 * Validates values in real-time against the type's format definition.
 */
import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, Settings, Ruler, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import UnitPicker from './UnitPicker'
import { TypeCombobox } from './TypeCombobox'
import { validateParameterValue } from './validateParameterValue'
import { evaluateFormula, detectCycles, extractParamRefs, FORMULA_CONSTANTS } from './evaluateFormula'
import { parameterTypeService } from '../../services/parameterType.service'
import { projectUnitService } from '../../services/projectUnit.service'
import type { Parameter, ParameterValueFormat } from 'shared/types/engineering.types'

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
  /** Called when user wants to open the unit management panel */
  onManageUnits?: () => void
  /** External validation error for value field (e.g. from form submit attempt) */
  valueError?: string | null
  /**
   * The current formula string ({{param:ID}} syntax). When provided together
   * with allParameters, a live evaluation preview is shown below the form.
   */
  formula?: string
  /**
   * Full list of parameters in the project. Used to resolve {{param:ID}}
   * references in the formula preview and to display referenced parameter names.
   */
  allParameters?: Parameter[]
  /** ID of the parameter being edited — used for cycle detection in formula preview */
  currentParamId?: string
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

function parseTolerance(raw: string): { pos: string; neg: string } {
  const m = raw.match(/^\+([^/]+)\/-(.+)$/)
  if (m) return { pos: m[1], neg: m[2] }
  return { pos: raw.replace(/^[+-]/, ''), neg: raw.replace(/^[+-]/, '') }
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
        <span>Member name</span>
        <span>Value</span>
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

// ── value format hint box ──────────────────────────────────────────────────

function FormatHint({ fmt }: { fmt: ParameterValueFormat }) {
  if (!fmt.hint && !fmt.template && !fmt.example) return null
  return (
    <div className="flex gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs">
      <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
      <div className="space-y-0.5 min-w-0">
        {fmt.hint && <p className="text-blue-700 dark:text-blue-300">{fmt.hint}</p>}
        {fmt.template && (
          <p className="text-gray-500 dark:text-gray-400">
            Template: <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">{fmt.template}</code>
          </p>
        )}
        {fmt.example && (
          <p className="text-gray-500 dark:text-gray-400">
            Example: <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">{fmt.example}</code>
          </p>
        )}
      </div>
    </div>
  )
}

// ── formula live preview ───────────────────────────────────────────────────

function FormulaPreview({
  formula,
  allParameters,
  currentParamId,
}: {
  formula: string
  allParameters: Parameter[]
  currentParamId?: string
}) {
  const paramValues = allParameters.reduce<Record<string, number>>((acc, p) => {
    const v = parseFloat(p.defaultValue ?? '')
    if (!isNaN(v)) acc[p.id] = v
    return acc
  }, {})

  const { result, error, usedParamIds } = evaluateFormula(formula, paramValues)

  const referencedParams = usedParamIds
    .map(id => allParameters.find(p => p.id === id))
    .filter((p): p is Parameter => p !== undefined)

  // Cycle detection: build a temporary param list with the current formula applied
  const cycleWarnings = (() => {
    const refs = extractParamRefs(formula)
    if (refs.length === 0) return []
    // Build snapshot: replace or add the current param's formula
    const snapshot = allParameters.map(p =>
      p.id === currentParamId ? { ...p, formula } : p
    )
    // If editing a new parameter (no ID yet), add a synthetic entry
    if (currentParamId && !allParameters.some(p => p.id === currentParamId)) {
      snapshot.push({ id: currentParamId, formula } as Parameter)
    }
    return detectCycles(snapshot)
  })()

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${cycleWarnings.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700'}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Formula preview</p>

      {/* Cycle warning — shown above eval result */}
      {cycleWarnings.length > 0 && (
        <div className="space-y-1">
          {cycleWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-red-700 dark:text-red-400">
                <strong>Circular dependency:</strong> {w}
              </span>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">{error}</span>
        </div>
      ) : result !== null && cycleWarnings.length === 0 ? (
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          <span className="text-xs font-mono font-semibold text-green-700 dark:text-green-400">
            = {result}
          </span>
        </div>
      ) : null}

      {referencedParams.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {referencedParams.map(p => (
            <span
              key={p.id}
              className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono"
              title={p.defaultValue ? `value: ${p.defaultValue}` : 'no default value'}
            >
              {p.name}
            </span>
          ))}
        </div>
      )}

      {/* Named constants cheatsheet */}
      <details className="pt-0.5">
        <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer select-none hover:text-gray-600 dark:hover:text-gray-300">
          Available constants
        </summary>
        <div className="flex flex-wrap gap-1 pt-1">
          {Object.entries(FORMULA_CONSTANTS).map(([name, value]) => (
            <span
              key={name}
              className="px-1.5 py-0.5 rounded text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-mono border border-amber-200 dark:border-amber-700"
              title={String(value)}
            >
              {name} = {value < 1e-3 || value > 1e6 ? value.toExponential(3) : value}
            </span>
          ))}
        </div>
      </details>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'
const INPUT_ERR_CLS = 'w-full px-4 py-2 border border-red-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm'
const LABEL_CLS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left'

export function ParameterFormFields({ projectId, values, onChange, onManageTypes, onManageUnits, valueError, formula, allParameters, currentParamId }: Props) {
  const [valueValidationError, setValueValidationError] = useState<string | null>(null)

  // Fetch type definitions to get valueFormat for the current type
  const { data: types } = useQuery({
    queryKey: ['parameter-types', projectId],
    queryFn: () => parameterTypeService.getTypes(projectId).then(r => r.data ?? []),
    staleTime: 30_000,
  })

  // Fetch project-specific units
  const { data: projectUnitData } = useQuery({
    queryKey: ['project-units', projectId],
    queryFn: () => projectUnitService.getUnits(projectId).then(r => r.data ?? []),
    staleTime: 30_000,
  })

  const projectUnits = (projectUnitData ?? []).map(u => ({
    id: u.id,
    symbol: u.symbol,
    name: u.name,
    category: u.category ?? null,
  }))

  const matchedType = types?.find(t => t.name === values.dataType)
  const valueFormat = matchedType?.valueFormat ?? null

  const category = detectCategory(values.dataType)
  const { pos: tolPos, neg: tolNeg } = parseTolerance(values.tolerance)

  const enumEntries = parseEnumValues(values.enumValues)
  const enumDefaultOptions = enumEntries.filter(e => e.name.trim())

  const showUnit = category === 'numeric' || category === 'vector' || category === 'other'
  const showTolerance = category === 'numeric' || category === 'other'
  const showMinMax = category === 'numeric' || category === 'vector' || category === 'other'
  const showEnum = category === 'enum'
  const showDimensions = category === 'vector'

  // Real-time value validation (debounced via useEffect)
  useEffect(() => {
    if (!values.defaultValue) {
      setValueValidationError(null)
      return
    }
    const timer = setTimeout(() => {
      const err = validateParameterValue(
        values.defaultValue,
        values.dataType,
        values.enumValues,
        values.dimensions,
        valueFormat
      )
      setValueValidationError(err)
    }, 300)
    return () => clearTimeout(timer)
  }, [values.defaultValue, values.dataType, values.enumValues, values.dimensions, valueFormat])

  const displayValueError = valueError ?? valueValidationError

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
            {category === 'numeric' && 'Numeric — value, min/max, tolerance and unit shown below.'}
            {category === 'boolean' && 'Boolean — only true/false values apply.'}
            {category === 'string' && 'String — numeric constraints are hidden.'}
            {category === 'enum' && 'Enum — define members below and pick the default.'}
            {category === 'vector' && 'Vector/matrix — specify dimensions and unit below.'}
          </p>
        )}
      </div>

      {/* Default Value */}
      <div>
        <label className={LABEL_CLS}>Value / Default</label>
        {category === 'boolean' ? (
          <select
            aria-label="Default value"
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
            aria-label="Default value"
            value={values.defaultValue}
            onChange={e => onChange('defaultValue', e.target.value)}
            className={displayValueError ? INPUT_ERR_CLS : INPUT_CLS}
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
            className={displayValueError ? INPUT_ERR_CLS : INPUT_CLS}
            placeholder={category === 'enum' ? 'Define members below first' : valueFormat?.example ? `e.g. ${valueFormat.example}` : 'Enter default value'}
          />
        )}
        {displayValueError && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400">{displayValueError}</p>
          </div>
        )}
        {/* Format hint box */}
        {valueFormat && !displayValueError && (
          <div className="mt-1.5">
            <FormatHint fmt={valueFormat} />
          </div>
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
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL_CLS.replace(' mb-2', '')}>Unit</label>
            {onManageUnits && (
              <button
                type="button"
                onClick={onManageUnits}
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Ruler className="w-3 h-3" />
                Manage units
              </button>
            )}
          </div>
          <UnitPicker
            value={values.unit}
            onChange={v => onChange('unit', v)}
            projectUnits={projectUnits}
          />
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

      {/* Formula live preview */}
      {formula && allParameters && <FormulaPreview formula={formula} allParameters={allParameters} currentParamId={currentParamId} />}
    </div>
  )
}

/**
 * Run value validation imperatively (for use in form submit handlers).
 * Returns an error string or null.
 */
export function runValueValidation(
  values: Pick<ParameterFormValues, 'defaultValue' | 'dataType' | 'enumValues' | 'dimensions'>,
  valueFormat?: ParameterValueFormat | null
): string | null {
  return validateParameterValue(
    values.defaultValue,
    values.dataType,
    values.enumValues,
    values.dimensions,
    valueFormat
  )
}

/**
 * Validate a formula string before saving.
 * Returns an error message string, or null if valid (or empty).
 */
export function runFormulaValidation(
  formula: string,
  allParameters: Parameter[],
  currentParamId?: string
): string | null {
  if (!formula.trim()) return null

  // Build param value map
  const paramValues: Record<string, number> = {}
  for (const p of allParameters) {
    const v = parseFloat(p.defaultValue ?? '')
    if (!isNaN(v)) paramValues[p.id] = v
  }

  const { error } = evaluateFormula(formula, paramValues)
  if (error && !error.includes('Unknown parameter')) {
    // Unknown parameter references are OK at save time (they may be created later)
    return `Formula error: ${error}`
  }

  // Check cycle detection
  const snapshot = allParameters.map(p =>
    p.id === currentParamId ? { ...p, formula } : p
  )
  if (currentParamId && !allParameters.some(p => p.id === currentParamId)) {
    snapshot.push({ id: currentParamId, formula } as Parameter)
  }
  const cycles = detectCycles(snapshot)
  if (cycles.length > 0) {
    return `Circular dependency detected: ${cycles[0]}`
  }

  return null
}
