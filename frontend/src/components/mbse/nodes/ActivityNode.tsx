import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import clsx from 'clsx'

interface ActivityNodeData {
  id: string
  name: string
  type?: 'action' | 'decision' | 'merge' | 'fork' | 'join' | 'initial' | 'final' | 'flow-final'
  description?: string
  swimlane?: string
  isSelected?: boolean
}

/**
 * ActivityNode renders UML/SysML activity diagram elements.
 * Supports action, decision, merge, fork, join, and control nodes.
 */
function ActivityNode({ data, selected }: NodeProps<ActivityNodeData>) {
  // Initial node (filled circle)
  if (data.type === 'initial') {
    return (
      <div
        className={clsx(
          'w-8 h-8 bg-green-600 rounded-full transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
      >
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-2 h-2 bg-green-600 border-2 border-white"
        />
      </div>
    )
  }

  // Final node (bullseye)
  if (data.type === 'final') {
    return (
      <div
        className={clsx(
          'w-10 h-10 rounded-full border-2 border-green-600 flex items-center justify-center bg-white transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
      >
        <div className="w-6 h-6 bg-green-600 rounded-full" />
        <Handle
          type="target"
          position={Position.Top}
          className="w-2 h-2 bg-green-600 border-2 border-white"
        />
      </div>
    )
  }

  // Flow final (circle with X)
  if (data.type === 'flow-final') {
    return (
      <div
        className={clsx(
          'w-8 h-8 rounded-full border-2 border-green-600 flex items-center justify-center bg-white transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
      >
        <span className="text-green-600 font-bold text-lg">×</span>
        <Handle
          type="target"
          position={Position.Top}
          className="w-2 h-2 bg-green-600 border-2 border-white"
        />
      </div>
    )
  }

  // Decision/Merge node (diamond)
  if (data.type === 'decision' || data.type === 'merge') {
    return (
      <div
        className={clsx(
          'relative transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-4'
        )}
      >
        <div className="w-12 h-12 bg-green-100 border-2 border-green-500 transform rotate-45">
          <div className="absolute inset-0 flex items-center justify-center transform -rotate-45">
            <span className="text-green-700 text-xs font-medium">
              {data.type === 'decision' ? '?' : '◊'}
            </span>
          </div>
        </div>
        <Handle
          type="target"
          position={Position.Top}
          className="w-2 h-2 bg-green-500 border-2 border-white"
          style={{ top: '-4px', left: '50%', transform: 'translateX(-50%)' }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="w-2 h-2 bg-green-500 border-2 border-white"
          style={{ bottom: '-4px', left: '50%', transform: 'translateX(-50%)' }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className="w-2 h-2 bg-green-500 border-2 border-white"
          style={{ left: '-4px', top: '50%', transform: 'translateY(-50%)' }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="w-2 h-2 bg-green-500 border-2 border-white"
          style={{ right: '-4px', top: '50%', transform: 'translateY(-50%)' }}
        />
      </div>
    )
  }

  // Fork/Join (horizontal bar)
  if (data.type === 'fork' || data.type === 'join') {
    return (
      <div
        className={clsx(
          'w-32 h-2 bg-green-600 rounded transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="w-2 h-2 bg-green-600 border-2 border-white"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-2 h-2 bg-green-600 border-2 border-white"
        />
      </div>
    )
  }

  // Action node (rounded rectangle)
  return (
    <div
      className={clsx(
        'min-w-[140px] bg-green-50 rounded-xl border-2 border-green-500 shadow-md transition-shadow',
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
    >
      {/* Swimlane indicator */}
      {data.swimlane && (
        <div className="px-3 py-1 bg-green-100 rounded-t-lg text-xs text-green-700 font-medium border-b border-green-200">
          {data.swimlane}
        </div>
      )}

      {/* Action content */}
      <div className="px-4 py-3 text-center">
        <div className="font-medium text-sm text-gray-900">{data.name}</div>
        {data.description && (
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{data.description}</div>
        )}
      </div>

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(ActivityNode)
