import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export interface ImageNodeData {
  imageUrl: string
  width?: number
  height?: number
  label?: string
  showLabel?: boolean
}

function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const { imageUrl, width = 120, height = 80, label, showLabel = true } = data

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div
        className={`flex flex-col items-center p-1 rounded-lg bg-white dark:bg-gray-800 border-2 transition-colors ${
          selected ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <img
          src={imageUrl}
          alt={label || 'Image'}
          style={{ width, height, objectFit: 'contain' }}
          className="rounded"
        />
        {showLabel && label && (
          <span className="text-xs text-gray-600 dark:text-gray-400 mt-1 text-center max-w-[120px] truncate">
            {label}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} className="!bg-gray-400" />
    </>
  )
}

export default memo(ImageNode)
