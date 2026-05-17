/**
 * NX-2 (#440) — baseline-compare page.
 *
 * Route: /projects/:projectId/baselines/:baselineId/diff/:otherBaselineId
 *
 * Consumes the NX-2 baseline-diff endpoint (versionService.compareBaselineRoots,
 * which calls R-4's compareBaselineRoots verbatim) and renders:
 *   - the added / removed requirement lists (chip rows)
 *   - a <VersionDiff> per changed requirement (field-level + line-level)
 *
 * Filter chips scope the changed list to added / removed / changed; j / k step
 * through the changed-requirement cards. Tokens only — no blue-*.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { versionService } from '../../services/version.service'
import VersionDiff from '../../components/common/VersionDiff'

const REQUIREMENT_FIELD_LABELS: Record<string, string> = {
  title: 'Title', description: 'Description', priority: 'Priority', status: 'Status',
  stage: 'Stage', owner: 'Owner', category: 'Category', source: 'Source',
  verificationMethod: 'Verification Method', acceptanceCriteria: 'Acceptance Criteria', tags: 'Tags',
}

type Filter = 'all' | 'added' | 'removed' | 'changed'

export default function BaselineDiffPage() {
  const { projectId, baselineId, otherBaselineId } = useParams<{
    projectId: string
    baselineId: string
    otherBaselineId: string
  }>()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [focusedIdx, setFocusedIdx] = useState(0)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['baseline-root-diff', projectId, baselineId, otherBaselineId],
    queryFn: async () => {
      const res = await versionService.compareBaselineRoots(
        projectId!,
        baselineId!,
        otherBaselineId!,
      )
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Could not load baseline diff')
      }
      return res.data
    },
    enabled: !!projectId && !!baselineId && !!otherBaselineId,
  })

  const changed = data?.changed ?? []

  // j / k step through changed-requirement cards; Escape returns.
  const stepFocus = useCallback(
    (dir: 1 | -1) => {
      setFocusedIdx((prev) => {
        if (changed.length === 0) return prev
        const next = Math.min(Math.max(prev + dir, 0), changed.length - 1)
        cardRefs.current[next]?.scrollIntoView({ block: 'nearest' })
        return next
      })
    },
    [changed.length],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'j') {
        e.preventDefault()
        stepFocus(1)
      } else if (e.key === 'k') {
        e.preventDefault()
        stepFocus(-1)
      } else if (e.key === 'Escape') {
        navigate(-1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [stepFocus, navigate])

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-ink-muted">Loading baseline diff…</p>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-[4px] bg-surface-inset" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-status-danger">
          Diff failed: could not load the baseline comparison. Retry, or pick a different baseline.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 rounded-[4px] border border-default px-3 py-1 text-[13px] text-ink-primary hover:bg-surface-inset"
        >
          Retry
        </button>
      </div>
    )
  }

  const showAdded = filter === 'all' || filter === 'added'
  const showRemoved = filter === 'all' || filter === 'removed'
  const showChanged = filter === 'all' || filter === 'changed'

  const noChanges =
    data.summary.addedCount === 0 &&
    data.summary.removedCount === 0 &&
    data.summary.changedCount === 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="rounded-[4px] border border-default p-1 text-ink-muted hover:bg-surface-inset"
        >
          <ArrowLeft size={18} aria-hidden />
        </button>
        <GitCompare size={18} className="text-accent-primary" aria-hidden />
        <div>
          <h1 className="text-[24px] font-medium text-ink-primary">Baseline diff</h1>
          <p className="text-[13px] text-ink-muted">
            {data.rootA.name} <span aria-hidden>→</span> {data.rootB.name}
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="mb-4 flex items-center gap-2" role="group" aria-label="Filter changes">
        {(
          [
            ['all', `All (${data.summary.addedCount + data.summary.removedCount + data.summary.changedCount})`],
            ['added', `Added (${data.summary.addedCount})`],
            ['removed', `Removed (${data.summary.removedCount})`],
            ['changed', `Changed (${data.summary.changedCount})`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={
              'rounded-[2px] px-2 py-1 text-[12px] transition-colors ' +
              (filter === key
                ? 'bg-accent-primary text-white'
                : 'border border-default text-ink-muted hover:bg-surface-inset')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {noChanges ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">
          No changes between baseline {data.rootA.name} and baseline {data.rootB.name}.
        </p>
      ) : (
        <div className="space-y-6">
          {/* Added requirements */}
          {showAdded && data.added.length > 0 && (
            <section>
              <h2 className="mb-2 text-[15px] font-medium text-ink-primary">
                Added requirements ({data.added.length})
              </h2>
              <ul className="space-y-1">
                {data.added.map((item) => (
                  <li
                    key={item.linkedEntityId}
                    className="rounded-[4px] border-l-2 border border-default px-3 py-2 text-[13px] text-ink-primary"
                    style={{ borderLeftColor: 'var(--status-success)' }}
                  >
                    <span className="font-mono text-[12px] text-ink-muted">
                      {item.requirementKey ?? item.linkedEntityId.slice(0, 8)}
                    </span>{' '}
                    {item.title ?? '—'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Removed requirements */}
          {showRemoved && data.removed.length > 0 && (
            <section>
              <h2 className="mb-2 text-[15px] font-medium text-ink-primary">
                Removed requirements ({data.removed.length})
              </h2>
              <ul className="space-y-1">
                {data.removed.map((item) => (
                  <li
                    key={item.linkedEntityId}
                    className="rounded-[4px] border-l-2 border border-default px-3 py-2 text-[13px] text-ink-primary"
                    style={{ borderLeftColor: 'var(--status-danger)' }}
                  >
                    <span className="font-mono text-[12px] text-ink-muted">
                      {item.requirementKey ?? item.linkedEntityId.slice(0, 8)}
                    </span>{' '}
                    {item.title ?? '—'}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Changed requirements — one <VersionDiff> per requirement */}
          {showChanged && changed.length > 0 && (
            <section>
              <h2 className="mb-2 text-[15px] font-medium text-ink-primary">
                Changed requirements ({changed.length})
              </h2>
              <div className="space-y-4">
                {changed.map((entry, idx) => (
                  <div
                    key={entry.linkedEntityId}
                    ref={(el) => {
                      cardRefs.current[idx] = el
                    }}
                    className={
                      'rounded-[4px] border p-4 ' +
                      (idx === focusedIdx ? 'border-strong' : 'border-default')
                    }
                  >
                    <p className="mb-3 text-[15px] font-medium text-ink-primary">
                      <span className="font-mono text-[12px] text-ink-muted">
                        {entry.requirementKey ?? entry.linkedEntityId.slice(0, 8)}
                      </span>{' '}
                      {entry.title ?? '—'}
                    </p>
                    <VersionDiff
                      fields={entry.fields}
                      labelA={data.rootA.name}
                      labelB={data.rootB.name}
                      fieldLabels={REQUIREMENT_FIELD_LABELS}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
