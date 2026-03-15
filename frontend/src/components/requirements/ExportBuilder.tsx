import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, FileSpreadsheet, FileText, File, CheckSquare, Square, Code } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { Requirement, SystemFunction } from 'shared/types/engineering.types'
import type { Link } from 'shared/types/linkage.types'
import { format } from 'date-fns'
import clsx from 'clsx'
import { buildRequirementsDocx, type DocxRequirementRow } from '../../utils/exportDocx'
import { parameterService } from '../../services/parameter.service'
import { definitionEntryService } from '../../services/definitionEntry.service'
import { resolveParameterPlaceholders } from '../../utils/parameterPlaceholder'
import type { ResolveMode } from '../../utils/parameterPlaceholder'
import type { DefinitionEntry } from 'shared/types/engineering.types'

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

interface ComponentTreeNode {
  id: string
  name: string
  pbsCode?: string
  children?: ComponentTreeNode[]
}

interface ExportBuilderProps {
  requirements: Requirement[]
  projectName?: string
  projectId: string
  onClose: () => void
  /** Scope label for enterprise export (e.g. "Component: ABC-001" or "Function: Main Control") */
  scopeLabel?: string
  /** Optional filename suffix for scoped exports (e.g. "Component_ABC001") */
  scopeFilenameSuffix?: string
  /** Allow user to choose scope (All / Component / Function) inside the modal */
  enableScopeSelection?: boolean
  componentTree?: ComponentTreeNode[]
  functions?: SystemFunction[]
  allocationLinks?: Link[]
}

type ExportFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'reqif'

interface ExportColumn {
  key: keyof Requirement | 'requirementId'
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
function flattenComponentTree(nodes: ComponentTreeNode[], parentPath: string[] = []): { id: string; name: string; displayLabel: string }[] {
  const result: { id: string; name: string; displayLabel: string }[] = []
  for (const node of nodes) {
    const path = [...parentPath, node.name]
    const displayLabel = path.join(' > ')
    result.push({ id: node.id, name: node.name, displayLabel })
    if (node.children?.length) {
      result.push(...flattenComponentTree(node.children, path))
    }
  }
  return result
}

function flattenFunctionTree(fns: SystemFunction[]): { id: string; name: string; displayLabel: string }[] {
  type Node = { fn: SystemFunction; children: Node[] }
  const map = new Map<string, Node>()
  for (const fn of fns) {
    map.set(fn.id, { fn, children: [] })
  }
  const roots: Node[] = []
  for (const fn of fns) {
    const entry = map.get(fn.id)!
    if (fn.parentId && map.has(fn.parentId)) {
      map.get(fn.parentId)!.children.push(entry)
    } else {
      roots.push(entry)
    }
  }
  const sortNodes = (nodes: Node[]) => {
    nodes.sort((a, b) => (a.fn.sortOrder ?? 0) - (b.fn.sortOrder ?? 0))
    nodes.forEach((n) => sortNodes(n.children))
  }
  sortNodes(roots)
  const result: { id: string; name: string; displayLabel: string }[] = []
  const walk = (list: Node[], path: string[] = []) => {
    for (const { fn, children } of list) {
      const label = fn.name || fn.functionId || fn.id
      const p = [...path, label]
      result.push({ id: fn.id, name: label, displayLabel: p.join(' > ') })
      if (children?.length) walk(children, p)
    }
  }
  walk(roots)
  return result
}

export default function ExportBuilder({
  requirements,
  projectName,
  projectId,
  onClose,
  scopeLabel: propsScopeLabel,
  scopeFilenameSuffix: propsScopeFilenameSuffix,
  enableScopeSelection,
  componentTree = [],
  functions = [],
  allocationLinks = [],
}: ExportBuilderProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')
  const [columns, setColumns] = useState<ExportColumn[]>(defaultColumns)
  const [includeHeader, setIncludeHeader] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [parameterExportMode, setParameterExportMode] = useState<ResolveMode>('name')
  const [scopeType, setScopeType] = useState<'all' | 'component' | 'function'>('all')
  const [selectedComponentId, setSelectedComponentId] = useState<string>('')
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>('')
  const [componentSearch, setComponentSearch] = useState('')
  const [functionSearch, setFunctionSearch] = useState('')
  const [includeGlossary, setIncludeGlossary] = useState(true)
  const [includeAbbreviations, setIncludeAbbreviations] = useState(true)
  const [glossaryShowDefinitions, setGlossaryShowDefinitions] = useState(true)
  const [glossarySortAlphabetically, setGlossarySortAlphabetically] = useState(true)

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await parameterService.getParameters(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId,
  })
  const parameterMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; defaultValue?: string | null; unit?: string | null; tolerance?: string | null }>()
    parameters.forEach((p) => m.set(p.id.toLowerCase(), { id: p.id, name: p.name, defaultValue: p.defaultValue, unit: p.unit, tolerance: p.tolerance }))
    return m
  }, [parameters])

  const { data: definitionEntries = [] } = useQuery({
    queryKey: ['definitions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await definitionEntryService.getDefinitionEntries(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId,
  })

  const flatComponents = useMemo(() => flattenComponentTree(componentTree), [componentTree])
  const flatFunctions = useMemo(() => flattenFunctionTree(functions), [functions])
  const filteredComponents = useMemo(
    () =>
      componentSearch
        ? flatComponents.filter(
            (c) =>
              c.displayLabel.toLowerCase().includes(componentSearch.toLowerCase()) ||
              c.name.toLowerCase().includes(componentSearch.toLowerCase())
          )
        : flatComponents,
    [flatComponents, componentSearch]
  )
  const filteredFunctions = useMemo(
    () =>
      functionSearch
        ? flatFunctions.filter(
            (f) =>
              f.displayLabel.toLowerCase().includes(functionSearch.toLowerCase()) ||
              f.name.toLowerCase().includes(functionSearch.toLowerCase())
          )
        : flatFunctions,
    [flatFunctions, functionSearch]
  )

  const effectiveRequirements = useMemo(() => {
    if (!enableScopeSelection) return requirements
    if (scopeType === 'all') return requirements
    if (scopeType === 'component' && selectedComponentId) {
      return requirements.filter((r) => r.componentId === selectedComponentId)
    }
    if (scopeType === 'function' && selectedFunctionId) {
      return requirements.filter((r) =>
        allocationLinks.some(
          (l) =>
            l.sourceType === 'requirement' &&
            l.targetType === 'function' &&
            l.targetId === selectedFunctionId &&
            l.linkType === 'allocated_to' &&
            l.sourceId === r.id
        )
      )
    }
    return requirements
  }, [enableScopeSelection, requirements, scopeType, selectedComponentId, selectedFunctionId, allocationLinks])

  const effectiveScopeLabel = useMemo(() => {
    if (propsScopeLabel) return propsScopeLabel
    if (!enableScopeSelection || scopeType === 'all') return undefined
    if (scopeType === 'component' && selectedComponentId) {
      const c = flatComponents.find((x) => x.id === selectedComponentId)
      return c ? `Component: ${c.displayLabel}` : undefined
    }
    if (scopeType === 'function' && selectedFunctionId) {
      const f = flatFunctions.find((x) => x.id === selectedFunctionId)
      return f ? `Function: ${f.displayLabel}` : undefined
    }
    return undefined
  }, [enableScopeSelection, propsScopeLabel, scopeType, selectedComponentId, selectedFunctionId, flatComponents, flatFunctions])

  const effectiveScopeFilenameSuffix = useMemo(() => {
    if (propsScopeFilenameSuffix) return propsScopeFilenameSuffix
    if (!effectiveScopeLabel) return undefined
    return `${scopeType}_${effectiveScopeLabel
      .replace(/^[^:]+:\s*/, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 40)}`
  }, [propsScopeFilenameSuffix, effectiveScopeLabel, scopeType])

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
    let value = req[key as keyof Requirement]
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    let str = String(value)
    if ((key === 'title' || key === 'description' || key === 'acceptanceCriteria') && str.includes('{{param:') && parameterMap.size > 0) {
      str = resolveParameterPlaceholders(str, parameterMap, parameterExportMode)
    }
    return str
  }

  // Strip HTML tags from description
  const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  }

  const combinedDescriptionText = useMemo(() => {
    return effectiveRequirements
      .map((r) => {
        let desc = r.description || ''
        if (desc.includes('{{param:') && parameterMap.size > 0) {
          desc = resolveParameterPlaceholders(desc, parameterMap, parameterExportMode)
        }
        return stripHtml(desc)
      })
      .join('\n')
  }, [effectiveRequirements, parameterMap, parameterExportMode])

  const usedGlossaryEntries = useMemo(() => {
    if (!includeGlossary || definitionEntries.length === 0) return []
    const glossary = (definitionEntries as DefinitionEntry[]).filter((e) => e.type === 'glossary')
    const used = glossary.filter((d) => combinedDescriptionText.includes(d.term))
    return glossarySortAlphabetically ? [...used].sort((a, b) => a.term.localeCompare(b.term)) : used
  }, [definitionEntries, includeGlossary, glossarySortAlphabetically, combinedDescriptionText])

  const usedAbbreviationEntries = useMemo(() => {
    if (!includeAbbreviations || definitionEntries.length === 0) return []
    const abbreviations = (definitionEntries as DefinitionEntry[]).filter((e) => e.type === 'abbreviation')
    const used = abbreviations.filter((d) => combinedDescriptionText.includes(d.term))
    return glossarySortAlphabetically ? [...used].sort((a, b) => a.term.localeCompare(b.term)) : used
  }, [definitionEntries, includeAbbreviations, glossarySortAlphabetically, combinedDescriptionText])

  // Export to CSV
  const exportCsv = () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = selectedCols.map((c) => c.label)
    const rows = effectiveRequirements.map((req) =>
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

    const baseName = effectiveScopeFilenameSuffix ? `requirements_export_${effectiveScopeFilenameSuffix}` : 'requirements_export'
    downloadFile(csvContent, `${baseName}.csv`, 'text/csv')
  }

  // Export to Excel
  const exportExcel = () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = selectedCols.map((c) => c.label)
    const data = effectiveRequirements.map((req) =>
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

    if (includeGlossary && usedGlossaryEntries.length > 0) {
      const glossaryData = usedGlossaryEntries.map((e) =>
        glossaryShowDefinitions
          ? { Term: e.term, Definition: (e.definition || '').replace(/<[^>]*>/g, '').trim() }
          : { Term: e.term }
      )
      const wsGlossary = XLSX.utils.json_to_sheet(glossaryData)
      XLSX.utils.book_append_sheet(workbook, wsGlossary, 'Glossary')
    }
    if (includeAbbreviations && usedAbbreviationEntries.length > 0) {
      const abbrData = usedAbbreviationEntries.map((e) =>
        glossaryShowDefinitions
          ? { Term: e.term, Definition: (e.definition || '').replace(/<[^>]*>/g, '').trim() }
          : { Term: e.term }
      )
      const wsAbbr = XLSX.utils.json_to_sheet(abbrData)
      XLSX.utils.book_append_sheet(workbook, wsAbbr, 'Abbreviations')
    }

    const baseName = effectiveScopeFilenameSuffix ? `requirements_export_${effectiveScopeFilenameSuffix}` : 'requirements_export'
    XLSX.writeFile(workbook, `${baseName}.xlsx`)
  }

  // Export to Word (DOCX)
  const exportWord = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    const docxColumns = selectedCols.map((c) => ({ key: c.key, label: c.label }))
    const rows: DocxRequirementRow[] = effectiveRequirements.map((req) => {
      const row: DocxRequirementRow = {}
      selectedCols.forEach((col) => {
        let value = getValue(req, col.key)
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
        }
        row[col.key] = value
      })
      return row
    })
    const blob = await buildRequirementsDocx({
      title: projectName ? `${projectName} - Requirements Export` : 'Requirements Export',
      requirements: rows,
      columns: docxColumns,
      stripHtml: (s) => stripHtml(s),
    })
    const baseName = effectiveScopeFilenameSuffix ? `requirements_export_${effectiveScopeFilenameSuffix}` : 'requirements_export'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.docx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Export to ReqIF
  const exportReqIF = async () => {
    try {
      const requirementIds = effectiveRequirements.map((r) => r.id).join(',')
      const params = new URLSearchParams()
      if (requirementIds) params.set('requirementIds', requirementIds)
      params.set('parameterMode', parameterExportMode)
      const url = `/reqif/${projectId}/export?${params.toString()}`

      // Use fetch directly for blob response
      const token = localStorage.getItem('token')
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/v1' : 'http://localhost:5000/api/v1')
      const response = await fetch(`${apiBase}${url}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to export ReqIF: ${response.statusText}`)
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      const suffix = effectiveScopeFilenameSuffix ? `_${effectiveScopeFilenameSuffix}` : ''
      a.download = `requirements_${projectId}${suffix}_${Date.now()}.reqif`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (error: any) {
      console.error('ReqIF export error:', error)
      throw error
    }
  }

  // Export to PDF
  const exportPdf = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = selectedCols.map((c) => c.label)
    const data = effectiveRequirements.map((req) =>
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
    doc.text(`Total Requirements: ${effectiveRequirements.length}`, 14, 28)

    // Load and use autoTable
    const autoTable = await loadAutoTable()
    const tableResult = autoTable(doc, {
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

    let lastY = (tableResult as { finalY?: number }).finalY ?? 35

    const stripHtmlForPdf = (html: string) => (html || '').replace(/<[^>]*>/g, '').trim().slice(0, 200)

    if (includeGlossary && usedGlossaryEntries.length > 0) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text('Glossary', 14, 15)
      doc.setFontSize(10)
      const glossaryBody = usedGlossaryEntries.map((e) =>
        glossaryShowDefinitions
          ? [e.term, stripHtmlForPdf(e.definition)]
          : [e.term]
      )
      const glossaryHead = glossaryShowDefinitions ? [['Term', 'Definition']] : [['Term']]
      autoTable(doc, {
        head: glossaryHead,
        body: glossaryBody,
        startY: 22,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        columnStyles: glossaryShowDefinitions ? { 1: { cellWidth: 'wrap' } } : {},
      })
      lastY = (doc as any).lastAutoTable?.finalY ?? lastY
    }

    if (includeAbbreviations && usedAbbreviationEntries.length > 0) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text('Abbreviations', 14, 15)
      doc.setFontSize(10)
      const abbrBody = usedAbbreviationEntries.map((e) =>
        glossaryShowDefinitions
          ? [e.term, stripHtmlForPdf(e.definition)]
          : [e.term]
      )
      const abbrHead = glossaryShowDefinitions ? [['Term', 'Definition']] : [['Term']]
      autoTable(doc, {
        head: abbrHead,
        body: abbrBody,
        startY: 22,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
        columnStyles: glossaryShowDefinitions ? { 1: { cellWidth: 'wrap' } } : {},
      })
    }

    const baseName = effectiveScopeFilenameSuffix ? `requirements_export_${effectiveScopeFilenameSuffix}` : 'requirements_export'
    doc.save(`${baseName}.pdf`)
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

  const canExport =
    effectiveRequirements.length > 0 &&
    (!enableScopeSelection ||
      (scopeType === 'all') ||
      (scopeType === 'component' && !!selectedComponentId) ||
      (scopeType === 'function' && !!selectedFunctionId))

  // Handle export
  const handleExport = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    if (selectedCols.length === 0) {
      alert('Please select at least one column to export')
      return
    }
    if (!canExport) {
      if (scopeType === 'component') alert('Please select a component to export')
      else if (scopeType === 'function') alert('Please select a function to export')
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
        case 'word':
          await exportWord()
          break
        case 'reqif':
          await exportReqIF()
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
                Export Requirements{effectiveScopeLabel ? ` — ${effectiveScopeLabel}` : ''}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {effectiveRequirements.length} requirement{effectiveRequirements.length !== 1 ? 's' : ''} to export
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
          {/* Scope Selection */}
          {enableScopeSelection && (componentTree.length > 0 || flatFunctions.length > 0) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Scope
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={scopeType === 'all'}
                    onChange={() => {
                      setScopeType('all')
                      setSelectedComponentId('')
                      setSelectedFunctionId('')
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">All requirements</span>
                </label>
                {componentTree.length > 0 && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        checked={scopeType === 'component'}
                        onChange={() => {
                          setScopeType('component')
                          setSelectedFunctionId('')
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">By component</span>
                    </label>
                    {scopeType === 'component' && (
                      <div className="mt-2 ml-6">
                        <input
                          type="text"
                          placeholder="Search components..."
                          value={componentSearch}
                          onChange={(e) => setComponentSearch(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                        />
                        <select
                          value={selectedComponentId}
                          onChange={(e) => setSelectedComponentId(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white max-h-40 overflow-y-auto"
                        >
                          <option value="">— Select component —</option>
                          {filteredComponents.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.displayLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                {flatFunctions.length > 0 && (
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="scope"
                        checked={scopeType === 'function'}
                        onChange={() => {
                          setScopeType('function')
                          setSelectedComponentId('')
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">By function</span>
                    </label>
                    {scopeType === 'function' && (
                      <div className="mt-2 ml-6">
                        <input
                          type="text"
                          placeholder="Search functions..."
                          value={functionSearch}
                          onChange={(e) => setFunctionSearch(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                        />
                        <select
                          value={selectedFunctionId}
                          onChange={(e) => setSelectedFunctionId(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white max-h-40 overflow-y-auto"
                        >
                          <option value="">— Select function —</option>
                          {filteredFunctions.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.displayLabel}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-5 gap-2">
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
              <button
                onClick={() => setSelectedFormat('word')}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'word'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <FileText size={24} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Word</span>
              </button>
              <button
                onClick={() => setSelectedFormat('reqif')}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'reqif'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <Code size={24} className="text-purple-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">ReqIF</span>
              </button>
            </div>
          </div>

          {/* Parameter display in exported text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Parameter display
            </label>
            <select
              value={parameterExportMode}
              onChange={(e) => setParameterExportMode(e.target.value as ResolveMode)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="name">Names (e.g. MAX_CRUISE_SPEED)</option>
              <option value="resolved">Resolved values (e.g. 250 ±5 km/h)</option>
            </select>
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

          {/* Glossary & Abbreviations options */}
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Glossary & Abbreviations</span>
            <div className="space-y-1.5 pl-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGlossary}
                  onChange={(e) => setIncludeGlossary(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include Glossary (used terms only)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAbbreviations}
                  onChange={(e) => setIncludeAbbreviations(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include Abbreviations (used terms only)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={glossaryShowDefinitions}
                  onChange={(e) => setGlossaryShowDefinitions(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show definitions in export</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={glossarySortAlphabetically}
                  onChange={(e) => setGlossarySortAlphabetically(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Sort alphabetically</span>
              </label>
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
            disabled={isExporting || selectedCount === 0 || !canExport}
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
