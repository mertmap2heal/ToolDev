// N-2.2 (#425) — the PSAC PDF renderer.
//
// Consumes ONLY the renderer-agnostic PsacRenderSection[] built by psacContent,
// so the PDF carries the same content and the same 14-section structure as the
// DOCX. A section with an `empty` block still renders its heading + the
// engineer-voice empty line.
//
// pdfkit pattern follows certificationExport.service.ts (pdfBufferFromDoc).
// @ts-ignore — pdfkit ships no first-class types
import PDFDocument from 'pdfkit'
import type { ComposedAuditPackage, PackageManifest } from '../types'
import { buildPsacRenderSections } from './psacContent'
import type { PsacBlock, PsacRenderSection } from './psacContent'

const MARGIN = 50
const PAGE_BOTTOM = 770
const CONTENT_WIDTH = 495 // A4 width 595 - 2*MARGIN

function pdfBufferFromDoc(doc: PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

/** Ensure `needed` vertical space; add a page if it would overflow. */
function ensureSpace(doc: PDFDocument, needed: number): void {
  if (doc.y + needed > PAGE_BOTTOM) doc.addPage()
}

function writeHeading(doc: PDFDocument, text: string, level: 1 | 2): void {
  ensureSpace(doc, 40)
  doc.moveDown(0.6)
  doc
    .font('Helvetica-Bold')
    .fontSize(level === 1 ? 13 : 11)
    .text(text, MARGIN, doc.y, { width: CONTENT_WIDTH })
  doc.moveDown(0.3)
}

function writeBody(doc: PDFDocument, text: string, opts: { italic?: boolean } = {}): void {
  ensureSpace(doc, 28)
  doc
    .font(opts.italic ? 'Helvetica-Oblique' : 'Helvetica')
    .fontSize(9)
    .text(text, MARGIN, doc.y, { width: CONTENT_WIDTH })
  doc.moveDown(0.4)
}

/** A simple text table — equal-width columns, wrapped cells, page breaks per row. */
function writeTable(doc: PDFDocument, headers: string[], rows: string[][]): void {
  const colWidth = CONTENT_WIDTH / headers.length
  const writeRow = (cells: string[], bold: boolean) => {
    // Measure the tallest cell so the row does not overlap the next.
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
    const heights = cells.map((cell) =>
      // heightOfString exists at runtime; pdfkit ships no type for it.
      (
        doc as unknown as {
          heightOfString(s: string, o: { width: number }): number
        }
      ).heightOfString(cell || '—', { width: colWidth - 6 }),
    )
    const rowHeight = Math.max(14, ...heights) + 4
    ensureSpace(doc, rowHeight)
    const top = doc.y
    cells.forEach((cell, i) => {
      doc.text(cell || '—', MARGIN + i * colWidth + 2, top, {
        width: colWidth - 6,
      })
    })
    doc.y = top + rowHeight
  }
  writeRow(headers, true)
  for (const row of rows) writeRow(row, false)
  doc.moveDown(0.3)
}

function renderBlock(doc: PDFDocument, block: PsacBlock): void {
  switch (block.type) {
    case 'paragraph':
      writeBody(doc, block.text)
      break
    case 'empty':
      writeBody(doc, block.reason, { italic: true })
      break
    case 'keyValue':
      for (const p of block.pairs) writeBody(doc, `${p.label}: ${p.value}`)
      break
    case 'table':
      writeTable(doc, block.headers, block.rows)
      break
  }
}

function renderSection(doc: PDFDocument, section: PsacRenderSection): void {
  const level: 1 | 2 = section.number && section.number.includes('.') ? 2 : 1
  writeHeading(doc, section.heading, level)
  writeBody(doc, section.description, { italic: true })
  for (const block of section.blocks) renderBlock(doc, block)
}

/** Render a PSAC PDF from a composed package + manifest. */
export async function renderPsacPdf(
  composed: ComposedAuditPackage,
  manifest: PackageManifest,
): Promise<Buffer> {
  const sections = buildPsacRenderSections(composed, manifest)
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN })

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .text(
      `Plan for Software Aspects of Certification\n${composed.project.name}`,
      MARGIN,
      doc.y,
      { width: CONTENT_WIDTH, align: 'center' },
    )
  doc.moveDown(1)

  for (const section of sections) renderSection(doc, section)

  return pdfBufferFromDoc(doc)
}
