import { useState } from 'react'
import { X, FileText, FileSpreadsheet, File, FileCode, Download, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { format } from 'date-fns'

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

interface ReportExporterProps {
  isOpen: boolean
  onClose: () => void
  reportType: 'test-case' | 'test-plan' | 'test-run'
  reportData: any
  entityName: string
}

type ExportFormat = 'pdf' | 'csv' | 'json' | 'word'

const formatInfo = {
  pdf: { icon: FileText, label: 'PDF', description: 'Formatted document for printing' },
  csv: { icon: FileSpreadsheet, label: 'CSV', description: 'Spreadsheet compatible' },
  json: { icon: FileCode, label: 'JSON', description: 'Raw data for integrations' },
  word: { icon: File, label: 'Word', description: 'Editable document' },
}

export default function ReportExporter({ isOpen, onClose, reportType, reportData, entityName }: ReportExporterProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const getStatusColor = (status: string): [number, number, number] => {
    switch (status?.toUpperCase()) {
      case 'PASS':
      case 'APPROVED':
      case 'VERIFIED':
        return [34, 197, 94] // green
      case 'FAIL':
      case 'FAILED':
        return [239, 68, 68] // red
      case 'BLOCKED':
        return [249, 115, 22] // orange
      case 'SKIPPED':
      case 'NOT_RUN':
        return [156, 163, 175] // gray
      default:
        return [107, 114, 128] // default gray
    }
  }

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

  const exportToPDF = async () => {
    await loadAutoTable()
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 20

    // Helper function to add text with word wrap
    const addText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 10) => {
      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(text || 'N/A', maxWidth)
      doc.text(lines, x, y)
      return y + lines.length * (fontSize * 0.4)
    }

    // Header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    const reportTitle = reportType === 'test-case' ? 'Test Case Report' : reportType === 'test-plan' ? 'Test Plan Report' : 'Test Run Report'
    doc.text(reportTitle, pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${formatDate(reportData.metadata?.generatedAt)}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    if (reportType === 'test-case') {
      const tc = reportData.testCase

      // Test Case Details Section
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Test Case Details', 14, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')

      const details = [
        ['Key', tc.key || 'N/A'],
        ['Title', tc.title || 'N/A'],
        ['Status', tc.status || 'N/A'],
        ['Version', tc.version || 'N/A'],
        ['Objective', tc.objective || 'N/A'],
      ]

      ;(doc as any).autoTable({
        startY: yPos,
        head: [],
        body: details,
        theme: 'plain',
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 140 },
        },
        margin: { left: 14 },
      })

      yPos = (doc as any).lastAutoTable.finalY + 10

      // Preconditions
      if (tc.preconditions) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Preconditions', 14, yPos)
        yPos += 6
        doc.setFont('helvetica', 'normal')
        yPos = addText(tc.preconditions, 14, yPos, pageWidth - 28)
        yPos += 8
      }

      // Steps
      if (tc.steps && Array.isArray(tc.steps) && tc.steps.length > 0) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Test Procedure', 14, yPos)
        yPos += 6

        const stepsData = tc.steps.map((step: string, idx: number) => [idx + 1, step])
        ;(doc as any).autoTable({
          startY: yPos,
          head: [['Step', 'Description']],
          body: stepsData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10
      }

      // Expected Results
      if (tc.expectedResults && Array.isArray(tc.expectedResults) && tc.expectedResults.length > 0) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Expected Results', 14, yPos)
        yPos += 6

        const resultsData = tc.expectedResults.map((result: string, idx: number) => [idx + 1, result])
        ;(doc as any).autoTable({
          startY: yPos,
          head: [['#', 'Expected Result']],
          body: resultsData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10
      }

      // Pass/Fail Criteria
      if (tc.passFailCriteria) {
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.text('Pass/Fail Criteria', 14, yPos)
        yPos += 6
        doc.setFont('helvetica', 'normal')
        yPos = addText(tc.passFailCriteria, 14, yPos, pageWidth - 28)
        yPos += 8
      }

      // Test Results
      if (reportData.testResults && reportData.testResults.length > 0) {
        if (yPos > 250) {
          doc.addPage()
          yPos = 20
        }

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Linked Test Results', 14, yPos)
        yPos += 8

        const testResultsData = reportData.testResults.map((tr: any) => [
          tr.title || 'N/A',
          tr.resultStatus || 'N/A',
          tr.executedByName || 'N/A',
          formatDate(tr.executedAt),
          tr.testEnvironment || 'N/A',
        ])

        ;(doc as any).autoTable({
          startY: yPos,
          head: [['Title', 'Status', 'Executed By', 'Date', 'Environment']],
          body: testResultsData,
          theme: 'striped',
          headStyles: { fillColor: [34, 197, 94] },
          margin: { left: 14 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10
      }

      // Verifies Elements
      if (reportData.verifiesElements && reportData.verifiesElements.length > 0) {
        if (yPos > 250) {
          doc.addPage()
          yPos = 20
        }

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Verifies Elements', 14, yPos)
        yPos += 8

        const verifiesData = reportData.verifiesElements.map((el: any) => [
          el.type === 'requirement' ? 'Requirement' : 'Function',
          el.id || 'N/A',
          el.name || 'N/A',
        ])

        ;(doc as any).autoTable({
          startY: yPos,
          head: [['Type', 'ID', 'Name']],
          body: verifiesData,
          theme: 'striped',
          headStyles: { fillColor: [147, 51, 234] },
          margin: { left: 14 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10
      }

      // Custom Sections
      if (reportData.customSections && reportData.customSections.length > 0) {
        for (const section of reportData.customSections) {
          if (yPos > 250) {
            doc.addPage()
            yPos = 20
          }

          doc.setFontSize(14)
          doc.setFont('helvetica', 'bold')
          doc.text(section.title || 'Custom Section', 14, yPos)
          yPos += 8

          // Convert HTML to plain text for PDF (simple strip tags approach)
          const textContent = section.content
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

          if (textContent) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(10)
            yPos = addText(textContent, 14, yPos, pageWidth - 28)
            yPos += 8
          }

          // Note: Images in custom sections would need additional handling
          // For now, we'll just include the text content
        }
      }
    } else if (reportType === 'test-plan') {
      // Test Plan Report
      const tp = reportData.testPlan

      // Test Plan Details Section
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Test Plan Details', 14, yPos)
      yPos += 8

      const details = [
        ['Key', tp.key || 'N/A'],
        ['Name', tp.name || 'N/A'],
        ['Status', tp.status || 'N/A'],
        ['Phase', tp.phase || 'N/A'],
        ['Description', tp.description || 'N/A'],
      ]

      ;(doc as any).autoTable({
        startY: yPos,
        head: [],
        body: details,
        theme: 'plain',
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 140 },
        },
        margin: { left: 14 },
      })

      yPos = (doc as any).lastAutoTable.finalY + 10

      // Statistics
      if (reportData.statistics) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Statistics', 14, yPos)
        yPos += 8

        const stats = reportData.statistics
        const statsData = [
          ['Total Test Cases', stats.totalCases?.toString() || '0'],
          ['Mandatory', stats.mandatoryCases?.toString() || '0'],
          ['Executed', stats.executed?.toString() || '0'],
          ['Passed', stats.passed?.toString() || '0'],
          ['Failed', stats.failed?.toString() || '0'],
          ['Coverage', `${stats.coveragePercentage || 0}%`],
        ]

        ;(doc as any).autoTable({
          startY: yPos,
          head: [],
          body: statsData,
          theme: 'grid',
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 40 },
          },
          margin: { left: 14 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10
      }

      // Test Cases in Plan
      if (reportData.testCases && reportData.testCases.length > 0) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Test Cases', 14, yPos)
        yPos += 8

        const casesData = reportData.testCases.map((pc: any) => [
          pc.orderIndex + 1,
          pc.testCase?.key || 'N/A',
          pc.testCase?.title || 'N/A',
          pc.testCase?.status || 'N/A',
          pc.isMandatory ? 'Yes' : 'No',
          pc.latestResult?.status || 'Not Run',
        ])

        ;(doc as any).autoTable({
          startY: yPos,
          head: [['#', 'Key', 'Title', 'Status', 'Mandatory', 'Result']],
          body: casesData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10
      }

      // Linked Test Results
      if (reportData.testResults && reportData.testResults.length > 0) {
        if (yPos > 250) {
          doc.addPage()
          yPos = 20
        }

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Linked Test Results', 14, yPos)
        yPos += 8

        const testResultsData = reportData.testResults.map((tr: any) => [
          tr.title || 'N/A',
          tr.resultStatus || 'N/A',
          tr.executedByName || 'N/A',
          formatDate(tr.executedAt),
          tr.testEnvironment || 'N/A',
        ])

        ;(doc as any).autoTable({
          startY: yPos,
          head: [['Title', 'Status', 'Executed By', 'Date', 'Environment']],
          body: testResultsData,
          theme: 'striped',
          headStyles: { fillColor: [34, 197, 94] },
          margin: { left: 14 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10
      }

      // Verifies Elements
      if (reportData.verifiesElements && reportData.verifiesElements.length > 0) {
        if (yPos > 250) {
          doc.addPage()
          yPos = 20
        }

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Verifies Elements', 14, yPos)
        yPos += 8

        const verifiesData = reportData.verifiesElements.map((el: any) => [
          el.type === 'requirement' ? 'Requirement' : 'Function',
          el.id || 'N/A',
          el.name || 'N/A',
        ])

        ;(doc as any).autoTable({
          startY: yPos,
          head: [['Type', 'ID', 'Name']],
          body: verifiesData,
          theme: 'striped',
          headStyles: { fillColor: [147, 51, 234] },
          margin: { left: 14 },
        })
      }
    } else if (reportType === 'test-run') {
      // Test Run Report
      const run = reportData.testRun || {}
      const results = reportData.results || []
      const stats = reportData.statistics || {}

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Test Run Details', 14, yPos)
      yPos += 8

      const details = [
        ['Run name', run.runName || 'N/A'],
        ['Status', run.status || 'N/A'],
        ['Started', formatDate(run.startedAt)],
        ['Ended', formatDate(run.endedAt)],
        ['Duration', run.actualDurationSeconds != null ? `${run.actualDurationSeconds}s` : 'N/A'],
        ['Test plan', run.testPlan ? (run.testPlan.key || run.testPlan.name || 'N/A') : 'N/A'],
        ['Environment', run.environment ? (run.environment.name || run.environment.softwareBuild || 'N/A') : 'N/A'],
      ]

      ;(doc as any).autoTable({
        startY: yPos,
        head: [],
        body: details,
        theme: 'plain',
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 }, 1: { cellWidth: 135 } },
        margin: { left: 14 },
      })
      yPos = (doc as any).lastAutoTable.finalY + 10

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', 14, yPos)
      yPos += 8
      const statsData = [
        ['Total', stats.total?.toString() || '0'],
        ['Pass', stats.pass?.toString() || '0'],
        ['Fail', stats.fail?.toString() || '0'],
        ['Blocked', stats.blocked?.toString() || '0'],
        ['Skipped', stats.skipped?.toString() || '0'],
        ['Not run', stats.notRun?.toString() || '0'],
      ]
      ;(doc as any).autoTable({
        startY: yPos,
        head: [],
        body: statsData,
        theme: 'grid',
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 1: { cellWidth: 30 } },
        margin: { left: 14 },
      })
      yPos = (doc as any).lastAutoTable.finalY + 10

      if (results.length > 0) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('Results', 14, yPos)
        yPos += 8
        const resultsData = results.map((r: any) => [
          r.testCase?.key || 'N/A',
          r.testCase?.title || 'N/A',
          r.resultStatus || 'N/A',
          formatDate(r.executedAt),
          (r.notes || '').slice(0, 40),
        ])
        ;(doc as any).autoTable({
          startY: yPos,
          head: [['Key', 'Title', 'Status', 'Executed at', 'Notes']],
          body: resultsData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          margin: { left: 14 },
        })
      }
    }

    const filename = `${entityName.replace(/[^a-zA-Z0-9-_]/g, '_')}_Report.pdf`
    doc.save(filename)
  }

  const exportToCSV = () => {
    const rows: string[][] = []

    if (reportType === 'test-case') {
      const tc = reportData.testCase

      // Header info
      rows.push(['Test Case Report'])
      rows.push(['Generated', formatDate(reportData.metadata?.generatedAt)])
      rows.push([])

      // Test Case Details
      rows.push(['Test Case Details'])
      rows.push(['Key', tc.key || ''])
      rows.push(['Title', tc.title || ''])
      rows.push(['Status', tc.status || ''])
      rows.push(['Version', tc.version || ''])
      rows.push(['Objective', tc.objective || ''])
      rows.push(['Preconditions', tc.preconditions || ''])
      rows.push(['Pass/Fail Criteria', tc.passFailCriteria || ''])
      rows.push([])

      // Steps
      if (tc.steps && Array.isArray(tc.steps)) {
        rows.push(['Test Procedure'])
        rows.push(['Step', 'Description'])
        tc.steps.forEach((step: string, idx: number) => {
          rows.push([(idx + 1).toString(), step])
        })
        rows.push([])
      }

      // Expected Results
      if (tc.expectedResults && Array.isArray(tc.expectedResults)) {
        rows.push(['Expected Results'])
        rows.push(['#', 'Expected Result'])
        tc.expectedResults.forEach((result: string, idx: number) => {
          rows.push([(idx + 1).toString(), result])
        })
        rows.push([])
      }

      // Test Results
      if (reportData.testResults && reportData.testResults.length > 0) {
        rows.push(['Linked Test Results'])
        rows.push(['Title', 'Status', 'Executed By', 'Date', 'Environment', 'Notes'])
        reportData.testResults.forEach((tr: any) => {
          rows.push([
            tr.title || '',
            tr.resultStatus || '',
            tr.executedByName || '',
            formatDate(tr.executedAt),
            tr.testEnvironment || '',
            tr.notes || '',
          ])
        })
        rows.push([])
      }

      // Verifies Elements
      if (reportData.verifiesElements && reportData.verifiesElements.length > 0) {
        rows.push(['Verifies Elements'])
        rows.push(['Type', 'ID', 'Name'])
        reportData.verifiesElements.forEach((el: any) => {
          rows.push([
            el.type === 'requirement' ? 'Requirement' : 'Function',
            el.id || '',
            el.name || '',
          ])
        })
        rows.push([])
      }

      // Custom Sections
      if (reportData.customSections && reportData.customSections.length > 0) {
        rows.push(['Custom Sections'])
        reportData.customSections.forEach((section: any) => {
          rows.push([`Section: ${section.title || 'Untitled'}`])
          // Strip HTML tags for CSV
          const textContent = section.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          rows.push(['Content', textContent || ''])
          rows.push([])
        })
      }
    } else if (reportType === 'test-plan') {
      const tp = reportData.testPlan

      // Header info
      rows.push(['Test Plan Report'])
      rows.push(['Generated', formatDate(reportData.metadata?.generatedAt)])
      rows.push([])

      // Test Plan Details
      rows.push(['Test Plan Details'])
      rows.push(['Key', tp.key || ''])
      rows.push(['Name', tp.name || ''])
      rows.push(['Status', tp.status || ''])
      rows.push(['Phase', tp.phase || ''])
      rows.push(['Description', tp.description || ''])
      rows.push(['Scope', tp.scope || ''])
      rows.push(['Entry Criteria', tp.entryCriteria || ''])
      rows.push(['Exit Criteria', tp.exitCriteria || ''])
      rows.push([])

      // Statistics
      if (reportData.statistics) {
        rows.push(['Statistics'])
        rows.push(['Total Test Cases', reportData.statistics.totalCases?.toString() || '0'])
        rows.push(['Mandatory', reportData.statistics.mandatoryCases?.toString() || '0'])
        rows.push(['Executed', reportData.statistics.executed?.toString() || '0'])
        rows.push(['Passed', reportData.statistics.passed?.toString() || '0'])
        rows.push(['Failed', reportData.statistics.failed?.toString() || '0'])
        rows.push(['Coverage', `${reportData.statistics.coveragePercentage || 0}%`])
        rows.push([])
      }

      // Test Cases
      if (reportData.testCases && reportData.testCases.length > 0) {
        rows.push(['Test Cases'])
        rows.push(['#', 'Key', 'Title', 'Status', 'Mandatory', 'Result'])
        reportData.testCases.forEach((pc: any) => {
          rows.push([
            (pc.orderIndex + 1).toString(),
            pc.testCase?.key || '',
            pc.testCase?.title || '',
            pc.testCase?.status || '',
            pc.isMandatory ? 'Yes' : 'No',
            pc.latestResult?.status || 'Not Run',
          ])
        })
        rows.push([])
      }

      // Test Results
      if (reportData.testResults && reportData.testResults.length > 0) {
        rows.push(['Linked Test Results'])
        rows.push(['Title', 'Status', 'Executed By', 'Date', 'Environment', 'Notes'])
        reportData.testResults.forEach((tr: any) => {
          rows.push([
            tr.title || '',
            tr.resultStatus || '',
            tr.executedByName || '',
            formatDate(tr.executedAt),
            tr.testEnvironment || '',
            tr.notes || '',
          ])
        })
        rows.push([])
      }

      // Verifies Elements
      if (reportData.verifiesElements && reportData.verifiesElements.length > 0) {
        rows.push(['Verifies Elements'])
        rows.push(['Type', 'ID', 'Name'])
        reportData.verifiesElements.forEach((el: any) => {
          rows.push([
            el.type === 'requirement' ? 'Requirement' : 'Function',
            el.id || '',
            el.name || '',
          ])
        })
        rows.push([])
      }

      // Custom Sections
      if (reportData.customSections && reportData.customSections.length > 0) {
        rows.push(['Custom Sections'])
        reportData.customSections.forEach((section: any) => {
          rows.push([`Section: ${section.title || 'Untitled'}`])
          // Strip HTML tags for CSV
          const textContent = section.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          rows.push(['Content', textContent || ''])
          rows.push([])
        })
      }
    } else if (reportType === 'test-run') {
      const run = reportData.testRun || {}
      const results = reportData.results || []
      const stats = reportData.statistics || {}

      rows.push(['Test Run Report'])
      rows.push(['Generated', formatDate(reportData.metadata?.generatedAt)])
      rows.push([])
      rows.push(['Test Run Details'])
      rows.push(['Run name', run.runName || ''])
      rows.push(['Status', run.status || ''])
      rows.push(['Started', formatDate(run.startedAt)])
      rows.push(['Ended', formatDate(run.endedAt)])
      rows.push(['Duration', run.actualDurationSeconds != null ? `${run.actualDurationSeconds}s` : ''])
      rows.push(['Test plan', run.testPlan ? (run.testPlan.key || run.testPlan.name || '') : ''])
      rows.push(['Environment', run.environment ? (run.environment.name || run.environment.softwareBuild || '') : ''])
      rows.push([])
      rows.push(['Summary'])
      rows.push(['Total', stats.total?.toString() || '0'])
      rows.push(['Pass', stats.pass?.toString() || '0'])
      rows.push(['Fail', stats.fail?.toString() || '0'])
      rows.push(['Blocked', stats.blocked?.toString() || '0'])
      rows.push(['Skipped', stats.skipped?.toString() || '0'])
      rows.push(['Not run', stats.notRun?.toString() || '0'])
      rows.push([])
      if (results.length > 0) {
        rows.push(['Results'])
        rows.push(['Key', 'Title', 'Status', 'Executed at', 'Notes'])
        results.forEach((r: any) => {
          rows.push([
            r.testCase?.key || '',
            r.testCase?.title || '',
            r.resultStatus || '',
            formatDate(r.executedAt),
            (r.notes || '').slice(0, 200),
          ])
        })
        rows.push([])
      }
    }

    // Convert to CSV string
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

    const filename = `${entityName.replace(/[^a-zA-Z0-9-_]/g, '_')}_Report.csv`
    downloadFile(csvContent, filename, 'text/csv')
  }

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(reportData, null, 2)
    const filename = `${entityName.replace(/[^a-zA-Z0-9-_]/g, '_')}_Report.json`
    downloadFile(jsonContent, filename, 'application/json')
  }

  const exportToWord = async () => {
    const { Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType, AlignmentType, Packer } = await loadDocx()

    const children: any[] = []

    // Helper function to create a styled paragraph
    const createParagraph = (text: string, options: { bold?: boolean; size?: number; heading?: any; spacing?: number } = {}) => {
      return new Paragraph({
        heading: options.heading,
        spacing: { after: options.spacing || 100 },
        children: [
          new TextRun({
            text: text || '',
            bold: options.bold,
            size: options.size || 24, // size is in half-points
          }),
        ],
      })
    }

    // Helper function to create a table
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
    const wordTitle = reportType === 'test-case' ? 'Test Case Report' : reportType === 'test-plan' ? 'Test Plan Report' : 'Test Run Report'
    children.push(createParagraph(wordTitle, { heading: HeadingLevel.HEADING_1, size: 36 }))
    children.push(createParagraph(`Generated: ${formatDate(reportData.metadata?.generatedAt)}`, { size: 20 }))
    children.push(createParagraph(''))

    if (reportType === 'test-case') {
      const tc = reportData.testCase

      // Test Case Details
      children.push(createParagraph('Test Case Details', { heading: HeadingLevel.HEADING_2, size: 28 }))
      children.push(createParagraph(`Key: ${tc.key || 'N/A'}`))
      children.push(createParagraph(`Title: ${tc.title || 'N/A'}`))
      children.push(createParagraph(`Status: ${tc.status || 'N/A'}`))
      children.push(createParagraph(`Version: ${tc.version || 'N/A'}`))
      children.push(createParagraph(`Objective: ${tc.objective || 'N/A'}`))
      children.push(createParagraph(''))

      if (tc.preconditions) {
        children.push(createParagraph('Preconditions', { heading: HeadingLevel.HEADING_3, size: 26 }))
        children.push(createParagraph(tc.preconditions))
        children.push(createParagraph(''))
      }

      // Steps
      if (tc.steps && Array.isArray(tc.steps) && tc.steps.length > 0) {
        children.push(createParagraph('Test Procedure', { heading: HeadingLevel.HEADING_3, size: 26 }))
        const stepsRows = tc.steps.map((step: string, idx: number) => [(idx + 1).toString(), step])
        children.push(createTable(['Step', 'Description'], stepsRows))
        children.push(createParagraph(''))
      }

      // Expected Results
      if (tc.expectedResults && Array.isArray(tc.expectedResults) && tc.expectedResults.length > 0) {
        children.push(createParagraph('Expected Results', { heading: HeadingLevel.HEADING_3, size: 26 }))
        const resultsRows = tc.expectedResults.map((result: string, idx: number) => [(idx + 1).toString(), result])
        children.push(createTable(['#', 'Expected Result'], resultsRows))
        children.push(createParagraph(''))
      }

      // Pass/Fail Criteria
      if (tc.passFailCriteria) {
        children.push(createParagraph('Pass/Fail Criteria', { heading: HeadingLevel.HEADING_3, size: 26 }))
        children.push(createParagraph(tc.passFailCriteria))
        children.push(createParagraph(''))
      }

      // Test Results
      if (reportData.testResults && reportData.testResults.length > 0) {
        children.push(createParagraph('Linked Test Results', { heading: HeadingLevel.HEADING_2, size: 28 }))
        const trRows = reportData.testResults.map((tr: any) => [
          tr.title || 'N/A',
          tr.resultStatus || 'N/A',
          tr.executedByName || 'N/A',
          formatDate(tr.executedAt),
          tr.testEnvironment || 'N/A',
        ])
        children.push(createTable(['Title', 'Status', 'Executed By', 'Date', 'Environment'], trRows))
        children.push(createParagraph(''))
      }

      // Verifies Elements
      if (reportData.verifiesElements && reportData.verifiesElements.length > 0) {
        children.push(createParagraph('Verifies Elements', { heading: HeadingLevel.HEADING_2, size: 28 }))
        const verifiesRows = reportData.verifiesElements.map((el: any) => [
          el.type === 'requirement' ? 'Requirement' : 'Function',
          el.id || 'N/A',
          el.name || 'N/A',
        ])
        children.push(createTable(['Type', 'ID', 'Name'], verifiesRows))
        children.push(createParagraph(''))
      }

      // Custom Sections
      if (reportData.customSections && reportData.customSections.length > 0) {
        for (const section of reportData.customSections) {
          children.push(createParagraph(section.title || 'Custom Section', { heading: HeadingLevel.HEADING_2, size: 28 }))
          // Convert HTML to plain text for Word
          const textContent = section.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          if (textContent) {
            children.push(createParagraph(textContent))
          }
          children.push(createParagraph(''))
        }
      }
    } else if (reportType === 'test-plan') {
      const tp = reportData.testPlan

      // Test Plan Details
      children.push(createParagraph('Test Plan Details', { heading: HeadingLevel.HEADING_2, size: 28 }))
      children.push(createParagraph(`Key: ${tp.key || 'N/A'}`))
      children.push(createParagraph(`Name: ${tp.name || 'N/A'}`))
      children.push(createParagraph(`Status: ${tp.status || 'N/A'}`))
      children.push(createParagraph(`Phase: ${tp.phase || 'N/A'}`))
      children.push(createParagraph(`Description: ${tp.description || 'N/A'}`))
      children.push(createParagraph(`Scope: ${tp.scope || 'N/A'}`))
      children.push(createParagraph(`Entry Criteria: ${tp.entryCriteria || 'N/A'}`))
      children.push(createParagraph(`Exit Criteria: ${tp.exitCriteria || 'N/A'}`))
      children.push(createParagraph(''))

      // Statistics
      if (reportData.statistics) {
        children.push(createParagraph('Statistics', { heading: HeadingLevel.HEADING_2, size: 28 }))
        const stats = reportData.statistics
        children.push(createParagraph(`Total Test Cases: ${stats.totalCases || 0}`))
        children.push(createParagraph(`Mandatory: ${stats.mandatoryCases || 0}`))
        children.push(createParagraph(`Executed: ${stats.executed || 0}`))
        children.push(createParagraph(`Passed: ${stats.passed || 0}`))
        children.push(createParagraph(`Failed: ${stats.failed || 0}`))
        children.push(createParagraph(`Coverage: ${stats.coveragePercentage || 0}%`))
        children.push(createParagraph(''))
      }

      // Test Cases
      if (reportData.testCases && reportData.testCases.length > 0) {
        children.push(createParagraph('Test Cases', { heading: HeadingLevel.HEADING_2, size: 28 }))
        const casesRows = reportData.testCases.map((pc: any) => [
          (pc.orderIndex + 1).toString(),
          pc.testCase?.key || 'N/A',
          pc.testCase?.title || 'N/A',
          pc.testCase?.status || 'N/A',
          pc.isMandatory ? 'Yes' : 'No',
          pc.latestResult?.status || 'Not Run',
        ])
        children.push(createTable(['#', 'Key', 'Title', 'Status', 'Mandatory', 'Result'], casesRows))
        children.push(createParagraph(''))
      }

      // Test Results
      if (reportData.testResults && reportData.testResults.length > 0) {
        children.push(createParagraph('Linked Test Results', { heading: HeadingLevel.HEADING_2, size: 28 }))
        const trRows = reportData.testResults.map((tr: any) => [
          tr.title || 'N/A',
          tr.resultStatus || 'N/A',
          tr.executedByName || 'N/A',
          formatDate(tr.executedAt),
          tr.testEnvironment || 'N/A',
        ])
        children.push(createTable(['Title', 'Status', 'Executed By', 'Date', 'Environment'], trRows))
        children.push(createParagraph(''))
      }

      // Verifies Elements
      if (reportData.verifiesElements && reportData.verifiesElements.length > 0) {
        children.push(createParagraph('Verifies Elements', { heading: HeadingLevel.HEADING_2, size: 28 }))
        const verifiesRows = reportData.verifiesElements.map((el: any) => [
          el.type === 'requirement' ? 'Requirement' : 'Function',
          el.id || 'N/A',
          el.name || 'N/A',
        ])
        children.push(createTable(['Type', 'ID', 'Name'], verifiesRows))
        children.push(createParagraph(''))
      }

      // Custom Sections
      if (reportData.customSections && reportData.customSections.length > 0) {
        for (const section of reportData.customSections) {
          children.push(createParagraph(section.title || 'Custom Section', { heading: HeadingLevel.HEADING_2, size: 28 }))
          // Convert HTML to plain text for Word
          const textContent = section.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          if (textContent) {
            children.push(createParagraph(textContent))
          }
          children.push(createParagraph(''))
        }
      }
    } else if (reportType === 'test-run') {
      const run = reportData.testRun || {}
      const results = reportData.results || []
      const stats = reportData.statistics || {}

      children.push(createParagraph('Test Run Details', { heading: HeadingLevel.HEADING_2, size: 28 }))
      children.push(createParagraph(`Run name: ${run.runName || 'N/A'}`))
      children.push(createParagraph(`Status: ${run.status || 'N/A'}`))
      children.push(createParagraph(`Started: ${formatDate(run.startedAt)}`))
      children.push(createParagraph(`Ended: ${formatDate(run.endedAt)}`))
      children.push(createParagraph(`Duration: ${run.actualDurationSeconds != null ? `${run.actualDurationSeconds}s` : 'N/A'}`))
      children.push(createParagraph(`Test plan: ${run.testPlan ? (run.testPlan.key || run.testPlan.name || 'N/A') : 'N/A'}`))
      children.push(createParagraph(`Environment: ${run.environment ? (run.environment.name || run.environment.softwareBuild || 'N/A') : 'N/A'}`))
      children.push(createParagraph(''))

      children.push(createParagraph('Summary', { heading: HeadingLevel.HEADING_2, size: 28 }))
      children.push(createParagraph(`Total: ${stats.total ?? 0}  Pass: ${stats.pass ?? 0}  Fail: ${stats.fail ?? 0}  Blocked: ${stats.blocked ?? 0}  Skipped: ${stats.skipped ?? 0}  Not run: ${stats.notRun ?? 0}`))
      children.push(createParagraph(''))

      if (results.length > 0) {
        children.push(createParagraph('Results', { heading: HeadingLevel.HEADING_2, size: 28 }))
        const resultsRows = results.map((r: any) => [
          r.testCase?.key || 'N/A',
          r.testCase?.title || 'N/A',
          r.resultStatus || 'N/A',
          formatDate(r.executedAt),
          (r.notes || '').slice(0, 80),
        ])
        children.push(createTable(['Key', 'Title', 'Status', 'Executed at', 'Notes'], resultsRows))
        children.push(createParagraph(''))
      }
    }

    const doc = new Document({
      sections: [{ children }],
    })

    const blob = await Packer.toBlob(doc)
    const filename = `${entityName.replace(/[^a-zA-Z0-9-_]/g, '_')}_Report.docx`
    downloadFile(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      switch (selectedFormat) {
        case 'pdf':
          await exportToPDF()
          break
        case 'csv':
          exportToCSV()
          break
        case 'json':
          exportToJSON()
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Report</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Export <span className="font-medium text-gray-900 dark:text-white">{entityName}</span>
          </p>

          {/* Format Selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {(Object.entries(formatInfo) as [ExportFormat, typeof formatInfo['pdf']][]).map(([format, info]) => {
              const Icon = info.icon
              return (
                <button
                  key={format}
                  onClick={() => setSelectedFormat(format)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedFormat === format
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <Icon
                    size={24}
                    className={`mx-auto mb-2 ${
                      selectedFormat === format
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  />
                  <div
                    className={`font-medium ${
                      selectedFormat === format
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {info.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{info.description}</div>
                </button>
              )
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Preview Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Report Contents</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• {reportType === 'test-case' ? 'Test case details and procedure' : reportType === 'test-plan' ? 'Test plan details and scope' : 'Test run details and results'}</li>
              {reportType === 'test-case' && <li>• Steps and expected results</li>}
              {reportType === 'test-plan' && <li>• Statistics and test cases list</li>}
              {reportType === 'test-run' && reportData.results?.length > 0 && <li>• {reportData.results.length} result(s)</li>}
              {reportData.testResults?.length > 0 && (
                <li>• {reportData.testResults.length} linked test result(s)</li>
              )}
              {reportData.verifiesElements?.length > 0 && (
                <li>• {reportData.verifiesElements.length} verified element(s)</li>
              )}
              {reportData.customSections?.length > 0 && (
                <li>• {reportData.customSections.length} custom section(s)</li>
              )}
            </ul>
          </div>
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
            disabled={isExporting}
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
