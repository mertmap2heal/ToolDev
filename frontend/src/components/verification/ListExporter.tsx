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
  testPlan?: { key?: string; name?: string; status?: string; phase?: string; description?: string; scope?: string; planCases?: unknown[] }
  statistics?: { totalCases?: number; executed?: number; passed?: number; failed?: number; coveragePercentage?: number }
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

    // Title
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

    const createParagraph = (text: string, options: { bold?: boolean; size?: number; heading?: any } = {}) => {
      return new Paragraph({
        heading: options.heading,
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

          children.push(createParagraph(`${tp.key}: ${tp.name}`, { heading: HeadingLevel.HEADING_2, size: 28 }))
          children.push(createParagraph(`Status: ${tp.status || 'N/A'}`))
          children.push(createParagraph(`Phase: ${tp.phase || 'N/A'}`))
          children.push(createParagraph(`Description: ${tp.description || 'N/A'}`))

          if (r.statistics) {
            children.push(createParagraph('Statistics', { heading: HeadingLevel.HEADING_3, size: 26 }))
            children.push(createParagraph(`Total Cases: ${r.statistics.totalCases || 0}`))
            children.push(createParagraph(`Executed: ${r.statistics.executed || 0}`))
            children.push(createParagraph(`Passed: ${r.statistics.passed || 0}`))
            children.push(createParagraph(`Failed: ${r.statistics.failed || 0}`))
            children.push(createParagraph(`Coverage: ${r.statistics.coveragePercentage || 0}%`))
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
