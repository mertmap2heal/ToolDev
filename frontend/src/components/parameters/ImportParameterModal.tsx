import { useState, useRef, useCallback } from 'react'
import { X, Upload, Download, CheckCircle, AlertTriangle, FileText, ChevronRight } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'

// ---------------------------------------------------------------------------
// CSV columns the backend recognises
// ---------------------------------------------------------------------------
const CSV_COLUMNS = [
  'name',
  'description',
  'data_type',
  'value',
  'unit',
  'tolerance',
  'min',
  'max',
  'tags',
  'formula',
  'status',
]

// Map of alternative header names -> canonical field names
const COLUMN_ALIASES: Record<string, string> = {
  name: 'name',
  description: 'description',
  data_type: 'data_type',
  datatype: 'data_type',
  type: 'data_type',
  value: 'value',
  defaultvalue: 'value',
  default_value: 'value',
  unit: 'unit',
  units: 'unit',
  tolerance: 'tolerance',
  min: 'min',
  minvalue: 'min',
  min_value: 'min',
  max: 'max',
  maxvalue: 'max',
  max_value: 'max',
  tags: 'tags',
  formula: 'formula',
  status: 'status',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateTemplate(): string {
  const header = CSV_COLUMNS.join(',')
  const example = [
    'max_speed',
    'Maximum operating speed',
    'float',
    '120.0',
    'km/h',
    '+/-2.5',
    '0',
    '200',
    'performance,safety',
    '',
    'approved',
  ].join(',')
  return `${header}\n${example}\n`
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Very simple CSV parser — handles quoted fields. Returns {headers, rows}. */
function parseCsv(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const splitLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map(splitLine)
  return { headers, rows }
}

/** Returns a mapping of detected CSV header -> canonical field name (or null if unknown). */
function detectMappings(headers: string[]): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (const h of headers) {
    result[h] = COLUMN_ALIASES[h] ?? null
  }
  return result
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = 1 | 2 | 3

interface ImportResult {
  imported: number
  updated: number
  warnings: string[]
  errors: string[]
}

interface ImportParameterModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ImportParameterModal({ isOpen, onClose, projectId }: ImportParameterModalProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [csvContent, setCsvContent] = useState('')
  const [filename, setFilename] = useState('')
  const [rowCount, setRowCount] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [columnMappings, setColumnMappings] = useState<Record<string, string | null>>({})
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation({
    mutationFn: (content: string) =>
      parameterService.importParameters(projectId, { content, format: 'csv' }),
    onSuccess: (res) => {
      if (res.success && res.data) {
        setImportResult(res.data)
        setStep(3)
        queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      } else {
        setImportResult({ imported: 0, updated: 0, warnings: [], errors: [res.error ?? 'Import failed'] })
        setStep(3)
      }
    },
    onError: (err: any) => {
      const msg = err?.error ?? err?.message ?? 'Import failed'
      setImportResult({ imported: 0, updated: 0, warnings: [], errors: [msg] })
      setStep(3)
    },
  })

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleClose = () => {
    // Reset all state before closing
    setStep(1)
    setCsvContent('')
    setFilename('')
    setRowCount(null)
    setIsDragging(false)
    setShowPaste(false)
    setPasteText('')
    setParseError(null)
    setPreviewHeaders([])
    setPreviewRows([])
    setColumnMappings({})
    setImportResult(null)
    onClose()
  }

  const loadCsvContent = useCallback((content: string, name: string) => {
    setParseError(null)
    const { headers, rows } = parseCsv(content)
    if (headers.length === 0) {
      setParseError('Could not parse CSV — file appears to be empty.')
      return
    }
    setCsvContent(content)
    setFilename(name)
    setRowCount(rows.length)
    setPreviewHeaders(headers)
    setPreviewRows(rows.slice(0, 5))
    setColumnMappings(detectMappings(headers))
  }, [])

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Only .csv files are supported.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => loadCsvContent(e.target?.result as string ?? '', file.name)
    reader.readAsText(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handlePasteApply = () => {
    if (!pasteText.trim()) return
    loadCsvContent(pasteText, 'pasted.csv')
    setShowPaste(false)
  }

  const handleDownloadTemplate = () => {
    triggerDownload(generateTemplate(), 'parameters_template.csv', 'text/csv')
  }

  const handleNext = () => {
    if (csvContent) setStep(2)
  }

  const handleImport = () => {
    importMutation.mutate(csvContent)
  }

  const handleDone = () => {
    handleClose()
  }

  const handleReset = () => {
    setStep(1)
    setCsvContent('')
    setFilename('')
    setRowCount(null)
    setShowPaste(false)
    setPasteText('')
    setParseError(null)
    setPreviewHeaders([])
    setPreviewRows([])
    setColumnMappings({})
    setImportResult(null)
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------
  const hasMissingName = previewHeaders.length > 0 && !previewHeaders.includes('name')
  const unknownColumns = Object.entries(columnMappings)
    .filter(([, v]) => v === null)
    .map(([k]) => k)

  if (!isOpen) return null

  // -------------------------------------------------------------------------
  // Step labels
  // -------------------------------------------------------------------------
  const STEPS: { n: Step; label: string }[] = [
    { n: 1, label: 'Upload' },
    { n: 2, label: 'Preview' },
    { n: 3, label: 'Result' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Parameters</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-0">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s.n
                    ? 'bg-blue-600 text-white'
                    : step > s.n
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {step > s.n ? <CheckCircle size={12} /> : s.n}
                </div>
                <span className={`text-xs font-medium ${
                  step === s.n
                    ? 'text-blue-600 dark:text-blue-400'
                    : step > s.n
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-500'
                }`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight size={14} className="mx-3 text-gray-300 dark:text-gray-600" />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <>
              {/* Download template */}
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Need a template?</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                    Download a sample CSV with all supported column headers.
                  </p>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Download size={13} />
                  Download template
                </button>
              </div>

              {/* Drag-and-drop zone */}
              {!showPaste && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  {csvContent ? (
                    <>
                      <FileText size={32} className="text-green-500" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{filename}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {rowCount !== null ? `${rowCount} row${rowCount !== 1 ? 's' : ''} detected` : ''}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Click or drop to replace</p>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="text-gray-400 dark:text-gray-500" />
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Drop a CSV file here
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">or click to browse</p>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Accepts .csv files only</p>
                    </>
                  )}
                </div>
              )}

              {/* Toggle: Paste CSV */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowPaste(!showPaste)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showPaste ? 'Hide paste area' : 'Or paste CSV content instead'}
                </button>
              </div>

              {showPaste && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paste CSV content
                  </label>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`name,description,data_type,value,unit\nmax_speed,Maximum speed,float,120.0,km/h`}
                    rows={7}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePasteApply}
                      disabled={!pasteText.trim()}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPaste(false); setPasteText('') }}
                      className="px-3 py-1.5 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                <FileText size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{filename}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {rowCount !== null ? `${rowCount} row${rowCount !== 1 ? 's' : ''}` : ''}
                    {' · '}
                    {previewHeaders.length} column{previewHeaders.length !== 1 ? 's' : ''} detected
                  </p>
                </div>
              </div>

              {/* Missing name warning */}
              {hasMissingName && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <strong>Required column missing:</strong> The CSV must have a <code className="font-mono bg-red-100 dark:bg-red-900/40 px-1 rounded">name</code> column.
                  </p>
                </div>
              )}

              {/* Unknown columns warning */}
              {unknownColumns.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <AlertTriangle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    <strong>Unrecognised columns</strong> will be ignored:{' '}
                    {unknownColumns.map(c => (
                      <code key={c} className="font-mono bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded text-xs mx-0.5">{c}</code>
                    ))}
                  </p>
                </div>
              )}

              {/* Column mapping table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Detected column mappings
                </h3>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">CSV column</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Maps to</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {previewHeaders.map(h => (
                        <tr key={h} className="bg-white dark:bg-gray-800">
                          <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-gray-200">{h}</td>
                          <td className="px-3 py-1.5">
                            {columnMappings[h] ? (
                              <span className="font-mono text-green-700 dark:text-green-400">{columnMappings[h]}</span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 italic">ignored</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data preview */}
              {previewRows.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Data preview (first {previewRows.length} row{previewRows.length !== 1 ? 's' : ''})
                  </h3>
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          {previewHeaders.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {previewRows.map((row, ri) => (
                          <tr key={ri} className="bg-white dark:bg-gray-800">
                            {previewHeaders.map((_, ci) => (
                              <td key={ci} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-[160px] truncate">
                                {row[ci] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Result ── */}
          {step === 3 && importResult && (
            <div className="space-y-4">
              {/* Summary */}
              {importResult.errors.length === 0 || importResult.imported > 0 || importResult.updated > 0 ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">Import complete</p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                      {importResult.imported} created &middot; {importResult.updated} updated
                      {importResult.errors.length > 0 && ` · ${importResult.errors.length} error${importResult.errors.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                  <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">Import failed</p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">No parameters were imported.</p>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-1.5">
                    Warnings ({importResult.warnings.length})
                  </p>
                  <ul className="space-y-1">
                    {importResult.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-1.5">
                        <span className="mt-0.5 flex-shrink-0">&#8226;</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1.5">
                    Errors ({importResult.errors.length})
                  </p>
                  <ul className="space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-700 dark:text-red-400 flex items-start gap-1.5">
                        <span className="mt-0.5 flex-shrink-0">&#8226;</span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          {/* Left actions */}
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Import another file
              </button>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {step !== 3 && (
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}

            {step === 1 && (
              <button
                type="button"
                onClick={handleNext}
                disabled={!csvContent}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Preview
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleImport}
                disabled={hasMissingName || importMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={14} />
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleDone}
                className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
