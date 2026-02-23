/**
 * Canonical placeholder format for parameters in requirement/function text: {{param:uuid}}
 * Enables rename-safe references (by id) and resolution to name or value.
 */

const PLACEHOLDER_REGEX = /\{\{param:([a-f0-9-]{36})\}\}/gi

export interface ParameterResolveEntry {
  id: string
  name: string
  defaultValue?: string | null
  unit?: string | null
  tolerance?: string | null
  minValue?: string | null
  maxValue?: string | null
}

export type ResolveMode = 'name' | 'resolved'

function formatResolved(p: ParameterResolveEntry): string {
  const value = p.defaultValue ?? ''
  const parts: string[] = [value]
  if (p.tolerance) parts.push(`±${p.tolerance}`)
  if (p.unit) parts.push(p.unit)
  return parts.join(' ').trim() || value
}

/**
 * Replaces {{param:id}} placeholders in text with parameter name or resolved value.
 * @param text - Raw text possibly containing {{param:uuid}} placeholders
 * @param parameterMap - Map of parameter id -> parameter (name, defaultValue, unit, tolerance, ...)
 * @param mode - 'name' to show parameter name, 'resolved' to show value ±tolerance unit
 * @returns Text with placeholders replaced; unknown ids are left as-is or replaced with [Unknown parameter]
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
