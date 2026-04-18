import Papa from 'papaparse'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

type CompareLite = {
  hasPrevious: boolean
  avgScoreDelta: number
  avgScorePrevious: number | null
  avgScoreCurrent: number
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
        skipped: dset.has(key) ? 'yes' : 'no',
        skipReason: dset.has(key) ? reason(r.requirementId, key) : '',
      })
    }
  }
  return rows
}

export function downloadQualityCsv(
  projectName: string,
  requirements: Parameters<typeof buildRows>[0],
  dismissedMap: Record<string, string[]>,
  reasonMap: Record<string, Record<string, string | undefined>>
) {
  const rows = buildRows(requirements, dismissedMap, reasonMap)
  const csv = Papa.unparse(
    rows.map((r) => ({
      project: projectName,
      displayId: r.displayId ?? '',
      requirementUuid: r.requirementId,
      title: r.title,
      baseScore: r.baseScore,
      adjustedScore: r.adjustedScore,
      issue: r.issueMessage,
      severity: r.severity,
      fixType: r.fixType,
      skipped: r.skipped,
      skipReason: r.skipReason,
    })),
    { header: true }
  )
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quality-report-${projectName.replace(/\s+/g, '-')}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadQualityPdf(
  projectName: string,
  requirements: Parameters<typeof buildRows>[0],
  dismissedMap: Record<string, string[]>,
  reasonMap: Record<string, Record<string, string | undefined>>,
  compare?: CompareLite | undefined,
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

  doc.save(`quality-report-${projectName.replace(/\s+/g, '-')}-${Date.now()}.pdf`)
}
