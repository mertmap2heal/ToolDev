import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

interface FtaNodeData {
  label: string
  description?: string
}

function FtaBasicNode({ data, selected }: NodeProps<FtaNodeData>) {
  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 min-w-[120px] bg-gray-50 dark:bg-gray-800 border-gray-400 ${
        selected ? 'ring-2 ring-gray-400' : ''
      }`}
    >
      <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">BASIC EVENT</div>
      <div className="text-sm font-medium text-gray-900 dark:text-white">{data.label}</div>
      {data.description && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate max-w-[180px]" title={data.description}>
          {data.description}
        </div>
      )}
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-500 border-2 border-white" />
    </div>
  )
}

export default memo(FtaBasicNode)
