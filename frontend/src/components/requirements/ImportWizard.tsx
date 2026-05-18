import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { X, FileText, FileSpreadsheet, File, ChevronRight, ChevronLeft, AlertCircle, CheckCircle, AlertTriangle, Download, FileUp } from 'lucide-react'
import Papa from 'papaparse'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requirementService, type XlsxCellError } from '../../services/requirement.service'
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
  /** 1-based spreadsheet row, for the Excel path (#450). */
  rowNumber?: number
}

interface ImportResult {
  success: boolean
  created: number
  updated: number
  skipped: number
  errors: Array<{ row: number; errors: string[] }>
  linksCreated?: number
  /** Per-cell findings from the Excel commit (#450). */
  cellErrors?: XlsxCellError[]
  /** Per-cell INCOSE/EARS advisory warnings from the Excel commit (#450). */
  qualityWarnings?: XlsxCellError[]
  /** True when a DB-level fault rolled the whole batch back (#450). */
  rolledBack?: boolean
  /** The DB-fault message shown on a rolled-back result (#450). */
  rolledBackMessage?: string
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
 * from CSV, Excel, JSON, or ReqIF files with validation and preview.
 *
 * The Excel branch (#450) parses server-side: the `.xlsx` is uploaded to
 * `POST /import/xlsx/parse`, mapped client-side, then committed via
 * `POST /import/xlsx/commit`, which returns a per-cell validation report.
 */
export default function ImportWizard({ projectId, onClose }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [fileFormat, setFileFormat] = useState<ImportFormat | null>(null)
  const [rawData, setRawData] = useState<Record<string, any>[]>([])
  const [columnMapping, setColumnMapping] = useState<Map<string, string | null>>(new Map())
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  /** Step-3 forecast: per-cell findings computed client-side before commit. */
  const [previewCellErrors, setPreviewCellErrors] = useState<XlsxCellError[]>([])
  /** 1-based spreadsheet row numbers, parallel to rawData (Excel path, #450). */
  const [rowNumbers, setRowNumbers] = useState<number[]>([])

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
    setPreviewCellErrors([])
    setRowNumbers([])

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
      alert('Unsupported file format. Please use CSV, Excel (.xlsx), JSON, or ReqIF (.reqif, .xml) files.')
      return
    }
  }, [])

  // Parse file based on format
  const parseFile = useCallback(async () => {
    if (!file || !fileFormat) return

    setIsParsing(true)
    try {
      let data: Record<string, any>[] = []
      // For the Excel path, the server returns rows already carrying their
      // 1-based spreadsheet row number; other formats synthesize it.
      let rowNumbers: number[] = []

      if (fileFormat === 'csv') {
        const text = await file.text()
        const result = Papa.parse<Record<string, any>>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        })
        data = result.data
      } else if (fileFormat === 'excel') {
        // #450 — Excel is parsed SERVER-SIDE: upload the .xlsx, the backend
        // parses it with exceljs (auditable, XXE-safe) and returns the rows.
        const response = await requirementService.parseXlsxImport(projectId, file)
        if (!response.success || !response.data) {
          alert(
            response.error ||
              'That file could not be read as an .xlsx workbook. Check it opens in Excel, then re-upload.',
          )
          return
        }
        data = response.data.rows.map((r) => r.cells)
        rowNumbers = response.data.rows.map((r) => r.rowNumber)
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
        const text = await file.text()
        await importReqIF(text)
        return
      }

      if (data.length === 0) {
        alert('File appears to be empty or has no valid data rows')
        return
      }

      // Keep the spreadsheet row numbers parallel to rawData so
      // validateAndParseRows can attach each one to its ParsedRow.
      setRowNumbers(rowNumbers)
      setRawData(data)

      // Auto-detect column mappings
      const fileColumns = Object.keys(data[0] || {})
      const autoMapped = autoMapColumns(fileColumns)
      setColumnMapping(autoMapped)

      setCurrentStep('mapping')
    } catch (error) {
      console.error('Parse error:', error)
      alert(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsParsing(false)
    }
  }, [file, fileFormat, projectId])

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
        rowNumber: rowNumbers[index],
      }
    })

    setParsedRows(rows)

    // Excel path: build the step-3 per-cell forecast from the client-side
    // validation. The authoritative server report lands on the result step.
    if (fileFormat === 'excel') {
      setPreviewCellErrors(buildPreviewCellErrors(rows, columnMapping))
    }

    setCurrentStep('preview')
  }, [rawData, rowNumbers, columnMapping, requirementIdMap, fileFormat])

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
      const toCreate: Array<CreateRequirementDto & { _rowNumber?: number }> = []
      const toUpdate: Array<{ id: string; data: Partial<CreateRequirementDto>; _rowNumber?: number }> = []

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
            _rowNumber: row.rowNumber,
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
            _rowNumber: row.rowNumber,
          })
        }
      })

      // #450 — the Excel path commits through the per-cell-validating
      // server endpoint; other formats keep the existing bulk-import call.
      if (fileFormat === 'excel') {
        const columnMap: Record<string, string> = {}
        columnMapping.forEach((field, header) => {
          if (field && !columnMap[field]) columnMap[field] = header
        })
        const response = await requirementService.commitXlsxImport(projectId, {
          create: toCreate as unknown as Array<Record<string, unknown> & { _rowNumber?: number }>,
          update: toUpdate.map((u) => ({
            id: u.id,
            data: u.data as Record<string, unknown>,
            _rowNumber: u._rowNumber,
          })),
          columnMap,
          filename: file?.name,
        })
        if (!response.success || !response.data) {
          // A 409 (DB-level fault) carries the rolled-back message.
          throw new Error(response.error || 'Import failed')
        }
        const d = response.data
        return {
          success: true,
          created: d.created,
          updated: d.updated,
          skipped: d.skipped,
          errors: [],
          cellErrors: d.errors,
          qualityWarnings: d.qualityWarnings,
        } as ImportResult
      }

      const response = await requirementService.bulkImportRequirements(projectId, {
        create: toCreate.map(({ _rowNumber: _omit, ...rest }) => rest),
        update: toUpdate.map(({ _rowNumber: _omit, ...rest }) => rest),
      })

      if (!response.success) {
        throw new Error(response.error || 'Import failed')
      }

      return response.data ? ({ success: true, ...response.data } as ImportResult) : null
    },
    onSuccess: (result) => {
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setCurrentStep('import')
    },
    onError: (error: any) => {
      console.error('Import error:', error)
      // A DB-level rollback (locked row) is surfaced honestly on the result
      // step rather than as a dead-end alert for the Excel path.
      if (fileFormat === 'excel') {
        setImportResult({
          success: false,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [],
          cellErrors: [],
          qualityWarnings: [],
          rolledBack: true,
          rolledBackMessage: error?.message,
        })
        setCurrentStep('import')
        return
      }
      alert(`Import failed: ${error?.message || 'Unknown error'}`)
    },
  })

  // Import ReqIF file directly via requirements import endpoint
  const importReqIF = useCallback(async (reqifXml: string) => {
    try {
      const response = await requirementService.importReqif(projectId, reqifXml)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to import ReqIF file')
      }
      const d = response.data
      const mappedResult: ImportResult = {
        success: true,
        created: d.created,
        updated: 0,
        skipped: d.skipped,
        errors: d.errors.map((e) => ({ row: (e.row ?? 1) - 1, errors: [e.message] })),
        linksCreated: d.linksCreated,
      }
      setImportResult(mappedResult)
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setCurrentStep('import')
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

  // Export error report — emits row + column + reason lines per #450 AC #4.
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
    ]

    if (importResult.cellErrors && importResult.cellErrors.length > 0) {
      lines.push('--- Errors (row, column, reason) ---')
      importResult.cellErrors.forEach((e) => {
        lines.push(`Row ${e.rowNumber} | ${e.column} (${e.field}) | ${e.reason}`)
      })
    }
    if (importResult.qualityWarnings && importResult.qualityWarnings.length > 0) {
      lines.push('', '--- Quality warnings (row, column, reason) ---')
      importResult.qualityWarnings.forEach((e) => {
        lines.push(`Row ${e.rowNumber} | ${e.column} (${e.field}) | ${e.reason}`)
      })
    }
    if (
      (!importResult.cellErrors || importResult.cellErrors.length === 0) &&
      importResult.errors.length > 0
    ) {
      lines.push('--- Errors ---')
      importResult.errors.forEach((error) => {
        lines.push(`Row ${error.row + 1}: ${error.errors.join('; ')}`)
      })
    }

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

  const stepNumber =
    currentStep === 'upload' ? 1 : currentStep === 'mapping' ? 2 : currentStep === 'preview' ? 3 : 4

  // §9 — Esc closes the wizard on every step except the result step.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && currentStep !== 'import') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentStep, onClose])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-base rounded-md border border-default shadow-xl w-[95vw] max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-default">
          <div className="flex items-center gap-3">
            <FileUp className="text-accent-primary" size={18} strokeWidth={1.75} />
            <div>
              <h2 className="text-xl font-bold text-ink-primary">
                Import Requirements
              </h2>
              <p className="text-sm text-ink-muted">Step {stepNumber} of 4</p>
            </div>
          </div>
          {currentStep !== 'import' && (
            <button
              onClick={onClose}
              aria-label="Close import wizard"
              className="p-2 hover:bg-surface-inset rounded-sm"
            >
              <X size={18} className="text-ink-muted" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-ink-primary mb-2">
                  Select a file to import
                </h3>
                <p className="text-sm text-ink-muted mb-4">
                  Excel (.xlsx), CSV, JSON, or ReqIF.
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
                    disabled={isParsing}
                    className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-white rounded-sm flex items-center gap-2"
                  >
                    {isParsing ? (
                      <>
                        <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        {fileFormat === 'reqif'
                          ? 'Importing ReqIF…'
                          : fileFormat === 'excel'
                            ? 'Parsing spreadsheet…'
                            : 'Parsing file…'}
                      </>
                    ) : fileFormat === 'reqif' ? (
                      <>
                        <FileUp size={14} strokeWidth={1.75} />
                        Import ReqIF
                      </>
                    ) : fileFormat === 'excel' ? (
                      <>
                        <ChevronRight size={14} strokeWidth={1.75} />
                        Parse spreadsheet
                      </>
                    ) : (
                      <>
                        <ChevronRight size={14} strokeWidth={1.75} />
                        Next: Map Columns
                      </>
                    )}
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
              isExcel={fileFormat === 'excel'}
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
              isExcel={fileFormat === 'excel'}
              previewCellErrors={previewCellErrors}
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

/**
 * Build the step-3 per-cell forecast for the Excel path from the client-side
 * row validation. Errors become `error` rows; the duplicate / parent warnings
 * become `warning` rows. This is a forecast — the result step shows the
 * authoritative server report.
 */
function buildPreviewCellErrors(
  rows: ParsedRow[],
  columnMapping: Map<string, string | null>,
): XlsxCellError[] {
  const headerByField = new Map<string, string>()
  columnMapping.forEach((field, header) => {
    if (field && !headerByField.has(field)) headerByField.set(field, header)
  })
  const out: XlsxCellError[] = []
  rows.forEach((row, index) => {
    const rowNumber = row.rowNumber ?? index + 2
    row.errors.forEach((message) => {
      const lower = message.toLowerCase()
      let field = '(row)'
      if (lower.includes('title')) field = 'title'
      else if (lower.includes('description')) field = 'description'
      else if (lower.includes('priority')) field = 'priority'
      else if (lower.includes('parent')) field = 'parentId'
      out.push({
        rowNumber,
        column: headerByField.get(field) ?? field,
        field,
        severity: 'error',
        reason: message,
      })
    })
    row.warnings.forEach((message) => {
      out.push({
        rowNumber,
        column: headerByField.get('requirementId') ?? 'requirementId',
        field: 'requirementId',
        severity: 'warning',
        reason: message,
      })
    })
  })
  return out
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
    if (!format) return <FileUp size={48} className="text-ink-faint" strokeWidth={1.75} />
    if (format === 'csv') return <FileText size={48} className="text-status-success" strokeWidth={1.75} />
    if (format === 'excel') return <FileSpreadsheet size={48} className="text-status-success" strokeWidth={1.75} />
    return <File size={48} className="text-ink-muted" strokeWidth={1.75} />
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="Upload a spreadsheet"
      onClick={() => document.getElementById('file-upload')?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          document.getElementById('file-upload')?.click()
        }
      }}
      className={clsx(
        'border-2 border-dashed rounded-md p-12 text-center transition-colors cursor-pointer',
        isDragging
          ? 'border-accent-primary bg-surface-inset'
          : 'border-default hover:border-strong'
      )}
    >
      <input
        type="file"
        id="file-upload"
        accept=".csv,.xlsx,.xls,.json,.reqif,.xml"
        onChange={handleFileInput}
        className="sr-only"
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        {selectedFile ? (
          <div className="space-y-2">
            {getFormatIcon()}
            <p className="text-sm font-medium text-ink-primary">
              {selectedFile.name}
            </p>
            <p className="text-xs text-ink-muted">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <FileUp size={48} className="mx-auto text-ink-faint" strokeWidth={1.75} />
            <p className="text-sm text-ink-muted">
              Drag and drop a file here, or click to browse
            </p>
            <p className="text-xs text-ink-faint">
              Excel (.xlsx), CSV, JSON, or ReqIF.
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
  isExcel: boolean
}

function ColumnMappingStep({
  fileColumns,
  columnMapping,
  onMappingChange,
  onNext,
  onBack,
  isExcel,
}: ColumnMappingStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const updateMapping = (fileColumn: string, requirementField: string | null) => {
    const newMapping = new Map(columnMapping)
    newMapping.set(fileColumn, requirementField)
    onMappingChange(newMapping)
  }

  const unmappedCount = Array.from(columnMapping.values()).filter((v) => v === null).length

  return (
    <div className="space-y-6">
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-ink-primary mb-2 outline-none"
        >
          Map columns to fields
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          Match each spreadsheet column to a requirement field. Required fields are marked *.
        </p>
        {unmappedCount > 0 && (
          <div className="mb-4 p-3 bg-status-warning/10 border border-status-warning/30 rounded-sm">
            <p className="text-sm text-ink-primary">
              {unmappedCount} {unmappedCount === 1 ? 'column is' : 'columns are'} not mapped. They
              will be ignored on import.
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
              className="flex items-center gap-4 p-3 border border-default rounded-sm"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-primary">{fileCol}</p>
              </div>
              <ChevronRight size={14} className="text-ink-faint" strokeWidth={1.75} />
              <div className="flex-1">
                <select
                  value={currentMapping || ''}
                  onChange={(e) => updateMapping(fileCol, e.target.value || null)}
                  aria-label={`Field for column ${fileCol}`}
                  className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
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

      <div className="flex items-center justify-between pt-4 border-t border-default">
        <button
          onClick={onBack}
          className="px-4 py-2 text-ink-muted hover:bg-surface-inset rounded-sm flex items-center gap-2"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Back
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm flex items-center gap-2"
        >
          {isExcel ? 'Next: Preview' : 'Next: Preview & Review'}
          <ChevronRight size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}

/**
 * #450 — the per-cell validation report. A real `<table>` with a `<caption>`
 * and `<th scope="col">` headers; severity is conveyed by an icon AND a visible
 * text label (never colour alone) so it survives greyscale / colourblindness.
 * Errors sort before warnings, then by spreadsheet row. Import-local — not a
 * shared component (Design reuse-audit).
 */
function CellValidationTable({ findings }: { findings: XlsxCellError[] }) {
  const sorted = useMemo(() => {
    return [...findings].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
      return a.rowNumber - b.rowNumber
    })
  }, [findings])

  if (sorted.length === 0) return null

  return (
    <div className="border border-default rounded-sm overflow-hidden">
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Per-cell validation findings</caption>
          <thead className="bg-surface-inset sticky top-0">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-muted">
                Severity
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-muted">
                Row
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-muted">
                Column
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-muted">
                Field
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-muted">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-default">
            {sorted.map((f, i) => (
              <tr key={i}>
                <td className="px-3 py-2 whitespace-nowrap">
                  {f.severity === 'error' ? (
                    <span className="inline-flex items-center gap-1 text-status-danger">
                      <AlertCircle size={14} strokeWidth={1.75} />
                      Error
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-status-warning">
                      <AlertTriangle size={14} strokeWidth={1.75} />
                      Warning
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                  <span>{f.rowNumber}</span>
                  {f.sheetCell && (
                    <span className="ml-1.5 font-mono text-xs text-ink-faint">{f.sheetCell}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink-primary">{f.column}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink-muted">{f.field}</td>
                <td className="px-3 py-2 text-ink-primary">{f.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  isExcel: boolean
  previewCellErrors: XlsxCellError[]
}

function PreviewStep({
  parsedRows,
  stats,
  onRowActionChange,
  onBulkAction,
  onImport,
  onBack,
  isImporting,
  isExcel,
  previewCellErrors,
}: PreviewStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // #450 — partial-success forecast for the Excel path.
  const rowsWithError = useMemo(
    () => new Set(previewCellErrors.filter((e) => e.severity === 'error').map((e) => e.rowNumber)),
    [previewCellErrors],
  )
  const rowsWithWarning = useMemo(
    () => new Set(previewCellErrors.filter((e) => e.severity === 'warning').map((e) => e.rowNumber)),
    [previewCellErrors],
  )
  const willImport = stats.total - rowsWithError.size
  const summaryLine =
    rowsWithError.size === 0 && rowsWithWarning.size === 0
      ? `${stats.total} of ${stats.total} rows will import. No errors.`
      : `${willImport} of ${stats.total} rows will import` +
        (rowsWithError.size > 0
          ? ` — ${rowsWithError.size} ${rowsWithError.size === 1 ? 'row has' : 'rows have'} errors`
          : '') +
        (rowsWithWarning.size > 0
          ? `${rowsWithError.size > 0 ? ',' : ' —'} ${rowsWithWarning.size} ${
              rowsWithWarning.size === 1 ? 'row has' : 'rows have'
            } warnings`
          : '') +
        '.'

  return (
    <div className="space-y-6">
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-ink-primary mb-2 outline-none"
        >
          Preview & Review
        </h3>
        <p className="text-sm text-ink-muted mb-4">
          {isExcel
            ? 'Review the validation findings, then import. Rows with errors are skipped; warnings are advisory.'
            : 'Review the parsed data and choose an action for each row'}
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-surface-inset rounded-sm">
          <p className="text-xs text-ink-muted">Total Rows</p>
          <p className="text-lg font-semibold text-ink-primary">{stats.total}</p>
        </div>
        <div className="p-3 bg-status-success/10 rounded-sm">
          <p className="text-xs text-ink-muted">Valid</p>
          <p className="text-lg font-semibold text-status-success">{stats.valid}</p>
        </div>
        <div className="p-3 bg-status-danger/10 rounded-sm">
          <p className="text-xs text-ink-muted">Errors</p>
          <p className="text-lg font-semibold text-status-danger">{stats.errors}</p>
        </div>
        <div className="p-3 bg-status-warning/10 rounded-sm">
          <p className="text-xs text-ink-muted">Duplicates</p>
          <p className="text-lg font-semibold text-status-warning">{stats.duplicates}</p>
        </div>
      </div>

      {/* #450 — Excel: partial-success summary + per-cell validation table. */}
      {isExcel && (
        <div className="space-y-3">
          <div
            aria-live="polite"
            className="p-3 bg-surface-inset border border-default rounded-sm text-sm text-ink-primary"
          >
            {rowsWithError.size === 0 && rowsWithWarning.size === 0 ? (
              <span>
                <span className="font-semibold text-status-success">{stats.total}</span> of{' '}
                {stats.total} rows will import. No errors.
              </span>
            ) : (
              <span>
                <span className="font-semibold text-status-success">{willImport}</span> of{' '}
                {stats.total} rows will import
                {rowsWithError.size > 0 && (
                  <>
                    {' — '}
                    <span className="font-semibold text-status-danger">{rowsWithError.size}</span>{' '}
                    {rowsWithError.size === 1 ? 'row has' : 'rows have'} errors
                  </>
                )}
                {rowsWithWarning.size > 0 && (
                  <>
                    {rowsWithError.size > 0 ? ', ' : ' — '}
                    <span className="font-semibold text-status-warning">
                      {rowsWithWarning.size}
                    </span>{' '}
                    {rowsWithWarning.size === 1 ? 'row has' : 'rows have'} warnings
                  </>
                )}
                .
              </span>
            )}
          </div>
          <CellValidationTable findings={previewCellErrors} />
        </div>
      )}

      {/* Non-Excel: the classic per-row bulk-action table. */}
      {!isExcel && (
        <NonExcelPreviewTable
          parsedRows={parsedRows}
          onRowActionChange={onRowActionChange}
          onBulkAction={onBulkAction}
        />
      )}

      {/* Action Summary */}
      <div className="flex items-center justify-between p-3 bg-surface-inset rounded-sm">
        <div className="flex items-center gap-4 text-sm text-ink-primary">
          <span>
            <span className="font-semibold text-status-success">{stats.toCreate}</span> to create
          </span>
          <span>
            <span className="font-semibold text-accent-primary">{stats.toUpdate}</span> to update
          </span>
          <span>
            <span className="font-semibold text-ink-muted">{stats.toSkip}</span> to skip
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-default">
        <button
          onClick={onBack}
          disabled={isImporting}
          className="px-4 py-2 text-ink-muted hover:bg-surface-inset rounded-sm flex items-center gap-2 disabled:opacity-50"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Back
        </button>
        <button
          onClick={onImport}
          disabled={isImporting || stats.toCreate + stats.toUpdate === 0}
          className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover disabled:opacity-50 text-white rounded-sm flex items-center gap-2"
          title={isExcel ? summaryLine : undefined}
        >
          {isImporting ? (
            <>
              <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              {isExcel ? `Validating ${stats.total} rows…` : 'Importing…'}
            </>
          ) : (
            <>
              <FileUp size={14} strokeWidth={1.75} />
              Import {stats.toCreate + stats.toUpdate} {stats.toCreate + stats.toUpdate === 1 ? 'Requirement' : 'Requirements'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/** The classic per-row bulk-action preview table — CSV/JSON path, unchanged. */
function NonExcelPreviewTable({
  parsedRows,
  onRowActionChange,
  onBulkAction,
}: {
  parsedRows: ParsedRow[]
  onRowActionChange: (index: number, action: 'create' | 'update' | 'skip') => void
  onBulkAction: (action: 'create' | 'update' | 'skip') => void
}) {
  return (
    <>
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
    </>
  )
}

// Import Results Step Component
interface ImportResultsStepProps {
  result: ImportResult
  onClose: () => void
  onExportErrors: () => void
}

function ImportResultsStep({ result, onClose, onExportErrors }: ImportResultsStepProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const hasCellReport = (result.cellErrors && result.cellErrors.length > 0) ||
    (result.qualityWarnings && result.qualityWarnings.length > 0)
  const allFindings: XlsxCellError[] = [
    ...(result.cellErrors ?? []),
    ...(result.qualityWarnings ?? []),
  ]
  const total = result.created + result.updated + result.skipped

  return (
    <div className="space-y-6">
      <div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-ink-primary mb-2 outline-none"
        >
          Import complete
        </h3>
        <p className="text-sm text-ink-muted" aria-live="polite">
          {result.rolledBack
            ? result.rolledBackMessage ||
              'Import rolled back: a requirement is locked. No rows were written. Unlock it and re-import.'
            : result.skipped > 0
              ? `${result.created + result.updated} rows imported. ${result.skipped} ${
                  result.skipped === 1 ? 'row was' : 'rows were'
                } skipped — see the report below.`
              : `All ${total} rows imported. ${result.created} created, ${result.updated} updated.`}
        </p>
      </div>

      {/* Rolled-back banner — a DB-level fault wrote nothing (#450 AC #6). */}
      {result.rolledBack && (
        <div className="p-4 bg-status-danger/10 border border-status-danger/30 rounded-sm">
          <p className="text-sm text-ink-primary flex items-start gap-2">
            <AlertCircle size={16} className="text-status-danger flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            {result.rolledBackMessage ||
              'A requirement was locked and the import was rolled back. No rows were written.'}
          </p>
        </div>
      )}

      {/* Results Summary */}
      {!result.rolledBack && (
        <div className={clsx('grid gap-4', result.linksCreated != null ? 'grid-cols-4' : 'grid-cols-3')}>
          <div className="p-4 bg-status-success/10 rounded-sm text-center">
            <CheckCircle size={28} className="mx-auto mb-2 text-status-success" strokeWidth={1.75} />
            <p className="text-2xl font-bold text-status-success">{result.created}</p>
            <p className="text-sm text-ink-muted">Created</p>
          </div>
          <div className="p-4 bg-accent-primary/10 rounded-sm text-center">
            <CheckCircle size={28} className="mx-auto mb-2 text-accent-primary" strokeWidth={1.75} />
            <p className="text-2xl font-bold text-accent-primary">{result.updated}</p>
            <p className="text-sm text-ink-muted">Updated</p>
          </div>
          <div className="p-4 bg-surface-inset rounded-sm text-center">
            <AlertCircle size={28} className="mx-auto mb-2 text-ink-muted" strokeWidth={1.75} />
            <p className="text-2xl font-bold text-ink-muted">{result.skipped}</p>
            <p className="text-sm text-ink-muted">Skipped</p>
          </div>
          {result.linksCreated != null && (
            <div className="p-4 bg-surface-inset rounded-sm text-center">
              <CheckCircle size={28} className="mx-auto mb-2 text-accent-primary" strokeWidth={1.75} />
              <p className="text-2xl font-bold text-accent-primary">{result.linksCreated}</p>
              <p className="text-sm text-ink-muted">Links created</p>
            </div>
          )}
        </div>
      )}

      {/* #450 — Excel: the per-cell validation report (errors + warnings). */}
      {hasCellReport && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-ink-primary">
              Validation findings ({allFindings.length})
            </h4>
            <button
              onClick={onExportErrors}
              className="px-3 py-1 text-xs border border-default text-ink-muted hover:bg-surface-inset rounded-sm flex items-center gap-1"
            >
              <Download size={12} strokeWidth={1.75} />
              Export report
            </button>
          </div>
          <CellValidationTable findings={allFindings} />
        </div>
      )}

      {/* Non-Excel errors (ReqIF / CSV bulk-import) */}
      {!hasCellReport && result.errors.length > 0 && (
        <div className="p-4 bg-status-danger/10 border border-status-danger/30 rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-ink-primary">Errors ({result.errors.length})</h4>
            <button
              onClick={onExportErrors}
              className="px-3 py-1 text-xs border border-default text-ink-muted hover:bg-surface-inset rounded-sm flex items-center gap-1"
            >
              <Download size={12} strokeWidth={1.75} />
              Export Report
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {result.errors.map((error, index) => (
              <p key={index} className="text-sm text-ink-primary">
                Row {error.row + 1}: {error.errors.join('; ')}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {!result.rolledBack && !hasCellReport && result.errors.length === 0 && (
        <div className="p-4 bg-status-success/10 border border-status-success/30 rounded-sm">
          <p className="text-sm text-ink-primary">
            All requirements were imported successfully.
          </p>
        </div>
      )}

      {/* Close Button */}
      <div className="flex items-center justify-end pt-4 border-t border-default">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}
