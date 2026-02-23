/**
 * Canonical placeholder format for parameters in requirement/function text: {{param:uuid}}
 * Must stay in sync with backend parameterPlaceholder for export/display.
 */

// Match {{param:uuid}} with optional whitespace; UUID is 8-4-4-4-12 hex (case-insensitive)
const PLACEHOLDER_REGEX = /\{\{\s*param\s*:\s*([a-f0-9-]{36})\s*\}\}/gi

export interface ParameterResolveEntry {
  id: string
  name: string
  defaultValue?: string | null
  unit?: string | null
  tolerance?: string | null
  minValue?: string | null
  maxValue?: string | null
  resolvedDisplay?: string
}

export type ResolveMode = 'name' | 'resolved'

function formatResolved(p: ParameterResolveEntry): string {
  if (p.resolvedDisplay) return p.resolvedDisplay
  const value = p.defaultValue ?? ''
  const parts: string[] = [value]
  if (p.tolerance) parts.push(`±${p.tolerance}`)
  if (p.unit) parts.push(p.unit)
  return parts.join(' ').trim() || value
}

/**
 * Replaces {{param:id}} placeholders in text with parameter name or resolved value.
 */
export function resolveParameterPlaceholders(
  text: string,
  parameterMap: Map<string, ParameterResolveEntry>,
  mode: ResolveMode
): string {
  if (!text) return ''
  return text.replace(PLACEHOLDER_REGEX, (_, id: string) => {
    const p = parameterMap.get(id.toLowerCase())
    if (!p) return `[Unknown parameter: ${id.slice(0, 8)}]`
    return mode === 'name' ? p.name : formatResolved(p)
  })
}

/**
 * Extracts parameter ids from text ({{param:id}}).
 */
export function extractParameterIds(text: string): string[] {
  if (!text) return []
  const ids = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(PLACEHOLDER_REGEX.source, 'gi')
  while ((m = re.exec(text)) !== null) {
    if (m[1]) ids.add(m[1].toLowerCase())
  }
  return Array.from(ids)
}

/** Placeholder for a given parameter id (for insertion in editors). */
export function toPlaceholder(parameterId: string): string {
  return `{{param:${parameterId}}}`
}

const PARAM_SPAN_REGEX = /<span[^>]*\sdata-param-id="([^"]+)"[^>]*>([^<]*)<\/span>/gi

/**
 * Replaces {{param:id}} in HTML with <span data-param-id="id">Name</span> for display in the editor.
 * Use with a map built from getParameters so users see parameter names instead of raw placeholders.
 */
export function placeholdersToEditorSpans(
  html: string,
  parameterMap: Map<string, Pick<ParameterResolveEntry, 'id' | 'name'>>
): string {
  if (!html) return ''
  return html.replace(PLACEHOLDER_REGEX, (_, id: string) => {
    const p = parameterMap.get(id.toLowerCase())
    const name = p ? escapeHtml(p.name) : `[Unknown: ${id.slice(0, 8)}]`
    return `<span data-param-id="${id}" class="param-ref">${name}</span>`
  })
}

/**
 * Replaces <span data-param-id="id">...</span> in editor HTML back to {{param:id}} for storage/API.
 */
export function editorSpansToPlaceholders(html: string): string {
  if (!html) return ''
  return html.replace(PARAM_SPAN_REGEX, (_, id: string) => toPlaceholder(id))
}

function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
