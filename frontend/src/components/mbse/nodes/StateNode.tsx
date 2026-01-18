import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import clsx from 'clsx'

interface StateAction {
  trigger: 'entry' | 'exit' | 'do'
  action: string
}

interface StateNodeData {
  id: string
  name: string
  type?: 'initial' | 'final' | 'state' | 'composite' | 'choice' | 'fork' | 'join'
  description?: string
  actions?: StateAction[]
  isActive?: boolean
  isSelected?: boolean
}

/**
 * StateNode renders a UML/SysML state for State Machine diagrams.
 * Supports initial, final, regular, composite, and pseudo-states.
 */
function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  // Initial state (filled circle)
  if (data.type === 'initial') {
    return (
      <div
        className={clsx(
          'w-8 h-8 bg-gray-900 rounded-full transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
      >
        <Handle
          type="source"
          position={Position.Right}
          className="w-2 h-2 bg-gray-900 border-2 border-white"
        />
      </div>
    )
  }

  // Final state (bullseye)
  if (data.type === 'final') {
    return (
      <div
        className={clsx(
          'w-10 h-10 rounded-full border-2 border-gray-900 flex items-center justify-center bg-white transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
      >
        <div className="w-6 h-6 bg-gray-900 rounded-full" />
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-2 bg-gray-900 border-2 border-white"
        />
      </div>
    )
  }

  // Choice pseudo-state (diamond)
  if (data.type === 'choice') {
    return (
      <div
        className={clsx(
          'w-10 h-10 bg-amber-100 border-2 border-amber-500 transform rotate-45 transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-4'
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="w-2 h-2 bg-amber-500 border-2 border-white -translate-x-1/2 -translate-y-1/2"
          style={{ left: '50%', top: '0%' }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="w-2 h-2 bg-amber-500 border-2 border-white translate-x-1/2 translate-y-1/2"
          style={{ left: '50%', bottom: '0%' }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          className="w-2 h-2 bg-amber-500 border-2 border-white -translate-x-1/2 translate-y-1/2"
          style={{ left: '0%', top: '50%' }}
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="w-2 h-2 bg-amber-500 border-2 border-white translate-x-1/2 -translate-y-1/2"
          style={{ right: '0%', top: '50%' }}
        />
      </div>
    )
  }

  // Fork/Join (horizontal bar)
  if (data.type === 'fork' || data.type === 'join') {
    return (
      <div
        className={clsx(
          'w-32 h-2 bg-gray-900 rounded transition-shadow',
          selected && 'ring-2 ring-blue-500 ring-offset-2'
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="w-2 h-2 bg-gray-900 border-2 border-white"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-2 h-2 bg-gray-900 border-2 border-white"
        />
      </div>
    )
  }

  // Regular state (rounded rectangle)
  const isComposite = data.type === 'composite'

  return (
    <div
      className={clsx(
        'min-w-[140px] bg-white rounded-lg shadow-md transition-shadow',
        data.isActive && 'ring-2 ring-green-500',
        selected && 'ring-2 ring-blue-500 ring-offset-2',
        isComposite && 'border-2 border-dashed border-gray-400'
      )}
      style={{ border: isComposite ? undefined : '2px solid #f59e0b' }}
    >
      {/* State Name Header */}
      <div
        className={clsx(
          'px-3 py-2 text-center font-semibold text-sm rounded-t-md',
          isComposite ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'
        )}
      >
        {data.name}
      </div>

      {/* Description or Actions */}
      {(data.description || (data.actions && data.actions.length > 0)) && (
        <div className="px-3 py-2 text-xs border-t border-gray-200">
          {data.description && (
            <div className="text-gray-600 mb-1 italic">{data.description}</div>
          )}
          {data.actions?.map((action, index) => (
            <div key={index} className="text-gray-700 font-mono">
              <span className="text-amber-600">{action.trigger}/</span> {action.action}
            </div>
          ))}
        </div>
      )}

      {/* Composite State Indicator */}
      {isComposite && (
        <div className="px-3 py-2 text-center text-xs text-gray-400 border-t border-dashed border-gray-300">
          [composite]
        </div>
      )}

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(StateNode)
