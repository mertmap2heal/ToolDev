import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import type { DefinitionEntry } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import {
  addCoverPage,
  addHeaderFooterToAllPages,
  getAuthorityTableStyles,
  getPdfFont,
} from './exportPdfLayout'
import type { ExportDocumentStyle } from './requirementExportTemplates'
import { DEFAULT_AUTHORITY_STYLE } from './requirementExportTemplates'
import { buildGlossaryAbbreviationsDocx, type GlossaryAbbreviationDocxRow } from './exportDocx'

export type DefinitionExportScope = 'glossary' | 'abbreviation' | 'both'

export type DefinitionExportFormat = 'csv' | 'excel' | 'pdf' | 'word'

export interface ExportDefinitionEntriesInput {
  entries: DefinitionEntry[]
  scope: DefinitionExportScope
  format: DefinitionExportFormat
  includeDefinitions: boolean
  sortAlphabetically: boolean
  projectId: string
  projectName?: string
}

export interface PreparedDefinitionExportRows {
  glossary: GlossaryAbbreviationDocxRow[]
  abbreviations: GlossaryAbbreviationDocxRow[]
}

let autoTableModule: unknown = null

async function loadAutoTable(): Promise<(doc: jsPDF, options: Record<string, unknown>) => void> {
  if (!autoTableModule) {
    autoTableModule = await import('jspdf-autotable')
  }
  const m = autoTableModule as { default?: unknown }
  const fn = (m.default ?? autoTableModule) as (doc: jsPDF, options: Record<string, unknown>) => void
  return fn
}

function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>/g, '').trim()
}

function formatUpdated(iso: string): string {
  try {
    return format(new Date(iso), 'yyyy-MM-dd')
  } catch {
    return iso || ''
  }
}

/** Normalize entries into export rows (full project lists; not search-filtered). */
export function prepareDefinitionExportRows(
  entries: DefinitionEntry[],
  options: Pick<ExportDefinitionEntriesInput, 'scope' | 'sortAlphabetically' | 'includeDefinitions'>
): PreparedDefinitionExportRows {
  const glossaryAll = entries.filter((e) => e.type === 'glossary')
  const abbrevAll = entries.filter((e) => e.type === 'abbreviation')

  const sort = (list: DefinitionEntry[]) =>
    options.sortAlphabetically ? [...list].sort((a, b) => a.term.localeCompare(b.term)) : [...list]

  const toRow = (e: DefinitionEntry): GlossaryAbbreviationDocxRow => ({
    term: e.term,
    definition: options.includeDefinitions ? stripHtml(e.definition || '') : '',
    notes: stripHtml(e.notes || '') || '',
    source: (e.source || '').trim(),
    updated: formatUpdated(e.updatedAt),
  })

  let glossary: DefinitionEntry[] = []
  let abbreviations: DefinitionEntry[] = []

  if (options.scope === 'glossary') {
    glossary = sort(glossaryAll)
  } else if (options.scope === 'abbreviation') {
    abbreviations = sort(abbrevAll)
  } else {
    glossary = sort(glossaryAll)
    abbreviations = sort(abbrevAll)
  }

  return {
    glossary: glossary.map(toRow),
    abbreviations: abbreviations.map(toRow),
  }
}

function escapeCsvCell(value: string): string {
  let v = value.replace(/"/g, '""')
  if (v.includes(',') || v.includes('\n') || v.includes('"')) {
    return `"${v}"`
  }
  return v
}

function tableHeaders(includeDefinitions: boolean): string[] {
  return includeDefinitions
    ? ['Term', 'Definition', 'Notes', 'Source', 'Updated']
    : ['Term', 'Notes', 'Source', 'Updated']
}

function rowToStrings(r: GlossaryAbbreviationDocxRow, includeDefinitions: boolean): string[] {
  return includeDefinitions
    ? [r.term, r.definition, r.notes, r.source, r.updated]
    : [r.term, r.notes, r.source, r.updated]
}

function buildFilename(
  projectId: string,
  scope: DefinitionExportScope,
  ext: string
): string {
  const scopeSuffix =
    scope === 'glossary' ? 'glossary' : scope === 'abbreviation' ? 'abbreviations' : 'glossary_and_abbreviations'
  const ts = format(new Date(), 'yyyyMMdd-HHmmss')
  return `glossary_export_${projectId.slice(0, 8)}_${scopeSuffix}_${ts}.${ext}`
}

function downloadString(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function countExportRows(prepared: PreparedDefinitionExportRows): number {
  return prepared.glossary.length + prepared.abbreviations.length
}

/** Cover / report branding (not the generic requirement-export default title). */
export const GLOSSARY_EXPORT_COVER = {
  title: 'Glossary & Abbreviations',
  subtitle:
    'Controlled project register of defined terms, definitions, abbreviations, and expansion text.',
} as const

function definitionExportScopeLabel(scope: DefinitionExportScope): string {
  switch (scope) {
    case 'glossary':
      return 'Glossary entries only'
    case 'abbreviation':
      return 'Abbreviations only'
    case 'both':
      return 'Glossary and abbreviations'
    default:
      return String(scope)
  }
}

function glossaryExportPdfStyle(input: { projectId: string; projectName?: string }): ExportDocumentStyle {
  const shortProject =
    input.projectName != null && input.projectName.trim() !== ''
      ? input.projectName.trim()
      : `Project ${input.projectId.slice(0, 8)}…`
  return {
    ...DEFAULT_AUTHORITY_STYLE,
    coverTitle: GLOSSARY_EXPORT_COVER.title,
    headerLeft: `Glossary & abbreviations · ${shortProject}`,
    footerCenter: 'Glossary & abbreviations · {date}',
    footerRight: '',
  }
}

export async function exportDefinitionEntries(input: ExportDefinitionEntriesInput): Promise<void> {
  const prepared = prepareDefinitionExportRows(input.entries, {
    scope: input.scope,
    sortAlphabetically: input.sortAlphabetically,
    includeDefinitions: input.includeDefinitions,
  })

  const { glossary, abbreviations } = prepared
  const documentTitle = input.projectName
    ? `${input.projectName} — Glossary & Abbreviations`
    : 'Glossary & Abbreviations Export'
  const pdfWordHeaderTitle = `${GLOSSARY_EXPORT_COVER.title} · ${input.projectName?.trim() || input.projectId.slice(0, 8)}`

  switch (input.format) {
    case 'csv': {
      const lines: string[] = []
      const nowIso = new Date().toISOString()
      lines.push(`Profile,GlossaryAbbreviationsArchive`)
      lines.push(`ProjectId,${escapeCsvCell(input.projectId)}`)
      if (input.projectName) lines.push(`ProjectName,${escapeCsvCell(input.projectName)}`)
      lines.push(`ExportedAtUtc,${nowIso}`)
      lines.push(`Scope,${input.scope}`)
      lines.push(`GlossaryCount,${glossary.length}`)
      lines.push(`AbbreviationsCount,${abbreviations.length}`)
      lines.push('')

      const emitSection = (title: string, rows: GlossaryAbbreviationDocxRow[]) => {
        if (rows.length === 0) return
        lines.push(`# ${title}`)
        const headers = tableHeaders(input.includeDefinitions)
        lines.push(headers.map(escapeCsvCell).join(','))
        for (const r of rows) {
          lines.push(rowToStrings(r, input.includeDefinitions).map(escapeCsvCell).join(','))
        }
        lines.push('')
      }

      emitSection('Glossary', glossary)
      emitSection('Abbreviations', abbreviations)

      downloadString(lines.join('\n'), buildFilename(input.projectId, input.scope, 'csv'), 'text/csv;charset=utf-8')
      break
    }
    case 'excel': {
      const wb = XLSX.utils.book_new()
      const headers = tableHeaders(input.includeDefinitions)
      const sheetFromRows = (rows: GlossaryAbbreviationDocxRow[]) => {
        const data = rows.map((r) => {
          const o: Record<string, string> = {}
          const vals = rowToStrings(r, input.includeDefinitions)
          headers.forEach((h, i) => {
            o[h] = vals[i] ?? ''
          })
          return o
        })
        return XLSX.utils.json_to_sheet(data, { header: headers })
      }

      if (glossary.length > 0) {
        const ws = sheetFromRows(glossary)
        const maxWidth = 50
        ws['!cols'] = headers.map((header) => {
          const maxLen = Math.max(
            header.length,
            ...glossary.map((row) => {
              const vals = rowToStrings(row, input.includeDefinitions)
              const i = headers.indexOf(header)
              return (vals[i] ?? '').length
            })
          )
          return { wch: Math.min(maxLen + 2, maxWidth) }
        })
        XLSX.utils.book_append_sheet(wb, ws, 'Glossary')
      }
      if (abbreviations.length > 0) {
        const ws = sheetFromRows(abbreviations)
        const maxWidth = 50
        ws['!cols'] = headers.map((header) => {
          const maxLen = Math.max(
            header.length,
            ...abbreviations.map((row) => {
              const vals = rowToStrings(row, input.includeDefinitions)
              const i = headers.indexOf(header)
              return (vals[i] ?? '').length
            })
          )
          return { wch: Math.min(maxLen + 2, maxWidth) }
        })
        XLSX.utils.book_append_sheet(wb, ws, 'Abbreviations')
      }

      XLSX.writeFile(wb, buildFilename(input.projectId, input.scope, 'xlsx'))
      break
    }
    case 'pdf': {
      const autoTable = await loadAutoTable()
      const doc = new jsPDF({ orientation: 'portrait' })
      const style = glossaryExportPdfStyle(input)
      const authorityStyles = getAuthorityTableStyles(style)
      const marginMm = style.marginMm ?? 25
      const marginPt = marginMm * 2.834645669
      const font = getPdfFont(style)
      const sizeH1 = style.fontSizeHeading1 ?? 14
      const sizeH2 = style.fontSizeHeading2 ?? 12
      const sizeBody = style.fontSizeBody ?? 11

      addCoverPage(
        doc,
        {
          documentTitle: GLOSSARY_EXPORT_COVER.title,
          subtitle: GLOSSARY_EXPORT_COVER.subtitle,
          projectName: input.projectName,
          showDate: true,
        },
        style
      )
      doc.addPage()

      let y = marginPt + 10
      doc.setFontSize(sizeH2)
      doc.setFont(font, 'bold')
      doc.text('Document summary', marginPt, y)
      y += 7
      doc.setFontSize(sizeBody)
      doc.setFont(font, 'normal')
      const summaryLines = [
        `Export scope: ${definitionExportScopeLabel(input.scope)}`,
        `Glossary entries in this file: ${glossary.length}`,
        `Abbreviation entries in this file: ${abbreviations.length}`,
        `Definitions column: ${input.includeDefinitions ? 'Included (HTML removed)' : 'Omitted'}`,
        `Sort order: ${input.sortAlphabetically ? 'A–Z by term' : 'As stored in project'}`,
      ]
      for (const line of summaryLines) {
        doc.text(line, marginPt, y)
        y += 5.4
      }
      y += 10

      let sectionNum = 0
      const addTableSection = (title: string, rows: GlossaryAbbreviationDocxRow[]) => {
        if (rows.length === 0) return
        sectionNum += 1
        if (sectionNum > 1) {
          doc.addPage()
          y = marginPt + 14
        }
        doc.setFontSize(sizeH1)
        doc.setFont(font, 'bold')
        doc.text(`${sectionNum}. ${title}`, marginPt, y)
        y += 9
        const heads = [tableHeaders(input.includeDefinitions)]
        const body = rows.map((r) => rowToStrings(r, input.includeDefinitions))
        autoTable(doc, {
          head: heads,
          body,
          startY: y,
          margin: { left: marginPt, right: marginPt },
          styles: {
            fontSize: authorityStyles.fontSize,
            cellPadding: 3,
          },
          headStyles: { ...authorityStyles.headStyles, halign: 'left' },
          alternateRowStyles: authorityStyles.alternateRowStyles,
          tableLineColor: authorityStyles.tableLineColor,
          tableLineWidth: authorityStyles.tableLineWidth,
          columnStyles: input.includeDefinitions ? { 1: { cellWidth: 'wrap' } } : {},
        })
        const last = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable
        y = (last?.finalY ?? y) + 14
      }

      addTableSection('Glossary', glossary)
      addTableSection('Abbreviations', abbreviations)

      addHeaderFooterToAllPages(doc, pdfWordHeaderTitle, style)
      doc.save(buildFilename(input.projectId, input.scope, 'pdf'))
      break
    }
    case 'word': {
      const blob = await buildGlossaryAbbreviationsDocx({
        documentTitle,
        coverTitle: GLOSSARY_EXPORT_COVER.title,
        coverSubtitle: GLOSSARY_EXPORT_COVER.subtitle,
        runningHeader: pdfWordHeaderTitle,
        scopeLabel: definitionExportScopeLabel(input.scope),
        sortLabel: input.sortAlphabetically ? 'Alphabetical (A–Z) by term' : 'As stored in project',
        projectId: input.projectId,
        projectName: input.projectName,
        glossaryRows: glossary.length > 0 ? glossary : undefined,
        abbreviationRows: abbreviations.length > 0 ? abbreviations : undefined,
        includeDefinitions: input.includeDefinitions,
        documentStyle: glossaryExportPdfStyle(input),
      })
      downloadBlob(blob, buildFilename(input.projectId, input.scope, 'docx'))
      break
    }
    default:
      break
  }
}
