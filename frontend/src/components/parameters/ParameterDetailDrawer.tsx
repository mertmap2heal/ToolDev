import { X, Edit2, FileText, History, Link2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import type { Parameter } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface ParameterDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  parameter: Parameter | null
  onEdit: (parameter: Parameter) => void
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
}: ParameterDetailDrawerProps) {
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
            </h3>
            {versionsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No version history.</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Version</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Changed by</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {versions.map((v) => (
                      <tr key={v.id} className="bg-white dark:bg-gray-800">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{v.version}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          {format(new Date(v.createdAt), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          {v.createdBy?.name ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                          {snapshotSummary(v.snapshot)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
