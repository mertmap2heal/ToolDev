import { useState } from 'react'
import { X, FileText, Box, Layers, Activity, GitBranch, Circle, Users, Package, Calculator, Link2 } from 'lucide-react'
import { DIAGRAM_INFO, type DiagramType } from '../mbse/MBSEDiagramMenu'
import RequirementDiagram from './RequirementDiagram'
import {
  RequirementsDiagram,
  UseCaseDiagram,
  BlockDefinitionDiagram,
  InternalBlockDiagram,
  ParametricDiagram,
  ParameterRequirementDiagram,
  ActivityDiagram,
  SequenceDiagram,
  StateMachineDiagram,
  PackageDiagram,
} from '../mbse/diagrams'
import clsx from 'clsx'
import type { Requirement } from 'shared/types/engineering.types'
import type { TraceLink } from 'shared/types/traceability.types'

type TabId = 'relationship' | DiagramType

const getTabIcon = (id: TabId) => {
  if (id === 'relationship') return <GitBranch size={14} className="text-indigo-500" />
  switch (id) {
    case 'req': return <FileText size={14} className="text-blue-500" />
    case 'bdd': return <Box size={14} className="text-teal-500" />
    case 'ibd': return <Layers size={14} className="text-purple-500" />
    case 'par': return <Calculator size={14} className="text-violet-500" />
    case 'par-req': return <Link2 size={14} className="text-sky-500" />
    case 'act': return <Activity size={14} className="text-green-500" />
    case 'seq': return <GitBranch size={14} className="text-cyan-500" />
    case 'stm': return <Circle size={14} className="text-amber-500" />
    case 'uc': return <Users size={14} className="text-pink-500" />
    case 'pkg': return <Package size={14} className="text-gray-500" />
    default: return <FileText size={14} />
  }
}

const getTabName = (id: TabId) => {
  if (id === 'relationship') return 'Requirement Relationship'
  const info = DIAGRAM_INFO.find((d) => d.type === id)
  return info?.name ?? id
}

interface RequirementDiagramsModalProps {
  projectId: string
  requirements: Requirement[]
  traceLinks: TraceLink[]
  onClose: () => void
}

export default function RequirementDiagramsModal({
  projectId,
  requirements,
  traceLinks,
  onClose,
}: RequirementDiagramsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('relationship')

  const allTabs: TabId[] = ['relationship', ...DIAGRAM_INFO.map((d) => d.type)]

  const renderDiagram = () => {
    if (activeTab === 'relationship') {
      return (
        <RequirementDiagram
          requirements={requirements}
          traceLinks={traceLinks}
          projectId={projectId}
          onClose={onClose}
          embedded
        />
      )
    }

    switch (activeTab) {
      case 'req':
        return <RequirementsDiagram projectId={projectId} />
      case 'uc':
        return <UseCaseDiagram projectId={projectId} />
      case 'bdd':
        return <BlockDefinitionDiagram projectId={projectId} />
      case 'ibd':
        return <InternalBlockDiagram projectId={projectId} />
      case 'par':
        return <ParametricDiagram projectId={projectId} />
      case 'par-req':
        return <ParameterRequirementDiagram projectId={projectId} />
      case 'act':
        return <ActivityDiagram projectId={projectId} />
      case 'seq':
        return <SequenceDiagram projectId={projectId} />
      case 'stm':
        return <StateMachineDiagram projectId={projectId} />
      case 'pkg':
        return <PackageDiagram projectId={projectId} />
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900">
            <FileText size={48} className="mb-4 opacity-30" />
            <p className="text-lg">Select a diagram type</p>
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[98vw] h-[95vh] flex flex-col">
        {/* Header: tabs + close */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 shrink-0">
          <div className="flex overflow-x-auto min-w-0 flex-1">
            {allTabs.map((tabId) => (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 shrink-0 border-b-2 transition-colors',
                  activeTab === tabId
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                )}
              >
                {getTabIcon(tabId)}
                <span className="text-sm font-medium whitespace-nowrap">{getTabName(tabId)}</span>
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-2 shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Diagram content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderDiagram()}
        </div>
      </div>
    </div>
  )
}
