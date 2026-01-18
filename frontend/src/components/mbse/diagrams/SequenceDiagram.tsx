import { useMemo, useRef } from 'react'
import DiagramExporter from '../shared/DiagramExporter'
import DiagramLegend from '../shared/DiagramLegend'

interface SequenceDiagramProps {
  projectId: string
}

/**
 * SequenceDiagram implements a SysML/UML Sequence Diagram
 * showing interactions between lifelines over time.
 * Note: This is a simplified CSS-based implementation.
 * A full implementation would use a specialized library.
 */
export default function SequenceDiagram({ projectId }: SequenceDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null)

  // Demo sequence - Requirement Verification Flow
  const lifelines = ['Engineer', 'System', 'Verification Tool', 'Database']
  
  const messages = useMemo(() => [
    { from: 0, to: 1, label: '1: submitRequirement()', type: 'sync' },
    { from: 1, to: 2, label: '2: validateRequirement()', type: 'sync' },
    { from: 2, to: 1, label: '3: validationResult', type: 'return' },
    { from: 1, to: 3, label: '4: saveRequirement()', type: 'sync' },
    { from: 3, to: 1, label: '5: confirmation', type: 'return' },
    { from: 1, to: 2, label: '6: runVerification()', type: 'async' },
    { from: 2, to: 3, label: '7: logResults()', type: 'sync' },
    { from: 3, to: 2, label: '8: ack', type: 'return' },
    { from: 2, to: 0, label: '9: verificationComplete', type: 'return' },
  ], [])

  const legendItems = [
    { label: 'Lifeline', color: '#3b82f6', shape: 'rectangle' as const },
    { label: 'Synchronous Message', color: '#3b82f6', lineStyle: 'solid' as const },
    { label: 'Asynchronous Message', color: '#22c55e', lineStyle: 'dashed' as const },
    { label: 'Return Message', color: '#6b7280', lineStyle: 'dotted' as const },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            Sequence Diagram - Requirement Verification Flow
          </span>
        </div>
        <DiagramExporter targetRef={diagramRef} filename="sequence-diagram" />
      </div>

      {/* Diagram Canvas */}
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-8" ref={diagramRef}>
        <div className="min-w-[800px]">
          {/* Lifelines Header */}
          <div className="flex justify-around mb-4">
            {lifelines.map((lifeline, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="px-4 py-2 bg-blue-100 border-2 border-blue-500 rounded text-sm font-medium text-blue-800">
                  {lifeline}
                </div>
              </div>
            ))}
          </div>

          {/* Lifeline Bars and Messages */}
          <div className="relative" style={{ minHeight: messages.length * 60 + 100 }}>
            {/* Lifeline vertical bars */}
            {lifelines.map((_, index) => (
              <div
                key={index}
                className="absolute w-0.5 bg-blue-300"
                style={{
                  left: `${(index + 0.5) * (100 / lifelines.length)}%`,
                  top: 0,
                  height: messages.length * 60 + 80,
                }}
              />
            ))}

            {/* Messages */}
            {messages.map((msg, index) => {
              const fromX = (msg.from + 0.5) * (100 / lifelines.length)
              const toX = (msg.to + 0.5) * (100 / lifelines.length)
              const y = index * 60 + 30
              const isLeftToRight = msg.to > msg.from
              const width = Math.abs(toX - fromX)
              const left = Math.min(fromX, toX)

              const getMessageColor = () => {
                switch (msg.type) {
                  case 'sync': return '#3b82f6'
                  case 'async': return '#22c55e'
                  case 'return': return '#6b7280'
                  default: return '#3b82f6'
                }
              }

              const getLineStyle = () => {
                switch (msg.type) {
                  case 'async': return '5,5'
                  case 'return': return '2,2'
                  default: return undefined
                }
              }

              return (
                <div key={index} className="absolute" style={{ top: y, left: `${left}%`, width: `${width}%` }}>
                  {/* Message line */}
                  <svg width="100%" height="20" className="overflow-visible">
                    <defs>
                      <marker
                        id={`arrow-${index}`}
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                        markerUnits="strokeWidth"
                      >
                        <path d={msg.type === 'return' ? 'M0,0 L0,6 L9,3 z' : 'M0,0 L0,6 L9,3 z'} fill={getMessageColor()} />
                      </marker>
                    </defs>
                    <line
                      x1={isLeftToRight ? '0' : '100%'}
                      y1="10"
                      x2={isLeftToRight ? '100%' : '0'}
                      y2="10"
                      stroke={getMessageColor()}
                      strokeWidth="2"
                      strokeDasharray={getLineStyle()}
                      markerEnd={`url(#arrow-${index})`}
                    />
                  </svg>
                  {/* Message label */}
                  <div
                    className="absolute text-xs font-mono whitespace-nowrap bg-white dark:bg-gray-800 px-1 rounded"
                    style={{
                      top: -14,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      color: getMessageColor(),
                    }}
                  >
                    {msg.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-6 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <div className="w-6 h-0.5 bg-blue-500"></div>
            Synchronous
          </span>
          <span className="flex items-center gap-1">
            <div className="w-6 h-0.5 border-t-2 border-dashed border-green-500"></div>
            Asynchronous
          </span>
          <span className="flex items-center gap-1">
            <div className="w-6 h-0.5 border-t-2 border-dotted border-gray-500"></div>
            Return
          </span>
        </div>
      </div>
    </div>
  )
}
