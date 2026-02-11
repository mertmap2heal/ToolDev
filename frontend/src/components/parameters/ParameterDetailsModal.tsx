import { X } from 'lucide-react'
import type { Parameter } from 'shared/types/engineering.types'

interface ParameterDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  parameter: Parameter
}

export default function ParameterDetailsModal({
  isOpen,
  onClose,
  parameter,
}: ParameterDetailsModalProps) {
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

          {/* Data Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Data Type
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <span className="text-gray-900 dark:text-white">
                {parameter.dataType || <span className="text-gray-400 dark:text-gray-500">Not specified</span>}
              </span>
            </div>
          </div>

          {/* Default Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Default Value
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <span className="text-gray-900 dark:text-white">
                {parameter.defaultValue || <span className="text-gray-400 dark:text-gray-500">Not specified</span>}
              </span>
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Unit
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <span className="text-gray-900 dark:text-white">
                {parameter.unit || <span className="text-gray-400 dark:text-gray-500">Not specified</span>}
              </span>
            </div>
          </div>

          {/* Source */}
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
