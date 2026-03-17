import { X, FileText, FolderTree, Settings, ExternalLink, History } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { parameterService } from '../../services/parameter.service'
import type { Parameter } from 'shared/types/engineering.types'

interface ParameterDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  parameter: Parameter
  projectId?: string
}

export default function ParameterDetailsModal({
  isOpen,
  onClose,
  parameter,
  projectId,
}: ParameterDetailsModalProps) {
  const { data: impact, isLoading: impactLoading } = useQuery({
    queryKey: ['parameter-impact', projectId, parameter.id],
    queryFn: () => (projectId ? parameterService.getImpact(projectId, parameter.id) : null),
    enabled: isOpen && !!projectId && !!parameter.id,
  })
  const { data: versionsData } = useQuery({
    queryKey: ['parameter-versions', projectId, parameter.id],
    queryFn: () => (projectId ? parameterService.getVersions(projectId, parameter.id) : null),
    enabled: isOpen && !!projectId && !!parameter.id,
  })

  const impactData = impact?.success && impact?.data ? impact.data : null
  const versions = (versionsData?.success && versionsData?.data ? versionsData.data : []) as Array<{ id: string; version: number; snapshot: Record<string, unknown>; createdAt: string }>

  if (!isOpen || !parameter) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Parameter: {parameter.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Parameter Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Parameter Name
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <span className="text-gray-900 dark:text-white font-medium">{parameter.name}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Description
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[60px]">
              <span className="text-gray-900 dark:text-white">
                {parameter.description || <span className="text-gray-400 dark:text-gray-500">No description</span>}
              </span>
            </div>
          </div>

          {/* Data Type, Value, Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Data Type</label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <span className="text-gray-900 dark:text-white">{parameter.dataType || '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Default Value</label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <span className="text-gray-900 dark:text-white">{parameter.defaultValue || '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Unit</label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <span className="text-gray-900 dark:text-white">{parameter.unit || '—'}</span>
              </div>
            </div>
          </div>

          {/* Status / Version */}
          {(parameter.status != null || parameter.version != null) && (
            <div className="flex gap-4">
              {parameter.status != null && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">Status</label>
                  <span className="text-sm text-gray-900 dark:text-white">{parameter.status}</span>
                </div>
              )}
              {parameter.version != null && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">Version</label>
                  <span className="text-sm text-gray-900 dark:text-white">{parameter.version}</span>
                </div>
              )}
            </div>
          )}

          {/* Derived from (source parameter) */}
          {parameter.sourceParameter && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Derived from
              </label>
              <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <span className="text-amber-800 dark:text-amber-200">{parameter.sourceParameter.name}</span>
              </div>
            </div>
          )}

          {/* Formula */}
          {parameter.formula && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Formula
              </label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm">
                <span className="text-gray-900 dark:text-white">{parameter.formula}</span>
              </div>
            </div>
          )}

          {/* Source Function */}
          {parameter.sourceFunction && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Source Function
              </label>
              <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <span className="text-blue-700 dark:text-blue-300">
                  {parameter.sourceFunction.functionId || 'N/A'}: {parameter.sourceFunction.name}
                </span>
              </div>
            </div>
          )}

          {/* Impact / Linked items */}
          {projectId && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Impact &amp; links</h3>
              {impactLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
              ) : impactData ? (
                <div className="space-y-3">
                  {impactData.requirements.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <FileText size={12} /> Requirements ({impactData.requirements.length})
                      </span>
                      <ul className="mt-1 space-y-1">
                        {impactData.requirements.slice(0, 10).map((r) => (
                          <li key={r.id}>
                            <Link
                              to={`/projects/${projectId}/requirements?requirementId=${r.id}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              onClick={onClose}
                            >
                              {r.requirementId || r.id.slice(0, 8)} — {r.title?.slice(0, 50)}{r.title && r.title.length > 50 ? '…' : ''}
                              <ExternalLink size={12} />
                            </Link>
                          </li>
                        ))}
                        {impactData.requirements.length > 10 && (
                          <li className="text-xs text-gray-500 dark:text-gray-400">+{impactData.requirements.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {impactData.components.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <FolderTree size={12} /> PBS Components ({impactData.components.length})
                      </span>
                      <ul className="mt-1 space-y-1">
                        {impactData.components.map((c) => (
                          <li key={c.id}>
                            <Link
                              to={`/projects/${projectId}/product-breakdown-structure`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              onClick={onClose}
                            >
                              {c.name}
                              <ExternalLink size={12} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {impactData.functions.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Settings size={12} /> Functions ({impactData.functions.length})
                      </span>
                      <ul className="mt-1 space-y-1">
                        {impactData.functions.map((f) => (
                          <li key={f.id}>
                            <Link
                              to={`/projects/${projectId}/functions?selectedId=${f.id}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              onClick={onClose}
                            >
                              {f.functionId || f.id.slice(0, 8)} — {f.name}
                              <ExternalLink size={12} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {impactData.requirements.length === 0 && impactData.components.length === 0 && impactData.functions.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No linked requirements, components, or functions.</p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Version history */}
          {projectId && versions.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <History size={14} /> Version history
              </h3>
              <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {versions.slice(0, 20).map((v) => (
                  <li key={v.id} className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between gap-2 py-1 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                    <span>v{v.version}</span>
                    <span>{format(new Date(v.createdAt), 'PPp')}</span>
                    {v.snapshot && typeof v.snapshot === 'object' && 'defaultValue' in v.snapshot && (
                      <span className="truncate max-w-[120px]" title={JSON.stringify(v.snapshot)}>
                        value: {String((v.snapshot as Record<string, unknown>).defaultValue ?? '—')}
                      </span>
                    )}
                  </li>
                ))}
                {versions.length > 20 && <li className="text-xs text-gray-500">+{versions.length - 20} more</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
