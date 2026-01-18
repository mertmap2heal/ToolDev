import { useMemo, useRef } from 'react'
import DiagramExporter from '../shared/DiagramExporter'

interface InternalBlockDiagramProps {
  projectId: string
}

/**
 * InternalBlockDiagram implements a SysML Internal Block Diagram (ibd)
 * showing internal structure with ports and item flows.
 */
export default function InternalBlockDiagram({ projectId }: InternalBlockDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Internal Block Diagram (ibd)
          </span>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="ibd-diagram" />
      </div>

      {/* Diagram Canvas */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-8" ref={diagramRef}>
        <div className="max-w-4xl mx-auto">
          {/* System Boundary */}
          <div className="border-2 border-purple-500 rounded-lg p-6 bg-white dark:bg-gray-800">
            <div className="text-sm font-semibold text-purple-600 mb-4">
              «block» Engineering System
            </div>

            {/* Internal Parts */}
            <div className="grid grid-cols-3 gap-6">
              {/* Requirements Manager */}
              <div className="border-2 border-blue-400 rounded p-4 bg-blue-50 dark:bg-blue-900/20 relative">
                <div className="text-xs font-semibold text-blue-600 mb-2">reqManager: RequirementsManager</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div>- requirements: List</div>
                  <div>- validateReq()</div>
                </div>
                {/* Port */}
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-sm" title="reqOut: Requirement" />
              </div>

              {/* Function Allocator */}
              <div className="border-2 border-green-400 rounded p-4 bg-green-50 dark:bg-green-900/20 relative">
                <div className="text-xs font-semibold text-green-600 mb-2">allocator: FunctionAllocator</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div>- functions: List</div>
                  <div>- allocate()</div>
                </div>
                {/* Ports */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 border-2 border-white rounded-sm" title="reqIn: Requirement" />
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-500 border-2 border-white rounded-sm" title="funcOut: Function" />
              </div>

              {/* Verification Engine */}
              <div className="border-2 border-amber-400 rounded p-4 bg-amber-50 dark:bg-amber-900/20 relative">
                <div className="text-xs font-semibold text-amber-600 mb-2">verifier: VerificationEngine</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div>- testCases: List</div>
                  <div>- verify()</div>
                </div>
                {/* Port */}
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-amber-500 border-2 border-white rounded-sm" title="funcIn: Function" />
              </div>
            </div>

            {/* Connectors */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ position: 'absolute', top: 0, left: 0 }}>
              {/* This would contain connector lines in a real implementation */}
            </svg>

            {/* Item Flows Description */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Item Flows:</div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                  Requirement
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                  Function
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                  Verification
                </span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Legend</div>
            <div className="flex gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-6 h-4 border-2 border-purple-500 rounded"></div>
                System Boundary
              </span>
              <span className="flex items-center gap-1">
                <div className="w-6 h-4 border-2 border-blue-400 bg-blue-50 rounded"></div>
                Part
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-gray-500 rounded-sm"></div>
                Port
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            Internal Block Diagram shows the internal structure of a block with its parts, ports, and connectors.
          </div>
        </div>
      </div>
    </div>
  )
}
