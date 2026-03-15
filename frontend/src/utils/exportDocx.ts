import type { ExportSection, ExportDocumentStyle } from './requirementExportTemplates'
import { DEFAULT_AUTHORITY_STYLE } from './requirementExportTemplates'
import { format } from 'date-fns'

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
      children.push(
        new Paragraph({
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
      continue
    }

    if (sec.type === 'requirements_table') {
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
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
          borders: tableBorders,
        })
      )
      continue
    }

    if (sec.type === 'glossary' && options.glossaryEntries && options.glossaryEntries.length > 0) {
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
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [glossaryHeader, ...glossaryRows],
          borders: tableBorders,
        })
      )
      continue
    }

    if (sec.type === 'abbreviations' && options.abbreviationEntries && options.abbreviationEntries.length > 0) {
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
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [abbrHeader, ...abbrRows],
          borders: tableBorders,
        })
      )
      continue
    }

    if (sec.type === 'custom_text' && sec.options?.content) {
      children.push(
        new Paragraph({
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: `${sectionNum}. ${title}`, bold: true, size: sizeH1, font: fontFamily })],
        }),
        new Paragraph({
          children: [new TextRun({ text: sec.options.content.slice(0, 32000), size: sizeBody, font: fontFamily })],
        })
      )
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
            pageBreakBefore: true,
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
