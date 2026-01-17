import { useState } from 'react'
import { X, AlertTriangle, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api'
import type { ApiResponse } from '../../../../shared/types/api.types'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number
}

interface RequirementQualityCheck {
  requirementId: string
  title: string
  validation: ValidationResult
}

interface RequirementQualityPanelProps {
  projectId: string
  onClose: () => void
}

export default function RequirementQualityPanel({ projectId, onClose }: RequirementQualityPanelProps) {
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>(null)

  const { data: qualityChecks = [], isLoading } = useQuery({
    queryKey: ['requirement-quality', projectId],
    queryFn: async () => {
      const response = await apiClient.get<RequirementQualityCheck[]>(`/api/v1/requirement-validation/${projectId}`)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const overallScore = qualityChecks.length > 0
    ? Math.round(qualityChecks.reduce((sum, check) => sum + check.validation.score, 0) / qualityChecks.length)
    : 0

  const errorCount = qualityChecks.reduce((sum, check) => sum + check.validation.errors.length, 0)
  const warningCount = qualityChecks.reduce((sum, check) => sum + check.validation.warnings.length, 0)

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20'
    if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/20'
    return 'bg-red-100 dark:bg-red-900/20'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90vw] h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Requirement Quality Analysis</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">SMART criteria and quality validation</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Overall Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{qualityChecks.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Requirements</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">{errorCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{warningCount}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Warnings</div>
            </div>
          </div>
        </div>

        {/* Quality Checks List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8">Analyzing requirements...</div>
          ) : qualityChecks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">No requirements to analyze</div>
          ) : (
            <div className="space-y-3">
              {qualityChecks.map((check) => (
                <div
                  key={check.requirementId}
                  className={`border rounded-lg p-4 ${
                    check.validation.isValid
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{check.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ID: {check.requirementId.substring(0, 8)}
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreBgColor(check.validation.score)} ${getScoreColor(check.validation.score)}`}>
                      {check.validation.score}/100
                    </div>
                  </div>

                  {check.validation.errors.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-1 text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                        <AlertCircle size={14} />
                        Errors:
                      </div>
                      <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 ml-4">
                        {check.validation.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {check.validation.warnings.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-1 text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                        <AlertTriangle size={14} />
                        Warnings:
                      </div>
                      <ul className="list-disc list-inside text-sm text-yellow-600 dark:text-yellow-400 ml-4">
                        {check.validation.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {check.validation.isValid && check.validation.warnings.length === 0 && (
                    <div className="mt-2 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle size={14} />
                      No issues found
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
