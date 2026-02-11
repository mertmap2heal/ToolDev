import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export interface LegendItem {
  label: string
  color: string
  shape?: 'rectangle' | 'circle' | 'diamond' | 'ellipse' | 'hexagon'
  lineStyle?: 'solid' | 'dashed' | 'dotted'
}

interface DiagramLegendProps {
  title?: string
  items: LegendItem[]
  collapsible?: boolean
  defaultExpanded?: boolean
}

/**
 * DiagramLegend displays a legend for diagram elements
 * showing shapes, colors, and their meanings.
 */
export default function DiagramLegend({
  title = 'Legend',
  items,
  collapsible = false,
  defaultExpanded = true,
}: DiagramLegendProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const getShapeStyle = (item: LegendItem): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      width: '16px',
      height: '16px',
      backgroundColor: item.color + '20',
      border: `2px solid ${item.color}`,
    }

    switch (item.shape) {
      case 'circle':
        return { ...baseStyle, borderRadius: '50%' }
      case 'diamond':
        return { ...baseStyle, transform: 'rotate(45deg)', width: '12px', height: '12px' }
      case 'ellipse':
        return { ...baseStyle, borderRadius: '50%', width: '20px', height: '14px' }
      case 'hexagon':
        return { ...baseStyle, borderRadius: '4px' }
      default:
        return { ...baseStyle, borderRadius: '4px' }
    }
  }

  const getLineStyle = (item: LegendItem): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      width: '24px',
      height: '0',
      borderTop: `2px ${item.lineStyle || 'solid'} ${item.color}`,
    }
    return baseStyle
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {collapsible ? (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{title}</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      ) : (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{title}</span>
        </div>
      )}

      {isExpanded && (
        <div className="p-3 space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              {item.lineStyle ? (
                <div style={getLineStyle(item)} />
              ) : (
                <div style={getShapeStyle(item)} />
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
