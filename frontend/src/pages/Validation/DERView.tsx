import { useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Printer, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import {
  validationService,
  VALIDATION_MILESTONES,
  type ValidationItemSummary,
} from '../../services/validation.service'
import {
  METHOD_LABEL,
  MILESTONE_LABEL,
  STATUS_LABEL,
} from '../../components/validation/validationLabels'

// DER read-only view per design-system.md §8.5 — objective-indexed,
// artefact-linked, sign-off-visible. No edit controls, no drawer, no bulk
// actions. Intended for Designated Engineering Representative review and for
// printable hand-off to certification authorities.

export default function DERView() {
  const { projectId } = useParams<{ projectId: string }>()

  const { data: items = [] } = useQuery({
    queryKey: ['validation-items', projectId, 'der'],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.list(projectId!, {})
      return res.success && res.data ? res.data : []
    },
  })

  const { data: coverage } = useQuery({
    queryKey: ['validation-coverage', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.coverage(projectId!)
      return res.success && res.data ? res.data : null
    },
  })

  const liveItems = useMemo(() => items.filter((i) => !i.deletedAt), [items])

  const groups = useMemo(() => {
    const map = new Map<string, ValidationItemSummary[]>()
    for (const it of liveItems) {
      const k = it.targetMilestone || 'OTHER'
      const arr = map.get(k) ?? []
      arr.push(it)
      map.set(k, arr)
    }
    return VALIDATION_MILESTONES.filter((m) => map.has(m)).map((m) => ({
      milestone: m,
      items: (map.get(m) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
    }))
  }, [liveItems])

  if (!projectId) return null

  const validatedCount = liveItems.filter((i) => i.status === 'VALIDATED').length
  const suspectCount = liveItems.filter((i) => i.isSuspect).length
  const blockedCount = liveItems.filter((i) => i.status === 'BLOCKED').length

  return (
    <div className="params-v2 validation-v2 space-y-4" style={{ padding: '16px 24px' }}>
      <style>{`
        @media print {
          .der-print-hide { display: none !important; }
          .der-page { padding: 0 !important; }
          body { background: #fff; color: #000; }
          a { color: inherit !important; text-decoration: none !important; }
        }
        .der-card { break-inside: avoid; }
      `}</style>

      <div className="pv-title-row der-page">
        <div>
          <div className="flex items-center gap-2">
            <h1>Validation — DER view</h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--pv-fg-3)',
                border: '1px solid var(--pv-line)',
                padding: '2px 6px',
                borderRadius: 3,
              }}
              title="Read-only audit view. Edits are not possible from this screen."
            >
              Read-only
            </span>
          </div>
          <p className="pv-title-meta">
            Designated Engineering Representative findings-of-compliance view. Milestone-indexed,
            sign-off-visible. No edit controls.
          </p>
        </div>
        <div className="pv-right der-print-hide">
          <Link to={`/projects/${projectId}/validation`} className="pv-btn">
            <ArrowLeft size={14} /> Back to Validation
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="pv-btn"
            title="Print this view"
          >
            <Printer size={14} /> Print
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(validationService.markdownExportUrl(projectId, {}), '_blank')
            }
            className="pv-btn primary"
            title="Download a Markdown report of the current state"
          >
            <Download size={14} /> Export report
          </button>
        </div>
      </div>

      {coverage && (
        <div className="vv-coverage">
          <div className="vv-coverage-head">
            <span className="vv-label">Programme coverage</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 8,
            }}
          >
            <div className="vv-tile">
              <div className="vv-tile-label">Items</div>
              <div className="vv-tile-value">{coverage.total}</div>
            </div>
            <div className="vv-tile vv-tile-validated">
              <div className="vv-tile-label">Validated</div>
              <div className="vv-tile-value">{validatedCount}</div>
            </div>
            <div className="vv-tile">
              <div className="vv-tile-label">Requirements covered</div>
              <div className="vv-tile-value">
                {coverage.totals.requirementsWithValidation} / {coverage.totals.requirements}
              </div>
            </div>
            <div className={`vv-tile ${blockedCount > 0 ? 'vv-tile-gap' : ''}`}>
              <div className="vv-tile-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={11} /> Blocked
              </div>
              <div className="vv-tile-value">{blockedCount}</div>
            </div>
            <div className={`vv-tile ${suspectCount > 0 ? 'vv-tile-gap' : ''}`}>
              <div className="vv-tile-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} /> Suspect
              </div>
              <div className="vv-tile-value">{suspectCount}</div>
            </div>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div
          style={{
            border: '1px solid var(--pv-line)',
            borderRadius: 6,
            padding: 32,
            textAlign: 'center',
            color: 'var(--pv-fg-3)',
            fontSize: 13,
          }}
        >
          No validation items to review.
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.milestone} className="der-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '8px 0',
                borderBottom: '1px solid var(--pv-line)',
                marginBottom: 8,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {MILESTONE_LABEL[g.milestone]}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--pv-fg-3)' }}>
                {g.items.length} item{g.items.length === 1 ? '' : 's'} —{' '}
                {g.items.filter((i) => i.status === 'VALIDATED').length} validated
              </span>
            </div>

            <table className="pv-params" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Key</th>
                  <th>Title</th>
                  <th style={{ width: 130 }}>Method</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 80 }}>Criteria</th>
                  <th style={{ width: 110 }}>Sign-offs</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((it) => {
                  const total = it.criteria?.length ?? 0
                  const met = it.criteria?.filter((c) => c.outcome === 'MET').length ?? 0
                  const colorClass =
                    it.status === 'VALIDATED'
                      ? 'approved'
                      : it.status === 'EXECUTED'
                      ? 'review'
                      : it.status === 'BLOCKED'
                      ? 'deprecated'
                      : it.status === 'OBSOLETE'
                      ? 'obsolete'
                      : 'draft'
                  return (
                    <tr key={it.id}>
                      <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>
                        {it.key}
                        {it.isSuspect && (
                          <span
                            className="vv-row-suspect"
                            title="A linked requirement was updated after this validation."
                            style={{ marginLeft: 4 }}
                          >
                            <AlertTriangle size={10} /> suspect
                          </span>
                        )}
                      </td>
                      <td>{it.title}</td>
                      <td style={{ color: 'var(--pv-fg-2)' }}>{METHOD_LABEL[it.methodType]}</td>
                      <td>
                        <span className={`pv-status ${colorClass}`}>{STATUS_LABEL[it.status]}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>
                        {met}/{total}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--pv-fg-2)' }}>
                        {(it._count?.signOffs ?? 0) > 0 ? (
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
                            title="Has at least one recorded sign-off"
                          >
                            <CheckCircle size={11} /> {it._count?.signOffs ?? 0}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--pv-fg-3)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  )
}
