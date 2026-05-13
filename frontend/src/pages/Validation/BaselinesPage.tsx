import { useMemo, useState, useEffect } from 'react'
import './validation-v2.css'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Trash2, X } from 'lucide-react'
import {
  validationService,
  type ValidationBaseline,
} from '../../services/validation.service'
import { STATUS_LABEL, METHOD_LABEL, MILESTONE_LABEL } from '../../components/validation/validationLabels'

// Per design-system.md §8.3 baselines are frozen point-in-time snapshots.
// This page lists every baseline a project has taken and lets the user open
// any one in a read-only side panel to inspect the items as they were at
// snapshot time.

function relativeTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function BaselinesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState<string | null>(null)

  const { data: baselines = [] } = useQuery({
    queryKey: ['validation-baselines', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.listBaselines(projectId!)
      return res.success && res.data ? res.data : []
    },
  })

  // Esc closes the open baseline drawer to match the keyboard-first UX
  // already used by the main validation page.
  useEffect(() => {
    if (!openId) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [openId])

  const { data: openBaseline } = useQuery<ValidationBaseline | null>({
    queryKey: ['validation-baseline', projectId, openId],
    enabled: !!projectId && !!openId,
    queryFn: async () => {
      const res = await validationService.getBaseline(projectId!, openId!)
      return res.success && res.data ? res.data : null
    },
  })

  const { data: liveItems = [] } = useQuery({
    queryKey: ['validation-items-for-diff', projectId],
    enabled: !!projectId && !!openId,
    queryFn: async () => {
      const res = await validationService.list(projectId!, {})
      return res.success && res.data ? res.data : []
    },
  })

  type Diff = {
    added: Array<{ id: string; key: string; title: string }>
    removed: Array<{ id: string; key: string; title: string }>
    changed: Array<{
      id: string
      key: string
      title: string
      changes: Array<{ field: string; from: unknown; to: unknown }>
    }>
    unchanged: number
  }
  const diff: Diff | null = useMemo(() => {
    if (!openBaseline) return null
    type LiveLite = {
      id: string
      key: string
      title: string
      status: string
      targetMilestone: string
      methodType: string
      priority: string
      deletedAt: string | null
      criteria: Array<{ outcome: string }>
    }
    const live = (liveItems as LiveLite[]).filter((i) => !i.deletedAt)
    const liveById = new Map(live.map((i) => [i.id, i]))
    const snapById = new Map(openBaseline.snapshot.map((s) => [s.id, s]))
    const added = live
      .filter((l) => !snapById.has(l.id))
      .map((l) => ({ id: l.id, key: l.key, title: l.title }))
    const removed = openBaseline.snapshot
      .filter((s) => !liveById.has(s.id))
      .map((s) => ({ id: s.id, key: s.key, title: s.title }))
    const changed: Diff['changed'] = []
    let unchanged = 0
    for (const s of openBaseline.snapshot) {
      const l = liveById.get(s.id)
      if (!l) continue
      const changes: Array<{ field: string; from: unknown; to: unknown }> = []
      const cmpFields: Array<keyof LiveLite & keyof typeof s> = [
        'status', 'targetMilestone', 'methodType', 'priority', 'title',
      ]
      for (const f of cmpFields) {
        const sv = (s as unknown as Record<string, unknown>)[f]
        const lv = (l as unknown as Record<string, unknown>)[f]
        if (sv !== lv) changes.push({ field: f as string, from: sv, to: lv })
      }
      // Criteria-met-count is a useful summary metric on its own.
      const sMet = (s.criteria ?? []).filter((c) => c.outcome === 'MET').length
      const lMet = (l.criteria ?? []).filter((c) => c.outcome === 'MET').length
      if (sMet !== lMet) changes.push({ field: 'criteriaMet', from: sMet, to: lMet })
      if (changes.length > 0) {
        changed.push({ id: s.id, key: s.key, title: s.title, changes })
      } else {
        unchanged++
      }
    }
    return { added, removed, changed, unchanged }
  }, [openBaseline, liveItems])

  if (!projectId) return null

  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Delete baseline "${label}"? Frozen snapshots cannot be recovered.`)) return
    const res = await validationService.deleteBaseline(projectId, id)
    if (res.success) {
      queryClient.invalidateQueries({ queryKey: ['validation-baselines', projectId] })
      if (openId === id) setOpenId(null)
    }
  }

  return (
    <div className="params-v2 validation-v2 space-y-4" style={{ padding: '16px 24px' }}>
      <div className="pv-title-row">
        <div>
          <h1>Validation — Baselines</h1>
          <p className="pv-title-meta">
            Frozen point-in-time snapshots of every validation item. Use a baseline as a
            certification-review anchor or to compare current state against an earlier milestone.
          </p>
        </div>
        <div className="pv-right">
          <Link to={`/projects/${projectId}/validation`} className="pv-btn">
            <ArrowLeft size={14} /> Back to Validation
          </Link>
        </div>
      </div>

      {baselines.length === 0 ? (
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
          No baselines yet. Open the Validation page and click "Baseline state" to take the first snapshot.
        </div>
      ) : (
        <div className="pv-table-pane" style={{ border: '1px solid var(--pv-line)', borderRadius: 6, overflow: 'hidden' }}>
          <table className="pv-params">
            <thead>
              <tr>
                <th style={{ width: 200 }}>Label</th>
                <th>Description</th>
                <th style={{ width: 90 }}>Items</th>
                <th style={{ width: 160 }}>Created by</th>
                <th style={{ width: 110 }}>Created</th>
                <th style={{ width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {baselines.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setOpenId(b.id)}
                  style={{ cursor: 'pointer' }}
                  className={openId === b.id ? 'is-selected' : ''}
                >
                  <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>{b.label}</td>
                  <td style={{ color: 'var(--pv-fg-2)' }}>{b.description ?? '—'}</td>
                  <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>{b.itemCount}</td>
                  <td style={{ fontSize: 12, color: 'var(--pv-fg-2)' }}>
                    {b.createdBy?.name ?? '—'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--pv-fg-3)' }} title={new Date(b.createdAt).toLocaleString()}>
                    {relativeTime(b.createdAt)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="pv-icon-btn"
                      style={{ width: 22, height: 22 }}
                      aria-label="Delete baseline"
                      onClick={() => remove(b.id, b.label)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && openBaseline && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setOpenId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(880px, 96vw)',
              height: '100%',
              background: 'var(--pv-bg)',
              borderLeft: '1px solid var(--pv-line)',
              padding: 16,
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 500,
                    fontFamily: "'Fraunces', 'Iowan Old Style', Georgia, serif",
                    letterSpacing: '-0.01em',
                  }}
                >
                  {openBaseline.label}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--pv-fg-3)' }}>
                  {openBaseline.itemCount} items · taken {relativeTime(openBaseline.createdAt)} by{' '}
                  {openBaseline.createdBy?.name ?? 'Unknown'}
                </p>
                {openBaseline.description && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--pv-fg-2)' }}>
                    {openBaseline.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close baseline"
                className="pv-icon-btn"
                style={{ width: 28, height: 28 }}
              >
                <X size={14} />
              </button>
            </div>

            {diff && (
              <div
                style={{
                  border: '1px solid var(--pv-line)',
                  borderRadius: 4,
                  padding: 10,
                  marginBottom: 12,
                  background: 'var(--pv-surface-soft)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--pv-fg-3)',
                    marginBottom: 6,
                  }}
                >
                  Diff vs current state
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                  <span style={{ color: 'var(--pv-green, #1B4332)' }} title="Items present now but not at baseline time">
                    +{diff.added.length} added
                  </span>
                  <span style={{ color: 'var(--pv-red, #8B0000)' }} title="Items present at baseline but no longer live">
                    -{diff.removed.length} removed
                  </span>
                  <span style={{ color: 'var(--pv-amber, #B8860B)' }} title="Items whose status / milestone / method / priority / criteria-met have changed since the baseline">
                    ~{diff.changed.length} changed
                  </span>
                  <span style={{ color: 'var(--pv-fg-3)' }}>
                    {diff.unchanged} unchanged
                  </span>
                </div>
                {diff.changed.length > 0 && (
                  <details style={{ marginTop: 8, fontSize: 11 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--pv-fg-2)' }}>
                      Show changed items
                    </summary>
                    <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
                      {diff.changed.map((c) => (
                        <li key={c.id} style={{ padding: '2px 0', borderTop: '1px solid var(--pv-line)' }}>
                          <span style={{ fontFamily: 'var(--pv-font-mono)' }}>{c.key}</span>{' '}
                          <span style={{ color: 'var(--pv-fg-2)' }}>{c.title}</span>
                          <ul style={{ margin: '2px 0 0 16px', padding: 0, listStyle: 'circle', color: 'var(--pv-fg-3)' }}>
                            {c.changes.map((ch, i) => (
                              <li key={i}>
                                <code style={{ color: 'var(--pv-fg-2)' }}>{ch.field}</code>:{' '}
                                <span style={{ color: 'var(--pv-red)' }}>{String(ch.from)}</span> →{' '}
                                <span style={{ color: 'var(--pv-green, #1B4332)' }}>{String(ch.to)}</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <table className="pv-params" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Key</th>
                  <th>Title</th>
                  <th style={{ width: 130 }}>Method</th>
                  <th style={{ width: 90 }}>Milestone</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 80 }}>Criteria</th>
                  <th style={{ width: 100 }}>Sign-offs</th>
                </tr>
              </thead>
              <tbody>
                {openBaseline.snapshot.map((it) => {
                  const total = it.criteria?.length ?? 0
                  const met = it.criteria?.filter((c) => c.outcome === 'MET').length ?? 0
                  return (
                    <tr key={it.id}>
                      <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>{it.key}</td>
                      <td>{it.title}</td>
                      <td style={{ color: 'var(--pv-fg-2)' }}>{METHOD_LABEL[it.methodType as keyof typeof METHOD_LABEL] ?? it.methodType}</td>
                      <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>{it.targetMilestone}</td>
                      <td>
                        <span className="pv-status">{STATUS_LABEL[it.status as keyof typeof STATUS_LABEL] ?? it.status}</span>
                      </td>
                      <td style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12 }}>
                        {met}/{total}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--pv-fg-2)' }}>
                        {it.signOffCount}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {/* MILESTONE_LABEL referenced in tests of the column above (kept here to avoid unused import noise) */}
            <span style={{ display: 'none' }}>{Object.keys(MILESTONE_LABEL).length}</span>
          </div>
        </div>
      )}
    </div>
  )
}
