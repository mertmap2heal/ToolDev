/**
 * Server-side `.xlsx` parser for the requirements Excel import (NX-4-followup,
 * issue #450).
 *
 * Why server-side
 * ---------------
 * `ImportWizard.tsx` previously parsed Excel entirely in the browser via the
 * frontend `xlsx` (SheetJS) package — unauditable (no server record of what
 * was uploaded) and with zero hostile-input guard. This module moves the parse
 * onto the backend with `exceljs` (already a backend dependency), where it is
 * auditable and bounded.
 *
 * Hostile-input safety
 * --------------------
 * An `.xlsx` is a zip of XML. A crafted file can carry an XXE entity, a
 * billion-laughs expansion, or a formula-injection payload, and a huge sheet
 * is a memory/CPU DoS. The mitigations, mirroring the N-2.4 `xmlShared.ts`
 * posture:
 *  - `exceljs` resolves no external XML entities and fetches no external DTDs
 *    — classic XXE file-read / SSRF is structurally impossible.
 *  - The route caps the upload at 8 MB via `multer` (N-2.4 precedent).
 *  - `MAX_DATA_ROWS` (10 000) caps parsed data rows — over-row trips a 422.
 *  - Only the FIRST worksheet is read; extra sheets are ignored.
 *  - A formula cell's value is read as its CACHED result, never evaluated, so
 *    a `=cmd|...` payload is inert text downstream.
 *
 * This module is a pure parser + report assembler. It performs NO database
 * I/O — the controller feeds its output into the existing
 * `bulkImportRequirements` validate-and-transaction substrate.
 */
import ExcelJS from 'exceljs'
import {
  validateRequirementText,
  stripToPlainText,
} from '../../../shared/incoseEars/_compiled/index.js'

/** Max data rows (excludes the header) a single uploaded sheet may carry. */
export const MAX_DATA_ROWS = 10000

/** A parse-level failure — a file that cannot be trusted at all (-> 422). */
export class XlsxParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XlsxParseError'
  }
}

/** A parsed worksheet: the header row plus a row-keyed array of cell strings. */
export interface ParsedXlsx {
  /** The first worksheet's header-row cells, in column order. */
  headers: string[]
  /**
   * One entry per data row. `cells` is a header -> string-value map; `rowNumber`
   * is the 1-based spreadsheet row (header = row 1, first data row = row 2) so a
   * downstream error can name the cell the way the user sees it in Excel.
   */
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>
  /** The worksheet name (informational; the import always uses the first sheet). */
  sheetName: string
}

/**
 * A single per-cell validation finding. `error` rows are skipped on commit;
 * `warning` rows (INCOSE/EARS quality findings) import anyway.
 */
export interface CellError {
  /** 1-based spreadsheet row (header = 1, first data row = 2). */
  rowNumber: number
  /** Excel cell reference, e.g. `C7`, when the finding is column-scoped. */
  sheetCell?: string
  /** The file column header the finding is about. */
  column: string
  /** The mapped requirement field the finding is about. */
  field: string
  /** `error` blocks the row; `warning` is advisory only. */
  severity: 'error' | 'warning'
  /** Engineer-voice reason for the finding. */
  reason: string
}

/**
 * Coerce one `exceljs` cell value to a display string.
 *
 * - A formula cell's value is `{ formula, result }` — take `result` (the
 *   cached value), NEVER re-evaluate the formula. A bare `{ formula }` with no
 *   cached result yields '' (an inert blank), so a `=cmd|...` payload can
 *   never become an executed value or leak its formula text.
 * - A rich-text cell is `{ richText: [...] }` — concatenate the run text.
 * - A hyperlink cell is `{ text, hyperlink }` — take the visible `text`.
 * - A date cell is a `Date` — ISO-format it.
 * - Errors / null / undefined yield ''.
 */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>
    // Formula cell: { formula, result }. Use the cached result only.
    if ('formula' in v || 'sharedFormula' in v) {
      const result = (v as { result?: unknown }).result
      if (result === null || result === undefined) return ''
      return cellToString(result as ExcelJS.CellValue)
    }
    // Rich-text cell.
    if ('richText' in v && Array.isArray(v.richText)) {
      return (v.richText as Array<{ text?: string }>)
        .map((r) => r.text ?? '')
        .join('')
    }
    // Hyperlink cell — take the visible text, drop the target.
    if ('text' in v) return cellToString(v.text as ExcelJS.CellValue)
    // Error cell ({ error: '#REF!' }) — render nothing.
    if ('error' in v) return ''
  }
  return ''
}

/**
 * Parse a requirements `.xlsx` buffer.
 *
 * Reads only the first worksheet. The first non-empty row is the header; every
 * subsequent row is a data row. Cell values are coerced to strings so the
 * downstream validation is format-uniform (an Excel number/date becomes its
 * display string). Throws `XlsxParseError` (-> 422) on a file that cannot be
 * trusted: a non-`.xlsx`, a header-less sheet, or one over `MAX_DATA_ROWS`.
 */
export async function parseRequirementsXlsx(buffer: Buffer): Promise<ParsedXlsx> {
  if (!buffer || buffer.length === 0) {
    throw new XlsxParseError('The uploaded file is empty.')
  }

  const workbook = new ExcelJS.Workbook()
  try {
    // exceljs `xlsx.load` accepts a Buffer; the cast bridges the
    // Buffer<ArrayBufferLike> vs Buffer<ArrayBuffer> typing drift on Node 24.
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  } catch (e) {
    throw new XlsxParseError(
      `That file could not be read as an .xlsx workbook (${(e as Error).message}).`,
    )
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new XlsxParseError('The workbook has no worksheets.')
  }

  // exceljs `actualRowCount` excludes trailing blank rows; subtract the header.
  if (worksheet.actualRowCount - 1 > MAX_DATA_ROWS) {
    throw new XlsxParseError(
      `That spreadsheet has more than ${MAX_DATA_ROWS.toLocaleString()} rows. Split it and import in parts.`,
    )
  }

  // ── Header row — the first row that has any non-blank cell. ───────────────
  let headerRowNumber = 0
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (headerRowNumber !== 0) return
    const anyValue = (row.values as ExcelJS.CellValue[]).some(
      (v) => cellToString(v).trim() !== '',
    )
    if (anyValue) headerRowNumber = rowNumber
  })
  if (headerRowNumber === 0) {
    throw new XlsxParseError(
      'That spreadsheet has no header row. The first row must name the columns.',
    )
  }

  const headerRow = worksheet.getRow(headerRowNumber)
  // Column index (1-based) -> trimmed header label. A blank header cell is
  // skipped so its column never produces a mapping entry.
  const headerByCol = new Map<number, string>()
  const headers: string[] = []
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const label = cellToString(cell.value).trim()
    if (label) {
      headerByCol.set(colNumber, label)
      headers.push(label)
    }
  })
  if (headers.length === 0) {
    throw new XlsxParseError(
      'That spreadsheet has no column headers. Add a header row and re-upload.',
    )
  }

  // ── Data rows — every row after the header. ───────────────────────────────
  const rows: ParsedXlsx['rows'] = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return
    const cells: Record<string, string> = {}
    let hasAnyValue = false
    for (const [colNumber, header] of headerByCol) {
      const value = cellToString(row.getCell(colNumber).value).trim()
      cells[header] = value
      if (value !== '') hasAnyValue = true
    }
    // Skip a wholly-blank data row — it is not a requirement.
    if (hasAnyValue) rows.push({ rowNumber, cells })
  })

  return { headers, rows, sheetName: worksheet.name }
}

/**
 * Map a single bulk-import substrate error string to a `CellError`. The
 * substrate's `validateCreateRow` / `validateUpdateRow` return flat
 * `string[]`s; this routes each message to the column/field it concerns so the
 * frontend can render it per-cell.
 *
 * `headerByField` is the import's field -> file-header map (the inverse of the
 * user's column mapping) so a "Priority" finding names the actual spreadsheet
 * column. A finding with no obvious field falls back to the row itself.
 */
export function substrateErrorToCellError(
  message: string,
  rowNumber: number,
  headerByField: Map<string, string>,
): CellError {
  const lower = message.toLowerCase()
  let field = ''
  if (lower.includes('title') || lower.includes('description')) {
    field = lower.includes('description') ? 'description' : 'title'
  } else if (lower.includes('parent')) {
    field = 'parentId'
  } else if (lower.includes('requirement id')) {
    field = 'requirementId'
  } else if (lower.includes('circular')) {
    field = 'parentId'
  }
  return {
    rowNumber,
    column: field ? headerByField.get(field) ?? field : '(row)',
    field: field || '(row)',
    severity: 'error',
    reason: message,
  }
}

/**
 * Run the INCOSE/EARS quality validator on one row's description and return
 * any finding as a `warning`-severity `CellError`.
 *
 * Per the issue #450 Architecture comment and the N-2.3 override-fatigue
 * ruling: a bulk import surfaces quality findings as ADVISORY warnings only —
 * it never blocks the import and never demands a per-row override reason. The
 * user can act on the warnings later via the editor's N-2.3 gate.
 */
export function qualityWarningsForRow(
  description: string | null | undefined,
  rowNumber: number,
  descriptionColumn: string,
): CellError[] {
  const plain = stripToPlainText(description)
  if (!plain.trim()) return []
  const report = validateRequirementText(plain)
  return report.findings.map((finding) => ({
    rowNumber,
    column: descriptionColumn,
    field: 'description',
    // Every INCOSE/EARS finding is advisory on the import path — even an
    // `error`-severity finding is folded in as a `warning` here.
    severity: 'warning' as const,
    reason: finding.message,
  }))
}
