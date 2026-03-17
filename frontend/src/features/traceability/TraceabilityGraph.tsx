import { useState } from 'react'
import { Network } from 'lucide-react'
import type { TraceabilityGraph as TraceabilityGraphType } from 'shared/types/traceability.types'

interface TraceabilityGraphProps {
  projectId: string
  graph?: TraceabilityGraphType
}

export default function TraceabilityGraph({
  projectId,
  graph,
}: TraceabilityGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <Network className="mx-auto text-gray-400 mb-4" size={48} />
        <p className="text-gray-600">No traceability links found</p>
        <p className="text-sm text-gray-500 mt-2">
          Create requirements and link them to functions to see the traceability graph
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Traceability Graph</h3>
      <div className="space-y-2">
        {graph.nodes.map((node) => (
          <div
            key={node.id}
            className={`
              p-3 rounded-lg border-2 cursor-pointer transition-colors
              ${
                selectedNode === node.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }
            `}
            onClick={() => setSelectedNode(node.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  {node.type}
                </span>
                <p className="font-medium text-gray-900 mt-1">{node.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {graph.edges.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            {graph.edges.length} traceability link{graph.edges.length !== 1 ? 's' : ''} found
          </p>
        </div>
      )}
    </div>
  )
}
