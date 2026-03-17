import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export interface FreehandNodeData {
  path: string // SVG path d attribute
  strokeColor?: string
  strokeWidth?: number
  width?: number
  height?: number
}

function FreehandNode({ data, selected }: NodeProps<FreehandNodeData>) {
  const {
    path,
    strokeColor = '#6b7280',
    strokeWidth = 2,
    width = 100,
    height = 100,
  } = data

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div
        className={`bg-transparent rounded border transition-colors ${
          selected ? 'border-blue-500 border-dashed' : 'border-transparent'
        }`}
        style={{ width, height }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <path
            d={path}
            fill="none"
            stroke={selected ? '#3b82f6' : strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </>
  )
}

export default memo(FreehandNode)
