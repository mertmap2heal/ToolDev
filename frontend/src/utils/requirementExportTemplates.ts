/**
 * Requirement export templates – persisted per project in localStorage.
 * Used by ExportBuilder for save/load/delete and column merge when applying templates.
 */

const STORAGE_KEY_PREFIX = 'requirement-export-templates-'
const STORAGE_VERSION = 1

export type ExportTemplateFormat = 'csv' | 'excel' | 'pdf' | 'word' | 'reqif'

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
  scopeType: 'all' | 'component' | 'function'
  selectedComponentId?: string
  selectedFunctionId?: string
  includeHeader: boolean
  parameterExportMode: 'name' | 'resolved'
  includeGlossary: boolean
  includeAbbreviations: boolean
  glossaryShowDefinitions: boolean
  glossarySortAlphabetically: boolean
  createdAt?: string
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
 */
export function getExportTemplates(projectId: string): ExportTemplate[] {
  if (!projectId) return []
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return []
    const data = JSON.parse(raw) as StoredPayload
    if (!data || !Array.isArray(data.templates)) return []
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
