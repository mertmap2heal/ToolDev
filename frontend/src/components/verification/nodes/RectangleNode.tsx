import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export interface RectangleNodeData {
  width?: number
  height?: number
  fillColor?: string
  borderColor?: string
  borderWidth?: number
  label?: string
}

function RectangleNode({ data, selected }: NodeProps<RectangleNodeData>) {
  const {
    width = 120,
    height = 80,
    fillColor = '#e5e7eb',
    borderColor = '#6b7280',
    borderWidth = 2,
    label,
  } = data

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div
        style={{
          width,
          height,
          backgroundColor: fillColor,
          borderColor: selected ? '#3b82f6' : borderColor,
          borderWidth,
          borderStyle: 'solid',
          borderRadius: 4,
        }}
        className="flex items-center justify-center transition-colors"
      >
        {label && (
          <span className="text-xs text-gray-700 dark:text-gray-300 text-center px-1">{label}</span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </>
  )
}

export default memo(RectangleNode)
