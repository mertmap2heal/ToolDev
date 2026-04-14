import { useState, useEffect } from 'react'
import { X, FileText, FileSpreadsheet, File, FileCode, Download, Loader2, CheckSquare, Square } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { verificationService } from '../../services/verification.service'

// Dynamic imports for heavy libraries
let autoTableModule: any = null
let docxModule: any = null

async function loadAutoTable() {
  if (!autoTableModule) {
    try {
      autoTableModule = await import('jspdf-autotable')
    } catch (error) {
      console.error('Failed to load jspdf-autotable:', error)
      throw new Error('PDF export is not available')
    }
  }
  return autoTableModule.default || autoTableModule
}

async function loadDocx() {
  if (!docxModule) {
    try {
      docxModule = await import('docx')
    } catch (error) {
      console.error('Failed to load docx:', error)
      throw new Error('Word export is not available')
    }
  }
  return docxModule
}

/** Normalize text for jsPDF Helvetica / WinAnsi to avoid garbled procedure tables. */
function normalizePdfText(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw !== 'string') {
    try { raw = JSON.stringify(raw) } catch { raw = String(raw) }
  }
  const normalizeLine = (line: string) => {
    let s = line.normalize('NFKC')
    s = s.replace(/\u00A0/g, ' ')
    s = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    s = s.replace(/\u2013|\u2014/g, '-')
    s = s.replace(/\u2026/g, '...')
    s = s.replace(/\u2264/g, '<=').replace(/\u2265/g, '>=').replace(/\u00B1/g, '+/-').replace(/\u00B0/g, ' deg ')
    let out = ''
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      if (c === 9 || c === 10 || c === 13) continue
      if (c < 128 || (c >= 160 && c <= 255)) out += s[i]
      else out += ' '
    }
    return out.replace(/[ ]{2,}/g, ' ').trimEnd()
  }
  return (raw as string).split(/\r?\n/).map(normalizeLine).join('\n')
}

function formatDocGeneralConditions(gc: unknown): string {
  if (gc == null) return ''
  if (typeof gc === 'string') return gc
  if (typeof gc === 'object' && gc !== null && 'text' in gc && typeof (gc as { text?: unknown }).text === 'string') {
    return (gc as { text: string }).text
  }
  try {
    return JSON.stringify(gc, null, 2)
  } catch {
    return ''
  }
}

function stringifyCustomSectionContent(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  try {
    return JSON.stringify(content, null, 2)
  } catch {
    return String(content)
  }
}

// Authority-grade styling constants (aligned with DEFAULT_AUTHORITY_STYLE in exportPdfLayout)
const AUTH_MARGIN = 25
const AUTH_FONT_BODY = 11
const AUTH_FONT_TABLE = 9
const AUTH_FONT_H1 = 18
const AUTH_FONT_H2 = 14
const AUTH_FONT_H3 = 12
const AUTH_FONT_HEADER = 8
const AUTH_TABLE_HEAD_BG: [number, number, number] = [55, 65, 81]
const AUTH_TABLE_HEAD_FG: [number, number, number] = [255, 255, 255]
const AUTH_TABLE_ALT_ROW: [number, number, number] = [249, 250, 251]
const AUTH_TABLE_BORDER: [number, number, number] = [229, 231, 235]

function getStatusColor(status: string): [number, number, number] {
  switch (status?.toUpperCase()) {
    case 'PASS': case 'APPROVED': case 'VERIFIED': return [34, 197, 94]
    case 'FAIL': case 'FAILED': return [239, 68, 68]
    case 'BLOCKED': return [249, 115, 22]
    case 'SKIPPED': case 'NOT_RUN': return [156, 163, 175]
    default: return [107, 114, 128]
  }
}

function rgbToHex(rgb: [number, number, number]): string {
  return rgb.map((c) => c.toString(16).padStart(2, '0')).join('')
}

interface ListExporterProps {
  isOpen: boolean
  onClose: () => void
  exportType: 'test-cases' | 'test-plans'
  items: any[]
  projectId: string
  /** When set and non-empty, pre-select these item ids (must be a subset of `items`). Otherwise all `items` are selected. */
  initialSelectedIds?: string[]
}

type ExportFormat = 'pdf' | 'csv' | 'json' | 'word'

interface TestCaseReport {
  testCase?: {
    id?: string
    key?: string
    title?: string
    status?: string
    version?: string
    objective?: string
    preconditions?: string
    steps?: any
    expectedResults?: any
    passFailCriteria?: string
    moc?: { code?: string; name?: string } | null
    method?: { id?: string; name?: string; methodType?: string } | null
    setups?: Array<{ id?: string; name?: string; environmentType?: string }>
  }
  executionHistory?: Array<{ status?: string; executedAt?: string; actualResults?: string; notes?: string }>
  evidence?: Array<{ id?: string; type?: string; title?: string; relation?: string }>
  testResults?: Array<{ id?: string; title?: string; fileName?: string; resultStatus?: string; executedAt?: string; executedByName?: string; testEnvironment?: string; notes?: string; relation?: string; setup?: { name?: string } | null }>
  verifiesElements?: Array<{ type?: string; id?: string; name?: string }>
  customSections?: Array<{ id?: string; title?: string; content?: any; orderIndex?: number; images?: Array<{ fileName?: string; fileUrl?: string; mimeType?: string }> }>
  auditTrail?: Array<{ action?: string; performedBy?: string; performedAt?: string; oldValue?: any; newValue?: any }>
}

interface TestPlanReport {
  testPlan?: {
    id?: string
    key?: string
    name?: string
    status?: string
    phase?: string
    description?: string
    scope?: string
    entryCriteria?: string
    exitCriteria?: string
    docNumber?: string
    docConfidentiality?: string
    docProjectCode?: string
    docRevision?: string
    docPlanDate?: string
    docPreparedByName?: string
    docQaByName?: string
    docApprovedByName?: string
    docApprovedAt?: string
    docPurpose?: string
    docOverview?: string
    docStatementOfConformity?: string
    docChangesPolicy?: string
    docDistribution?: string
    docAcronymsNote?: string
    docApplicableDocuments?: any
    docGeneralPrecautions?: string
    docGeneralConditions?: any
    docTools?: any
    docTestSetupNotes?: string
    docAppendices?: Array<{ title: string; content: string }>
  }
  revisions?: Array<{
    revisionNumber?: string
    revisionDate?: string
    editedByName?: string
    approvedByName?: string
    approvedAt?: string
    summaryOfChanges?: string
  }>
  setups?: Array<{
    id?: string
    name?: string
    description?: string
    version?: string
    status?: string
    environmentType?: string
    diagramExportPath?: string
    photos?: any
  }>
  statistics?: { totalCases?: number; executed?: number; passed?: number; failed?: number; coveragePercentage?: number }
  testCases?: Array<{
    orderIndex?: number
    isMandatory?: boolean
    notes?: string
    testCase?: {
      id?: string
      key?: string
      title?: string
      status?: string
      objective?: string
      preconditions?: string
      steps?: any
      expectedResults?: any
      passFailCriteria?: string
      verifiesElements?: Array<{ type?: string; id?: string; name?: string }>
      customSections?: Array<{
        id?: string
        title?: string
        content?: any
        orderIndex?: number
        images?: Array<{ fileName?: string; fileUrl?: string }>
      }>
    }
    latestResult?: { status?: string; executedAt?: string } | null
  }>
  testResults?: Array<{ title?: string; resultStatus?: string; executedByName?: string; executedAt?: string }>
  verifiesElements?: Array<{ type?: string; id?: string; name?: string }>
}

const formatInfo = {
  pdf: { icon: FileText, label: 'PDF', description: 'Formatted document' },
  csv: { icon: FileSpreadsheet, label: 'CSV', description: 'Spreadsheet compatible' },
  json: { icon: FileCode, label: 'JSON', description: 'Raw data' },
  word: { icon: File, label: 'Word', description: 'Editable document' },
}

export default function ListExporter({
  isOpen,
  onClose,
  exportType,
  items,
  projectId,
  initialSelectedIds,
}: ListExporterProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(items.map((item) => item.id)))
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeDetails, setIncludeDetails] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const itemIds = items.map((item) => item.id)
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      const allowed = initialSelectedIds.filter((id) => itemIds.includes(id))
      setSelectedItems(new Set(allowed.length > 0 ? allowed : itemIds))
    } else {
      setSelectedItems(new Set(itemIds))
    }
  }, [isOpen, items, initialSelectedIds])

  if (!isOpen) return null

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return 'N/A'
    try {
      return format(new Date(date), 'yyyy-MM-dd HH:mm')
    } catch {
      return 'N/A'
    }
  }

  const downloadFile = (content: string | Blob, filename: string, mimeType: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const toggleItem = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const toggleAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(items.map((item) => item.id)))
    }
  }

  const selectedItemsList = items.filter((item) => selectedItems.has(item.id))

  // Fetch detailed report data for selected items
  const fetchDetailedReports = async (): Promise<Array<TestCaseReport | TestPlanReport>> => {
    const reports: Array<TestCaseReport | TestPlanReport> = []
    for (const item of selectedItemsList) {
      try {
        if (exportType === 'test-cases') {
          const response = await verificationService.getTestCaseReport(projectId, item.id)
          if (response.success && response.data) {
            reports.push(response.data as TestCaseReport)
          }
        } else {
          const response = await verificationService.getTestPlanReport(projectId, item.id)
          if (response.success && response.data) {
            reports.push(response.data as TestPlanReport)
          }
        }
      } catch (e) {
        console.error(`Failed to fetch report for ${item.id}:`, e)
      }
    }
    return reports
  }

  const exportToPDF = async () => {
    const mod = await loadAutoTable()
    const doc = new jsPDF()
    const applyPlugin = (mod as any)?.applyPlugin ?? (mod as any)?.default?.applyPlugin
    const autoTableFn =
      typeof mod === 'function' ? mod : (mod as any)?.autoTable ?? (mod as any)?.default ?? (mod as any)?.default?.autoTable
    if (typeof applyPlugin === 'function') {
      applyPlugin(jsPDF)
    }
    const docAutoTable = (opts: any) => {
      if (typeof (doc as any).autoTable === 'function') (doc as any).autoTable(opts)
      else if (typeof autoTableFn === 'function') autoTableFn(doc, opts)
      else throw new Error('PDF tables are not available')
    }
    const getLastAutoTableY = () => (doc as any).lastAutoTable?.finalY ?? 20
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 20

    const wrapText = (text: string, maxWidth: number) =>
      doc.splitTextToSize(normalizePdfText(text ?? ''), maxWidth) as string[]

    const setPlaceholderStyle = () => {
      doc.setTextColor(220, 38, 38)
      doc.setFont('helvetica', 'bold')
    }
    const resetTextStyle = () => {
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
    }

    const placeholder = (label: string) => `TODO: ${label}`

    const resolveUrl = (url: string) => {
      if (!url) return url
      if (url.startsWith('data:')) return url
      if (url.startsWith('http://') || url.startsWith('https://')) return url
      if (url.startsWith('/')) return `${window.location.origin}${url}`
      return url
    }

    const fetchAsDataUrl = async (url: string): Promise<{ dataUrl: string; mime: string } | null> => {
      if (!url) return null
      if (url.startsWith('data:')) {
        const mime = url.slice(5).split(';')[0] || 'image/png'
        return { dataUrl: url, mime }
      }
      const res = await fetch(resolveUrl(url))
      if (!res.ok) return null
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Failed to read image'))
        reader.readAsDataURL(blob)
      })
      return { dataUrl, mime: blob.type || 'image/png' }
    }

    const drawHeaderFooterAllPages = (opts: { confidentiality?: string; docNumber?: string; revision?: string; docTitle?: string }) => {
      const totalPages = doc.getNumberOfPages()
      const m = AUTH_MARGIN
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        const w = doc.internal.pageSize.getWidth()
        const h = doc.internal.pageSize.getHeight()
        const classification = opts.confidentiality || ''
        const docRef = [opts.docNumber, opts.revision ? `Rev ${opts.revision}` : null].filter(Boolean).join(' \u2022 ')

        // Header: classification left | doc title center | doc#/rev right
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_HEADER)
        if (classification) doc.text(classification, m, 10)
        doc.setFont('helvetica', 'normal')
        if (opts.docTitle) doc.text(opts.docTitle, w / 2, 10, { align: 'center' })
        if (docRef) doc.text(docRef, w - m, 10, { align: 'right' })

        doc.setDrawColor(180)
        doc.setLineWidth(0.3)
        doc.line(m, 12, w - m, 12)

        // Footer: classification centered (top line) | page x of y right
        doc.line(m, h - 14, w - m, h - 14)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_HEADER)
        if (classification) doc.text(classification, w / 2, h - 9, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.text(`Page ${p} of ${totalPages}`, w - m, h - 5, { align: 'right' })
      }
    }

    const addCoverPage = (r: TestPlanReport, companyName?: string, statistics?: TestPlanReport['statistics'], projectName?: string) => {
      const tp = r.testPlan || {}
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      const m = AUTH_MARGIN
      const confidentiality = tp.docConfidentiality || 'CONFIDENTIAL'
      const docNumber = tp.docNumber || tp.key || ''
      const revision = tp.docRevision || '1.0'
      const docTitle = tp.name || tp.key || 'Test Plan'
      const contentW = w - 2 * m

      // Classification banner top
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H3)
      doc.text(confidentiality, w / 2, 20, { align: 'center' })

      // Divider
      doc.setDrawColor(180)
      doc.setLineWidth(0.4)
      doc.line(m, 25, w - m, 25)

      // Project name and company / organization
      let yC = 50
      if (projectName) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_H3)
        doc.text(projectName, w / 2, yC, { align: 'center' })
        yC += 8
      }
      if (companyName) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(AUTH_FONT_BODY)
        doc.text(companyName, w / 2, yC, { align: 'center' })
        yC += 12
      }

      // Document type
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('TEST PLAN', w / 2, yC + 10, { align: 'center' })

      // Plan name
      doc.setFontSize(AUTH_FONT_H1)
      const nameLines = doc.splitTextToSize(docTitle, contentW)
      doc.text(nameLines, w / 2, yC + 28, { align: 'center' })

      const afterName = yC + 28 + nameLines.length * 8

      // Divider
      doc.setDrawColor(180)
      doc.line(m + 30, afterName + 4, w - m - 30, afterName + 4)

      // Metadata table (centered key-value pairs)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(AUTH_FONT_BODY)
      const metaItems = [
        docNumber ? ['Document No.', docNumber] : null,
        tp.docProjectCode ? ['Project Code', tp.docProjectCode] : null,
        ['Revision', revision],
        tp.docPlanDate ? ['Test Plan Date', formatDate(tp.docPlanDate)] : null,
      ].filter(Boolean) as string[][]

      let yMeta = afterName + 16
      for (const [label, val] of metaItems) {
        doc.setFont('helvetica', 'bold')
        doc.text(`${label}:`, w / 2 - 2, yMeta, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        doc.text(val, w / 2 + 2, yMeta)
        yMeta += 7
      }

      // Overall Result
      const yResult = h - 80
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H3)
      doc.text('Overall Result', m, yResult)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(AUTH_FONT_BODY)

      const stats = statistics
      const hasResults = stats && (stats.executed || 0) > 0
      const allPassed = hasResults && (stats.failed || 0) === 0
      const hasFailed = hasResults && (stats.failed || 0) > 0

      doc.rect(m, yResult + 4, 5, 5)
      if (allPassed) {
        doc.setFillColor(34, 197, 94)
        doc.rect(m + 0.5, yResult + 4.5, 4, 4, 'F')
      }
      doc.setTextColor(0, 0, 0)
      doc.text('PASS', m + 8, yResult + 8)

      doc.rect(m + 40, yResult + 4, 5, 5)
      if (hasFailed) {
        doc.setFillColor(239, 68, 68)
        doc.rect(m + 40.5, yResult + 4.5, 4, 4, 'F')
      }
      doc.setTextColor(0, 0, 0)
      doc.text('FAIL', m + 48, yResult + 8)

      // Footer area
      doc.setDrawColor(180)
      doc.line(m, h - 30, w - m, h - 30)
      doc.setFontSize(AUTH_FONT_HEADER)
      doc.text(`Generated: ${formatDate(new Date())}`, m, h - 22)
      doc.setFont('helvetica', 'bold')
      doc.text(confidentiality, w / 2, h - 22, { align: 'center' })

      return { confidentiality, docNumber, revision, docTitle }
    }

    const addSimpleSectionPage = (title: string, body?: string) => {
      doc.addPage()
      const w = doc.internal.pageSize.getWidth()
      const m = AUTH_MARGIN
      let y = 24
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H2)
      doc.text(title, m, y)
      y += 10
      if (body) {
        doc.setFontSize(AUTH_FONT_BODY)
        const lines = wrapText(body, w - 2 * m)
        for (const line of lines) {
          const isTodo = line.trim().startsWith('TODO:')
          if (isTodo) setPlaceholderStyle()
          else resetTextStyle()
          doc.text(line, m, y)
          y += 5.5
          if (y > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage()
            y = 24
          }
        }
        resetTextStyle()
      } else {
        resetTextStyle()
        doc.setFontSize(AUTH_FONT_BODY)
        doc.text('N/A', m, y)
      }
    }

    const addRevisionControl = (r: TestPlanReport) => {
      doc.addPage()
      const m = AUTH_MARGIN
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H2)
      doc.text('Revision Control', m, 24)

      const rows = (r.revisions || []).map((rev) => [
        rev.revisionNumber || '',
        rev.revisionDate ? formatDate(rev.revisionDate) : '',
        rev.editedByName || '',
        rev.approvedByName || '',
        rev.approvedAt ? formatDate(rev.approvedAt) : '',
        rev.summaryOfChanges || '',
      ])

      docAutoTable({
        startY: 34,
        head: [['Rev', 'Date', 'Edited by', 'Approved by', 'Approved at', 'Summary of Changes']],
        body: rows.length ? rows : [['', '', '', '', '', 'No revision history']],
        theme: 'striped',
        margin: { left: m, right: m },
        headStyles: { fillColor: AUTH_TABLE_HEAD_BG, textColor: AUTH_TABLE_HEAD_FG, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: AUTH_TABLE_ALT_ROW },
        styles: { fontSize: AUTH_FONT_TABLE, cellPadding: 3, overflow: 'linebreak', lineColor: AUTH_TABLE_BORDER, lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 14 },
          1: { cellWidth: 24 },
          2: { cellWidth: 26 },
          3: { cellWidth: 26 },
          4: { cellWidth: 24 },
          5: { cellWidth: 'auto' },
        },
      })
    }

    const addTOCPage = () => {
      doc.addPage()
      const m = AUTH_MARGIN
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H2)
      doc.text('Table of Contents', m, 24)
    }

    const fillTOCPage = (tocPageNumber: number, tocEntries: Array<{ title: string; page: number; level?: number }>) => {
      doc.setPage(tocPageNumber)
      const w = doc.internal.pageSize.getWidth()
      const mBase = AUTH_MARGIN
      let y = 36
      for (const e of tocEntries) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage()
          y = 24
        }
        const isSubLevel = (e.level || 1) >= 2
        const xOffset = isSubLevel ? mBase + 8 : mBase
        doc.setFont('helvetica', isSubLevel ? 'normal' : 'bold')
        doc.setFontSize(isSubLevel ? AUTH_FONT_TABLE : AUTH_FONT_BODY)

        const titleText = e.title
        const pageText = String(e.page)
        doc.text(titleText, xOffset, y)
        doc.text(pageText, w - mBase, y, { align: 'right' })

        const titleWidth = doc.getTextWidth(titleText)
        const pgWidth = doc.getTextWidth(pageText)
        const dotsStart = xOffset + titleWidth + 3
        const dotsEnd = w - mBase - pgWidth - 3
        if (dotsEnd > dotsStart) {
          const dotChar = '.'
          const dotWidth = doc.getTextWidth(dotChar + ' ')
          let xDot = dotsStart
          doc.setTextColor(160, 160, 160)
          while (xDot < dotsEnd) {
            doc.text(dotChar, xDot, y)
            xDot += dotWidth
          }
          doc.setTextColor(0, 0, 0)
        }
        y += isSubLevel ? 6 : 7
      }
    }

    const addToolsAndSetup = async (r: TestPlanReport) => {
      doc.addPage()
      const m = AUTH_MARGIN
      const w = doc.internal.pageSize.getWidth()
      const contentW = w - 2 * m
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H2)
      doc.text('General Conditions / Tools / Test Setup', m, 24)

      const gcBody = formatDocGeneralConditions(r.testPlan?.docGeneralConditions)
      let yGc = 34
      if (gcBody.trim()) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_H3)
        doc.text('General conditions', m, yGc)
        yGc += 7
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(AUTH_FONT_BODY)
        const gcLines = wrapText(gcBody, contentW)
        for (const line of gcLines) {
          if (yGc > doc.internal.pageSize.getHeight() - 24) {
            doc.addPage()
            yGc = 24
          }
          doc.text(line, m, yGc)
          yGc += 5.5
        }
        yGc += 6
      }

      const tools = Array.isArray(r.testPlan?.docTools) ? (r.testPlan?.docTools as any[]) : []
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H3)
      doc.text('Tools', m, yGc)
      docAutoTable({
        startY: yGc + 4,
        head: [['Tool', 'Manufacturer', 'Part #', 'Serial #', 'Calibration valid till']],
        body: tools.length
          ? tools.map((t) => [t?.name || '', t?.manufacturer || '', t?.partNumber || '', t?.serialNumber || '', t?.calibrationValidTill || ''])
          : [['', '', '', '', '']],
        theme: 'striped',
        margin: { left: m, right: m },
        headStyles: { fillColor: AUTH_TABLE_HEAD_BG, textColor: AUTH_TABLE_HEAD_FG, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: AUTH_TABLE_ALT_ROW },
        styles: { fontSize: AUTH_FONT_TABLE, cellPadding: 3, overflow: 'linebreak', lineColor: AUTH_TABLE_BORDER, lineWidth: 0.1 },
      })

      let y = getLastAutoTableY() + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H3)
      doc.text('Linked Test Setups', m, y)
      y += 7
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(AUTH_FONT_BODY)
      const setups = r.setups || []
      const setupLines = setups.length ? setups.map((s) => `- ${s.name || s.id || 'Setup'}`) : ['- N/A']
      doc.text(setupLines, m, y)

      const notes = r.testPlan?.docTestSetupNotes
      if (notes) {
        const noteLines = wrapText(notes, contentW)
        doc.text(noteLines, m, y + 10)
      }

      const primary = setups[0]
      const diagramUrl =
        (primary?.diagramExportPath as any) ||
        (Array.isArray(primary?.photos) ? (primary?.photos as any[])?.[0]?.fileUrl || (primary?.photos as any[])?.[0]?.url : null)

      const img = diagramUrl ? await fetchAsDataUrl(String(diagramUrl)) : null
      const afterTextY = (notes ? y + 20 : y + 12)
      const startY = Math.min(afterTextY + 8, doc.internal.pageSize.getHeight() - 120)

      if (img?.dataUrl) {
        const maxW = contentW
        const maxH = 90
        const fmt = img.mime.includes('jpeg') || img.mime.includes('jpg') ? 'JPEG' : 'PNG'
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_H3)
        doc.text('Setup Diagram', m, startY)
        try {
          ;(doc as any).addImage(img.dataUrl, fmt, m, startY + 4, maxW, maxH)
        } catch {
          setPlaceholderStyle()
          doc.text(placeholder('Unable to render setup diagram image'), m, startY + 14)
          resetTextStyle()
        }
      } else {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(AUTH_FONT_TABLE)
        doc.setTextColor(100, 100, 100)
        doc.text('No setup diagram file on record. Add a diagram export on the linked test setup.', m, startY + 14)
        resetTextStyle()
      }
    }

    const addPerTestCaseChapters = async (r: TestPlanReport, tocEntries: Array<{ title: string; page: number; level?: number }>, parentSecNum?: number) => {
      const cases = r.testCases || []
      const m = AUTH_MARGIN
      for (let cIdx = 0; cIdx < cases.length; cIdx++) {
        const pc = cases[cIdx]
        const tc = pc.testCase || {}
        doc.addPage()
        const startPage = doc.getNumberOfPages()
        const caseNum = parentSecNum ? `${parentSecNum}.${cIdx + 1}` : ''
        const caseLabel = caseNum ? `${caseNum} ${tc.key || 'TC'}: ${tc.title || ''}`.trim() : `${tc.key || 'TC'}: ${tc.title || ''}`.trim()
        tocEntries.push({ title: caseLabel, page: startPage, level: 2 })

        const w = doc.internal.pageSize.getWidth()
        const contentW = w - 2 * m
        let y = 24
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_H2)
        doc.text(caseLabel, m, y)
        y += 10

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_BODY)
        const caseStatus = pc.latestResult?.status || tc.status || 'N/A'
        const statusCol = getStatusColor(caseStatus)
        doc.setTextColor(statusCol[0], statusCol[1], statusCol[2])
        doc.text(caseStatus, m, y)
        const statusW = doc.getTextWidth(caseStatus)
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        doc.text(`   |   ${pc.isMandatory ? 'Mandatory' : 'Optional'}`, m + statusW, y)
        y += 10

        const section = (title: string, text?: string) => {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(AUTH_FONT_H3)
          doc.text(title, m, y)
          y += 7
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(AUTH_FONT_BODY)
          const lines = wrapText(text || 'N/A', contentW)
          doc.text(lines, m, y)
          y += lines.length * 5.5 + 4
          if (y > doc.internal.pageSize.getHeight() - 30) {
            doc.addPage()
            y = 24
          }
        }

        section('Objective', tc.objective as any)
        section('Preconditions / Assumptions', tc.preconditions as any)

        const verifies = (tc.verifiesElements || []).map((v) => `- ${(v.id || '').toString()} ${v.name || ''}`.trim()).filter(Boolean)
        section('Requirements Verified', verifies.length ? verifies.join('\n') : 'N/A')

        if (tc.passFailCriteria) {
          section('Expected Outcomes / Pass-Fail Criteria', tc.passFailCriteria as any)
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_H3)
        doc.text('Test Procedure', m, y)

        const steps = Array.isArray(tc.steps) ? (tc.steps as any[]) : []
        const expected = Array.isArray(tc.expectedResults) ? (tc.expectedResults as any[]) : []
        const procColWidths = contentW
        const rows = steps.length
          ? steps.map((s, idx) => {
              const desc = typeof s === 'string' ? s : (s?.text || s?.description || JSON.stringify(s))
              const exp = expected[idx]
              const expTxt = typeof exp === 'string' ? exp : (exp?.text || exp?.description || (exp ? JSON.stringify(exp) : ''))
              return [
                String(idx + 1),
                normalizePdfText(String(desc)),
                normalizePdfText(String(expTxt)),
                '',
                '',
              ]
            })
          : [['', 'N/A', '', '', '']]

        if (pc.latestResult?.status) {
          rows.push(['', 'Overall Result', '', '', pc.latestResult.status])
        }

        const resultRowIdx = pc.latestResult?.status ? rows.length - 1 : -1
        docAutoTable({
          startY: y + 4,
          head: [['No', 'Description', 'Expected Result', 'Value', 'Pass/Fail']],
          body: rows,
          theme: 'striped',
          margin: { left: m, right: m },
          headStyles: { fillColor: AUTH_TABLE_HEAD_BG, textColor: AUTH_TABLE_HEAD_FG, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: AUTH_TABLE_ALT_ROW },
          styles: { fontSize: AUTH_FONT_TABLE, cellPadding: 3, overflow: 'linebreak', lineColor: AUTH_TABLE_BORDER, lineWidth: 0.1 },
          columnStyles: {
            0: { cellWidth: Math.round(procColWidths * 0.06) },
            1: { cellWidth: Math.round(procColWidths * 0.38) },
            2: { cellWidth: Math.round(procColWidths * 0.30) },
            3: { cellWidth: Math.round(procColWidths * 0.13) },
            4: { cellWidth: Math.round(procColWidths * 0.13) },
          },
          willDrawCell: (data: any) => {
            if (data.section === 'body' && data.row.index === resultRowIdx) {
              data.cell.styles.fontStyle = 'bold'
              if (data.column.index === 4 && pc.latestResult?.status) {
                const col = getStatusColor(pc.latestResult.status)
                data.cell.styles.textColor = col
              }
            }
          },
        })

        let y2 = getLastAutoTableY() + 10
        const runCustomBlock = (title: string, body: string) => {
          if (y2 > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage()
            y2 = 24
          }
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(AUTH_FONT_H3)
          doc.setTextColor(0, 0, 0)
          doc.text(normalizePdfText(title), m, y2)
          y2 += 7
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(AUTH_FONT_BODY)
          const lines = doc.splitTextToSize(normalizePdfText(body || ''), contentW)
          for (const line of lines) {
            if (y2 > doc.internal.pageSize.getHeight() - 16) {
              doc.addPage()
              y2 = 24
            }
            doc.text(line, m, y2)
            y2 += 5.5
          }
          y2 += 6
        }

        const sortedCs = [...(tc.customSections || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        for (const cs of sortedCs) {
          runCustomBlock(cs.title || 'Additional section', stringifyCustomSectionContent(cs.content))
          for (const im of cs.images || []) {
            const url = im?.fileUrl
            if (!url) continue
            const img = await fetchAsDataUrl(String(url))
            if (!img?.dataUrl) continue
            if (y2 > doc.internal.pageSize.getHeight() - 100) {
              doc.addPage()
              y2 = 24
            }
            const maxW = contentW
            const maxH = 72
            const fmt = img.mime.includes('jpeg') || img.mime.includes('jpg') ? 'JPEG' : 'PNG'
            doc.setFont('helvetica', 'italic')
            doc.setFontSize(AUTH_FONT_HEADER)
            doc.text(im.fileName || 'Image', m, y2)
            y2 += 4
            try {
              ;(doc as any).addImage(img.dataUrl, fmt, m, y2, maxW, maxH)
              y2 += maxH + 8
            } catch {
              runCustomBlock('Image', String(url))
            }
          }
        }
      }
    }

    const addSignaturesPage = (r: TestPlanReport) => {
      doc.addPage()
      const m = AUTH_MARGIN
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H2)
      doc.text('Signatures', m, 24)

      const sigRows = [
        ['Prepared by', r.testPlan?.docPreparedByName || '', '', ''],
        ['QA Review', r.testPlan?.docQaByName || '', '', ''],
        ['Approved by', r.testPlan?.docApprovedByName || '', '', r.testPlan?.docApprovedAt ? formatDate(r.testPlan.docApprovedAt) : ''],
      ]

      docAutoTable({
        startY: 34,
        head: [['Role', 'Printed Name', 'Signature', 'Date']],
        body: sigRows,
        theme: 'plain',
        margin: { left: m, right: m },
        headStyles: { fillColor: AUTH_TABLE_HEAD_BG, textColor: AUTH_TABLE_HEAD_FG, fontStyle: 'bold' },
        styles: { fontSize: AUTH_FONT_BODY, cellPadding: 6, overflow: 'linebreak', lineColor: AUTH_TABLE_BORDER, lineWidth: 0.2, minCellHeight: 18 },
        columnStyles: {
          0: { cellWidth: 30, fontStyle: 'bold' },
          1: { cellWidth: 45 },
          2: { cellWidth: 50 },
          3: { cellWidth: 35 },
        },
      })
    }

    // Structured Test Plan PDF export (reference-like)
    if (exportType === 'test-plans') {
      const reports = await fetchDetailedReports()
      if (!reports.length) throw new Error('No report data available')

      let companyName = ''
      let pdfProjectName = ''
      try {
        const projRes = await fetch(`/api/projects/${projectId}`)
        if (projRes.ok) {
          const projData = await projRes.json()
          const d = projData?.data || projData
          companyName = d?.companyName || ''
          pdfProjectName = d?.name || ''
        }
      } catch { /* non-critical */ }

      // Multi-plan export supported: append “document blocks”
      for (let i = 0; i < reports.length; i++) {
        const r = reports[i] as TestPlanReport
        if (i > 0) doc.addPage()

        const { confidentiality, docNumber, revision, docTitle } = addCoverPage(r, companyName, r.statistics, pdfProjectName)
        const tocEntries: Array<{ title: string; page: number; level?: number }> = []

        addSignaturesPage(r)
        tocEntries.push({ title: 'Signatures', page: doc.getNumberOfPages(), level: 1 })

        addRevisionControl(r)
        tocEntries.push({ title: 'Revision Control', page: doc.getNumberOfPages(), level: 1 })

        addTOCPage()
        const tocPageNumber = doc.getNumberOfPages()

        let secNum = 0
        const addNumbered = (title: string, body?: string) => {
          secNum++
          const numbered = `${secNum}. ${title}`
          addSimpleSectionPage(numbered, body)
          tocEntries.push({ title: numbered, page: doc.getNumberOfPages(), level: 1 })
        }
        const addSubSection = (parent: number, sub: number, title: string, body?: string) => {
          const numbered = `${parent}.${sub} ${title}`
          addSimpleSectionPage(numbered, body)
          tocEntries.push({ title: numbered, page: doc.getNumberOfPages(), level: 2 })
        }

        secNum++
        addSimpleSectionPage(`${secNum}. Introduction`, '')
        tocEntries.push({ title: `${secNum}. Introduction`, page: doc.getNumberOfPages(), level: 1 })
        const introNum = secNum
        addSubSection(introNum, 1, 'Purpose', r.testPlan?.docPurpose || r.testPlan?.description || '')
        addSubSection(introNum, 2, 'Overview', r.testPlan?.docOverview || r.testPlan?.scope || '')
        addSubSection(introNum, 3, 'Acronyms & Abbreviations', r.testPlan?.docAcronymsNote || '')
        addSubSection(
          introNum,
          4,
          'Applicable Documents',
          Array.isArray(r.testPlan?.docApplicableDocuments)
            ? (r.testPlan?.docApplicableDocuments as any[])
                .map((d) => {
                  const parts = [d?.title || '']
                  if (d?.revision) parts.push(`Rev ${d.revision}`)
                  if (d?.date) parts.push(d.date)
                  if (d?.publisher) parts.push(d.publisher)
                  return `- ${parts.join(' | ')}`
                })
                .join('\n')
            : ''
        )

        addNumbered('Statement of Conformity', r.testPlan?.docStatementOfConformity || '')
        addNumbered('Changes', r.testPlan?.docChangesPolicy || '')
        addNumbered('Distribution', r.testPlan?.docDistribution || '')
        addNumbered('General Notes and Precautions', r.testPlan?.docGeneralPrecautions || '')

        if (r.statistics) {
          secNum++
          const statsTitle = `${secNum}. Summary of Results`
          doc.addPage()
          const statsM = AUTH_MARGIN
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(AUTH_FONT_H2)
          doc.text(statsTitle, statsM, 24)

          const statsRows = [
            ['Total Cases', (r.statistics.totalCases || 0).toString()],
            ['Executed', (r.statistics.executed || 0).toString()],
            ['Passed', (r.statistics.passed || 0).toString()],
            ['Failed', (r.statistics.failed || 0).toString()],
            ['Coverage', `${r.statistics.coveragePercentage || 0}%`],
          ]

          docAutoTable({
            startY: 34,
            head: [['Metric', 'Value']],
            body: statsRows,
            theme: 'striped',
            margin: { left: statsM, right: statsM },
            headStyles: { fillColor: AUTH_TABLE_HEAD_BG, textColor: AUTH_TABLE_HEAD_FG, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: AUTH_TABLE_ALT_ROW },
            styles: { fontSize: AUTH_FONT_TABLE, cellPadding: 3, overflow: 'linebreak', lineColor: AUTH_TABLE_BORDER, lineWidth: 0.1 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
            willDrawCell: (data: any) => {
              if (data.section === 'body' && data.column.index === 1) {
                const label = statsRows[data.row.index]?.[0]
                if (label === 'Passed') {
                  data.cell.styles.textColor = [34, 197, 94]
                  data.cell.styles.fontStyle = 'bold'
                } else if (label === 'Failed') {
                  data.cell.styles.textColor = [239, 68, 68]
                  data.cell.styles.fontStyle = 'bold'
                }
              }
            },
          })

          tocEntries.push({ title: statsTitle, page: doc.getNumberOfPages(), level: 1 })
        }

        const planVer = r.verifiesElements || []
        if (planVer.length) {
          addNumbered(
            'Plan Verification Scope',
            planVer.map((v) => `- [${v.type || 'item'}] ${(v.id || '').toString()} ${v.name || ''}`.trim()).join('\n')
          )
        }

        secNum++
        await addToolsAndSetup(r)
        tocEntries.push({ title: `${secNum}. General Conditions / Tools / Test Setup`, page: doc.getNumberOfPages(), level: 1 })

        secNum++
        const testCaseSecNum = secNum
        const chapterStartPage = doc.getNumberOfPages() + 1
        if (r.testCases?.length) {
          tocEntries.push({ title: `${secNum}. Test Cases`, page: chapterStartPage, level: 1 })
        }
        await addPerTestCaseChapters(r, tocEntries, testCaseSecNum)

        const appendices = Array.isArray(r.testPlan?.docAppendices) ? r.testPlan!.docAppendices! : []
        if (appendices.length) {
          secNum++
          const appxTitle = `${secNum}. Appendices`
          doc.addPage()
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(AUTH_FONT_H2)
          doc.text(appxTitle, AUTH_MARGIN, 24)
          tocEntries.push({ title: appxTitle, page: doc.getNumberOfPages(), level: 1 })

          for (let aIdx = 0; aIdx < appendices.length; aIdx++) {
            const appx = appendices[aIdx]
            const appxLabel = `${secNum}.${aIdx + 1} ${appx.title || 'Appendix'}`
            addSimpleSectionPage(appxLabel, appx.content || '')
            tocEntries.push({ title: appxLabel, page: doc.getNumberOfPages(), level: 2 })
          }
        }

        fillTOCPage(tocPageNumber, tocEntries)
        drawHeaderFooterAllPages({ confidentiality, docNumber, revision, docTitle })
      }

      const ts = format(new Date(), 'yyyy-MM-dd_HHmm')
      const filename = `Test_Plans_Export_${projectId}_${ts}.pdf`
      doc.save(filename)
      return
    }

    // Structured Test Case PDF export (authority-grade)
    if (exportType === 'test-cases') {
      const reports = includeDetails ? await fetchDetailedReports() : []
      const m = AUTH_MARGIN
      const authTableOpts = {
        headStyles: { fillColor: AUTH_TABLE_HEAD_BG, textColor: AUTH_TABLE_HEAD_FG, fontStyle: 'bold' as const },
        alternateRowStyles: { fillColor: AUTH_TABLE_ALT_ROW },
        styles: { fontSize: AUTH_FONT_TABLE, cellPadding: 3, overflow: 'linebreak' as const, lineColor: AUTH_TABLE_BORDER, lineWidth: 0.1 },
        margin: { left: m, right: m },
      }
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      const contentW = w - 2 * m

      let tcProjectName = ''
      let tcCompanyName = ''
      try {
        const projRes = await fetch(`/api/projects/${projectId}`)
        if (projRes.ok) {
          const projData = await projRes.json()
          const d = projData?.data || projData
          tcCompanyName = d?.companyName || ''
          tcProjectName = d?.name || ''
        }
      } catch { /* non-critical */ }

      const isSingle = selectedItemsList.length === 1
      const coverTitle = isSingle
        ? `${selectedItemsList[0].key || 'TC'}: ${selectedItemsList[0].title || 'Test Case'}`
        : 'Test Cases Export'

      // Cover page
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(AUTH_FONT_H3)
      doc.text('INTERNAL', w / 2, 20, { align: 'center' })
      doc.setDrawColor(180)
      doc.setLineWidth(0.4)
      doc.line(m, 25, w - m, 25)

      let yC = 50
      if (tcProjectName) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_H3)
        doc.text(tcProjectName, w / 2, yC, { align: 'center' })
        yC += 8
      }
      if (tcCompanyName) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(AUTH_FONT_BODY)
        doc.text(tcCompanyName, w / 2, yC, { align: 'center' })
        yC += 12
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('TEST CASE REPORT', w / 2, yC + 10, { align: 'center' })

      doc.setFontSize(AUTH_FONT_H1)
      const coverLines = doc.splitTextToSize(coverTitle, contentW)
      doc.text(coverLines, w / 2, yC + 28, { align: 'center' })

      const afterCover = yC + 28 + coverLines.length * 8
      doc.setDrawColor(180)
      doc.line(m + 30, afterCover + 4, w - m - 30, afterCover + 4)

      let yMeta = afterCover + 16
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(AUTH_FONT_BODY)
      const coverMeta = [
        ['Generated', formatDate(new Date())],
        ['Total Test Cases', selectedItemsList.length.toString()],
      ]
      for (const [label, val] of coverMeta) {
        doc.setFont('helvetica', 'bold')
        doc.text(`${label}:`, w / 2 - 2, yMeta, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        doc.text(val, w / 2 + 2, yMeta)
        yMeta += 7
      }

      doc.setDrawColor(180)
      doc.line(m, h - 30, w - m, h - 30)
      doc.setFontSize(AUTH_FONT_HEADER)
      doc.text(`Generated: ${formatDate(new Date())}`, m, h - 22)

      // TOC page
      addTOCPage()
      const tcTocPageNumber = doc.getNumberOfPages()
      const tcTocEntries: Array<{ title: string; page: number; level?: number }> = []

      if (includeDetails && reports.length) {
        let caseNum = 0
        for (let i = 0; i < reports.length; i++) {
          const r = reports[i] as TestCaseReport
          const tc = r.testCase || {}
          caseNum++
          const caseLabel = `${caseNum}. ${tc.key || 'TC'}: ${tc.title || 'Test Case'}`

          doc.addPage()
          tcTocEntries.push({ title: caseLabel, page: doc.getNumberOfPages(), level: 1 })

          let yTc = 24
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(AUTH_FONT_H2)
          doc.text(caseLabel, m, yTc)
          yTc += 10

          // Status badge
          const tcStatus = tc.status || 'N/A'
          const statusClr = getStatusColor(tcStatus)
          doc.setFillColor(statusClr[0], statusClr[1], statusClr[2])
          doc.roundedRect(m, yTc - 3, 30, 7, 1, 1, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(AUTH_FONT_TABLE)
          doc.setTextColor(255, 255, 255)
          doc.text(tcStatus.toUpperCase(), m + 15, yTc + 1.5, { align: 'center' })
          doc.setTextColor(0, 0, 0)
          yTc += 12

          // Details table
          const detailRows = [
            ['Key', tc.key || 'N/A'],
            ['Title', tc.title || 'N/A'],
            ['Version', tc.version || 'N/A'],
            ['Objective', tc.objective || 'N/A'],
            ['MoC', tc.moc?.name || 'N/A'],
            ['Method', tc.method?.name || 'N/A'],
          ]

          docAutoTable({
            startY: yTc,
            head: [],
            body: detailRows,
            theme: 'plain',
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: contentW - 35 } },
            ...authTableOpts,
          })
          yTc = getLastAutoTableY() + 10

          // Preconditions
          if (tc.preconditions) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            doc.text(`${caseNum}.1 Preconditions`, m, yTc)
            tcTocEntries.push({ title: `${caseNum}.1 Preconditions`, page: doc.getNumberOfPages(), level: 2 })
            yTc += 7
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(AUTH_FONT_BODY)
            const preLines = wrapText(normalizePdfText(tc.preconditions), contentW)
            for (const line of preLines) {
              if (yTc > h - 20) { doc.addPage(); yTc = 24 }
              doc.text(line, m, yTc)
              yTc += 5.5
            }
            yTc += 6
          }

          // Test Procedure table (steps + expected results)
          const steps = Array.isArray(tc.steps) ? (tc.steps as any[]) : []
          const expectedResults = Array.isArray(tc.expectedResults) ? (tc.expectedResults as any[]) : []
          if (steps.length) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            const procLabel = `${caseNum}.2 Test Procedure`
            doc.text(procLabel, m, yTc)
            tcTocEntries.push({ title: procLabel, page: doc.getNumberOfPages(), level: 2 })
            yTc += 4

            const procData = steps.map((s: any, idx: number) => {
              const desc = typeof s === 'string' ? s : (s?.text || s?.description || JSON.stringify(s))
              const exp = expectedResults[idx]
              const expTxt = typeof exp === 'string' ? exp : (exp?.text || exp?.description || (exp ? JSON.stringify(exp) : ''))
              return [String(idx + 1), normalizePdfText(String(desc)), normalizePdfText(String(expTxt)), '', '']
            })

            docAutoTable({
              startY: yTc,
              head: [['No', 'Description', 'Expected Result', 'Value', 'Pass/Fail']],
              body: procData,
              theme: 'striped',
              ...authTableOpts,
              columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 50 },
                2: { cellWidth: 45 },
                3: { cellWidth: 25 },
                4: { cellWidth: 25 },
              },
            })
            yTc = getLastAutoTableY() + 10
          }

          // Pass/Fail Criteria
          if (tc.passFailCriteria) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            const pfLabel = `${caseNum}.3 Pass/Fail Criteria`
            doc.text(pfLabel, m, yTc)
            tcTocEntries.push({ title: pfLabel, page: doc.getNumberOfPages(), level: 2 })
            yTc += 7
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(AUTH_FONT_BODY)
            const pfLines = wrapText(normalizePdfText(tc.passFailCriteria), contentW)
            for (const line of pfLines) {
              if (yTc > h - 20) { doc.addPage(); yTc = 24 }
              doc.text(line, m, yTc)
              yTc += 5.5
            }
            yTc += 6
          }

          // Verifies Elements
          const verifies = r.verifiesElements || []
          if (verifies.length) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            const verLabel = `${caseNum}.4 Requirements Verified`
            doc.text(verLabel, m, yTc)
            tcTocEntries.push({ title: verLabel, page: doc.getNumberOfPages(), level: 2 })
            yTc += 4

            const verRows = verifies.map((v) => [
              (v.type || 'item').toUpperCase(),
              (v.id || '').toString(),
              v.name || '',
            ])

            docAutoTable({
              startY: yTc,
              head: [['Type', 'ID', 'Name']],
              body: verRows,
              theme: 'striped',
              ...authTableOpts,
            })
            yTc = getLastAutoTableY() + 10
          }

          // Test Setups
          const setups = tc.setups || []
          if (setups.length) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            doc.text('Linked Test Setups', m, yTc)
            yTc += 4

            const setupRows = setups.map((s) => [
              s.name || 'N/A',
              s.environmentType || 'N/A',
            ])

            docAutoTable({
              startY: yTc,
              head: [['Setup Name', 'Environment Type']],
              body: setupRows,
              theme: 'striped',
              ...authTableOpts,
            })
            yTc = getLastAutoTableY() + 10
          }

          // Custom Sections
          const customSections = [...(r.customSections || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          for (const cs of customSections) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            doc.text(cs.title || 'Additional Section', m, yTc)
            yTc += 7
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(AUTH_FONT_BODY)
            const csText = stringifyCustomSectionContent(cs.content)
            const csLines = wrapText(normalizePdfText(csText || 'N/A'), contentW)
            for (const line of csLines) {
              if (yTc > h - 20) { doc.addPage(); yTc = 24 }
              doc.text(line, m, yTc)
              yTc += 5.5
            }

            for (const im of cs.images || []) {
              const imgUrl = im?.fileUrl
              if (imgUrl) {
                const imgData = await fetchAsDataUrl(String(imgUrl))
                if (imgData?.dataUrl) {
                  if (yTc > h - 80) { doc.addPage(); yTc = 24 }
                  const maxImgW = contentW
                  const maxImgH = 80
                  const ratio = Math.min(maxImgW / (imgData.width || maxImgW), maxImgH / (imgData.height || maxImgH))
                  const imgW = (imgData.width || maxImgW) * ratio
                  const imgH = (imgData.height || maxImgH) * ratio
                  doc.addImage(imgData.dataUrl, 'PNG', m, yTc, imgW, imgH)
                  yTc += imgH + 6
                }
              }
            }
            yTc += 4
          }

          // Linked Test Results
          const testResults = r.testResults || []
          if (testResults.length) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            const trLabel = `${caseNum}.5 Linked Test Results`
            doc.text(trLabel, m, yTc)
            tcTocEntries.push({ title: trLabel, page: doc.getNumberOfPages(), level: 2 })
            yTc += 4

            const trRows = testResults.map((tr) => {
              const statusC = getStatusColor(tr.resultStatus || '')
              return [
                tr.title || 'N/A',
                tr.resultStatus || 'N/A',
                tr.executedByName || 'N/A',
                formatDate(tr.executedAt),
              ]
            })

            docAutoTable({
              startY: yTc,
              head: [['Title', 'Status', 'Executed By', 'Date']],
              body: trRows,
              theme: 'striped',
              ...authTableOpts,
              willDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 1) {
                  const statusVal = testResults[data.row.index]?.resultStatus || ''
                  data.cell.styles.textColor = getStatusColor(statusVal)
                  data.cell.styles.fontStyle = 'bold'
                }
              },
            })
            yTc = getLastAutoTableY() + 10
          }

          // Execution History
          const execHistory = r.executionHistory || []
          if (execHistory.length) {
            if (yTc > h - 40) { doc.addPage(); yTc = 24 }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(AUTH_FONT_H3)
            const ehLabel = `${caseNum}.6 Execution History`
            doc.text(ehLabel, m, yTc)
            tcTocEntries.push({ title: ehLabel, page: doc.getNumberOfPages(), level: 2 })
            yTc += 4

            const ehRows = execHistory.map((eh) => [
              eh.status || 'N/A',
              formatDate(eh.executedAt),
              normalizePdfText(eh.actualResults || ''),
              normalizePdfText(eh.notes || ''),
            ])

            docAutoTable({
              startY: yTc,
              head: [['Status', 'Executed At', 'Actual Results', 'Notes']],
              body: ehRows,
              theme: 'striped',
              ...authTableOpts,
              willDrawCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 0) {
                  const statusVal = execHistory[data.row.index]?.status || ''
                  data.cell.styles.textColor = getStatusColor(statusVal)
                  data.cell.styles.fontStyle = 'bold'
                }
              },
            })
          }
        }
      } else {
        // Summary-only: single table listing selected test cases
        doc.addPage()
        tcTocEntries.push({ title: 'Test Cases Summary', page: doc.getNumberOfPages(), level: 1 })

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(AUTH_FONT_H2)
        doc.text('Test Cases Summary', m, 24)

        const summaryData = selectedItemsList.map((tc) => [
          tc.key || 'N/A',
          tc.title || 'N/A',
          tc.status || 'N/A',
          tc.moc?.name || 'N/A',
          (tc.linkedTestResultsCount || 0).toString(),
        ])

        docAutoTable({
          startY: 34,
          head: [['Key', 'Title', 'Status', 'MoC', 'Results']],
          body: summaryData,
          theme: 'striped',
          ...authTableOpts,
        })
      }

      fillTOCPage(tcTocPageNumber, tcTocEntries)
      drawHeaderFooterAllPages({ docTitle: 'TEST CASE REPORT' })

      const ts = format(new Date(), 'yyyy-MM-dd_HHmm')
      const filename = `Test_Cases_Export_${projectId}_${ts}.pdf`
      doc.save(filename)
      return
    }
  }

  const exportToCSV = async () => {
    const rows: string[][] = []

    if (includeDetails) {
      const reports = await fetchDetailedReports()

      if (exportType === 'test-cases') {
        rows.push(['Key', 'Title', 'Status', 'Version', 'Objective', 'Preconditions', 'Steps', 'Expected Results', 'Test Results Count', 'Test Results'])

        reports.forEach((report) => {
          const r = report as TestCaseReport
          const tc = r.testCase!
          const stepsStr = Array.isArray(tc.steps) ? tc.steps.join('; ') : String(tc.steps ?? '')
          const expectedStr = Array.isArray(tc.expectedResults) ? tc.expectedResults.join('; ') : String(tc.expectedResults ?? '')
          const testResultsStr = r.testResults?.map((tr: any) => `${tr.title} (${tr.resultStatus})`).join('; ') || ''

          rows.push([
            tc.key || '',
            tc.title || '',
            tc.status || '',
            tc.version || '',
            tc.objective || '',
            tc.preconditions || '',
            stepsStr,
            expectedStr,
            (r.testResults?.length || 0).toString(),
            testResultsStr,
          ])
        })
      } else {
        rows.push(['Key', 'Name', 'Status', 'Phase', 'Description', 'Scope', 'Total Cases', 'Executed', 'Passed', 'Failed', 'Coverage', 'Test Results Count', 'Test Results'])

        reports.forEach((report) => {
          const r = report as TestPlanReport
          const tp = r.testPlan!
          const stats = r.statistics || {}
          const testResultsStr = r.testResults?.map((tr: any) => `${tr.title} (${tr.resultStatus})`).join('; ') || ''

          rows.push([
            tp.key || '',
            tp.name || '',
            tp.status || '',
            tp.phase || '',
            tp.description || '',
            tp.scope || '',
            (stats.totalCases || 0).toString(),
            (stats.executed || 0).toString(),
            (stats.passed || 0).toString(),
            (stats.failed || 0).toString(),
            `${stats.coveragePercentage || 0}%`,
            (r.testResults?.length || 0).toString(),
            testResultsStr,
          ])
        })
      }
    } else {
      if (exportType === 'test-cases') {
        rows.push(['Key', 'Title', 'Status', 'MoC', 'Method', 'Results Count'])
        selectedItemsList.forEach((tc) => {
          rows.push([
            tc.key || '',
            tc.title || '',
            tc.status || '',
            tc.moc?.name || '',
            tc.method?.name || '',
            (tc.linkedTestResultsCount || 0).toString(),
          ])
        })
      } else {
        rows.push(['Key', 'Name', 'Status', 'Phase', 'Cases Count', 'Results Count'])
        selectedItemsList.forEach((tp) => {
          rows.push([
            tp.key || '',
            tp.name || '',
            tp.status || '',
            tp.phase || '',
            (tp.planCases?.length || 0).toString(),
            (tp.linkedTestResultsCount || 0).toString(),
          ])
        })
      }
    }

    const csvContent = rows
      .map((row) =>
        row
          .map((cell) => {
            const escaped = String(cell).replace(/"/g, '""')
            return `"${escaped}"`
          })
          .join(',')
      )
      .join('\n')

    const tsCsv = format(new Date(), 'yyyy-MM-dd_HHmm')
    const filename = `${exportType === 'test-cases' ? 'Test_Cases' : 'Test_Plans'}_Export_${tsCsv}.csv`
    downloadFile(csvContent, filename, 'text/csv')
  }

  const exportToJSON = async () => {
    let data: any

    if (includeDetails) {
      data = await fetchDetailedReports()
    } else {
      data = selectedItemsList.map((item) => ({
        ...item,
        // Remove circular references or unnecessary data
        planCases: exportType === 'test-plans' ? item.planCases?.length : undefined,
      }))
    }

    const jsonContent = JSON.stringify({ exportedAt: new Date().toISOString(), type: exportType, count: data.length, data }, null, 2)
    const tsJson = format(new Date(), 'yyyy-MM-dd_HHmm')
    const filename = `${exportType === 'test-cases' ? 'Test_Cases' : 'Test_Plans'}_Export_${tsJson}.json`
    downloadFile(jsonContent, filename, 'application/json')
  }

  const exportToWord = async () => {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, Packer, Header, Footer, PageNumber, TabStopType, TabStopPosition, ImageRun } = await loadDocx()

    const children: any[] = []
    const pageWidthTwips = 12240
    const marginTwips = 1440
    const usableWidthTwips = pageWidthTwips - 2 * marginTwips

    const createParagraph = (
      text: string,
      options: { bold?: boolean; size?: number; heading?: any; pageBreakBefore?: boolean; color?: string } = {}
    ) => {
      return new Paragraph({
        heading: options.heading,
        pageBreakBefore: options.pageBreakBefore,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: text || '',
            bold: options.bold,
            size: options.size || 22,
            color: options.color,
          }),
        ],
      })
    }

    const createTable = (headers: string[], rows: string[][]) => {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: headers.map(
              (header) =>
                new TableCell({
                  children: [createParagraph(header, { bold: true, color: 'FFFFFF', size: 18 })],
                  shading: { fill: '374151' },
                })
            ),
          }),
          ...rows.map(
            (row, rIdx) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [createParagraph(cell, { size: 18 })],
                      shading: rIdx % 2 === 1 ? { fill: 'F9FAFB' } : undefined,
                    })
                ),
              })
          ),
        ],
      })
    }

    const fetchImageBuffer = async (url: string): Promise<ArrayBuffer | null> => {
      try {
        const resolved = url.startsWith('/') ? `${window.location.origin}${url}` : url
        const res = await fetch(resolved)
        if (!res.ok) return null
        return await res.arrayBuffer()
      } catch { return null }
    }

    const createImageParagraph = (buffer: ArrayBuffer, fileName: string) => {
      try {
        return new Paragraph({
          children: [
            new ImageRun({
              data: buffer,
              transformation: { width: 500, height: 350 },
              altText: { title: fileName, description: fileName, name: fileName },
            }),
          ],
        })
      } catch { return null }
    }

    // Title
    children.push(
      createParagraph(
        exportType === 'test-cases' ? 'Test Cases Export' : 'Test Plans Export',
        { heading: HeadingLevel.HEADING_1, size: 34 }
      )
    )
    children.push(createParagraph(`Generated: ${formatDate(new Date())}`, { size: 18 }))
    children.push(createParagraph(`Total Items: ${selectedItemsList.length}`, { size: 18 }))
    children.push(createParagraph(''))

    let wordCompanyName = ''
    let wordProjectName = ''
    try {
      const projRes = await fetch(`/api/projects/${projectId}`)
      if (projRes.ok) {
        const projData = await projRes.json()
        const d = projData?.data || projData
        wordCompanyName = d?.companyName || ''
        wordProjectName = d?.name || ''
      }
    } catch { /* non-critical */ }

    let wordDocConfidentiality = ''
    let wordDocTitleForHeader = ''
    let wordDocNumberForHeader = ''
    let wordRevisionForHeader = ''

    if (includeDetails) {
      const reports = await fetchDetailedReports()

      if (exportType === 'test-cases') {
        // Authority-grade Word test-case cover page
        wordDocTitleForHeader = 'TEST CASE REPORT'

        const isSingle = reports.length === 1
        const coverCaseTitle = isSingle
          ? `${(reports[0] as TestCaseReport).testCase?.key || 'TC'}: ${(reports[0] as TestCaseReport).testCase?.title || 'Test Case'}`
          : 'Test Cases Export'

        children.push(createParagraph('INTERNAL', { bold: true, size: 22, pageBreakBefore: true }))
        if (wordProjectName) children.push(createParagraph(wordProjectName, { bold: true, size: 24 }))
        if (wordCompanyName) children.push(createParagraph(wordCompanyName, { size: 20 }))
        children.push(createParagraph('TEST CASE REPORT', { heading: HeadingLevel.HEADING_1, size: 40 }))
        children.push(createParagraph(coverCaseTitle, { heading: HeadingLevel.HEADING_2, size: 30 }))
        children.push(createParagraph(''))
        children.push(createParagraph(`Generated: ${formatDate(new Date())}`))
        children.push(createParagraph(`Total Test Cases: ${reports.length}`))
        children.push(createParagraph(''))

        // Build TOC entries
        type WordTcTocEntry = { title: string; level: number }
        const wordTcTocEntries: WordTcTocEntry[] = []
        let wordTcCaseNum = 0
        for (const report of reports) {
          const r = report as TestCaseReport
          const tc = r.testCase || {}
          wordTcCaseNum++
          const caseLabel = `${wordTcCaseNum}. ${tc.key || 'TC'}: ${tc.title || 'Test Case'}`
          wordTcTocEntries.push({ title: caseLabel, level: 1 })
          if (tc.preconditions) wordTcTocEntries.push({ title: `${wordTcCaseNum}.1 Preconditions`, level: 2 })
          const steps = Array.isArray(tc.steps) ? tc.steps : []
          if (steps.length) wordTcTocEntries.push({ title: `${wordTcCaseNum}.2 Test Procedure`, level: 2 })
          if (tc.passFailCriteria) wordTcTocEntries.push({ title: `${wordTcCaseNum}.3 Pass/Fail Criteria`, level: 2 })
          if ((r.verifiesElements || []).length) wordTcTocEntries.push({ title: `${wordTcCaseNum}.4 Requirements Verified`, level: 2 })
          if ((r.testResults || []).length) wordTcTocEntries.push({ title: `${wordTcCaseNum}.5 Linked Test Results`, level: 2 })
          if ((r.executionHistory || []).length) wordTcTocEntries.push({ title: `${wordTcCaseNum}.6 Execution History`, level: 2 })
        }

        // Render TOC with dot leaders
        children.push(createParagraph('Table of Contents', { heading: HeadingLevel.HEADING_2, size: 28 }))
        for (const tocE of wordTcTocEntries) {
          const isSub = tocE.level >= 2
          children.push(new Paragraph({
            indent: isSub ? { left: 400 } : undefined,
            spacing: { after: isSub ? 30 : 50 },
            tabStops: [
              { type: TabStopType?.RIGHT || 'right', position: usableWidthTwips, leader: 'dot' },
            ],
            children: [
              new TextRun({
                text: tocE.title + '\t',
                size: isSub ? 18 : 20,
                bold: !isSub,
                color: isSub ? '6B7280' : '111827',
              }),
            ],
          }))
        }
        children.push(createParagraph(''))

        // Per-case chapters
        let wordCaseNum = 0
        for (const report of reports) {
          const r = report as TestCaseReport
          const tc = r.testCase || {}
          wordCaseNum++
          const caseLabel = `${wordCaseNum}. ${tc.key || 'TC'}: ${tc.title || 'Test Case'}`

          children.push(createParagraph(caseLabel, { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
          const tcStatus = tc.status || 'N/A'
          children.push(createParagraph(`Status: ${tcStatus}`, { color: rgbToHex(getStatusColor(tcStatus)), bold: true }))
          children.push(createParagraph(''))

          // Details table
          const detailRows = [
            ['Key', tc.key || 'N/A'],
            ['Title', tc.title || 'N/A'],
            ['Version', tc.version || 'N/A'],
            ['Objective', tc.objective || 'N/A'],
            ['MoC', tc.moc?.name || 'N/A'],
            ['Method', tc.method?.name || 'N/A'],
          ]
          children.push(createTable(['Field', 'Value'], detailRows))
          children.push(createParagraph(''))

          // Preconditions
          if (tc.preconditions) {
            children.push(createParagraph(`${wordCaseNum}.1 Preconditions`, { heading: HeadingLevel.HEADING_3, size: 24 }))
            children.push(createParagraph(tc.preconditions))
            children.push(createParagraph(''))
          }

          // Test Procedure
          const steps = Array.isArray(tc.steps) ? (tc.steps as any[]) : []
          const expectedResults = Array.isArray(tc.expectedResults) ? (tc.expectedResults as any[]) : []
          if (steps.length) {
            children.push(createParagraph(`${wordCaseNum}.2 Test Procedure`, { heading: HeadingLevel.HEADING_3, size: 24 }))
            const procRows = steps.map((s: any, idx: number) => {
              const desc = typeof s === 'string' ? s : (s?.text || s?.description || JSON.stringify(s))
              const exp = expectedResults[idx]
              const expTxt = typeof exp === 'string' ? exp : (exp?.text || exp?.description || (exp ? JSON.stringify(exp) : ''))
              return [String(idx + 1), String(desc), String(expTxt), '', '']
            })
            children.push(createTable(['No', 'Description', 'Expected Result', 'Value', 'Pass/Fail'], procRows))
            children.push(createParagraph(''))
          }

          // Pass/Fail Criteria
          if (tc.passFailCriteria) {
            children.push(createParagraph(`${wordCaseNum}.3 Pass/Fail Criteria`, { heading: HeadingLevel.HEADING_3, size: 24 }))
            children.push(createParagraph(tc.passFailCriteria))
            children.push(createParagraph(''))
          }

          // Requirements Verified
          const verifies = r.verifiesElements || []
          if (verifies.length) {
            children.push(createParagraph(`${wordCaseNum}.4 Requirements Verified`, { heading: HeadingLevel.HEADING_3, size: 24 }))
            const verRows = verifies.map((v) => [(v.type || 'item').toUpperCase(), (v.id || '').toString(), v.name || ''])
            children.push(createTable(['Type', 'ID', 'Name'], verRows))
            children.push(createParagraph(''))
          }

          // Test Setups
          const setups = tc.setups || []
          if (setups.length) {
            children.push(createParagraph('Linked Test Setups', { heading: HeadingLevel.HEADING_3, size: 24 }))
            const setupRows = setups.map((s) => [s.name || 'N/A', s.environmentType || 'N/A'])
            children.push(createTable(['Setup Name', 'Environment Type'], setupRows))
            children.push(createParagraph(''))
          }

          // Custom Sections
          const customSections = [...(r.customSections || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
          for (const cs of customSections) {
            children.push(createParagraph(cs.title || 'Additional Section', { heading: HeadingLevel.HEADING_4, size: 22 }))
            children.push(createParagraph(stringifyCustomSectionContent(cs.content) || 'N/A'))
            for (const im of cs.images || []) {
              const u = im?.fileUrl
              if (u) {
                const imgBuf = await fetchImageBuffer(String(u))
                if (imgBuf) {
                  const imgPara = createImageParagraph(imgBuf, im.fileName || 'Image')
                  if (imgPara) { children.push(imgPara); continue }
                }
                children.push(createParagraph(`Image: ${im.fileName || ''} (${String(u)})`))
              }
            }
            children.push(createParagraph(''))
          }

          // Linked Test Results
          const testResults = r.testResults || []
          if (testResults.length) {
            children.push(createParagraph(`${wordCaseNum}.5 Linked Test Results`, { heading: HeadingLevel.HEADING_3, size: 24 }))
            const trRows = testResults.map((tr) => [
              tr.title || 'N/A',
              tr.resultStatus || 'N/A',
              tr.executedByName || 'N/A',
              formatDate(tr.executedAt),
            ])
            children.push(createTable(['Title', 'Status', 'Executed By', 'Date'], trRows))
            children.push(createParagraph(''))
          }

          // Execution History
          const execHistory = r.executionHistory || []
          if (execHistory.length) {
            children.push(createParagraph(`${wordCaseNum}.6 Execution History`, { heading: HeadingLevel.HEADING_3, size: 24 }))
            const ehRows = execHistory.map((eh) => [
              eh.status || 'N/A',
              formatDate(eh.executedAt),
              eh.actualResults || '',
              eh.notes || '',
            ])
            children.push(createTable(['Status', 'Executed At', 'Actual Results', 'Notes'], ehRows))
            children.push(createParagraph(''))
          }
        }
      }

      for (const report of reports) {
        if (exportType === 'test-cases') {
          // Already handled above
        } else {
          const r = report as TestPlanReport
          const tp = r.testPlan!

          const docNumber = tp.docNumber || tp.key || ''
          const confidentiality = tp.docConfidentiality || 'INTERNAL'
          const revision = tp.docRevision || '1.0'
          const wordDocTitle = tp.name || tp.key || 'Test Plan'

          // Cover-ish header (Word doesn’t have “pages” in the same way; we use page breaks)
          wordDocConfidentiality = confidentiality
          wordDocTitleForHeader = wordDocTitle
          wordDocNumberForHeader = docNumber
          wordRevisionForHeader = revision

          children.push(createParagraph(confidentiality, { bold: true, size: 22, pageBreakBefore: true }))
          if (wordProjectName) children.push(createParagraph(wordProjectName, { bold: true, size: 24 }))
          if (wordCompanyName) children.push(createParagraph(wordCompanyName, { size: 20 }))
          children.push(createParagraph('TEST PLAN', { heading: HeadingLevel.HEADING_1, size: 40 }))
          children.push(createParagraph(wordDocTitle, { heading: HeadingLevel.HEADING_2, size: 30 }))
          children.push(createParagraph(''))
          if (docNumber) children.push(createParagraph(`Document No.: ${docNumber}`))
          if (tp.docProjectCode) children.push(createParagraph(`Project Code: ${tp.docProjectCode}`))
          children.push(createParagraph(`Revision: ${revision}`))
          if (tp.docPlanDate) children.push(createParagraph(`Test Plan from: ${formatDate(tp.docPlanDate)}`))
          children.push(createParagraph(''))

          // Table of contents (manual, styled with dot leaders and indentation)
          children.push(createParagraph('Table of Contents', { heading: HeadingLevel.HEADING_2, size: 28 }))

          type WordTocEntry = { title: string; level: number }
          const wordTocEntries: WordTocEntry[] = [
            { title: 'Signatures', level: 1 },
            { title: 'Revision Control', level: 1 },
          ]
          let tocSecNum = 0
          tocSecNum++
          wordTocEntries.push({ title: `${tocSecNum}. Introduction`, level: 1 })
          wordTocEntries.push(
            { title: `${tocSecNum}.1 Purpose`, level: 2 },
            { title: `${tocSecNum}.2 Overview`, level: 2 },
            { title: `${tocSecNum}.3 Acronyms & Abbreviations`, level: 2 },
            { title: `${tocSecNum}.4 Applicable Documents`, level: 2 },
          )
          tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. Statement of Conformity`, level: 1 })
          tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. Changes`, level: 1 })
          tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. Distribution`, level: 1 })
          tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. General Notes and Precautions`, level: 1 })
          if (r.statistics) { tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. Summary of Results`, level: 1 }) }
          if (r.verifiesElements?.length) { tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. Plan Verification Scope`, level: 1 }) }
          tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. General Conditions / Tools / Test Setup`, level: 1 })
          tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. Test Cases`, level: 1 })
          for (let tcTocIdx = 0; tcTocIdx < (r.testCases || []).length; tcTocIdx++) {
            const tcObj = (r.testCases || [])[tcTocIdx].testCase || {}
            wordTocEntries.push({ title: `${tocSecNum}.${tcTocIdx + 1} ${tcObj.key || 'TC'}: ${tcObj.title || ''}`, level: 2 })
          }
          const wordAppx = Array.isArray(tp.docAppendices) ? tp.docAppendices : []
          if (wordAppx.length) {
            tocSecNum++; wordTocEntries.push({ title: `${tocSecNum}. Appendices`, level: 1 })
            wordAppx.forEach((a, ai) => wordTocEntries.push({ title: `${tocSecNum}.${ai + 1} ${a.title || 'Appendix'}`, level: 2 }))
          }

          for (const tocE of wordTocEntries) {
            const isSub = tocE.level >= 2
            children.push(new Paragraph({
              indent: isSub ? { left: 400 } : undefined,
              spacing: { after: isSub ? 30 : 50 },
              tabStops: [
                { type: TabStopType?.RIGHT || 'right', position: usableWidthTwips, leader: 'dot' },
              ],
              children: [
                new TextRun({
                  text: tocE.title + '\t',
                  size: isSub ? 18 : 20,
                  bold: !isSub,
                  color: isSub ? '6B7280' : '111827',
                }),
              ],
            }))
          }
          children.push(createParagraph(''))

          // Signatures (formal table)
          children.push(createParagraph('Signatures', { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
          const wordSigRows = [
            ['Prepared by', tp.docPreparedByName || '', '', ''],
            ['QA Review', tp.docQaByName || '', '', ''],
            ['Approved by', tp.docApprovedByName || '', '', tp.docApprovedAt ? formatDate(tp.docApprovedAt) : ''],
          ]
          children.push(createTable(['Role', 'Printed Name', 'Signature', 'Date'], wordSigRows))
          children.push(createParagraph(''))

          // Revision Control
          children.push(createParagraph('Revision Control', { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
          const revRows =
            r.revisions && r.revisions.length
              ? r.revisions.map((rev) => [
                  rev.revisionNumber || '',
                  rev.revisionDate ? formatDate(rev.revisionDate) : '',
                  rev.editedByName || '',
                  rev.approvedByName || '',
                  rev.approvedAt ? formatDate(rev.approvedAt) : '',
                  rev.summaryOfChanges || '',
                ])
              : [['', '', '', '', '', 'No revision history']]
          children.push(createTable(['Rev', 'Date', 'Edited by', 'Approved by', 'Approved at', 'Summary of Changes'], revRows))
          children.push(createParagraph(''))

          const addSection = (title: string, body?: string) => {
            children.push(createParagraph(title, { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
            children.push(createParagraph(body || 'N/A'))
            children.push(createParagraph(''))
          }

          let wordSec = 0

          // 1. Introduction with subsections
          wordSec++
          addSection(`${wordSec}. Introduction`, '')
          children.push(createParagraph(`${wordSec}.1 Purpose`, { heading: HeadingLevel.HEADING_3, size: 24 }))
          children.push(createParagraph(tp.docPurpose || tp.description || 'N/A'))
          children.push(createParagraph(''))
          children.push(createParagraph(`${wordSec}.2 Overview`, { heading: HeadingLevel.HEADING_3, size: 24 }))
          children.push(createParagraph(tp.docOverview || tp.scope || 'N/A'))
          children.push(createParagraph(''))
          children.push(createParagraph(`${wordSec}.3 Acronyms & Abbreviations`, { heading: HeadingLevel.HEADING_3, size: 24 }))
          children.push(createParagraph(tp.docAcronymsNote || 'N/A'))
          children.push(createParagraph(''))
          children.push(createParagraph(`${wordSec}.4 Applicable Documents`, { heading: HeadingLevel.HEADING_3, size: 24 }))
          children.push(createParagraph(
            Array.isArray(tp.docApplicableDocuments)
              ? (tp.docApplicableDocuments as any[])
                  .map((d) => {
                    const parts = [d?.title || '']
                    if (d?.revision) parts.push(`Rev ${d.revision}`)
                    if (d?.date) parts.push(d.date)
                    if (d?.publisher) parts.push(d.publisher)
                    return `- ${parts.join(' | ')}`
                  })
                  .join('\n')
              : 'N/A'
          ))
          children.push(createParagraph(''))

          wordSec++
          addSection(`${wordSec}. Statement of Conformity`, tp.docStatementOfConformity || '')
          wordSec++
          addSection(`${wordSec}. Changes`, tp.docChangesPolicy || '')
          wordSec++
          addSection(`${wordSec}. Distribution`, tp.docDistribution || '')
          wordSec++
          addSection(`${wordSec}. General Notes and Precautions`, tp.docGeneralPrecautions || '')

          if (r.statistics) {
            wordSec++
            children.push(createParagraph(`${wordSec}. Summary of Results`, { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
            const wordStatsRows = [
              ['Total Cases', (r.statistics.totalCases || 0).toString()],
              ['Executed', (r.statistics.executed || 0).toString()],
              ['Passed', (r.statistics.passed || 0).toString()],
              ['Failed', (r.statistics.failed || 0).toString()],
              ['Coverage', `${r.statistics.coveragePercentage || 0}%`],
            ]
            children.push(createTable(['Metric', 'Value'], wordStatsRows))
            children.push(createParagraph(''))
          }

          if (r.verifiesElements?.length) {
            wordSec++
            addSection(
              `${wordSec}. Plan Verification Scope`,
              r.verifiesElements.map((v) => `- [${v.type || 'item'}] ${(v.id || '').toString()} ${v.name || ''}`.trim()).join('\n')
            )
          }

          // Tools / Setup
          wordSec++
          children.push(
            createParagraph(`${wordSec}. General Conditions / Tools / Test Setup`, { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true })
          )
          const gcWord = formatDocGeneralConditions(tp.docGeneralConditions)
          if (gcWord.trim()) {
            children.push(createParagraph('General conditions', { heading: HeadingLevel.HEADING_3, size: 24 }))
            children.push(createParagraph(gcWord))
            children.push(createParagraph(''))
          }
          children.push(createParagraph('Tools', { heading: HeadingLevel.HEADING_3, size: 24 }))
          const tools = Array.isArray(tp.docTools) ? (tp.docTools as any[]) : []
          const toolRows = tools.length
            ? tools.map((t) => [t?.name || '', t?.manufacturer || '', t?.partNumber || '', t?.serialNumber || '', t?.calibrationValidTill || ''])
            : [['', '', '', '', '']]
          children.push(createTable(['Tool', 'Manufacturer', 'Part #', 'Serial #', 'Calibration valid till'], toolRows))
          children.push(createParagraph(''))
          children.push(createParagraph('Linked Test Setups', { heading: HeadingLevel.HEADING_3, size: 24 }))
          const setups = r.setups || []
          children.push(createParagraph(setups.length ? setups.map((s) => `- ${s.name || s.id || 'Setup'}`).join('\n') : 'N/A'))
          const primary = setups[0] as any
          const diagramUrl =
            primary?.diagramExportPath ||
            (Array.isArray(primary?.photos) ? primary?.photos?.[0]?.fileUrl || primary?.photos?.[0]?.url : null)
          if (!diagramUrl) {
            children.push(
              createParagraph('No setup diagram file on record. Add a diagram export on the linked test setup.', { size: 20 })
            )
          } else {
            const setupImgBuf = await fetchImageBuffer(String(diagramUrl))
            if (setupImgBuf) {
              const setupImgPara = createImageParagraph(setupImgBuf, 'Setup Diagram')
              if (setupImgPara) {
                children.push(createParagraph('Setup Diagram', { heading: HeadingLevel.HEADING_4, size: 22 }))
                children.push(setupImgPara)
              } else {
                children.push(createParagraph(`Setup Diagram: ${String(diagramUrl)}`))
              }
            } else {
              children.push(createParagraph(`Setup Diagram: ${String(diagramUrl)}`))
            }
          }
          if (tp.docTestSetupNotes) children.push(createParagraph(tp.docTestSetupNotes))
          children.push(createParagraph(''))

          // Per-test-case chapters
          wordSec++
          const wordTestCaseSec = wordSec
          children.push(createParagraph(`${wordSec}. Test Cases`, { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
          const pcs = r.testCases || []
          for (let pcIdx = 0; pcIdx < pcs.length; pcIdx++) {
            const pc = pcs[pcIdx]
            const tc = pc.testCase || {}
            const wordCaseLabel = `${wordTestCaseSec}.${pcIdx + 1} ${tc.key || 'TC'}: ${tc.title || ''}`.trim()
            children.push(createParagraph(wordCaseLabel, { heading: HeadingLevel.HEADING_3, size: 24, pageBreakBefore: true }))
            const wordCaseStatus = pc.latestResult?.status || tc.status || 'N/A'
            children.push(createParagraph(`Status: ${wordCaseStatus}`, { color: rgbToHex(getStatusColor(wordCaseStatus)) }))
            children.push(createParagraph(pc.isMandatory ? 'Mandatory' : 'Optional'))
            children.push(createParagraph(''))

            children.push(createParagraph('Objective', { heading: HeadingLevel.HEADING_4, size: 22 }))
            children.push(createParagraph((tc.objective as any) || 'N/A'))
            children.push(createParagraph(''))

            children.push(createParagraph('Preconditions / Assumptions', { heading: HeadingLevel.HEADING_4, size: 22 }))
            children.push(createParagraph((tc.preconditions as any) || 'N/A'))
            children.push(createParagraph(''))

            children.push(createParagraph('Requirements Verified', { heading: HeadingLevel.HEADING_4, size: 22 }))
            const verifies = (tc.verifiesElements || []).map((v) => `- ${(v.id || '').toString()} ${v.name || ''}`.trim()).filter(Boolean)
            children.push(createParagraph(verifies.length ? verifies.join('\n') : 'N/A'))
            children.push(createParagraph(''))

            if (tc.passFailCriteria) {
              children.push(createParagraph('Expected Outcomes / Pass-Fail Criteria', { heading: HeadingLevel.HEADING_4, size: 22 }))
              children.push(createParagraph(tc.passFailCriteria as any))
              children.push(createParagraph(''))
            }

            const steps = Array.isArray(tc.steps) ? (tc.steps as any[]) : []
            const expected = Array.isArray(tc.expectedResults) ? (tc.expectedResults as any[]) : []
            const procRows = steps.length
              ? steps.map((s, idx) => {
                  const desc = typeof s === 'string' ? s : (s?.text || s?.description || JSON.stringify(s))
                  const exp = expected[idx]
                  const expTxt = typeof exp === 'string' ? exp : (exp?.text || exp?.description || (exp ? JSON.stringify(exp) : ''))
                  return [
                    String(idx + 1),
                    normalizePdfText(String(desc)),
                    normalizePdfText(String(expTxt)),
                    '',
                    '',
                  ]
                })
              : [['', 'N/A', '', '', '']]
            if (pc.latestResult?.status) {
              procRows.push(['', 'Overall Result', '', '', pc.latestResult.status])
            }
            children.push(createParagraph('Test Procedure', { heading: HeadingLevel.HEADING_4, size: 22 }))
            children.push(createTable(['No', 'Description', 'Expected Result', 'Value', 'Pass/Fail'], procRows))
            children.push(createParagraph(''))

            const sortedWordCs = [...(tc.customSections || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            for (const cs of sortedWordCs) {
              children.push(createParagraph(cs.title || 'Additional section', { heading: HeadingLevel.HEADING_4, size: 22 }))
              children.push(createParagraph(stringifyCustomSectionContent(cs.content) || 'N/A'))
              for (const im of cs.images || []) {
                const u = im?.fileUrl
                if (u) {
                  const imgBuf = await fetchImageBuffer(String(u))
                  if (imgBuf) {
                    const imgPara = createImageParagraph(imgBuf, im.fileName || 'Image')
                    if (imgPara) { children.push(imgPara); continue }
                  }
                  children.push(createParagraph(`Image: ${im.fileName || ''} (${String(u)})`))
                }
              }
              children.push(createParagraph(''))
            }
          }

          const wordAppendices = Array.isArray(tp.docAppendices) ? tp.docAppendices : []
          if (wordAppendices.length) {
            wordSec++
            children.push(createParagraph(`${wordSec}. Appendices`, { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
            for (let aIdx = 0; aIdx < wordAppendices.length; aIdx++) {
              const appx = wordAppendices[aIdx]
              children.push(createParagraph(`${wordSec}.${aIdx + 1} ${appx.title || 'Appendix'}`, { heading: HeadingLevel.HEADING_3, size: 24 }))
              children.push(createParagraph(appx.content || 'N/A'))
              children.push(createParagraph(''))
            }
          }
        }
      }
    } else {
      // Summary table
      if (exportType === 'test-cases') {
        wordDocTitleForHeader = 'TEST CASE REPORT'
        children.push(createParagraph('INTERNAL', { bold: true, size: 22, pageBreakBefore: true }))
        if (wordProjectName) children.push(createParagraph(wordProjectName, { bold: true, size: 24 }))
        if (wordCompanyName) children.push(createParagraph(wordCompanyName, { size: 20 }))
        children.push(createParagraph('TEST CASE REPORT', { heading: HeadingLevel.HEADING_1, size: 40 }))
        children.push(createParagraph('Test Cases Summary', { heading: HeadingLevel.HEADING_2, size: 30 }))
        children.push(createParagraph(''))
        children.push(createParagraph(`Generated: ${formatDate(new Date())}`))
        children.push(createParagraph(`Total Test Cases: ${selectedItemsList.length}`))
        children.push(createParagraph(''))

        const rows = selectedItemsList.map((tc) => [
          tc.key || 'N/A',
          tc.title || 'N/A',
          tc.status || 'N/A',
          tc.moc?.name || 'N/A',
          (tc.linkedTestResultsCount || 0).toString(),
        ])
        children.push(createTable(['Key', 'Title', 'Status', 'MoC', 'Results'], rows))
      } else {
        const rows = selectedItemsList.map((tp) => [
          tp.key || 'N/A',
          tp.name || 'N/A',
          tp.status || 'N/A',
          tp.phase || 'N/A',
          (tp.linkedTestResultsCount || 0).toString(),
        ])
        children.push(createTable(['Key', 'Name', 'Status', 'Phase', 'Results'], rows))
      }
    }

    const hdrClassification = wordDocConfidentiality || ''
    const hdrTitle = wordDocTitleForHeader || (exportType === 'test-plans' ? 'TEST PLAN' : 'TEST CASE REPORT')
    const hdrDocRef = [wordDocNumberForHeader, wordRevisionForHeader ? `Rev ${wordRevisionForHeader}` : ''].filter(Boolean).join(' - ')

    const headerParagraph = new Paragraph({
      tabStops: [
        { type: TabStopType?.CENTER || 'center', position: Math.round(usableWidthTwips / 2) },
        { type: TabStopType?.RIGHT || 'right', position: usableWidthTwips },
      ],
      children: [
        new TextRun({ text: hdrClassification, size: 14, bold: true }),
        new TextRun({ text: '\t' }),
        new TextRun({ text: hdrTitle, size: 14 }),
        new TextRun({ text: '\t' }),
        new TextRun({ text: hdrDocRef, size: 14 }),
      ],
    })

    const footerRuns: any[] = [
      new TextRun({ text: hdrClassification, size: 14, bold: true }),
      new TextRun({ text: '\t' }),
      new TextRun({ text: format(new Date(), 'yyyy-MM-dd'), size: 14 }),
      new TextRun({ text: '\t' }),
    ]
    try {
      if (PageNumber?.CURRENT) {
        footerRuns.push(new TextRun({ text: 'Page ', size: 14 }))
        footerRuns.push(new TextRun({ children: [PageNumber.CURRENT], size: 14 }))
      }
    } catch { /* PageNumber may not be available */ }

    const footerParagraph = new Paragraph({
      tabStops: [
        { type: TabStopType?.CENTER || 'center', position: Math.round(usableWidthTwips / 2) },
        { type: TabStopType?.RIGHT || 'right', position: usableWidthTwips },
      ],
      children: footerRuns,
    })

    const doc = new Document({
      sections: [{
        children,
        headers: {
          default: new Header({
            children: [headerParagraph],
          }),
        },
        footers: {
          default: new Footer({
            children: [footerParagraph],
          }),
        },
      }],
    })

    const blob = await Packer.toBlob(doc)
    const ts = format(new Date(), 'yyyy-MM-dd_HHmm')
    const filename =
      exportType === 'test-cases'
        ? `Test_Cases_Export_${ts}.docx`
        : `Test_Plans_Export_${projectId}_${ts}.docx`
    downloadFile(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }

  const handleExport = async () => {
    if (selectedItems.size === 0) {
      setError('Please select at least one item to export')
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      switch (selectedFormat) {
        case 'pdf':
          await exportToPDF()
          break
        case 'csv':
          await exportToCSV()
          break
        case 'json':
          await exportToJSON()
          break
        case 'word':
          await exportToWord()
          break
      }
      onClose()
    } catch (err: any) {
      console.error('Export error:', err)
      setError(err.message || 'Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Export {exportType === 'test-cases' ? 'Test Cases' : 'Test Plans'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Format Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Export Format</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(formatInfo) as [ExportFormat, typeof formatInfo['pdf']][]).map(([format, info]) => {
                const Icon = info.icon
                return (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedFormat === format
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Icon
                      size={20}
                      className={`mx-auto mb-1 ${
                        selectedFormat === format
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    />
                    <div
                      className={`text-xs font-medium ${
                        selectedFormat === format
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {info.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Include Details Option */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(e) => setIncludeDetails(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include full details and linked test results</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
              {includeDetails
                ? 'Export will include complete details for each item including test results'
                : 'Export will include summary information only'}
            </p>
          </div>

          {/* Item Selection */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Items ({selectedItems.size} of {items.length})
              </label>
              <button
                onClick={toggleAll}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    selectedItems.has(item.id)
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {selectedItems.has(item.id) ? (
                    <CheckSquare size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  ) : (
                    <Square size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-gray-500 mr-2">{item.key}</span>
                    <span className="text-sm text-gray-900 dark:text-white truncate">
                      {exportType === 'test-cases' ? item.title : item.name}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.status === 'APPROVED' || item.status === 'READY'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || selectedItems.size === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export {formatInfo[selectedFormat].label}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
