import { useMemo, useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

/**
 * Top-bar pill filters for the Parameters page. Visual parity with
 * RequirementsPage top bar (plan Pillar 1). Primary filters always
 * visible; secondary filters revealed by the "More filters" toggle.
 *
 * The bar is purely presentational. Parent owns the state; the bar
 * receives current values + setters and surfaces active-count +
 * Clear-all. Aerospace-scale projects will feed `availableDataTypes`
 * / `availableUnits` from the `/parameters/:id/facets` endpoint so
 * the options don't depend on the in-memory parameter list.
 */
const PILL_BASE =
  'px-2.5 py-1.5 text-xs font-medium rounded-full border cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/40'
const PILL_ACTIVE =
  'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
const PILL_INACTIVE =
  'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'

interface FilterPillProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  active: boolean
}

function FilterPill({ label, value, options, onChange, active }: FilterPillProps) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(PILL_BASE, active ? PILL_ACTIVE : PILL_INACTIVE)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export interface ParameterFilterBarProps {
  statusFilter: string
  onStatusChange: (v: string) => void
  dataTypeFilter: string
  onDataTypeChange: (v: string) => void
  unitFilter: string
  onUnitChange: (v: string) => void
  sourceFilter: string
  onSourceChange: (v: string) => void
  availableDataTypes: string[]
  availableUnits: string[]
  onClearAll: () => void
}

export default function ParameterFilterBar({
  statusFilter,
  onStatusChange,
  dataTypeFilter,
  onDataTypeChange,
  unitFilter,
  onUnitChange,
  sourceFilter,
  onSourceChange,
  availableDataTypes,
  availableUnits,
  onClearAll,
}: ParameterFilterBarProps) {
  const [showMore, setShowMore] = useState(false)

  const activeCount = useMemo(() => {
    let n = 0
    if (statusFilter !== 'all') n++
    if (dataTypeFilter !== 'all') n++
    if (unitFilter !== 'all') n++
    if (sourceFilter !== 'all') n++
    return n
  }, [statusFilter, dataTypeFilter, unitFilter, sourceFilter])

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'approved', label: 'Approved' },
    { value: 'obsolete', label: 'Obsolete' },
  ]
  const dataTypeOptions = useMemo(
    () => [
      { value: 'all', label: 'All data types' },
      { value: 'unassigned', label: 'Unassigned' },
      ...availableDataTypes.map((v) => ({ value: v, label: v })),
    ],
    [availableDataTypes],
  )
  const unitOptions = useMemo(
    () => [
      { value: 'all', label: 'All units' },
      { value: 'unassigned', label: 'Unassigned' },
      ...availableUnits.map((v) => ({ value: v, label: v })),
    ],
    [availableUnits],
  )
  const sourceOptions = [
    { value: 'all', label: 'All sources' },
    { value: 'has-source', label: 'Has source' },
    { value: 'unassigned', label: 'Unassigned' },
  ]

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
      role="toolbar"
      aria-label="Parameter filters"
    >
      {/* Primary filters */}
      <FilterPill
        label="Status"
        value={statusFilter}
        options={statusOptions}
        onChange={onStatusChange}
        active={statusFilter !== 'all'}
      />
      <FilterPill
        label="Data type"
        value={dataTypeFilter}
        options={dataTypeOptions}
        onChange={onDataTypeChange}
        active={dataTypeFilter !== 'all'}
      />
      <FilterPill
        label="Unit"
        value={unitFilter}
        options={unitOptions}
        onChange={onUnitChange}
        active={unitFilter !== 'all'}
      />

      {/* More filters expander */}
      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className={clsx(
          'inline-flex items-center gap-1',
          PILL_BASE,
          showMore ? PILL_ACTIVE : PILL_INACTIVE,
        )}
      >
        {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showMore ? 'Fewer filters' : 'More filters'}
      </button>

      {showMore && (
        <FilterPill
          label="Source"
          value={sourceFilter}
          options={sourceOptions}
          onChange={onSourceChange}
          active={sourceFilter !== 'all'}
        />
      )}

      {/* Active-count badge + Clear all */}
      {activeCount > 0 && (
        <>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white">
            {activeCount} active
          </span>
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 hover:underline"
          >
            <X size={12} /> Clear all
          </button>
        </>
      )}
    </div>
  )
}
