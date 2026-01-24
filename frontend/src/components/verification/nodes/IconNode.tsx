import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { renderIconSvg, IconDefinition } from '../IconLibrary'

export interface IconNodeData {
  icon: IconDefinition
  size?: number
  label?: string
  showLabel?: boolean
}

function IconNode({ data, selected }: NodeProps<IconNodeData>) {
  const { icon, size = 32, label, showLabel = true } = data

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div
        className={`flex flex-col items-center p-2 rounded-lg bg-white border-2 shadow-sm transition-colors ${
          selected ? 'border-blue-500' : 'border-gray-300'
        }`}
        style={{ minWidth: size + 16 }}
      >
        <div className="text-gray-700">{renderIconSvg(icon, size)}</div>
        {showLabel && (label || icon.name) && (
          <span className="text-xs text-gray-700 mt-1 text-center max-w-[80px] truncate">
            {label || icon.name}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </>
  )
}

export default memo(IconNode)
