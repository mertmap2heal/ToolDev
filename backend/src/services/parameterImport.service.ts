/**
 * Parameter Import Service
 * Parses parameter files from common engineering formats into a normalised shape
 * that can be upserted into the database.
 * Pure TypeScript — no external dependencies.
 */

export interface ParsedParam {
  name: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  tolerance?: string
  minValue?: string
  maxValue?: string
  tags?: string[]
  formula?: string
  status?: string
}

export interface ImportResult {
  parsed: ParsedParam[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trimQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '').trim()
}

// ---------------------------------------------------------------------------
// CSV parser
// Expects a header row; maps columns by name (case-insensitive).
// Recognised headers: name, description, data_type/datatype, value/defaultvalue,
//   unit, tolerance, min/minvalue/min_value, max/maxvalue/max_value, tags, formula
// ---------------------------------------------------------------------------
export function parseCSV(content: string): ImportResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { parsed: [], warnings: ['CSV has no data rows'] }

  const warnings: string[] = []

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n)
      if (i !== -1) return i
    }
    return -1
  }

  const nameIdx   = idx(['name'])
  const descIdx   = idx(['description', 'desc'])
  const typeIdx   = idx(['data_type', 'datatype', 'type'])
  const valueIdx  = idx(['value', 'defaultvalue', 'default_value'])
  const unitIdx   = idx(['unit', 'units'])
  const tolIdx    = idx(['tolerance', 'tol'])
  const minIdx    = idx(['min', 'minvalue', 'min_value'])
  const maxIdx    = idx(['max', 'maxvalue', 'max_value'])
  const tagsIdx   = idx(['tags'])
  const formulaIdx= idx(['formula'])
  const statusIdx = idx(['status'])

  if (nameIdx === -1) {
    return { parsed: [], warnings: ['CSV missing required "name" column'] }
  }

  const parsed: ParsedParam[] = []

  // Simple CSV field splitter that handles quoted fields
  function splitRow(row: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < row.length; i++) {
      const ch = row[i]
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current); current = ''
      } else {
        current += ch
      }
    }
    result.push(current)
    return result
  }

  for (let i = 1; i < lines.length; i++) {
    const fields = splitRow(lines[i])
    const name = (fields[nameIdx] ?? '').trim()
    if (!name) { warnings.push(`Row ${i + 1}: empty name, skipped`); continue }

    const p: ParsedParam = { name }
    if (descIdx !== -1 && fields[descIdx])   p.description  = fields[descIdx].trim()
    if (typeIdx !== -1 && fields[typeIdx])    p.dataType     = fields[typeIdx].trim()
    if (valueIdx !== -1 && fields[valueIdx])  p.defaultValue = fields[valueIdx].trim()
    if (unitIdx !== -1 && fields[unitIdx])    p.unit         = fields[unitIdx].trim()
    if (tolIdx !== -1 && fields[tolIdx])      p.tolerance    = fields[tolIdx].trim()
    if (minIdx !== -1 && fields[minIdx])      p.minValue     = fields[minIdx].trim()
    if (maxIdx !== -1 && fields[maxIdx])      p.maxValue     = fields[maxIdx].trim()
    if (formulaIdx !== -1 && fields[formulaIdx]) p.formula   = fields[formulaIdx].trim()
    if (tagsIdx !== -1 && fields[tagsIdx]) {
      p.tags = fields[tagsIdx].split(';').map(t => t.trim()).filter(Boolean)
    }
    if (statusIdx !== -1 && fields[statusIdx]) {
      const s = fields[statusIdx].trim().toLowerCase()
      if (['draft', 'approved', 'obsolete', 'review'].includes(s)) p.status = s
    }

    parsed.push(p)
  }

  return { parsed, warnings }
}

// ---------------------------------------------------------------------------
// JSON parser
// Accepts two shapes:
//   1. Array of parameter objects: [ { name, value, unit, ... }, ... ]
//   2. Object with a "parameters" array (our own export format)
// ---------------------------------------------------------------------------
export function parseJSON(content: string): ImportResult {
  const warnings: string[] = []
  let raw: unknown

  try {
    raw = JSON.parse(content)
  } catch (e) {
    return { parsed: [], warnings: [`JSON parse error: ${(e as Error).message}`] }
  }

  let items: unknown[]
  if (Array.isArray(raw)) {
    items = raw
  } else if (typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>).parameters)) {
    items = (raw as Record<string, unknown>).parameters as unknown[]
  } else {
    return { parsed: [], warnings: ['JSON must be an array or an object with a "parameters" array'] }
  }

  const parsed: ParsedParam[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>
    const name = (item.name as string | undefined)?.trim()
    if (!name) { warnings.push(`Item ${i}: missing name, skipped`); continue }

    const p: ParsedParam = { name }
    if (item.description)  p.description  = String(item.description)
    if (item.dataType || item.data_type) p.dataType = String(item.dataType ?? item.data_type)
    // Accept "value", "defaultValue", or "default_value"
    const val = item.value ?? item.defaultValue ?? item.default_value
    if (val !== undefined && val !== null) p.defaultValue = String(val)
    if (item.unit)         p.unit         = String(item.unit)
    if (item.tolerance)    p.tolerance    = String(item.tolerance)
    if (item.minValue || item.min_value || item.min)
      p.minValue = String(item.minValue ?? item.min_value ?? item.min)
    if (item.maxValue || item.max_value || item.max)
      p.maxValue = String(item.maxValue ?? item.max_value ?? item.max)
    if (item.formula)      p.formula      = String(item.formula)
    if (Array.isArray(item.tags)) p.tags  = (item.tags as unknown[]).map(String)
    if (item.status) {
      const s = String(item.status).toLowerCase()
      if (['draft', 'approved', 'obsolete', 'review'].includes(s)) p.status = s
    }

    parsed.push(p)
  }

  return { parsed, warnings }
}

// ---------------------------------------------------------------------------
// C header parser
// Recognises: #define NAME VALUE  /* optional comment with unit */
//             #define NAME_MIN    <value>
//             #define NAME_MAX    <value>
// Also handles: #define NAME_UNIT "string"
// ---------------------------------------------------------------------------
export function parseCHeader(content: string): ImportResult {
  const warnings: string[] = []
  const params: Map<string, ParsedParam> = new Map()

  // Pattern: #define IDENTIFIER value  /* optional comment */
  const defineRe = /^\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+([^\s/][^\s]*)\s*(?:\/\*([^*]*)(?:\*\/))?/gm

  let match: RegExpExecArray | null
  while ((match = defineRe.exec(content)) !== null) {
    const rawName  = match[1]
    const value    = match[2].trim()
    const comment  = (match[3] ?? '').trim()

    // Skip guard macros and internal macros
    if (rawName.endsWith('_H') || rawName.startsWith('__')) continue

    // Detect _MIN / _MAX / _UNIT suffixes
    if (rawName.endsWith('_MIN')) {
      const base = rawName.slice(0, -4)
      const existing = params.get(base) ?? { name: base }
      existing.minValue = value
      params.set(base, existing)
      continue
    }
    if (rawName.endsWith('_MAX')) {
      const base = rawName.slice(0, -4)
      const existing = params.get(base) ?? { name: base }
      existing.maxValue = value
      params.set(base, existing)
      continue
    }
    if (rawName.endsWith('_UNIT')) {
      const base = rawName.slice(0, -5)
      const existing = params.get(base) ?? { name: base }
      existing.unit = trimQuotes(value)
      params.set(base, existing)
      continue
    }

    // Extract unit from comment like /* [m/s] */ or /* m/s */
    let unit: string | undefined
    let description: string | undefined
    if (comment) {
      const unitMatch = comment.match(/\[([^\]]+)\]/)
      if (unitMatch) {
        unit = unitMatch[1].trim()
        description = comment.replace(unitMatch[0], '').trim() || undefined
      } else {
        description = comment || undefined
      }
    }

    // Convert macro name to human-readable: FUEL_FLOW_RATE → Fuel Flow Rate
    const humanName = rawName
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')

    const existing = params.get(rawName) ?? { name: humanName }
    existing.defaultValue = value
    if (unit) existing.unit = unit
    if (description) existing.description = description
    params.set(rawName, existing)
  }

  const parsed = Array.from(params.values())
  if (parsed.length === 0) warnings.push('No #define statements found in header file')

  return { parsed, warnings }
}

// ---------------------------------------------------------------------------
// MATLAB script parser (.m)
// Recognises patterns:
//   NAME = VALUE;              % optional comment with unit in [brackets]
//   NAME = VALUE; % [unit] description
//   % Description on previous line
// ---------------------------------------------------------------------------
export function parseMATLAB(content: string): ImportResult {
  const warnings: string[] = []
  const parsed: ParsedParam[] = []

  // Pattern: varName = value; % optional comment
  const assignRe = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;%\n]+?)\s*;?\s*(?:%(.*))?$/gm

  let match: RegExpExecArray | null
  let prevComment = ''

  for (const line of content.split(/\r?\n/)) {
    const commentOnly = line.trim().match(/^%(.*)$/)
    if (commentOnly) {
      prevComment = commentOnly[1].trim()
      continue
    }

    const assignMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;%\n]+?)\s*;?\s*(?:%(.*))?$/)
    if (assignMatch) {
      const name = assignMatch[1]
      const value = assignMatch[2].trim()
      const comment = (assignMatch[3] ?? '').trim()

      // Skip non-parameter assignments (function calls, etc.)
      if (value.includes('(') || value.includes('{')) { prevComment = ''; continue }
      // Skip internal MATLAB variables
      if (name.startsWith('dd') || name.startsWith('entry') || name.startsWith('dSect')) { prevComment = ''; continue }

      let unit: string | undefined
      let description: string | undefined

      // Try to extract unit from comment [unit] or (unit)
      const unitMatch = comment.match(/[\[(]([^\])\n]+)[\])]/)
      if (unitMatch) {
        unit = unitMatch[1].trim()
        description = comment.replace(unitMatch[0], '').trim() || prevComment || undefined
      } else if (comment) {
        description = comment || prevComment || undefined
      } else if (prevComment) {
        description = prevComment
      }

      parsed.push({
        name,
        defaultValue: value,
        ...(unit && { unit }),
        ...(description && { description }),
      })
    }

    prevComment = ''
  }

  if (parsed.length === 0) warnings.push('No variable assignments found in MATLAB script')

  return { parsed, warnings }
}

// ---------------------------------------------------------------------------
// SysML / XMI parser (.xmi, .xml)
// Handles two common shapes:
//   1. UML/SysML ownedAttribute elements inside packagedElement blocks
//      <ownedAttribute xmi:id="..." name="mass" type="Real">
//        <ownedComment><body>Total system mass</body></ownedComment>
//        <defaultValue xmi:type="uml:LiteralReal" value="12.5"/>
//        <lowerValue .../> <upperValue .../>
//      </ownedAttribute>
//   2. SysML 2.0 ParameterUsage / ValueProperty elements
// ---------------------------------------------------------------------------
export function parseSysMLXMI(content: string): ImportResult {
  const warnings: string[] = []
  const parsed: ParsedParam[] = []

  // Helper: extract a single XML attribute value
  const attr = (tag: string, attrName: string): string | null => {
    const re = new RegExp(`${attrName}="([^"]*)"`, 'i')
    const m = re.exec(tag)
    return m ? m[1] : null
  }

  // Collect all ownedAttribute / ownedMember / ValueProperty blocks
  // We use a broad regex then parse each block individually
  const blockPattern = /<(?:ownedAttribute|ownedMember|ValueProperty|ParameterUsage)\b([^>]*)>([\s\S]*?)<\/(?:ownedAttribute|ownedMember|ValueProperty|ParameterUsage)>/gi
  let blockMatch: RegExpExecArray | null

  // Also handle self-closing ownedAttribute tags (no children)
  const selfClosingPattern = /<(?:ownedAttribute|ownedMember)\b([^/]*)\s*\/>/gi

  const processBlock = (attrs: string, body: string | null) => {
    const name = attr(attrs, 'name')
    if (!name || name.trim() === '') return

    const p: ParsedParam = { name: name.trim() }

    // Description from <ownedComment><body>...</body></ownedComment>
    const commentMatch = body ? /<body[^>]*>([\s\S]*?)<\/body>/i.exec(body) : null
    if (commentMatch) p.description = commentMatch[1].replace(/<[^>]+>/g, '').trim()

    // Default value from <defaultValue .* value="N"/> or <defaultValue ...>N</defaultValue>
    if (body) {
      const dvAttr = /<defaultValue\b[^>]*\bvalue="([^"]*)"/.exec(body)
      if (dvAttr) p.defaultValue = dvAttr[1].trim()
      else {
        const dvBody = /<defaultValue[^>]*>([\s\S]*?)<\/defaultValue>/i.exec(body)
        if (dvBody) p.defaultValue = dvBody[1].replace(/<[^>]+>/g, '').trim()
      }
    }

    // Lower / upper bounds
    if (body) {
      const lv = /<lowerValue\b[^>]*\bvalue="([^"]*)"/.exec(body)
      if (lv) p.minValue = lv[1].trim()
      const uv = /<upperValue\b[^>]*\bvalue="([^"]*)"/.exec(body)
      if (uv) p.maxValue = uv[1].trim()
    }

    // Unit from <unit name="..."/> or xmi:type="sysml:ValueProperty" unit="..."
    const unitAttr = attr(attrs, 'unit')
    if (unitAttr) p.unit = unitAttr.trim()
    if (body) {
      const unitEl = /<unit\b[^>]*\bname="([^"]*)"/.exec(body)
      if (unitEl) p.unit = unitEl[1].trim()
    }

    // Data type hint from type="Real|Integer|String|Boolean" attr
    const typeAttr = attr(attrs, 'type')
    if (typeAttr) {
      const t = typeAttr.split(':').pop()?.toLowerCase() ?? ''
      if (t === 'real' || t === 'float' || t === 'double') p.dataType = 'float'
      else if (t === 'integer' || t === 'int') p.dataType = 'int'
      else if (t === 'boolean' || t === 'bool') p.dataType = 'bool'
      else if (t === 'string') p.dataType = 'string'
    }

    parsed.push(p)
  }

  while ((blockMatch = blockPattern.exec(content)) !== null) {
    processBlock(blockMatch[1], blockMatch[2])
  }

  let scMatch: RegExpExecArray | null
  while ((scMatch = selfClosingPattern.exec(content)) !== null) {
    processBlock(scMatch[1], null)
  }

  // Deduplicate by name (keep first occurrence)
  const seen = new Set<string>()
  const deduped = parsed.filter(p => {
    if (seen.has(p.name)) return false
    seen.add(p.name)
    return true
  })

  if (deduped.length === 0) warnings.push('No parameter elements found in XMI file. Expected ownedAttribute, ValueProperty, or ParameterUsage elements.')

  return { parsed: deduped, warnings }
}

// ---------------------------------------------------------------------------
// AUTOSAR A2L / ASAP2 parser (.a2l)
// Extracts CHARACTERISTIC and MEASUREMENT blocks.
// Recognised fields: name (first word after /begin CHARACTERISTIC),
//   LONG_IDENTIFIER (description), PHYS_UNIT, LOWER_LIMIT, UPPER_LIMIT,
//   DEFAULT_VALUE
// ---------------------------------------------------------------------------
export function parseA2L(content: string): ImportResult {
  const warnings: string[] = []
  const parsed: ParsedParam[] = []

  // Match /begin CHARACTERISTIC ... /end CHARACTERISTIC blocks
  // Also handle /begin MEASUREMENT blocks (read-only signals, but useful)
  const blockRe = /\/begin\s+(CHARACTERISTIC|MEASUREMENT)\s+([\s\S]*?)\/end\s+\1/gi
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = blockRe.exec(content)) !== null) {
    const blockBody = blockMatch[2]

    // First token of the block body is the identifier
    const firstLineMatch = blockBody.match(/^\s*(\S+)/)
    if (!firstLineMatch) continue
    const rawName = firstLineMatch[1].replace(/"/g, '').trim()
    if (!rawName) continue

    // Convert UPPER_CASE_IDENTIFIER to a readable name
    const name = rawName
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim()

    const p: ParsedParam = { name }

    // LONG_IDENTIFIER "description text"
    const descMatch = blockBody.match(/LONG_IDENTIFIER\s+"([^"]*)"/)
    if (descMatch) p.description = descMatch[1].trim()

    // PHYS_UNIT "unit"
    const unitMatch = blockBody.match(/PHYS_UNIT\s+"([^"]*)"/)
    if (unitMatch) p.unit = unitMatch[1].trim()

    // DEFAULT_VALUE value  or  DEFAULT_VALUE "value"
    const defValMatch = blockBody.match(/DEFAULT_VALUE\s+"?([^"\s]+)"?/)
    if (defValMatch) p.defaultValue = defValMatch[1].trim()

    // LOWER_LIMIT value
    const lowerMatch = blockBody.match(/LOWER_LIMIT\s+([-\d.eE+]+)/)
    if (lowerMatch) p.minValue = lowerMatch[1].trim()

    // UPPER_LIMIT value
    const upperMatch = blockBody.match(/UPPER_LIMIT\s+([-\d.eE+]+)/)
    if (upperMatch) p.maxValue = upperMatch[1].trim()

    parsed.push(p)
  }

  if (parsed.length === 0) warnings.push('No CHARACTERISTIC or MEASUREMENT blocks found in A2L file')

  return { parsed, warnings }
}

// ---------------------------------------------------------------------------
// Format auto-detector (by file extension or content sniffing)
// ---------------------------------------------------------------------------
export function detectFormat(filename: string, content: string): 'csv' | 'json' | 'c_header' | 'matlab' | 'a2l' | 'sysml_xmi' | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'json') return 'json'
  if (ext === 'h' || ext === 'hpp') return 'c_header'
  if (ext === 'm') return 'matlab'
  if (ext === 'a2l') return 'a2l'
  if (ext === 'xmi') return 'sysml_xmi'
  // .xml could be SysML XMI — sniff content below

  // Sniff content
  const trimmed = content.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('#ifndef') || trimmed.startsWith('#define') || trimmed.includes('#define ')) return 'c_header'
  if (trimmed.startsWith('%')) return 'matlab'
  if (trimmed.includes('/begin PROJECT') || trimmed.includes('/begin CHARACTERISTIC')) return 'a2l'
  if (trimmed.includes('xmlns:uml') || trimmed.includes('xmlns:sysml') || trimmed.includes('xmi:type="uml:') || trimmed.includes('ownedAttribute')) return 'sysml_xmi'

  // CSV heuristic: first line contains commas and looks like headers
  const firstLine = trimmed.split('\n')[0]
  if (firstLine.includes(',') && firstLine.toLowerCase().includes('name')) return 'csv'

  return null
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
export function importParameters(format: string, content: string): ImportResult {
  switch (format) {
    case 'csv':       return parseCSV(content)
    case 'json':      return parseJSON(content)
    case 'c_header':  return parseCHeader(content)
    case 'matlab':    return parseMATLAB(content)
    case 'a2l':       return parseA2L(content)
    case 'sysml_xmi': return parseSysMLXMI(content)
    default:
      return { parsed: [], warnings: [`Unknown import format: ${format}`] }
  }
}
