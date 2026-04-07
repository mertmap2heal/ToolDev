/**
 * CSV generator utilities for e2e import tests.
 * Generates in-memory CSV strings so tests don't rely on files on disk.
 */

export interface CsvParam {
  name: string
  description?: string
  data_type?: string
  value?: string
  unit?: string
  tolerance?: string
  min?: string
  max?: string
  tags?: string
  formula?: string
  status?: string
}

const HEADER = 'name,description,data_type,value,unit,tolerance,min,max,tags,formula,status'

function escapeCsvField(v: string): string {
  // Quote if contains comma, newline, or double-quote
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function rowToCsv(p: CsvParam): string {
  const fields = [
    p.name,
    p.description ?? '',
    p.data_type ?? 'float',
    p.value ?? '',
    p.unit ?? '',
    p.tolerance ?? '',
    p.min ?? '',
    p.max ?? '',
    p.tags ?? '',
    p.formula ?? '',
    p.status ?? 'draft',
  ]
  return fields.map(escapeCsvField).join(',')
}

/** Build a complete CSV string from an array of parameter definitions. */
export function buildCsv(params: CsvParam[]): string {
  return [HEADER, ...params.map(rowToCsv)].join('\n') + '\n'
}

/** Generate a CSV with N unique parameters using a timestamp-based name prefix. */
export function generateUniqueCsv(
  count: number,
  prefix = 'e2e_import',
  overrides: Partial<CsvParam> = {}
): string {
  const ts = Date.now()
  const params: CsvParam[] = Array.from({ length: count }, (_, i) => ({
    name: `${prefix}_${ts}_${i}`,
    description: `Auto-generated e2e test parameter ${i}`,
    data_type: 'float',
    value: String((Math.random() * 100).toFixed(3)),
    unit: ['m', 'kg', 'V', 'A', 'Hz', 'N'][i % 6],
    status: 'draft',
    ...overrides,
  }))
  return buildCsv(params)
}

/** Generate a CSV where some rows will overwrite existing named parameters. */
export function generateOverwriteCsv(existingNames: string[], newValue = '999.0'): string {
  const params: CsvParam[] = existingNames.map(name => ({
    name,
    description: `Updated by e2e overwrite test`,
    data_type: 'float',
    value: newValue,
    status: 'draft',
  }))
  return buildCsv(params)
}

/** Generate a CSV with formula-driven parameters that reference given param names. */
export function generateFormulaCsv(baseParams: CsvParam[], derivedDefs: { name: string; formula: string }[]): string {
  const derived: CsvParam[] = derivedDefs.map(d => ({
    name: d.name,
    description: `Derived by formula: ${d.formula}`,
    data_type: 'float',
    formula: d.formula,
    status: 'draft',
  }))
  return buildCsv([...baseParams, ...derived])
}

/**
 * Write a CSV string to a temporary file path that Playwright can upload.
 * Usage in a test:
 *   const csvPath = writeTempCsv(csv, 'test_import.csv')
 *   await page.locator('input[type="file"]').setInputFiles(csvPath)
 *
 * Note: This writes to the OS temp dir. The file is not auto-cleaned up.
 */
export function writeTempCsvPath(csv: string, filename = 'e2e_import.csv'): string {
  const os = require('os')
  const path = require('path')
  const fs = require('fs')
  const tmpPath = path.join(os.tmpdir(), filename)
  fs.writeFileSync(tmpPath, csv, 'utf8')
  return tmpPath
}
