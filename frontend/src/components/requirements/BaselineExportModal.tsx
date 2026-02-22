import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, FileSpreadsheet, FileText, File, CheckSquare, Square } from 'lucide-react'
import { baselineService } from '../../services/baseline.service'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { Baseline } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

// Dynamic import for jspdf-autotable
let autoTableModule: any = null

async function loadAutoTable() {
  if (!autoTableModule) {
    try {
      autoTableModule = await import('jspdf-autotable')
    } catch (error) {
      console.error('Failed to load jspdf-autotable:', error)
      throw new Error('PDF export is not available.')
    }
  }
  return autoTableModule.default || autoTableModule
}

interface BaselineExportModalProps {
  projectId: string
  baselineId: string
  onClose: () => void
}

type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json'

interface ExportColumn {
  key: string
  label: string
  selected: boolean
}

const defaultColumns: ExportColumn[] = [
  { key: 'requirementId', label: 'ID', selected: true },
  { key: 'title', label: 'Title', selected: true },
  { key: 'description', label: 'Description', selected: true },
  { key: 'priority', label: 'Priority', selected: true },
  { key: 'status', label: 'Status', selected: true },
  { key: 'category', label: 'Category', selected: true },
  { key: 'owner', label: 'Owner', selected: false },
  { key: 'source', label: 'Source', selected: false },
  { key: 'verificationMethod', label: 'Verification Method', selected: false },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria', selected: false },
  { key: 'stage', label: 'Stage', selected: false },
]

export default function BaselineExportModal({ projectId, baselineId, onClose }: BaselineExportModalProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel')
  const [columns, setColumns] = useState<ExportColumn[]>(defaultColumns)
  const [isExporting, setIsExporting] = useState(false)

  const { data: baseline, isLoading } = useQuery({
    queryKey: ['baseline', projectId, baselineId],
    queryFn: async () => {
      const response = await baselineService.getBaseline(projectId, baselineId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load baseline')
    },
    enabled: !!projectId && !!baselineId,
  })

  // Parse requirement snapshots
  const requirements = baseline?.items?.map((item) => {
    try {
      return JSON.parse(item.snapshot)
    } catch {
      return null
    }
  }).filter(Boolean) || []

  const toggleColumn = (key: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, selected: !col.selected } : col))
    )
  }

  const selectAllColumns = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, selected: true })))
  }

  const deselectAllColumns = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, selected: false })))
  }

  const getSelectedColumns = () => columns.filter((col) => col.selected)

  const exportToCSV = () => {
    const selectedCols = getSelectedColumns()
    const headers = selectedCols.map((col) => col.label)
    const rows = requirements.map((req: any) =>
      selectedCols.map((col) => {
        const value = req[col.key] || ''
        // Remove HTML tags and clean up for CSV
        if (typeof value === 'string') {
          return value.replace(/<[^>]*>/g, '').replace(/"/g, '""')
        }
        return value
      })
    )

    const csvContent = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${baseline?.name || 'baseline'}_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToExcel = () => {
    const selectedCols = getSelectedColumns()
    const data = requirements.map((req: any) => {
      const row: any = {}
      selectedCols.forEach((col) => {
        let value = req[col.key] || ''
        if (typeof value === 'string') {
          value = value.replace(/<[^>]*>/g, '')
        }
        row[col.label] = value
      })
      return row
    })

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Requirements')
    XLSX.writeFile(wb, `${baseline?.name || 'baseline'}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const exportToJSON = async () => {
    const payload = {
      _exportMetadata: {
        format: 'baseline-export-v1',
        exportedAt: new Date().toISOString(),
        baselineId: baseline?.id,
        baselineName: baseline?.name,
        baselineType: baseline?.baselineType,
        reviewType: baseline?.reviewType,
        status: baseline?.status,
        createdAt: baseline?.createdAt,
        requirementCount: requirements.length,
        linkCount: (baseline?.linksSnapshot as { links?: unknown[] })?.links?.length ?? 0,
      },
      baseline: {
        id: baseline?.id,
        name: baseline?.name,
        description: baseline?.description,
        status: baseline?.status,
        baselineType: baseline?.baselineType,
        reviewType: baseline?.reviewType,
        createdAt: baseline?.createdAt,
        itemCount: requirements.length,
      },
      requirements,
      links: (baseline?.linksSnapshot as { links?: unknown[] })?.links ?? [],
    }
    const jsonStr = JSON.stringify(payload, null, 2)
    let checksum = ''
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder()
      const data = encoder.encode(jsonStr)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      checksum = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    }
    const withChecksum = { ...payload, _exportMetadata: { ...payload._exportMetadata, sha256: checksum } }
    const blob = new Blob([JSON.stringify(withChecksum, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${baseline?.name || 'baseline'}_${format(new Date(), 'yyyy-MM-dd')}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const exportToPDF = async () => {
    try {
      const autoTable = await loadAutoTable()
      const selectedCols = getSelectedColumns()
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(16)
      doc.text(baseline?.name || 'Baseline', 14, 20)
      doc.setFontSize(10)
      doc.text(`Exported: ${format(new Date(), 'PPp')}`, 14, 28)
      doc.text(`Requirements: ${requirements.length}`, 14, 34)

      const tableData = requirements.map((req: any) =>
        selectedCols.map((col) => {
          let value = req[col.key] || ''
          if (typeof value === 'string') {
            value = value.replace(/<[^>]*>/g, '').substring(0, 100)
          }
          return value
        })
      )

      autoTable(doc, {
        head: [selectedCols.map((col) => col.label)],
        body: tableData,
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
      })

      doc.save(`${baseline?.name || 'baseline'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    } catch (error) {
      console.error('PDF export error:', error)
      alert('Failed to export PDF. Please try again.')
    }
  }

  const handleExport = async () => {
    if (requirements.length === 0) {
      alert('No requirements to export')
      return
    }

    if (getSelectedColumns().length === 0) {
      alert('Please select at least one column to export')
      return
    }

    setIsExporting(true)
    try {
      switch (exportFormat) {
        case 'csv':
          exportToCSV()
          break
        case 'excel':
          exportToExcel()
          break
        case 'pdf':
          await exportToPDF()
          break
        case 'json':
          await exportToJSON()
          break
      }
      setTimeout(() => {
        setIsExporting(false)
        onClose()
      }, 500)
    } catch (error) {
      console.error('Export error:', error)
      alert('Export failed. Please try again.')
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Download className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Export Baseline
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {baseline?.name || 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading baseline...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {(['csv', 'excel', 'pdf', 'json'] as ExportFormat[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => setExportFormat(format)}
                      className={clsx(
                        'p-3 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors',
                        exportFormat === format
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      {format === 'csv' && <FileText size={24} className="text-gray-600 dark:text-gray-400" />}
                      {format === 'excel' && <FileSpreadsheet size={24} className="text-gray-600 dark:text-gray-400" />}
                      {format === 'pdf' && <File size={24} className="text-gray-600 dark:text-gray-400" />}
                      {format === 'json' && <File size={24} className="text-gray-600 dark:text-gray-400" />}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {format}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Columns
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllColumns}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      onClick={deselectAllColumns}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <div className="space-y-2">
                    {columns.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                      >
                        <button
                          type="button"
                          onClick={() => toggleColumn(col.key)}
                          className="text-gray-600 dark:text-gray-400"
                        >
                          {col.selected ? (
                            <CheckSquare size={18} className="text-blue-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                {requirements.length} requirement{requirements.length !== 1 ? 's' : ''} will be exported
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || isLoading || requirements.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
