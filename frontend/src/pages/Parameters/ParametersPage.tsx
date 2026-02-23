import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Search, X, Trash2, Edit2, Plus, Filter, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import { parameterService } from '../../services/parameter.service'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import EditParameterModal from '../../components/parameters/EditParameterModal'
import SourceDetailsModal from '../../components/parameters/SourceDetailsModal'
import CreateParameterModal from '../../components/parameters/CreateParameterModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import type { Parameter } from 'shared/types/engineering.types'
import clsx from 'clsx'
import { format } from 'date-fns'

export default function ParametersPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null)
  const [editingParameter, setEditingParameter] = useState<Parameter | null>(null)
  const [viewingSource, setViewingSource] = useState<Parameter | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [changeRequestModal, setChangeRequestModal] = useState<{ isOpen: boolean; sourceId: string; sourceName: string } | null>(null)
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('all')
  const [unitFilter, setUnitFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: parameters = [], isLoading } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await parameterService.getParameters(projectId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load parameters')
    },
    enabled: !!projectId,
  })

  const deleteParameterMutation = useMutation({
    mutationFn: (parameterId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.deleteParameter(projectId, parameterId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete parameter error:', error)
      alert(error?.error || 'Failed to delete parameter')
      setDeleteConfirmation(null)
    },
  })

  const filteredParameters = parameters.filter((param) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        param.name.toLowerCase().includes(query) ||
        param.description?.toLowerCase().includes(query) ||
        param.dataType?.toLowerCase().includes(query) ||
        param.sourceFunction?.name.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // Data Type filter
    if (dataTypeFilter !== 'all') {
      if (dataTypeFilter === 'unassigned' && param.dataType) {
        return false
      }
      if (dataTypeFilter !== 'unassigned' && param.dataType !== dataTypeFilter) {
        return false
      }
    }

    // Unit filter
    if (unitFilter !== 'all') {
      if (unitFilter === 'unassigned' && param.unit) {
        return false
      }
      if (unitFilter !== 'unassigned' && param.unit !== unitFilter) {
        return false
      }
    }

    // Source filter
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'unassigned' && param.sourceFunction) {
        return false
      }
      if (sourceFilter === 'has-source' && !param.sourceFunction) {
        return false
      }
    }

    // Status filter
    if (statusFilter !== 'all' && (param.status ?? 'draft') !== statusFilter) {
      return false
    }

    return true
  })

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    setDeleteConfirmation({ id, name })
  }

  const handleEditClick = (e: React.MouseEvent, parameter: Parameter) => {
    e.stopPropagation()
    setEditingParameter(parameter)
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      deleteParameterMutation.mutate(deleteConfirmation.id)
    }
  }

  return (
    <div className="space-y-6">


      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Parameters</h2>
        <div className="flex items-center gap-3">
          {projectId && <SafetyLinkPanel variant="relevance" count={1} />}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
          >
            <Plus size={16} />
            <span>Create a new parameter</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search parameters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          {isFiltersExpanded ? (
            <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
        {isFiltersExpanded && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Data Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Data Type
                </label>
                <select
                  value={dataTypeFilter}
                  onChange={(e) => setDataTypeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Data Types</option>
                  <option value="unassigned">Unassigned</option>
                  {Array.from(new Set(parameters.map((p) => p.dataType).filter(Boolean))).map((dataType) => (
                    <option key={dataType} value={dataType}>
                      {dataType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Unit
                </label>
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Units</option>
                  <option value="unassigned">Unassigned</option>
                  {Array.from(new Set(parameters.map((p) => p.unit).filter(Boolean))).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Sources</option>
                  <option value="has-source">Has Source</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="obsolete">Obsolete</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Message */}
      {parameters.length === 0 && !isLoading && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Tip:</strong> Parameters are automatically extracted when you use the pattern <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">@parameterName@</code> in function descriptions.
          </p>
        </div>
      )}

      {/* Parameters Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Parameter Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Default Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading parameters...
                  </td>
                </tr>
              ) : filteredParameters.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {parameters.length === 0
                      ? 'No parameters found. Use @parameterName@ in function descriptions to automatically create parameters.'
                      : 'No parameters match your search or filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredParameters.map((param) => (
                  <tr
                    key={param.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">{param.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                      <p className="truncate" title={param.description || ''}>
                        {param.description || <span className="text-gray-400 dark:text-gray-500">—</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {param.dataType || <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {param.defaultValue || <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {param.unit || <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {param.sourceFunction ? (
                        <button
                          type="button"
                          onClick={() => setViewingSource(param)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                        >
                          {param.sourceFunction.functionId || 'N/A'}: {param.sourceFunction.name}
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        (param.status ?? 'draft') === 'approved' && 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
                        (param.status ?? 'draft') === 'obsolete' && 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
                        (param.status ?? 'draft') === 'draft' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                      )}>
                        {param.status ?? 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(param.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setChangeRequestModal({
                              isOpen: true,
                              sourceId: param.id,
                              sourceName: param.name,
                            })
                          }}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded text-green-600 dark:text-green-400"
                          title="Create Change Request"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={(e) => handleEditClick(e, param)}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400"
                          title="Edit parameter"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, param.id, param.name)}
                          disabled={deleteParameterMutation.isPending && deleteConfirmation?.id === param.id}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete parameter"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirmation && (
        <DeleteConfirmationModal
          isOpen={!!deleteConfirmation}
          itemName={deleteConfirmation.name}
          itemType="parameter"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isDeleting={deleteParameterMutation.isPending}
        />
      )}

      {projectId && (
        <>
          <EditParameterModal
            isOpen={!!editingParameter}
            onClose={() => setEditingParameter(null)}
            projectId={projectId}
            parameter={editingParameter}
          />
          <SourceDetailsModal
            isOpen={!!viewingSource}
            onClose={() => setViewingSource(null)}
            parameter={viewingSource}
          />
          <CreateParameterModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            projectId={projectId}
          />
          {changeRequestModal && projectId && (
            <CreateChangeRequestModal
              isOpen={changeRequestModal.isOpen}
              onClose={() => setChangeRequestModal(null)}
              projectId={projectId}
              sourceType="parameter"
              sourceId={changeRequestModal.sourceId}
              sourceName={changeRequestModal.sourceName}
            />
          )}
        </>
      )}
    </div>
  )
}
