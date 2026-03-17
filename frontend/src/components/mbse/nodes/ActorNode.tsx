import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { User } from 'lucide-react'
import clsx from 'clsx'

interface ActorNodeData {
  id: string
  name: string
  type?: 'primary' | 'secondary' | 'system'
  description?: string
  isSelected?: boolean
}

/**
 * ActorNode renders a UML/SysML actor stick figure for Use Case diagrams.
 * Displays actor name, type indicator, and optional description.
 */
function ActorNode({ data, selected }: NodeProps<ActorNodeData>) {
  const getActorColor = (type?: string) => {
    switch (type) {
      case 'primary':
        return '#3b82f6'
      case 'secondary':
        return '#8b5cf6'
      case 'system':
        return '#6b7280'
      default:
        return '#3b82f6'
    }
  }

  const color = getActorColor(data.type)

  return (
    <div
      className={clsx(
        'flex flex-col items-center p-2 min-w-[100px] transition-shadow',
        selected && 'ring-2 ring-blue-500 ring-offset-2 rounded-lg'
      )}
    >
      {/* Stick Figure */}
      <div className="relative mb-2">
        <svg width="40" height="60" viewBox="0 0 40 60">
          {/* Head */}
          <circle
            cx="20"
            cy="10"
            r="8"
            fill="white"
            stroke={color}
            strokeWidth="2"
          />
          {/* Body */}
          <line
            x1="20"
            y1="18"
            x2="20"
            y2="38"
            stroke={color}
            strokeWidth="2"
          />
          {/* Arms */}
          <line
            x1="5"
            y1="28"
            x2="35"
            y2="28"
            stroke={color}
            strokeWidth="2"
          />
          {/* Left Leg */}
          <line
            x1="20"
            y1="38"
            x2="8"
            y2="55"
            stroke={color}
            strokeWidth="2"
          />
          {/* Right Leg */}
          <line
            x1="20"
            y1="38"
            x2="32"
            y2="55"
            stroke={color}
            strokeWidth="2"
          />
        </svg>

        {/* Actor Type Badge */}
        {data.type && data.type !== 'primary' && (
          <span
            className="absolute -top-1 -right-3 px-1 py-0.5 text-xs rounded text-white"
            style={{ backgroundColor: color }}
          >
            {data.type === 'system' ? 'S' : '2'}
          </span>
        )}
      </div>

      {/* Actor Name */}
      <div className="text-center">
        <div className="font-medium text-sm text-gray-900" style={{ color }}>
          {data.name}
        </div>
        {data.description && (
          <div className="text-xs text-gray-500 mt-1 max-w-[120px] line-clamp-2">
            {data.description}
          </div>
        )}
      </div>

      {/* Connection Handles */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-2 h-2 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-2 h-2 bg-blue-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(ActorNode)
