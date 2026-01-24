import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

interface FtaNodeData {
  label: string
  description?: string
}

function FtaTopNode({ data, selected }: NodeProps<FtaNodeData>) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 min-w-[140px] bg-amber-50 dark:bg-amber-900/20 border-amber-500 ${
        selected ? 'ring-2 ring-amber-400' : ''
      }`}
    >
      <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 mb-1">TOP EVENT</div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{data.label}</div>
      {data.description && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{data.description}</div>
      )}
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-amber-500 border-2 border-white" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-amber-500 border-2 border-white" />
    </div>
  )
}

export default memo(FtaTopNode)
