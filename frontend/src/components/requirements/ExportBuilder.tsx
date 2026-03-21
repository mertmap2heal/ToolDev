import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, FileSpreadsheet, FileText, File, CheckSquare, Square, Code, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Upload, AlertTriangle, Clock, Eye, Share2, Globe, Lock, Building2, Loader2, Check } from 'lucide-react'
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
  mergeColumnsWithDefaults,
  DEFAULT_AUTHORITY_STYLE,
  getSectionsForPreset,
  type ExportTemplate,
  type ExportSection,
  type ExportDocumentStyle,
} from '../../utils/requirementExportTemplates'
import { requirementExportTemplateService, type RequirementExportTemplate } from '../../services/requirementExportTemplate.service'
import { exportJobService } from '../../services/exportJob.service'
import { corporateDocxTemplateService, type CorporateDocxTemplate } from '../../services/corporateDocxTemplate.service'
import { excelColumnMappingService, type ExcelColumnMapping } from '../../services/excelColumnMapping.service'
import { scheduledExportService, type ScheduledExport } from '../../services/scheduledExport.service'
import {
  getAuthorityTableStyles,
  getPdfFont,
  addCoverPage,
  addHeaderFooterToAllPages,
  addSectionHeading,
  addPlaceholderSection,
  addTraceabilityMatrixSection,
} from '../../utils/exportPdfLayout'
import type { TraceabilityMatrixModel } from 'shared/types/traceabilityMatrix.types'
import { buildTraceabilityMatrixDocx } from '../../utils/exportDocx'

interface TraceabilityMatrixConfig {
  rowType: string
  colType: string
  includeFlatSheet?: boolean
}

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

type RequirementTestCaseLinkLike = {
  sourceId: string
  targetId: string
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
  requirementTestCaseLinks?: RequirementTestCaseLinkLike[]
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
  requirementTestCaseLinks = [],
}: ExportBuilderProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv')
  const [columns, setColumns] = useState<ExportColumn[]>(defaultColumns)
  const [includeHeader, setIncludeHeader] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [parameterExportMode, setParameterExportMode] = useState<ResolveMode>('name')
  const [scopeType, setScopeType] = useState<'all' | 'custom'>('all')
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([])
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<string[]>([])
  const [componentSearch, setComponentSearch] = useState('')
  const [functionSearch, setFunctionSearch] = useState('')
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false)
  const [exportSearch, setExportSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterOwner, setFilterOwner] = useState<string>('all')
  const [includeGlossary, setIncludeGlossary] = useState(true)
  const [includeAbbreviations, setIncludeAbbreviations] = useState(true)
  const [glossaryShowDefinitions, setGlossaryShowDefinitions] = useState(true)
  const [glossarySortAlphabetically, setGlossarySortAlphabetically] = useState(true)
  const [exportSortBy, setExportSortBy] = useState<'requirementId' | 'priority' | 'status' | 'createdAt' | 'updatedAt'>('requirementId')
  const [exportSortOrder, setExportSortOrder] = useState<'asc' | 'desc'>('asc')
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

  // Large-export progress tracking
  const LARGE_EXPORT_THRESHOLD = 500
  const [exportProgress, setExportProgress] = useState(0)
  const [exportProgressLabel, setExportProgressLabel] = useState('')
  const exportAbortRef = useRef(false)

  // Review step pagination
  const [reviewPage, setReviewPage] = useState(0)
  const REVIEW_PAGE_SIZE = 25

  // Template visibility
  const [saveTemplateVisibility, setSaveTemplateVisibility] = useState<'private' | 'project' | 'org'>('project')

  // Corporate DOCX templates (Word format)
  const [corporateDocxTemplates, setCorporateDocxTemplates] = useState<CorporateDocxTemplate[]>([])
  const [selectedCorporateDocxId, setSelectedCorporateDocxId] = useState<string | null>(null)
  const [isUploadingDocx, setIsUploadingDocx] = useState(false)
  const [docxUploadError, setDocxUploadError] = useState<string | null>(null)
  const docxFileInputRef = useRef<HTMLInputElement>(null)

  // Traceability matrix configuration (for Excel/PDF/Word matrix exports)
  const [traceMatrixConfig, setTraceMatrixConfig] = useState<TraceabilityMatrixConfig | null>(null)

  // Excel column mappings (Excel format)
  const [excelColumnMappings, setExcelColumnMappings] = useState<ExcelColumnMapping[]>([])
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null)
  const [isMappingEditorOpen, setIsMappingEditorOpen] = useState(false)
  const [newMappingName, setNewMappingName] = useState('')
  const [draftMappingRows, setDraftMappingRows] = useState<Array<{ systemField: string; excelColumn: string }>>([])

  // Scheduled exports
  const [scheduledExports, setScheduledExports] = useState<ScheduledExport[]>([])
  const [isScheduledExportsOpen, setIsScheduledExportsOpen] = useState(false)
  const [newScheduleName, setNewScheduleName] = useState('')
  const [newScheduleExpr, setNewScheduleExpr] = useState('')
  const [isAddingSchedule, setIsAddingSchedule] = useState(false)

  // Template JSON import
  const templateJsonInputRef = useRef<HTMLInputElement>(null)

  // In-app confirmation dialog (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  // Archived (soft-deleted) templates
  const [deletedTemplates, setDeletedTemplates] = useState<RequirementExportTemplate[]>([])
  const [isDeletedPanelOpen, setIsDeletedPanelOpen] = useState(false)

  const toUiTemplate = useCallback((t: RequirementExportTemplate): ExportTemplate => {
    const p = (t.payload ?? {}) as Partial<ExportTemplate>
    return {
      id: t.id,
      name: t.name,
      format: t.format,
      columns: Array.isArray(p.columns) ? (p.columns as any) : defaultColumns.map((c) => ({ key: c.key, label: c.label, selected: c.selected })),
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      scopeType: (p.scopeType as any) ?? 'all',
      selectedComponentIds: (p as any).selectedComponentIds,
      selectedFunctionIds: (p as any).selectedFunctionIds,
      selectedComponentId: p.selectedComponentId,
      selectedFunctionId: p.selectedFunctionId,
      exportSearch: (p as any).exportSearch,
      filters: (p as any).filters,
      includeHeader: p.includeHeader ?? true,
      parameterExportMode: (p.parameterExportMode as any) ?? 'name',
      includeGlossary: p.includeGlossary ?? true,
      includeAbbreviations: p.includeAbbreviations ?? true,
      glossaryShowDefinitions: p.glossaryShowDefinitions ?? true,
      glossarySortAlphabetically: p.glossarySortAlphabetically ?? true,
      createdAt: (p.createdAt as any) ?? t.createdAt,
      sections: Array.isArray(p.sections)
        ? p.sections.map((s: any, i: number) => ({
            id: s.id ?? s.sectionId ?? `sec-${i}`,
            type: s.type ?? s.sectionType ?? 'requirements_table',
            title: s.title ?? s.label ?? undefined,
            enabled: s.enabled ?? true,
            options: s.options ?? undefined,
          }))
        : p.sections,
      documentStyle: p.documentStyle,
    }
  }, [])

  const refreshTemplates = useCallback(async () => {
    if (!projectId) return
    const res = await requirementExportTemplateService.list(projectId)
    if (res.success && res.data) {
      setTemplates(res.data.map(toUiTemplate))
      return res.data
    }
    try {
      const legacy = await import('../../utils/requirementExportTemplates')
      const local = legacy.getExportTemplates(projectId).map((t: any) => {
        if (t.scopeType === 'custom' || t.scopeType === 'all') return t
        if (t.scopeType === 'component') {
          return { ...t, scopeType: 'custom', selectedComponentIds: t.selectedComponentId ? [t.selectedComponentId] : [], selectedFunctionIds: [] }
        }
        if (t.scopeType === 'function') {
          return { ...t, scopeType: 'custom', selectedComponentIds: [], selectedFunctionIds: t.selectedFunctionId ? [t.selectedFunctionId] : [] }
        }
        return { ...t, scopeType: 'all' }
      })
      setTemplates(local)
    } catch {
      setTemplates([])
    }
    return []
  }, [projectId, toUiTemplate])

  // Load corporate DOCX templates (Word format)
  useEffect(() => {
    if (!projectId) return
    corporateDocxTemplateService.list(projectId).then((res) => {
      if (res.success && res.data) setCorporateDocxTemplates(res.data)
    })
  }, [projectId])

  // Load Excel column mappings
  useEffect(() => {
    if (!projectId) return
    excelColumnMappingService.list(projectId).then((res) => {
      if (res.success && res.data) setExcelColumnMappings(res.data)
    })
  }, [projectId])

  // Load scheduled exports
  useEffect(() => {
    if (!projectId) return
    scheduledExportService.list(projectId).then((res) => {
      if (res.success && res.data) setScheduledExports(res.data)
    })
  }, [projectId])

  // Load deleted (archived) templates
  useEffect(() => {
    if (!projectId) return
    requirementExportTemplateService.listDeleted(projectId).then((res) => {
      if (res.success && res.data) setDeletedTemplates(res.data)
    })
  }, [projectId])

  // Auto-migrate legacy localStorage templates to server on first open (best-effort).
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!projectId) return
      try {
        const serverTemplates = await refreshTemplates()
        // If server already has templates, don't auto-migrate.
        if (Array.isArray(serverTemplates) && serverTemplates.length > 0) return

        // Lazy-load legacy localStorage helper only for migration.
        const legacy = await import('../../utils/requirementExportTemplates')
        const local = legacy.getExportTemplates(projectId)
        if (!Array.isArray(local) || local.length === 0) return

        for (const t of local) {
          try {
            await requirementExportTemplateService.create(projectId, {
              name: t.name,
              format: t.format as any,
              payload: {
                columns: t.columns,
                sortBy: (t as any).sortBy,
                sortOrder: (t as any).sortOrder,
                scopeType: (t as any).scopeType === 'custom'
                  ? 'custom'
                  : (t as any).scopeType === 'component' || (t as any).scopeType === 'function'
                    ? 'custom'
                    : 'all',
                selectedComponentIds: (t as any).scopeType === 'component'
                  ? (t.selectedComponentId ? [t.selectedComponentId] : [])
                  : (t as any).selectedComponentIds ?? (t.selectedComponentId ? [t.selectedComponentId] : []),
                selectedFunctionIds: (t as any).scopeType === 'function'
                  ? (t.selectedFunctionId ? [t.selectedFunctionId] : [])
                  : (t as any).selectedFunctionIds ?? (t.selectedFunctionId ? [t.selectedFunctionId] : []),
                exportSearch: (t as any).exportSearch ?? '',
                filters: (t as any).filters,
                includeHeader: t.includeHeader,
                parameterExportMode: t.parameterExportMode,
                includeGlossary: t.includeGlossary,
                includeAbbreviations: t.includeAbbreviations,
                glossaryShowDefinitions: t.glossaryShowDefinitions,
                glossarySortAlphabetically: t.glossarySortAlphabetically,
                createdAt: t.createdAt,
                sections: t.sections,
                documentStyle: t.documentStyle,
              },
            })
          } catch {
            // Ignore per-template failures (e.g., duplicate name) and continue best-effort.
          }
        }

        if (!cancelled) await refreshTemplates()
      } catch {
        // Ignore migration failures; templates remain usable in-session.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, refreshTemplates])
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

  const allocationByReqId = useMemo(() => {
    const map = new Map<string, Link[]>()
    allocationLinks.forEach((l) => {
      if (l.sourceType !== 'requirement' || l.targetType !== 'function' || l.linkType !== 'allocated_to') return
      const existing = map.get(l.sourceId) ?? []
      existing.push(l)
      map.set(l.sourceId, existing)
    })
    return map
  }, [allocationLinks])

  const testsByReqId = useMemo(() => {
    const map = new Map<string, RequirementTestCaseLinkLike[]>()
    requirementTestCaseLinks.forEach((l) => {
      const existing = map.get(l.sourceId) ?? []
      existing.push(l)
      map.set(l.sourceId, existing)
    })
    return map
  }, [requirementTestCaseLinks])

  const getCoverageInfo = useCallback(
    (reqId: string) => {
      const allocations = allocationByReqId.get(reqId) ?? []
      const tests = testsByReqId.get(reqId) ?? []
      const hasAllocation = allocations.length > 0
      const hasVerification = tests.length > 0
      let coverageStatus: 'OK' | 'Missing Tests' | 'Missing Allocation' | 'Missing Both' = 'OK'
      if (!hasAllocation && !hasVerification) coverageStatus = 'Missing Both'
      else if (!hasAllocation) coverageStatus = 'Missing Allocation'
      else if (!hasVerification) coverageStatus = 'Missing Tests'
      return { hasAllocation, hasVerification, coverageStatus }
    },
    [allocationByReqId, testsByReqId]
  )

  const effectiveRequirements = useMemo(() => {
    if (!enableScopeSelection) return requirements
    if (scopeType === 'all') return requirements
    const componentSet = new Set(selectedComponentIds)
    const functionSet = new Set(selectedFunctionIds)
    if (componentSet.size === 0 && functionSet.size === 0) return []
    return requirements.filter((r) => {
      const byComponent = r.componentId ? componentSet.has(r.componentId) : false
      const byFunction =
        functionSet.size > 0 &&
        allocationLinks.some(
          (l) =>
            l.sourceType === 'requirement' &&
            l.targetType === 'function' &&
            l.linkType === 'allocated_to' &&
            l.sourceId === r.id &&
            functionSet.has(l.targetId)
        )
      return byComponent || byFunction
    })
  }, [enableScopeSelection, requirements, scopeType, selectedComponentIds, selectedFunctionIds, allocationLinks])

  const filterOptions = useMemo(() => {
    const statuses = new Set<string>()
    const categories = new Set<string>()
    const owners = new Set<string>()
    requirements.forEach((r) => {
      if (r.status) statuses.add(r.status)
      if (r.category) categories.add(r.category)
      if (r.owner) owners.add(r.owner)
    })
    return {
      statuses: Array.from(statuses).sort(),
      categories: Array.from(categories).sort(),
      owners: Array.from(owners).sort(),
    }
  }, [requirements])

  const filteredRequirements = useMemo(() => {
    const q = exportSearch.trim().toLowerCase()
    return effectiveRequirements.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterPriority !== 'all' && String(r.priority || '').toLowerCase() !== filterPriority) return false
      if (filterCategory !== 'all' && (r.category || '') !== filterCategory) return false
      if (filterOwner !== 'all' && (r.owner || '') !== filterOwner) return false
      if (!q) return true
      const id = (r.requirementId || r.id.substring(0, 8)).toLowerCase()
      const title = (r.title || '').toLowerCase()
      const desc = (r.description || '').replace(/<[^>]*>/g, '').toLowerCase()
      return id.includes(q) || title.includes(q) || desc.includes(q)
    })
  }, [effectiveRequirements, exportSearch, filterStatus, filterPriority, filterCategory, filterOwner])

  const exportRequirements = useMemo(() => {
    const list = [...filteredRequirements]
    const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const dir = exportSortOrder === 'asc' ? 1 : -1
    const getReqId = (r: Requirement) => (r.requirementId || r.id.substring(0, 8)).toLowerCase()
    list.sort((a, b) => {
      if (exportSortBy === 'requirementId') return getReqId(a).localeCompare(getReqId(b)) * dir
      if (exportSortBy === 'priority') {
        const pa = priorityRank[String(a.priority || '').toLowerCase()] ?? 99
        const pb = priorityRank[String(b.priority || '').toLowerCase()] ?? 99
        return (pa - pb) * dir
      }
      if (exportSortBy === 'status') return String(a.status || '').localeCompare(String(b.status || '')) * dir
      if (exportSortBy === 'createdAt' || exportSortBy === 'updatedAt') {
        const ta = new Date((a as any)[exportSortBy] || 0).getTime()
        const tb = new Date((b as any)[exportSortBy] || 0).getTime()
        return (ta - tb) * dir
      }
      return 0
    })
    return list
  }, [filteredRequirements, exportSortBy, exportSortOrder])

  const effectiveScopeLabel = useMemo(() => {
    if (propsScopeLabel) return propsScopeLabel
    if (!enableScopeSelection || scopeType === 'all') return undefined
    const cCount = selectedComponentIds.length
    const fCount = selectedFunctionIds.length
    if (cCount === 0 && fCount === 0) return 'Custom scope (empty)'
    if (cCount > 0 && fCount > 0) return `Custom scope (${cCount} component(s), ${fCount} function(s))`
    if (cCount > 0) return `Custom scope (${cCount} component(s))`
    return `Custom scope (${fCount} function(s))`
  }, [enableScopeSelection, propsScopeLabel, scopeType, selectedComponentIds, selectedFunctionIds])

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
      setExportSortBy((template.sortBy as any) ?? 'requirementId')
      setExportSortOrder(template.sortOrder ?? 'asc')
      setExportSearch(template.exportSearch ?? '')
      setFilterStatus(template.filters?.status ?? 'all')
      setFilterPriority(template.filters?.priority ?? 'all')
      setFilterCategory(template.filters?.category ?? 'all')
      setFilterOwner(template.filters?.owner ?? 'all')
      setIncludeHeader(template.includeHeader)
      setParameterExportMode(template.parameterExportMode)
      setIncludeGlossary(template.includeGlossary)
      setIncludeAbbreviations(template.includeAbbreviations)
      setGlossaryShowDefinitions(template.glossaryShowDefinitions)
      setGlossarySortAlphabetically(template.glossarySortAlphabetically)
      setScopeResetMessage(null)
      const scopeTypeNew: 'all' | 'custom' = template.scopeType === 'custom' ? 'custom' : 'all'
      const compIdsRaw = template.selectedComponentIds ?? (template.selectedComponentId ? [template.selectedComponentId] : [])
      const fnIdsRaw = template.selectedFunctionIds ?? (template.selectedFunctionId ? [template.selectedFunctionId] : [])
      const compIds = compIdsRaw.filter((id) => flatComponents.some((c) => c.id === id))
      const fnIds = fnIdsRaw.filter((id) => flatFunctions.some((f) => f.id === id))
      if (scopeTypeNew === 'custom' && compIds.length === 0 && fnIds.length === 0) {
        setScopeType('all')
        setSelectedComponentIds([])
        setSelectedFunctionIds([])
        setScopeResetMessage('Template scope was reset: selected items are no longer available.')
      } else {
        setScopeType(scopeTypeNew)
        setSelectedComponentIds(scopeTypeNew === 'custom' ? compIds : [])
        setSelectedFunctionIds(scopeTypeNew === 'custom' ? fnIds : [])
      }
      setSelectedTemplateId(template.id)
      setSections(template.sections)
      setDocumentStyle(template.documentStyle)
      // Restore traceability matrix config if present in payload
      const anyTemplate = template as any
      if (anyTemplate.traceabilityMatrix) {
        setTraceMatrixConfig({
          rowType: anyTemplate.traceabilityMatrix.rowType,
          colType: anyTemplate.traceabilityMatrix.colType,
          includeFlatSheet: anyTemplate.traceabilityMatrix.includeFlatSheet,
        })
      } else {
        setTraceMatrixConfig(null)
      }
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
    requirementExportTemplateService
      .create(projectId, {
        name,
        format: selectedFormat,
        visibility: saveTemplateVisibility,
        payload: {
          columns: columns.map((c) => ({ key: c.key, label: c.label, selected: c.selected })),
          sortBy: exportSortBy,
          sortOrder: exportSortOrder,
          scopeType,
          selectedComponentIds: scopeType === 'custom' ? selectedComponentIds : [],
          selectedFunctionIds: scopeType === 'custom' ? selectedFunctionIds : [],
          exportSearch,
          filters: {
            status: filterStatus,
            priority: filterPriority,
            category: filterCategory,
            owner: filterOwner,
          },
          includeHeader,
          parameterExportMode,
          includeGlossary,
          includeAbbreviations,
          glossaryShowDefinitions,
          glossarySortAlphabetically,
          createdAt: new Date().toISOString(),
          sections: useDocumentSections ? sections : undefined,
          documentStyle: documentStyle ?? undefined,
          traceabilityMatrix: traceMatrixConfig ?? undefined,
        },
      })
      .then((res) => {
        if (res.success && res.data) {
          const ui = toUiTemplate(res.data)
          setTemplates((prev) => [ui, ...prev])
          setSelectedTemplateId(ui.id)
          setIsSaveTemplateOpen(false)
          setSaveTemplateName('')
          setSaveTemplateVisibility('project')
          setInlineError(null)
        } else {
          setInlineError(res.error || 'Could not save template.')
        }
      })
  }, [
    projectId,
    saveTemplateName,
    selectedFormat,
    columns,
    scopeType,
    selectedComponentIds,
    selectedFunctionIds,
    exportSearch,
    filterStatus,
    filterPriority,
    filterCategory,
    filterOwner,
    exportSortBy,
    exportSortOrder,
    includeHeader,
    parameterExportMode,
    includeGlossary,
    includeAbbreviations,
    glossaryShowDefinitions,
    glossarySortAlphabetically,
    useDocumentSections,
    sections,
    documentStyle,
    toUiTemplate,
  ])

  const handleCreateNewTemplate = useCallback(() => {
    const name = createTemplateName.trim().slice(0, 80)
    if (!name || !projectId) return
    const format = createTemplateFormat
    const isPdfOrWord = format === 'pdf' || format === 'word'
    const preset = createTemplatePreset
    try {
      requirementExportTemplateService.create(projectId, {
        name,
        format,
        payload: {
          columns: defaultColumns.map((c) => ({ key: c.key, label: c.label, selected: c.selected })),
          sortBy: 'requirementId',
          sortOrder: 'asc',
          scopeType: 'all',
          includeHeader: true,
          parameterExportMode: 'name',
          includeGlossary: true,
          includeAbbreviations: true,
          glossaryShowDefinitions: true,
          glossarySortAlphabetically: true,
          createdAt: new Date().toISOString(),
          sections: isPdfOrWord ? getSectionsForPreset(preset) : undefined,
          documentStyle: isPdfOrWord ? (preset === 'simple' ? undefined : { ...DEFAULT_AUTHORITY_STYLE }) : undefined,
          traceabilityMatrix: undefined,
        },
      }).then((res) => {
        if (res.success && res.data) {
          const ui = toUiTemplate(res.data)
          setTemplates((prev) => [ui, ...prev.filter((x) => x.id !== ui.id)])
          setSelectedTemplateId(ui.id)
          applyTemplate(ui)
        } else {
          setInlineError(res.error || 'Could not save template.')
        }
      })
      setIsCreateTemplateOpen(false)
      setCreateTemplateName('')
      setInlineError(null)
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : 'Could not save template.')
    }
  }, [projectId, createTemplateName, createTemplateFormat, createTemplatePreset, applyTemplate, toUiTemplate])

  const handleUpdateTemplate = useCallback(() => {
    if (!projectId || !selectedTemplateId) return
    const existing = templates.find((t) => t.id === selectedTemplateId)
    if (!existing) return
    try {
      requirementExportTemplateService.update(projectId, selectedTemplateId, {
        format: selectedFormat,
        payload: {
          columns: columns.map((c) => ({ key: c.key, label: c.label, selected: c.selected })),
          sortBy: exportSortBy,
          sortOrder: exportSortOrder,
          scopeType,
          selectedComponentIds: scopeType === 'custom' ? selectedComponentIds : [],
          selectedFunctionIds: scopeType === 'custom' ? selectedFunctionIds : [],
          exportSearch,
          filters: {
            status: filterStatus,
            priority: filterPriority,
            category: filterCategory,
            owner: filterOwner,
          },
          includeHeader,
          parameterExportMode,
          includeGlossary,
          includeAbbreviations,
          glossaryShowDefinitions,
          glossarySortAlphabetically,
          sections: useDocumentSections ? sections : undefined,
          documentStyle: documentStyle ?? undefined,
        },
      }).then((res) => {
        if (res.success && res.data) {
          const ui = toUiTemplate(res.data)
          setTemplates((prev) => prev.map((t) => (t.id === ui.id ? ui : t)))
          setInlineError(null)
          setTemplateUpdatedMessage('Template updated.')
          setTimeout(() => setTemplateUpdatedMessage(null), 2500)
        } else {
          setInlineError(res.error || 'Could not update template.')
        }
      })
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
    selectedComponentIds,
    selectedFunctionIds,
    exportSortBy,
    exportSortOrder,
    exportSearch,
    filterStatus,
    filterPriority,
    filterCategory,
    filterOwner,
    includeHeader,
    parameterExportMode,
    includeGlossary,
    includeAbbreviations,
    glossaryShowDefinitions,
    glossarySortAlphabetically,
    useDocumentSections,
    sections,
    documentStyle,
    toUiTemplate,
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

  const updateColumnLabel = (key: string, label: string) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, label } : c)))
  }

  const moveColumn = (key: string, direction: 'up' | 'down') => {
    setColumns((prev) => {
      const i = prev.findIndex((c) => c.key === key)
      if (i < 0) return prev
      const j = direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
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
    return exportRequirements
      .map((r) => {
        let desc = r.description || ''
        if (desc.includes('{{param:') && parameterMap.size > 0) {
          desc = resolveParameterPlaceholders(desc, parameterMap, parameterExportMode)
        }
        return stripHtml(desc)
      })
      .join('\n')
  }, [exportRequirements, parameterMap, parameterExportMode])

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
    const baseHeaders = selectedCols.map((c) => c.label)
    const headers = [
      ...baseHeaders,
      'HasAllocation',
      'HasVerification',
      'CoverageStatus',
    ]
    const rows = exportRequirements.map((req) => {
      const baseValues = selectedCols.map((col) => {
        let value = getValue(req, col.key)
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
        }
        value = value.replace(/"/g, '""')
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`
        }
        return value
      })
      const { hasAllocation, hasVerification, coverageStatus } = getCoverageInfo(req.id)
      const covValues = [
        hasAllocation ? 'Yes' : 'No',
        hasVerification ? 'Yes' : 'No',
        coverageStatus,
      ].map((v) => {
        let value = v.replace(/"/g, '""')
        if (value.includes(',') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`
        }
        return value
      })
      return [...baseValues, ...covValues]
    })

    const metadataLines: string[] = []
    const nowIso = new Date().toISOString()
    metadataLines.push(`Profile,${'Aerospace Traceability (Core)'}`)
    metadataLines.push(`ProjectId,${projectId}`)
    if (projectName) metadataLines.push(`ProjectName,${projectName.replace(/"/g, '""')}`)
    if (effectiveScopeLabel) metadataLines.push(`Scope,${effectiveScopeLabel.replace(/"/g, '""')}`)
    metadataLines.push(`ExportedAtUtc,${nowIso}`)
    metadataLines.push(`TotalRequirements,${exportRequirements.length}`)

    const csvContent = [
      ...metadataLines,
      '',
      includeHeader ? headers.join(',') : null,
      ...rows.map((row) => row.join(',')),
    ].filter(Boolean).join('\n')

    const baseName = effectiveScopeFilenameSuffix ? `requirements_export_${effectiveScopeFilenameSuffix}` : 'requirements_export'
    downloadFile(csvContent, `${baseName}.csv`, 'text/csv')
  }

  // Export to Excel
  const exportExcel = () => {
    const selectedCols = columns.filter((c) => c.selected)
    const headers = [
      ...selectedCols.map((c) => c.label),
      'HasAllocation',
      'HasVerification',
      'CoverageStatus',
    ]
    const data = exportRequirements.map((req) => {
      const row: Record<string, string> = {}
      selectedCols.forEach((col) => {
        let value = getValue(req, col.key)
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
        }
        row[col.label] = value
      })
      const { hasAllocation, hasVerification, coverageStatus } = getCoverageInfo(req.id)
      row.HasAllocation = hasAllocation ? 'Yes' : 'No'
      row.HasVerification = hasVerification ? 'Yes' : 'No'
      row.CoverageStatus = coverageStatus
      return row
    })

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
    const rows: DocxRequirementRow[] = exportRequirements.map((req) => {
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
      const requirementIds = exportRequirements.map((r) => r.id).join(',')
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
    const data = exportRequirements.map((req) =>
      selectedCols.map((col) => {
        let value = getValue(req, col.key)
        if (col.key === 'description' || col.key === 'acceptanceCriteria') {
          value = stripHtml(value)
          // No truncation: let table layout wrap long text.
        }
        return value
      })
    )
    const stripHtmlForPdf = (html: string) => (html || '').replace(/<[^>]*>/g, '').trim()
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
          doc.text(`This document contains ${exportRequirements.length} requirement(s).`, marginPt, startY + 4)
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
    (!enableScopeSelection || scopeType === 'all' || scopeType === 'custom')

  const canSaveAsTemplate =
    currentStep !== 'format' &&
    selectedCount > 0 &&
    canExport &&
    (scopeType === 'all' || scopeType === 'custom')

  // Handle export with large-dataset job tracking and progress overlay
  const handleExport = async () => {
    const selectedCols = columns.filter((c) => c.selected)
    setInlineError(null)
    if (!traceMatrixConfig && selectedCols.length === 0) {
      setInlineError('Please select at least one column to export.')
      return
    }
    if (!canExport) {
      if (enableScopeSelection && scopeType === 'custom') {
        setInlineError('Select at least one component or function for the custom scope (or switch to "All requirements").')
      } else {
        setInlineError('No requirements match the current scope/filters.')
      }
      return
    }

    // Traceability matrix export path for Excel/PDF/Word when configured
    if (traceMatrixConfig && projectId && (selectedFormat === 'excel' || selectedFormat === 'pdf' || selectedFormat === 'word')) {
      try {
        const isLarge = exportRequirements.length >= LARGE_EXPORT_THRESHOLD
        exportAbortRef.current = false
        setIsExporting(true)
        setExportProgress(5)
        setExportProgressLabel('Fetching traceability matrix…')

        const params = new URLSearchParams({
          rowType: traceMatrixConfig.rowType,
          colType: traceMatrixConfig.colType,
          format: selectedFormat === 'word' ? 'docx' : selectedFormat,
        })
        const res = await fetch(`/api/traceability/${projectId}/export/matrix?` + params.toString(), {
          credentials: 'include',
        })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error || `Failed to export traceability matrix (${res.status})`)
        }
        const json = await res.json()
        const matrixData = json?.data?.matrix as TraceabilityMatrixModel | undefined
        if (!matrixData) {
          throw new Error('Server did not return matrix data.')
        }

        if (selectedFormat === 'excel') {
          setExportProgressLabel('Building spreadsheet…')
          const wb = XLSX.utils.book_new()
          const headerRow = [''].concat(matrixData.cols.map((c) => c.label || c.key))
          const dataRows = matrixData.rows.map((row) => {
            const rowCells: (string | null)[] = [row.key]
            for (const col of matrixData.cols) {
              const entries = matrixData.cells[row.id]?.[col.id] ?? []
              const text = entries.map((e: any) =>
                typeof e === 'string' ? e : `${e.arrow} ${e.linkType}${e.isSuspect ? ' (?)' : ''}`
              ).join(', ')
              rowCells.push(text)
            }
            return rowCells
          })
          const wsData = [headerRow, ...dataRows]
          const ws = XLSX.utils.aoa_to_sheet(wsData)
          XLSX.utils.book_append_sheet(wb, ws, 'Matrix')

          if (traceMatrixConfig.includeFlatSheet) {
            const flatRows: any[][] = [['RowKey', 'RowId', 'ColKey', 'ColId', 'LinkType', 'Direction']]
            for (const row of matrixData.rows) {
              for (const col of matrixData.cols) {
                const entries = matrixData.cells[row.id]?.[col.id]
                if (entries && entries.length > 0) {
                  for (const e of entries) {
                    const lt = typeof e === 'string' ? e : e.linkType
                    const arrow = typeof e === 'string' ? '' : e.arrow
                    flatRows.push([row.key, row.id, col.key, col.id, lt, arrow])
                  }
                }
              }
            }
            const flatWs = XLSX.utils.aoa_to_sheet(flatRows)
            XLSX.utils.book_append_sheet(wb, flatWs, 'Links')
          }

          const baseName = `traceability_matrix_${traceMatrixConfig.rowType}_${traceMatrixConfig.colType}`
          XLSX.writeFile(wb, `${baseName}.xlsx`)
        } else {
          const baseName = `traceability_matrix_${traceMatrixConfig.rowType}_${traceMatrixConfig.colType}`
          if (selectedFormat === 'pdf') {
            setExportProgressLabel('Rendering PDF…')
            const doc = new jsPDF({ orientation: 'landscape' })
            const autoTableModule = await loadAutoTable()
            const autoTable = autoTableModule as any
            const style = documentStyle ?? DEFAULT_AUTHORITY_STYLE
            const title = `${traceMatrixConfig.rowType} ↔ ${traceMatrixConfig.colType} Traceability Matrix`
            // Cover page + matrix section
            addCoverPage(
              doc,
              { documentTitle: style.coverTitle ?? title, projectName, showDate: true },
              style
            )
            addTraceabilityMatrixSection(doc, autoTable, 1, title, matrixData, style, { startOnNewPage: true })
            addHeaderFooterToAllPages(doc, title, style)
            doc.save(`${baseName}.pdf`)
          } else {
            setExportProgressLabel('Building Word document…')
            const title = `${traceMatrixConfig.rowType} ↔ ${traceMatrixConfig.colType} Traceability Matrix`
            const blob = await buildTraceabilityMatrixDocx({
              documentTitle: title,
              projectName,
              matrix: matrixData,
              documentStyle: documentStyle ?? DEFAULT_AUTHORITY_STYLE,
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${baseName}.docx`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }
        }

        setExportProgress(100)
        setExportProgressLabel('Export complete!')
        await new Promise((r) => setTimeout(r, isLarge ? 900 : 0))
        onClose()
        return
      } catch (error) {
        console.error('Traceability matrix export error:', error)
        setInlineError(error instanceof Error ? error.message : 'Traceability matrix export failed.')
      } finally {
        setIsExporting(false)
        setExportProgress(0)
        setExportProgressLabel('')
      }
      return
    }

    const isLarge = exportRequirements.length >= LARGE_EXPORT_THRESHOLD
    exportAbortRef.current = false
    setIsExporting(true)
    setExportProgress(5)
    setExportProgressLabel(isLarge ? `Preparing ${exportRequirements.length} requirements…` : 'Generating…')

    let jobId: string | null = null
    if (isLarge && projectId) {
      try {
        const jobRes = await exportJobService.create(projectId, {
          format: selectedFormat,
          totalCount: exportRequirements.length,
          label: `${effectiveScopeLabel ?? 'All reqs'} – ${selectedFormat.toUpperCase()}`,
        })
        if (jobRes.success && jobRes.data) {
          jobId = jobRes.data.id
          exportJobService.update(projectId, jobId, { status: 'running', progress: 10 }).catch(() => {})
        }
      } catch { /* non-critical */ }
    }

    try {
      setExportProgress(20)
      switch (selectedFormat) {
        case 'csv':
          setExportProgressLabel('Building CSV…')
          exportCsv()
          break
        case 'excel':
          setExportProgressLabel('Building spreadsheet…')
          exportExcel()
          break
        case 'pdf':
          setExportProgressLabel('Rendering PDF…')
          setExportProgress(30)
          await exportPdf()
          break
        case 'word':
          setExportProgressLabel('Building Word document…')
          setExportProgress(30)
          await exportWord()
          break
        case 'reqif':
          setExportProgressLabel('Generating ReqIF…')
          await exportReqIF()
          break
      }

      setExportProgress(100)
      setExportProgressLabel('Export complete!')

      if (jobId && projectId) {
        exportJobService.update(projectId, jobId, { status: 'done', progress: 100, doneCount: exportRequirements.length }).catch(() => {})
      }

      await new Promise((r) => setTimeout(r, isLarge ? 900 : 0))
      onClose()
    } catch (error) {
      console.error('Export error:', error)
      setInlineError(error instanceof Error ? error.message : 'Failed to export. Please try again.')
      if (jobId && projectId) {
        exportJobService.update(projectId, jobId, { status: 'failed', error: error instanceof Error ? error.message : 'Export failed' }).catch(() => {})
      }
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportProgressLabel('')
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
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col relative"
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

        {/* Step progress indicator */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50" aria-label="Export steps">
          <div className="flex items-center justify-center gap-0">
            {steps.map((step, i) => {
              const isCompleted = i < currentStepIndex - 1
              const isCurrent = currentStep === step.id
              return (
                <div key={step.id} className="flex items-center">
                  {/* Step node */}
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Step ${i + 1}: ${step.label}${isCompleted ? ' (completed)' : ''}`}
                    className="flex flex-col items-center gap-1.5 group focus:outline-none"
                  >
                    <div className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200',
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrent
                          ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 group-hover:border-gray-400 dark:group-hover:border-gray-500'
                    )}>
                      {isCompleted ? <Check size={14} /> : i + 1}
                    </div>
                    <span className={clsx(
                      'text-xs font-medium whitespace-nowrap transition-colors',
                      isCompleted ? 'text-green-600 dark:text-green-400'
                        : isCurrent ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                    )}>
                      {step.label}
                    </span>
                  </button>
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className={clsx(
                      'h-0.5 w-16 mx-1 mb-5 rounded-full transition-colors duration-300',
                      i < currentStepIndex - 1
                        ? 'bg-green-400 dark:bg-green-600'
                        : 'bg-gray-200 dark:bg-gray-700'
                    )} />
                  )}
                </div>
              )
            })}
          </div>
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

          {/* Corporate Word template upload (only for Word format) */}
          {selectedFormat === 'word' && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Corporate Word Templates</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Upload branded .docx files with {'{placeholder}'} tags.</p>
                </div>
                <label className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload size={12} />
                  Upload .docx
                  <input
                    ref={docxFileInputRef}
                    type="file"
                    accept=".docx"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file || !projectId) return
                      setIsUploadingDocx(true)
                      setDocxUploadError(null)
                      try {
                        const base64 = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader()
                          reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1] || '')
                          reader.onerror = reject
                          reader.readAsDataURL(file)
                        })
                        const res = await corporateDocxTemplateService.create(projectId, {
                          name: file.name.replace(/\.docx$/i, '').slice(0, 80),
                          fileBase64: base64,
                        })
                        if (res.success && res.data) {
                          setCorporateDocxTemplates(prev => [res.data!, ...prev])
                          setSelectedCorporateDocxId(res.data!.id)
                        } else {
                          setDocxUploadError(res.error || 'Upload failed.')
                        }
                      } catch (err) {
                        setDocxUploadError('Failed to read file.')
                      } finally {
                        setIsUploadingDocx(false)
                        e.target.value = ''
                      }
                    }}
                  />
                </label>
              </div>
              <div className="p-3 space-y-2">
                {docxUploadError && <p className="text-xs text-red-500">{docxUploadError}</p>}
                {isUploadingDocx && <p className="text-xs text-blue-500 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Uploading…</p>}
                {corporateDocxTemplates.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No corporate templates yet. Upload a branded .docx file above.</p>
                ) : (
                  <ul className="space-y-1">
                    {corporateDocxTemplates.map(t => (
                      <li key={t.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="corporateDocxTemplate"
                            checked={selectedCorporateDocxId === t.id}
                            onChange={() => setSelectedCorporateDocxId(t.id)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                            {t.placeholders && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Placeholders: {t.placeholders}</p>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => setConfirmDialog({
                            title: 'Remove word template',
                            message: `Remove "${t.name}" from the corporate templates list?`,
                            onConfirm: () => corporateDocxTemplateService.remove(projectId!, t.id).then(() => {
                              setCorporateDocxTemplates(prev => prev.filter(x => x.id !== t.id))
                              if (selectedCorporateDocxId === t.id) setSelectedCorporateDocxId(null)
                            }),
                          })}
                          className="text-xs text-red-500 hover:text-red-700 shrink-0 px-1"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedCorporateDocxId && (
                  <button type="button" onClick={() => setSelectedCorporateDocxId(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    Clear selection (use standard export)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Excel column mapping (only for Excel format) */}
          {selectedFormat === 'excel' && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Excel Column Mappings</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Map system fields to named columns or ranges in a corporate spreadsheet.</p>
                </div>
                <button type="button" onClick={() => setIsMappingEditorOpen(v => !v)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">
                  {isMappingEditorOpen ? 'Close editor' : '+ New mapping'}
                </button>
              </div>
              <div className="p-3 space-y-2">
                {isMappingEditorOpen && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
                    <input
                      type="text"
                      value={newMappingName}
                      onChange={e => setNewMappingName(e.target.value)}
                      placeholder="Mapping name"
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Field mappings</p>
                      {draftMappingRows.map((row, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={row.systemField}
                            onChange={e => { const updated = [...draftMappingRows]; updated[i] = { ...updated[i], systemField: e.target.value }; setDraftMappingRows(updated) }}
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          >
                            <option value="">— field —</option>
                            {columns.map(c => <option key={c.key} value={String(c.key)}>{c.label}</option>)}
                          </select>
                          <span className="text-xs text-gray-400">→</span>
                          <input
                            type="text"
                            value={row.excelColumn}
                            onChange={e => { const updated = [...draftMappingRows]; updated[i] = { ...updated[i], excelColumn: e.target.value }; setDraftMappingRows(updated) }}
                            placeholder="Column / range"
                            className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          />
                          <button type="button" onClick={() => setDraftMappingRows(prev => prev.filter((_,j)=>j!==i))} className="text-red-400 hover:text-red-600 text-xs px-1">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setDraftMappingRows(prev => [...prev, { systemField: '', excelColumn: '' }])} className="text-xs text-blue-600 hover:text-blue-700">+ Add row</button>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setIsMappingEditorOpen(false); setNewMappingName(''); setDraftMappingRows([]) }} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
                      <button
                        type="button"
                        disabled={!newMappingName.trim() || draftMappingRows.length === 0}
                        onClick={() => {
                          excelColumnMappingService.create(projectId!, { name: newMappingName, mappings: draftMappingRows.filter(r => r.systemField && r.excelColumn) }).then(res => {
                            if (res.success && res.data) { setExcelColumnMappings(prev => [res.data!, ...prev]); setSelectedMappingId(res.data!.id); setIsMappingEditorOpen(false); setNewMappingName(''); setDraftMappingRows([]) }
                            else setInlineError(res.error || 'Could not save mapping.')
                          })
                        }}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50"
                      >
                        Save mapping
                      </button>
                    </div>
                  </div>
                )}
                {excelColumnMappings.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No mappings yet. Standard column export will be used.</p>
                ) : (
                  <ul className="space-y-1">
                    {excelColumnMappings.map(m => (
                      <li key={m.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                        <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name="excelMapping"
                            checked={selectedMappingId === m.id}
                            onChange={() => setSelectedMappingId(m.id)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{m.mappings.length} field(s) mapped</p>
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => setConfirmDialog({
                            title: 'Delete mapping',
                            message: `Delete column mapping "${m.name}"? This cannot be undone.`,
                            onConfirm: () => excelColumnMappingService.remove(projectId!, m.id).then(() => {
                              setExcelColumnMappings(prev => prev.filter(x => x.id !== m.id))
                              if (selectedMappingId === m.id) setSelectedMappingId(null)
                            }),
                          })}
                          className="text-xs text-red-500 hover:text-red-700 px-1 shrink-0"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedMappingId && (
                  <button type="button" onClick={() => setSelectedMappingId(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    Clear selection (use default columns)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Traceability Matrix (Excel/PDF/Word) */}
          {(selectedFormat === 'excel' || selectedFormat === 'pdf' || selectedFormat === 'word') && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Traceability Matrix</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Export a configurable matrix where each cell shows linked IDs (e.g., <span className="font-mono">TEST-001, TEST-005</span>).
                </p>
              </div>
              <div className="p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={!!traceMatrixConfig}
                    onChange={(e) => {
                      if (e.target.checked) setTraceMatrixConfig({ rowType: 'requirement', colType: 'verification', includeFlatSheet: true })
                      else setTraceMatrixConfig(null)
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  Enable traceability matrix export
                </label>

                {traceMatrixConfig && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rows</label>
                      <select
                        value={traceMatrixConfig.rowType}
                        onChange={(e) => setTraceMatrixConfig((prev) => prev ? { ...prev, rowType: e.target.value } : prev)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      >
                        <option value="requirement">Requirements</option>
                        <option value="function">Functions</option>
                        <option value="parameter">Parameters</option>
                        <option value="architecture">Architectures</option>
                        <option value="verification">Verification</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Columns</label>
                      <select
                        value={traceMatrixConfig.colType}
                        onChange={(e) => setTraceMatrixConfig((prev) => prev ? { ...prev, colType: e.target.value } : prev)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      >
                        <option value="verification">Verification</option>
                        <option value="architecture">Architectures</option>
                        <option value="function">Functions</option>
                        <option value="parameter">Parameters</option>
                        <option value="requirement">Requirements</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={traceMatrixConfig.includeFlatSheet !== false}
                          onChange={(e) => setTraceMatrixConfig((prev) => prev ? { ...prev, includeFlatSheet: e.target.checked } : prev)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                        />
                        Include flat link sheet (Excel)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
                    <div className="grid gap-3 sm:grid-cols-1">
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
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template name</label>
              <input
                type="text"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g. Customer report"
                maxLength={80}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Visibility</label>
                <div className="flex items-center gap-2">
                  {([['private', 'Private', Lock], ['project', 'This project', Building2], ['org', 'Organization', Globe]] as const).map(([val, label, Icon]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSaveTemplateVisibility(val)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${saveTemplateVisibility === val ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
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
                          <button
                            type="button"
                            onClick={() => {
                              const nextName = editingTemplateName.trim()
                              requirementExportTemplateService
                                .update(projectId!, t.id, { name: nextName })
                                .then((res) => {
                                  if (res.success && res.data) {
                                    const ui = toUiTemplate(res.data)
                                    setTemplates((prev) => prev.map((x) => (x.id === ui.id ? ui : x)))
                                  } else {
                                    setInlineError(res.error || 'Could not rename template.')
                                  }
                                })
                                .finally(() => {
                                  setEditingTemplateId(null)
                                  setEditingTemplateName('')
                                })
                            }}
                            className="px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Save
                          </button>
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
                          <button
                            type="button"
                            onClick={() => {
                              const jsonPayload = { name: t.name, format: t.format, payload: { columns: t.columns, sortBy: (t as any).sortBy, sortOrder: (t as any).sortOrder, scopeType: t.scopeType, selectedComponentIds: (t as any).selectedComponentIds ?? [], selectedFunctionIds: (t as any).selectedFunctionIds ?? [], exportSearch: (t as any).exportSearch ?? '', filters: (t as any).filters, includeHeader: t.includeHeader, parameterExportMode: t.parameterExportMode, includeGlossary: t.includeGlossary, includeAbbreviations: t.includeAbbreviations, glossaryShowDefinitions: t.glossaryShowDefinitions, glossarySortAlphabetically: t.glossarySortAlphabetically, sections: t.sections, documentStyle: t.documentStyle } }
                              const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], { type: 'application/json' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a'); a.href = url; a.download = `${t.name.replace(/[^a-zA-Z0-9_-]/g,'_')}_export_template.json`; a.click(); URL.revokeObjectURL(url)
                            }}
                            className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Export JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const copyName = (`Copy of ${t.name}`).slice(0, 80)
                              requirementExportTemplateService
                                .create(projectId!, {
                                  name: copyName,
                                  format: t.format as any,
                                  payload: {
                                    columns: t.columns.map((c) => ({ ...c })),
                                    sortBy: (t as any).sortBy,
                                    sortOrder: (t as any).sortOrder,
                                    scopeType: t.scopeType,
                                    selectedComponentIds: (t as any).selectedComponentIds ?? [],
                                    selectedFunctionIds: (t as any).selectedFunctionIds ?? [],
                                    exportSearch: (t as any).exportSearch ?? '',
                                    filters: (t as any).filters,
                                    includeHeader: t.includeHeader,
                                    parameterExportMode: t.parameterExportMode,
                                    includeGlossary: t.includeGlossary,
                                    includeAbbreviations: t.includeAbbreviations,
                                    glossaryShowDefinitions: t.glossaryShowDefinitions,
                                    glossarySortAlphabetically: t.glossarySortAlphabetically,
                                    createdAt: new Date().toISOString(),
                                    sections: t.sections?.map((s) => ({
                                      ...s,
                                      id: crypto.randomUUID(),
                                      options: s.options ? { ...s.options } : undefined,
                                    })),
                                    documentStyle: t.documentStyle ? { ...t.documentStyle } : undefined,
                                  },
                                })
                                .then((res) => {
                                  if (res.success && res.data) {
                                    const ui = toUiTemplate(res.data)
                                    setTemplates((prev) => [ui, ...prev])
                                    setSelectedTemplateId(ui.id)
                                    applyTemplate(ui)
                                    setIsManageTemplatesOpen(false)
                                  } else {
                                    setInlineError(res.error || 'Could not duplicate template.')
                                  }
                                })
                            }}
                            className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Duplicate
                          </button>
                          <button type="button" onClick={() => { setEditingTemplateId(t.id); setEditingTemplateName(t.name) }} className="px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Rename</button>
                          <button
                            type="button"
                            onClick={() => setConfirmDialog({
                              title: 'Delete template',
                              message: `Move "${t.name}" to the archive? You can restore it later.`,
                              onConfirm: () => requirementExportTemplateService.remove(projectId!, t.id).then((res) => {
                                if (res.success) {
                                  setTemplates((prev) => prev.filter((x) => x.id !== t.id))
                                  if (selectedTemplateId === t.id) setSelectedTemplateId(null)
                                  // Add to deleted list for immediate archive panel display
                                  requirementExportTemplateService.listDeleted(projectId!).then(r => {
                                    if (r.success && r.data) setDeletedTemplates(r.data)
                                  })
                                } else {
                                  setInlineError(res.error || 'Could not delete template.')
                                }
                              }),
                            })}
                            className="px-2 py-1 text-xs font-medium rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex items-center gap-1.5">
                    <Upload size={14} />
                    Import JSON
                    <input
                      ref={templateJsonInputRef}
                      type="file"
                      accept=".json"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file || !projectId) return
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          try {
                            const parsed = JSON.parse(ev.target?.result as string)
                            const name = (parsed.name || file.name.replace('.json','')).slice(0, 80)
                            const fmt = parsed.format || 'pdf'
                            const payload = parsed.payload ?? parsed
                            requirementExportTemplateService.create(projectId, { name, format: fmt, payload }).then(res => {
                              if (res.success && res.data) {
                                const ui = toUiTemplate(res.data)
                                setTemplates(prev => [ui, ...prev])
                                setInlineError(null)
                              } else {
                                setInlineError(res.error || 'Import failed.')
                              }
                            })
                          } catch { setInlineError('Invalid JSON file.') }
                        }
                        reader.readAsText(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                <button type="button" onClick={() => setIsManageTemplatesOpen(false)} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600">Done</button>
              </div>

              {/* Recently deleted archive panel */}
              {deletedTemplates.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-1">
                  <button
                    type="button"
                    onClick={() => setIsDeletedPanelOpen(v => !v)}
                    className="w-full flex items-center justify-between px-1 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-amber-500" />
                      Recently deleted ({deletedTemplates.length})
                    </span>
                    {isDeletedPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {isDeletedPanelOpen && (
                    <ul className="mt-2 space-y-1.5">
                      {deletedTemplates.map(t => (
                        <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{t.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">
                              {t.format.toUpperCase()} · deleted {t.deletedAt ? new Date(t.deletedAt).toLocaleDateString() : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (!projectId) return
                                requirementExportTemplateService.restore(projectId, t.id).then(res => {
                                  if (res.success && res.data) {
                                    setDeletedTemplates(prev => prev.filter(x => x.id !== t.id))
                                    const ui = toUiTemplate(res.data)
                                    setTemplates(prev => [ui, ...prev])
                                  }
                                })
                              }}
                              className="px-2 py-1 text-xs font-medium rounded border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDialog({
                                title: 'Delete permanently',
                                message: `Permanently delete "${t.name}"? This cannot be undone.`,
                                onConfirm: () => {
                                  if (!projectId) return
                                  requirementExportTemplateService.permanentDelete(projectId, t.id).then(res => {
                                    if (res.success) setDeletedTemplates(prev => prev.filter(x => x.id !== t.id))
                                  })
                                },
                              })}
                              className="px-2 py-1 text-xs font-medium rounded border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              Delete permanently
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              </div>
            </div>
          )}

            {/* Scheduled Exports (API hooks) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsScheduledExportsOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">Scheduled Exports</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">(hooks — {scheduledExports.length})</span>
                </div>
                {isScheduledExportsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {isScheduledExportsOpen && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Configure scheduled export triggers. Scheduling engine is a future feature; these entries act as configuration hooks.</p>
                  {scheduledExports.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No scheduled exports yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {scheduledExports.map(se => (
                        <li key={se.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{se.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{se.format.toUpperCase()}{se.scheduleExpr ? ` · ${se.scheduleExpr}` : ''}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={se.enabled}
                              onChange={(e) => {
                                const on = e.target.checked
                                scheduledExportService.update(projectId!, se.id, { enabled: on }).then(res => {
                                  if (res.success && res.data) setScheduledExports(prev => prev.map(x => x.id === se.id ? res.data! : x))
                                })
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                          <button
                            type="button"
                            onClick={() => setConfirmDialog({
                              title: 'Delete schedule',
                              message: `Delete scheduled export "${se.name}"? This cannot be undone.`,
                              onConfirm: () => scheduledExportService.remove(projectId!, se.id).then(() =>
                                setScheduledExports(prev => prev.filter(x => x.id !== se.id))
                              ),
                            })}
                            className="text-xs text-red-500 hover:text-red-700 px-1"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {isAddingSchedule ? (
                    <div className="space-y-2 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                      <input
                        type="text"
                        value={newScheduleName}
                        onChange={e => setNewScheduleName(e.target.value)}
                        placeholder="Schedule name"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                      <input
                        type="text"
                        value={newScheduleExpr}
                        onChange={e => setNewScheduleExpr(e.target.value)}
                        placeholder="Cron expression (e.g. 0 9 * * 1)"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setIsAddingSchedule(false); setNewScheduleName(''); setNewScheduleExpr('') }} className="px-3 py-1.5 text-xs border rounded-lg">Cancel</button>
                        <button
                          type="button"
                          disabled={!newScheduleName.trim()}
                          onClick={() => {
                            scheduledExportService.create(projectId!, { name: newScheduleName, scheduleExpr: newScheduleExpr || undefined, format: selectedFormat, templateId: selectedTemplateId ?? undefined }).then(res => {
                              if (res.success && res.data) { setScheduledExports(prev => [res.data!, ...prev]); setIsAddingSchedule(false); setNewScheduleName(''); setNewScheduleExpr('') }
                              else setInlineError(res.error || 'Could not create schedule.')
                            })
                          }}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50"
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setIsAddingSchedule(true)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                      + Add schedule
                    </button>
                  )}
                </div>
              )}
            </div>

            </>
          )}

          {currentStep === 'scope' && (
            <>
          {/* Step 2: Scope and options */}
          <div className="space-y-6">
          <section className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scope</h3>
          {enableScopeSelection && (componentTree.length > 0 || flatFunctions.length > 0) ? (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scopeType === 'all'}
                  onChange={() => {
                    setScopeType('all')
                    setSelectedComponentIds([])
                    setSelectedFunctionIds([])
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">All requirements</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scopeType === 'custom'}
                  onChange={() => setScopeType('custom')}
                  className="w-4 h-4 text-blue-600 border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Custom selection (components and/or functions)</span>
              </label>

              {scopeType === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Components</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{selectedComponentIds.length} selected</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Search components..."
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                      {filteredComponents.map((c) => {
                        const checked = selectedComponentIds.includes(c.id)
                        return (
                          <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked
                                setSelectedComponentIds((prev) => on ? Array.from(new Set([...prev, c.id])) : prev.filter((x) => x !== c.id))
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="truncate">{c.displayLabel}</span>
                          </label>
                        )
                      })}
                      {filteredComponents.length === 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1 py-2">No matching components.</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Functions</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{selectedFunctionIds.length} selected</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Search functions..."
                      value={functionSearch}
                      onChange={(e) => setFunctionSearch(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
                      {filteredFunctions.map((f) => {
                        const checked = selectedFunctionIds.includes(f.id)
                        return (
                          <label key={f.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked
                                setSelectedFunctionIds((prev) => on ? Array.from(new Set([...prev, f.id])) : prev.filter((x) => x !== f.id))
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                            <span className="truncate">{f.displayLabel}</span>
                          </label>
                        )
                      })}
                      {filteredFunctions.length === 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 px-1 py-2">No matching functions.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">All requirements in this view.</p>
          )}
          </section>

          {/* Content and layout options */}
          <section className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content and layout</h3>
            {/* Advanced filtering (Phase 2) */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <span className="font-medium">Advanced filters</span>
                {isAdvancedFiltersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {isAdvancedFiltersOpen && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search (title, description, ID)
                    </label>
                    <input
                      type="text"
                      value={exportSearch}
                      onChange={(e) => setExportSearch(e.target.value)}
                      placeholder="e.g. braking, FMEA, REQ-123"
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">All</option>
                        {filterOptions.statuses.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                      <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">All</option>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="critical">critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">All</option>
                        {filterOptions.categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Owner</label>
                      <select
                        value={filterOwner}
                        onChange={(e) => setFilterOwner(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="all">All</option>
                        {filterOptions.owners.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Matches: {filteredRequirements.length} requirement(s)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExportSearch('')
                        setFilterStatus('all')
                        setFilterPriority('all')
                        setFilterCategory('all')
                        setFilterOwner('all')
                      }}
                      className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      Clear filters
                    </button>
                  </div>
                </div>
              )}
            </div>
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

          {/* Export sorting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort exported requirements by
              </label>
              <select
                value={exportSortBy}
                onChange={(e) => setExportSortBy(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="requirementId">ID</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
                <option value="createdAt">Created</option>
                <option value="updatedAt">Updated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort order
              </label>
              <select
                value={exportSortOrder}
                onChange={(e) => setExportSortOrder(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
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
            <div className="space-y-1 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
              {columns.map((col, idx) => (
                <div
                  key={col.key}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded"
                >
                  <button
                    type="button"
                    onClick={() => toggleColumn(col.key)}
                    className="text-gray-600 dark:text-gray-400"
                    title={col.selected ? 'Included' : 'Excluded'}
                  >
                    {col.selected ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} />
                    )}
                  </button>
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumnLabel(col.key, e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    aria-label={`Column header for ${String(col.key)}`}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveColumn(col.key, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 disabled:opacity-40"
                      title="Move up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveColumn(col.key, 'down')}
                      disabled={idx === columns.length - 1}
                      className="p-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 disabled:opacity-40"
                      title="Move down"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Apply preset</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        ['authority', 'Authority submission'],
                        ['simple', 'Simple list'],
                        ['full', 'Full report'],
                        ['submission_with_placeholders', 'With placeholders'],
                      ] as const).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => { applyPreset(val); setDocumentPresetSelect(val) }}
                          className={clsx(
                            'px-2 py-1.5 text-xs rounded-lg border transition-colors text-left flex items-center gap-1.5',
                            documentPresetSelect === val
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                              : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          )}
                        >
                          {documentPresetSelect === val && <Check size={11} className="shrink-0" />}
                          {label}
                        </button>
                      ))}
                    </div>
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
                            <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{(sec.type ?? '').replace('_', ' ')}</span>
                          </label>
                          <input
                            type="text"
                            value={sec.title ?? ''}
                            onChange={(e) => updateSection(sec.id, { title: e.target.value || undefined })}
                            placeholder={(sec.type ?? '').replace('_', ' ')}
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

          {/* Summary banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Requirements', value: exportRequirements.length },
              { label: 'Format', value: selectedFormat.toUpperCase() },
              { label: 'Columns', value: selectedCount },
              { label: 'Scope', value: effectiveScopeLabel ?? 'All' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={String(value)}>{String(value)}</p>
              </div>
            ))}
          </div>

          {/* Breakdown by status */}
          {exportRequirements.length > 0 && (() => {
            const statusMap: Record<string, number> = {}
            const priorityMap: Record<string, number> = {}
            exportRequirements.forEach(r => {
              const s = r.status || 'unknown'; statusMap[s] = (statusMap[s] || 0) + 1
              const p = String(r.priority || 'unknown').toLowerCase(); priorityMap[p] = (priorityMap[p] || 0) + 1
            })
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">By Status</p>
                  <div className="space-y-1">
                    {Object.entries(statusMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(([s, n]) => (
                      <div key={s} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{s}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">By Priority</p>
                  <div className="space-y-1">
                    {['critical','high','medium','low'].filter(p => priorityMap[p]).map(p => (
                      <div key={p} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{p}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{priorityMap[p]}</span>
                      </div>
                    ))}
                    {Object.entries(priorityMap).filter(([p]) => !['critical','high','medium','low'].includes(p)).map(([p,n]) => (
                      <div key={p} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 capitalize">{p}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Validation warnings */}
          {(() => {
            const warnings: string[] = []
            const noTitle = exportRequirements.filter(r => !r.title?.trim()).length
            const noDesc = exportRequirements.filter(r => !r.description?.trim() || r.description.replace(/<[^>]*>/g,'').trim() === '').length
            const noOwner = exportRequirements.filter(r => !r.owner?.trim()).length
            const noStatus = exportRequirements.filter(r => !r.status?.trim()).length
            if (noTitle > 0) warnings.push(`${noTitle} requirement(s) have no title`)
            if (noDesc > 0) warnings.push(`${noDesc} requirement(s) have no description`)
            if (noOwner > 0) warnings.push(`${noOwner} requirement(s) have no owner assigned`)
            if (noStatus > 0) warnings.push(`${noStatus} requirement(s) have no status set`)
            if (exportRequirements.length >= LARGE_EXPORT_THRESHOLD) warnings.push(`Large export (${exportRequirements.length} reqs) – may take a few seconds`)
            if (warnings.length === 0) return null
            return (
              <div className="border border-amber-200 dark:border-amber-700 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Validation warnings</span>
                </div>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-700 dark:text-amber-300">• {w}</li>
                  ))}
                </ul>
              </div>
            )
          })()}

          {/* Paginated preview table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Preview
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                  (rows {reviewPage * REVIEW_PAGE_SIZE + 1}–{Math.min((reviewPage + 1) * REVIEW_PAGE_SIZE, exportRequirements.length)} of {exportRequirements.length})
                </span>
              </h3>
              {exportRequirements.length > REVIEW_PAGE_SIZE && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setReviewPage(p => Math.max(0, p - 1))}
                    disabled={reviewPage === 0}
                    className="p-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-center">
                    {reviewPage + 1} / {Math.ceil(exportRequirements.length / REVIEW_PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReviewPage(p => Math.min(Math.ceil(exportRequirements.length / REVIEW_PAGE_SIZE) - 1, p + 1))}
                    disabled={reviewPage >= Math.ceil(exportRequirements.length / REVIEW_PAGE_SIZE) - 1}
                    className="p-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            {selectedFormat === 'reqif' ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">ReqIF export will include all requirements in scope. No row preview.</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      {columns.filter((c) => c.selected).map((c) => (
                        <th key={c.key} className="px-2 py-1.5 text-left font-medium text-gray-900 dark:text-white whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exportRequirements.slice(reviewPage * REVIEW_PAGE_SIZE, (reviewPage + 1) * REVIEW_PAGE_SIZE).map((req) => (
                      <tr key={req.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        {columns.filter((c) => c.selected).map((col) => {
                          let val = col.key === 'requirementId' ? (req.requirementId || req.id.slice(0, 8)) : (req[col.key as keyof Requirement] ?? '')
                          if (typeof val === 'string' && (col.key === 'description' || col.key === 'acceptanceCriteria')) val = stripHtml(val)
                          if (typeof val === 'string' && val.length > 100) val = val.slice(0, 100) + '…'
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

        {/* In-app confirmation dialog */}
        {confirmDialog && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 rounded-lg">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{confirmDialog.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export progress overlay for large exports */}
        {isExporting && exportProgress > 0 && (
          <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 flex flex-col items-center justify-center z-10 rounded-lg gap-4">
            <Loader2 size={32} className="text-blue-500 animate-spin" />
            <div className="w-64 space-y-2 text-center">
              <p className="text-sm font-medium text-gray-800 dark:text-white">{exportProgressLabel}</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{exportProgress}% complete</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {/* Left: context + cancel */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <span className="hidden sm:block text-xs text-gray-400 dark:text-gray-500 select-none">
              Step {currentStepIndex} of {steps.length} — {steps[currentStepIndex - 1]?.label}
            </span>
          </div>
          {/* Right: Back + Next/Export */}
          <div className="flex items-center gap-2">
            {currentStep !== 'format' && (
              <button
                type="button"
                onClick={() => { setInlineError(null); setCurrentStep(currentStep === 'scope' ? 'format' : 'scope') }}
                className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 flex items-center gap-1.5 transition-colors"
              >
                <ChevronLeft size={15} />
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
                    if (scopeType === 'custom' && selectedComponentIds.length === 0 && selectedFunctionIds.length === 0) {
                      setInlineError('Select at least one component or function for the custom scope (or switch to "All requirements").')
                    }
                    else if (selectedCount === 0) setInlineError('Select at least one column to export.')
                    else setCurrentStep('review')
                  }
                }}
                disabled={
                  (currentStep === 'scope' && scopeType === 'custom' && selectedComponentIds.length === 0 && selectedFunctionIds.length === 0) ||
                  (currentStep === 'scope' && selectedCount === 0)
                }
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {currentStep === 'format' ? 'Next: Scope' : 'Next: Review'}
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleExport}
                disabled={isExporting || selectedCount === 0 || !canExport}
                className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                aria-label={`Export as ${selectedFormat.toUpperCase()}`}
              >
                <Download size={15} />
                {isExporting ? 'Exporting…' : `Export ${selectedFormat.toUpperCase()}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
