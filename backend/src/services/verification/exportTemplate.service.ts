import { PrismaClient } from '@prisma/client'
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
import { reportService } from './report.service'
import { templateService } from './template.service'

const prisma = new PrismaClient()

type EntityType = 'TEST_CASE' | 'TEST_PLAN'

function createParagraph(
  text: string,
  opts: { bold?: boolean; heading?: 1 | 2 | 3 } = {}
): Paragraph {
  const size = opts.heading ? (opts.heading === 1 ? 36 : opts.heading === 2 ? 28 : 24) : 24
  const heading =
    opts.heading === 1
      ? HeadingLevel.HEADING_1
      : opts.heading === 2
        ? HeadingLevel.HEADING_2
        : opts.heading === 3
          ? HeadingLevel.HEADING_3
          : undefined
  return new Paragraph({
    heading,
    spacing: { after: 100 },
    children: [new TextRun({ text: text || '', bold: opts.bold, size })],
  })
}

function createTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((h) =>
          new TableCell({
            children: [createParagraph(h, { bold: true })],
            shading: { fill: 'E2E8F0' },
          })
        ),
      }),
      ...rows.map((row) =>
        new TableRow({
          children: row.map((cell) =>
            new TableCell({ children: [createParagraph(cell)] })
          ),
        })
      ),
    ],
  })
}

function buildPlaceholders(
  project: { id: string; name: string },
  report: any,
  entityType: EntityType
): Record<string, string | (() => Table)> {
  const map: Record<string, string | (() => Table)> = {}
  map['{{project.name}}'] = project.name
  map['{{project.id}}'] = project.id

  if (entityType === 'TEST_CASE' && report.testCase) {
    const tc = report.testCase
    map['{{testCase.title}}'] = tc.title ?? ''
    map['{{testCase.key}}'] = tc.key ?? ''
    map['{{testCase.objective}}'] = tc.objective ?? ''
    map['{{testCase.preconditions}}'] = tc.preconditions ?? ''
    map['{{testCase.passFailCriteria}}'] = tc.passFailCriteria ?? ''
    map['{{testCase.status}}'] = tc.status ?? ''
    map['{{testCase.version}}'] = String(tc.version ?? '')
    const setups = (tc.setups || []) as { name?: string }[]
    map['{{testSetup.summary}}'] = setups.map((s) => s.name).filter(Boolean).join(', ') || '—'
    const el = (report.verifiesElements || []) as { type: string; id?: string; name?: string }[]
    const reqs = el.filter((e) => e.type === 'requirement')
    map['{{requirements.list}}'] = reqs.length
      ? reqs.map((r) => `• ${r.id || ''} ${r.name || ''}`).join('\n')
      : '—'
    map['{{steps.table}}'] = (() => {
      const steps = (tc.steps || []) as (string | { text?: string })[]
      const rows = steps.map((s, i) => [
        String(i + 1),
        typeof s === 'string' ? s : (s as any).text ?? '',
      ])
      return createTable(['#', 'Step'], rows)
    }) as any
  }

  if (entityType === 'TEST_PLAN' && report.testPlan) {
    const tp = report.testPlan
    map['{{testPlan.name}}'] = tp.name ?? ''
    map['{{testPlan.key}}'] = tp.key ?? ''
    map['{{testPlan.description}}'] = tp.description ?? ''
    map['{{testPlan.phase}}'] = tp.phase ?? ''
    map['{{testPlan.status}}'] = tp.status ?? ''
    map['{{testPlan.entryCriteria}}'] = tp.entryCriteria ?? ''
    map['{{testPlan.exitCriteria}}'] = tp.exitCriteria ?? ''
    const el = (report.verifiesElements || []) as { type: string; id?: string; name?: string }[]
    const reqs = el.filter((e) => e.type === 'requirement')
    map['{{requirements.list}}'] = reqs.length
      ? reqs.map((r) => `• ${r.id || ''} ${r.name || ''}`).join('\n')
      : '—'
  }

  return map
}

function replacePlaceholders(
  text: string,
  placeholders: Record<string, string | (() => Table)>
): { text: string; tableInject?: Table }[] {
  let s = text
  for (const [k, v] of Object.entries(placeholders)) {
    if (typeof v === 'function') continue
    s = s.split(k).join(v)
  }
  const tableKey = '{{steps.table}}'
  const fn = placeholders[tableKey]
  if (typeof fn === 'function' && s.includes(tableKey)) {
    const before = s.substring(0, s.indexOf(tableKey)).trim()
    const after = s.substring(s.indexOf(tableKey) + tableKey.length).trim()
    const out: { text: string; tableInject?: Table }[] = []
    if (before) out.push({ text: before })
    out.push({ text: '', tableInject: fn() })
    if (after) out.push({ text: after })
    return out
  }
  return [{ text: s }]
}

type DocxChild = Paragraph | Table

function tiptapToDocx(
  contentJson: any,
  placeholders: Record<string, string | (() => Table)>
): DocxChild[] {
  const out: DocxChild[] = []
  const doc = contentJson?.type === 'doc' ? contentJson : { type: 'doc', content: [] }
  const content = Array.isArray(doc.content) ? doc.content : []

  function processBlock(node: any): void {
    if (!node || !node.type) return
    if (node.type === 'paragraph') {
      const parts = collectInlineText(node)
      const resolved = replacePlaceholders(parts.text, placeholders)
      for (const r of resolved) {
        if (r.tableInject) {
          out.push(r.tableInject)
        } else if (r.text) {
          out.push(createParagraph(r.text))
        }
      }
      return
    }
    if (node.type === 'heading') {
      const level = (node.attrs?.level ?? 1) as 1 | 2 | 3
      const parts = collectInlineText(node)
      const resolved = replacePlaceholders(parts.text, placeholders)
      for (const r of resolved) {
        if (r.tableInject) {
          out.push(r.tableInject)
        } else if (r.text) {
          out.push(createParagraph(r.text, { heading: level }))
        }
      }
      return
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const items = (node.content || []).filter((c: any) => c.type === 'listItem')
      for (const item of items) {
        const text = collectInlineText(item).text
        const resolved = replacePlaceholders(text, placeholders)
        for (const r of resolved) {
          if (r.tableInject) out.push(r.tableInject)
          else if (r.text) out.push(createParagraph(`• ${r.text}`))
        }
      }
      return
    }
    if (node.type === 'table') {
      const rows: string[][] = []
      const rowNodes = (node.content || []).filter((c: any) => c.type === 'tableRow')
      for (const rn of rowNodes) {
        const cells = (rn.content || [])
          .filter((c: any) => c.type === 'tableCell' || c.type === 'tableHeader')
          .map((c: any) => collectInlineText(c).text)
        if (cells.length) rows.push(cells)
      }
      if (rows.length) {
        const headers = rows[0]
        const data = rows.slice(1)
        out.push(createTable(headers, data))
      }
      return
    }
    if (node.content && Array.isArray(node.content)) {
      for (const c of node.content) processBlock(c)
    }
  }

  function collectInlineText(node: any): { text: string; bold?: boolean } {
    let text = ''
    let bold = false
    function walk(n: any) {
      if (!n) return
      if (n.type === 'text') {
        let t = n.text ?? ''
        const marks = n.marks || []
        if (marks.some((m: any) => m.type === 'bold')) bold = true
        text += t
        return
      }
      for (const c of n.content || []) walk(c)
    }
    walk(node)
    return { text, bold }
  }

  for (const node of content) processBlock(node)
  return out
}

export const exportTemplateService = {
  async exportWithTemplate(
    projectId: string,
    entityType: EntityType,
    entityId: string,
    templateId: string
  ): Promise<Buffer> {
    const template = await templateService.get(projectId, templateId)
    if (template.type !== entityType) {
      throw new Error(`Template type ${template.type} does not match entity type ${entityType}`)
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    })
    if (!project) throw new Error('Project not found')

    const report =
      entityType === 'TEST_CASE'
        ? await reportService.generateTestCaseReport(projectId, entityId)
        : await reportService.generateTestPlanReport(projectId, entityId)

    const placeholders = buildPlaceholders(project, report, entityType)
    const contentJson = (template as any).contentJson as object | null
    const children = tiptapToDocx(contentJson || { type: 'doc', content: [] }, placeholders)

    if (children.length === 0) {
      children.push(createParagraph('(No content)'))
    }

    const doc = new Document({
      sections: [{ children }],
    })
    return Packer.toBuffer(doc)
  },
}
