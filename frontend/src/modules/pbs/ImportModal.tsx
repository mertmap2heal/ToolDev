import { useState, useRef, useCallback } from 'react'
import { X, Upload, AlertTriangle, CheckCircle, FileJson, FileText } from 'lucide-react'
import Papa from 'papaparse'
import clsx from 'clsx'
import type { PBSNode, PBSChangeLogEntry } from './types'
import { PBS_TYPES, PBS_STATUSES } from './types'

interface ImportModalProps {
  isOpen: boolean
  currentNodeCount: number
  onImport: (nodes: PBSNode[], changeLog: PBSChangeLogEntry[], mode: 'replace' | 'merge') => void
  onCancel: () => void
}

interface ParsedData {
  nodes: PBSNode[]
  changeLog: PBSChangeLogEntry[]
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  data: ParsedData | null
}

function validateImportData(data: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid JSON structure'], warnings: [], data: null }
  }

  const obj = data as Record<string, unknown>

  // Check for nodes array
  if (!Array.isArray(obj.nodes)) {
    errors.push('Missing or invalid "nodes" array')
    return { valid: false, errors, warnings, data: null }
  }

  // Validate each node
  const validNodes: PBSNode[] = []
  const nodeIds = new Set<string>()

  for (let i = 0; i < obj.nodes.length; i++) {
    const node = obj.nodes[i] as Record<string, unknown>
    const nodeErrors: string[] = []

    // Required fields
    if (typeof node.id !== 'string' || !node.id) {
      nodeErrors.push('missing id')
    } else if (nodeIds.has(node.id)) {
      nodeErrors.push('duplicate id')
    } else {
      nodeIds.add(node.id)
    }

    if (typeof node.name !== 'string') {
      nodeErrors.push('missing name')
    }

    if (typeof node.pbsCode !== 'string') {
      nodeErrors.push('missing pbsCode')
    }

    if (typeof node.type !== 'string' || !PBS_TYPES.includes(node.type as never)) {
      warnings.push(`Node ${i + 1}: invalid type "${node.type}", defaulting to "System"`)
      node.type = 'System'
    }

    if (typeof node.status !== 'string' || !PBS_STATUSES.includes(node.status as never)) {
      warnings.push(`Node ${i + 1}: invalid status "${node.status}", defaulting to "Draft"`)
      node.status = 'Draft'
    }

    if (nodeErrors.length > 0) {
      errors.push(`Node ${i + 1}: ${nodeErrors.join(', ')}`)
    } else {
      // Build valid node with defaults for optional fields
      validNodes.push({
        id: node.id as string,
        parentId: (node.parentId as string | null) ?? null,
        name: node.name as string,
        pbsCode: node.pbsCode as string,
        type: node.type as PBSNode['type'],
        status: node.status as PBSNode['status'],
        description: (node.description as string) ?? '',
        tags: Array.isArray(node.tags) ? (node.tags as string[]) : [],
        attributes: Array.isArray(node.attributes) ? (node.attributes as PBSNode['attributes']) : [],
        relationships: Array.isArray(node.relationships) ? (node.relationships as PBSNode['relationships']) : [],
        attachments: Array.isArray(node.attachments) ? (node.attachments as PBSNode['attachments']) : [],
        orderIndex: typeof node.orderIndex === 'number' ? node.orderIndex : 0,
        revision: typeof node.revision === 'number' ? node.revision : 1,
        createdAt: typeof node.createdAt === 'string' ? node.createdAt : new Date().toISOString(),
        updatedAt: typeof node.updatedAt === 'string' ? node.updatedAt : new Date().toISOString(),
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, data: null }
  }

  // Validate parent references
  for (const node of validNodes) {
    if (node.parentId && !nodeIds.has(node.parentId)) {
      warnings.push(`Node "${node.name}": parent "${node.parentId}" not found, will be root`)
      node.parentId = null
    }
  }

  // Parse changelog (optional)
  let changeLog: PBSChangeLogEntry[] = []
  if (Array.isArray(obj.changeLog)) {
    changeLog = obj.changeLog.filter((entry): entry is PBSChangeLogEntry => {
      const e = entry as Record<string, unknown>
      return (
        typeof e.id === 'string' &&
        typeof e.nodeId === 'string' &&
        typeof e.action === 'string' &&
        typeof e.timestamp === 'string'
      )
    })
    if (changeLog.length < obj.changeLog.length) {
      warnings.push(`${obj.changeLog.length - changeLog.length} changelog entries were invalid and skipped`)
    }
  }

  return {
    valid: true,
    errors: [],
    warnings,
    data: { nodes: validNodes, changeLog },
  }
}

function validateCSVData(rows: any[]): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!Array.isArray(rows) || rows.length === 0) {
    return { valid: false, errors: ['CSV file is empty'], warnings: [], data: null }
  }

  // Check headers
  const requiredHeaders = ['PBS ID', 'Name', 'Type', 'Status', 'Path']
  const firstRow = rows[0]
  const missingHeaders = requiredHeaders.filter(h => !(h in firstRow))

  if (missingHeaders.length > 0) {
    return { valid: false, errors: [`Missing headers: ${missingHeaders.join(', ')}`], warnings: [], data: null }
  }

  const nodes: PBSNode[] = []
  // Map to store generated IDs for paths: "System / Subsystem" -> UUID
  const pathToIdMap = new Map<string, string>()
  const rootNodes: PBSNode[] = []

  // First pass: Generate IDs for all paths and create nodes
  rows.forEach((row, index) => {
    const pathStr = (row['Path'] || '').trim()
    const name = (row['Name'] || '').trim()
    const pbsCode = (row['PBS ID'] || '').trim()

    if (!pathStr) {
      warnings.push(`Row ${index + 1}: Missing path, skipping`)
      return
    }

    if (!name) {
      warnings.push(`Row ${index + 1}: Missing name, skipping`)
      return
    }

    // Generate specific ID for this node's path
    // We use the full path to uniquely identify it in the hierarchy
    const nodeId = crypto.randomUUID()
    pathToIdMap.set(pathStr, nodeId)

    // Determine parent path
    const pathParts = pathStr.split(' / ')
    const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join(' / ') : null

    const type = PBS_TYPES.includes(row['Type']) ? row['Type'] : 'System'
    if (row['Type'] && !PBS_TYPES.includes(row['Type'])) {
      warnings.push(`Row ${index + 1}: Invalid type "${row['Type']}", defaulting to "System"`)
    }

    const status = PBS_STATUSES.includes(row['Status']) ? row['Status'] : 'Draft'
    if (row['Status'] && !PBS_STATUSES.includes(row['Status'])) {
      warnings.push(`Row ${index + 1}: Invalid status "${row['Status']}", defaulting to "Draft"`)
    }

    nodes.push({
      id: nodeId,
      parentId: null, // Will resolve in second pass
      name,
      pbsCode: pbsCode || `PBS-${index + 1}`,
      type: type as any,
      status: status as any,
      description: '',
      tags: [],
      attributes: [],
      relationships: [],
      attachments: [],
      orderIndex: index,
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Store temp path for second pass
      _tempPath: pathStr,
      _tempParentPath: parentPath
    } as any)
  })

  // Second pass: Resolve parent references
  nodes.forEach(node => {
    const anyNode = node as any
    if (anyNode._tempParentPath) {
      const parentId = pathToIdMap.get(anyNode._tempParentPath)
      if (parentId) {
        node.parentId = parentId
      } else {
        // Parent not found in CSV - treat as root or warn?
        // For now, treat as root if parent path is missing (maybe top of imported tree)
        // But if it had a path like "Root / Child", "Root" should exist
        warnings.push(`Node "${node.name}": Parent at path "${anyNode._tempParentPath}" not found in CSV. verify export contains all ancestors.`)
      }
    }
    // Clean up temp props
    delete anyNode._tempPath
    delete anyNode._tempParentPath
  })

  if (nodes.length === 0) {
    return { valid: false, errors: ['No valid nodes found in CSV'], warnings, data: null }
  }

  return {
    valid: true,
    errors,
    warnings,
    data: {
      nodes,
      changeLog: [] // CSV import doesn't preserve changelog
    }
  }
}

export default function ImportModal({
  isOpen,
  currentNodeCount,
  onImport,
  onCancel,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((selectedFile: File | null) => {
    setFile(selectedFile)
    setValidation(null)

    if (!selectedFile) return

    setIsProcessing(true)
    if (selectedFile.name.endsWith('.csv')) {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const result = validateCSVData(results.data)
          setValidation(result)
          setIsProcessing(false)
        },
        error: (error) => {
          setValidation({
            valid: false,
            errors: [`Failed to parse CSV: ${error.message}`],
            warnings: [],
            data: null,
          })
          setIsProcessing(false)
        }
      })
      return
    }

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = JSON.parse(text)
        const result = validateImportData(parsed)
        setValidation(result)
      } catch {
        setValidation({
          valid: false,
          errors: ['Failed to parse JSON file'],
          warnings: [],
          data: null,
        })
      } finally {
        setIsProcessing(false)
      }
    }

    reader.onerror = () => {
      setValidation({
        valid: false,
        errors: ['Failed to read file'],
        warnings: [],
        data: null,
      })
      setIsProcessing(false)
    }

    reader.readAsText(selectedFile)
  }, [])

  const handleImport = useCallback(() => {
    if (!validation?.data) return
    onImport(validation.data.nodes, validation.data.changeLog, importMode)
  }, [validation, importMode, onImport])

  const handleClose = useCallback(() => {
    setFile(null)
    setValidation(null)
    setImportMode('replace')
    onCancel()
  }, [onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Import PBS Data
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select JSON file
            </label>
            <div
              className={clsx(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                file
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json,.csv,text/csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                  {file.name.endsWith('.csv') ? <FileText size={24} /> : <FileJson size={24} />}
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="text-gray-500 dark:text-gray-400">
                  <Upload size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Click to select a JSON or CSV file</p>
                  <p className="text-xs mt-1">Exported from PBS Export</p>
                </div>
              )}
            </div>
          </div>

          {/* Processing indicator */}
          {isProcessing && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              Validating file...
            </div>
          )}

          {/* Validation results */}
          {validation && !isProcessing && (
            <div className="space-y-3">
              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium mb-2">
                    <AlertTriangle size={16} />
                    Validation errors
                  </div>
                  <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 list-disc list-inside">
                    {validation.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {validation.errors.length > 5 && (
                      <li>...and {validation.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium mb-2">
                    <AlertTriangle size={16} />
                    Warnings
                  </div>
                  <ul className="text-sm text-amber-600 dark:text-amber-400 space-y-1 list-disc list-inside">
                    {validation.warnings.slice(0, 3).map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                    {validation.warnings.length > 3 && (
                      <li>...and {validation.warnings.length - 3} more warnings</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Success preview */}
              {validation.valid && validation.data && (
                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium mb-2">
                    <CheckCircle size={16} />
                    File validated successfully
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400 space-y-1">
                    <p>{validation.data.nodes.length} components found</p>
                    <p>{validation.data.changeLog.length} changelog entries</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import mode selection */}
          {validation?.valid && validation.data && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Import mode
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Replace all</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Replace current {currentNodeCount} components with imported data
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Merge</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Add imported components to existing data (duplicates by ID will be updated)
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!validation?.valid || !validation.data}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg',
              validation?.valid && validation.data
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            )}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
