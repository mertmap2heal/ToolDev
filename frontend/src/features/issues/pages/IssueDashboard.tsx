import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Search, Plus, AlertTriangle, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import ProjectNavigation from '../../../components/projects/ProjectNavigation'
import { useIssues } from '../hooks/useIssues'
import { IssueGridSkeleton } from '../components/skeletons'
import type { AerospaceIssue, IssueStatus } from '../types'

const DAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All DAL' },
  { value: 'A', label: 'A (Catastrophic)' },
  { value: 'B', label: 'B (Hazardous)' },
  { value: 'C', label: 'C (Major)' },
  { value: 'D', label: 'D (Minor)' },
  { value: 'E', label: 'E (No Effect)' },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'Analysis', label: 'Analysis' },
  { value: 'Containment', label: 'Containment' },
  { value: 'InWork', label: 'In Work' },
  { value: 'Verification', label: 'Verification' },
  { value: 'Closed', label: 'Closed' },
]

function getStatusBadgeClass(status: IssueStatus): string {
  switch (status) {
    case 'Closed':
      return 'bg-green-500/10 text-green-400 border border-green-500/20'
    case 'Verification':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    case 'Analysis':
    case 'InWork':
    case 'Containment':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    case 'Open':
    default:
      return 'bg-red-500/10 text-red-400 border border-red-500/20'
  }
}

export default function IssueDashboard() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { issues, isLoading } = useIssues()
  const [searchQuery, setSearchQuery] = useState('')
  const [dalFilter, setDalFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredIssues = useMemo(() => {
    return issues.filter((issue: AerospaceIssue) => {
      const q = searchQuery.trim().toLowerCase()
      if (q) {
        const matchPn = issue.affectedPartNumber.toLowerCase().includes(q)
        const matchTitle = issue.title.toLowerCase().includes(q)
        const matchDesc = issue.description.toLowerCase().includes(q)
        const matchOwner = issue.assignee?.name.toLowerCase().includes(q)
        if (!matchPn && !matchTitle && !matchDesc && !matchOwner) return false
      }
      if (dalFilter !== 'all' && issue.dal !== dalFilter) return false
      if (statusFilter !== 'all' && issue.status !== statusFilter) return false
      return true
    })
  }, [issues, searchQuery, dalFilter, statusFilter])

  const handleRowClick = (id: string) => {
    if (projectId) navigate(`/projects/${projectId}/issues/${id}`)
  }

  return (
    <div className="flex flex-col min-h-0 bg-slate-900">
      <div className="flex-shrink-0 space-y-4">
        <ProjectNavigation />

        <nav className="flex items-center gap-2 text-sm text-slate-400">
          <Link to="/" className="text-blue-400 hover:text-blue-300 transition-colors">
            Home
          </Link>
          <span className="text-slate-500">/</span>
          {projectId && (
            <>
              <Link
                to={`/projects/${projectId}`}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                MPAC
              </Link>
              <span className="text-slate-500">/</span>
            </>
          )}
          <span className="text-slate-100 font-medium">Issues</span>
        </nav>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-slate-100">Issue Management</h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
              aria-hidden
            />
            <input
              type="text"
              placeholder="Search by P/N or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-800 text-slate-100 placeholder:text-slate-500 text-sm"
              aria-label="Search issues"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dalFilter}
              onChange={(e) => setDalFilter(e.target.value)}
              className="px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-800 text-slate-100 text-sm appearance-none pr-8 bg-no-repeat bg-[length:1rem] bg-[right_0.5rem_center]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              }}
              aria-label="Filter by DAL level"
            >
              {DAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 text-slate-400 w-4 h-4 hidden"
              aria-hidden
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-slate-800 text-slate-100 text-sm"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-900/20 rounded-lg transition-colors ml-auto"
          >
            <Plus size={18} />
            New Issue
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-4 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <IssueGridSkeleton />
          ) : (
            <table className="w-full">
              <thead className="border-b border-slate-700 bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    DAL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Owner
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredIssues.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-slate-400"
                    >
                      {issues.length === 0
                        ? 'No issues found.'
                        : 'No issues match your filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => handleRowClick(issue.id)}
                    className={clsx(
                      'hover:bg-slate-700/50 cursor-pointer transition-colors',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(issue.dal === 'A' || issue.dal === 'B') && (
                          <AlertTriangle
                            size={16}
                            className="text-amber-400 shrink-0"
                            aria-label="High assurance level"
                          />
                        )}
                        <span className="font-mono text-sm text-slate-100">
                          {issue.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex px-2 py-1 text-xs font-medium rounded border',
                          issue.severity === 'Critical' &&
                            'bg-red-500/10 text-red-400 border-red-500/20',
                          issue.severity === 'High' &&
                            'bg-orange-500/10 text-orange-400 border-orange-500/20',
                          issue.severity === 'Medium' &&
                            'bg-amber-500/10 text-amber-400 border-amber-500/20',
                          issue.severity === 'Low' &&
                            'bg-slate-500/10 text-slate-400 border-slate-500/20',
                        )}
                      >
                        {issue.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-100 line-clamp-1">
                        {issue.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex px-2 py-1 text-xs font-medium rounded border',
                          getStatusBadgeClass(issue.status),
                        )}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400 font-mono text-sm">
                        {issue.dal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {issue.assignee?.name ?? '—'}
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
