import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import clsx from 'clsx'

interface UseCaseNodeData {
  id: string
  name: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  complexity?: 'simple' | 'moderate' | 'complex'
  status?: string
  isSelected?: boolean
}

/**
 * UseCaseNode renders a UML/SysML use case ellipse for Use Case diagrams.
 * Displays use case name, priority, and optional status.
 */
function UseCaseNode({ data, selected }: NodeProps<UseCaseNodeData>) {
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
        return '#06b6d4'
    }
  }

  const getComplexityBadge = (complexity?: string) => {
    switch (complexity) {
      case 'complex':
        return '●●●'
      case 'moderate':
        return '●●○'
      case 'simple':
        return '●○○'
      default:
        return null
    }
  }

  const borderColor = getPriorityColor(data.priority)

  return (
    <div
      className={clsx(
        'relative transition-shadow',
        selected && 'ring-2 ring-blue-500 ring-offset-4 rounded-full'
      )}
    >
      {/* Ellipse Shape */}
      <div
        className="px-6 py-4 bg-cyan-50 rounded-full text-center min-w-[160px] max-w-[220px]"
        style={{ border: `2px solid ${borderColor}` }}
      >
        {/* Use Case Name */}
        <div className="font-medium text-sm text-gray-900 leading-tight">
          {data.name}
        </div>

        {/* Description (truncated) */}
        {data.description && (
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
            {data.description}
          </div>
        )}

        {/* Status and Complexity */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {data.status && (
            <span className="text-xs px-1.5 py-0.5 bg-white rounded border border-gray-200 text-gray-600">
              {data.status}
            </span>
          )}
          {data.complexity && (
            <span className="text-xs text-gray-400" title={`Complexity: ${data.complexity}`}>
              {getComplexityBadge(data.complexity)}
            </span>
          )}
        </div>
      </div>

      {/* Priority Indicator */}
      {data.priority && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
          style={{ backgroundColor: borderColor }}
          title={`Priority: ${data.priority}`}
        />
      )}

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-cyan-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="w-2 h-2 bg-cyan-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="w-2 h-2 bg-cyan-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-2 h-2 bg-cyan-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(UseCaseNode)
