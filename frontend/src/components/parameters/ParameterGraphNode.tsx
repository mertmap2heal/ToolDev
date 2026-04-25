import React from 'react'
import { Handle, Position } from 'reactflow'
import type { NodeProps } from 'reactflow'
import type { Parameter, ParameterStatus } from 'shared/types/engineering.types'

interface ParameterNodeData {
  param: Parameter
  selected?: boolean
  highlighted?: boolean
  dimmed?: boolean
}

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  approved: { dot: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: '#15803d' },
  draft: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: '#b45309' },
  review: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.1)', text: '#1d4ed8' },
  obsolete: { dot: '#9ca3af', bg: 'rgba(156,163,175,0.1)', text: '#6b7280' },
}

function getStatusColors(status: ParameterStatus | string | undefined) {
  return STATUS_COLORS[status ?? 'draft'] ?? STATUS_COLORS.draft
}

const ParameterGraphNode: React.FC<NodeProps<ParameterNodeData>> = ({ data, selected }) => {
  const { param, highlighted, dimmed } = data
  const status = param.status ?? 'draft'
  const colors = getStatusColors(status)

  const borderColor = selected || highlighted
    ? '#6366f1'
    : 'var(--theme-border, #e5e7eb)'

  const opacity = dimmed ? 0.35 : 1

  return (
    <div
      style={{
        width: 160,
        opacity,
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        backgroundColor: 'var(--theme-surface, #fff)',
        boxShadow: selected || highlighted
          ? '0 0 0 3px rgba(99,102,241,0.18)'
          : '0 1px 4px rgba(0,0,0,0.08)',
        padding: '8px 10px',
        cursor: 'default',
        transition: 'opacity 0.15s, box-shadow 0.15s, border-color 0.15s',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 8, height: 8, background: '#6366f1', border: '2px solid #fff' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 8, height: 8, background: '#6366f1', border: '2px solid #fff' }}
      />

      {/* Parameter name */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--theme-text, #111827)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          marginBottom: 5,
        }}
        title={param.name}
      >
        {param.name}
      </div>

      {/* Badges row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {/* Data type badge */}
        {param.dataType && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 4,
              backgroundColor: 'rgba(99,102,241,0.1)',
              color: '#4f46e5',
              letterSpacing: '0.03em',
            }}
          >
            {param.dataType}
          </span>
        )}

        {/* Unit badge */}
        {param.unit && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: '1px 5px',
              borderRadius: 4,
              backgroundColor: 'rgba(14,165,233,0.1)',
              color: '#0369a1',
              letterSpacing: '0.03em',
            }}
          >
            {param.unit}
          </span>
        )}
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: colors.dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: colors.text,
            textTransform: 'capitalize',
          }}
        >
          {status}
        </span>
      </div>
    </div>
  )
}

export default ParameterGraphNode
