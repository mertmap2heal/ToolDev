import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  FileText,
  Link2,
  ClipboardList,
  ChevronLeft,
  Send,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import ProjectNavigation from '../../../components/projects/ProjectNavigation'
import { useIssueDetail } from '../hooks/useIssueDetail'
import { IssueDetailSkeleton } from '../components/skeletons'
import { DAL_LABELS } from '../types'
import type { TraceabilityLink } from '../types'

type TabId = 'overview' | 'analysis' | 'traceability'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'analysis', label: 'Analysis (RCA)', icon: ClipboardList },
  { id: 'traceability', label: 'Traceability', icon: Link2 },
]

function TraceabilityItem({ link }: { link: TraceabilityLink }) {
  const isRequirement = link.type === 'Requirement'
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700/50">
      {isRequirement ? (
        <FileText size={16} className="text-slate-400 shrink-0" />
      ) : (
        <CheckCircle size={16} className="text-blue-400 shrink-0" />
      )}
      <span className="text-slate-400 text-sm">{link.type}</span>
      <a
        href={link.url}
        className="text-blue-400 hover:text-blue-300 truncate flex-1 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        {link.label ?? link.id}
      </a>
    </div>
  )
}

export default function IssueDetail() {
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>()
  const { issue, isLoading } = useIssueDetail(issueId)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const hasVerificationTest = issue?.traceabilityLinks.some((l) => l.type === 'TestCase')
  const canClose = hasVerificationTest

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-0 bg-slate-900">
        <div className="flex-shrink-0">
          <ProjectNavigation />
        </div>
        <div className="flex-1 p-6">
          <IssueDetailSkeleton />
        </div>
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="flex flex-col min-h-0 bg-slate-900">
        <div className="flex-shrink-0">
          <ProjectNavigation />
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center gap-4 text-slate-400">
          <AlertCircle size={48} className="text-slate-500" />
          <p className="text-slate-100 font-medium">Issue not found</p>
          {projectId && (
            <Link
              to={`/projects/${projectId}/issues`}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
            >
              <ChevronLeft size={18} />
              Back to Issues
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 bg-slate-900">
      <div className="flex-shrink-0">
        <ProjectNavigation />
        <nav className="flex items-center gap-2 text-sm text-slate-400 mt-4">
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
              <Link
                to={`/projects/${projectId}/issues`}
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Issues
              </Link>
              <span className="text-slate-500">/</span>
            </>
          )}
          <span className="text-slate-100 font-medium">{issue.id}</span>
        </nav>
      </div>

      <div className="flex-1 min-h-0 flex flex-col pt-4 pb-24">
        <div className="flex-shrink-0 mb-4">
          <h1 className="text-2xl font-bold text-slate-100">{issue.title}</h1>
          <p className="text-slate-400 text-sm font-mono mt-1">{issue.id}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 flex-1 min-h-0">
          <div className="min-w-0 flex flex-col">
            <div className="flex border-b border-slate-700 gap-1 mb-4">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400 bg-slate-800'
                      : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg overflow-auto">
              {activeTab === 'overview' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Description
                  </h3>
                  <p className="text-slate-100 whitespace-pre-wrap">{issue.description}</p>
                </div>
              )}
              {activeTab === 'analysis' && (
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
                      Root Cause Analysis
                    </h3>
                    <p className="text-slate-100 whitespace-pre-wrap bg-slate-900/50 rounded p-4 border border-slate-700">
                      {issue.rootCauseAnalysis || '—'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2">
                      Containment Actions
                    </h3>
                    <p className="text-slate-100 whitespace-pre-wrap bg-slate-900/50 rounded p-4 border border-slate-700">
                      {issue.containmentActions || '—'}
                    </p>
                  </div>
                </div>
              )}
              {activeTab === 'traceability' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Linked artifacts
                  </h3>
                  <div className="space-y-2">
                    {issue.traceabilityLinks.map((link) => (
                      <TraceabilityItem key={link.id} link={link} />
                    ))}
                  </div>
                  <div
                    className="flex items-center justify-center gap-2 py-6 px-4 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => {}}
                    onKeyDown={(e) => e.key === 'Enter' && (() => {})()}
                  >
                    <Link2 size={18} />
                    <span>Link new requirement</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:pl-0">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4 sticky top-4">
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Metadata
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Assignee</dt>
                  <dd className="text-slate-100">{issue.assignee?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Verifier</dt>
                  <dd className="text-slate-100">{issue.verifier?.name ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Created</dt>
                  <dd className="text-slate-100">
                    {format(new Date(issue.createdAt), 'MMM d, yyyy')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Updated</dt>
                  <dd className="text-slate-100">
                    {format(new Date(issue.updatedAt), 'MMM d, yyyy')}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">DAL</dt>
                  <dd className="text-slate-100">
                    {issue.dal} ({DAL_LABELS[issue.dal]})
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Severity</dt>
                  <dd className="text-slate-100">{issue.severity}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Status</dt>
                  <dd className="text-slate-100">{issue.status}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Affected P/N</dt>
                  <dd className="text-slate-100 font-mono text-xs">{issue.affectedPartNumber}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 border-t border-slate-700 bg-slate-800 px-6 py-4 flex items-center justify-end gap-3 z-10">
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium rounded-lg transition-colors border border-slate-600"
        >
          <Send size={16} />
          Submit for Review
        </button>
        <button
          type="button"
          disabled={!canClose}
          title={
            canClose
              ? 'Close issue'
              : 'Close is disabled until a Verification Test is linked (DO-178C).'
          }
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <CheckCircle size={16} />
          Close Issue
        </button>
      </footer>
    </div>
  )
}
