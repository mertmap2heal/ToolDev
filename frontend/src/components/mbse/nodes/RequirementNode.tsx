import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { FileText, AlertCircle, CheckCircle } from 'lucide-react'
import clsx from 'clsx'

interface RequirementNodeData {
  id: string
  requirementId?: string
  title: string
  description?: string
  status?: string
  priority?: string
  requirementType?: string
  verificationStatus?: string
  isSelected?: boolean
  onSelect?: (id: string) => void
}

/**
 * RequirementNode renders a SysML-style requirement block for ReactFlow diagrams.
 * Displays requirement ID, title, type, status, and verification status.
 */
function RequirementNode({ data, selected }: NodeProps<RequirementNodeData>) {
  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'functional':
        return { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' }
      case 'performance':
        return { bg: '#f3e8ff', border: '#a855f7', text: '#7c3aed' }
      case 'interface':
        return { bg: '#cffafe', border: '#06b6d4', text: '#0891b2' }
      case 'design_constraint':
        return { bg: '#fed7aa', border: '#f97316', text: '#c2410c' }
      case 'safety':
        return { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' }
      case 'security':
        return { bg: '#fce7f3', border: '#ec4899', text: '#db2777' }
      case 'usability':
        return { bg: '#dcfce7', border: '#22c55e', text: '#16a34a' }
      default:
        return { bg: '#f3f4f6', border: '#6b7280', text: '#4b5563' }
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical':
        return '#ef4444'
      case 'high':
        return '#f97316'
      case 'medium':
        return '#f59e0b'
      case 'low':
        return '#22c55e'
      default:
        return '#6b7280'
    }
  }

  const getVerificationIcon = (status?: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={12} className="text-green-500" />
      case 'failed':
        return <AlertCircle size={12} className="text-red-500" />
      default:
        return null
    }
  }

  const colors = getTypeColor(data.requirementType)

  return (
    <div
      className={clsx(
        'min-w-[220px] rounded-lg shadow-md transition-shadow',
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      style={{
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
      }}
    >
      {/* SysML Stereotype Header */}
      <div
        className="px-3 py-1.5 rounded-t-md text-xs font-semibold text-center"
        style={{ backgroundColor: colors.border, color: 'white' }}
      >
        «requirement»
      </div>

      {/* Content */}
      <div className="p-3">
        {/* ID and Type */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs" style={{ color: colors.text }}>
            {data.requirementId || data.id.substring(0, 8)}
          </span>
          {data.requirementType && (
            <span
              className="px-1.5 py-0.5 text-xs rounded"
              style={{ backgroundColor: colors.border + '20', color: colors.text }}
            >
              {data.requirementType.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="font-medium text-sm text-gray-900 mb-2 line-clamp-2">
          {data.title}
        </div>

        {/* Description (truncated) */}
        {data.description && (
          <div className="text-xs text-gray-600 mb-2 line-clamp-2 italic">
            {data.description}
          </div>
        )}

        {/* Status Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            {data.status && (
              <span className="text-xs text-gray-600">{data.status}</span>
            )}
            {data.priority && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getPriorityColor(data.priority) }}
                title={`Priority: ${data.priority}`}
              />
            )}
          </div>
          {getVerificationIcon(data.verificationStatus)}
        </div>
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(RequirementNode)
