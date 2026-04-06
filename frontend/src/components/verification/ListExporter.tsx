import { useState } from 'react'
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

interface ListExporterProps {
  isOpen: boolean
  onClose: () => void
  exportType: 'test-cases' | 'test-plans'
  items: any[]
  projectId: string
}

type ExportFormat = 'pdf' | 'csv' | 'json' | 'word'

interface TestCaseReport {
  testCase?: { key?: string; title?: string; status?: string; version?: string; objective?: string; preconditions?: string; steps?: string[]; expectedResults?: string[] }
  testResults?: Array<{ title?: string; resultStatus?: string; executedByName?: string; executedAt?: string }>
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
}

const formatInfo = {
  pdf: { icon: FileText, label: 'PDF', description: 'Formatted document' },
  csv: { icon: FileSpreadsheet, label: 'CSV', description: 'Spreadsheet compatible' },
  json: { icon: FileCode, label: 'JSON', description: 'Raw data' },
  word: { icon: File, label: 'Word', description: 'Editable document' },
}

export default function ListExporter({ isOpen, onClose, exportType, items, projectId }: ListExporterProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set(items.map((item) => item.id)))
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeDetails, setIncludeDetails] = useState(false)

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

    const wrapText = (text: string, maxWidth: number) => doc.splitTextToSize(text, maxWidth) as string[]

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

    const drawHeaderFooterAllPages = (opts: { confidentiality?: string; docNumber?: string; revision?: string }) => {
      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        const w = doc.internal.pageSize.getWidth()
        const h = doc.internal.pageSize.getHeight()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const left = opts.confidentiality || ''
        const right = [opts.docNumber, opts.revision ? `Rev ${opts.revision}` : null].filter(Boolean).join(' • ')
        if (left) doc.text(left, 14, 10)
        if (right) doc.text(right, w - 14, 10, { align: 'right' })
        doc.setDrawColor(220)
        doc.line(14, 12, w - 14, 12)
        doc.line(14, h - 12, w - 14, h - 12)
        doc.text(`Page ${p}/${totalPages}`, w - 14, h - 6, { align: 'right' })
      }
    }

    const addCoverPage = (r: TestPlanReport) => {
      const tp = r.testPlan || {}
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      const confidentiality = tp.docConfidentiality || 'CONFIDENTIAL'
      const docNumber = tp.docNumber || tp.key || ''
      const revision = tp.docRevision || '1.0'

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(confidentiality, 14, 24)

      doc.setFontSize(18)
      doc.text('TEST PLAN', w / 2, 60, { align: 'center' })

      doc.setFontSize(14)
      doc.text(tp.name || tp.key || 'Test Plan', w / 2, 78, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const subtitle = [
        docNumber ? `Document: ${docNumber}` : null,
        tp.docProjectCode ? `Project: ${tp.docProjectCode}` : null,
        revision ? `Revision: ${revision}` : null,
        tp.docPlanDate ? `Test Plan from: ${formatDate(tp.docPlanDate)}` : null,
      ]
        .filter(Boolean)
        .join('   |   ')
      if (subtitle) {
        const lines = wrapText(subtitle, w - 28)
        doc.text(lines, w / 2, 92, { align: 'center' })
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Overall Result', 14, h - 70)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.rect(14, h - 62, 5, 5)
      doc.text('PASS', 22, h - 58)
      doc.rect(52, h - 62, 5, 5)
      doc.text('FAIL', 60, h - 58)

      doc.setFontSize(8)
      doc.text(`Generated: ${formatDate(new Date())}`, 14, h - 20)

      return { confidentiality, docNumber, revision }
    }

    const addSimpleSectionPage = (title: string, body?: string) => {
      doc.addPage()
      const w = doc.internal.pageSize.getWidth()
      let y = 24
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(title, 14, y)
      y += 8
      if (body) {
        doc.setFontSize(10)
        const lines = wrapText(body, w - 28)
        for (const line of lines) {
          const isTodo = line.trim().startsWith('TODO:')
          if (isTodo) setPlaceholderStyle()
          else resetTextStyle()
          doc.text(line, 14, y)
          y += 5
          if (y > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage()
            y = 24
          }
        }
        resetTextStyle()
      } else {
        resetTextStyle()
        doc.setFontSize(10)
        doc.text('N/A', 14, y)
      }
    }

    const addRevisionControl = (r: TestPlanReport) => {
      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Revision Control', 14, 24)

      const rows = (r.revisions || []).map((rev) => [
        rev.revisionNumber || '',
        rev.revisionDate ? formatDate(rev.revisionDate) : '',
        rev.editedByName || '',
        rev.approvedByName || '',
        rev.approvedAt ? formatDate(rev.approvedAt) : '',
        rev.summaryOfChanges || '',
      ])

      docAutoTable({
        startY: 32,
        head: [['Rev', 'Date', 'Edited by', 'Approved by', 'Approved at', 'Summary of Changes']],
        body: rows.length ? rows : [['', '', '', '', '', 'No revision history']],
        theme: 'striped',
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [31, 41, 55] },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 22 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 22 },
          5: { cellWidth: 'auto' },
        },
      })
    }

    const addTOCPage = () => {
      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('Table of Contents', 14, 24)
    }

    const fillTOCPage = (tocPageNumber: number, tocEntries: Array<{ title: string; page: number }>) => {
      doc.setPage(tocPageNumber)
      const w = doc.internal.pageSize.getWidth()
      let y = 34
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      for (const e of tocEntries) {
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage()
          y = 24
        }
        doc.text(e.title, 14, y)
        doc.text(String(e.page), w - 14, y, { align: 'right' })
        y += 6
      }
    }

    const addToolsAndSetup = async (r: TestPlanReport) => {
      doc.addPage()
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text('General Conditions / Tools / Test Setup', 14, 24)

      const tools = Array.isArray(r.testPlan?.docTools) ? (r.testPlan?.docTools as any[]) : []
      doc.setFontSize(11)
      doc.text('Tools', 14, 34)
      docAutoTable({
        startY: 38,
        head: [['Tool', 'Manufacturer', 'Part #', 'Serial #', 'Calibration valid till']],
        body: tools.length
          ? tools.map((t) => [t?.name || '', t?.manufacturer || '', t?.partNumber || '', t?.serialNumber || '', t?.calibrationValidTill || ''])
          : [['', '', '', '', '']],
        theme: 'striped',
        margin: { left: 14, right: 14 },
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      })

      let y = getLastAutoTableY() + 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Linked Test Setups', 14, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const setups = r.setups || []
      const setupLines = setups.length ? setups.map((s) => `- ${s.name || s.id || 'Setup'}`) : ['- N/A']
      doc.text(setupLines, 14, y)

      const notes = r.testPlan?.docTestSetupNotes
      if (notes) {
        const w = doc.internal.pageSize.getWidth()
        const lines = wrapText(notes, w - 28)
        doc.text(lines, 14, y + 10)
      }

      // Setup diagram image (if available)
      const primary = setups[0]
      const diagramUrl =
        (primary?.diagramExportPath as any) ||
        (Array.isArray(primary?.photos) ? (primary?.photos as any[])?.[0]?.fileUrl || (primary?.photos as any[])?.[0]?.url : null)

      const img = diagramUrl ? await fetchAsDataUrl(String(diagramUrl)) : null
      const afterTextY = (notes ? y + 20 : y + 12)
      const startY = Math.min(afterTextY + 8, doc.internal.pageSize.getHeight() - 120)

      if (img?.dataUrl) {
        const w = doc.internal.pageSize.getWidth()
        const maxW = w - 28
        const maxH = 90
        const fmt = img.mime.includes('jpeg') || img.mime.includes('jpg') ? 'JPEG' : 'PNG'
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Setup Diagram', 14, startY)
        try {
          // Place below header; jsPDF will keep aspect ratio when width/height provided but image exceeds; we choose fixed box.
          ;(doc as any).addImage(img.dataUrl, fmt, 14, startY + 4, maxW, maxH)
        } catch {
          setPlaceholderStyle()
          doc.text(placeholder('Unable to render setup diagram image'), 14, startY + 14)
          resetTextStyle()
        }
      } else {
        // Mark as user action if missing
        setPlaceholderStyle()
        doc.text(placeholder('Export setup diagram to make it visible here'), 14, startY + 14)
        resetTextStyle()
      }
    }

    const addPerTestCaseChapters = (r: TestPlanReport, tocEntries: Array<{ title: string; page: number }>) => {
      const cases = r.testCases || []
      for (const pc of cases) {
        const tc = pc.testCase || {}
        doc.addPage()
        const startPage = doc.getNumberOfPages()
        tocEntries.push({ title: `${tc.key || 'TC'} ${tc.title || ''}`.trim(), page: startPage })

        let y = 24
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text(`${tc.key || 'TC'}: ${tc.title || ''}`.trim(), 14, y)
        y += 8

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const metaLine = [`Status: ${tc.status || 'N/A'}`, pc.isMandatory ? 'Mandatory' : 'Optional'].filter(Boolean).join('   |   ')
        doc.text(metaLine, 14, y)
        y += 10

        const section = (title: string, text?: string) => {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.text(title, 14, y)
          y += 6
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(10)
          const w = doc.internal.pageSize.getWidth()
          const lines = wrapText(text || 'N/A', w - 28)
          doc.text(lines, 14, y)
          y += lines.length * 5 + 4
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
        doc.setFontSize(11)
        doc.text('Test Procedure', 14, y)

        const steps = Array.isArray(tc.steps) ? (tc.steps as any[]) : []
        const expected = Array.isArray(tc.expectedResults) ? (tc.expectedResults as any[]) : []
        const rows = steps.length
          ? steps.map((s, idx) => {
              const desc = typeof s === 'string' ? s : (s?.text || s?.description || JSON.stringify(s))
              const exp = expected[idx]
              const expTxt = typeof exp === 'string' ? exp : (exp?.text || exp?.description || (exp ? JSON.stringify(exp) : ''))
              return [String(idx + 1), desc, expTxt, '', '']
            })
          : [['', 'N/A', '', '', '']]

        docAutoTable({
          startY: y + 4,
          head: [['No', 'Description', 'Expected Result', 'Value', 'Pass/Fail']],
          body: rows,
          theme: 'striped',
          margin: { left: 14, right: 14 },
          headStyles: { fillColor: [31, 41, 55] },
          styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 70 },
            2: { cellWidth: 60 },
            3: { cellWidth: 20 },
            4: { cellWidth: 20 },
          },
        })
      }
    }

    // Structured Test Plan PDF export (reference-like)
    if (exportType === 'test-plans') {
      const reports = await fetchDetailedReports()
      if (!reports.length) throw new Error('No report data available')

      // Multi-plan export supported: append “document blocks”
      for (let i = 0; i < reports.length; i++) {
        const r = reports[i] as TestPlanReport
        if (i > 0) doc.addPage()

        const { confidentiality, docNumber, revision } = addCoverPage(r)
        const tocEntries: Array<{ title: string; page: number }> = []

        addSimpleSectionPage(
          'Signatures',
          [
            `Prepared by: ${r.testPlan?.docPreparedByName || placeholder('Prepared by')}`,
            `QA: ${r.testPlan?.docQaByName || placeholder('QA')}`,
            `Approved by: ${r.testPlan?.docApprovedByName || placeholder('Approved by')}`,
            `Approved at: ${r.testPlan?.docApprovedAt ? formatDate(r.testPlan?.docApprovedAt) : placeholder('Approved at')}`,
          ].join('\n')
        )
        tocEntries.push({ title: 'Signatures', page: doc.getNumberOfPages() })

        addRevisionControl(r)
        tocEntries.push({ title: 'Revision Control', page: doc.getNumberOfPages() })

        addTOCPage()
        const tocPageNumber = doc.getNumberOfPages()

        const addGeneral = (title: string, body?: string) => {
          addSimpleSectionPage(title, body)
          tocEntries.push({ title, page: doc.getNumberOfPages() })
        }

        addGeneral('Introduction – Purpose', r.testPlan?.docPurpose || r.testPlan?.description || '')
        addGeneral('Introduction – Overview', r.testPlan?.docOverview || r.testPlan?.scope || '')
        addGeneral('Statement of Conformity', r.testPlan?.docStatementOfConformity || '')
        addGeneral('Changes', r.testPlan?.docChangesPolicy || '')
        addGeneral('Distribution', r.testPlan?.docDistribution || '')
        addGeneral('Acronyms & Abbreviations', r.testPlan?.docAcronymsNote || '')
        addGeneral(
          'Applicable Documents',
          Array.isArray(r.testPlan?.docApplicableDocuments) ? (r.testPlan?.docApplicableDocuments as any[]).map((d) => `- ${d?.title || ''}`).join('\n') : ''
        )
        addGeneral('General Notes and Precautions', r.testPlan?.docGeneralPrecautions || '')

        await addToolsAndSetup(r)
        tocEntries.push({ title: 'General Conditions / Tools / Test Setup', page: doc.getNumberOfPages() })

        const chapterStartPage = doc.getNumberOfPages() + 1
        addPerTestCaseChapters(r, tocEntries)
        if (r.testCases?.length) {
          tocEntries.unshift({ title: 'Test Cases', page: chapterStartPage })
        }

        fillTOCPage(tocPageNumber, tocEntries)
        drawHeaderFooterAllPages({ confidentiality, docNumber, revision })
      }

      const filename = `Test_Plans_Export.pdf`
      doc.save(filename)
      return
    }

    // Title (legacy export path)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(exportType === 'test-cases' ? 'Test Cases Export' : 'Test Plans Export', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${formatDate(new Date())}`, pageWidth / 2, yPos, { align: 'center' })
    doc.text(`Total Items: ${selectedItemsList.length}`, pageWidth / 2, yPos + 5, { align: 'center' })
    yPos += 15

    if (includeDetails) {
      // Fetch detailed reports
      const reports = await fetchDetailedReports()

      for (let i = 0; i < reports.length; i++) {
        if (i > 0) {
          doc.addPage()
          yPos = 20
        }

        const report = reports[i]

        if (exportType === 'test-cases') {
          const r = report as TestCaseReport
          const tc = r.testCase!

          doc.setFontSize(14)
          doc.setFont('helvetica', 'bold')
          doc.text(`${tc.key}: ${tc.title}`, 14, yPos)
          yPos += 10

          const details = [
            ['Status', tc.status || 'N/A'],
            ['Objective', tc.objective || 'N/A'],
            ['Version', tc.version || 'N/A'],
          ]

          docAutoTable({
            startY: yPos,
            head: [],
            body: details,
            theme: 'plain',
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
            margin: { left: 14 },
          })

          yPos = getLastAutoTableY() + 10

          // Steps
          if (tc.steps && tc.steps.length > 0) {
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Steps', 14, yPos)
            yPos += 6

            const stepsData = tc.steps.map((step: string, idx: number) => [idx + 1, step])
            docAutoTable({
              startY: yPos,
              head: [['#', 'Step']],
              body: stepsData,
              theme: 'striped',
              headStyles: { fillColor: [59, 130, 246] },
              margin: { left: 14 },
            })
            yPos = getLastAutoTableY() + 10
          }

          // Test Results
          if (r.testResults && r.testResults.length > 0) {
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Linked Test Results', 14, yPos)
            yPos += 6

            const trData = r.testResults.map((tr: any) => [
              tr.title || 'N/A',
              tr.resultStatus || 'N/A',
              tr.executedByName || 'N/A',
              formatDate(tr.executedAt),
            ])

            docAutoTable({
              startY: yPos,
              head: [['Title', 'Status', 'Executed By', 'Date']],
              body: trData,
              theme: 'striped',
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: 14 },
            })
          }
        } else {
          const r = report as TestPlanReport
          const tp = r.testPlan!

          doc.setFontSize(14)
          doc.setFont('helvetica', 'bold')
          doc.text(`${tp.key}: ${tp.name}`, 14, yPos)
          yPos += 10

          const details = [
            ['Status', tp.status || 'N/A'],
            ['Phase', tp.phase || 'N/A'],
            ['Description', tp.description || 'N/A'],
          ]

          docAutoTable({
            startY: yPos,
            head: [],
            body: details,
            theme: 'plain',
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
            margin: { left: 14 },
          })

          yPos = getLastAutoTableY() + 10

          // Statistics
          if (r.statistics) {
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Statistics', 14, yPos)
            yPos += 6

            const statsData = [
              ['Total Cases', r.statistics.totalCases?.toString() || '0'],
              ['Executed', r.statistics.executed?.toString() || '0'],
              ['Passed', r.statistics.passed?.toString() || '0'],
              ['Failed', r.statistics.failed?.toString() || '0'],
              ['Coverage', `${r.statistics.coveragePercentage || 0}%`],
            ]

            docAutoTable({
              startY: yPos,
              head: [],
              body: statsData,
              theme: 'grid',
              columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
              margin: { left: 14 },
            })

            yPos = getLastAutoTableY() + 10
          }

          // Test Results
          if (r.testResults && r.testResults.length > 0) {
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Linked Test Results', 14, yPos)
            yPos += 6

            const trData = r.testResults.map((tr: any) => [
              tr.title || 'N/A',
              tr.resultStatus || 'N/A',
              tr.executedByName || 'N/A',
              formatDate(tr.executedAt),
            ])

            docAutoTable({
              startY: yPos,
              head: [['Title', 'Status', 'Executed By', 'Date']],
              body: trData,
              theme: 'striped',
              headStyles: { fillColor: [34, 197, 94] },
              margin: { left: 14 },
            })
          }
        }
      }
    } else {
      // Summary view only
      if (exportType === 'test-cases') {
        const data = selectedItemsList.map((tc) => [
          tc.key || 'N/A',
          tc.title || 'N/A',
          tc.status || 'N/A',
          tc.moc?.name || 'N/A',
          tc.linkedTestResultsCount || 0,
        ])

        docAutoTable({
          startY: yPos,
          head: [['Key', 'Title', 'Status', 'MoC', 'Results']],
          body: data,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        })
      } else {
        const data = selectedItemsList.map((tp) => [
          tp.key || 'N/A',
          tp.name || 'N/A',
          tp.status || 'N/A',
          tp.phase || 'N/A',
          tp.linkedTestResultsCount || 0,
        ])

        docAutoTable({
          startY: yPos,
          head: [['Key', 'Name', 'Status', 'Phase', 'Results']],
          body: data,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        })
      }
    }

    const filename = `${exportType === 'test-cases' ? 'Test_Cases' : 'Test_Plans'}_Export.pdf`
    doc.save(filename)
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

    const filename = `${exportType === 'test-cases' ? 'Test_Cases' : 'Test_Plans'}_Export.csv`
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
    const filename = `${exportType === 'test-cases' ? 'Test_Cases' : 'Test_Plans'}_Export.json`
    downloadFile(jsonContent, filename, 'application/json')
  }

  const exportToWord = async () => {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, Packer } = await loadDocx()

    const children: any[] = []

    const createParagraph = (
      text: string,
      options: { bold?: boolean; size?: number; heading?: any; pageBreakBefore?: boolean } = {}
    ) => {
      return new Paragraph({
        heading: options.heading,
        pageBreakBefore: options.pageBreakBefore,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: text || '',
            bold: options.bold,
            size: options.size || 24,
          }),
        ],
      })
    }

    const createRedTodo = (label: string) =>
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: `TODO: ${label}`,
            bold: true,
            color: 'DC2626',
            size: 24,
          }),
        ],
      })

    const createMaybeTodoLine = (label: string, value?: string) => {
      if (value && String(value).trim()) return createParagraph(`${label}: ${value}`)
      return new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `${label}: `, size: 24 }),
          new TextRun({ text: `TODO: ${label}`, bold: true, color: 'DC2626', size: 24 }),
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
                  children: [createParagraph(header, { bold: true })],
                  shading: { fill: '3B82F6' },
                })
            ),
          }),
          ...rows.map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [createParagraph(cell)],
                    })
                ),
              })
          ),
        ],
      })
    }

    // Title
    children.push(
      createParagraph(
        exportType === 'test-cases' ? 'Test Cases Export' : 'Test Plans Export',
        { heading: HeadingLevel.HEADING_1, size: 36 }
      )
    )
    children.push(createParagraph(`Generated: ${formatDate(new Date())}`, { size: 20 }))
    children.push(createParagraph(`Total Items: ${selectedItemsList.length}`, { size: 20 }))
    children.push(createParagraph(''))

    if (includeDetails) {
      const reports = await fetchDetailedReports()

      for (const report of reports) {
        if (exportType === 'test-cases') {
          const r = report as TestCaseReport
          const tc = r.testCase!

          children.push(createParagraph(`${tc.key}: ${tc.title}`, { heading: HeadingLevel.HEADING_2, size: 28 }))
          children.push(createParagraph(`Status: ${tc.status || 'N/A'}`))
          children.push(createParagraph(`Objective: ${tc.objective || 'N/A'}`))

          if (tc.steps && tc.steps.length > 0) {
            children.push(createParagraph('Steps', { heading: HeadingLevel.HEADING_3, size: 26 }))
            const stepsRows = tc.steps.map((step: string, idx: number) => [(idx + 1).toString(), step])
            children.push(createTable(['#', 'Step'], stepsRows))
          }

          if (r.testResults && r.testResults.length > 0) {
            children.push(createParagraph('Linked Test Results', { heading: HeadingLevel.HEADING_3, size: 26 }))
            const trRows = r.testResults.map((tr: any) => [
              tr.title || 'N/A',
              tr.resultStatus || 'N/A',
              tr.executedByName || 'N/A',
              formatDate(tr.executedAt),
            ])
            children.push(createTable(['Title', 'Status', 'Executed By', 'Date'], trRows))
          }

          children.push(createParagraph(''))
        } else {
          const r = report as TestPlanReport
          const tp = r.testPlan!

          const docNumber = tp.docNumber || tp.key || ''
          const confidentiality = tp.docConfidentiality || 'INTERNAL'
          const revision = tp.docRevision || '1.0'

          // Cover-ish header (Word doesn’t have “pages” in the same way; we use page breaks)
          children.push(createParagraph('TEST PLAN', { heading: HeadingLevel.HEADING_1, size: 36, pageBreakBefore: true }))
          children.push(createParagraph(tp.name || tp.key || 'Test Plan', { heading: HeadingLevel.HEADING_2, size: 28 }))
          children.push(createParagraph(`Confidentiality: ${confidentiality}`))
          children.push(createParagraph(`Document: ${docNumber}`))
          children.push(createParagraph(`Revision: ${revision}`))
          if (tp.docPlanDate) children.push(createParagraph(`Test Plan from: ${formatDate(tp.docPlanDate)}`))
          children.push(createParagraph(''))

          // Table of contents (manual list of major sections)
          children.push(createParagraph('Table of Contents', { heading: HeadingLevel.HEADING_2, size: 28 }))
          const tocLines = [
            'Signatures',
            'Revision Control',
            'Introduction – Purpose',
            'Introduction – Overview',
            'Statement of Conformity',
            'Changes',
            'Distribution',
            'Acronyms & Abbreviations',
            'Applicable Documents',
            'General Notes and Precautions',
            'General Conditions / Tools / Test Setup',
            'Test Cases',
          ]
          tocLines.forEach((t) => children.push(createParagraph(`- ${t}`)))
          children.push(createParagraph(''))

          // Signatures
          children.push(createParagraph('Signatures', { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
          children.push(createMaybeTodoLine('Prepared by', tp.docPreparedByName))
          children.push(createMaybeTodoLine('QA', tp.docQaByName))
          children.push(createMaybeTodoLine('Approved by', tp.docApprovedByName))
          children.push(createMaybeTodoLine('Approved at', tp.docApprovedAt ? formatDate(tp.docApprovedAt) : ''))
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

          addSection('Introduction – Purpose', tp.docPurpose || tp.description || '')
          addSection('Introduction – Overview', tp.docOverview || tp.scope || '')
          addSection('Statement of Conformity', tp.docStatementOfConformity || '')
          addSection('Changes', tp.docChangesPolicy || '')
          addSection('Distribution', tp.docDistribution || '')
          addSection('Acronyms & Abbreviations', tp.docAcronymsNote || '')
          addSection(
            'Applicable Documents',
            Array.isArray(tp.docApplicableDocuments) ? (tp.docApplicableDocuments as any[]).map((d) => `- ${d?.title || ''}`).join('\n') : ''
          )
          addSection('General Notes and Precautions', tp.docGeneralPrecautions || '')

          // Tools / Setup
          children.push(
            createParagraph('General Conditions / Tools / Test Setup', { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true })
          )
          children.push(createParagraph('Tools', { heading: HeadingLevel.HEADING_3, size: 26 }))
          const tools = Array.isArray(tp.docTools) ? (tp.docTools as any[]) : []
          const toolRows = tools.length
            ? tools.map((t) => [t?.name || '', t?.manufacturer || '', t?.partNumber || '', t?.serialNumber || '', t?.calibrationValidTill || ''])
            : [['', '', '', '', '']]
          children.push(createTable(['Tool', 'Manufacturer', 'Part #', 'Serial #', 'Calibration valid till'], toolRows))
          children.push(createParagraph(''))
          children.push(createParagraph('Linked Test Setups', { heading: HeadingLevel.HEADING_3, size: 26 }))
          const setups = r.setups || []
          children.push(createParagraph(setups.length ? setups.map((s) => `- ${s.name || s.id || 'Setup'}`).join('\n') : 'N/A'))
          const primary = setups[0] as any
          const diagramUrl =
            primary?.diagramExportPath ||
            (Array.isArray(primary?.photos) ? primary?.photos?.[0]?.fileUrl || primary?.photos?.[0]?.url : null)
          if (!diagramUrl) {
            children.push(createRedTodo('Export setup diagram to make it visible here'))
          } else {
            children.push(createParagraph(`Setup Diagram: ${String(diagramUrl)}`))
          }
          if (tp.docTestSetupNotes) children.push(createParagraph(tp.docTestSetupNotes))
          children.push(createParagraph(''))

          // Per-test-case chapters
          children.push(createParagraph('Test Cases', { heading: HeadingLevel.HEADING_2, size: 28, pageBreakBefore: true }))
          const pcs = r.testCases || []
          for (const pc of pcs) {
            const tc = pc.testCase || {}
            children.push(createParagraph(`${tc.key || 'TC'}: ${tc.title || ''}`.trim(), { heading: HeadingLevel.HEADING_3, size: 26, pageBreakBefore: true }))
            children.push(createParagraph(`Status: ${tc.status || 'N/A'}`))
            children.push(createParagraph(pc.isMandatory ? 'Mandatory' : 'Optional'))
            children.push(createParagraph(''))

            children.push(createParagraph('Objective', { heading: HeadingLevel.HEADING_4, size: 24 }))
            children.push(createParagraph((tc.objective as any) || 'N/A'))
            children.push(createParagraph(''))

            children.push(createParagraph('Preconditions / Assumptions', { heading: HeadingLevel.HEADING_4, size: 24 }))
            children.push(createParagraph((tc.preconditions as any) || 'N/A'))
            children.push(createParagraph(''))

            children.push(createParagraph('Requirements Verified', { heading: HeadingLevel.HEADING_4, size: 24 }))
            const verifies = (tc.verifiesElements || []).map((v) => `- ${(v.id || '').toString()} ${v.name || ''}`.trim()).filter(Boolean)
            children.push(createParagraph(verifies.length ? verifies.join('\n') : 'N/A'))
            children.push(createParagraph(''))

            if (tc.passFailCriteria) {
              children.push(createParagraph('Expected Outcomes / Pass-Fail Criteria', { heading: HeadingLevel.HEADING_4, size: 24 }))
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
                  return [String(idx + 1), desc, expTxt, '', '']
                })
              : [['', 'N/A', '', '', '']]
            children.push(createParagraph('Test Procedure', { heading: HeadingLevel.HEADING_4, size: 24 }))
            children.push(createTable(['No', 'Description', 'Expected Result', 'Value', 'Pass/Fail'], procRows))
            children.push(createParagraph(''))
          }
        }
      }
    } else {
      // Summary table
      if (exportType === 'test-cases') {
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

    const doc = new Document({
      sections: [{ children }],
    })

    const blob = await Packer.toBlob(doc)
    const filename = `${exportType === 'test-cases' ? 'Test_Cases' : 'Test_Plans'}_Export.docx`
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
