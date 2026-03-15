export interface DocxColumn {
  key: string
  label: string
}

export interface DocxRequirementRow {
  [key: string]: string | number | null | undefined
}

/**
 * Build a Word document with a title and a table of requirements (selected columns).
 * Uses dynamic import of docx to match existing usage (e.g. ListExporter).
 * Returns a Blob suitable for download.
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
