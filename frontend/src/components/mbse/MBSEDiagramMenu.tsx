import { useState } from 'react'
import {
  FileText,
  Box,
  Layers,
  Activity,
  GitBranch,
  Circle,
  Users,
  Package,
  Calculator,
  ChevronRight,
  ChevronDown,
  Link2,
} from 'lucide-react'
import clsx from 'clsx'

/**
 * SysML/UML Diagram type definitions
 */
export type DiagramType =
  | 'req'      // Requirements Diagram
  | 'bdd'      // Block Definition Diagram
  | 'ibd'      // Internal Block Diagram
  | 'par'      // Parametric Diagram
  | 'par-req'  // Parameter-Requirement Diagram
  | 'act'      // Activity Diagram
  | 'seq'      // Sequence Diagram
  | 'stm'      // State Machine Diagram
  | 'uc'       // Use Case Diagram
  | 'pkg'      // Package Diagram

/**
 * Diagram category groupings following SysML taxonomy
 */
type DiagramCategory = 'requirements' | 'structure' | 'behavior' | 'parametric'

interface DiagramInfo {
  type: DiagramType
  name: string
  description: string
  category: DiagramCategory
  icon: React.ElementType
  color: string
}

/**
 * Complete diagram type information organized by SysML taxonomy
 */
const DIAGRAM_INFO: DiagramInfo[] = [
  // Requirements Diagrams
  {
    type: 'req',
    name: 'Requirements Diagram',
    description: 'Visualize requirements and their relationships',
    category: 'requirements',
    icon: FileText,
    color: '#3b82f6',
  },
  // Structure Diagrams
  {
    type: 'bdd',
    name: 'Block Definition Diagram',
    description: 'Define system blocks and their relationships',
    category: 'structure',
    icon: Box,
    color: '#14b8a6',
  },
  {
    type: 'ibd',
    name: 'Internal Block Diagram',
    description: 'Show internal structure with ports and flows',
    category: 'structure',
    icon: Layers,
    color: '#a855f7',
  },
  {
    type: 'pkg',
    name: 'Package Diagram',
    description: 'Organize model elements into packages',
    category: 'structure',
    icon: Package,
    color: '#6b7280',
  },
  // Behavior Diagrams
  {
    type: 'act',
    name: 'Activity Diagram',
    description: 'Model workflows and business processes',
    category: 'behavior',
    icon: Activity,
    color: '#22c55e',
  },
  {
    type: 'seq',
    name: 'Sequence Diagram',
    description: 'Show interactions over time',
    category: 'behavior',
    icon: GitBranch,
    color: '#06b6d4',
  },
  {
    type: 'stm',
    name: 'State Machine Diagram',
    description: 'Model state transitions and behavior',
    category: 'behavior',
    icon: Circle,
    color: '#f59e0b',
  },
  {
    type: 'uc',
    name: 'Use Case Diagram',
    description: 'Define system actors and use cases',
    category: 'behavior',
    icon: Users,
    color: '#ec4899',
  },
  // Parametric Diagrams
  {
    type: 'par',
    name: 'Parametric Diagram',
    description: 'Show constraint parameters and equations',
    category: 'parametric',
    icon: Calculator,
    color: '#8b5cf6',
  },
  {
    type: 'par-req',
    name: 'Parameter-Requirement Matrix',
    description: 'Visualize relationships between parameters and requirements',
    category: 'parametric',
    icon: Link2,
    color: '#0ea5e9',
  },
]

interface MBSEDiagramMenuProps {
  selectedDiagram: DiagramType | null
  onSelectDiagram: (type: DiagramType) => void
  className?: string
}

/**
 * MBSEDiagramMenu provides a categorized menu for selecting SysML/UML diagram types.
 * Diagrams are grouped into SysML, Behavior, and Structure categories.
 */
export default function MBSEDiagramMenu({
  selectedDiagram,
  onSelectDiagram,
  className,
}: MBSEDiagramMenuProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<DiagramCategory>>(
    new Set(['requirements', 'structure', 'behavior', 'parametric'])
  )

  const toggleCategory = (category: DiagramCategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const getCategoryLabel = (category: DiagramCategory): string => {
    switch (category) {
      case 'requirements':
        return 'Requirements'
      case 'structure':
        return 'Structure'
      case 'behavior':
        return 'Behavior'
      case 'parametric':
        return 'Parametric'
    }
  }

  const getCategoryIcon = (category: DiagramCategory): React.ReactNode => {
    switch (category) {
      case 'requirements':
        return <FileText size={16} className="text-blue-500" />
      case 'structure':
        return <Box size={16} className="text-teal-500" />
      case 'behavior':
        return <Activity size={16} className="text-green-500" />
      case 'parametric':
        return <Calculator size={16} className="text-purple-500" />
    }
  }

  const categories: DiagramCategory[] = ['requirements', 'structure', 'behavior', 'parametric']

  return (
    <div className={clsx('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden', className)}>
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">MBSE Diagram Types</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select a diagram type to create or view
        </p>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {categories.map((category) => {
          const categoryDiagrams = DIAGRAM_INFO.filter((d) => d.category === category)
          const isExpanded = expandedCategories.has(category)

          return (
            <div key={category}>
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {getCategoryLabel(category)}
                  </span>
                  <span className="text-xs text-gray-400">({categoryDiagrams.length})</span>
                </div>
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="bg-gray-50 dark:bg-gray-900/30">
                  {categoryDiagrams.map((diagram) => {
                    const Icon = diagram.icon
                    const isSelected = selectedDiagram === diagram.type

                    return (
                      <button
                        key={diagram.type}
                        onClick={() => onSelectDiagram(diagram.type)}
                        className={clsx(
                          'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-l-2 border-transparent'
                        )}
                      >
                        <div
                          className="p-1.5 rounded"
                          style={{ backgroundColor: diagram.color + '20' }}
                        >
                          <Icon size={18} style={{ color: diagram.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                'text-sm font-medium',
                                isSelected
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-gray-900 dark:text-white'
                              )}
                            >
                              {diagram.name}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              [{diagram.type}]
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                            {diagram.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Export diagram info for use in other components
 */
export { DIAGRAM_INFO }
export type { DiagramInfo }
