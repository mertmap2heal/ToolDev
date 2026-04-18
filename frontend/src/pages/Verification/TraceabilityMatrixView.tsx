import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { traceabilityService } from '../../services/traceability.service'
import { invalidateLinkCaches } from '../../utils/invalidateLinkCaches'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Grid3X3,
  List,
  ChevronDown,
  ChevronRight,
  X,
  RefreshCw,
  FileText,
  ClipboardCheck,
  Play,
  LinkIcon,
  Eye,
  EyeOff,
  Plus,
  Loader,
} from 'lucide-react'
import clsx from 'clsx'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { jsPDF } from 'jspdf'
import { csvSafeRows } from '../../utils/csvExport'

let autoTableModule: any = null
async function loadAutoTable() {
  if (!autoTableModule) {
    autoTableModule = await import('jspdf-autotable')
  }
  return autoTableModule.default || autoTableModule
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RunResult {
  id: string
  resultStatus: string
  executedAt: string | null
  isOutOfSync: boolean
  testRunId: string
  testRunName: string
}

interface TestCaseEntry {
  testCaseId: string
  testCaseKey: string
  testCaseTitle: string
  traceLinkId: string
  testPlanIds: string[]
  testPlanKeys: string[]
  latestRunResult: RunResult | null
  recentRunResults: RunResult[]
  gapReason: 'NO_RUN' | 'OUT_OF_SYNC' | 'NOT_PASSED' | 'OK'
}

interface MatrixRow {
  requirementId: string
  requirementKey: string
  requirementTitle: string
  testCases: TestCaseEntry[]
  verified: boolean
}

interface CoverageSummary {
  totalRequirements: number
  linkedRequirements: number
  verified: number
  gaps: number
  coveragePercent: number
  totalTestCases: number
  totalTestPlans: number
  totalTestRuns: number
}

interface TestPlanSummary {
  id: string
  key: string
  name: string
  status: string
  caseCount: number
  verifiedCount: number
}

interface TestCaseColumn {
  id: string
  key: string
  title: string
  planIds: string[]
  planKeys: string[]
}

interface UnlinkedRequirement {
  id: string
  key: string
  title: string
}

interface FullTraceabilityData {
  rows: MatrixRow[]
  coverageSummary: CoverageSummary
  testPlans: TestPlanSummary[]
  testCaseColumns: TestCaseColumn[]
  allTestCaseColumns: TestCaseColumn[]
  linkMap: Record<string, Record<string, string>>
  unlinkedRequirements: UnlinkedRequirement[]
}

type ViewMode = 'grid' | 'table'
type SortField = 'requirementKey' | 'requirementTitle' | 'verified' | 'testCaseCount'
type SortDir = 'asc' | 'desc'
type DetailGrouping = 'flat' | 'requirement' | 'plan'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CARD = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg'
const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
const BTN_SECONDARY = 'flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 transition-colors'

function gapBadge(reason: string) {
  switch (reason) {
    case 'OK':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle size={12} /> Verified
        </span>
      )
    case 'NO_RUN':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          No Run
        </span>
      )
    case 'OUT_OF_SYNC':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle size={12} /> Out of sync
        </span>
      )
    case 'NOT_PASSED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          <XCircle size={12} /> Not passed
        </span>
      )
    case 'NO_LINKED_TEST_CASE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
          <LinkIcon size={12} /> No test case
        </span>
      )
    default:
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {reason}
        </span>
      )
  }
}

function cellColor(reason: string | undefined): string {
  switch (reason) {
    case 'OK': return 'bg-green-500 dark:bg-green-600'
    case 'NOT_PASSED': return 'bg-red-500 dark:bg-red-600'
    case 'OUT_OF_SYNC': return 'bg-amber-400 dark:bg-amber-500'
    case 'NO_RUN': return 'bg-gray-300 dark:bg-gray-600'
    default: return 'bg-gray-100 dark:bg-gray-800'
  }
}

function cellTooltip(reason: string | undefined, result: RunResult | null): string {
  if (!reason || reason === 'OK') {
    if (result) return `${result.resultStatus} — ${result.testRunName}${result.executedAt ? ` (${new Date(result.executedAt).toLocaleDateString()})` : ''}`
    return 'Verified'
  }
  if (reason === 'NO_RUN') return 'No test run executed'
  if (reason === 'OUT_OF_SYNC') return `Out of sync — ${result?.testRunName ?? ''}`
  if (reason === 'NOT_PASSED') return `${result?.resultStatus ?? 'Failed'} — ${result?.testRunName ?? ''}`
  return reason
}

function flattenForExport(rows: MatrixRow[], unlinked: UnlinkedRequirement[]) {
  const flat: Record<string, string>[] = []
  for (const row of rows) {
    if (row.testCases.length) {
      for (const tc of row.testCases) {
        flat.push({
          'Requirement Key': row.requirementKey,
          'Requirement Title': row.requirementTitle,
          'Test Plans': tc.testPlanKeys.join(', '),
          'Test Case Key': tc.testCaseKey,
          'Test Case Title': tc.testCaseTitle,
          'Latest Run': tc.latestRunResult?.testRunName ?? '',
          'Run Status': tc.latestRunResult?.resultStatus ?? '',
          'Gap Reason': tc.gapReason,
          'Executed At': tc.latestRunResult?.executedAt ? new Date(tc.latestRunResult.executedAt).toLocaleString() : '',
          Verified: row.verified ? 'Yes' : 'No',
        })
      }
    } else {
      flat.push({
        'Requirement Key': row.requirementKey,
        'Requirement Title': row.requirementTitle,
        'Test Plans': '',
        'Test Case Key': '',
        'Test Case Title': '',
        'Latest Run': '',
        'Run Status': '',
        'Gap Reason': 'NO_LINKED_TEST_CASE',
        'Executed At': '',
        Verified: 'No',
      })
    }
  }
  for (const u of unlinked) {
    flat.push({
      'Requirement Key': u.key,
      'Requirement Title': u.title,
      'Test Plans': '',
      'Test Case Key': '',
      'Test Case Title': '',
      'Latest Run': '',
      'Run Status': '',
      'Gap Reason': 'NO_LINKED_TEST_CASE',
      'Executed At': '',
      Verified: 'No',
    })
  }
  return flat
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TraceabilityMatrixView() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const matrixReqId = searchParams.get('matrixReqId') || ''
  const matrixCaseId = searchParams.get('matrixCaseId') || ''

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [reqSearch, setReqSearch] = useState(matrixReqId)
  const [caseSearch, setCaseSearch] = useState(matrixCaseId)
  const [gapFilter, setGapFilter] = useState('')
  const [planFilter, setPlanFilter] = useState<string[]>([])
  const [showGapsOnly, setShowGapsOnly] = useState(false)
  const [sortField, setSortField] = useState<SortField>('requirementKey')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [detailGrouping, setDetailGrouping] = useState<DetailGrouping>('flat')
  const [gapsPanelOpen, setGapsPanelOpen] = useState(false)
  const [popover, setPopover] = useState<{ tcId: string; reqId: string; x: number; y: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkDialogReqId, setLinkDialogReqId] = useState<string | null>(null)
  const [linkDialogTcId, setLinkDialogTcId] = useState<string | null>(null)
  const [linkRationale, setLinkRationale] = useState('')
  const [showLinkedOnly, setShowLinkedOnly] = useState(true)

  // Data fetching
  const { data, isLoading } = useQuery({
    queryKey: ['traceability-matrix-full', projectId],
    queryFn: async () => {
      const res = (await verificationService.getFullTraceabilityMatrix(projectId!)) as {
        success?: boolean
        data?: FullTraceabilityData
      }
      return res.success ? res.data! : null
    },
    enabled: !!projectId,
  })

  const rows = data?.rows ?? []
  const summary = data?.coverageSummary ?? {
    totalRequirements: 0, linkedRequirements: 0, verified: 0, gaps: 0,
    coveragePercent: 0, totalTestCases: 0, totalTestPlans: 0, totalTestRuns: 0,
  }
  const testPlans = data?.testPlans ?? []
  const testCaseColumns = data?.testCaseColumns ?? []
  const allTestCaseColumns = data?.allTestCaseColumns ?? []
  const serverLinkMap = data?.linkMap ?? {}
  const unlinkedRequirements = data?.unlinkedRequirements ?? []

  // All requirements (linked + unlinked) for the grid
  const allRequirements = useMemo(() => {
    const linked = rows.map((r) => ({ id: r.requirementId, key: r.requirementKey, title: r.requirementTitle }))
    const unlinked = unlinkedRequirements.map((u) => ({ id: u.id, key: u.key, title: u.title }))
    const all = [...linked, ...unlinked]
    all.sort((a, b) => a.key.localeCompare(b.key))
    return all
  }, [rows, unlinkedRequirements])

  // Deep-link sync
  useEffect(() => { if (matrixReqId) setReqSearch(matrixReqId) }, [matrixReqId])
  useEffect(() => { if (matrixCaseId) setCaseSearch(matrixCaseId) }, [matrixCaseId])

  // Close popover on outside click
  useEffect(() => {
    if (!popover) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopover(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popover])

  // ─── Link mutations ───────────────────────────────────────────────────────

  const createLinkMutation = useMutation({
    mutationFn: async ({ reqId, tcId, rationale }: { reqId: string; tcId: string; rationale?: string }) => {
      return traceabilityService.createTraceLink(projectId!, {
        sourceType: 'test_case' as any,
        sourceId: tcId,
        targetType: 'requirement' as any,
        targetId: reqId,
        linkType: 'verifies' as any,
        rationale,
      })
    },
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId!)
      queryClient.invalidateQueries({ queryKey: ['traceability-matrix-full', projectId] })
      setShowLinkDialog(false)
      setLinkDialogReqId(null)
      setLinkDialogTcId(null)
      setLinkRationale('')
    },
    onError: (error: any) => {
      console.error('Create link error:', error)
      alert(error?.error || 'Failed to create verifies link')
    },
  })

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return traceabilityService.deleteTraceLink(projectId!, linkId)
    },
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId!)
      queryClient.invalidateQueries({ queryKey: ['traceability-matrix-full', projectId] })
    },
    onError: (error: any) => {
      console.error('Delete link error:', error)
      alert(error?.error || 'Failed to delete verifies link')
    },
  })

  const handleGridCellClick = (reqId: string, tcId: string) => {
    const linkId = serverLinkMap[reqId]?.[tcId]
    if (linkId) {
      if (window.confirm('Do you want to remove this verifies link?')) {
        deleteLinkMutation.mutate(linkId)
      }
    } else {
      setLinkDialogReqId(reqId)
      setLinkDialogTcId(tcId)
      setLinkRationale('')
      setShowLinkDialog(true)
    }
  }

  const handleCreateLink = () => {
    if (!linkDialogReqId || !linkDialogTcId) return
    createLinkMutation.mutate({
      reqId: linkDialogReqId,
      tcId: linkDialogTcId,
      rationale: linkRationale || undefined,
    })
  }

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    const reqQ = reqSearch.trim().toLowerCase()
    const caseQ = caseSearch.trim().toLowerCase()
    const gapQ = gapFilter.trim()
    const planSet = new Set(planFilter)
    const hasPlanFilter = planSet.size > 0

    return rows.filter((row) => {
      if (reqQ && !row.requirementKey.toLowerCase().includes(reqQ) && !row.requirementTitle.toLowerCase().includes(reqQ)) return false
      if (showGapsOnly && row.verified) return false

      const tcs = row.testCases
      if (caseQ && !tcs.some((tc) => tc.testCaseKey.toLowerCase().includes(caseQ) || tc.testCaseTitle.toLowerCase().includes(caseQ))) return false
      if (gapQ && !tcs.some((tc) => tc.gapReason === gapQ)) return false
      if (hasPlanFilter && !tcs.some((tc) => tc.testPlanIds.some((pid) => planSet.has(pid)))) return false
      return true
    })
  }, [rows, reqSearch, caseSearch, gapFilter, planFilter, showGapsOnly])

  // ─── Sorting ───────────────────────────────────────────────────────────────

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'requirementKey': cmp = a.requirementKey.localeCompare(b.requirementKey); break
        case 'requirementTitle': cmp = a.requirementTitle.localeCompare(b.requirementTitle); break
        case 'verified': cmp = (a.verified ? 1 : 0) - (b.verified ? 1 : 0); break
        case 'testCaseCount': cmp = a.testCases.length - b.testCases.length; break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [filteredRows, sortField, sortDir])

  // ─── Grid columns (filtered) ──────────────────────────────────────────────

  const baseColumns = showLinkedOnly ? testCaseColumns : allTestCaseColumns
  const filteredColumns = useMemo(() => {
    const caseQ = caseSearch.trim().toLowerCase()
    const planSet = new Set(planFilter)
    const hasPlanFilter = planSet.size > 0
    return baseColumns.filter((col) => {
      if (caseQ && !col.key.toLowerCase().includes(caseQ) && !col.title.toLowerCase().includes(caseQ)) return false
      if (hasPlanFilter && !col.planIds.some((pid) => planSet.has(pid))) return false
      return true
    })
  }, [baseColumns, caseSearch, planFilter])

  // Group columns by plan for header spans
  const columnPlanGroups = useMemo(() => {
    const groups: { planKey: string; planId: string; planName: string; cols: TestCaseColumn[] }[] = []
    const noPlanCols: TestCaseColumn[] = []
    const planMap = new Map(testPlans.map((p) => [p.id, p]))

    for (const col of filteredColumns) {
      if (col.planIds.length === 0) {
        noPlanCols.push(col)
        continue
      }
      const pid = col.planIds[0]
      const plan = planMap.get(pid)
      let group = groups.find((g) => g.planId === pid)
      if (!group) {
        group = { planKey: plan?.key ?? '', planId: pid, planName: plan?.name ?? pid, cols: [] }
        groups.push(group)
      }
      group.cols.push(col)
    }
    if (noPlanCols.length) groups.push({ planKey: '', planId: '', planName: 'Unassigned', cols: noPlanCols })
    return groups
  }, [filteredColumns, testPlans])

  // Cell lookup: reqId -> tcId -> entry
  const cellLookup = useMemo(() => {
    const map = new Map<string, Map<string, TestCaseEntry>>()
    for (const row of rows) {
      const inner = new Map<string, TestCaseEntry>()
      for (const tc of row.testCases) inner.set(tc.testCaseId, tc)
      map.set(row.requirementId, inner)
    }
    return map
  }, [rows])

  // ─── Clear filters ─────────────────────────────────────────────────────────

  const clearFilters = useCallback(() => {
    setReqSearch('')
    setCaseSearch('')
    setGapFilter('')
    setPlanFilter([])
    setShowGapsOnly(false)
    setSearchParams((p) => {
      const n = new URLSearchParams(p)
      n.delete('matrixReqId')
      n.delete('matrixCaseId')
      return n
    }, { replace: true })
  }, [setSearchParams])

  const hasActiveFilters = reqSearch || caseSearch || gapFilter || planFilter.length > 0 || showGapsOnly

  // ─── Sorting toggle ───────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return null
    return <span className="ml-1 text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  const openRequirement = (reqId: string) => navigate(`/projects/${projectId}/requirements?requirementId=${reqId}`)
  const openTestCase = (tcId: string) => {
    setSearchParams((p) => {
      const n = new URLSearchParams(p)
      n.set('focusType', 'test-case')
      n.set('focusId', tcId)
      return n
    }, { replace: true })
  }
  const openTestRun = (runId: string) => navigate(`/projects/${projectId}/verification?tab=runs&focusType=test-run&focusId=${runId}`)

  // ─── Export ────────────────────────────────────────────────────────────────

  const exportData = useCallback(() => flattenForExport(sortedRows, showGapsOnly ? [] : unlinkedRequirements), [sortedRows, unlinkedRequirements, showGapsOnly])

  const handleExportCsv = () => {
    // #269: every string cell is passed through csvSafeRow so formula
    // triggers get a leading single-quote before Papa.unparse writes them.
    const csv = Papa.unparse(csvSafeRows(exportData()))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Traceability_Matrix_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    // #269: Excel honours formulas too — neutralise triggers before
    // handing rows to XLSX.
    const ws = XLSX.utils.json_to_sheet(csvSafeRows(exportData()))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Traceability Matrix')
    XLSX.writeFile(wb, `Traceability_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const handleExportPdf = async () => {
    const autoTable = await loadAutoTable()
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Verification Traceability Matrix', 14, 18)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleString()} — ${summary.totalRequirements} requirements, ${summary.verified} verified, ${summary.gaps} gaps`, 14, 24)
    // PDF exports are static tables so there is no formula trigger
    // risk, but neutralising keeps the apostrophe visible if the cell
    // was malicious-looking — consistent with the CSV / XLSX output.
    const flat = csvSafeRows(exportData())
    const cols = Object.keys(flat[0] || {})
    autoTable(doc, {
      startY: 30,
      head: [cols],
      body: flat.map((r) => cols.map((c) => (r as any)[c] ?? '')),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    })
    doc.save(`Traceability_Matrix_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // ─── Gaps data ─────────────────────────────────────────────────────────────

  const gapsData = useMemo(() => {
    const gaps: { requirementId: string; requirementKey: string; testCaseId: string; testCaseKey: string; gapReason: string }[] = []
    for (const row of rows) {
      for (const tc of row.testCases) {
        if (tc.gapReason !== 'OK') gaps.push({ requirementId: row.requirementId, requirementKey: row.requirementKey, testCaseId: tc.testCaseId, testCaseKey: tc.testCaseKey, gapReason: tc.gapReason })
      }
      if (row.testCases.length === 0) gaps.push({ requirementId: row.requirementId, requirementKey: row.requirementKey, testCaseId: '', testCaseKey: '', gapReason: 'NO_LINKED_TEST_CASE' })
    }
    for (const u of unlinkedRequirements) {
      gaps.push({ requirementId: u.id, requirementKey: u.key, testCaseId: '', testCaseKey: '', gapReason: 'NO_LINKED_TEST_CASE' })
    }
    return gaps
  }, [rows, unlinkedRequirements])

  const gapsByReason = useMemo(() => {
    const map = new Map<string, typeof gapsData>()
    for (const g of gapsData) {
      const list = map.get(g.gapReason) ?? []
      list.push(g)
      map.set(g.gapReason, list)
    }
    return map
  }, [gapsData])

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="animate-spin text-gray-400 mr-2" size={20} />
        <span className="text-gray-500 dark:text-gray-400">Loading traceability matrix…</span>
      </div>
    )
  }

  // ─── Coverage ring (SVG) ───────────────────────────────────────────────────

  const ringRadius = 36
  const ringCirc = 2 * Math.PI * ringRadius
  const verifiedPct = summary.totalRequirements > 0 ? summary.verified / summary.totalRequirements : 0
  const linkedPct = summary.totalRequirements > 0 ? summary.linkedRequirements / summary.totalRequirements : 0
  const unlinkedPct = 1 - linkedPct

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Section 1: Dashboard ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
        {/* Coverage ring */}
        <div className={clsx(CARD, 'p-5 flex flex-col items-center justify-center')}>
          <svg width="100" height="100" viewBox="0 0 100 100" className="mb-2">
            <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="8" />
            {unlinkedPct > 0 && (
              <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="currentColor" className="text-purple-400 dark:text-purple-500"
                strokeWidth="8" strokeDasharray={`${unlinkedPct * ringCirc} ${ringCirc}`}
                strokeDashoffset={`${-verifiedPct * ringCirc - (linkedPct - verifiedPct) * ringCirc}`}
                transform="rotate(-90 50 50)" strokeLinecap="round" />
            )}
            {(linkedPct - verifiedPct) > 0 && (
              <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="currentColor" className="text-amber-400 dark:text-amber-500"
                strokeWidth="8" strokeDasharray={`${(linkedPct - verifiedPct) * ringCirc} ${ringCirc}`}
                strokeDashoffset={`${-verifiedPct * ringCirc}`}
                transform="rotate(-90 50 50)" strokeLinecap="round" />
            )}
            {verifiedPct > 0 && (
              <circle cx="50" cy="50" r={ringRadius} fill="none" stroke="currentColor" className="text-green-500 dark:text-green-400"
                strokeWidth="8" strokeDasharray={`${verifiedPct * ringCirc} ${ringCirc}`}
                transform="rotate(-90 50 50)" strokeLinecap="round" />
            )}
            <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-gray-900 dark:fill-white text-lg font-bold">
              {summary.coveragePercent}%
            </text>
          </svg>
          <div className="text-sm font-medium text-gray-900 dark:text-white">Coverage</div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Verified</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Gaps</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Unlinked</span>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className={clsx(CARD, 'p-4')}>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total Requirements</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.totalRequirements}</div>
            <div className="text-xs text-gray-400 mt-1">{summary.linkedRequirements} linked</div>
          </div>
          <div className={clsx(CARD, 'p-4')}>
            <div className="text-xs text-gray-500 dark:text-gray-400">Verified</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{summary.verified}</div>
            <div className="text-xs text-gray-400 mt-1">{summary.coveragePercent}% of total</div>
          </div>
          <div className={clsx(CARD, 'p-4')}>
            <div className="text-xs text-gray-500 dark:text-gray-400">Coverage Gaps</div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{summary.gaps}</div>
            <button type="button" onClick={() => { setShowGapsOnly(true); setGapsPanelOpen(true) }}
              className="text-xs text-blue-500 hover:underline mt-1">View gaps</button>
          </div>
          <div className={clsx(CARD, 'p-4')}>
            <div className="text-xs text-gray-500 dark:text-gray-400">Unlinked Reqs</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{unlinkedRequirements.length}</div>
            <div className="text-xs text-gray-400 mt-1">No test case link</div>
          </div>
          <div className={clsx(CARD, 'p-4 flex items-center gap-3')}>
            <FileText size={20} className="text-blue-500 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Test Plans</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.totalTestPlans}</div>
            </div>
          </div>
          <div className={clsx(CARD, 'p-4 flex items-center gap-3')}>
            <ClipboardCheck size={20} className="text-blue-500 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Test Cases</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.totalTestCases}</div>
            </div>
          </div>
          <div className={clsx(CARD, 'p-4 flex items-center gap-3')}>
            <Play size={20} className="text-blue-500 shrink-0" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Test Runs</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{summary.totalTestRuns}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-plan progress */}
      {testPlans.length > 0 && (
        <div className={clsx(CARD, 'p-4')}>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Test Plan Coverage</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {testPlans.map((plan) => {
              const pct = plan.caseCount > 0 ? Math.round((plan.verifiedCount / plan.caseCount) * 100) : 0
              return (
                <button key={plan.id} type="button"
                  onClick={() => { setPlanFilter([plan.id]); setViewMode('table') }}
                  className="text-left border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{plan.key}</span>
                    <span className={clsx('text-xs px-1.5 py-0.5 rounded font-medium', plan.status === 'APPROVED' || plan.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300')}>
                      {plan.status}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white mt-1 line-clamp-1">{plan.name}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{plan.verifiedCount}/{plan.caseCount} cases verified</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Filters + view toggle ───────────────────────────────────────────── */}
      <div className={clsx(CARD, 'p-4')}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Requirement</label>
            <input value={reqSearch} onChange={(e) => setReqSearch(e.target.value)} placeholder="Search key/title…" className={INPUT} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Test Case</label>
            <input value={caseSearch} onChange={(e) => setCaseSearch(e.target.value)} placeholder="Search key/title…" className={INPUT} />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gap Reason</label>
            <select value={gapFilter} onChange={(e) => setGapFilter(e.target.value)} className={INPUT}>
              <option value="">All</option>
              <option value="OK">OK</option>
              <option value="NO_RUN">No Run</option>
              <option value="OUT_OF_SYNC">Out of Sync</option>
              <option value="NOT_PASSED">Not Passed</option>
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Test Plan</label>
            <select value={planFilter[0] ?? ''} onChange={(e) => setPlanFilter(e.target.value ? [e.target.value] : [])} className={INPUT}>
              <option value="">All Plans</option>
              {testPlans.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setShowGapsOnly((v) => !v)}
            className={clsx(BTN_SECONDARY, showGapsOnly && 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400')}>
            {showGapsOnly ? <EyeOff size={14} /> : <Eye size={14} />}
            {showGapsOnly ? 'Gaps only' : 'Show all'}
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters}
              className="px-2 py-2 text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1">
              <X size={12} /> Clear all
            </button>
          )}
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button type="button" onClick={() => setViewMode('grid')}
              className={clsx('px-3 py-2 text-sm flex items-center gap-1.5 transition-colors', viewMode === 'grid' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')}>
              <Grid3X3 size={14} /> Matrix
            </button>
            <button type="button" onClick={() => setViewMode('table')}
              className={clsx('px-3 py-2 text-sm flex items-center gap-1.5 transition-colors border-l border-gray-300 dark:border-gray-600', viewMode === 'table' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')}>
              <List size={14} /> Table
            </button>
          </div>
          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1" />
          <div className="flex gap-1">
            <button type="button" onClick={handleExportCsv} disabled={rows.length === 0} className={BTN_SECONDARY} title="Export CSV">
              <Download size={14} /> CSV
            </button>
            <button type="button" onClick={handleExportExcel} disabled={rows.length === 0} className={BTN_SECONDARY} title="Export Excel">
              <Download size={14} /> Excel
            </button>
            <button type="button" onClick={handleExportPdf} disabled={rows.length === 0} className={BTN_SECONDARY} title="Export PDF">
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2a: Matrix Grid ─────────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className={clsx(CARD, 'overflow-hidden')}>
          {/* Grid toolbar */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={!showLinkedOnly} onChange={(e) => setShowLinkedOnly(!e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded" />
              Show all test cases
            </label>
            <span className="text-xs text-gray-400 ml-auto">
              {(() => {
                const gridReqs = showLinkedOnly ? sortedRows : allRequirements.filter((r) => {
                  if (!reqSearch.trim()) return true
                  const q = reqSearch.trim().toLowerCase()
                  return r.key.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)
                })
                return `${gridReqs.length} requirements × ${filteredColumns.length} test cases`
              })()}
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <span className="w-3 h-3 bg-green-500 rounded-sm" /> Linked
              </span>
              <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <span className="w-3 h-3 bg-gray-200 dark:bg-gray-600 rounded-sm" /> Not linked
              </span>
            </div>
          </div>

          {filteredColumns.length === 0 || (showLinkedOnly && sortedRows.length === 0) || (!showLinkedOnly && allRequirements.length === 0) ? (
            <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
              {allRequirements.length === 0 ? 'No requirements or test cases found.' : 'No matching data for current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse text-xs" style={{ minWidth: `${200 + filteredColumns.length * 48}px` }}>
                {/* Plan group header */}
                <thead className="sticky top-0 z-20">
                  {columnPlanGroups.some((g) => g.planKey) && (
                    <tr className="bg-gray-100 dark:bg-gray-900">
                      <th className="sticky left-0 z-30 bg-gray-100 dark:bg-gray-900 px-2 py-1 border-r border-b border-gray-200 dark:border-gray-700" />
                      {columnPlanGroups.map((g) => (
                        <th key={g.planId || 'unassigned'} colSpan={g.cols.length}
                          className="px-1 py-1.5 text-center font-medium text-gray-600 dark:text-gray-300 border-r border-b border-gray-200 dark:border-gray-700 truncate max-w-[200px]"
                          title={g.planName}>
                          {g.planKey || g.planName}
                        </th>
                      ))}
                    </tr>
                  )}
                  {/* Test case column headers */}
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <th className="sticky left-0 z-30 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 border-r border-b border-gray-200 dark:border-gray-700 min-w-[200px]">
                      Requirement
                    </th>
                    {filteredColumns.map((col) => (
                      <th key={col.id} className="px-1 py-2 text-center border-r border-b border-gray-200 dark:border-gray-700 min-w-[44px] max-w-[44px]">
                        <button type="button" onClick={() => openTestCase(col.id)}
                          className="block w-full text-center font-mono text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                          title={`${col.key}: ${col.title}`}>
                          {col.key.replace(/^TC-/, '')}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(showLinkedOnly ? sortedRows.map((r) => ({ id: r.requirementId, key: r.requirementKey, title: r.requirementTitle })) : allRequirements.filter((r) => {
                    if (!reqSearch.trim()) return true
                    const q = reqSearch.trim().toLowerCase()
                    return r.key.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)
                  })).map((req) => {
                    const rowCells = cellLookup.get(req.id)
                    return (
                      <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 px-3 py-2 border-r border-b border-gray-200 dark:border-gray-700 min-w-[200px] max-w-[280px]">
                          <button type="button" onClick={() => openRequirement(req.id)} className="text-left w-full group">
                            <div className="font-mono text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">{req.key}</div>
                            <div className="text-gray-700 dark:text-gray-300 truncate">{req.title}</div>
                          </button>
                        </td>
                        {filteredColumns.map((col) => {
                          const entry = rowCells?.get(col.id)
                          const isLinked = !!entry
                          const linkId = serverLinkMap[req.id]?.[col.id]
                          const reason = entry?.gapReason

                          if (isLinked) {
                            return (
                              <td key={col.id} className="px-0 py-0 border-r border-b border-gray-200 dark:border-gray-700 text-center relative group/cell">
                                <button type="button"
                                  title={`${cellTooltip(reason, entry.latestRunResult)}\nClick for details • Right-click to remove link`}
                                  onClick={(e) => setPopover({ tcId: col.id, reqId: req.id, x: e.clientX, y: e.clientY })}
                                  onContextMenu={(e) => {
                                    e.preventDefault()
                                    if (linkId && window.confirm(`Remove verifies link between ${req.key} and ${col.key}?`)) {
                                      deleteLinkMutation.mutate(linkId)
                                    }
                                  }}
                                  className={clsx('w-full h-8 transition-colors hover:opacity-80', cellColor(reason))} />
                              </td>
                            )
                          }
                          return (
                            <td key={col.id} className="px-0 py-0 border-r border-b border-gray-200 dark:border-gray-700 text-center">
                              <button type="button"
                                title={`${req.key} → ${col.key}: Not linked\nClick to create verifies link`}
                                onClick={() => handleGridCellClick(req.id, col.id)}
                                className="w-full h-8 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group/add">
                                <Plus size={12} className="mx-auto text-gray-300 dark:text-gray-600 group-hover/add:text-blue-500 dark:group-hover/add:text-blue-400 transition-colors" />
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Popover */}
          {popover && (() => {
            const rowData = rows.find((r) => r.requirementId === popover.reqId)
            const entry = rowData?.testCases.find((tc) => tc.testCaseId === popover.tcId)
            if (!entry) return null
            const linkId = serverLinkMap[popover.reqId]?.[popover.tcId]
            return (
              <div ref={popoverRef}
                className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 w-80"
                style={{ left: Math.min(popover.x, window.innerWidth - 340), top: Math.min(popover.y + 8, window.innerHeight - 300) }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{entry.testCaseKey}</span>
                  <button type="button" onClick={() => setPopover(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{entry.testCaseTitle}</div>
                {entry.testPlanKeys.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Plans: {entry.testPlanKeys.join(', ')}</div>
                )}
                <div className="mb-2">{gapBadge(entry.gapReason)}</div>
                {entry.recentRunResults.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent Runs:</div>
                    {entry.recentRunResults.map((rr) => (
                      <button key={rr.id} type="button" onClick={() => { openTestRun(rr.testRunId); setPopover(null) }}
                        className="flex items-center gap-2 w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                        <span className={clsx('w-2 h-2 rounded-full shrink-0',
                          rr.resultStatus === 'PASS' ? 'bg-green-500' :
                          rr.resultStatus === 'FAIL' ? 'bg-red-500' :
                          rr.resultStatus === 'BLOCKED' ? 'bg-amber-500' : 'bg-gray-400')} />
                        <span className="text-gray-700 dark:text-gray-300 truncate">{rr.testRunName}</span>
                        <span className="text-gray-400 ml-auto shrink-0">{rr.resultStatus}</span>
                        {rr.executedAt && <span className="text-gray-400 shrink-0">{new Date(rr.executedAt).toLocaleDateString()}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button type="button" onClick={() => { openTestCase(entry.testCaseId); setPopover(null) }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Open Test Case</button>
                  <button type="button" onClick={() => { openRequirement(popover.reqId); setPopover(null) }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Open Requirement</button>
                  {linkId && (
                    <button type="button" onClick={() => {
                      if (window.confirm('Remove this verifies link?')) {
                        deleteLinkMutation.mutate(linkId)
                        setPopover(null)
                      }
                    }}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline ml-auto">Remove Link</button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Pass</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> Fail</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Out of Sync</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-300 dark:bg-gray-600" /> No Run</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600" /> Not linked</span>
            <span className="text-gray-400 ml-auto">Click empty cell = add link • Right-click linked cell = remove link</span>
          </div>
        </div>
      )}

      {/* ── Section 2b: Detail Table ────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className={clsx(CARD, 'overflow-hidden')}>
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Group by:</label>
            <select value={detailGrouping} onChange={(e) => setDetailGrouping(e.target.value as DetailGrouping)}
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <option value="flat">Flat</option>
              <option value="requirement">Requirement</option>
              <option value="plan">Test Plan</option>
            </select>
            <span className="text-xs text-gray-400 ml-auto">{sortedRows.length} requirements, {sortedRows.reduce((s, r) => s + r.testCases.length, 0)} links</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('requirementKey')}>
                    Requirement {sortIcon('requirementKey')}
                  </th>
                  {detailGrouping !== 'requirement' && (
                    <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('requirementTitle')}>
                      Title {sortIcon('requirementTitle')}
                    </th>
                  )}
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Test Plan</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Test Case</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Latest Run</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gap</th>
                  <th className="px-4 py-2.5 font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedRows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">No data for current filters.</td></tr>
                ) : detailGrouping === 'requirement' ? (
                  sortedRows.map((row) => (
                    <DetailRequirementGroup key={row.requirementId} row={row} projectId={projectId!}
                      onOpenReq={openRequirement} onOpenTc={openTestCase} onOpenRun={openTestRun} />
                  ))
                ) : detailGrouping === 'plan' ? (
                  <DetailByPlanRows rows={sortedRows} testPlans={testPlans} projectId={projectId!}
                    onOpenReq={openRequirement} onOpenTc={openTestCase} onOpenRun={openTestRun} />
                ) : (
                  sortedRows.flatMap((row) =>
                    row.testCases.length > 0
                      ? row.testCases.map((tc, idx) => (
                          <DetailFlatRow key={`${row.requirementId}-${tc.testCaseId}`} row={row} tc={tc} isFirst={idx === 0} rowSpan={row.testCases.length}
                            onOpenReq={openRequirement} onOpenTc={openTestCase} onOpenRun={openTestRun} />
                        ))
                      : [<DetailFlatRow key={row.requirementId} row={row} tc={null} isFirst rowSpan={1}
                          onOpenReq={openRequirement} onOpenTc={openTestCase} onOpenRun={openTestRun} />]
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 3: Coverage Gaps Panel ──────────────────────────────────── */}
      {gapsData.length > 0 && (
        <details open={gapsPanelOpen} onToggle={(e) => setGapsPanelOpen((e.target as HTMLDetailsElement).open)}
          className={clsx(CARD, 'overflow-hidden')}>
          <summary className="px-4 py-3 font-medium text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 select-none">
            {gapsPanelOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Coverage Gaps ({gapsData.length})
          </summary>
          <div className="border-t border-gray-200 dark:border-gray-700">
            {[...gapsByReason.entries()].map(([reason, items]) => (
              <details key={reason} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <summary className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center gap-2 select-none">
                  {gapBadge(reason)}
                  <span className="text-gray-500 dark:text-gray-400">({items.length})</span>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-semibold text-xs text-gray-500 dark:text-gray-400">Requirement</th>
                        <th className="px-4 py-2 font-semibold text-xs text-gray-500 dark:text-gray-400">Test Case</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {items.map((g, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-1.5">
                            <button type="button" onClick={() => openRequirement(g.requirementId)}
                              className="font-mono text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-sm">
                              {g.requirementKey}
                            </button>
                          </td>
                          <td className="px-4 py-1.5">
                            {g.testCaseId ? (
                              <button type="button" onClick={() => openTestCase(g.testCaseId)}
                                className="font-mono text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-sm">
                                {g.testCaseKey}
                              </button>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </details>
      )}

      {/* Unlinked requirements (always visible when present) */}
      {unlinkedRequirements.length > 0 && !showGapsOnly && (
        <details className={clsx(CARD, 'overflow-hidden')}>
          <summary className="px-4 py-3 font-medium text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 select-none">
            <ChevronRight size={16} className="details-open:rotate-90 transition-transform" />
            Unlinked Requirements ({unlinkedRequirements.length})
            <span className="text-xs text-gray-500 dark:text-gray-400 font-normal ml-2">Requirements with no test case verifies link</span>
          </summary>
          <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-4 py-2 font-semibold text-xs text-gray-500 dark:text-gray-400">Key</th>
                  <th className="px-4 py-2 font-semibold text-xs text-gray-500 dark:text-gray-400">Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {unlinkedRequirements.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-1.5">
                      <button type="button" onClick={() => openRequirement(u.id)}
                        className="font-mono text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                        {u.key}
                      </button>
                    </td>
                    <td className="px-4 py-1.5 text-gray-700 dark:text-gray-300">{u.title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* ── Create Link Dialog ──────────────────────────────────────────────── */}
      {showLinkDialog && linkDialogReqId && linkDialogTcId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[500px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <LinkIcon size={18} />
                Create Verifies Link
              </h3>
              <button
                onClick={() => { setShowLinkDialog(false); setLinkDialogReqId(null); setLinkDialogTcId(null); setLinkRationale('') }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Test Case (source)</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {(() => {
                    const tc = allTestCaseColumns.find((c) => c.id === linkDialogTcId)
                    return tc ? `${tc.key} — ${tc.title}` : linkDialogTcId
                  })()}
                </p>
              </div>

              <div className="flex items-center justify-center text-gray-400">
                <span className="text-xs">verifies →</span>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Requirement (target)</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {(() => {
                    const req = allRequirements.find((r) => r.id === linkDialogReqId)
                    return req ? `${req.key} — ${req.title}` : linkDialogReqId
                  })()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rationale (optional)
                </label>
                <textarea
                  value={linkRationale}
                  onChange={(e) => setLinkRationale(e.target.value)}
                  placeholder="Explain why this test case verifies the requirement..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setShowLinkDialog(false); setLinkDialogReqId(null); setLinkDialogTcId(null); setLinkRationale('') }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm">
                Cancel
              </button>
              <button
                onClick={handleCreateLink}
                disabled={createLinkMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 text-sm">
                {createLinkMutation.isPending ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <LinkIcon size={14} />
                    Create Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Detail table sub-components ─────────────────────────────────────────────

interface DetailFlatRowProps {
  row: MatrixRow
  tc: TestCaseEntry | null
  isFirst: boolean
  rowSpan: number
  onOpenReq: (id: string) => void
  onOpenTc: (id: string) => void
  onOpenRun: (id: string) => void
}

function DetailFlatRow({ row, tc, isFirst, rowSpan, onOpenReq, onOpenTc, onOpenRun }: DetailFlatRowProps) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
      {isFirst && (
        <>
          <td rowSpan={rowSpan} className="px-4 py-2 align-top border-r border-gray-100 dark:border-gray-800">
            <button type="button" onClick={() => onOpenReq(row.requirementId)} className="font-mono text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              {row.requirementKey}
            </button>
          </td>
          <td rowSpan={rowSpan} className="px-4 py-2 align-top text-gray-700 dark:text-gray-300 max-w-[200px] truncate border-r border-gray-100 dark:border-gray-800">
            {row.requirementTitle}
          </td>
        </>
      )}
      {tc ? (
        <>
          <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{tc.testPlanKeys.join(', ') || '—'}</td>
          <td className="px-4 py-2">
            <button type="button" onClick={() => onOpenTc(tc.testCaseId)} className="font-mono text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              {tc.testCaseKey}
            </button>
          </td>
          <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
            {tc.latestRunResult ? (
              <button type="button" onClick={() => onOpenRun(tc.latestRunResult!.testRunId)} className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
                {tc.latestRunResult.testRunName}
              </button>
            ) : '—'}
          </td>
          <td className="px-4 py-2 text-xs">{tc.latestRunResult?.resultStatus ?? '—'}</td>
          <td className="px-4 py-2">{gapBadge(tc.gapReason)}</td>
          <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
            {tc.latestRunResult?.executedAt ? new Date(tc.latestRunResult.executedAt).toLocaleDateString() : '—'}
          </td>
        </>
      ) : (
        <>
          <td className="px-4 py-2 text-gray-400" colSpan={6}>{gapBadge('NO_LINKED_TEST_CASE')}</td>
        </>
      )}
    </tr>
  )
}

interface DetailGroupProps {
  row: MatrixRow
  projectId: string
  onOpenReq: (id: string) => void
  onOpenTc: (id: string) => void
  onOpenRun: (id: string) => void
}

function DetailRequirementGroup({ row, onOpenReq, onOpenTc, onOpenRun }: DetailGroupProps) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <tr className="bg-gray-50/50 dark:bg-gray-800/50 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <td colSpan={8} className="px-4 py-2">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenReq(row.requirementId) }}
              className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              {row.requirementKey}
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{row.requirementTitle}</span>
            <span className="ml-auto text-xs text-gray-400">{row.testCases.length} test case{row.testCases.length !== 1 ? 's' : ''}</span>
            {row.verified && <CheckCircle size={14} className="text-green-500" />}
          </div>
        </td>
      </tr>
      {open && row.testCases.map((tc) => (
        <tr key={tc.testCaseId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <td className="px-4 py-1.5 pl-10" colSpan={2} />
          <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">{tc.testPlanKeys.join(', ') || '—'}</td>
          <td className="px-4 py-1.5">
            <button type="button" onClick={() => onOpenTc(tc.testCaseId)} className="font-mono text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              {tc.testCaseKey}
            </button>
          </td>
          <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            {tc.latestRunResult ? (
              <button type="button" onClick={() => onOpenRun(tc.latestRunResult!.testRunId)} className="hover:underline">{tc.latestRunResult.testRunName}</button>
            ) : '—'}
          </td>
          <td className="px-4 py-1.5 text-xs">{tc.latestRunResult?.resultStatus ?? '—'}</td>
          <td className="px-4 py-1.5">{gapBadge(tc.gapReason)}</td>
          <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            {tc.latestRunResult?.executedAt ? new Date(tc.latestRunResult.executedAt).toLocaleDateString() : '—'}
          </td>
        </tr>
      ))}
      {open && row.testCases.length === 0 && (
        <tr><td className="px-4 py-1.5 pl-10 text-gray-400 text-sm" colSpan={8}>{gapBadge('NO_LINKED_TEST_CASE')}</td></tr>
      )}
    </>
  )
}

interface DetailByPlanProps {
  rows: MatrixRow[]
  testPlans: TestPlanSummary[]
  projectId: string
  onOpenReq: (id: string) => void
  onOpenTc: (id: string) => void
  onOpenRun: (id: string) => void
}

function DetailByPlanRows({ rows, testPlans, onOpenReq, onOpenTc, onOpenRun }: DetailByPlanProps) {
  // Build plan -> entries
  const planGroups = useMemo(() => {
    const map = new Map<string, { plan: TestPlanSummary | null; entries: { row: MatrixRow; tc: TestCaseEntry }[] }>()
    const noPlan: { row: MatrixRow; tc: TestCaseEntry }[] = []

    for (const row of rows) {
      for (const tc of row.testCases) {
        if (tc.testPlanIds.length === 0) {
          noPlan.push({ row, tc })
        } else {
          for (const pid of tc.testPlanIds) {
            if (!map.has(pid)) map.set(pid, { plan: testPlans.find((p) => p.id === pid) ?? null, entries: [] })
            map.get(pid)!.entries.push({ row, tc })
          }
        }
      }
    }
    const groups = [...map.values()]
    if (noPlan.length) groups.push({ plan: null, entries: noPlan })
    return groups
  }, [rows, testPlans])

  return (
    <>
      {planGroups.map((group, gi) => (
        <PlanGroupSection key={group.plan?.id ?? `no-plan-${gi}`} group={group}
          onOpenReq={onOpenReq} onOpenTc={onOpenTc} onOpenRun={onOpenRun} />
      ))}
    </>
  )
}

function PlanGroupSection({ group, onOpenReq, onOpenTc, onOpenRun }: {
  group: { plan: TestPlanSummary | null; entries: { row: MatrixRow; tc: TestCaseEntry }[] }
  onOpenReq: (id: string) => void; onOpenTc: (id: string) => void; onOpenRun: (id: string) => void
}) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <tr className="bg-blue-50/50 dark:bg-blue-900/10 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <td colSpan={8} className="px-4 py-2">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown size={14} className="text-blue-400" /> : <ChevronRight size={14} className="text-blue-400" />}
            <FileText size={14} className="text-blue-500" />
            <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
              {group.plan?.key ?? 'Unassigned'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{group.plan?.name ?? 'Test cases not assigned to any plan'}</span>
            <span className="ml-auto text-xs text-gray-400">{group.entries.length} link{group.entries.length !== 1 ? 's' : ''}</span>
          </div>
        </td>
      </tr>
      {open && group.entries.map(({ row, tc }) => (
        <tr key={`${row.requirementId}-${tc.testCaseId}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
          <td className="px-4 py-1.5 pl-10">
            <button type="button" onClick={() => onOpenReq(row.requirementId)} className="font-mono text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              {row.requirementKey}
            </button>
          </td>
          <td className="px-4 py-1.5 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{row.requirementTitle}</td>
          <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">{group.plan?.key ?? '—'}</td>
          <td className="px-4 py-1.5">
            <button type="button" onClick={() => onOpenTc(tc.testCaseId)} className="font-mono text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              {tc.testCaseKey}
            </button>
          </td>
          <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            {tc.latestRunResult ? (
              <button type="button" onClick={() => onOpenRun(tc.latestRunResult!.testRunId)} className="hover:underline">{tc.latestRunResult.testRunName}</button>
            ) : '—'}
          </td>
          <td className="px-4 py-1.5 text-xs">{tc.latestRunResult?.resultStatus ?? '—'}</td>
          <td className="px-4 py-1.5">{gapBadge(tc.gapReason)}</td>
          <td className="px-4 py-1.5 text-xs text-gray-500 dark:text-gray-400">
            {tc.latestRunResult?.executedAt ? new Date(tc.latestRunResult.executedAt).toLocaleDateString() : '—'}
          </td>
        </tr>
      ))}
    </>
  )
}
