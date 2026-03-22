/**
 * Authority-grade PDF layout: cover page, headers/footers, section headings, table styling.
 * Used by ExportBuilder when documentStyle or sections are set.
 */
import type { jsPDF } from 'jspdf'
import type { ExportDocumentStyle, ExportSection } from './requirementExportTemplates'
import { DEFAULT_AUTHORITY_STYLE } from './requirementExportTemplates'
import { format } from 'date-fns'
import type { TraceabilityMatrixModel } from 'shared/types/traceabilityMatrix.types'

function parseHex(hex: string): [number, number, number] {
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return [r, g, b]
}

const DEFAULT_HEADER_BG = [55, 65, 81] as [number, number, number]
const DEFAULT_HEADER_FG = [255, 255, 255] as [number, number, number]
const DEFAULT_BORDER = [229, 231, 235] as [number, number, number]
const DEFAULT_ALT_ROW = [249, 250, 251] as [number, number, number]

/** jsPDF built-in font names */
export type PdfFontName = 'helvetica' | 'times' | 'courier'

/** Map documentStyle.fontFamily to jsPDF built-in font (helvetica, times, courier). */
export function getPdfFont(style?: ExportDocumentStyle | null): PdfFontName {
  const name = (style ?? DEFAULT_AUTHORITY_STYLE).fontFamily?.toLowerCase?.() ?? ''
  if (name.includes('times') || name === 'serif') return 'times'
  if (name.includes('courier') || name === 'monospace') return 'courier'
  return 'helvetica'
}

export function getAuthorityTableStyles(style?: ExportDocumentStyle | null): {
  headStyles: { fillColor: [number, number, number]; textColor: [number, number, number]; fontStyle: string }
  alternateRowStyles: { fillColor: [number, number, number] }
  margin: number
  fontSize: number
  tableLineColor: [number, number, number]
  tableLineWidth: number
} {
  const s = style ?? DEFAULT_AUTHORITY_STYLE
  const margin = s.marginMm ?? DEFAULT_AUTHORITY_STYLE.marginMm ?? 25
  const fontSize = s.fontSizeBody ?? DEFAULT_AUTHORITY_STYLE.fontSizeBody ?? 11
  return {
    headStyles: {
      fillColor: s.tableHeaderBg ? parseHex(s.tableHeaderBg) : DEFAULT_HEADER_BG,
      textColor: s.tableHeaderFg ? parseHex(s.tableHeaderFg) : DEFAULT_HEADER_FG,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: s.tableAlternateRowBg ? parseHex(s.tableAlternateRowBg) : DEFAULT_ALT_ROW,
    },
    margin,
    fontSize: fontSize - 1,
    tableLineColor: s.tableBorderColor ? parseHex(s.tableBorderColor) : DEFAULT_BORDER,
    tableLineWidth: 0.1,
  }
}

export interface CoverPageOptions {
  documentTitle: string
  /** Optional subtitle below the main title (e.g. document type line). */
  subtitle?: string
  projectName?: string
  showDate?: boolean
  showVersion?: boolean
  versionLabel?: string
  classification?: string
  preparerOrOrg?: string
}

const MM_TO_PT = 2.834645669

export function addCoverPage(
  doc: jsPDF,
  opts: CoverPageOptions,
  style?: ExportDocumentStyle | null
): void {
  const s = style ?? DEFAULT_AUTHORITY_STYLE
  const margin = (s.marginMm ?? 25) * MM_TO_PT
  const d = doc as unknown as { getPageWidth(): number; getPageHeight(): number }
  const pageW = d.getPageWidth?.() ?? 210
  const pageH = d.getPageHeight?.() ?? 297
  const centerX = pageW / 2
  let y = pageH * 0.35

  const fontSizeH1 = s.fontSizeHeading1 ?? 14
  const fontSizeBody = s.fontSizeBody ?? 11
  const font = getPdfFont(style)

  doc.setFontSize(fontSizeH1 + 4)
  doc.setFont(font, 'bold')
  doc.text(opts.documentTitle, centerX, y, { align: 'center' })
  y += 10
  if (opts.subtitle) {
    doc.setFontSize(fontSizeBody)
    doc.setFont(font, 'normal')
    const sub = opts.subtitle
    const maxW = pageW - 2 * margin
    const lines = doc.splitTextToSize(sub, maxW)
    doc.text(lines, centerX, y, { align: 'center' })
    y += Math.max(6, lines.length * (fontSizeBody * 0.45))
  }
  const lineColor = s.tableBorderColor ? parseHex(s.tableBorderColor) : DEFAULT_BORDER
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2])
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)
  y += 12

  if (opts.projectName) {
    doc.setFontSize(fontSizeBody + 1)
    doc.setFont(font, 'normal')
    doc.text(opts.projectName, centerX, y, { align: 'center' })
    y += 8
  }
  if (opts.showDate !== false) {
    doc.setFontSize(fontSizeBody)
    doc.text(`Date: ${format(new Date(), 'yyyy-MM-dd')}`, centerX, y, { align: 'center' })
    y += 6
  }
  if (opts.showVersion && opts.versionLabel) {
    doc.text(`Version: ${opts.versionLabel}`, centerX, y, { align: 'center' })
    y += 6
  }
  if (opts.classification) {
    y += 6
    doc.setFont(font, 'bold')
    doc.text(opts.classification, centerX, y, { align: 'center' })
    doc.setFont(font, 'normal')
    y += 8
  }
  if (opts.preparerOrOrg) {
    doc.setFontSize(fontSizeBody - 1)
    doc.text(opts.preparerOrOrg, centerX, pageH - margin - 10, { align: 'center' })
  }
}

function substitutePlaceholders(
  text: string,
  pageNum: number,
  totalPages: number,
  documentTitle: string
): string {
  return text
    .replace(/\{page\}/g, String(pageNum))
    .replace(/\{pageOfN\}/g, `${pageNum} of ${totalPages}`)
    .replace(/\{date\}/g, format(new Date(), 'yyyy-MM-dd'))
    .replace(/\{title\}/g, documentTitle)
}

export function addHeaderFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  documentTitle: string,
  style?: ExportDocumentStyle | null
): void {
  const s = style ?? DEFAULT_AUTHORITY_STYLE
  const margin = (s.marginMm ?? 25) * MM_TO_PT
  const d = doc as unknown as { getPageWidth(): number; getPageHeight(): number }
  const pageW = d.getPageWidth?.() ?? 210
  const pageH = d.getPageHeight?.() ?? 297
  const fontSize = (s.fontSizeBody ?? 11) - 1
  const formatType = s.pageNumberFormat ?? 'pageOfN'
  const font = getPdfFont(style)

  doc.setFontSize(fontSize)
  doc.setFont(font, 'normal')

  const headerL = s.headerLeft ? substitutePlaceholders(s.headerLeft, pageNum, totalPages, documentTitle) : ''
  const headerC = s.headerCenter ? substitutePlaceholders(s.headerCenter, pageNum, totalPages, documentTitle) : ''
  const headerR = s.headerRight ? substitutePlaceholders(s.headerRight, pageNum, totalPages, documentTitle) : ''
  const footerL = s.footerLeft ? substitutePlaceholders(s.footerLeft, pageNum, totalPages, documentTitle) : ''
  const footerC = s.footerCenter
    ? substitutePlaceholders(s.footerCenter, pageNum, totalPages, documentTitle)
    : formatType === 'pageOfN'
      ? `Page ${pageNum} of ${totalPages}`
      : formatType === 'page'
        ? String(pageNum)
        : ''
  const footerR = s.footerRight ? substitutePlaceholders(s.footerRight, pageNum, totalPages, documentTitle) : ''

  const yHeader = margin
  const yFooter = pageH - margin

  if (headerL) doc.text(headerL, margin, yHeader)
  if (headerC) doc.text(headerC, pageW / 2, yHeader, { align: 'center' })
  if (headerR) doc.text(headerR, pageW - margin, yHeader, { align: 'right' })
  if (footerL) doc.text(footerL, margin, yFooter)
  if (footerC) doc.text(footerC, pageW / 2, yFooter, { align: 'center' })
  if (footerR) doc.text(footerR, pageW - margin, yFooter, { align: 'right' })
}

/** Call after all content is added to document. Adds header/footer to every page. */
export function addHeaderFooterToAllPages(
  doc: jsPDF,
  documentTitle: string,
  style?: ExportDocumentStyle | null
): void {
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    addHeaderFooter(doc, i, total, documentTitle, style)
  }
}

/** Returns startY for content after the heading (in pt). Section number is 1-based. */
export function addSectionHeading(
  doc: jsPDF,
  sectionNumber: number,
  title: string,
  style?: ExportDocumentStyle | null,
  startNewPage?: boolean
): number {
  const s = style ?? DEFAULT_AUTHORITY_STYLE
  const marginMm = s.marginMm ?? 25
  const margin = marginMm * MM_TO_PT
  const fontSizeH1 = s.fontSizeHeading1 ?? 14

  if (startNewPage) doc.addPage()
  doc.setFontSize(fontSizeH1)
  doc.setFont(getPdfFont(style), 'bold')
  const headingText = `${sectionNumber}. ${title}`
  doc.text(headingText, margin, margin + 6)
  return margin + 14
}

export interface PlaceholderSectionOptions {
  placeholderStyle?: 'full_page' | 'heading_with_space'
  blankPageCount?: number
  startOnNewPage?: boolean
}

/**
 * Renders a placeholder section: full blank page(s) with optional heading, or heading with blank space below.
 * Section number is 1-based.
 */
export function addPlaceholderSection(
  doc: jsPDF,
  sectionNumber: number,
  title: string,
  style?: ExportDocumentStyle | null,
  opts?: PlaceholderSectionOptions
): void {
  const s = style ?? DEFAULT_AUTHORITY_STYLE
  const marginMm = s.marginMm ?? 25
  const margin = marginMm * MM_TO_PT
  const fontSizeH1 = s.fontSizeHeading1 ?? 14
  const fontSizeBody = s.fontSizeBody ?? 11
  const font = getPdfFont(style)
  const displayTitle = title || 'Reserved'
  const hintColor = [156, 163, 175] as [number, number, number] // gray-400

  const plStyle = opts?.placeholderStyle ?? 'full_page'
  const blankPageCount = Math.min(5, Math.max(1, opts?.blankPageCount ?? 1))

  if (plStyle === 'heading_with_space') {
    addSectionHeading(doc, sectionNumber, displayTitle, style, opts?.startOnNewPage !== false)
    return
  }

  // full_page: new page(s), optional section number + title at top, optional hint
  doc.addPage()
  doc.setFontSize(fontSizeH1)
  doc.setFont(font, 'bold')
  doc.text(`${sectionNumber}. ${displayTitle}`, margin, margin + 6)
  doc.setFontSize(fontSizeBody - 1)
  doc.setFont(font, 'normal')
  doc.setTextColor(hintColor[0], hintColor[1], hintColor[2])
  doc.text('Reserved for manual completion.', margin, margin + 14)
  doc.setTextColor(0, 0, 0)

  for (let i = 1; i < blankPageCount; i++) {
    doc.addPage()
    doc.setFontSize(fontSizeBody - 1)
    doc.setFont(font, 'normal')
    doc.setTextColor(hintColor[0], hintColor[1], hintColor[2])
    doc.text('Reserved for manual completion.', margin, margin + 6)
    doc.setTextColor(0, 0, 0)
  }
}

export interface TraceabilityMatrixPdfOptions {
  /** If true, start section on a new page (default true). */
  startOnNewPage?: boolean
  /** Max IDs rendered per cell before truncation. Default 8. */
  maxIdsPerCell?: number
}

/**
 * Adds a traceability matrix section using authority-grade styling.
 *
 * Note: caller provides `autoTable` (jspdf-autotable) to avoid bundling issues.
 */
export function addTraceabilityMatrixSection(
  doc: jsPDF,
  autoTable: any,
  sectionNumber: number,
  title: string,
  matrix: TraceabilityMatrixModel,
  style?: ExportDocumentStyle | null,
  opts?: TraceabilityMatrixPdfOptions
): void {
  const s = style ?? DEFAULT_AUTHORITY_STYLE
  const authorityStyles = getAuthorityTableStyles(s)
  const startY = addSectionHeading(doc, sectionNumber, title, s, opts?.startOnNewPage !== false)

  const maxIds = Math.max(1, opts?.maxIdsPerCell ?? 8)
  const head = [''].concat(matrix.cols.map((c) => c.label || c.key))
  const body = matrix.rows.map((r) => {
    const rowCells: string[] = [r.key]
    for (const c of matrix.cols) {
      const entries = matrix.cells[r.id]?.[c.id] ?? []
      if (entries.length === 0) {
        rowCells.push('')
      } else {
        const formatted = entries.map((e) => {
          if (typeof e === 'string') return e
          return `${e.arrow} ${e.linkType}${e.isSuspect ? ' (?)' : ''}`
        })
        if (formatted.length <= maxIds) rowCells.push(formatted.join('\n'))
        else rowCells.push(`${formatted.slice(0, maxIds).join('\n')}\n+${formatted.length - maxIds} more`)
      }
    }
    return rowCells
  })

  autoTable(doc, {
    head: [head],
    body,
    startY,
    styles: { fontSize: authorityStyles.fontSize - 2, cellPadding: 1.5 },
    headStyles: authorityStyles.headStyles,
    alternateRowStyles: authorityStyles.alternateRowStyles,
    tableLineColor: authorityStyles.tableLineColor,
    tableLineWidth: authorityStyles.tableLineWidth,
  })
}
