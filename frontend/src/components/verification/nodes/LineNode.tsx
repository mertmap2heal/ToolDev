import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export interface LineNodeData {
  length?: number
  strokeColor?: string
  strokeWidth?: number
  rotation?: number // degrees
}

function LineNode({ data, selected }: NodeProps<LineNodeData>) {
  const { length = 100, strokeColor = '#6b7280', strokeWidth = 2, rotation = 0 } = data

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div
        className="flex items-center justify-center"
        style={{
          width: length,
          height: strokeWidth + 10,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <svg width={length} height={strokeWidth + 10} viewBox={`0 0 ${length} ${strokeWidth + 10}`}>
          <line
            x1="0"
            y1={(strokeWidth + 10) / 2}
            x2={length}
            y2={(strokeWidth + 10) / 2}
            stroke={selected ? '#3b82f6' : strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </>
  )
}

export default memo(LineNode)
