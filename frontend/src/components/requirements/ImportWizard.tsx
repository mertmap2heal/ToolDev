import { useState, useCallback, useMemo } from 'react'
import { X, Upload, FileText, FileSpreadsheet, File, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, AlertTriangle, Download, Loader } from 'lucide-react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/api'
import { requirementService } from '../../services/requirement.service'
import type { CreateRequirementDto, Requirement, RequirementType, RequirementLevel, RiskLevel, ComplexityLevel } from 'shared/types/engineering.types'
import clsx from 'clsx'

interface ImportWizardProps {
  projectId: string
  onClose: () => void
}

type ImportFormat = 'csv' | 'excel' | 'json' | 'reqif'
type ImportStep = 'upload' | 'mapping' | 'preview' | 'import'

interface ParsedRow {
  raw: Record<string, any>
  mapped: Partial<CreateRequirementDto>
  errors: string[]
  warnings: string[]
  action: 'create' | 'update' | 'skip'
  isDuplicate?: boolean
  existingRequirementId?: string
}

interface ColumnMapping {
  fileColumn: string
  requirementField: string | null
}

interface ImportResult {
  success: boolean
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; errors: string[] }>
}

const requirementFields = [
  { key: 'requirementId', label: 'ID', required: false },
  { key: 'title', label: 'Title', required: true },
  { key: 'description', label: 'Description', required: true },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'status', label: 'Status', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'owner', label: 'Owner', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'verificationMethod', label: 'Verification Method', required: false },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria', required: false },
  { key: 'stage', label: 'Stage', required: false },
  { key: 'tags', label: 'Tags', required: false },
  { key: 'parentId', label: 'Parent ID', required: false },
  { key: 'requirementType', label: 'Requirement Type', required: false },
  { key: 'requirementLevel', label: 'Requirement Level', required: false },
  { key: 'risk', label: 'Risk Level', required: false },
  { key: 'complexity', label: 'Complexity', required: false },
  { key: 'rationale', label: 'Rationale', required: false },
]

const priorityValues = ['low', 'medium', 'high', 'critical']

/**
 * Fuzzy match column names to requirement fields
 */
function autoMapColumns(fileColumns: string[]): Map<string, string | null> {
  const mapping = new Map<string, string | null>()

  const fieldVariations: Record<string, string[]> = {
    requirementId: ['requirement id', 'req id', 'id', 'requirementid', 'reqid'],
    title: ['title', 'name', 'requirement title', 'req title'],
    description: ['description', 'desc', 'details', 'requirement description'],
    priority: ['priority', 'prio', 'importance'],
    status: ['status', 'state'],
    category: ['category', 'type', 'category/type'],
    owner: ['owner', 'assigned to', 'assigned', 'assignee'],
    source: ['source', 'origin'],
    verificationMethod: ['verification method', 'verification', 'verify method', 'verificationmethod'],
    acceptanceCriteria: ['acceptance criteria', 'acceptance', 'criteria', 'acceptancecriteria'],
    stage: ['stage', 'phase'],
    tags: ['tags', 'tag'],
    parentId: ['parent requirement id', 'parent id', 'parent', 'parentid', 'parent requirement'],
    requirementType: ['requirement type', 'req type', 'type', 'mbse type', 'sysml type'],
    requirementLevel: ['requirement level', 'req level', 'level', 'mbse level', 'sysml level'],
    risk: ['risk', 'risk level', 'risklevel'],
    complexity: ['complexity', 'complexity level', 'complexitylevel'],
    rationale: ['rationale', 'reason', 'justification', 'why'],
  }

  fileColumns.forEach((fileCol) => {
    const normalized = fileCol.toLowerCase().trim()
    let matched = false

    for (const [fieldKey, variations] of Object.entries(fieldVariations)) {
      if (variations.some((v) => normalized.includes(v) || v.includes(normalized))) {
        mapping.set(fileCol, fieldKey)
        matched = true
        break
      }
    }

    if (!matched) {
      mapping.set(fileCol, null)
    }
  })

  return mapping
}

/**
 * ImportWizard component provides a multi-step wizard for importing requirements
 * from CSV, Excel, or JSON files with validation and preview.
 */
export default function ImportWizard({ projectId, onClose }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileFormat, setFileFormat] = useState<ImportFormat | null>(null)
  const [rawData, setRawData] = useState<Record<string, any>[]>([])
  const [columnMapping, setColumnMapping] = useState<Map<string, string | null>>(new Map())
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const queryClient = useQueryClient()

  // Fetch existing requirements for duplicate detection
  const { data: existingRequirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && currentStep !== 'upload',
  })

  // Create a map of requirementId -> requirement for quick lookup
  const requirementIdMap = useMemo(() => {
    const map = new Map<string, Requirement>()
    existingRequirements.forEach((req) => {
      if (req.requirementId) {
        map.set(req.requirementId.toLowerCase(), req)
      }
    })
    return map
  }, [existingRequirements])

  // File upload handler
  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile)
    setFileFormat(null)
    setRawData([])
    setColumnMapping(new Map())
    setParsedRows([])
    setImportResult(null)

    // Detect file format
    const fileName = selectedFile.name.toLowerCase()
    if (fileName.endsWith('.csv')) {
      setFileFormat('csv')
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      setFileFormat('excel')
    } else if (fileName.endsWith('.json')) {
      setFileFormat('json')
    } else if (fileName.endsWith('.reqif') || fileName.endsWith('.xml')) {
      setFileFormat('reqif')
    } else {
      alert('Unsupported file format. Please use CSV, Excel (.xlsx, .xls), JSON, or ReqIF (.reqif, .xml) files.')
      return
    }
  }, [])

  // Parse file based on format
  const parseFile = useCallback(async () => {
    if (!file || !fileFormat) return

    try {
      let data: Record<string, any>[] = []

      if (fileFormat === 'csv') {
        const text = await file.text()
        const result = Papa.parse<Record<string, any>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        })
        data = result.data
      } else if (fileFormat === 'excel') {
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        data = XLSX.utils.sheet_to_json(firstSheet)
      } else if (fileFormat === 'json') {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          data = parsed
        } else {
          alert('JSON file must contain an array of objects')
          return
        }
      } else if (fileFormat === 'reqif') {
        // For ReqIF, send directly to backend for parsing and import
        const text = await file.text()
        await importReqIF(text)
        return
      }

      if (data.length === 0) {
        alert('File appears to be empty or has no valid data rows')
        return
      }

      setRawData(data)

      // Auto-detect column mappings
      const fileColumns = Object.keys(data[0] || {})
      const autoMapped = autoMapColumns(fileColumns)
      setColumnMapping(autoMapped)

      setCurrentStep('mapping')
    } catch (error) {
      console.error('Parse error:', error)
      alert(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [file, fileFormat])

  // Validate and parse rows based on column mapping
  const validateAndParseRows = useCallback(() => {
    if (rawData.length === 0) return

    const rows: ParsedRow[] = rawData.map((row, index) => {
      const errors: string[] = []
      const warnings: string[] = []
      const mapped: Partial<CreateRequirementDto> = {}

      // Map columns to fields
      columnMapping.forEach((fieldKey, fileColumn) => {
        if (!fieldKey) return

        const value = row[fileColumn]
        if (value === null || value === undefined || value === '') {
          // Skip empty values unless required
          const field = requirementFields.find((f) => f.key === fieldKey)
          if (field?.required) {
            errors.push(`${field.label} is required`)
          }
          return
        }

        // Transform and validate based on field type
        if (fieldKey === 'priority') {
          const normalized = String(value).toLowerCase().trim()
          if (priorityValues.includes(normalized)) {
            mapped.priority = normalized as 'low' | 'medium' | 'high' | 'critical'
          } else {
            errors.push(`Invalid priority: ${value}. Must be one of: ${priorityValues.join(', ')}`)
          }
        } else if (fieldKey === 'tags') {
          const tagString = String(value)
          mapped.tags = tagString.split(',').map((t) => t.trim()).filter(Boolean)
        } else if (fieldKey === 'parentId') {
          // Will be resolved later
          mapped.parentId = String(value).trim()
        } else if (fieldKey === 'requirementType') {
          mapped.requirementType = String(value).trim() as RequirementType
        } else if (fieldKey === 'requirementLevel') {
          mapped.requirementLevel = String(value).trim() as RequirementLevel
        } else if (fieldKey === 'risk') {
          mapped.risk = String(value).trim() as RiskLevel
        } else if (fieldKey === 'complexity') {
          mapped.complexity = String(value).trim() as ComplexityLevel
        } else if (fieldKey === 'description' || fieldKey === 'acceptanceCriteria') {
          // Preserve HTML if present, otherwise use as plain text
          mapped[fieldKey] = String(value)
        } else {
          (mapped as Record<string, unknown>)[fieldKey] = String(value).trim()
        }
      })

      // Check required fields
      if (!mapped.title) {
        errors.push('Title is required')
      }
      if (!mapped.description) {
        errors.push('Description is required')
      }

      // Check for duplicates
      let isDuplicate = false
      let existingRequirementId: string | undefined
      if (mapped.requirementId) {
        const existing = requirementIdMap.get(mapped.requirementId.toLowerCase())
        if (existing) {
          isDuplicate = true
          existingRequirementId = existing.id
          warnings.push(`ID "${mapped.requirementId}" already exists`)
        }
      }

      // Default action based on validation
      let action: 'create' | 'update' | 'skip' = 'create'
      if (errors.length > 0) {
        action = 'skip'
      } else if (isDuplicate) {
        action = 'update' // Default to update for duplicates
      }

      return {
        raw: row,
        mapped,
        errors,
        warnings,
        action,
        isDuplicate,
        existingRequirementId,
      }
    })

    setParsedRows(rows)
    setCurrentStep('preview')
  }, [rawData, columnMapping, requirementIdMap])

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (rowsToImport: ParsedRow[]) => {
      // Resolve parent IDs
      const rowsWithResolvedParents = rowsToImport.map((row) => {
        if (row.mapped.parentId && typeof row.mapped.parentId === 'string') {
          const parentReq = requirementIdMap.get(row.mapped.parentId.toLowerCase())
          if (parentReq) {
            row.mapped.parentId = parentReq.id
          } else {
            row.errors.push(`Parent ID "${row.mapped.parentId}" not found`)
            row.action = 'skip'
          }
        }
        return row
      })

      // Separate into create and update operations
      const toCreate: CreateRequirementDto[] = []
      const toUpdate: Array<{ id: string; data: Partial<CreateRequirementDto> }> = []

      rowsWithResolvedParents.forEach((row) => {
        if (row.action === 'skip' || row.errors.length > 0) return

        if (row.action === 'create') {
          toCreate.push({
            title: row.mapped.title!,
            description: row.mapped.description!,
            priority: row.mapped.priority || 'medium',
            requirementId: row.mapped.requirementId,
            status: row.mapped.status,
            stage: row.mapped.stage,
            owner: row.mapped.owner,
            category: row.mapped.category,
            source: row.mapped.source,
            verificationMethod: row.mapped.verificationMethod,
            acceptanceCriteria: row.mapped.acceptanceCriteria,
            tags: row.mapped.tags,
            parentId: row.mapped.parentId as string | undefined,
          })
        } else if (row.action === 'update' && row.existingRequirementId) {
          toUpdate.push({
            id: row.existingRequirementId,
            data: {
              title: row.mapped.title,
              description: row.mapped.description,
              priority: row.mapped.priority,
              status: row.mapped.status,
              stage: row.mapped.stage,
              owner: row.mapped.owner,
              category: row.mapped.category,
              source: row.mapped.source,
              verificationMethod: row.mapped.verificationMethod,
              acceptanceCriteria: row.mapped.acceptanceCriteria,
              tags: row.mapped.tags,
              parentId: row.mapped.parentId as string | undefined,
            },
          })
        }
      })

      // Call bulk import API
      const response = await requirementService.bulkImportRequirements(projectId, {
        create: toCreate,
        update: toUpdate,
      })

      if (!response.success) {
        throw new Error(response.error || 'Import failed')
      }

      return response.data
    },
    onSuccess: (result) => {
      setImportResult(result ? { success: true, ...result } : null)
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setCurrentStep('import')
    },
    onError: (error: any) => {
      console.error('Import error:', error)
      alert(`Import failed: ${error?.message || 'Unknown error'}`)
    },
  })

  // Import ReqIF file directly
  const importReqIF = useCallback(async (reqifXml: string) => {
    try {
      const response = await apiClient.post<ImportResult>(`/reqif/${projectId}/import`, {
        reqifXml,
      })

      if (response.success && response.data) {
        setImportResult(response.data)
        queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
        setCurrentStep('import')
      } else {
        throw new Error(response.error || 'Failed to import ReqIF file')
      }
    } catch (error: any) {
      console.error('ReqIF import error:', error)
      alert(`Failed to import ReqIF file: ${error?.message || 'Unknown error'}`)
    }
  }, [projectId, queryClient])

  // Handle import execution
  const handleImport = useCallback(() => {
    const rowsToImport = parsedRows.filter((row) => row.action !== 'skip')
    if (rowsToImport.length === 0) {
      alert('No rows selected for import')
      return
    }
    importMutation.mutate(rowsToImport)
  }, [parsedRows, importMutation])

  // Update row action
  const updateRowAction = useCallback((index: number, action: 'create' | 'update' | 'skip') => {
    setParsedRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], action }
      return updated
    })
  }, [])

  // Bulk update actions
  const bulkUpdateActions = useCallback((action: 'create' | 'update' | 'skip') => {
    setParsedRows((prev) => prev.map((row) => ({ ...row, action })))
  }, [])

  // Export error report
  const exportErrorReport = useCallback(() => {
    if (!importResult) return

    const lines = [
      'Import Error Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      `Total Created: ${importResult.created}`,
      `Total Updated: ${importResult.updated}`,
      `Total Skipped: ${importResult.skipped}`,
      '',
      '--- Errors ---',
    ]

    importResult.errors.forEach((error) => {
      lines.push(`Row ${error.row + 1}: ${error.errors.join('; ')}`)
    })

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'import_error_report.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [importResult])

  const fileColumns = rawData.length > 0 ? Object.keys(rawData[0]) : []
  const stats = useMemo(() => {
    const total = parsedRows.length
    const valid = parsedRows.filter((r) => r.errors.length === 0).length
    const errors = parsedRows.filter((r) => r.errors.length > 0).length
    const duplicates = parsedRows.filter((r) => r.isDuplicate).length
    const toCreate = parsedRows.filter((r) => r.action === 'create').length
    const toUpdate = parsedRows.filter((r) => r.action === 'update').length
    const toSkip = parsedRows.filter((r) => r.action === 'skip').length

    return { total, valid, errors, duplicates, toCreate, toUpdate, toSkip }
  }, [parsedRows])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Upload className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Import Requirements
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Step {currentStep === 'upload' ? 1 : currentStep === 'mapping' ? 2 : currentStep === 'preview' ? 3 : 4} of 4
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
          {/* Step 1: Upload */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select File to Import
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Supported formats: CSV, Excel (.xlsx, .xls), JSON, ReqIF (.reqif, .xml)
                </p>
              </div>

              <FileUploadZone
                onFileSelect={handleFileSelect}
                selectedFile={file}
                format={fileFormat}
              />

              {file && fileFormat && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={parseFile}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                  >
                    <ChevronRight size={16} />
                    Next: Map Columns
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {currentStep === 'mapping' && (
            <ColumnMappingStep
              fileColumns={fileColumns}
              columnMapping={columnMapping}
              onMappingChange={setColumnMapping}
              onNext={validateAndParseRows}
              onBack={() => setCurrentStep('upload')}
            />
          )}

          {/* Step 3: Preview & Review */}
          {currentStep === 'preview' && (
            <PreviewStep
              parsedRows={parsedRows}
              stats={stats}
              onRowActionChange={updateRowAction}
              onBulkAction={bulkUpdateActions}
              onImport={handleImport}
              onBack={() => setCurrentStep('mapping')}
              isImporting={importMutation.isPending}
            />
          )}

          {/* Step 4: Import Results */}
          {currentStep === 'import' && importResult && (
            <ImportResultsStep
              result={importResult}
              onClose={onClose}
              onExportErrors={exportErrorReport}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// File Upload Zone Component
interface FileUploadZoneProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  format: ImportFormat | null
}

function FileUploadZone({ onFileSelect, selectedFile, format }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      onFileSelect(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
  }

  const getFormatIcon = () => {
    if (!format) return <Upload size={48} className="text-gray-400" />
    if (format === 'csv') return <FileText size={48} className="text-green-600" />
    if (format === 'excel') return <FileSpreadsheet size={48} className="text-green-700" />
    return <File size={48} className="text-blue-600" />
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={clsx(
        'border-2 border-dashed rounded-lg p-12 text-center transition-colors',
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      )}
    >
      <input
        type="file"
        id="file-upload"
        accept=".csv,.xlsx,.xls,.json,.reqif,.xml"
        onChange={handleFileInput}
        className="hidden"
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        {selectedFile ? (
          <div className="space-y-2">
            {getFormatIcon()}
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={48} className="mx-auto text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Drag and drop a file here, or click to browse
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              CSV, Excel, or JSON files
            </p>
          </div>
        )}
      </label>
    </div>
  )
}

// Column Mapping Step Component
interface ColumnMappingStepProps {
  fileColumns: string[]
  columnMapping: Map<string, string | null>
  onMappingChange: (mapping: Map<string, string | null>) => void
  onNext: () => void
  onBack: () => void
}

function ColumnMappingStep({
  fileColumns,
  columnMapping,
  onMappingChange,
  onNext,
  onBack,
}: ColumnMappingStepProps) {
  const updateMapping = (fileColumn: string, requirementField: string | null) => {
    const newMapping = new Map(columnMapping)
    newMapping.set(fileColumn, requirementField)
    onMappingChange(newMapping)
  }

  const unmappedCount = Array.from(columnMapping.values()).filter((v) => v === null).length

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Map Columns to Fields
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Match your file columns to requirement fields. Required fields are marked with *
        </p>
        {unmappedCount > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {unmappedCount} column(s) are not mapped. They will be ignored during import.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {fileColumns.map((fileCol) => {
          const currentMapping = columnMapping.get(fileCol) || null
          return (
            <div
              key={fileCol}
              className="flex items-center gap-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{fileCol}</p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
              <div className="flex-1">
                <select
                  value={currentMapping || ''}
                  onChange={(e) => updateMapping(fileCol, e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">-- Ignore Column --</option>
                  {requirementFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label} {field.required && '*'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
        >
          Next: Preview & Review
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// Preview Step Component
interface PreviewStepProps {
  parsedRows: ParsedRow[]
  stats: {
    total: number
    valid: number
    errors: number
    duplicates: number
    toCreate: number
    toUpdate: number
    toSkip: number
  }
  onRowActionChange: (index: number, action: 'create' | 'update' | 'skip') => void
  onBulkAction: (action: 'create' | 'update' | 'skip') => void
  onImport: () => void
  onBack: () => void
  isImporting: boolean
}

function PreviewStep({
  parsedRows,
  stats,
  onRowActionChange,
  onBulkAction,
  onImport,
  onBack,
  isImporting,
}: PreviewStepProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Preview & Review
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Review the parsed data and choose an action for each row
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Rows</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Valid</p>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">{stats.valid}</p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Errors</p>
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">{stats.errors}</p>
        </div>
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400">Duplicates</p>
          <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
            {stats.duplicates}
          </p>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <span className="text-sm text-gray-600 dark:text-gray-400">Bulk Actions:</span>
        <button
          onClick={() => onBulkAction('create')}
          className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
        >
          Create All
        </button>
        <button
          onClick={() => onBulkAction('update')}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Update All
        </button>
        <button
          onClick={() => onBulkAction('skip')}
          className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded"
        >
          Skip All
        </button>
      </div>

      {/* Preview Table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Row
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Title
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {parsedRows.map((row, index) => (
                <tr
                  key={index}
                  className={clsx(
                    'hover:bg-gray-50 dark:hover:bg-gray-700/30',
                    row.errors.length > 0 && 'bg-red-50 dark:bg-red-900/10',
                    row.isDuplicate && 'bg-yellow-50 dark:bg-yellow-900/10'
                  )}
                >
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                    {index + 1}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {row.mapped.title || '(No title)'}
                      </span>
                      {row.errors.length > 0 && (
                        <AlertCircle size={14} className="text-red-500" aria-label={row.errors.join(', ')} />
                      )}
                      {row.warnings.length > 0 && (
                        <AlertTriangle
                          size={14}
                          className="text-yellow-500"
                          aria-label={row.warnings.join(', ')}
                        />
                      )}
                      {row.errors.length === 0 && row.warnings.length === 0 && (
                        <CheckCircle size={14} className="text-green-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      {row.errors.length > 0 && (
                        <span className="text-xs text-red-600 dark:text-red-400">Errors</span>
                      )}
                      {row.isDuplicate && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400">Duplicate</span>
                      )}
                      {row.errors.length === 0 && !row.isDuplicate && (
                        <span className="text-xs text-green-600 dark:text-green-400">Valid</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.action}
                      onChange={(e) =>
                        onRowActionChange(index, e.target.value as 'create' | 'update' | 'skip')
                      }
                      disabled={row.errors.length > 0}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="create">Create New</option>
                      <option value="update" disabled={!row.isDuplicate}>
                        Update Existing
                      </option>
                      <option value="skip">Skip</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Summary */}
      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              {stats.toCreate}
            </span>{' '}
            to create
          </span>
          <span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{stats.toUpdate}</span>{' '}
            to update
          </span>
          <span>
            <span className="font-semibold text-gray-600 dark:text-gray-400">{stats.toSkip}</span>{' '}
            to skip
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          disabled={isImporting}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <button
          onClick={onImport}
          disabled={isImporting || stats.toCreate + stats.toUpdate === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
        >
          {isImporting ? (
            <>
              <Loader size={16} className="animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload size={16} />
              Import {stats.toCreate + stats.toUpdate} Requirements
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// Import Results Step Component
interface ImportResultsStepProps {
  result: ImportResult
  onClose: () => void
  onExportErrors: () => void
}

function ImportResultsStep({ result, onClose, onExportErrors }: ImportResultsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Import Complete
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          The import process has finished. Review the results below.
        </p>
      </div>

      {/* Results Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <CheckCircle size={32} className="mx-auto mb-2 text-green-600 dark:text-green-400" />
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.created}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Created</p>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
          <CheckCircle size={32} className="mx-auto mb-2 text-blue-600 dark:text-blue-400" />
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{result.updated}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Updated</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-center">
          <AlertCircle size={32} className="mx-auto mb-2 text-gray-600 dark:text-gray-400" />
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{result.skipped}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Skipped</p>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-red-900 dark:text-red-200">
              Errors ({result.errors.length})
            </h4>
            <button
              onClick={onExportErrors}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1"
            >
              <Download size={12} />
              Export Report
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {result.errors.map((error, index) => (
              <p key={index} className="text-sm text-red-800 dark:text-red-200">
                Row {error.row + 1}: {error.errors.join('; ')}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {result.errors.length === 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            All requirements were imported successfully!
          </p>
        </div>
      )}

      {/* Close Button */}
      <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  )
}
