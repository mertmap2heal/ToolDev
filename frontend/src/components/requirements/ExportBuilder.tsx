import { useState } from 'react'
import { X, Download, FileSpreadsheet, FileText, File, CheckSquare, Square } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { Requirement } from '../../../../shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

// Dynamic import for jspdf-autotable to prevent build issues
// This will be loaded only when PDF export is needed
let autoTableModule: any = null

async function loadAutoTable() {
  if (!autoTableModule) {
    try {
      autoTableModule = await import('jspdf-autotable')
    } catch (error) {
      console.error('Failed to load jspdf-autotable:', error)
      throw new Error('PDF export is not available. Please check jspdf-autotable installation.')
    }
  }
  return autoTableModule.default || autoTableModule
}

interface ExportBuilderProps {
  requirements: Requirement[]
  projectName?: string
  onClose: () => void
}

type ExportFormat = 'csv' | 'excel' | 'pdf'

interface ExportColumn {
  key: keyof Requirement | 'requirementId'
  label: string
  selected: boolean
}

const defaultColumns: ExportColumn[] = [
  { key: 'requirementId', label: 'Requirement ID', selected: true },
  { key: 'title', label: 'Title', selected: true },
  { key: 'description', label: 'Description', selected: true },
  { key: 'priority', label: 'Priority', selected: true },
  { key: 'status', label: 'Status', selected: true },
  { key: 'category', label: 'Category', selected: true },
  { key: 'owner', label: 'Owner', selected: true },
  { key: 'source', label: 'Source', selected: false },
  { key: 'verificationMethod', label: 'Verification Method', selected: false },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria', selected: false },
  { key: 'stage', label: 'Stage', selected: false },
  { key: 'createdAt', label: 'Created Date', selected: false },
  { key: 'updatedAt', label: 'Updated Date', selected: false },
]

/**
 * ExportBuilder component provides functionality to export requirements
 * to various formats (CSV, Excel, PDF) with customizable column selection.
 */
export default function ExportBuilder({ requirements, projectName, onClose }: ExportBuilderProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')
  const [columns, setColumns] = useState<ExportColumn[]>(defaultColumns)
  const [includeHeader, setIncludeHeader] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  // Toggle column selection
  const toggleColumn = (key: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, selected: !col.selected } : col))
    )
  }

  // Select all columns
  const selectAll = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, selected: true })))
  }

  // Deselect all columns
  const deselectAll = () => {
    setColumns((prev) => prev.map((col) => ({ ...col, selected: false })))
  }

  // Get value for a requirement field
  const getValue = (req: Requirement, key: string): string => {
    if (key === 'requirementId') {
      return req.requirementId || req.id.substring(0, 8)
    }
    if (key === 'createdAt' || key === 'updatedAt') {
      const value = req[key as keyof Requirement]
      return value ? format(new Date(value as string), 'yyyy-MM-dd HH:mm') : ''
    }
    if (key === 'tags') {
      return (req.tags || []).join(', ')
    }
    const value = req[key as keyof Requirement]
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // Strip HTML tags from description
  const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  }

  // Export to CSV
  const exportCsv = () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = selectedCols.map((c) => c.label)
    const rows = requirements.map((req) =>
      selectedCols.map((col) => {
        let value = getValue(req, col.key)
        // Strip HTML from description
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
        }
        // Escape quotes and wrap in quotes if contains comma
        value = value.replace(/"/g, '""')
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`
        }
        return value
      })
    )

    const csvContent = [
      includeHeader ? headers.join(',') : null,
      ...rows.map((row) => row.join(',')),
    ]
      .filter(Boolean)
      .join('\n')

    downloadFile(csvContent, 'requirements_export.csv', 'text/csv')
  }

  // Export to Excel
  const exportExcel = () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = selectedCols.map((c) => c.label)
    const data = requirements.map((req) =>
      selectedCols.reduce((acc, col) => {
        let value = getValue(req, col.key)
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
        }
        acc[col.label] = value
        return acc
      }, {} as Record<string, string>)
    )

    const worksheet = XLSX.utils.json_to_sheet(data, {
      header: includeHeader ? headers : undefined,
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Requirements')

    // Auto-width columns
    const maxWidth = 50
    const colWidths = headers.map((header) => {
      const maxLen = Math.max(
        header.length,
        ...data.map((row) => (row[header]?.toString() || '').length)
      )
      return { wch: Math.min(maxLen + 2, maxWidth) }
    })
    worksheet['!cols'] = colWidths

    XLSX.writeFile(workbook, 'requirements_export.xlsx')
  }

  // Export to PDF
  const exportPdf = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = selectedCols.map((c) => c.label)
    const data = requirements.map((req) =>
      selectedCols.map((col) => {
        let value = getValue(req, col.key)
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
          // Truncate long descriptions for PDF
          if (value.length > 100) {
            value = value.substring(0, 100) + '...'
          }
        }
        return value
      })
    )

    const doc = new jsPDF({
      orientation: selectedCols.length > 6 ? 'landscape' : 'portrait',
    })

    // Add title
    doc.setFontSize(16)
    doc.text(projectName ? `${projectName} - Requirements Export` : 'Requirements Export', 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 22)
    doc.text(`Total Requirements: ${requirements.length}`, 14, 28)

    // Load and use autoTable
    const autoTable = await loadAutoTable()
    autoTable(doc, {
      head: includeHeader ? [headers] : undefined,
      body: data,
      startY: 35,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      columnStyles: selectedCols.reduce((acc, col, index) => {
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          acc[index] = { cellWidth: 'wrap' }
        }
        return acc
      }, {} as Record<number, { cellWidth: string }>),
    })

    doc.save('requirements_export.pdf')
  }

  // Download file helper
  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle export
  const handleExport = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    if (selectedCols.length === 0) {
      alert('Please select at least one column to export')
      return
    }

    setIsExporting(true)
    try {
      switch (selectedFormat) {
        case 'csv':
          exportCsv()
          break
        case 'excel':
          exportExcel()
          break
        case 'pdf':
          await exportPdf()
          break
      }
      onClose()
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const selectedCount = columns.filter((c) => c.selected).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Download className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Export Requirements
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {requirements.length} requirement{requirements.length !== 1 ? 's' : ''} to export
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedFormat('csv')}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'csv'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <FileText size={24} className="text-green-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">CSV</span>
              </button>
              <button
                onClick={() => setSelectedFormat('excel')}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'excel'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <FileSpreadsheet size={24} className="text-green-700" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Excel</span>
              </button>
              <button
                onClick={() => setSelectedFormat('pdf')}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'pdf'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <File size={24} className="text-red-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">PDF</span>
              </button>
            </div>
          </div>

          {/* Column Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Columns to Export ({selectedCount} selected)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Select All
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Deselect All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {columns.map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                >
                  <button
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

          {/* Options */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHeader}
                onChange={(e) => setIncludeHeader(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Include column headers
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedCount === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
          >
            <Download size={16} />
            {isExporting ? 'Exporting...' : `Export ${selectedFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}
