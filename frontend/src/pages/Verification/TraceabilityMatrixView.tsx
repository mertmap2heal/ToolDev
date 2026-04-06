import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react'
import clsx from 'clsx'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

function exportToCsv(rows: any[]) {
  const flat: { 'Requirement Key': string; 'Requirement Title': string; 'Test Case Key': string; 'Test Case Title': string; Status: string }[] = []
  rows.forEach((row: any) => {
    if (row.testCases?.length) {
      row.testCases.forEach((tc: any) => {
        flat.push({
          'Requirement Key': row.requirementKey || '',
          'Requirement Title': row.requirementTitle || '',
          'Test Case Key': tc.testCaseKey || '',
          'Test Case Title': tc.testCaseTitle || '',
          Status: tc.gapReason || '—',
        })
      })
    } else {
      flat.push({
        'Requirement Key': row.requirementKey || '',
        'Requirement Title': row.requirementTitle || '',
        'Test Case Key': '',
        'Test Case Title': '',
        Status: 'No linked test cases',
      })
    }
  })
  return Papa.unparse(flat)
}

function exportToExcel(rows: any[]) {
  const flat: { 'Requirement Key': string; 'Requirement Title': string; 'Test Case Key': string; 'Test Case Title': string; Status: string }[] = []
  rows.forEach((row: any) => {
    if (row.testCases?.length) {
      row.testCases.forEach((tc: any) => {
        flat.push({
          'Requirement Key': row.requirementKey || '',
          'Requirement Title': row.requirementTitle || '',
          'Test Case Key': tc.testCaseKey || '',
          'Test Case Title': tc.testCaseTitle || '',
          Status: tc.gapReason || '—',
        })
      })
    } else {
      flat.push({
        'Requirement Key': row.requirementKey || '',
        'Requirement Title': row.requirementTitle || '',
        'Test Case Key': '',
        'Test Case Title': '',
        Status: 'No linked test cases',
      })
    }
  })
  const ws = XLSX.utils.json_to_sheet(flat)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Traceability Matrix')
  XLSX.writeFile(wb, `Traceability_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function TraceabilityMatrixView() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const matrixReqId = searchParams.get('matrixReqId') || ''
  const matrixCaseId = searchParams.get('matrixCaseId') || ''
  const [reqSearch, setReqSearch] = useState(matrixReqId)
  const [caseSearch, setCaseSearch] = useState(matrixCaseId)
  const [gapFilter, setGapFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['traceability-matrix', projectId],
    queryFn: async () => {
      const res = (await verificationService.getTraceabilityMatrix(projectId!)) as {
        success?: boolean
        data?: { rows: any[]; coverageSummary: { total: number; verified: number; gaps: number } }
      }
      return res.success ? res.data : null
    },
    enabled: !!projectId,
  })

  const rows = data?.rows ?? []
  const summary = data?.coverageSummary ?? { total: 0, verified: 0, gaps: 0 }
  useEffect(() => {
    // keep local search in sync with deep-link params (tree context action)
    if (matrixReqId) setReqSearch(matrixReqId)
  }, [matrixReqId])
  useEffect(() => {
    if (matrixCaseId) setCaseSearch(matrixCaseId)
  }, [matrixCaseId])

  const filteredRows = useMemo(() => {
    const reqQ = reqSearch.trim().toLowerCase()
    const caseQ = caseSearch.trim().toLowerCase()
    const gapQ = gapFilter.trim()
    return (Array.isArray(rows) ? rows : []).filter((row: any) => {
      const reqMatch =
        !reqQ ||
        String(row.requirementKey || '').toLowerCase().includes(reqQ) ||
        String(row.requirementTitle || '').toLowerCase().includes(reqQ) ||
        String(row.requirementId || '').toLowerCase().includes(reqQ)
      const tcs = Array.isArray(row.testCases) ? row.testCases : []
      const caseMatch =
        !caseQ ||
        tcs.some((tc: any) =>
          String(tc.testCaseKey || '').toLowerCase().includes(caseQ) ||
          String(tc.testCaseTitle || '').toLowerCase().includes(caseQ) ||
          String(tc.testCaseId || '').toLowerCase().includes(caseQ)
        )
      const gapMatch =
        !gapQ ||
        tcs.some((tc: any) => String(tc.gapReason || '').toUpperCase() === gapQ)
      return reqMatch && caseMatch && gapMatch
    })
  }, [rows, reqSearch, caseSearch, gapFilter])

  const { data: gapsData = [] } = useQuery({
    queryKey: ['traceability-gaps', projectId],
    queryFn: async () => {
      const res = (await verificationService.getCoverageGaps(projectId!)) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && summary.gaps > 0,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500 dark:text-gray-400">Loading traceability matrix…</div>
      </div>
    )
  }

  const getGapBadge = (gapReason: string) => {
    switch (gapReason) {
      case 'OK':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle size={12} />
            Verified
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
            <AlertTriangle size={12} />
            Out of sync
          </span>
        )
      case 'NOT_PASSED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <XCircle size={12} />
            Not passed
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {gapReason}
          </span>
        )
    }
  }

  const handleExportCsv = () => {
    const csv = exportToCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Traceability_Matrix_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => exportToExcel(rows)

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Requirement</label>
            <input
              value={reqSearch}
              onChange={(e) => setReqSearch(e.target.value)}
              placeholder="Search key/title…"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Test case</label>
            <input
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="Search key/title…"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gap reason</label>
              <select
                value={gapFilter}
                onChange={(e) => setGapFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="OK">OK</option>
                <option value="NO_RUN">NO_RUN</option>
                <option value="OUT_OF_SYNC">OUT_OF_SYNC</option>
                <option value="NOT_PASSED">NOT_PASSED</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setReqSearch('')
                setCaseSearch('')
                setGapFilter('')
                setSearchParams((p) => {
                  const n = new URLSearchParams(p)
                  n.delete('matrixReqId')
                  n.delete('matrixCaseId')
                  return n
                }, { replace: true })
              }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Requirements</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{summary.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Verified</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {summary.verified}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Coverage Gaps</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {summary.gaps}
          </div>
        </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={handleExportExcel}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {summary.gaps > 0 && gapsData.length > 0 && (
        <details className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <summary className="px-4 py-3 font-medium text-gray-900 dark:text-white cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
            Coverage Gaps ({gapsData.length})
          </summary>
          <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto max-h-[40vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-4 py-2 font-semibold text-gray-500 dark:text-gray-400">Requirement</th>
                  <th className="px-4 py-2 font-semibold text-gray-500 dark:text-gray-400">Test Case</th>
                  <th className="px-4 py-2 font-semibold text-gray-500 dark:text-gray-400">Gap Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {gapsData.map((g: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">
                      <button
                        type="button"
                        onClick={() => {
                          if (!g.requirementId && !g.requirementKey) return
                          // Prefer requirementId when backend provides it; fallback to key search.
                          if (g.requirementId) navigate(`/projects/${projectId}/requirements?requirementId=${g.requirementId}`)
                          else {
                            setReqSearch(String(g.requirementKey || ''))
                          }
                        }}
                        className="hover:underline"
                        title="Open requirement"
                      >
                        {g.requirementKey}
                      </button>
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-600 dark:text-gray-400">
                      {g.testCaseId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${projectId}/verification?tab=cases&focusType=test-case&focusId=${g.testCaseId}`)}
                          className="hover:underline"
                          title="Open test case"
                        >
                          {g.testCaseKey || '—'}
                        </button>
                      ) : (
                        <span>{g.testCaseKey || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{getGapBadge(g.gapReason)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requirement
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Test Cases
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No requirements with linked test cases. Link requirements to test cases via the verification
                    traceability (verifies) to populate this matrix.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row: any) => (
                  <tr key={row.requirementId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => row.requirementId && navigate(`/projects/${projectId}/requirements?requirementId=${row.requirementId}`)}
                        className="text-left w-full"
                        title="Open requirement"
                      >
                        <div className="font-mono text-sm text-gray-600 dark:text-gray-400 hover:underline">
                          {row.requirementKey}
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400">
                          {row.requirementTitle}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {row.testCases?.map((tc: any) => (
                          <button
                            key={tc.testCaseId}
                            type="button"
                            onClick={() =>
                              tc.testCaseId &&
                              navigate(
                                `/projects/${projectId}/verification?tab=cases&focusType=test-case&focusId=${tc.testCaseId}`
                              )
                            }
                            className="text-sm text-left w-full hover:bg-gray-50 dark:hover:bg-gray-700/40 rounded px-2 py-1"
                            title="Open test case"
                          >
                            <span className="font-mono text-gray-500 dark:text-gray-400">{tc.testCaseKey}</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{tc.testCaseTitle}</span>
                          </button>
                        ))}
                        {(!row.testCases || row.testCases.length === 0) && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">No linked test cases</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {row.testCases?.map((tc: any) => (
                          <div key={tc.testCaseId} className="flex items-center gap-2">
                            {getGapBadge(tc.gapReason)}
                            {tc.latestRunResult?.resultStatus && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {tc.latestRunResult.resultStatus}
                              </span>
                            )}
                          </div>
                        ))}
                        {row.verified && (!row.testCases || row.testCases.length > 0) && (
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                              row.verified
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            )}
                          >
                            {row.verified ? (
                              <>
                                <CheckCircle size={12} />
                                Requirement verified
                              </>
                            ) : (
                              'Has gaps'
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
