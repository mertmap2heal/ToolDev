/**
 * Shared presentational component that renders a full verification report
 * (test case, test plan, or test run) for use in modal and full-page view.
 * Print-friendly, scrollable; supports double-click to edit when editable props are provided.
 */
import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { verificationService } from '../../services/verification.service'

export type ReportEntityType = 'test-case' | 'test-plan' | 'test-run'

export interface VerificationReportViewProps {
  reportType: ReportEntityType
  reportData: any
  className?: string
  /** When true and projectId/entityId/onSaved are set, text blocks are double-clickable to edit */
  editable?: boolean
  projectId?: string
  entityId?: string
  onSaved?: () => void
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

function EditableBlock({
  value,
  onSave,
  multiline,
  placeholder,
  className = '',
  title,
}: {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
  placeholder?: string
  className?: string
  title?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus()
      ref.current.select?.()
    }
  }, [isEditing])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    const trimmed = typeof localValue === 'string' ? localValue.trim() : ''
    if (trimmed !== (value || '').trim()) onSave(trimmed)
  }, [localValue, value, onSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault()
        handleBlur()
      }
      if (e.key === 'Escape') {
        setLocalValue(value)
        setIsEditing(false)
        ref.current?.blur()
      }
    },
    [multiline, value, handleBlur]
  )

  const displayValue = value || placeholder || '—'
  if (isEditing) {
    const common = {
      ref: ref as any,
      value: localValue,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement & HTMLInputElement>) => setLocalValue(e.target.value),
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      className: `w-full px-2 py-1 border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ${className}`,
    }
    return (
      <div className="min-w-0">
        {multiline ? (
          <textarea rows={4} {...common} />
        ) : (
          <input type="text" {...common} />
        )}
      </div>
    )
  }
  return (
    <div
      role="button"
      tabIndex={0}
      title={title ?? (value ? 'Double-click to edit' : 'Double-click to add')}
      onDoubleClick={() => {
        setLocalValue(value || '')
        setIsEditing(true)
      }}
      className={`cursor-text rounded px-1 -mx-1 hover:bg-blue-50/50 dark:hover:bg-gray-700/50 ${className}`}
    >
      <span className="whitespace-pre-wrap">{displayValue}</span>
    </div>
  )
}

export default function VerificationReportView({
  reportType,
  reportData,
  className = '',
  editable = false,
  projectId,
  entityId,
  onSaved,
}: VerificationReportViewProps) {
  const canEdit = editable && !!projectId && !!onSaved

  const saveCaseField = useCallback(
    async (caseId: string, field: string, value: string | string[]) => {
      if (!projectId || !onSaved) return
      await verificationService.updateTestCase(projectId, caseId, { [field]: value })
      onSaved()
    },
    [projectId, onSaved]
  )
  const savePlanField = useCallback(
    async (planId: string, field: string, value: string | string[]) => {
      if (!projectId || !onSaved) return
      await verificationService.updateTestPlan(projectId, planId, { [field]: value })
      onSaved()
    },
    [projectId, onSaved]
  )

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
    const caseId = entityId || tc.id
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
          {canEdit && <span className="ml-2 text-blue-600 dark:text-blue-400">· Double-click any text to edit</span>}
        </p>

        <Section title="Test case details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-gray-600 dark:text-gray-400">Key</dt>
            <dd>{tc.key ?? '—'}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Title</dt>
            <dd>
              {canEdit && caseId ? (
                <EditableBlock
                  value={tc.title ?? ''}
                  onSave={(v) => saveCaseField(caseId, 'title', v)}
                  className="text-sm"
                />
              ) : (
                (tc.title ?? '—')
              )}
            </dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Status</dt>
            <dd>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(tc.status)}`}>
                {tc.status ?? '—'}
              </span>
            </dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Version</dt>
            <dd>{tc.version ?? '—'}</dd>
            {(tc.objective || canEdit) && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Objective</dt>
                <dd className="text-sm">
                  {canEdit && caseId ? (
                    <EditableBlock
                      value={tc.objective ?? ''}
                      onSave={(v) => saveCaseField(caseId, 'objective', v)}
                      multiline
                      className="text-sm"
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{tc.objective ?? '—'}</span>
                  )}
                </dd>
              </>
            )}
          </dl>
        </Section>

        {(tc.preconditions || canEdit) && (
          <Section title="Preconditions">
            {canEdit && caseId ? (
              <EditableBlock
                value={tc.preconditions ?? ''}
                onSave={(v) => saveCaseField(caseId, 'preconditions', v)}
                multiline
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{tc.preconditions ?? '—'}</p>
            )}
          </Section>
        )}

        {(steps.length > 0 || canEdit) && (
          <Section title="Test procedure">
            {canEdit && caseId ? (
              <EditableBlock
                value={Array.isArray(tc.steps) ? tc.steps.join('\n') : ''}
                onSave={(v) => saveCaseField(caseId, 'steps', v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [])}
                multiline
                placeholder="One step per line"
                className="text-sm"
              />
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {steps.map((step: string, i: number) => (
                  <li key={i} className="pl-1">{step || '—'}</li>
                ))}
              </ol>
            )}
          </Section>
        )}

        {(expectedResults.length > 0 || canEdit) && (
          <Section title="Expected results">
            {canEdit && caseId ? (
              <EditableBlock
                value={Array.isArray(tc.expectedResults) ? tc.expectedResults.join('\n') : ''}
                onSave={(v) => saveCaseField(caseId, 'expectedResults', v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [])}
                multiline
                placeholder="One expected result per line"
                className="text-sm"
              />
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {expectedResults.map((r: string, i: number) => (
                  <li key={i} className="pl-1">{r || '—'}</li>
                ))}
              </ol>
            )}
          </Section>
        )}

        {(tc.passFailCriteria || canEdit) && (
          <Section title="Pass/fail criteria">
            {canEdit && caseId ? (
              <EditableBlock
                value={tc.passFailCriteria ?? ''}
                onSave={(v) => saveCaseField(caseId, 'passFailCriteria', v)}
                multiline
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{tc.passFailCriteria ?? '—'}</p>
            )}
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
          {canEdit && <span className="ml-2 text-blue-600 dark:text-blue-400">· Double-click any text to edit</span>}
        </p>

        <Section title="Test plan details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium text-gray-600 dark:text-gray-400">Key</dt>
            <dd>{plan.key ?? '—'}</dd>
            <dt className="font-medium text-gray-600 dark:text-gray-400">Name</dt>
            <dd>
              {canEdit && entityId ? (
                <EditableBlock
                  value={plan.name ?? ''}
                  onSave={(v) => savePlanField(entityId, 'name', v)}
                  className="text-sm"
                />
              ) : (
                (plan.name ?? '—')
              )}
            </dd>
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
            {plan.ownerUserId && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Owner</dt>
                <dd>{plan.ownerUserId}</dd>
              </>
            )}
            {(plan.description || (canEdit && entityId)) && (
              <>
                <dt className="font-medium text-gray-600 dark:text-gray-400">Description</dt>
                <dd className="text-sm">
                  {canEdit && entityId ? (
                    <EditableBlock
                      value={plan.description ?? ''}
                      onSave={(v) => savePlanField(entityId, 'description', v)}
                      multiline
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{plan.description ?? '—'}</span>
                  )}
                </dd>
              </>
            )}
          </dl>
        </Section>

        {(plan.scope || (canEdit && entityId)) && (
          <Section title="Scope">
            {canEdit && entityId ? (
              <EditableBlock
                value={plan.scope ?? ''}
                onSave={(v) => savePlanField(entityId, 'scope', v)}
                multiline
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{plan.scope ?? '—'}</p>
            )}
          </Section>
        )}

        {(plan.entryCriteria || (canEdit && entityId)) && (
          <Section title="Entry criteria">
            {canEdit && entityId ? (
              <EditableBlock
                value={plan.entryCriteria ?? ''}
                onSave={(v) => savePlanField(entityId, 'entryCriteria', v)}
                multiline
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{plan.entryCriteria ?? '—'}</p>
            )}
          </Section>
        )}

        {(plan.exitCriteria || (canEdit && entityId)) && (
          <Section title="Exit criteria">
            {canEdit && entityId ? (
              <EditableBlock
                value={plan.exitCriteria ?? ''}
                onSave={(v) => savePlanField(entityId, 'exitCriteria', v)}
                multiline
                className="text-sm"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{plan.exitCriteria ?? '—'}</p>
            )}
          </Section>
        )}

        {Array.isArray(plan.testingEnvironmentIds) && plan.testingEnvironmentIds.length > 0 && (
          <Section title="Testing environment">
            <p className="text-sm">{plan.testingEnvironmentIds.join(', ')}</p>
          </Section>
        )}

        {Array.isArray(plan.testingToolIds) && plan.testingToolIds.length > 0 && (
          <Section title="Testing tools">
            <p className="text-sm">{plan.testingToolIds.join(', ')}</p>
          </Section>
        )}

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
          <>
            <Section title="Test cases summary">
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

            <Section title="Test case details">
              <div className="space-y-8">
                {testCases.map((pc: any, i: number) => {
                  const tc = pc.testCase || {}
                  const steps = Array.isArray(tc.steps) ? tc.steps : []
                  const expectedResults = Array.isArray(tc.expectedResults) ? tc.expectedResults : []
                  return (
                    <div
                      key={tc.id ?? i}
                      className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">#{pc.orderIndex ?? i + 1}</span>
                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">{tc.key ?? '—'}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{tc.title ?? '—'}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(tc.status)}`}>
                          {tc.status ?? '—'}
                        </span>
                        {pc.latestResult && (
                          <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(pc.latestResult.status)}`}>
                            Latest: {pc.latestResult.status} {pc.latestResult.executedAt ? formatDate(pc.latestResult.executedAt) : ''}
                          </span>
                        )}
                      </div>
                      {(tc.objective || (canEdit && tc.id)) && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Objective</p>
                          {canEdit && tc.id ? (
                            <EditableBlock
                              value={tc.objective ?? ''}
                              onSave={(v) => saveCaseField(tc.id, 'objective', v)}
                              multiline
                              className="text-sm text-gray-900 dark:text-gray-100"
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">{tc.objective ?? '—'}</p>
                          )}
                        </div>
                      )}
                      {(tc.preconditions || (canEdit && tc.id)) && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Preconditions</p>
                          {canEdit && tc.id ? (
                            <EditableBlock
                              value={tc.preconditions ?? ''}
                              onSave={(v) => saveCaseField(tc.id, 'preconditions', v)}
                              multiline
                              className="text-sm text-gray-900 dark:text-gray-100"
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">{tc.preconditions ?? '—'}</p>
                          )}
                        </div>
                      )}
                      {(steps.length > 0 || (canEdit && tc.id)) && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Test procedure</p>
                          {canEdit && tc.id ? (
                            <EditableBlock
                              value={Array.isArray(tc.steps) ? tc.steps.join('\n') : ''}
                              onSave={(v) => saveCaseField(tc.id, 'steps', v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [])}
                              multiline
                              placeholder="One step per line"
                              className="text-sm text-gray-900 dark:text-gray-100"
                            />
                          ) : (
                            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-900 dark:text-gray-100">
                              {steps.map((step: string, si: number) => (
                                <li key={si} className="pl-1">{step || '—'}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                      {(expectedResults.length > 0 || (canEdit && tc.id)) && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Expected results</p>
                          {canEdit && tc.id ? (
                            <EditableBlock
                              value={Array.isArray(tc.expectedResults) ? tc.expectedResults.join('\n') : ''}
                              onSave={(v) => saveCaseField(tc.id, 'expectedResults', v ? v.split('\n').map((s) => s.trim()).filter(Boolean) : [])}
                              multiline
                              placeholder="One per line"
                              className="text-sm text-gray-900 dark:text-gray-100"
                            />
                          ) : (
                            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-900 dark:text-gray-100">
                              {expectedResults.map((r: string, ri: number) => (
                                <li key={ri} className="pl-1">{r || '—'}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                      {(tc.passFailCriteria || (canEdit && tc.id)) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Pass/fail criteria</p>
                          {canEdit && tc.id ? (
                            <EditableBlock
                              value={tc.passFailCriteria ?? ''}
                              onSave={(v) => saveCaseField(tc.id, 'passFailCriteria', v)}
                              multiline
                              className="text-sm text-gray-900 dark:text-gray-100"
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">{tc.passFailCriteria ?? '—'}</p>
                          )}
                        </div>
                      )}
                      {!tc.objective && !tc.preconditions && steps.length === 0 && expectedResults.length === 0 && !tc.passFailCriteria && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No details for this test case.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Section>
          </>
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
