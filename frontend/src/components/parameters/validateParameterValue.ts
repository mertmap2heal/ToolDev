import type { ParameterValueFormat } from 'shared/types/engineering.types'

export interface EnumEntry { name: string; value: string }

function parseEnum(raw: string): EnumEntry[] {
  try {
    const p = JSON.parse(raw)
    if (Array.isArray(p)) return p as EnumEntry[]
  } catch { /* ignore */ }
  return []
}

/** Parse a dimensions string like "3x1", "4x4", "3" into [rows, cols].
 *  "3" → [3, 1]  (column vector)
 *  "3x1" → [3, 1]
 *  "4x4" → [4, 4]
 */
function parseDims(dims: string): [number, number] | null {
  const m = dims.trim().match(/^(\d+)(?:[xX*](\d+))?$/)
  if (!m) return null
  return [parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 1]
}

/** Count how many comma-separated top-level tokens are in a bracket-stripped string.
 *  "[1, 2, 3]" → 3
 *  "1, 2, 3" → 3
 */
function countTopLevelCommas(s: string): number {
  const stripped = s.trim().replace(/^\[/, '').replace(/\]$/, '').trim()
  if (!stripped) return 0
  let depth = 0, count = 1
  for (const ch of stripped) {
    if (ch === '[') depth++
    else if (ch === ']') depth--
    else if (ch === ',' && depth === 0) count++
  }
  return count
}

/** Validate a matrix value like [[1,0,0],[0,1,0],[0,0,1]] against rows × cols. */
function validateMatrix(value: string, rows: number, cols: number): string | null {
  const stripped = value.trim()
  if (!stripped.startsWith('[[')) {
    return `Expected ${rows}x${cols} matrix in format [[row0], [row1], ...] but value does not start with "[["`
  }
  // Count outer rows
  const outer = countTopLevelCommas(stripped)
  if (outer !== rows) {
    return `Expected ${rows} rows but found ${outer}`
  }
  // Each inner element should be a bracketed list of cols elements
  // Quick check: strip outer brackets and split on '], ['
  const inner = stripped.trim().slice(1, -1).trim() // remove outer [ ]
  const rowParts = inner.split(/\],\s*\[/)
  if (rowParts.length !== rows) {
    return `Expected ${rows} rows but found ${rowParts.length}`
  }
  for (let r = 0; r < rowParts.length; r++) {
    const rowStr = rowParts[r].replace(/^\[/, '').replace(/\]$/, '')
    const elems = rowStr.split(',').map(s => s.trim()).filter(Boolean)
    if (elems.length !== cols) {
      return `Row ${r + 1}: expected ${cols} elements but found ${elems.length}`
    }
  }
  return null
}

/** Validate a 1-D array value like [1, 2, 3] against length. */
function validateArray(value: string, length: number): string | null {
  const stripped = value.trim()
  if (!stripped.startsWith('[')) {
    // Also allow bare comma-separated: "1, 2, 3"
    const parts = stripped.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length !== length) {
      return `Expected ${length} elements (as [v1, v2, ...] or v1, v2, ...) but found ${parts.length}`
    }
    return null
  }
  const count = countTopLevelCommas(stripped)
  if (count !== length) {
    return `Expected ${length} elements but found ${count}`
  }
  return null
}

// ── main validator ──────────────────────────────────────────────────────────

type TypeCategory = 'numeric' | 'boolean' | 'string' | 'enum' | 'vector' | 'other'

function detectCategory(dataType: string): TypeCategory {
  const t = dataType.trim().toLowerCase()
  if (!t) return 'other'
  if (/\benum\b/.test(t)) return 'enum'
  if (/\b(vector|matrix|array)\b/.test(t)) return 'vector'
  if (/\b(bool|boolean)\b/.test(t)) return 'boolean'
  if (/\b(string|str|char|text)\b/.test(t)) return 'string'
  if (/\b(float|double|int|uint|real|single|complex|fixed|q\d|s\d)\b/.test(t)) return 'numeric'
  return 'other'
}

/**
 * Validates the parameter value string.
 * Returns an error message string, or null if valid / no constraint applies.
 */
export function validateParameterValue(
  value: string,
  dataType: string,
  enumValuesRaw: string,
  dimensions: string,
  valueFormat?: ParameterValueFormat | null
): string | null {
  const v = value.trim()
  if (!v) return null // empty is always allowed (not required here)

  const category = detectCategory(dataType)

  // --- boolean ---
  if (category === 'boolean') {
    if (!['true', 'false', '1', '0'].includes(v.toLowerCase())) {
      return 'Boolean value must be true, false, 1, or 0'
    }
    return null
  }

  // --- string --- no constraint
  if (category === 'string') return null

  // --- enum: must be one of the defined member names ---
  if (category === 'enum') {
    const members = parseEnum(enumValuesRaw)
    if (members.length > 0) {
      const names = members.map(m => m.name.trim()).filter(Boolean)
      if (!names.includes(v)) {
        return `Value must be one of the defined enum members: ${names.join(', ')}`
      }
    }
    return null
  }

  // --- numeric: must parse as a finite number ---
  if (category === 'numeric') {
    const n = Number(v)
    if (isNaN(n) || !isFinite(n)) {
      return `Value must be a valid number for type "${dataType}"`
    }
    return null
  }

  // --- vector/matrix: validate structure ---
  if (category === 'vector') {
    // Check dimensions from the dimensions field first, then valueFormat
    const dimStr = dimensions.trim() || valueFormat?.dimensions?.trim() || ''
    if (dimStr) {
      const parsed = parseDims(dimStr)
      if (parsed) {
        const [rows, cols] = parsed
        if (rows > 1 && cols > 1) {
          return validateMatrix(v, rows, cols)
        } else {
          const length = rows * cols
          return validateArray(v, length)
        }
      }
    }
    return null // no dimension constraint — accept any
  }

  // --- custom type with valueFormat ---
  if (valueFormat) {
    // Pattern validation
    if (valueFormat.pattern) {
      try {
        const rx = new RegExp(valueFormat.pattern)
        if (!rx.test(v)) {
          return `Value does not match the required format${valueFormat.template ? ` (expected: ${valueFormat.template})` : ''}`
        }
        return null
      } catch { /* invalid regex — ignore */ }
    }
    // Dimension-based structural validation
    if (valueFormat.dimensions) {
      const parsed = parseDims(valueFormat.dimensions)
      if (parsed) {
        const [rows, cols] = parsed
        if (rows > 1 && cols > 1) {
          return validateMatrix(v, rows, cols)
        } else {
          return validateArray(v, rows * cols)
        }
      }
    }
    // Structure-based
    if (valueFormat.structure === 'matrix') {
      if (!v.startsWith('[[')) return 'Matrix values must be in [[row0], [row1], ...] format'
    }
    if (valueFormat.structure === 'array') {
      if (!v.startsWith('[') && !v.includes(',')) {
        return 'Array values should be in [v1, v2, ...] or comma-separated format'
      }
    }
  }

  return null
}
