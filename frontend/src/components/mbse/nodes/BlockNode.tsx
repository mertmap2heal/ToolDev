import { memo, useCallback } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import clsx from 'clsx'

interface BlockProperty {
  name: string
  type?: string
  value?: string
}

interface BlockOperation {
  name: string
  parameters?: string
  returnType?: string
}

interface BlockNodeData {
  id: string
  name: string
  stereotype?: string
  description?: string
  properties?: BlockProperty[]
  operations?: BlockOperation[]
  ports?: Array<{ name: string; direction: 'in' | 'out' | 'inout' }>
  isSelected?: boolean
  color?: string
  onContextMenu?: (e: React.MouseEvent, data: BlockNodeData) => void
}

/**
 * BlockNode renders a SysML Block Definition Diagram block.
 * Displays name, stereotype, properties, operations, and ports.
 */
function BlockNode({ data, selected }: NodeProps<BlockNodeData>) {
  const blockColor = data.color || '#14b8a6'

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (data.onContextMenu) {
      data.onContextMenu(e, data)
    }
  }, [data])

  return (
    <div
      className={clsx(
        'min-w-[200px] bg-white rounded shadow-md transition-shadow cursor-pointer',
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
      style={{ border: `2px solid ${blockColor}` }}
      onContextMenu={handleContextMenu}
    >
      {/* Stereotype Header */}
      <div
        className="px-3 py-1.5 text-xs font-semibold text-center text-white"
        style={{ backgroundColor: blockColor }}
      >
        «{data.stereotype || 'block'}»
      </div>

      {/* Block Name */}
      <div className="px-3 py-2 text-center border-b border-gray-200">
        <span className="font-bold text-sm text-gray-900">{data.name}</span>
        {data.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{data.description}</p>
        )}
      </div>

      {/* Properties Compartment */}
      {data.properties && data.properties.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="text-xs text-gray-500 font-semibold mb-1">properties</div>
          {data.properties.map((prop, index) => (
            <div key={index} className="text-xs text-gray-700 font-mono">
              {prop.name}
              {prop.type && <span className="text-gray-500">: {prop.type}</span>}
              {prop.value && <span className="text-blue-600"> = {prop.value}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Operations Compartment */}
      {data.operations && data.operations.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="text-xs text-gray-500 font-semibold mb-1">operations</div>
          {data.operations.map((op, index) => (
            <div key={index} className="text-xs text-gray-700 font-mono">
              {op.name}({op.parameters || ''})
              {op.returnType && <span className="text-gray-500">: {op.returnType}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Ports */}
      {data.ports && data.ports.length > 0 && (
        <div className="px-3 py-2">
          <div className="text-xs text-gray-500 font-semibold mb-1">ports</div>
          <div className="flex flex-wrap gap-1">
            {data.ports.map((port, index) => (
              <span
                key={index}
                className={clsx(
                  'px-1.5 py-0.5 text-xs rounded border',
                  port.direction === 'in' && 'bg-green-50 border-green-300 text-green-700',
                  port.direction === 'out' && 'bg-blue-50 border-blue-300 text-blue-700',
                  port.direction === 'inout' && 'bg-purple-50 border-purple-300 text-purple-700'
                )}
              >
                {port.direction === 'in' ? '→' : port.direction === 'out' ? '←' : '↔'} {port.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 bg-teal-500 border-2 border-white"
      />
    </div>
  )
}

export default memo(BlockNode)
