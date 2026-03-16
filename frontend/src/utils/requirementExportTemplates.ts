/**
 * Requirement export templates – persisted per project in localStorage.
 * Used by ExportBuilder for save/load/delete and column merge when applying templates.
 */

const STORAGE_KEY_PREFIX = 'requirement-export-templates-'
const STORAGE_VERSION = 2

export type ExportTemplateFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'reqif'

export type ExportSectionType = 'cover' | 'summary' | 'requirements_table' | 'glossary' | 'abbreviations' | 'custom_text' | 'placeholder'

export interface ExportSection {
  id: string
  type: ExportSectionType
  title?: string
  enabled: boolean
  options?: {
    showProjectName?: boolean
    showDate?: boolean
    showVersion?: boolean
    versionLabel?: string
    classification?: string
    preparerOrOrg?: string
    content?: string
    /** Placeholder: full blank page(s) or heading with space below */
    placeholderStyle?: 'full_page' | 'heading_with_space'
    /** Placeholder full_page: number of blank pages to reserve (default 1) */
    blankPageCount?: number
    /** Start this section on a new page (default true) */
    startOnNewPage?: boolean
    /** Number of blank pages to insert after this section (0–5) */
    blankPagesAfter?: number
  }
}

export interface ExportDocumentStyle {
  coverTitle?: string
  headerLeft?: string
  headerCenter?: string
  headerRight?: string
  footerLeft?: string
  footerCenter?: string
  footerRight?: string
  pageNumberFormat?: 'none' | 'page' | 'pageOfN'
  marginMm?: number
  fontFamily?: string
  fontSizeBody?: number
  fontSizeHeading1?: number
  fontSizeHeading2?: number
  tableHeaderBg?: string
  tableHeaderFg?: string
  tableBorderColor?: string
  tableAlternateRowBg?: string
}

export interface ExportColumn {
  key: string
  label: string
  selected: boolean
}

export interface ExportTemplate {
  id: string
  name: string
  format: ExportTemplateFormat
  columns: ExportColumn[]
  /** Optional export-time sorting (applied before file generation). */
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  scopeType: 'all' | 'custom'
  /** Multi-select scope (Phase 2). */
  selectedComponentIds?: string[]
  selectedFunctionIds?: string[]
  /** Legacy single-select fields (kept for backward compatibility during migration). */
  selectedComponentId?: string
  selectedFunctionId?: string
  /** Phase 2 export-time filters/search */
  exportSearch?: string
  filters?: {
    status?: string
    priority?: string
    category?: string
    owner?: string
  }
  includeHeader: boolean
  parameterExportMode: 'name' | 'resolved'
  includeGlossary: boolean
  includeAbbreviations: boolean
  glossaryShowDefinitions: boolean
  glossarySortAlphabetically: boolean
  createdAt?: string
  sections?: ExportSection[]
  documentStyle?: ExportDocumentStyle
}

interface StoredPayload {
  version: number
  templates: ExportTemplate[]
}

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`
}

/**
 * Returns all saved export templates for the project. On parse error returns [].
 * Version 1 payloads are returned as-is (sections and documentStyle remain undefined for legacy behavior).
 */
export function getExportTemplates(projectId: string): ExportTemplate[] {
  if (!projectId) return []
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return []
    const data = JSON.parse(raw) as StoredPayload
    if (!data || !Array.isArray(data.templates)) return []
    if (data.version === STORAGE_VERSION) return data.templates
    return data.templates
  } catch {
    return []
  }
}

/**
 * Saves a template (append or upsert by id). Throws on QuotaExceededError.
 */
export function saveExportTemplate(projectId: string, template: ExportTemplate): void {
  if (!projectId) return
  const list = getExportTemplates(projectId)
  const index = list.findIndex((t) => t.id === template.id)
  const next = [...list]
  if (index >= 0) next[index] = template
  else next.push(template)
  const payload: StoredPayload = { version: STORAGE_VERSION, templates: next }
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(payload))
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('Could not save template. Try removing old templates or free browser storage.')
    }
    throw e
  }
}

/**
 * Deletes a template by id.
 */
export function deleteExportTemplate(projectId: string, templateId: string): void {
  if (!projectId) return
  const list = getExportTemplates(projectId).filter((t) => t.id !== templateId)
  const payload: StoredPayload = { version: STORAGE_VERSION, templates: list }
  localStorage.setItem(storageKey(projectId), JSON.stringify(payload))
}

/**
 * Updates an existing template by id (e.g. rename). No-op if id not found.
 */
export function updateExportTemplate(
  projectId: string,
  templateId: string,
  patch: Partial<ExportTemplate>
): void {
  if (!projectId) return
  const list = getExportTemplates(projectId)
  const index = list.findIndex((t) => t.id === templateId)
  if (index < 0) return
  const next = [...list]
  next[index] = { ...next[index], ...patch }
  const payload: StoredPayload = { version: STORAGE_VERSION, templates: next }
  localStorage.setItem(storageKey(projectId), JSON.stringify(payload))
}

/**
 * Merges saved template columns with current default columns so that:
 * - For each default column, use saved `selected` if that key exists in saved, else use default.
 * - Append any saved column keys not in defaults (future-proofing).
 */
export function mergeColumnsWithDefaults(
  savedColumns: ExportColumn[],
  defaultColumns: ExportColumn[]
): ExportColumn[] {
  const savedByKey = new Map(savedColumns.map((c) => [c.key, c]))
  const result: ExportColumn[] = defaultColumns.map((def) => {
    const saved = savedByKey.get(def.key)
    return saved !== undefined ? { ...def, selected: saved.selected } : { ...def }
  })
  savedColumns.forEach((s) => {
    if (!defaultColumns.some((d) => d.key === s.key)) result.push({ ...s })
  })
  return result
}

/** Default authority document style (neutral, submission-ready) */
export const DEFAULT_AUTHORITY_STYLE: ExportDocumentStyle = {
  coverTitle: 'Requirements Export',
  footerCenter: 'Page {page} of {pageOfN}',
  footerRight: '{date}',
  headerLeft: '{title}',
  pageNumberFormat: 'pageOfN',
  marginMm: 25,
  fontSizeBody: 11,
  fontSizeHeading1: 14,
  fontSizeHeading2: 12,
  tableHeaderBg: '#374151',
  tableHeaderFg: '#ffffff',
  tableBorderColor: '#E5E7EB',
  tableAlternateRowBg: '#F9FAFB',
}

/** Build default sections for a preset */
export function getSectionsForPreset(preset: 'authority' | 'simple' | 'full' | 'submission_with_placeholders'): ExportSection[] {
  const base = (type: ExportSectionType, title: string, options?: ExportSection['options']): ExportSection => ({
    id: crypto.randomUUID(),
    type,
    title,
    enabled: true,
    options,
  })
  switch (preset) {
    case 'authority':
      return [
        base('cover', 'Cover', { showProjectName: true, showDate: true }),
        base('summary', 'Summary'),
        base('requirements_table', 'Requirements'),
        base('glossary', 'Glossary'),
        base('abbreviations', 'Abbreviations'),
      ]
    case 'simple':
      return [base('requirements_table', 'Requirements')]
    case 'full':
      return [
        base('cover', 'Cover', { showProjectName: true, showDate: true }),
        base('summary', 'Summary'),
        base('requirements_table', 'Requirements'),
        base('glossary', 'Glossary'),
        base('abbreviations', 'Abbreviations'),
        base('custom_text', 'Appendix', { content: '' }),
      ]
    case 'submission_with_placeholders':
      return [
        base('cover', 'Cover', { showProjectName: true, showDate: true }),
        base('summary', 'Summary'),
        base('requirements_table', 'Requirements'),
        base('glossary', 'Glossary'),
        base('abbreviations', 'Abbreviations'),
        base('placeholder', 'Approval / Sign-off', { placeholderStyle: 'full_page', blankPageCount: 1 }),
        base('placeholder', 'Notes', { placeholderStyle: 'heading_with_space' }),
      ]
    default:
      return [base('requirements_table', 'Requirements')]
  }
}
