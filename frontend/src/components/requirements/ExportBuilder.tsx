import { useState, useMemo, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, FileSpreadsheet, FileText, File, CheckSquare, Square, Code, ChevronRight, ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { Requirement, SystemFunction } from 'shared/types/engineering.types'
import type { Link } from 'shared/types/linkage.types'
import { format } from 'date-fns'
import clsx from 'clsx'
import { buildRequirementsDocx, buildRequirementsDocxWithSections, type DocxRequirementRow } from '../../utils/exportDocx'
import { parameterService } from '../../services/parameter.service'
import { definitionEntryService } from '../../services/definitionEntry.service'
import { resolveParameterPlaceholders } from '../../utils/parameterPlaceholder'
import type { ResolveMode } from '../../utils/parameterPlaceholder'
import type { DefinitionEntry } from 'shared/types/engineering.types'
import {
  getExportTemplates,
  saveExportTemplate,
  deleteExportTemplate,
  updateExportTemplate,
  mergeColumnsWithDefaults,
  DEFAULT_AUTHORITY_STYLE,
  getSectionsForPreset,
  type ExportTemplate,
  type ExportSection,
  type ExportDocumentStyle,
} from '../../utils/requirementExportTemplates'
import {
  getAuthorityTableStyles,
  getPdfFont,
  addCoverPage,
  addHeaderFooterToAllPages,
  addSectionHeading,
  addPlaceholderSection,
} from '../../utils/exportPdfLayout'

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

export type ExportStep = 'format' | 'scope' | 'options' | 'review'

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
  const [currentStep, setCurrentStep] = useState<ExportStep>('format')
  const [templates, setTemplates] = useState<ExportTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [scopeResetMessage, setScopeResetMessage] = useState<string | null>(null)
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateName, setEditingTemplateName] = useState('')
  const [sections, setSections] = useState<ExportSection[] | undefined>(undefined)
  const [documentStyle, setDocumentStyle] = useState<ExportDocumentStyle | undefined>(undefined)
  const [useDocumentSections, setUseDocumentSections] = useState(false)
  const [templateUpdatedMessage, setTemplateUpdatedMessage] = useState<string | null>(null)
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false)
  const [createTemplateFormat, setCreateTemplateFormat] = useState<ExportFormat>('pdf')
  const [createTemplatePreset, setCreateTemplatePreset] = useState<'authority' | 'simple' | 'full' | 'submission_with_placeholders'>('authority')
  const [createTemplateName, setCreateTemplateName] = useState('')
  const [documentPresetSelect, setDocumentPresetSelect] = useState<string>('')

  const refreshTemplates = useCallback(() => {
    if (projectId) setTemplates(getExportTemplates(projectId))
  }, [projectId])
  useEffect(() => {
    refreshTemplates()
  }, [refreshTemplates])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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

  const applyTemplate = useCallback(
    (template: ExportTemplate) => {
      setSelectedFormat(template.format as ExportFormat)
      setColumns(
        mergeColumnsWithDefaults(
          template.columns as ExportColumn[],
          defaultColumns
        ) as ExportColumn[]
      )
      setIncludeHeader(template.includeHeader)
      setParameterExportMode(template.parameterExportMode)
      setIncludeGlossary(template.includeGlossary)
      setIncludeAbbreviations(template.includeAbbreviations)
      setGlossaryShowDefinitions(template.glossaryShowDefinitions)
      setGlossarySortAlphabetically(template.glossarySortAlphabetically)
      setScopeResetMessage(null)
      const scopeTypeNew = template.scopeType
      const compId = template.selectedComponentId ?? ''
      const fnId = template.selectedFunctionId ?? ''
      const compExists = !compId || flatComponents.some((c) => c.id === compId)
      const fnExists = !fnId || flatFunctions.some((f) => f.id === fnId)
      if (scopeTypeNew === 'component' && !compExists) {
        setScopeType('all')
        setSelectedComponentId('')
        setSelectedFunctionId('')
        setScopeResetMessage('Template scope was reset: selected component is no longer available.')
      } else if (scopeTypeNew === 'function' && !fnExists) {
        setScopeType('all')
        setSelectedComponentId('')
        setSelectedFunctionId('')
        setScopeResetMessage('Template scope was reset: selected function is no longer available.')
      } else {
        setScopeType(scopeTypeNew)
        setSelectedComponentId(scopeTypeNew === 'component' ? compId : '')
        setSelectedFunctionId(scopeTypeNew === 'function' ? fnId : '')
      }
      setSelectedTemplateId(template.id)
      setSections(template.sections)
      setDocumentStyle(template.documentStyle)
      setUseDocumentSections(Array.isArray(template.sections) && template.sections.length > 0)
      setInlineError(null)
      setCurrentStep('scope')
    },
    [flatComponents, flatFunctions]
  )

  const handleSaveTemplate = useCallback(() => {
    const name = saveTemplateName.trim().slice(0, 80)
    if (!name) return
    if (!projectId) return
    const template: ExportTemplate = {
      id: crypto.randomUUID(),
      name,
      format: selectedFormat,
      columns: columns.map((c) => ({ key: c.key, label: c.label, selected: c.selected })),
      scopeType,
      selectedComponentId: scopeType === 'component' ? selectedComponentId || undefined : undefined,
      selectedFunctionId: scopeType === 'function' ? selectedFunctionId || undefined : undefined,
      includeHeader,
      parameterExportMode,
      includeGlossary,
      includeAbbreviations,
      glossaryShowDefinitions,
      glossarySortAlphabetically,
      createdAt: new Date().toISOString(),
      sections: useDocumentSections ? sections : undefined,
      documentStyle: documentStyle ?? undefined,
    }
    try {
      saveExportTemplate(projectId, template)
      refreshTemplates()
      setIsSaveTemplateOpen(false)
      setSaveTemplateName('')
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : 'Could not save template.')
    }
  }, [
    projectId,
    saveTemplateName,
    selectedFormat,
    columns,
    scopeType,
    selectedComponentId,
    selectedFunctionId,
    includeHeader,
    parameterExportMode,
    includeGlossary,
    includeAbbreviations,
    glossaryShowDefinitions,
    glossarySortAlphabetically,
    useDocumentSections,
    sections,
    documentStyle,
    refreshTemplates,
  ])

  const handleCreateNewTemplate = useCallback(() => {
    const name = createTemplateName.trim().slice(0, 80)
    if (!name || !projectId) return
    const format = createTemplateFormat
    const isPdfOrWord = format === 'pdf' || format === 'word'
    const preset = createTemplatePreset
    const template: ExportTemplate = {
      id: crypto.randomUUID(),
      name,
      format,
      columns: defaultColumns.map((c) => ({ key: c.key, label: c.label, selected: c.selected })),
      scopeType: 'all',
      selectedComponentId: undefined,
      selectedFunctionId: undefined,
      includeHeader: true,
      parameterExportMode: 'name',
      includeGlossary: true,
      includeAbbreviations: true,
      glossaryShowDefinitions: true,
      glossarySortAlphabetically: true,
      createdAt: new Date().toISOString(),
      sections: isPdfOrWord ? getSectionsForPreset(preset) : undefined,
      documentStyle: isPdfOrWord ? (preset === 'simple' ? undefined : { ...DEFAULT_AUTHORITY_STYLE }) : undefined,
    }
    try {
      saveExportTemplate(projectId, template)
      refreshTemplates()
      setIsCreateTemplateOpen(false)
      setCreateTemplateName('')
      setInlineError(null)
      setSelectedTemplateId(template.id)
      applyTemplate(template)
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : 'Could not save template.')
    }
  }, [projectId, createTemplateName, createTemplateFormat, createTemplatePreset, refreshTemplates, applyTemplate])

  const handleUpdateTemplate = useCallback(() => {
    if (!projectId || !selectedTemplateId) return
    const existing = templates.find((t) => t.id === selectedTemplateId)
    if (!existing) return
    const template: ExportTemplate = {
      ...existing,
      id: selectedTemplateId,
      name: existing.name,
      format: selectedFormat,
      columns: columns.map((c) => ({ key: c.key, label: c.label, selected: c.selected })),
      scopeType,
      selectedComponentId: scopeType === 'component' ? selectedComponentId || undefined : undefined,
      selectedFunctionId: scopeType === 'function' ? selectedFunctionId || undefined : undefined,
      includeHeader,
      parameterExportMode,
      includeGlossary,
      includeAbbreviations,
      glossaryShowDefinitions,
      glossarySortAlphabetically,
      sections: useDocumentSections ? sections : undefined,
      documentStyle: documentStyle ?? undefined,
    }
    try {
      saveExportTemplate(projectId, template)
      refreshTemplates()
      setInlineError(null)
      setTemplateUpdatedMessage('Template updated.')
      setTimeout(() => setTemplateUpdatedMessage(null), 2500)
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : 'Could not update template.')
    }
  }, [
    projectId,
    selectedTemplateId,
    templates,
    selectedFormat,
    columns,
    scopeType,
    selectedComponentId,
    selectedFunctionId,
    includeHeader,
    parameterExportMode,
    includeGlossary,
    includeAbbreviations,
    glossaryShowDefinitions,
    glossarySortAlphabetically,
    useDocumentSections,
    sections,
    documentStyle,
    refreshTemplates,
  ])

  const applyPreset = (preset: 'authority' | 'simple' | 'full' | 'submission_with_placeholders') => {
    setSections(getSectionsForPreset(preset))
    setDocumentStyle(preset === 'simple' ? undefined : { ...DEFAULT_AUTHORITY_STYLE })
  }

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!sections?.length) return
    const next = [...sections]
    const j = direction === 'up' ? index - 1 : index + 1
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setSections(next)
  }

  const updateSection = (id: string, patch: Partial<Pick<ExportSection, 'title' | 'enabled' | 'options'>>) => {
    if (!sections?.length) return
    setSections(
      sections.map((s) =>
        s.id === id ? { ...s, ...patch, options: patch.options !== undefined ? { ...s.options, ...patch.options } : s.options } : s
      )
    )
  }

  const updateDocumentStyle = (patch: Partial<ExportDocumentStyle>) => {
    setDocumentStyle((prev) => ({ ...DEFAULT_AUTHORITY_STYLE, ...prev, ...patch }))
  }

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
    const documentTitle = documentStyle?.coverTitle ?? (projectName ? `${projectName} - Requirements Export` : 'Requirements Export')
    const useSections = useDocumentSections && Array.isArray(sections) && sections.length > 0 && sections.some((s) => s.enabled)
    const blob = useSections
      ? await buildRequirementsDocxWithSections({
          documentTitle,
          projectName,
          requirements: rows,
          columns: docxColumns,
          sections: sections!,
          documentStyle: documentStyle ?? DEFAULT_AUTHORITY_STYLE,
          glossaryEntries: includeGlossary
            ? usedGlossaryEntries.map((e) => ({ term: e.term, definition: (e.definition || '').replace(/<[^>]*>/g, '').trim() }))
            : undefined,
          abbreviationEntries: includeAbbreviations
            ? usedAbbreviationEntries.map((e) => ({ term: e.term, definition: (e.definition || '').replace(/<[^>]*>/g, '').trim() }))
            : undefined,
          stripHtml: (s) => stripHtml(s),
        })
      : await buildRequirementsDocx({
          title: documentTitle,
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

  // Export to PDF (authority path when sections/documentStyle; else legacy)
  const exportPdf = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = selectedCols.map((c) => c.label)
    const data = effectiveRequirements.map((req) =>
      selectedCols.map((col) => {
        let value = getValue(req, col.key)
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
          if (value.length > 100) value = value.substring(0, 100) + '...'
        }
        return value
      })
    )
    const stripHtmlForPdf = (html: string) => (html || '').replace(/<[^>]*>/g, '').trim().slice(0, 200)
    const doc = new jsPDF({
      orientation: selectedCols.length > 6 ? 'landscape' : 'portrait',
    })
    const autoTable = await loadAutoTable()
    const documentTitle = documentStyle?.coverTitle ?? (projectName ? `${projectName} - Requirements Export` : 'Requirements Export')
    const useSections = useDocumentSections && Array.isArray(sections) && sections.length > 0 && sections.some((s) => s.enabled)
    const style = documentStyle ?? DEFAULT_AUTHORITY_STYLE
    const authorityStyles = getAuthorityTableStyles(style)
    const marginPt = (authorityStyles.margin * 2.834645669)

    if (useSections) {
      const enabledSections = sections!.filter((s) => s.enabled)
      let sectionNum = 0
      for (const sec of enabledSections) {
        sectionNum += 1
        const title = sec.title ?? sec.type
        const opts = sec.options ?? {}
        if (sec.type === 'cover') {
          addCoverPage(
            doc,
            {
              documentTitle: style.coverTitle ?? documentTitle,
              projectName: opts.showProjectName !== false ? projectName : undefined,
              showDate: opts.showDate !== false,
              showVersion: opts.showVersion,
              versionLabel: opts.versionLabel,
              classification: opts.classification,
              preparerOrOrg: opts.preparerOrOrg,
            },
            style
          )
          doc.addPage()
          continue
        }
        if (sec.type === 'summary') {
          const startY = addSectionHeading(doc, sectionNum, title, style, opts.startOnNewPage !== false)
          doc.setFontSize(style.fontSizeBody ?? 11)
          doc.setFont(getPdfFont(style), 'normal')
          doc.text(`This document contains ${effectiveRequirements.length} requirement(s).`, marginPt, startY + 4)
          if (projectName) doc.text(`Project: ${projectName}`, marginPt, startY + 12)
          const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
          for (let p = 0; p < blankAfter; p++) doc.addPage()
          continue
        }
        if (sec.type === 'requirements_table') {
          const startY = addSectionHeading(doc, sectionNum, title, style, opts.startOnNewPage !== false)
          autoTable(doc, {
            head: includeHeader ? [headers] : undefined,
            body: data,
            startY,
            styles: { fontSize: authorityStyles.fontSize, cellPadding: 2 },
            headStyles: authorityStyles.headStyles,
            alternateRowStyles: authorityStyles.alternateRowStyles,
            tableLineColor: authorityStyles.tableLineColor,
            tableLineWidth: authorityStyles.tableLineWidth,
            columnStyles: selectedCols.reduce((acc, col, index) => {
              if (col.key === 'description' || col.key === 'acceptanceCriteria') acc[index] = { cellWidth: 'wrap' }
              return acc
            }, {} as Record<number, { cellWidth: string }>),
          })
          const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
          for (let p = 0; p < blankAfter; p++) doc.addPage()
          continue
        }
        if (sec.type === 'glossary' && includeGlossary && usedGlossaryEntries.length > 0) {
          const startY = addSectionHeading(doc, sectionNum, title, style, opts.startOnNewPage !== false)
          const glossaryBody = usedGlossaryEntries.map((e) =>
            glossaryShowDefinitions ? [e.term, stripHtmlForPdf(e.definition)] : [e.term]
          )
          const glossaryHead = glossaryShowDefinitions ? [['Term', 'Definition']] : [['Term']]
          autoTable(doc, {
            head: glossaryHead,
            body: glossaryBody,
            startY,
            styles: { fontSize: authorityStyles.fontSize, cellPadding: 2 },
            headStyles: authorityStyles.headStyles,
            alternateRowStyles: authorityStyles.alternateRowStyles,
            tableLineColor: authorityStyles.tableLineColor,
            tableLineWidth: authorityStyles.tableLineWidth,
            columnStyles: glossaryShowDefinitions ? { 1: { cellWidth: 'wrap' } } : {},
          })
          const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
          for (let p = 0; p < blankAfter; p++) doc.addPage()
          continue
        }
        if (sec.type === 'abbreviations' && includeAbbreviations && usedAbbreviationEntries.length > 0) {
          const startY = addSectionHeading(doc, sectionNum, title, style, opts.startOnNewPage !== false)
          const abbrBody = usedAbbreviationEntries.map((e) =>
            glossaryShowDefinitions ? [e.term, stripHtmlForPdf(e.definition)] : [e.term]
          )
          const abbrHead = glossaryShowDefinitions ? [['Term', 'Definition']] : [['Term']]
          autoTable(doc, {
            head: abbrHead,
            body: abbrBody,
            startY,
            styles: { fontSize: authorityStyles.fontSize, cellPadding: 2 },
            headStyles: authorityStyles.headStyles,
            alternateRowStyles: authorityStyles.alternateRowStyles,
            tableLineColor: authorityStyles.tableLineColor,
            tableLineWidth: authorityStyles.tableLineWidth,
            columnStyles: glossaryShowDefinitions ? { 1: { cellWidth: 'wrap' } } : {},
          })
          const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
          for (let p = 0; p < blankAfter; p++) doc.addPage()
          continue
        }
        if (sec.type === 'custom_text' && opts.content) {
          const startY = addSectionHeading(doc, sectionNum, title, style, opts.startOnNewPage !== false)
          doc.setFontSize(style.fontSizeBody ?? 11)
          doc.setFont(getPdfFont(style), 'normal')
          doc.text(opts.content.slice(0, 2000), marginPt, startY + 4, { maxWidth: doc.getNumberOfPages() ? (doc as unknown as { getPageWidth(): number }).getPageWidth?.() - 2 * marginPt : 170 })
          const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
          for (let p = 0; p < blankAfter; p++) doc.addPage()
          continue
        }
        if (sec.type === 'placeholder') {
          addPlaceholderSection(doc, sectionNum, title, style, {
            placeholderStyle: opts.placeholderStyle ?? 'full_page',
            blankPageCount: opts.blankPageCount ?? 1,
            startOnNewPage: opts.startOnNewPage,
          })
          const isFullPage = (opts.placeholderStyle ?? 'full_page') === 'full_page'
          if (!isFullPage) {
            const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
            for (let p = 0; p < blankAfter; p++) doc.addPage()
          }
        }
      }
      addHeaderFooterToAllPages(doc, documentTitle, style)
    } else {
      // Legacy PDF (optional authority styling when documentStyle is set)
      if (documentStyle) {
        addCoverPage(
          doc,
          {
            documentTitle: style.coverTitle ?? documentTitle,
            projectName,
            showDate: true,
          },
          style
        )
        doc.addPage()
      }
      const headStyles = documentStyle
        ? authorityStyles.headStyles
        : { fillColor: [59, 130, 246] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const }
      const altStyles = documentStyle ? authorityStyles.alternateRowStyles : { fillColor: [245, 247, 250] as [number, number, number] }
      const startY = documentStyle ? marginPt + 14 : 35
      if (!documentStyle) {
        doc.setFontSize(16)
        doc.text(projectName ? `${projectName} - Requirements Export` : 'Requirements Export', 14, 15)
        doc.setFontSize(10)
        doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 22)
        doc.text(`Total Requirements: ${effectiveRequirements.length}`, 14, 28)
      }
      autoTable(doc, {
        head: includeHeader ? [headers] : undefined,
        body: data,
        startY: documentStyle ? startY : 35,
        styles: { fontSize: documentStyle ? authorityStyles.fontSize : 8, cellPadding: 2 },
        headStyles,
        alternateRowStyles: altStyles,
        ...(documentStyle && { tableLineColor: authorityStyles.tableLineColor, tableLineWidth: authorityStyles.tableLineWidth }),
        columnStyles: selectedCols.reduce((acc, col, index) => {
          if (col.key === 'description' || col.key === 'acceptanceCriteria') acc[index] = { cellWidth: 'wrap' }
          return acc
        }, {} as Record<number, { cellWidth: string }>),
      })
      if (includeGlossary && usedGlossaryEntries.length > 0) {
        doc.addPage()
        if (!documentStyle) {
          doc.setFontSize(14)
          doc.text('Glossary', 14, 15)
          doc.setFontSize(10)
        } else {
          doc.setFontSize(style.fontSizeHeading1 ?? 14)
          doc.setFont(getPdfFont(style), 'bold')
          doc.text('Glossary', marginPt, marginPt + 6)
        }
        const glossaryBody = usedGlossaryEntries.map((e) =>
          glossaryShowDefinitions ? [e.term, stripHtmlForPdf(e.definition)] : [e.term]
        )
        const glossaryHead = glossaryShowDefinitions ? [['Term', 'Definition']] : [['Term']]
        const glStartY = documentStyle ? marginPt + 14 : 22
        autoTable(doc, {
          head: glossaryHead,
          body: glossaryBody,
          startY: glStartY,
          styles: { fontSize: documentStyle ? authorityStyles.fontSize : 8, cellPadding: 2 },
          headStyles,
          ...(documentStyle && { tableLineColor: authorityStyles.tableLineColor, tableLineWidth: authorityStyles.tableLineWidth }),
          columnStyles: glossaryShowDefinitions ? { 1: { cellWidth: 'wrap' } } : {},
        })
      }
      if (includeAbbreviations && usedAbbreviationEntries.length > 0) {
        doc.addPage()
        if (!documentStyle) {
          doc.setFontSize(14)
          doc.text('Abbreviations', 14, 15)
          doc.setFontSize(10)
        } else {
          doc.setFontSize(style.fontSizeHeading1 ?? 14)
          doc.setFont(getPdfFont(style), 'bold')
          doc.text('Abbreviations', marginPt, marginPt + 6)
        }
        const abbrBody = usedAbbreviationEntries.map((e) =>
          glossaryShowDefinitions ? [e.term, stripHtmlForPdf(e.definition)] : [e.term]
        )
        const abbrHead = glossaryShowDefinitions ? [['Term', 'Definition']] : [['Term']]
        autoTable(doc, {
          head: abbrHead,
          body: abbrBody,
          startY: documentStyle ? marginPt + 14 : 22,
          styles: { fontSize: documentStyle ? authorityStyles.fontSize : 8, cellPadding: 2 },
          headStyles,
          ...(documentStyle && { tableLineColor: authorityStyles.tableLineColor, tableLineWidth: authorityStyles.tableLineWidth }),
          columnStyles: glossaryShowDefinitions ? { 1: { cellWidth: 'wrap' } } : {},
        })
      }
      if (documentStyle) addHeaderFooterToAllPages(doc, documentTitle, style)
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

  const selectedCount = columns.filter((c) => c.selected).length

  const canExport =
    effectiveRequirements.length > 0 &&
    (!enableScopeSelection ||
      (scopeType === 'all') ||
      (scopeType === 'component' && !!selectedComponentId) ||
      (scopeType === 'function' && !!selectedFunctionId))

  const canSaveAsTemplate =
    currentStep !== 'format' &&
    selectedCount > 0 &&
    canExport &&
    (scopeType === 'all' || (scopeType === 'component' && !!selectedComponentId) || (scopeType === 'function' && !!selectedFunctionId))

  // Handle export
  const handleExport = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    setInlineError(null)
    if (selectedCols.length === 0) {
      setInlineError('Please select at least one column to export.')
      return
    }
    if (!canExport) {
      if (scopeType === 'component') setInlineError('Please select a component to export.')
      else if (scopeType === 'function') setInlineError('Please select a function to export.')
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
      setInlineError(error instanceof Error ? error.message : 'Failed to export. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const steps: { id: ExportStep; label: string }[] = [
    { id: 'format', label: 'Format' },
    { id: 'scope', label: 'Scope and options' },
    { id: 'review', label: 'Review' },
  ]
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep) + 1

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        aria-describedby="export-dialog-desc"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Download className="text-blue-500" size={24} />
            <div>
              <h2 id="export-dialog-title" className="text-xl font-bold text-gray-900 dark:text-white">
                Export Requirements{effectiveScopeLabel ? ` — ${effectiveScopeLabel}` : ''}
              </h2>
              <p id="export-dialog-desc" className="text-sm text-gray-500 dark:text-gray-400">
                Step {currentStepIndex} of {steps.length} · {effectiveRequirements.length} requirement{effectiveRequirements.length !== 1 ? 's' : ''} in scope
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4 pt-2" aria-label="Export steps">
          {steps.map((step, i) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setCurrentStep(step.id)}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-t-lg transition-colors',
                currentStep === step.id
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              aria-current={currentStep === step.id ? 'step' : undefined}
              aria-label={`Step ${i + 1}, ${step.label}`}
            >
              {i + 1}. {step.label}
            </button>
          ))}
        </div>

        {/* Inline error / scope reset message */}
        {(inlineError || scopeResetMessage) && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
            {inlineError ?? scopeResetMessage}
          </div>
        )}

        {/* Content - step panels */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentStep === 'format' && (
            <>
          {/* Step 1: Format & template */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-5 gap-2">
              <button
                onClick={() => { setSelectedFormat('csv'); setSelectedTemplateId(null) }}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'csv' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <FileText size={24} className="text-green-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">CSV</span>
              </button>
              <button
                onClick={() => { setSelectedFormat('excel'); setSelectedTemplateId(null) }}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'excel' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <FileSpreadsheet size={24} className="text-green-700" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Excel</span>
              </button>
              <button
                onClick={() => { setSelectedFormat('pdf'); setSelectedTemplateId(null) }}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'pdf' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <File size={24} className="text-red-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">PDF</span>
              </button>
              <button
                onClick={() => { setSelectedFormat('word'); setSelectedTemplateId(null) }}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'word' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <FileText size={24} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Word</span>
              </button>
              <button
                onClick={() => { setSelectedFormat('reqif'); setSelectedTemplateId(null) }}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border rounded-lg transition-colors',
                  selectedFormat === 'reqif' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <Code size={24} className="text-purple-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">ReqIF</span>
              </button>
            </div>
          </div>
          {projectId && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Templates</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Save and reuse export configurations for this project.</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsCreateTemplateOpen(true); setCreateTemplateFormat(selectedFormat); setCreateTemplateName(''); setCreateTemplatePreset('authority'); setInlineError(null) }}
                    className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    Create new template
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsManageTemplatesOpen(true); setInlineError(null) }}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Manage templates
                  </button>
                  {selectedTemplateId != null && (
                    <button
                      type="button"
                      onClick={handleUpdateTemplate}
                      disabled={!canSaveAsTemplate}
                      title={!canSaveAsTemplate ? 'Complete Scope and Options steps, then return here to update this template.' : undefined}
                      className="px-3 py-2 text-sm font-medium rounded-lg border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Update this template
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setIsSaveTemplateOpen(true); setInlineError(null) }}
                    disabled={!canSaveAsTemplate}
                    title={!canSaveAsTemplate ? 'Complete Scope and Options steps, then return here to save this configuration as a template.' : undefined}
                    className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save current as template
                  </button>
                </div>
                {isCreateTemplateOpen && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">New template</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Format</label>
                        <select
                          value={createTemplateFormat}
                          onChange={(e) => setCreateTemplateFormat(e.target.value as ExportFormat)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="csv">CSV</option>
                          <option value="excel">Excel</option>
                          <option value="pdf">PDF</option>
                          <option value="word">Word</option>
                          <option value="reqif">ReqIF</option>
                        </select>
                      </div>
                      {(createTemplateFormat === 'pdf' || createTemplateFormat === 'word') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Preset</label>
                          <select
                            value={createTemplatePreset}
                            onChange={(e) => setCreateTemplatePreset(e.target.value as 'authority' | 'simple' | 'full' | 'submission_with_placeholders')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="authority">Authority submission</option>
                            <option value="simple">Simple list</option>
                            <option value="full">Full report</option>
                            <option value="submission_with_placeholders">Submission with placeholders</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Template name</label>
                      <input
                        type="text"
                        value={createTemplateName}
                        onChange={(e) => setCreateTemplateName(e.target.value)}
                        placeholder="e.g. Customer report"
                        maxLength={80}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setIsCreateTemplateOpen(false); setCreateTemplateName('') }} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Cancel</button>
                      <button type="button" onClick={handleCreateNewTemplate} disabled={!createTemplateName.trim()} className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Create</button>
                    </div>
                  </div>
                )}
                {currentStep === 'format' && !canSaveAsTemplate && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Configure format, scope, and options in the steps below. Return here to save or update a template.
                  </p>
                )}
                {templateUpdatedMessage && (
                  <p className="text-sm text-green-600 dark:text-green-400">{templateUpdatedMessage}</p>
                )}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Saved templates</h4>
                  {templates.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-3 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                      No templates yet. Create one above, or configure export in the next steps and use &quot;Save current as template&quot;.
                    </p>
                  ) : (
                    <ul className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-44 overflow-y-auto">
                      {templates.map((t) => (
                        <li
                          key={t.id}
                          className={clsx(
                            'flex items-center justify-between gap-3 px-3 py-2.5',
                            selectedTemplateId === t.id && 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{t.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t.format}</span>
                          </div>
                          {selectedTemplateId === t.id && (
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">Applied</span>
                          )}
                          <button
                            type="button"
                            onClick={() => applyTemplate(t)}
                            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            Apply
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
          {isSaveTemplateOpen && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template name</label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Customer report"
                maxLength={80}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setIsSaveTemplateOpen(false); setSaveTemplateName('') }} className="px-3 py-2 text-sm border rounded-lg">Cancel</button>
                <button type="button" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50">Save</button>
              </div>
            </div>
          )}
          {isManageTemplatesOpen && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Manage templates</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Apply, duplicate, rename, or delete. To create a new template, close this dialog and use &quot;Create new template&quot; on the main page.</p>
              </div>
              <div className="p-4 space-y-3">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    {editingTemplateId === t.id ? (
                      <>
                        <input
                          type="text"
                          value={editingTemplateName}
                          onChange={(e) => setEditingTemplateName(e.target.value)}
                          className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                        />
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => { updateExportTemplate(projectId!, t.id, { name: editingTemplateName.trim() }); refreshTemplates(); setEditingTemplateId(null); setEditingTemplateName('') }} className="px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">Save</button>
                          <button type="button" onClick={() => { setEditingTemplateId(null); setEditingTemplateName('') }} className="px-2 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200">Cancel</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{t.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{t.format}</span>
                        </div>
                        <div className="flex gap-2 shrink-0 flex-wrap">
                          <button type="button" onClick={() => { applyTemplate(t); setIsManageTemplatesOpen(false) }} className="px-2 py-1 text-xs font-medium rounded border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Apply and edit in Steps 2–4">Apply</button>
                          <button type="button" onClick={() => { const copy: ExportTemplate = { ...t, id: crypto.randomUUID(), name: (`Copy of ${t.name}`).slice(0, 80), createdAt: new Date().toISOString(), columns: t.columns.map((c) => ({ ...c })), sections: t.sections?.map((s) => ({ ...s, id: crypto.randomUUID(), options: s.options ? { ...s.options } : undefined })), documentStyle: t.documentStyle ? { ...t.documentStyle } : undefined }; saveExportTemplate(projectId!, copy); refreshTemplates(); setSelectedTemplateId(copy.id); applyTemplate(copy); setIsManageTemplatesOpen(false) }} className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Duplicate</button>
                          <button type="button" onClick={() => { setEditingTemplateId(t.id); setEditingTemplateName(t.name) }} className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Rename</button>
                          <button type="button" onClick={() => { if (window.confirm(`Delete template "${t.name}"?`)) { deleteExportTemplate(projectId!, t.id); refreshTemplates(); if (selectedTemplateId === t.id) setSelectedTemplateId(null) } }} className="px-2 py-1 text-xs font-medium rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setIsManageTemplatesOpen(false)} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Done</button>
              </div>
              </div>
            </div>
          )}
            </>
          )}

          {currentStep === 'scope' && (
            <>
          {/* Step 2: Scope and options */}
          <div className="space-y-6">
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scope</h3>
          {enableScopeSelection && (componentTree.length > 0 || flatFunctions.length > 0) ? (
            <div>
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
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">All requirements in this view.</p>
          )}
          </section>

          {/* Content and layout options */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content and layout</h3>
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

          {/* Document layout (PDF / Word only) */}
          {(selectedFormat === 'pdf' || selectedFormat === 'word') && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDocumentSections}
                  onChange={(e) => {
                    const on = e.target.checked
                    setUseDocumentSections(on)
                    if (on && (!sections?.length || sections.length === 0)) {
                      setSections(getSectionsForPreset('authority'))
                      setDocumentStyle({ ...DEFAULT_AUTHORITY_STYLE })
                    }
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Use document sections</span>
              </label>
              {useDocumentSections && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apply preset</label>
                    <select
                      value={documentPresetSelect}
                      onChange={(e) => {
                        const v = e.target.value as '' | 'authority' | 'simple' | 'full' | 'submission_with_placeholders'
                        setDocumentPresetSelect(v)
                        if (v) {
                          applyPreset(v)
                          setDocumentPresetSelect('')
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">— Choose preset —</option>
                      <option value="authority">Authority submission</option>
                      <option value="simple">Simple list</option>
                      <option value="full">Full report</option>
                      <option value="submission_with_placeholders">Submission with placeholders</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sections</label>
                    <ul className="space-y-2 max-h-56 overflow-y-auto">
                      {sections?.map((sec, index) => (
                        <li
                          key={sec.id}
                          className="flex flex-wrap items-start gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                        >
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => moveSection(index, 'up')}
                              disabled={index === 0}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
                              aria-label="Move up"
                            >
                              <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSection(index, 'down')}
                              disabled={index === (sections?.length ?? 0) - 1}
                              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
                              aria-label="Move down"
                            >
                              <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                            </button>
                          </div>
                          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sec.enabled}
                              onChange={(e) => updateSection(sec.id, { enabled: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{sec.type.replace('_', ' ')}</span>
                          </label>
                          <input
                            type="text"
                            value={sec.title ?? ''}
                            onChange={(e) => updateSection(sec.id, { title: e.target.value || undefined })}
                            placeholder={sec.type.replace('_', ' ')}
                            className="flex-1 min-w-[8rem] px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          {sec.type !== 'cover' && (
                            <div className="w-full flex flex-wrap items-center gap-3 pl-1 text-sm">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={sec.options?.startOnNewPage !== false}
                                  onChange={(e) => updateSection(sec.id, { options: { ...sec.options, startOnNewPage: e.target.checked } })}
                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded"
                                />
                                <span className="text-gray-600 dark:text-gray-400">Start on new page</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-gray-400">Blank pages after</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={5}
                                  value={Math.min(5, Math.max(0, sec.options?.blankPagesAfter ?? 0))}
                                  onChange={(e) => updateSection(sec.id, { options: { ...sec.options, blankPagesAfter: Math.min(5, Math.max(0, parseInt(e.target.value, 10) || 0)) } })}
                                  className="w-14 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                              </label>
                            </div>
                          )}
                          {sec.type === 'cover' && (
                            <div className="w-full mt-2 pl-6 space-y-1.5 text-sm">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={sec.options?.showProjectName !== false}
                                  onChange={(e) => updateSection(sec.id, { options: { ...sec.options, showProjectName: e.target.checked } })}
                                  className="w-3.5 h-3.5"
                                />
                                <span className="text-gray-600 dark:text-gray-400">Show project name</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={sec.options?.showDate !== false}
                                  onChange={(e) => updateSection(sec.id, { options: { ...sec.options, showDate: e.target.checked } })}
                                  className="w-3.5 h-3.5"
                                />
                                <span className="text-gray-600 dark:text-gray-400">Show date</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={!!sec.options?.showVersion}
                                  onChange={(e) => updateSection(sec.id, { options: { ...sec.options, showVersion: e.target.checked } })}
                                  className="w-3.5 h-3.5"
                                />
                                <span className="text-gray-600 dark:text-gray-400">Show version</span>
                              </label>
                              {sec.options?.showVersion && (
                                <input
                                  type="text"
                                  value={sec.options?.versionLabel ?? ''}
                                  onChange={(e) => updateSection(sec.id, { options: { ...sec.options, versionLabel: e.target.value || undefined } })}
                                  placeholder="Version label"
                                  className="w-full px-2 py-1 text-xs border rounded"
                                />
                              )}
                              <input
                                type="text"
                                value={sec.options?.classification ?? ''}
                                onChange={(e) => updateSection(sec.id, { options: { ...sec.options, classification: e.target.value || undefined } })}
                                placeholder="Classification (e.g. CONFIDENTIAL)"
                                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                              />
                              <input
                                type="text"
                                value={sec.options?.preparerOrOrg ?? ''}
                                onChange={(e) => updateSection(sec.id, { options: { ...sec.options, preparerOrOrg: e.target.value || undefined } })}
                                placeholder="Preparer or organization"
                                className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                              />
                            </div>
                          )}
                          {sec.type === 'custom_text' && (
                            <div className="w-full mt-2 pl-6">
                              <textarea
                                value={sec.options?.content ?? ''}
                                onChange={(e) => updateSection(sec.id, { options: { ...sec.options, content: e.target.value } })}
                                placeholder="Custom text content..."
                                rows={3}
                                className="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                          )}
                          {sec.type === 'placeholder' && (
                            <div className="w-full mt-2 pl-6 space-y-1.5 text-sm">
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Placeholder style</label>
                                <select
                                  value={sec.options?.placeholderStyle ?? 'full_page'}
                                  onChange={(e) => updateSection(sec.id, { options: { ...sec.options, placeholderStyle: e.target.value as 'full_page' | 'heading_with_space' } })}
                                  className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                  <option value="full_page">Full blank page(s)</option>
                                  <option value="heading_with_space">Heading with blank space below</option>
                                </select>
                              </div>
                              {(sec.options?.placeholderStyle ?? 'full_page') === 'full_page' && (
                                <div>
                                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Blank page count</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={Math.min(5, Math.max(1, sec.options?.blankPageCount ?? 1))}
                                    onChange={(e) => updateSection(sec.id, { options: { ...sec.options, blankPageCount: Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)) } })}
                                    className="w-20 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
              {/* Document style: show when PDF/Word; editing creates/updates documentStyle */}
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Document style</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Applies to section-based export; optional cover/header/footer for single-table export.
                </p>
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cover title</label>
                    <input
                      type="text"
                      value={documentStyle?.coverTitle ?? DEFAULT_AUTHORITY_STYLE.coverTitle ?? ''}
                      onChange={(e) => updateDocumentStyle({ coverTitle: e.target.value || undefined })}
                      placeholder="e.g. Requirements Export"
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Font family</label>
                    <select
                      value={documentStyle?.fontFamily ?? ''}
                      onChange={(e) => updateDocumentStyle({ fontFamily: e.target.value || undefined })}
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Default (Helvetica / system)</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Helvetica">Helvetica</option>
                      <option value="Courier New">Courier New</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Header left</label>
                      <input
                        type="text"
                        value={documentStyle?.headerLeft ?? DEFAULT_AUTHORITY_STYLE.headerLeft ?? ''}
                        onChange={(e) => updateDocumentStyle({ headerLeft: e.target.value || undefined })}
                        placeholder="{title}"
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Header center</label>
                      <input
                        type="text"
                        value={documentStyle?.headerCenter ?? ''}
                        onChange={(e) => updateDocumentStyle({ headerCenter: e.target.value || undefined })}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Header right</label>
                      <input
                        type="text"
                        value={documentStyle?.headerRight ?? ''}
                        onChange={(e) => updateDocumentStyle({ headerRight: e.target.value || undefined })}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Footer left</label>
                      <input
                        type="text"
                        value={documentStyle?.footerLeft ?? ''}
                        onChange={(e) => updateDocumentStyle({ footerLeft: e.target.value || undefined })}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Footer center</label>
                      <input
                        type="text"
                        value={documentStyle?.footerCenter ?? DEFAULT_AUTHORITY_STYLE.footerCenter ?? ''}
                        onChange={(e) => updateDocumentStyle({ footerCenter: e.target.value || undefined })}
                        placeholder="{page} of {pageOfN}"
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Footer right</label>
                      <input
                        type="text"
                        value={documentStyle?.footerRight ?? DEFAULT_AUTHORITY_STYLE.footerRight ?? ''}
                        onChange={(e) => updateDocumentStyle({ footerRight: e.target.value || undefined })}
                        placeholder="{date}"
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Page number format</label>
                    <select
                      value={documentStyle?.pageNumberFormat ?? DEFAULT_AUTHORITY_STYLE.pageNumberFormat ?? 'pageOfN'}
                      onChange={(e) => updateDocumentStyle({ pageNumberFormat: e.target.value as 'none' | 'page' | 'pageOfN' })}
                      className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="none">None</option>
                      <option value="page">Page number only</option>
                      <option value="pageOfN">Page X of N</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Margin (mm)</label>
                      <input
                        type="number"
                        min={10}
                        max={50}
                        value={documentStyle?.marginMm ?? DEFAULT_AUTHORITY_STYLE.marginMm ?? 25}
                        onChange={(e) => updateDocumentStyle({ marginMm: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Body font size (pt)</label>
                      <input
                        type="number"
                        min={8}
                        max={14}
                        value={documentStyle?.fontSizeBody ?? DEFAULT_AUTHORITY_STYLE.fontSizeBody ?? 11}
                        onChange={(e) => updateDocumentStyle({ fontSizeBody: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Heading 1 (pt)</label>
                      <input
                        type="number"
                        min={10}
                        max={18}
                        value={documentStyle?.fontSizeHeading1 ?? DEFAULT_AUTHORITY_STYLE.fontSizeHeading1 ?? 14}
                        onChange={(e) => updateDocumentStyle({ fontSizeHeading1: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Heading 2 (pt)</label>
                      <input
                        type="number"
                        min={9}
                        max={16}
                        value={documentStyle?.fontSizeHeading2 ?? DEFAULT_AUTHORITY_STYLE.fontSizeHeading2 ?? 12}
                        onChange={(e) => updateDocumentStyle({ fontSizeHeading2: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Table header (hex)</label>
                      <input
                        type="text"
                        value={documentStyle?.tableHeaderBg ?? DEFAULT_AUTHORITY_STYLE.tableHeaderBg ?? '#374151'}
                        onChange={(e) => updateDocumentStyle({ tableHeaderBg: e.target.value || undefined })}
                        placeholder="#374151"
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Alternate row (hex)</label>
                      <input
                        type="text"
                        value={documentStyle?.tableAlternateRowBg ?? DEFAULT_AUTHORITY_STYLE.tableAlternateRowBg ?? '#F9FAFB'}
                        onChange={(e) => updateDocumentStyle({ tableAlternateRowBg: e.target.value || undefined })}
                        placeholder="#F9FAFB"
                        className="w-full px-2 py-1 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Placeholders: {'{title}'}, {'{date}'}, {'{page}'}, {'{pageOfN}'}
                  </p>
                </div>
              </div>
            </div>
          )}
          </section>
          </div>
            </>
          )}

          {currentStep === 'review' && (
            <>
          {/* Step 3: Review & export */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Summary</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
              <li>Format: {selectedFormat.toUpperCase()}</li>
              <li>Scope: {effectiveScopeLabel ?? 'All requirements'}</li>
              <li>Columns: {selectedCount} selected</li>
              <li>Parameter display: {parameterExportMode === 'name' ? 'Names' : 'Resolved values'}</li>
              <li>Glossary: {includeGlossary ? 'Yes' : 'No'}, Abbreviations: {includeAbbreviations ? 'Yes' : 'No'}</li>
            </ul>
            {selectedFormat === 'pdf' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Long text is truncated in PDF export.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</h3>
            {selectedFormat === 'reqif' ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">ReqIF export will include all requirements in scope. No row preview.</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      {columns.filter((c) => c.selected).map((c) => (
                        <th key={c.key} className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveRequirements.slice(0, 10).map((req) => (
                      <tr key={req.id} className="border-t border-gray-200 dark:border-gray-700">
                        {columns.filter((c) => c.selected).map((col) => {
                          let val = col.key === 'requirementId' ? (req.requirementId || req.id.slice(0, 8)) : (req[col.key as keyof Requirement] ?? '')
                          if (typeof val === 'string' && (col.key === 'description' || col.key === 'acceptanceCriteria')) val = stripHtml(val)
                          if (typeof val === 'string' && val.length > 80) val = val.slice(0, 80) + '…'
                          return <td key={col.key} className="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={String(val)}>{String(val)}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          {currentStep !== 'format' && (
            <button
              type="button"
              onClick={() => { setInlineError(null); setCurrentStep(currentStep === 'scope' ? 'format' : 'scope') }}
              className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          {currentStep !== 'review' ? (
            <button
              type="button"
              onClick={() => {
                setInlineError(null)
                if (currentStep === 'format') setCurrentStep('scope')
                else if (currentStep === 'scope') {
                  if (scopeType === 'component' && !selectedComponentId) setInlineError('Select a component to export.')
                  else if (scopeType === 'function' && !selectedFunctionId) setInlineError('Select a function to export.')
                  else if (selectedCount === 0) setInlineError('Select at least one column to export.')
                  else setCurrentStep('review')
                }
              }}
              disabled={
                (currentStep === 'scope' && scopeType === 'component' && !selectedComponentId) ||
                (currentStep === 'scope' && scopeType === 'function' && !selectedFunctionId) ||
                (currentStep === 'scope' && selectedCount === 0)
              }
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={isExporting || selectedCount === 0 || !canExport}
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
              aria-label={`Export as ${selectedFormat.toUpperCase()}`}
            >
              <Download size={16} />
              {isExporting ? 'Exporting…' : `Export ${selectedFormat.toUpperCase()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
