import { X } from 'lucide-react'
import type { ChangeRequest } from '../../../shared/types/engineering.types'
import type { SystemFunction } from '../../../shared/types/engineering.types'
import type { Issue } from '../../../shared/types/engineering.types'
import type { Parameter } from '../../../shared/types/engineering.types'
import { format } from 'date-fns'

interface ChangeRequestDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  changeRequest: ChangeRequest | null
  sourceFunction?: SystemFunction | null
  sourceIssue?: Issue | null
  sourceParameter?: Parameter | null
}

export default function ChangeRequestDetailsModal({
  isOpen,
  onClose,
  changeRequest,
  sourceFunction,
  sourceIssue,
  sourceParameter,
}: ChangeRequestDetailsModalProps) {
  if (!isOpen || !changeRequest) return null

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'rejected':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'in-review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Change Request Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Change Request Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Change Request Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{changeRequest.title}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(changeRequest.status)}`}
                >
                  {changeRequest.status.charAt(0).toUpperCase() + changeRequest.status.slice(1).replace('-', ' ')}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(changeRequest.priority)}`}
                >
                  {changeRequest.priority.charAt(0).toUpperCase() + changeRequest.priority.slice(1)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source Type
                </label>
                <p className="text-sm text-gray-900 dark:text-white capitalize">{changeRequest.sourceType}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Requested By
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{changeRequest.requestedBy || '—'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Created
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {format(new Date(changeRequest.createdAt), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                {changeRequest.description}
              </p>
            </div>

          </div>

          {/* Source Item Information */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Related Source Item
            </h3>

            {changeRequest.sourceType === 'function' && sourceFunction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Function ID
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceFunction.functionId || 'N/A'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceFunction.name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceFunction.status || '—'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Owner
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceFunction.owner || '—'}</p>
                  </div>

                  {sourceFunction.verificationMethod && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Verification Method
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">{sourceFunction.verificationMethod}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    {sourceFunction.description}
                  </p>
                </div>
              </div>
            )}

            {changeRequest.sourceType === 'issue' && sourceIssue && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceIssue.title}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white capitalize">{sourceIssue.status}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priority
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white capitalize">{sourceIssue.priority}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Owner
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceIssue.owner || '—'}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    {sourceIssue.description}
                  </p>
                </div>
              </div>
            )}

            {changeRequest.sourceType === 'parameter' && sourceParameter && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Parameter Name
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceParameter.name}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Data Type
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceParameter.dataType || '—'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Value
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceParameter.defaultValue || '—'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Unit
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">{sourceParameter.unit || '—'}</p>
                  </div>

                  {sourceParameter.sourceFunction && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Source Function
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {sourceParameter.sourceFunction.functionId || 'N/A'}: {sourceParameter.sourceFunction.name}
                      </p>
                    </div>
                  )}
                </div>

                {sourceParameter.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      {sourceParameter.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {!sourceFunction && !sourceIssue && !sourceParameter && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Source item not found or has been deleted.</p>
                <p className="text-sm mt-2">Source ID: {changeRequest.sourceId}</p>
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
