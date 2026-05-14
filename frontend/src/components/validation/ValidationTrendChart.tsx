import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import type { ValidationTrendPoint } from '../../services/validation.service'

interface Props {
  points: ValidationTrendPoint[]
  isLoading?: boolean
}

// Stacked-bar trend chart for validation status transitions per day.
// Hand-rolled SVG so we do not pull in a chart library. Color tokens come
// from validation-v2.css (--val-bar-*) so the chart stays theme-aware.

const STATUSES = ['VALIDATED', 'EXECUTED', 'BLOCKED', 'PLANNED', 'OBSOLETE'] as const
type Status = (typeof STATUSES)[number]

const STATUS_COLOR: Record<Status, string> = {
  VALIDATED: 'var(--val-bar-validated)',
  EXECUTED: 'var(--val-bar-executed)',
  BLOCKED: 'var(--val-bar-blocked)',
  PLANNED: 'var(--val-bar-planned)',
  OBSOLETE: 'var(--val-bar-obsolete)',
}

const STATUS_LABEL: Record<Status, string> = {
  VALIDATED: 'Validated',
  EXECUTED: 'Executed',
  BLOCKED: 'Blocked',
  PLANNED: 'Planned',
  OBSOLETE: 'Obsolete',
}

export default function ValidationTrendChart({ points, isLoading }: Props) {
  const [open, setOpen] = useState(false)

  const totals = useMemo(() => {
    const t: Record<Status, number> = {
      VALIDATED: 0, EXECUTED: 0, BLOCKED: 0, PLANNED: 0, OBSOLETE: 0,
    }
    for (const p of points) for (const s of STATUSES) t[s] += p[s]
    return t
  }, [points])

  const grandTotal = totals.VALIDATED + totals.EXECUTED + totals.BLOCKED + totals.PLANNED + totals.OBSOLETE

  const yMax = useMemo(() => {
    let max = 0
    for (const p of points) {
      const sum = STATUSES.reduce((acc, s) => acc + p[s], 0)
      if (sum > max) max = sum
    }
    return Math.max(1, max)
  }, [points])

  if (isLoading) {
    return (
      <div
        style={{
          fontSize: 11,
          color: 'var(--pv-fg-3)',
          padding: '6px 12px',
          border: '1px solid var(--pv-line)',
          borderRadius: 6,
        }}
      >
        Loading trend…
      </div>
    )
  }

  if (grandTotal === 0) {
    return (
      <div
        style={{
          fontSize: 11,
          color: 'var(--pv-fg-3)',
          padding: '8px 12px',
          border: '1px dashed var(--pv-line)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        aria-label="Trend chart - no transitions recorded in window"
      >
        <TrendingUp size={12} />
        No status transitions in the last 30 days yet.
      </div>
    )
  }

  // Dimensions
  const W = 720
  const H = 96
  const padX = 8
  const padY = 8
  const innerW = W - padX * 2
  const innerH = H - padY * 2
  const bw = innerW / Math.max(1, points.length)
  const gap = Math.min(2, bw * 0.18)

  return (
    <div
      style={{
        border: '1px solid var(--pv-line)',
        borderRadius: 6,
        background: 'var(--pv-surface-soft)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="validation-trend-body"
        style={{
          width: '100%',
          background: 'none',
          border: 0,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          color: 'inherit',
          font: 'inherit',
          fontSize: 12,
        }}
      >
        <TrendingUp size={13} style={{ color: 'var(--pv-green)' }} />
        <span style={{ fontWeight: 600, color: 'var(--pv-fg)' }}>
          Trend - last 30 days
        </span>
        <span style={{ fontSize: 11, color: 'var(--pv-fg-3)' }}>
          {totals.VALIDATED} validated · {totals.EXECUTED} executed · {totals.BLOCKED} blocked
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', color: 'var(--pv-fg-3)' }}>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && (
        <div id="validation-trend-body" style={{ padding: '0 12px 10px' }}>
          <svg
            role="img"
            aria-label={`Validation status transitions per day over the last ${points.length} days`}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            style={{ display: 'block', overflow: 'visible' }}
          >
            {points.map((p, i) => {
              const x = padX + i * bw
              let yCursor = padY + innerH
              const stacks: Array<{ status: Status; y: number; height: number }> = []
              for (const s of STATUSES) {
                const v = p[s]
                if (v === 0) continue
                const h = (v / yMax) * innerH
                yCursor -= h
                stacks.push({ status: s, y: yCursor, height: h })
              }
              const totalForDay = STATUSES.reduce((acc, s) => acc + p[s], 0)
              return (
                <g key={p.date}>
                  <title>
                    {p.date} - {totalForDay} transition{totalForDay === 1 ? '' : 's'}
                    {STATUSES.filter((s) => p[s] > 0).map((s) => `\n${STATUS_LABEL[s]}: ${p[s]}`).join('')}
                  </title>
                  <rect
                    x={x}
                    y={padY}
                    width={Math.max(0, bw - gap)}
                    height={innerH}
                    fill="transparent"
                  />
                  {stacks.map((seg) => (
                    <rect
                      key={seg.status}
                      x={x}
                      y={seg.y}
                      width={Math.max(0, bw - gap)}
                      height={Math.max(0, seg.height)}
                      fill={STATUS_COLOR[seg.status]}
                      opacity={0.92}
                    />
                  ))}
                </g>
              )
            })}
          </svg>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 4,
              fontSize: 10.5,
              color: 'var(--pv-fg-3)',
            }}
          >
            {STATUSES.filter((s) => totals[s] > 0).map((s) => (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    background: STATUS_COLOR[s],
                    borderRadius: 2,
                    display: 'inline-block',
                  }}
                />
                {STATUS_LABEL[s]} {totals[s]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
