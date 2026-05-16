import { prisma } from '../lib/prisma'
import ExcelJS from 'exceljs'
// @ts-ignore
import PDFDocument from 'pdfkit'
import archiver from 'archiver'
import type { Readable } from 'stream'
import { composePsac } from './auditPackage/composer.service'
import { renderPsacDocx } from './auditPackage/render/docxRenderer'
import { renderPsacPdf } from './auditPackage/render/pdfRenderer'
import { renderPsacJson } from './auditPackage/render/jsonRenderer'
import { buildManifest, manifestFileOf } from './auditPackage/render/manifest'
import {
  SUPPORTED_AUDIT_ARTEFACT_TYPES,
  type AuditArtefactType,
  type PackageManifest,
} from './auditPackage/types'


export type ExportFormat = 'xlsx' | 'pdf'

async function getCertificationData(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  })
  if (!project) return null

  let ctx = await prisma.certContext.findUnique({ where: { projectId } })
  if (!ctx) {
    ctx = await prisma.certContext.create({
      data: { projectId, authority: 'EASA', certBasis: 'CS-25', standards: ['ARP4754A', 'DO-178C'] },
    })
  }

  const [matrixRows, objectives, findings, reviewLog, activityLog, readinessGates, verEvidence] =
    await Promise.all([
      prisma.certComplianceMatrixRow.findMany({
        where: { projectId },
        orderBy: { regRef: 'asc' },
      }),
      prisma.certObjective.findMany({
        where: { projectId },
        orderBy: { objId: 'asc' },
      }),
      prisma.certFinding.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.certReviewLogEntry.findMany({
        where: { projectId },
        orderBy: { date: 'desc' },
      }),
      prisma.certActivityLogEntry.findMany({
        where: { projectId },
        orderBy: { timestamp: 'desc' },
        take: 2000,
      }),
      prisma.certReadinessGate.findMany({
        where: { projectId },
        orderBy: { gateId: 'asc' },
      }),
      prisma.verEvidence.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
    ])

  return {
    project: { name: project.name },
    context: ctx,
    matrixRows,
    objectives,
    findings,
    reviewLog,
    activityLog,
    readinessGates,
    verEvidence,
  }
}

function pdfBufferFromDoc(doc: PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

export async function exportComplianceMatrix(projectId: string, format: ExportFormat): Promise<Buffer | null> {
  const data = await getCertificationData(projectId)
  if (!data) return null

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Certification Export'
    const ws = wb.addWorksheet('Compliance Matrix', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [
      { width: 16 },
      { width: 8 },
      { width: 12 },
      { width: 14 },
      { width: 12 },
      { width: 10 },
    ]
    ws.addRow(['Reg Ref', 'Objectives', 'Complete', 'Partial', 'Open', 'Evidence'])
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    for (const r of data.matrixRows) {
      const ss = r.statusSummary as { complete?: number; partial?: number; open?: number; blocked?: number }
      ws.addRow([
        r.regRef,
        r.objectiveCount,
        ss?.complete ?? 0,
        ss?.partial ?? 0,
        ss?.open ?? 0,
        r.evidenceCount,
      ])
    }
    const buf = await wb.xlsx.writeBuffer()
    return Buffer.from(buf as ArrayBuffer)
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.fontSize(14).text(`Compliance Matrix — ${data.project.name}`, { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(10).text(`Authority: ${data.context.authority} | Cert basis: ${data.context.certBasis}`)
  doc.moveDown(1)
  let y = doc.y
  const colWidths = [80, 50, 50, 50, 50, 50]
  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('Reg Ref', 50, y)
  doc.text('Objectives', 50 + colWidths[0], y)
  doc.text('Complete', 50 + colWidths[0] + colWidths[1], y)
  doc.text('Partial', 50 + colWidths[0] + colWidths[1] + colWidths[2], y)
  doc.text('Open', 50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y)
  doc.text('Evidence', 50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y)
  y += 18
  doc.font('Helvetica')
  for (const r of data.matrixRows) {
    const ss = r.statusSummary as { complete?: number; partial?: number; open?: number; blocked?: number }
    doc.text(r.regRef, 50, y)
    doc.text(String(r.objectiveCount), 50 + colWidths[0], y)
    doc.text(String(ss?.complete ?? 0), 50 + colWidths[0] + colWidths[1], y)
    doc.text(String(ss?.partial ?? 0), 50 + colWidths[0] + colWidths[1] + colWidths[2], y)
    doc.text(String(ss?.open ?? 0), 50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y)
    doc.text(String(r.evidenceCount), 50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], y)
    y += 14
    if (y > 750) {
      doc.addPage()
      y = 50
    }
  }
  return pdfBufferFromDoc(doc)
}

export async function exportEvidenceIndex(projectId: string, format: ExportFormat): Promise<Buffer | null> {
  const data = await getCertificationData(projectId)
  if (!data) return null

  const rows = data.verEvidence.map((e) => [
    e.id,
    (e as any).evidenceId ?? e.id,
    e.title ?? '—',
    (e as any).status ?? 'Draft',
    (e as any).owner ?? '—',
    e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 10) : '—',
  ])

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Evidence Index', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [{ width: 38 }, { width: 24 }, { width: 36 }, { width: 12 }, { width: 20 }, { width: 12 }]
    ws.addRow(['ID', 'Evidence ID', 'Title', 'Type', 'Created By', 'Date'])
    ws.getRow(1).font = { bold: true }
    for (const row of rows) ws.addRow(row)
    const buf = await wb.xlsx.writeBuffer()
    return Buffer.from(buf as ArrayBuffer)
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.fontSize(14).text(`Evidence Index — ${data.project.name}`, { align: 'center' })
  doc.moveDown(1)
  let y = doc.y
  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('Evidence ID', 50, y)
  doc.text('Title', 120, y)
  doc.text('Type', 350, y)
  doc.text('Created By', 400, y)
  doc.text('Date', 480, y)
  y += 16
  doc.font('Helvetica')
  for (const row of rows) {
    doc.text(String(row[1]), 50, y)
    doc.text(String(row[2]).slice(0, 40), 120, y)
    doc.text(String(row[3]), 350, y)
    doc.text(String(row[4]), 400, y)
    doc.text(String(row[5]), 480, y)
    y += 14
    if (y > 750) {
      doc.addPage()
      y = 50
    }
  }
  return pdfBufferFromDoc(doc)
}

export async function exportSummaryPdf(projectId: string): Promise<Buffer | null> {
  const data = await getCertificationData(projectId)
  if (!data) return null

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.fontSize(16).text(`Certification Summary — ${data.project.name}`, { align: 'center' })
  doc.moveDown(1)
  doc.fontSize(10)
  doc.text(`Authority: ${data.context.authority}`)
  doc.text(`Cert basis: ${data.context.certBasis}`)
  doc.text(`Standards: ${(data.context.standards as string[]).join(', ')}`)
  doc.moveDown(1)
  doc.font('Helvetica-Bold').text('Compliance summary')
  doc.font('Helvetica')
  const totalObj = data.objectives.length
  const completeObj = data.objectives.filter((o) => o.status === 'Complete').length
  doc.text(`Objectives: ${completeObj} / ${totalObj} complete`)
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').text('Open findings')
  doc.font('Helvetica')
  const openFindings = data.findings.filter((f) => f.status !== 'Closed' && f.status !== 'Deferred')
  if (openFindings.length === 0) doc.text('None')
  else openFindings.forEach((f) => doc.text(`• ${f.findingId}: ${f.title} (${f.severity})`))
  doc.moveDown(0.5)
  doc.font('Helvetica-Bold').text('Readiness gates')
  doc.font('Helvetica')
  data.readinessGates.forEach((g) => {
    doc.text(`• ${g.label}: ${g.passed ? 'Passed' : 'Not passed'}${g.reason ? ` — ${g.reason}` : ''}`)
  })
  return pdfBufferFromDoc(doc)
}

export async function exportReviewLog(projectId: string, format: ExportFormat): Promise<Buffer | null> {
  const data = await getCertificationData(projectId)
  if (!data) return null

  const rows = data.reviewLog.map((e) => [
    e.reviewId,
    new Date(e.date).toISOString().slice(0, 10),
    e.reviewType,
    e.scopeSummary?.slice(0, 50) ?? '—',
    e.findingsRaised,
    e.findingsClosed,
    e.status,
  ])

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Review Log', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [{ width: 12 }, { width: 12 }, { width: 14 }, { width: 28 }, { width: 10 }, { width: 12 }, { width: 10 }]
    ws.addRow(['Review ID', 'Date', 'Type', 'Scope', 'Raised', 'Closed', 'Status'])
    ws.getRow(1).font = { bold: true }
    for (const row of rows) ws.addRow(row)
    const buf = await wb.xlsx.writeBuffer()
    return Buffer.from(buf as ArrayBuffer)
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.fontSize(14).text(`Review Log — ${data.project.name}`, { align: 'center' })
  doc.moveDown(1)
  let y = doc.y
  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('Review ID', 50, y)
  doc.text('Date', 110, y)
  doc.text('Type', 170, y)
  doc.text('Scope', 250, y)
  doc.text('Status', 450, y)
  y += 16
  doc.font('Helvetica')
  for (const row of rows) {
    doc.text(String(row[0]), 50, y)
    doc.text(String(row[1]), 110, y)
    doc.text(String(row[2]), 170, y)
    doc.text(String(row[3]), 250, y)
    doc.text(String(row[6]), 450, y)
    y += 14
    if (y > 750) {
      doc.addPage()
      y = 50
    }
  }
  return pdfBufferFromDoc(doc)
}

export async function exportActivityLog(projectId: string, format: ExportFormat): Promise<Buffer | null> {
  const data = await getCertificationData(projectId)
  if (!data) return null

  const rows = data.activityLog.map((a) => [
    a.timestamp ? new Date(a.timestamp).toISOString() : '—',
    a.action,
    a.details?.slice(0, 60) ?? '—',
    a.actor ?? '—',
  ])

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Activity Log', { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.columns = [{ width: 24 }, { width: 22 }, { width: 40 }, { width: 18 }]
    ws.addRow(['Timestamp', 'Action', 'Details', 'Actor'])
    ws.getRow(1).font = { bold: true }
    for (const row of rows) ws.addRow(row)
    const buf = await wb.xlsx.writeBuffer()
    return Buffer.from(buf as ArrayBuffer)
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  doc.fontSize(14).text(`Activity Log (Audit) — ${data.project.name}`, { align: 'center' })
  doc.moveDown(1)
  let y = doc.y
  doc.fontSize(9).font('Helvetica-Bold')
  doc.text('Timestamp', 50, y)
  doc.text('Action', 180, y)
  doc.text('Details', 280, y)
  doc.text('Actor', 480, y)
  y += 16
  doc.font('Helvetica')
  for (const row of rows) {
    doc.text(String(row[0]), 50, y)
    doc.text(String(row[1]), 180, y)
    doc.text(String(row[2]), 280, y)
    doc.text(String(row[3]), 480, y)
    y += 14
    if (y > 750) {
      doc.addPage()
      y = 50
    }
  }
  return pdfBufferFromDoc(doc)
}

export interface PackageBundleOptions {
  includeMatrix?: boolean
  includeEvidenceIndex?: boolean
  includeSummary?: boolean
  includeReviewLog?: boolean
  includeActivityLog?: boolean
}

export async function generatePackageBundle(
  projectId: string,
  packageId: string,
  options: PackageBundleOptions
): Promise<{ stream: Readable; filename: string } | null> {
  const pkg = await prisma.certPackage.findFirst({
    where: { id: packageId, projectId },
  })
  if (!pkg) return null

  const archive = archiver('zip', { zlib: { level: 9 } })
  const filename = `cert-package-${packageId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.zip`

  if (options.includeMatrix !== false) {
    const buf = await exportComplianceMatrix(projectId, 'pdf')
    if (buf) archive.append(buf, { name: 'compliance-matrix.pdf' })
  }
  if (options.includeEvidenceIndex !== false) {
    const buf = await exportEvidenceIndex(projectId, 'pdf')
    if (buf) archive.append(buf, { name: 'evidence-index.pdf' })
  }
  if (options.includeSummary !== false) {
    const buf = await exportSummaryPdf(projectId)
    if (buf) archive.append(buf, { name: 'certification-summary.pdf' })
  }
  if (options.includeReviewLog !== false) {
    const buf = await exportReviewLog(projectId, 'pdf')
    if (buf) archive.append(buf, { name: 'review-log.pdf' })
  }
  if (options.includeActivityLog !== false) {
    const buf = await exportActivityLog(projectId, 'pdf')
    if (buf) archive.append(buf, { name: 'activity-log.pdf' })
  }

  archive.finalize()
  return { stream: archive, filename }
}

// ---------------------------------------------------------------------------
// N-2.2 (#425) — the opinionated, regulator-shaped audit-package generator.
//
// Composes the artefact graph once (composer.service.ts — 9 batched queries,
// no N+1), renders the PSAC into DOCX + PDF + JSON, builds a manifest, and zips
// the four files. Separate from `generatePackageBundle` (the legacy 5-doc ZIP),
// which is left untouched.
// ---------------------------------------------------------------------------

export type { AuditArtefactType } from './auditPackage/types'

/** Whitelist guard — only PSAC is built; SDP/SVP/SAS/SCI/SECI are follow-on tickets. */
export function isSupportedAuditArtefactType(value: unknown): value is AuditArtefactType {
  return (
    typeof value === 'string' &&
    SUPPORTED_AUDIT_ARTEFACT_TYPES.includes(value as AuditArtefactType)
  )
}

/**
 * Generate the opinionated audit package for a project's CURRENT state.
 *
 * Returns `null` when the project does not exist (controller -> 404). The
 * `generatedBy` string is the audit attribution recorded in the manifest.
 */
export async function generateAuditPackage(
  projectId: string,
  options: { artefactType: AuditArtefactType; generatedBy: string },
): Promise<{ stream: Readable; filename: string; manifest: PackageManifest } | null> {
  // PSAC is the only artefact type built. The route already whitelisted it; this
  // switch keeps the service honest if a future caller passes something else.
  if (options.artefactType !== 'PSAC') {
    throw new Error(`Unsupported audit artefact type: ${options.artefactType}`)
  }

  const composed = await composePsac(projectId)
  if (!composed) return null

  // Render with a preliminary manifest (graph counts visible in Appendix B; the
  // per-file hash table cannot exist yet — a file cannot hash itself).
  const preliminaryManifest = buildManifest(composed, options.generatedBy, [])
  const docxBuf = await renderPsacDocx(composed, preliminaryManifest)
  const pdfBuf = await renderPsacPdf(composed, preliminaryManifest)
  const jsonBuf = renderPsacJson(composed, preliminaryManifest)

  // The final manifest carries the sha256 + byte count of every rendered file.
  const manifest = buildManifest(composed, options.generatedBy, [
    manifestFileOf('PSAC.docx', docxBuf),
    manifestFileOf('PSAC.pdf', pdfBuf),
    manifestFileOf('PSAC.json', jsonBuf),
  ])
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.append(docxBuf, { name: 'PSAC.docx' })
  archive.append(pdfBuf, { name: 'PSAC.pdf' })
  archive.append(jsonBuf, { name: 'PSAC.json' })
  archive.append(manifestBuf, { name: 'manifest.json' })
  archive.finalize()

  const filename = `psac-audit-package-${projectId.slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.zip`
  return { stream: archive, filename, manifest }
}
