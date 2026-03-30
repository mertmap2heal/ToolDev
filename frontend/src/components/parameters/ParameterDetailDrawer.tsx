import { useState } from 'react'
import { X, Edit2, FileText, History, Link2, FunctionSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import { evaluateFormula } from './evaluateFormula'
import type { Parameter } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface ParameterDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  parameter: Parameter | null
  onEdit: (parameter: Parameter) => void
  /** Full parameter list for resolving {{param:ID}} formula references */
  allParameters?: Parameter[]
}

// Human-readable labels for snapshot fields
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  defaultValue: 'Value',
  unit: 'Unit',
  tolerance: 'Tolerance',
  minValue: 'Min',
  maxValue: 'Max',
  status: 'Status',
  formula: 'Formula',
  dataType: 'Data type',
  tags: 'Tags',
}

// Fields to compare between versions (ordered for display)
const TRACKED_FIELDS = ['name', 'description', 'defaultValue', 'unit', 'tolerance', 'minValue', 'maxValue', 'status', 'formula', 'dataType', 'tags']

interface FieldDiff {
  field: string
  label: string
  prev: string
  next: string
}

function computeDiff(prev: Record<string, unknown> | null, next: Record<string, unknown>): FieldDiff[] {
  const diffs: FieldDiff[] = []
  for (const field of TRACKED_FIELDS) {
    const prevVal = prev != null ? String(prev[field] ?? '') : ''
    const nextVal = String(next[field] ?? '')
    if (prevVal !== nextVal) {
      diffs.push({ field, label: FIELD_LABELS[field] ?? field, prev: prevVal, next: nextVal })
    }
  }
  return diffs
}

function snapshotSummary(snapshot: Record<string, unknown>): string {
  const parts: string[] = []
  if (snapshot.defaultValue != null && snapshot.defaultValue !== '') parts.push('Value')
  if (snapshot.unit != null && snapshot.unit !== '') parts.push('Unit')
  if (snapshot.tolerance != null && snapshot.tolerance !== '') parts.push('Tolerance')
  if (snapshot.minValue != null || snapshot.maxValue != null) parts.push('Range')
  if (snapshot.status != null && snapshot.status !== '') parts.push('Status')
  if (snapshot.name != null && snapshot.name !== '') parts.push('Name')
  if (snapshot.description != null && snapshot.description !== '') parts.push('Description')
  return parts.length ? parts.join(', ') : 'Initial version'
}

export default function ParameterDetailDrawer({
  isOpen,
  onClose,
  projectId,
  parameter,
  onEdit,
  allParameters = [],
}: ParameterDetailDrawerProps) {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)

  const { data: impact, isLoading: impactLoading } = useQuery({
    queryKey: ['parameter-impact', projectId, parameter?.id],
    queryFn: async () => {
      if (!projectId || !parameter?.id) return null
      const res = await parameterService.getImpact(projectId, parameter.id)
      return res.success && res.data ? res.data : null
    },
    enabled: isOpen && !!projectId && !!parameter?.id,
  })

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['parameter-versions', projectId, parameter?.id],
    queryFn: async () => {
      if (!projectId || !parameter?.id) return []
      const res = await parameterService.getVersions(projectId, parameter.id)
      return res.success && res.data ? res.data : []
    },
    enabled: isOpen && !!projectId && !!parameter?.id,
  })

  if (!isOpen) return null
  if (!parameter) return null

  const requirements = impact?.requirements ?? []

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" aria-hidden onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Parameter details"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">
            {parameter.parameterId || parameter.name}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onEdit(parameter)
                onClose()
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              title="Edit parameter"
            >
              <Edit2 size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Summary */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Summary
            </h3>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Name</span>
                <p className="font-medium text-gray-900 dark:text-white">{parameter.name}</p>
              </div>
              {parameter.parameterId && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Parameter ID</span>
                  <p className="font-medium text-gray-900 dark:text-white">{parameter.parameterId}</p>
                </div>
              )}
              {parameter.description && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Description</span>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{parameter.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {parameter.dataType && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Data type</span>
                    <p className="text-gray-900 dark:text-white">{parameter.dataType}</p>
                  </div>
                )}
                {parameter.defaultValue != null && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Default value</span>
                    <p className="text-gray-900 dark:text-white">{parameter.defaultValue}</p>
                  </div>
                )}
                {parameter.unit && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Unit</span>
                    <p className="text-gray-900 dark:text-white">{parameter.unit}</p>
                  </div>
                )}
                {parameter.tolerance && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Tolerance</span>
                    <p className="text-gray-900 dark:text-white">{parameter.tolerance}</p>
                  </div>
                )}
                {(parameter.minValue != null || parameter.maxValue != null) && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Range</span>
                    <p className="text-gray-900 dark:text-white">
                      {parameter.minValue ?? '—'} … {parameter.maxValue ?? '—'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    (parameter.status ?? 'draft') === 'approved' && 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
                    (parameter.status ?? 'draft') === 'obsolete' && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                    (parameter.status ?? 'draft') === 'draft' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                  )}
                >
                  {parameter.status ?? 'draft'}
                </span>
              </div>
              {parameter.sourceFunction && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Source function</span>
                  <p className="text-gray-900 dark:text-white">
                    {parameter.sourceFunction.functionId || 'N/A'}: {parameter.sourceFunction.name}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Formula */}
          {parameter.formula && (() => {
            const paramValues = allParameters.reduce<Record<string, number>>((acc, p) => {
              const v = parseFloat(p.defaultValue ?? '')
              if (!isNaN(v)) acc[p.id] = v
              return acc
            }, {})
            const { result, error, usedParamIds } = evaluateFormula(parameter.formula, paramValues)
            const referencedParams = usedParamIds
              .map(id => allParameters.find(p => p.id === id))
              .filter((p): p is Parameter => p !== undefined)

            // Build human-readable formula (replace {{param:ID}} with parameter names)
            let humanFormula = parameter.formula
            for (const p of referencedParams) {
              humanFormula = humanFormula.replace(
                new RegExp(`\\{\\{param:${p.id}\\}\\}`, 'gi'),
                `[${p.name}]`
              )
            }

            return (
              <section>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <FunctionSquare size={16} />
                  Formula
                </h3>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">Expression</span>
                    <p className="font-mono text-gray-900 dark:text-white break-all mt-0.5">{humanFormula}</p>
                  </div>

                  {error ? (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                      <span className="font-medium">Cannot evaluate:</span>
                      <span>{error}</span>
                    </div>
                  ) : result !== null ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 text-xs">Result</span>
                      <span className="font-mono font-semibold text-green-700 dark:text-green-400">= {result}</span>
                    </div>
                  ) : null}

                  {referencedParams.length > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1.5">Referenced parameters</span>
                      <div className="flex flex-wrap gap-1.5">
                        {referencedParams.map(p => (
                          <span
                            key={p.id}
                            className="px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono"
                            title={p.defaultValue ? `default: ${p.defaultValue}` : 'no default value'}
                          >
                            {p.name}
                            {p.defaultValue ? ` = ${p.defaultValue}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )
          })()}

          {/* Linked requirements */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Link2 size={16} />
              Linked requirements ({requirements.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Parameter values are referenced in requirements; updates apply everywhere the parameter is used.
            </p>
            {impactLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : requirements.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No requirements reference this parameter.</p>
            ) : (
              <ul className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                {requirements.map((req) => (
                  <li key={req.id}>
                    <Link
                      to={`/projects/${projectId}/requirements?requirementId=${req.id}`}
                      className="block px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm text-gray-900 dark:text-white"
                    >
                      <span className="font-medium">{req.requirementId || req.id.slice(0, 8)}</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400 truncate block" title={req.title ?? ''}>
                        {req.title || 'Untitled'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Change history */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <History size={16} />
              Change history
              {versions.length > 0 && (
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500 font-normal">
                  ({versions.length} version{versions.length !== 1 ? 's' : ''})
                </span>
              )}
            </h3>
            {versionsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No version history yet.</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
                {versions.map((v, idx) => {
                  const prevSnapshot = idx < versions.length - 1 ? (versions[idx + 1].snapshot as Record<string, unknown>) : null
                  const diffs = computeDiff(prevSnapshot, v.snapshot as Record<string, unknown>)
                  const isExpanded = expandedVersionId === v.id
                  const summary = snapshotSummary(v.snapshot as Record<string, unknown>)

                  return (
                    <div key={v.id} className="bg-white dark:bg-gray-800">
                      {/* Version row — clickable header */}
                      <button
                        type="button"
                        onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {isExpanded
                          ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                          : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                        }
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-14 flex-shrink-0">
                          v{v.version}.{String((v as unknown as Record<string, unknown>).minorVersion ?? 0)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {format(new Date(v.createdAt), 'MMM d, yyyy HH:mm')}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 mx-1">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {v.createdBy?.name ?? 'Unknown'}
                        </span>
                        <span className="flex-1 text-right text-xs text-gray-400 dark:text-gray-500 truncate ml-2">
                          {diffs.length > 0
                            ? diffs.map(d => d.label).join(', ')
                            : summary
                          }
                        </span>
                      </button>

                      {/* Expanded diff panel */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
                          {diffs.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic pl-6">
                              {idx === versions.length - 1 ? 'Initial version — no previous version to compare.' : 'No tracked field changes detected.'}
                            </p>
                          ) : (
                            <div className="space-y-2 pl-6">
                              {diffs.map(diff => (
                                <div key={diff.field} className="text-xs">
                                  <span className="font-medium text-gray-700 dark:text-gray-300">{diff.label}</span>
                                  <div className="mt-0.5 flex items-start gap-2 flex-wrap">
                                    {diff.prev !== '' ? (
                                      <span className="inline-block px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through font-mono text-xs max-w-[200px] truncate" title={diff.prev}>
                                        {diff.prev}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500 italic">—</span>
                                    )}
                                    <span className="text-gray-400">→</span>
                                    {diff.next !== '' ? (
                                      <span className="inline-block px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-mono text-xs max-w-[200px] truncate" title={diff.next}>
                                        {diff.next}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 dark:text-gray-500 italic">—</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
