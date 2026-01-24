import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export interface PolygonNodeData {
  points?: string // SVG polygon points format
  sides?: number
  size?: number
  fillColor?: string
  borderColor?: string
  borderWidth?: number
  label?: string
}

// Generate regular polygon points
function generatePolygonPoints(sides: number, size: number): string {
  const points: string[] = []
  const angleOffset = -Math.PI / 2 // Start from top

  for (let i = 0; i < sides; i++) {
    const angle = angleOffset + (2 * Math.PI * i) / sides
    const x = size / 2 + (size / 2) * Math.cos(angle)
    const y = size / 2 + (size / 2) * Math.sin(angle)
    points.push(`${x},${y}`)
  }

  return points.join(' ')
}

function PolygonNode({ data, selected }: NodeProps<PolygonNodeData>) {
  const {
    points,
    sides = 6,
    size = 80,
    fillColor = '#e5e7eb',
    borderColor = '#6b7280',
    borderWidth = 2,
    label,
  } = data

  const polygonPoints = points || generatePolygonPoints(sides, size)

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <polygon
            points={polygonPoints}
            fill={fillColor}
            stroke={selected ? '#3b82f6' : borderColor}
            strokeWidth={borderWidth}
          />
        </svg>
        {label && (
          <span className="absolute text-xs text-gray-700 dark:text-gray-300 text-center px-1">
            {label}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </>
  )
}

export default memo(PolygonNode)
