// N-2.2 (#425) — the PSAC DOCX renderer.
//
// Consumes ONLY the renderer-agnostic PsacRenderSection[] built by psacContent.
// It emits the 14 PSAC sections in section-map order; a section with an `empty`
// block still renders its heading + the engineer-voice empty line.
//
// docx-lib pattern follows verification/exportTemplate.service.ts.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
} from 'docx'
import type { ComposedAuditPackage, PackageManifest } from '../types'
import { buildPsacRenderSections } from './psacContent'
import type { PsacBlock, PsacRenderSection } from './psacContent'

function heading(text: string, level: 1 | 2): Paragraph {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: level === 1 ? 30 : 26 })],
  })
}

function bodyText(text: string, opts: { italic?: boolean; bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, italics: opts.italic, bold: opts.bold, size: 22 })],
  })
}

function table(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              shading: { fill: 'E2E8F0' },
              children: [
                new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] }),
              ],
            }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })],
                }),
            ),
          }),
      ),
    ],
  })
}

function renderBlock(block: PsacBlock): (Paragraph | Table)[] {
  switch (block.type) {
    case 'paragraph':
      return [bodyText(block.text)]
    case 'empty':
      return [bodyText(block.reason, { italic: true })]
    case 'keyValue':
      return block.pairs.map((p) => bodyText(`${p.label}: ${p.value}`))
    case 'table':
      return [table(block.headers, block.rows)]
    default:
      return []
  }
}

function renderSection(section: PsacRenderSection): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  const level: 1 | 2 = section.number && section.number.includes('.') ? 2 : 1
  out.push(heading(section.heading, level))
  out.push(bodyText(section.description, { italic: true }))
  for (const block of section.blocks) out.push(...renderBlock(block))
  return out
}

/** Render a PSAC DOCX from a composed package + manifest. */
export async function renderPsacDocx(
  composed: ComposedAuditPackage,
  manifest: PackageManifest,
): Promise<Buffer> {
  const sections = buildPsacRenderSections(composed, manifest)
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Plan for Software Aspects of Certification — ${composed.project.name}`,
          bold: true,
          size: 36,
        }),
      ],
    }),
  ]
  for (const section of sections) children.push(...renderSection(section))

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}
