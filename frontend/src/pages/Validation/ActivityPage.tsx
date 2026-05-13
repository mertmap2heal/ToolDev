import { useMemo, useState } from 'react'
import './validation-v2.css'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Filter, ExternalLink } from 'lucide-react'
import { validationService } from '../../services/validation.service'

// Parse the audit details JSON safely; we only need a couple of fields.
function parseDetails(raw: string | null): { validationItemId?: string; baselineId?: string } {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    if (typeof v !== 'object' || v === null) return {}
    const out: { validationItemId?: string; baselineId?: string } = {}
    if (typeof v.validationItemId === 'string') out.validationItemId = v.validationItemId
    if (typeof v.baselineId === 'string') out.baselineId = v.baselineId
    return out
  } catch {
    return {}
  }
}

// Project-wide validation audit feed. The backend already writes a row to
// AuditLog for every meaningful state change (create, update, sign-off,
// evidence upload, bulk update, suspect-ack, baseline-create, settings-update,
// etc.); this page renders the chronologically-sorted log and lets a DER or
// PM filter by actor and action category.

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

function actionLabel(action: string): string {
  // Strip the validation: prefix and humanise the rest.
  const t = action.replace(/^validation:/, '')
  return t.replace(/-/g, ' ')
}

function actionColor(action: string): string {
  // Uses the shared --val-bar-* tokens scoped to .validation-v2 (cycle 115)
  // so action chips lift correctly on dark theme instead of inheriting the
  // dim light-theme fallback hexes.
  if (action.includes('sign-off')) return 'var(--val-bar-validated)'
  if (action.includes('delete')) return 'var(--val-bar-blocked)'
  if (action.includes('baseline')) return 'var(--val-bar-executed)'
  if (action.includes('upload')) return 'var(--val-bar-executed)'
  if (action.includes('suspect')) return 'var(--pv-amber)'
  return 'var(--pv-fg-3)'
}

export default function ActivityPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [actionFilter, setActionFilter] = useState<string>('')
  const [userFilter, setUserFilter] = useState<string>('')

  const { data: rows = [] } = useQuery({
    queryKey: ['validation-project-activity', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.listProjectActivity(projectId!, 300)
      return res.success && res.data ? res.data : []
    },
  })

  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  )
  const users = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) {
      if (r.user?.id) m.set(r.user.id, r.user.name ?? r.user.email ?? r.user.id)
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter && r.action !== actionFilter) return false
      if (userFilter && r.user?.id !== userFilter) return false
      return true
    })
  }, [rows, actionFilter, userFilter])

  if (!projectId) return null

  return (
    <div className="params-v2 validation-v2 space-y-4" style={{ padding: '16px 24px' }}>
      <div className="pv-title-row">
        <div>
          <h1>Validation — Activity</h1>
          <p className="pv-title-meta">
            Chronological audit log of every validation action: creates, updates, sign-offs,
            evidence uploads, baselines, suspect acknowledgements, settings changes.
          </p>
        </div>
        <div className="pv-right">
          <Link to={`/projects/${projectId}/validation`} className="pv-btn">
            <ArrowLeft size={14} /> Back to Validation
          </Link>
        </div>
      </div>

      <div className="pv-subbar" style={{ margin: 0, borderRadius: 6, border: '1px solid var(--pv-line)' }}>
        <Filter size={14} style={{ color: 'var(--pv-fg-3)' }} />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ height: 26, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)' }}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          style={{ height: 26, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)' }}
        >
          <option value="">All users</option>
          {users.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--pv-fg-3)' }}>
          {visible.length} of {rows.length} events
        </span>
      </div>

      {visible.length === 0 ? (
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
          No events match the current filters.
        </div>
      ) : (
        <div
          style={{
            border: '1px solid var(--pv-line)',
            borderRadius: 6,
            background: 'var(--pv-bg)',
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visible.map((r) => {
              const det = parseDetails(r.details)
              const target = det.validationItemId
                ? `/projects/${projectId}/validation?open=${det.validationItemId}`
                : det.baselineId
                ? `/projects/${projectId}/validation/baselines`
                : null
              return (
                <li
                  key={r.id}
                  onClick={() => target && navigate(target)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 160px 1fr 100px 20px',
                    alignItems: 'baseline',
                    gap: 12,
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--pv-line)',
                    fontSize: 12,
                    cursor: target ? 'pointer' : 'default',
                  }}
                  className={target ? 'is-clickable' : ''}
                  title={target ? 'Open in drawer' : 'No deep-link for this event type'}
                >
                  <span
                    style={{
                      fontFamily: 'var(--pv-font-mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: actionColor(r.action),
                      minWidth: 110,
                    }}
                  >
                    {actionLabel(r.action)}
                  </span>
                  <span style={{ color: 'var(--pv-fg-2)' }}>
                    {r.user?.name ?? r.user?.email ?? '—'}
                  </span>
                  <span style={{ color: 'var(--pv-fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.details ?? ''}
                  </span>
                  <span style={{ color: 'var(--pv-fg-3)', fontFamily: 'var(--pv-font-mono)', fontSize: 11, textAlign: 'right' }} title={new Date(r.createdAt).toLocaleString()}>
                    {relativeTime(r.createdAt)}
                  </span>
                  <span style={{ color: 'var(--pv-fg-3)' }}>
                    {target && <ExternalLink size={11} />}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
