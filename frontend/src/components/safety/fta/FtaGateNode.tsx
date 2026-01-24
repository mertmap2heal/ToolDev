import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

interface FtaGateNodeData {
  label: string
  gateType: 'and' | 'or'
}

function FtaGateNode({ data, selected }: NodeProps<FtaGateNodeData>) {
  const isAnd = data.gateType === 'and'
  return (
    <div
      className={`flex items-center justify-center w-14 h-14 rounded-full border-2 ${
        isAnd
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
          : 'bg-green-50 dark:bg-green-900/20 border-green-500'
      } ${selected ? 'ring-2 ring-offset-2 ring-blue-400' : ''}`}
      title={data.label || (isAnd ? 'AND' : 'OR')}
    >
      <span className="text-lg font-bold text-gray-900 dark:text-white">
        {isAnd ? '&' : '≥1'}
      </span>
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-gray-600 border-2 border-white" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-gray-600 border-2 border-white" />
    </div>
  )
}

export default memo(FtaGateNode)
