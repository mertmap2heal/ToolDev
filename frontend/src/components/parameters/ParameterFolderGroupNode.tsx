import { memo } from 'react'
import { FolderOpen } from 'lucide-react'
import type { NodeProps } from 'reactflow'

interface FolderGroupData {
  name: string
  count: number
  color?: string
  depth: number
}

/**
 * ReactFlow group node representing a parameter folder (plan Phase 3).
 * Children set parentId={this.id} + extent='parent' so they are dragged
 * with the group and kept inside its bounds.
 *
 * Width + height are set on the node-level `style` from buildParameterGraph
 * so ReactFlow treats it as a group container.
 */
function ParameterFolderGroupNodeImpl({ data, selected }: NodeProps<FolderGroupData>) {
  const dotColor = data.color ?? '#6366f1'
  return (
    <div
      className={`h-full w-full rounded-xl border-2 border-dashed transition-colors ${
        selected
          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/40'
      }`}
    >
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-dashed border-gray-300 dark:border-gray-600 bg-white/60 dark:bg-gray-900/60 rounded-t-xl">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
        <FolderOpen size={12} className="text-gray-500 dark:text-gray-400" />
        <span
          className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate"
          title={data.name}
        >
          {data.name}
        </span>
        <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-400">
          {data.count}
        </span>
      </div>
    </div>
  )
}

export default memo(ParameterFolderGroupNodeImpl)
