/**
 * CSV / spreadsheet export helpers hardened against formula injection
 * (issue #269, CWE-1236).
 *
 * Any cell whose first character is `=`, `+`, `-`, `@`, TAB, or CR is
 * interpreted as a formula by Excel / LibreOffice / Google Sheets when
 * the file is opened. A project member who can set any free-text field
 * (requirement title, CR title, test-case objective, etc.) could ship
 * `=HYPERLINK(...)` or `=cmd|' /C calc'!A0` into an auditor's machine.
 *
 * `csvSafeValue` prefixes the trigger characters with a single quote so
 * the spreadsheet treats the cell as plain text; `csvSafeField` adds the
 * standard RFC-4180 quoting for delimiter / quote / newline chars.
 */

const FORMULA_PREFIXES = /^[=+\-@\t\r]/

/** Neutralise formula triggers by prefixing with a single apostrophe. */
export function csvSafeValue(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return FORMULA_PREFIXES.test(s) ? `'${s}` : s
}

/** Full CSV-field serialisation: neutralise formula triggers AND quote per RFC 4180. */
export function csvSafeField(v: unknown): string {
  const neutralised = csvSafeValue(v)
  return /[",\n\r]/.test(neutralised)
    ? `"${neutralised.replace(/"/g, '""')}"`
    : neutralised
}

/**
 * Deep-map an object (or array) and neutralise every string value. Used
 * before passing rows to `Papa.unparse` or `XLSX.utils.json_to_sheet`
 * where we cannot control the serialiser's quoting but must still
 * prevent formula triggers.
 */
export function csvSafeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const v = row[key]
    if (typeof v === 'string') {
      out[key] = csvSafeValue(v)
    } else if (v == null || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v
    } else if (Array.isArray(v)) {
      out[key] = v.map((item) => (typeof item === 'string' ? csvSafeValue(item) : item))
    } else {
      // Fallback: stringify complex objects and neutralise.
      out[key] = csvSafeValue(JSON.stringify(v))
    }
  }
  return out as T
}

export function csvSafeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(csvSafeRow)
}
