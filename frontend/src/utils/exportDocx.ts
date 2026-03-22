import type { ExportSection, ExportDocumentStyle } from './requirementExportTemplates'
import { DEFAULT_AUTHORITY_STYLE } from './requirementExportTemplates'
import { format } from 'date-fns'
import type { TraceabilityMatrixModel } from 'shared/types/traceabilityMatrix.types'

export interface DocxColumn {
  key: string
  label: string
}

export interface DocxRequirementRow {
  [key: string]: string | number | null | undefined
}

export interface DocxGlossaryEntry {
  term: string
  definition?: string
}

export interface BuildDocxWithSectionsOptions {
  documentTitle: string
  projectName?: string
  requirements: DocxRequirementRow[]
  columns: DocxColumn[]
  sections: ExportSection[]
  documentStyle?: ExportDocumentStyle | null
  glossaryEntries?: DocxGlossaryEntry[]
  abbreviationEntries?: DocxGlossaryEntry[]
  stripHtml?: (value: string) => string
}

export interface BuildTraceabilityMatrixDocxOptions {
  documentTitle: string
  projectName?: string
  matrix: TraceabilityMatrixModel
  documentStyle?: ExportDocumentStyle | null
  maxIdsPerCell?: number
}

export async function buildTraceabilityMatrixDocx(options: BuildTraceabilityMatrixDocxOptions): Promise<Blob> {
  const {
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    Packer,
    Header,
    Footer,
    AlignmentType,
    BorderStyle,
  } = await import('docx')

  const style = options.documentStyle ?? DEFAULT_AUTHORITY_STYLE
  const sizeBody = ((style.fontSizeBody ?? 11) * 2)
  const sizeH1 = ((style.fontSizeHeading1 ?? 14) * 2)
  const marginTwip = style.marginMm != null ? Math.round((style.marginMm / 25.4) * 1440) : 1440
  const fontFamily = style.fontFamily || 'Times New Roman'
  const borderColorHex = style.tableBorderColor?.replace('#', '') ?? 'E5E7EB'
  const headerBg = style.tableHeaderBg?.replace('#', '') ?? '374151'
  const headerFg = style.tableHeaderFg?.replace('#', '') ?? 'FFFFFF'
  const maxIds = Math.max(1, options.maxIdsPerCell ?? 8)

  const singleBorder = { style: BorderStyle.SINGLE, size: 6, color: borderColorHex }
  const tableBorders = {
    top: singleBorder,
    bottom: singleBorder,
    left: singleBorder,
    right: singleBorder,
    insideHorizontal: singleBorder,
    insideVertical: singleBorder,
  }

  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: style.headerLeft?.replace(/\{title\}/g, options.documentTitle) ?? options.documentTitle, size: sizeBody - 2, font: fontFamily })],
      }),
    ],
  })
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: style.footerRight?.replace(/\{date\}/g, format(new Date(), 'yyyy-MM-dd')) ?? format(new Date(), 'yyyy-MM-dd'), size: sizeBody - 2, font: fontFamily })],
      }),
    ],
  })

  const headRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        shading: { fill: headerBg, color: headerFg },
        children: [new Paragraph({ children: [new TextRun({ text: '', bold: true, size: sizeBody, font: fontFamily })] })],
      }),
      ...options.matrix.cols.map((c) =>
        new TableCell({
          shading: { fill: headerBg, color: headerFg },
          children: [new Paragraph({ children: [new TextRun({ text: (c.label || c.key).slice(0, 120), bold: true, size: sizeBody, font: fontFamily })] })],
        })
      ),
    ],
  })

  const rows = options.matrix.rows.map((r) => {
    const cells: any[] = [
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: r.key, bold: true, size: sizeBody, font: fontFamily })] })],
      }),
    ]
    for (const c of options.matrix.cols) {
      const entries = options.matrix.cells[r.id]?.[c.id] ?? []
      let paragraphs: any[]
      if (entries.length === 0) {
        paragraphs = [new Paragraph({ children: [new TextRun({ text: '', size: sizeBody, font: fontFamily })] })]
      } else {
        const formatted = entries.map((e: any) => {
          if (typeof e === 'string') return e
          return `${e.arrow} ${e.linkType}${e.isSuspect ? ' (?)' : ''}`
        })
        const visible = formatted.length <= maxIds ? formatted : [...formatted.slice(0, maxIds), `+${formatted.length - maxIds} more`]
        paragraphs = visible.map((line: string) =>
          new Paragraph({ children: [new TextRun({ text: line.slice(0, 32000), size: sizeBody, font: fontFamily })] })
        )
      }
      cells.push(
        new TableCell({ children: paragraphs })
      )
    }
    return new TableRow({ children: cells })
  })

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: marginTwip, bottom: marginTwip, left: marginTwip, right: marginTwip } },
        },
        headers: { default: header },
        footers: { default: footer },
        children: [
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: options.documentTitle, bold: true, size: sizeH1, font: fontFamily })],
          }),
          ...(options.projectName
            ? [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: `Project: ${options.projectName}`, size: sizeBody, font: fontFamily })] })]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headRow, ...rows],
            borders: tableBorders,
          }),
        ],
      },
    ],
  })

  return await Packer.toBlob(doc)
}

/**
 * Build a Word document with sections (cover, summary, requirements table, glossary, abbreviations, custom text)
 * and optional authority document style (header/footer, table styling).
 */
export async function buildRequirementsDocxWithSections(options: BuildDocxWithSectionsOptions): Promise<Blob> {
  const {
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    Packer,
    Header,
    Footer,
    AlignmentType,
    BorderStyle,
    PageBreak,
  } = await import('docx')

  const style = options.documentStyle ?? DEFAULT_AUTHORITY_STYLE
  const stripHtml = options.stripHtml ?? ((s: string) => s.replace(/<[^>]*>/g, '').trim())
  const sizeBody = ((style.fontSizeBody ?? 11) * 2)
  const sizeH1 = ((style.fontSizeHeading1 ?? 14) * 2)
  const sizeH2 = ((style.fontSizeHeading2 ?? 12) * 2)
  const marginTwip = style.marginMm != null ? Math.round((style.marginMm / 25.4) * 1440) : 1440
  const fontFamily = style.fontFamily || 'Times New Roman'
  const borderColorHex = style.tableBorderColor?.replace('#', '') ?? 'E5E7EB'

  const headerBg = style.tableHeaderBg?.replace('#', '') ?? '374151'
  const headerFg = style.tableHeaderFg?.replace('#', '') ?? 'FFFFFF'

  const singleBorder = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: borderColorHex,
  }
  const tableBorders = {
    top: singleBorder,
    bottom: singleBorder,
    left: singleBorder,
    right: singleBorder,
    insideHorizontal: singleBorder,
    insideVertical: singleBorder,
  }

  const createParagraph = (text: string, bold = false, size = sizeBody) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: text.slice(0, 32000), bold, size, font: fontFamily })],
    })

  type DocxChild = InstanceType<typeof Paragraph> | InstanceType<typeof Table>
  const children: DocxChild[] = []
  const enabledSections = options.sections.filter((s) => s.enabled)

  for (let i = 0; i < enabledSections.length; i++) {
    const sec = enabledSections[i]
    const sectionNum = i + 1
    const title = sec.title ?? sec.type

    if (sec.type === 'cover') {
      const opts = sec.options ?? {}
      const coverChildren: DocxChild[] = []
      coverChildren.push(
        new Paragraph({
          spacing: { after: 400 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: options.documentTitle, bold: true, size: sizeH1 + 4, font: fontFamily })],
        })
      )
      if (opts.showProjectName !== false && options.projectName) {
        coverChildren.push(
          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: options.projectName, size: sizeBody + 2, font: fontFamily })],
          })
        )
      }
      if (opts.showDate !== false) {
        coverChildren.push(
          new Paragraph({
            spacing: { after: 200 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Date: ${format(new Date(), 'yyyy-MM-dd')}`, size: sizeBody, font: fontFamily })],
          })
        )
      }
      if (opts.showVersion && opts.versionLabel) {
        coverChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Version: ${opts.versionLabel}`, size: sizeBody, font: fontFamily })],
          })
        )
      }
      if (opts.classification) {
        coverChildren.push(
          new Paragraph({
            spacing: { before: 300, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: opts.classification, bold: true, size: sizeBody, font: fontFamily })],
          })
        )
      }
      if (opts.preparerOrOrg) {
        coverChildren.push(
          new Paragraph({
            spacing: { before: 600 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: opts.preparerOrOrg, size: sizeBody - 2, font: fontFamily })],
          })
        )
      }
      children.push(...coverChildren)
      continue
    }

    if (sec.type === 'summary') {
      const opts = sec.options ?? {}
      children.push(
        new Paragraph({
          pageBreakBefore: opts.startOnNewPage !== false,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: `This document contains ${options.requirements.length} requirement(s).`,
              size: sizeBody,
              font: fontFamily,
            }),
          ],
        })
      )
      if (options.projectName) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `Project: ${options.projectName}`, size: sizeBody, font: fontFamily })],
          })
        )
      }
      const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
      for (let p = 0; p < blankAfter; p++) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
      }
      continue
    }

    if (sec.type === 'requirements_table') {
      const opts = sec.options ?? {}
      const headerRow = new TableRow({
        tableHeader: true,
        children: options.columns.map((col) =>
          new TableCell({
            children: [createParagraph(col.label, true, sizeBody)],
            shading: { fill: headerBg, color: headerFg },
          })
        ),
      })
      const dataRows = options.requirements.map((req) =>
        new TableRow({
          children: options.columns.map((col) => {
            let value = req[col.key]
            if (value === null || value === undefined) value = ''
            const str = typeof value === 'string' ? stripHtml(value) : String(value)
            return new TableCell({
              children: [createParagraph(str, false, sizeBody)],
            })
          }),
        })
      )
      children.push(
        new Paragraph({
          pageBreakBefore: opts.startOnNewPage !== false,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
          borders: tableBorders,
        })
      )
      const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
      for (let p = 0; p < blankAfter; p++) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
      }
      continue
    }

    if (sec.type === 'glossary' && options.glossaryEntries && options.glossaryEntries.length > 0) {
      const opts = sec.options ?? {}
      const glossaryHeader = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [createParagraph('Term', true, sizeBody)],
            shading: { fill: headerBg, color: headerFg },
          }),
          new TableCell({
            children: [createParagraph('Definition', true, sizeBody)],
            shading: { fill: headerBg, color: headerFg },
          }),
        ],
      })
      const glossaryRows = options.glossaryEntries.map(
        (e) =>
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph(e.term, false, sizeBody)] }),
              new TableCell({
                children: [createParagraph(e.definition ?? '', false, sizeBody)],
              }),
            ],
          })
      )
      children.push(
        new Paragraph({
          pageBreakBefore: opts.startOnNewPage !== false,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [glossaryHeader, ...glossaryRows],
          borders: tableBorders,
        })
      )
      const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
      for (let p = 0; p < blankAfter; p++) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
      }
      continue
    }

    if (sec.type === 'abbreviations' && options.abbreviationEntries && options.abbreviationEntries.length > 0) {
      const opts = sec.options ?? {}
      const abbrHeader = new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [createParagraph('Term', true, sizeBody)],
            shading: { fill: headerBg, color: headerFg },
          }),
          new TableCell({
            children: [createParagraph('Definition', true, sizeBody)],
            shading: { fill: headerBg, color: headerFg },
          }),
        ],
      })
      const abbrRows = options.abbreviationEntries.map(
        (e) =>
          new TableRow({
            children: [
              new TableCell({ children: [createParagraph(e.term, false, sizeBody)] }),
              new TableCell({
                children: [createParagraph(e.definition ?? '', false, sizeBody)],
              }),
            ],
          })
      )
      children.push(
        new Paragraph({
          pageBreakBefore: opts.startOnNewPage !== false,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [abbrHeader, ...abbrRows],
          borders: tableBorders,
        })
      )
      const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
      for (let p = 0; p < blankAfter; p++) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
      }
      continue
    }

    if (sec.type === 'custom_text' && sec.options?.content) {
      const opts = sec.options ?? {}
      children.push(
        new Paragraph({
          pageBreakBefore: opts.startOnNewPage !== false,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Paragraph({
          children: [new TextRun({ text: sec.options.content.slice(0, 32000), size: sizeBody, font: fontFamily })],
        })
      )
      const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
      for (let p = 0; p < blankAfter; p++) {
        children.push(new Paragraph({ children: [new PageBreak()] }))
      }
      continue
    }

    if (sec.type === 'placeholder') {
      const opts = sec.options ?? {}
      const plStyle = opts.placeholderStyle ?? 'full_page'
      const blankPageCount = Math.min(5, Math.max(1, opts.blankPageCount ?? 1))
      const displayTitle = title || 'Reserved'

      if (plStyle === 'full_page') {
        children.push(
          new Paragraph({
            pageBreakBefore: opts.startOnNewPage !== false,
            spacing: { after: 200 },
            children: [new TextRun({ text: `${sectionNum}. ${displayTitle}`, bold: true, size: sizeH1, font: fontFamily })],
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [new TextRun({ text: 'Reserved for manual completion.', size: sizeBody - 2, font: fontFamily })],
          })
        )
        for (let p = 1; p < blankPageCount; p++) {
          children.push(
            new Paragraph({
              children: [new PageBreak()],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: 'Reserved for manual completion.', size: sizeBody - 2, font: fontFamily })],
            })
          )
        }
      } else {
        children.push(
          new Paragraph({
            pageBreakBefore: opts.startOnNewPage !== false,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: `${sectionNum}. ${displayTitle}`, bold: true, size: sizeH1, font: fontFamily })],
          })
        )
        for (let k = 0; k < 4; k++) {
          children.push(
            new Paragraph({
              spacing: { before: 400, after: 400 },
              children: [new TextRun({ text: ' ', size: sizeBody, font: fontFamily })],
            })
          )
        }
        const blankAfter = Math.min(5, Math.max(0, opts.blankPagesAfter ?? 0))
        for (let p = 0; p < blankAfter; p++) {
          children.push(new Paragraph({ children: [new PageBreak()] }))
        }
      }
    }
  }

  const footerCenterText = style.footerCenter ?? 'Page {pageOfN}'
  const footerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: footerCenterText.replace(/\{pageOfN\}/g, '').replace(/\{date\}/g, format(new Date(), 'yyyy-MM-dd')).trim() || `Generated: ${format(new Date(), 'yyyy-MM-dd')}`,
        size: sizeBody - 2,
        font: fontFamily,
      }),
    ],
  })

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: marginTwip,
              right: marginTwip,
              bottom: marginTwip,
              left: marginTwip,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: style.headerLeft?.replace(/\{title\}/g, options.documentTitle) ?? options.documentTitle,
                    size: sizeBody - 2,
                    font: fontFamily,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [footerParagraph],
          }),
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

/**
 * Build a Word document with a title and a table of requirements (selected columns).
 * Uses dynamic import of docx to match existing usage (e.g. ListExporter).
 * Returns a Blob suitable for download. For section-based authority export use buildRequirementsDocxWithSections.
 */
export async function buildRequirementsDocx(options: {
  title: string
  requirements: DocxRequirementRow[]
  columns: DocxColumn[]
  stripHtml?: (value: string) => string
}): Promise<Blob> {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, Packer } = await import('docx')
  const { title, requirements, columns, stripHtml = (s) => s.replace(/<[^>]*>/g, '').trim() } = options

  const createParagraph = (text: string, bold = false) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: text.slice(0, 32000), bold, size: 22 })],
    })

  const headerRow = new TableRow({
    children: columns.map((col) =>
      new TableCell({
        children: [createParagraph(col.label, true)],
        shading: { fill: 'E2E8F0' },
      })
    ),
  })

  const dataRows = requirements.map((req) =>
    new TableRow({
      children: columns.map((col) => {
        let value = req[col.key]
        if (value === null || value === undefined) value = ''
        const str = typeof value === 'string' ? stripHtml(value) : String(value)
        return new TableCell({
          children: [createParagraph(str)],
        })
      }),
    })
  )

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: title, bold: true, size: 28 })],
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `Generated: ${new Date().toLocaleString()} · ${requirements.length} requirement(s)`,
                size: 20,
              }),
            ],
          }),
          table,
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}

/** Flat row for glossary / abbreviations archive export (Word). */
export interface GlossaryAbbreviationDocxRow {
  term: string
  definition: string
  notes: string
  source: string
  updated: string
}

export interface BuildGlossaryAbbreviationsDocxOptions {
  documentTitle: string
  /** Main cover line (defaults to documentTitle if omitted). */
  coverTitle?: string
  coverSubtitle?: string
  /** Header/footer reference line (avoids generic requirement-export wording). */
  runningHeader?: string
  scopeLabel?: string
  sortLabel?: string
  projectId: string
  projectName?: string
  glossaryRows?: GlossaryAbbreviationDocxRow[]
  abbreviationRows?: GlossaryAbbreviationDocxRow[]
  includeDefinitions: boolean
  documentStyle?: ExportDocumentStyle | null
}

/**
 * Word export for Archive glossary & abbreviations (authority styling aligned with requirement export).
 */
export async function buildGlossaryAbbreviationsDocx(options: BuildGlossaryAbbreviationsDocxOptions): Promise<Blob> {
  const {
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    Packer,
    Header,
    Footer,
    AlignmentType,
    BorderStyle,
    PageBreak,
  } = await import('docx')

  const style = options.documentStyle ?? DEFAULT_AUTHORITY_STYLE
  const sizeBody = ((style.fontSizeBody ?? 11) * 2)
  const sizeH1 = ((style.fontSizeHeading1 ?? 14) * 2)
  const sizeH2 = ((style.fontSizeHeading2 ?? 12) * 2)
  const marginTwip = style.marginMm != null ? Math.round((style.marginMm / 25.4) * 1440) : 1440
  const fontFamily = style.fontFamily || 'Times New Roman'
  const borderColorHex = style.tableBorderColor?.replace('#', '') ?? 'E5E7EB'
  const headerBg = style.tableHeaderBg?.replace('#', '') ?? '374151'
  const headerFg = style.tableHeaderFg?.replace('#', '') ?? 'FFFFFF'
  const headerTitle = options.runningHeader ?? options.documentTitle

  const singleBorder = { style: BorderStyle.SINGLE, size: 6, color: borderColorHex }
  const tableBorders = {
    top: singleBorder,
    bottom: singleBorder,
    left: singleBorder,
    right: singleBorder,
    insideHorizontal: singleBorder,
    insideVertical: singleBorder,
  }

  const createParagraph = (text: string, bold = false, size = sizeBody) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: text.slice(0, 32000), bold, size, font: fontFamily })],
    })

  const createMetaLine = (label: string, value: string) =>
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: sizeBody, font: fontFamily }),
        new TextRun({ text: value.slice(0, 32000), size: sizeBody, font: fontFamily }),
      ],
    })

  const columnLabels = options.includeDefinitions
    ? (['Term', 'Definition', 'Notes', 'Source', 'Updated'] as const)
    : (['Term', 'Notes', 'Source', 'Updated'] as const)

  const buildTable = (rows: GlossaryAbbreviationDocxRow[]) => {
    const headerCells = columnLabels.map(
      (label) =>
        new TableCell({
          children: [createParagraph(label, true, sizeBody)],
          shading: { fill: headerBg, color: headerFg },
        })
    )
    const headerRow = new TableRow({ tableHeader: true, children: headerCells })
    const dataRows = rows.map((r) => {
      const cells: string[] = options.includeDefinitions
        ? [r.term, r.definition, r.notes, r.source, r.updated]
        : [r.term, r.notes, r.source, r.updated]
      return new TableRow({
        children: cells.map((cell, colIndex) =>
          new TableCell({
            margins: colIndex === 0 ? { top: 80, bottom: 80, left: 120, right: 80 } : { top: 80, bottom: 80, left: 80, right: 80 },
            children: [createParagraph(cell, colIndex === 0, sizeBody)],
          })
        ),
      })
    })
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
      borders: tableBorders,
    })
  }

  type DocxChild = InstanceType<typeof Paragraph> | InstanceType<typeof Table>
  const coverMain = options.coverTitle ?? options.documentTitle
  const glossary = options.glossaryRows ?? []
  const abbrev = options.abbreviationRows ?? []

  const children: DocxChild[] = [
    new Paragraph({
      spacing: { after: 240 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: coverMain, bold: true, size: sizeH1 + 6, font: fontFamily })],
    }),
  ]

  if (options.coverSubtitle) {
    children.push(
      new Paragraph({
        spacing: { after: 360 },
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: options.coverSubtitle.slice(0, 32000),
            size: sizeBody,
            font: fontFamily,
            italics: true,
          }),
        ],
      })
    )
  } else {
    children.push(new Paragraph({ spacing: { after: 360 }, children: [] }))
  }

  children.push(
    new Paragraph({
      spacing: { before: 120, after: 160 },
      children: [new TextRun({ text: 'Summary', bold: true, size: sizeH2, font: fontFamily })],
    })
  )

  if (options.scopeLabel) {
    children.push(createMetaLine('Export scope', options.scopeLabel))
  }
  children.push(
    createMetaLine('Glossary entries in this file', String(glossary.length)),
    createMetaLine('Abbreviation entries in this file', String(abbrev.length)),
    createMetaLine(
      'Definitions column',
      options.includeDefinitions ? 'Included (HTML removed)' : 'Omitted'
    )
  )
  if (options.sortLabel) {
    children.push(createMetaLine('Sort order', options.sortLabel))
  }
  children.push(
    createMetaLine('Project ID', options.projectId),
    ...(options.projectName ? [createMetaLine('Project name', options.projectName)] : []),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
          size: sizeBody - 2,
          font: fontFamily,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  )

  if (glossary.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 200 },
        children: [new TextRun({ text: '1. Glossary', bold: true, size: sizeH1, font: fontFamily })],
      }),
      buildTable(glossary)
    )
  }

  if (abbrev.length > 0) {
    if (glossary.length > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
    const sectionNum = glossary.length > 0 ? 2 : 1
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 200 },
        children: [new TextRun({ text: `${sectionNum}. Abbreviations`, bold: true, size: sizeH1, font: fontFamily })],
      }),
      buildTable(abbrev)
    )
  }

  const subFooter = (raw: string | undefined) =>
    (raw ?? '')
      .replace(/\{date\}/g, format(new Date(), 'yyyy-MM-dd'))
      .replace(/\{title\}/g, headerTitle)
      .replace(/\{pageOfN\}/g, '')
      .replace(/\{page\}/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const footerLeft = subFooter(style.footerLeft)
  const footerCenter = subFooter(style.footerCenter)
  const footerRight = subFooter(style.footerRight)
  const footerLine =
    [footerLeft, footerCenter, footerRight].filter((s) => s.length > 0).join('   ') ||
    `Glossary & abbreviations · ${format(new Date(), 'yyyy-MM-dd')}`

  const footerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: borderColorHex } },
    spacing: { before: 120 },
    children: [
      new TextRun({
        text: footerLine.slice(0, 500),
        size: sizeBody - 2,
        font: fontFamily,
      }),
    ],
  })

  const headerText =
    (style.headerLeft?.includes('{title}')
      ? style.headerLeft.replace(/\{title\}/g, headerTitle)
      : style.headerLeft) ?? headerTitle

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: marginTwip, bottom: marginTwip, left: marginTwip, right: marginTwip },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                spacing: { after: 80 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: borderColorHex } },
                children: [new TextRun({ text: headerText.slice(0, 500), size: sizeBody - 2, font: fontFamily })],
              }),
            ],
          }),
        },
        footers: { default: new Footer({ children: [footerParagraph] }) },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}
