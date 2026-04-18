import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

type QualityExportCompare = {
  hasPrevious: boolean
  avgScoreDelta: number
  avgScorePrevious: number | null
  avgScoreCurrent: number
  improvedCount: number
  regressedCount: number
  previousCapturedAt: string | null
}

export type QualityExportStats = {
  adjustedAverageScore: number
  requirementCount: number
  errorIssueCount: number
  warningIssueCount: number
  passingRequirementCount: number
  dismissedIssueCount: number
}

type ReqRow = {
  displayId: string | null
  requirementId: string
  title: string
  baseScore: number
  adjustedScore: number
  issueMessage: string
  severity: string
  fixType: string
  skipped: string
  skipReason: string
}

function buildRows(
  requirements: Array<{
    requirementId: string
    displayId: string | null
    title: string
    validation: { score: number; issues?: Array<{ message: string; severity: string; fixType: string }> }
  }>,
  dismissedMap: Record<string, string[]>,
  reasonMap: Record<string, Record<string, string | undefined>>
): ReqRow[] {
  const rows: ReqRow[] = []
  const dismissed = (rid: string) => new Set(dismissedMap[rid] ?? [])
  const reason = (rid: string, key: string) => reasonMap[rid]?.[key] ?? ''

  for (const r of requirements) {
    const issues = r.validation.issues ?? []
    const dset = dismissed(r.requirementId)
    if (issues.length === 0) {
      rows.push({
        displayId: r.displayId,
        requirementId: r.requirementId,
        title: r.title,
        baseScore: r.validation.score,
        adjustedScore: r.validation.score,
        issueMessage: '',
        severity: '',
        fixType: '',
        skipped: '',
        skipReason: '',
      })
      continue
    }
    for (const iss of issues) {
      const key = `${iss.severity}:${iss.message}`
      rows.push({
        displayId: r.displayId,
        requirementId: r.requirementId,
        title: r.title,
        baseScore: r.validation.score,
        adjustedScore: r.validation.score,
        issueMessage: iss.message,
        severity: iss.severity,
        fixType: iss.fixType,
        skipped: dset.has(key) ? 'Yes' : 'No',
        skipReason: dset.has(key) ? reason(r.requirementId, key) : '',
      })
    }
  }
  return rows
}

function slugFileBase(projectName: string) {
  return `quality-report-${projectName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd-HHmm')}`
}

/** Multi-sheet .xlsx: executive summary + detailed findings for review and sharing. */
export function downloadQualityExcel(
  projectName: string,
  requirements: Parameters<typeof buildRows>[0],
  dismissedMap: Record<string, string[]>,
  reasonMap: Record<string, Record<string, string | undefined>>,
  stats: QualityExportStats,
  compare?: QualityExportCompare | undefined
) {
  const rows = buildRows(requirements, dismissedMap, reasonMap)
  const wb = XLSX.utils.book_new()

  const generated = new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })

  const summaryRows: (string | number)[][] = [
    ['REQUIREMENT QUALITY REPORT'],
    [],
    ['Project', projectName],
    ['Report generated', generated],
    ['Tool', 'Engineering Tool — Requirement Quality Workbench'],
    [],
    ['Roll-up metrics', ''],
    ['Adjusted average score (0–100)', stats.adjustedAverageScore],
    ['Requirements analyzed', stats.requirementCount],
    ['Requirements passing validation', stats.passingRequirementCount],
    ['Open error-level findings', stats.errorIssueCount],
    ['Open warning-level findings', stats.warningIssueCount],
    ['Findings marked dismissed / skipped', stats.dismissedIssueCount],
    ['Detailed issue rows (this workbook)', rows.length],
  ]
  if (compare?.hasPrevious) {
    summaryRows.push(
      [],
      ['Trend vs previous analysis', ''],
      [
        'Average score change',
        `${compare.avgScoreDelta >= 0 ? '+' : ''}${compare.avgScoreDelta} (previous ${compare.avgScorePrevious ?? '—'}, current ${compare.avgScoreCurrent})`,
      ],
      ['Requirements improved', compare.improvedCount],
      ['Requirements regressed', compare.regressedCount]
    )
    if (compare.previousCapturedAt) {
      summaryRows.push(['Previous snapshot captured at', compare.previousCapturedAt])
    }
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 52 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // Column order: human-readable first; full UUID last with extra width (GUIDs are 36 chars — narrow columns clip in Excel).
  const detailObjects = rows.map((r) => ({
    Project: projectName,
    'Display ID': r.displayId ?? '',
    'Requirement title': r.title,
    'Validation score': r.baseScore,
    'Finding / issue': r.issueMessage,
    Severity: r.severity,
    'Recommended fix type': r.fixType,
    Dismissed: r.skipped,
    'Dismissal rationale': r.skipReason,
    'Internal ID (UUID)': r.requirementId,
  }))
  const wsDetail = XLSX.utils.json_to_sheet(detailObjects)
  wsDetail['!cols'] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 42 },
    { wch: 12 },
    { wch: 52 },
    { wch: 14 },
    { wch: 22 },
    { wch: 12 },
    { wch: 36 },
    { wch: 42 },
  ]
  if (wsDetail['!ref']) {
    const range = XLSX.utils.decode_range(wsDetail['!ref'])
    wsDetail['!autofilter'] = { ref: XLSX.utils.encode_range(range) }
  }
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detailed findings')

  XLSX.writeFile(wb, `${slugFileBase(projectName)}.xlsx`)
}

export function downloadQualityPdf(
  projectName: string,
  requirements: Parameters<typeof buildRows>[0],
  dismissedMap: Record<string, string[]>,
  reasonMap: Record<string, Record<string, string | undefined>>,
  compare?: QualityExportCompare | undefined,
  adjustedAvg?: number
) {
  const rows = buildRows(requirements, dismissedMap, reasonMap)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  doc.setFontSize(14)
  doc.text('Requirement quality report', 40, 40)
  doc.setFontSize(10)
  doc.text(`Project: ${projectName}`, 40, 58)
  doc.text(`Generated: ${new Date().toISOString()}`, 40, 72)
  if (compare?.hasPrevious) {
    doc.text(
      `vs last run: avg ${compare.avgScoreDelta >= 0 ? '+' : ''}${compare.avgScoreDelta} (prev ${compare.avgScorePrevious ?? '—'}, now ${compare.avgScoreCurrent})`,
      40,
      86
    )
  }
  if (adjustedAvg != null) {
    doc.text(`Adjusted average score: ${adjustedAvg}`, 40, compare?.hasPrevious ? 100 : 86)
  }

  const tableBody = rows
    .filter((r) => r.issueMessage || !r.skipped)
    .slice(0, 500)
    .map((r) => [
      r.displayId ?? r.requirementId.slice(0, 8),
      r.title.slice(0, 40),
      String(r.baseScore),
      r.issueMessage.slice(0, 60),
      r.severity,
      r.skipped,
    ])

  autoTable(doc, {
    startY: compare?.hasPrevious ? 110 : 96,
    head: [['ID', 'Title', 'Score', 'Issue', 'Sev', 'Skipped']],
    body: tableBody,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [59, 130, 246] },
  })

  doc.save(`${slugFileBase(projectName)}.pdf`)
}
