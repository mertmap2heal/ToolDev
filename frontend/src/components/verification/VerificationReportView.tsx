/**
 * Shared presentational component that renders a full verification report
 * (test case, test plan, or test run) for use in modal and full-page view.
 * Print-friendly, scrollable; no new dependencies.
 */
import type { ReactNode } from 'react'

export type ReportEntityType = 'test-case' | 'test-plan' | 'test-run'

export interface VerificationReportViewProps {
  reportType: ReportEntityType
  reportData: any
  className?: string
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = new Date(date)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 print:break-inside-avoid">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 border-b border-gray-200 dark:border-gray-600 pb-1">
        {title}
      </h3>
      {children}
    </section>
  )
}

function getStatusBadgeClass(status: string): string {
  const s = (status || '').toUpperCase()
  if (s === 'PASS' || s === 'PASSED_WITH_ERRORS' || s === 'APPROVED' || s === 'READY') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  if (s === 'FAIL') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  if (s === 'BLOCKED') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  if (s === 'SKIPPED' || s === 'NOT_RUN') return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

export default function VerificationReportView({ reportType, reportData, className = '' }: VerificationReportViewProps) {
  if (!reportData) {
    return (
      <div className={`p-4 text-gray-500 dark:text-gray-400 ${className}`}>
        No report data available.
      </div>
    )
  }

  const meta = reportData.metadata || {}

  if (reportType === 'test-case') {
    const tc = reportData.testCase || {}
    const steps = Array.isArray(tc.steps) ? tc.steps : []
    const expectedResults = Array.isArray(tc.expectedResults) ? tc.expectedResults : []
    const executionHistory = reportData.executionHistory || []
    const evidence = reportData.evidence || []
    const testResults = reportData.testResults || []
    const verifiesElements = reportData.verifiesElements || []
    const customSections = reportData.customSections || []
    const auditTrail = reportData.auditTrail || []

    return (
      <div className={`text-gray-900 dark:text-gray-100 ${className}`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Generated {formatDate(meta.generatedAt)} · Report v{meta.version || '1.0'}
        </p>

        <Section title="Test case details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-gray-600 dark:text-gray-400">Key</dt>
            <dd>{tc.key ?? '—'}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Title</dt>
            <dd>{tc.title ?? '—'}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Status</dt>
            <dd>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(tc.status)}`}>
                {tc.status ?? '—'}
              </span>
            </dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Version</dt>
            <dd>{tc.version ?? '—'}</dd>
            {tc.objective && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Objective</dt>
                <dd className="whitespace-pre-wrap">{tc.objective}</dd>
              </>
            )}
          </dl>
        </Section>

        {tc.preconditions && (
          <Section title="Preconditions">
            <p className="text-sm whitespace-pre-wrap">{tc.preconditions}</p>
          </Section>
        )}

        {steps.length > 0 && (
          <Section title="Test procedure">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {steps.map((step: string, i: number) => (
                <li key={i} className="pl-1">{step || '—'}</li>
              ))}
            </ol>
          </Section>
        )}

        {expectedResults.length > 0 && (
          <Section title="Expected results">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {expectedResults.map((r: string, i: number) => (
                <li key={i} className="pl-1">{r || '—'}</li>
              ))}
            </ol>
          </Section>
        )}

        {tc.passFailCriteria && (
          <Section title="Pass/fail criteria">
            <p className="text-sm whitespace-pre-wrap">{tc.passFailCriteria}</p>
          </Section>
        )}

        {tc.setups?.length > 0 && (
          <Section title="Linked setups">
            <ul className="text-sm space-y-1">
              {tc.setups.map((s: any) => (
                <li key={s.id}>{s.name ?? s.id} {s.environmentType ? `(${s.environmentType})` : ''}</li>
              ))}
            </ul>
          </Section>
        )}

        {executionHistory.length > 0 && (
          <Section title="Execution history">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Executed at</th>
                    <th className="text-left p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {executionHistory.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(r.status)}`}>{r.status ?? '—'}</span>
                      </td>
                      <td className="p-2">{formatDate(r.executedAt)}</td>
                      <td className="p-2">{r.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {evidence.length > 0 && (
          <Section title="Evidence">
            <ul className="text-sm space-y-1">
              {evidence.map((e: any) => (
                <li key={e.id}>{e.title ?? e.id} ({e.type ?? '—'})</li>
              ))}
            </ul>
          </Section>
        )}

        {testResults.length > 0 && (
          <Section title="Linked test results">
            <ul className="text-sm space-y-2">
              {testResults.map((r: any) => (
                <li key={r.id}>
                  {r.title ?? r.id} — <span className={getStatusBadgeClass(r.resultStatus)}>{r.resultStatus}</span>
                  {r.executedAt && ` · ${formatDate(r.executedAt)}`}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {verifiesElements.length > 0 && (
          <Section title="Verifies">
            <ul className="text-sm space-y-1">
              {verifiesElements.map((el: any, i: number) => (
                <li key={i}>{el?.type}: {el?.name ?? el?.id ?? '—'}</li>
              ))}
            </ul>
          </Section>
        )}

        {customSections.filter((s: any) => s.title && !String(s.title).startsWith('_')).length > 0 && (
          <Section title="Custom sections">
            <div className="space-y-4">
              {customSections.filter((s: any) => s.title && !String(s.title).startsWith('_')).map((s: any) => (
                <div key={s.id}>
                  <p className="font-medium text-sm mb-1">{s.title}</p>
                  <p className="text-sm whitespace-pre-wrap">{typeof s.content === 'string' ? s.content : JSON.stringify(s.content)}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {auditTrail.length > 0 && (
          <Section title="Audit trail">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left p-2">Action</th>
                    <th className="text-left p-2">Performed at</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.slice(0, 20).map((e: any, i: number) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="p-2">{e.action ?? '—'}</td>
                      <td className="p-2">{formatDate(e.performedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
    )
  }

  if (reportType === 'test-plan') {
    const plan = reportData.testPlan || {}
    const stats = reportData.statistics || {}
    const testCases = reportData.testCases || []
    const testResults = reportData.testResults || []
    const verifiesElements = reportData.verifiesElements || []

    return (
      <div className={`text-gray-900 dark:text-gray-100 ${className}`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Generated {formatDate(meta.generatedAt)} · Report v{meta.version || '1.0'}
        </p>

        <Section title="Test plan details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-gray-600 dark:text-gray-400">Key</dt>
            <dd>{plan.key ?? '—'}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Name</dt>
            <dd>{plan.name ?? '—'}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Status</dt>
            <dd>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(plan.status)}`}>
                {plan.status ?? '—'}
              </span>
            </dd>
            {plan.phase && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Phase</dt>
                <dd>{plan.phase}</dd>
              </>
            )}
            {plan.description && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Description</dt>
                <dd className="whitespace-pre-wrap">{plan.description}</dd>
              </>
            )}
          </dl>
        </Section>

        <Section title="Statistics">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-gray-600 dark:text-gray-400">Total cases</dt>
            <dd>{stats.totalCases ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Executed</dt>
            <dd>{stats.executed ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Passed</dt>
            <dd>{stats.passed ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Failed</dt>
            <dd>{stats.failed ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Coverage</dt>
            <dd>{stats.coveragePercentage ?? 0}%</dd>
          </dl>
        </Section>

        {testCases.length > 0 && (
          <Section title="Test cases">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Key</th>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Latest result</th>
                  </tr>
                </thead>
                <tbody>
                  {testCases.map((pc: any, i: number) => (
                    <tr key={i} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="p-2">{pc.orderIndex ?? i + 1}</td>
                      <td className="p-2 font-mono">{pc.testCase?.key ?? '—'}</td>
                      <td className="p-2">{pc.testCase?.title ?? '—'}</td>
                      <td className="p-2">{pc.testCase?.status ?? '—'}</td>
                      <td className="p-2">
                        {pc.latestResult ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(pc.latestResult.status)}`}>
                            {pc.latestResult.status} {pc.latestResult.executedAt ? formatDate(pc.latestResult.executedAt) : ''}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {testResults.length > 0 && (
          <Section title="Linked test results">
            <ul className="text-sm space-y-2">
              {testResults.map((r: any) => (
                <li key={r.id}>
                  {r.title ?? r.id} — <span className={getStatusBadgeClass(r.resultStatus)}>{r.resultStatus}</span>
                  {r.executedAt && ` · ${formatDate(r.executedAt)}`}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {verifiesElements.length > 0 && (
          <Section title="Verifies">
            <ul className="text-sm space-y-1">
              {verifiesElements.map((el: any, i: number) => (
                <li key={i}>{el?.type}: {el?.name ?? el?.id ?? '—'}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    )
  }

  if (reportType === 'test-run') {
    const run = reportData.testRun || {}
    const results = reportData.results || []
    const stats = reportData.statistics || {}

    return (
      <div className={`text-gray-900 dark:text-gray-100 ${className}`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Generated {formatDate(meta.generatedAt)} · Report v{meta.version || '1.0'}
        </p>

        <Section title="Test run details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-gray-600 dark:text-gray-400">Run name</dt>
            <dd>{run.runName ?? '—'}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Status</dt>
            <dd>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(run.status)}`}>
                {run.status ?? '—'}
              </span>
            </dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Started</dt>
            <dd>{formatDate(run.startedAt)}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Ended</dt>
            <dd>{formatDate(run.endedAt)}</dd>
            {run.actualDurationSeconds != null && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Duration</dt>
                <dd>{run.actualDurationSeconds}s</dd>
              </>
            )}
            {run.testPlan && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Test plan</dt>
                <dd>{run.testPlan.key ?? run.testPlan.name ?? run.testPlan.id}</dd>
              </>
            )}
            {run.environment && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Environment</dt>
                <dd>{run.environment.name ?? run.environment.id} {run.environment.softwareBuild ? ` · ${run.environment.softwareBuild}` : ''}</dd>
              </>
            )}
          </dl>
        </Section>

        <Section title="Summary">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-gray-600 dark:text-gray-400">Total</dt>
            <dd>{stats.total ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Pass</dt>
            <dd>{stats.pass ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Fail</dt>
            <dd>{stats.fail ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Blocked</dt>
            <dd>{stats.blocked ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Skipped</dt>
            <dd>{stats.skipped ?? 0}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Not run</dt>
            <dd>{stats.notRun ?? 0}</dd>
          </dl>
        </Section>

        {results.length > 0 && (
          <Section title="Results">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 dark:border-gray-600">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left p-2">Key</th>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Executed at</th>
                    <th className="text-left p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r: any) => (
                    <tr key={r.id} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="p-2 font-mono">{r.testCase?.key ?? '—'}</td>
                      <td className="p-2">{r.testCase?.title ?? '—'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(r.resultStatus)}`}>{r.resultStatus ?? '—'}</span>
                      </td>
                      <td className="p-2">{formatDate(r.executedAt)}</td>
                      <td className="p-2 max-w-xs truncate" title={r.notes ?? ''}>{r.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
    )
  }

  return (
    <div className={`p-4 text-gray-500 dark:text-gray-400 ${className}`}>
      Unknown report type.
    </div>
  )
}
