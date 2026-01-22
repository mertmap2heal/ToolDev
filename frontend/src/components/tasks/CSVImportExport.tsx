import { useState } from 'react'
import { Upload, Download, FileText, X } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { ListTasksFilters } from '../../../shared/types/task.types'

interface CSVImportExportProps {
  projectId?: string
  currentFilters?: ListTasksFilters
}

export default function CSVImportExport({ projectId, currentFilters }: CSVImportExportProps) {
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'title',
    'status',
    'priority',
    'due_date',
    'tags',
  ])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<any>(null)

  const exportMutation = useMutation({
    mutationFn: async () => {
      const blob = await taskService.exportTasks({
        projectId,
        filters: currentFilters,
        columns: selectedColumns,
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tasks_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    },
    onSuccess: () => {
      setIsExportOpen(false)
    },
  })

  const importMutation = useMutation({
    mutationFn: async (csvData: string) => {
      return taskService.importTasks({
        csvData,
        projectId,
      })
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        setImportResult(response.data)
      }
    },
  })

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const csvData = event.target?.result as string
      importMutation.mutate(csvData)
    }
    reader.readAsText(file)
  }

  const availableColumns = [
    { value: 'title', label: 'Title' },
    { value: 'description', label: 'Description' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'due_date', label: 'Due Date' },
    { value: 'start_date', label: 'Start Date' },
    { value: 'tags', label: 'Tags' },
    { value: 'estimate_minutes', label: 'Estimate (minutes)' },
  ]

  return (
    <div className="flex gap-2">
      {/* Export */}
      <button
        onClick={() => setIsExportOpen(true)}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
      >
        <Download size={16} />
        Export CSV
      </button>

      {/* Import */}
      <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 cursor-pointer transition-colors">
        <Upload size={16} />
        Import CSV
        <input
          type="file"
          accept=".csv"
          onChange={handleImportFile}
          className="hidden"
        />
      </label>

      {/* Export Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Export Tasks to CSV</h3>
              <button
                onClick={() => setIsExportOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Columns
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableColumns.map((col) => (
                  <label key={col.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(col.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedColumns([...selectedColumns, col.value])
                        } else {
                          setSelectedColumns(selectedColumns.filter((c) => c !== col.value))
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsExportOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || selectedColumns.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportMutation.isPending ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Import Results</h3>
              <button
                onClick={() => {
                  setImportResult(null)
                  setImportFile(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Imported:</strong> {importResult.imported} tasks
              </div>
              {importResult.errors > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  <strong>Errors:</strong> {importResult.errors} rows
                </div>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-4 max-h-48 overflow-y-auto">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Error Details:
                  </div>
                  {importResult.errors.map((error: any, index: number) => (
                    <div key={index} className="text-xs text-red-600 dark:text-red-400 mb-1">
                      Row {error.row}: {error.error}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => {
                  setImportResult(null)
                  setImportFile(null)
                  window.location.reload()
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
