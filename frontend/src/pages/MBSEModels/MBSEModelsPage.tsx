import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  ChevronLeft,
  ChevronRight,
  Info,
  Shield,
  Zap,
  BarChart3,
  Download,
  Edit3,
  Table,
  ArrowLeft,
} from 'lucide-react'
import MBSEDiagramMenu, { DiagramType, DIAGRAM_INFO } from '../../components/mbse/MBSEDiagramMenu'
import {
  RequirementsDiagram,
  UseCaseDiagram,
  BlockDefinitionDiagram,
  InternalBlockDiagram,
  ParametricDiagram,
  ActivityDiagram,
  SequenceDiagram,
  StateMachineDiagram,
  PackageDiagram,
} from '../../components/mbse/diagrams'
import { ModelValidationEngine } from '../../components/mbse/validation'
import { ImpactAnalysisView, VerificationCoverageDashboard, EnhancedTraceabilityMatrix } from '../../components/mbse/analysis'
import { StandardExporter } from '../../components/mbse/export'
import { DiagramEditor } from '../../components/mbse/editing'
import clsx from 'clsx'

/**
 * MBSEModelsPage provides a comprehensive MBSE modeling environment
 * with a menu of SysML/UML diagram types and a diagram canvas.
 */
export default function MBSEModelsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [selectedDiagram, setSelectedDiagram] = useState<DiagramType | null>('req')
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  // Modal states for industrial compliance tools
  const [showValidation, setShowValidation] = useState(false)
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false)
  const [showVerificationCoverage, setShowVerificationCoverage] = useState(false)
  const [showExporter, setShowExporter] = useState(false)
  const [showDiagramEditor, setShowDiagramEditor] = useState(false)
  const [showTraceabilityMatrix, setShowTraceabilityMatrix] = useState(false)

  // Get selected diagram info
  const selectedDiagramInfo = selectedDiagram 
    ? DIAGRAM_INFO.find((d) => d.type === selectedDiagram)
    : null

  // Render the selected diagram component
  const renderDiagram = () => {
    if (!projectId || !selectedDiagram) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <Box size={64} className="mb-4 opacity-30" />
          <p className="text-lg">Select a diagram type from the menu</p>
          <p className="text-sm mt-2">Choose from SysML or UML diagram types to get started</p>
        </div>
      )
    }

    switch (selectedDiagram) {
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
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg">Diagram type not implemented yet</p>
          </div>
        )
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/projects/${projectId}/requirements`)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Back to Project"
          >
            <ArrowLeft size={18} />
            Back to Project
          </button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Layers className="text-blue-500" size={28} />
              MBSE Models
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Model-Based Systems Engineering diagrams and visualizations
            </p>
          </div>
        </div>
        {selectedDiagramInfo && (
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div
              className="p-2 rounded"
              style={{ backgroundColor: selectedDiagramInfo.color + '20' }}
            >
              {(() => {
                const Icon = selectedDiagramInfo.icon
                return <Icon size={20} style={{ color: selectedDiagramInfo.color }} />
              })()}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedDiagramInfo.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                [{selectedDiagramInfo.type}]
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Industrial Compliance Tools Toolbar */}
      <div className="flex items-center gap-2 px-6 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-2">
          Analysis Tools:
        </span>
        <button
          onClick={() => setShowValidation(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Model Validation - Check for orphans, missing links, constraint violations"
        >
          <Shield size={14} className="text-blue-500" />
          Validation
        </button>
        <button
          onClick={() => setShowImpactAnalysis(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Impact Analysis - Show downstream effects of changes"
        >
          <Zap size={14} className="text-amber-500" />
          Impact Analysis
        </button>
        <button
          onClick={() => setShowVerificationCoverage(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Verification Coverage - Requirement to test matrix"
        >
          <BarChart3 size={14} className="text-green-500" />
          Verification
        </button>
        <button
          onClick={() => setShowTraceabilityMatrix(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Enhanced Traceability Matrix - Bidirectional trace with verification status"
        >
          <Table size={14} className="text-purple-500" />
          Traceability
        </button>
        <div className="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
        <button
          onClick={() => setShowDiagramEditor(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Diagram Editor - Create and modify elements on canvas"
        >
          <Edit3 size={14} className="text-indigo-500" />
          Editor
        </button>
        <button
          onClick={() => setShowExporter(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Export - ReqIF, XMI, SysML interchange formats"
        >
          <Download size={14} className="text-cyan-500" />
          Export
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Diagram Menu */}
        <div
          className={clsx(
            'flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 overflow-hidden',
            isSidebarCollapsed ? 'w-0' : 'w-80'
          )}
        >
          <div className="h-full overflow-y-auto p-4">
            <MBSEDiagramMenu
              selectedDiagram={selectedDiagram}
              onSelectDiagram={setSelectedDiagram}
            />

            {/* Info Panel */}
            {selectedDiagramInfo && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Info size={14} />
                  About this diagram
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {selectedDiagramInfo.description}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">SysML Type:</span>{' '}
                    <span className="font-mono">{selectedDiagramInfo.type}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="flex-shrink-0 w-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border-r border-gray-200 dark:border-gray-700 transition-colors"
          title={isSidebarCollapsed ? 'Show menu' : 'Hide menu'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight size={16} className="text-gray-500" />
          ) : (
            <ChevronLeft size={16} className="text-gray-500" />
          )}
        </button>

        {/* Diagram Canvas */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          {renderDiagram()}
        </div>
      </div>

      {/* Industrial Compliance Modals */}
      {showValidation && projectId && (
        <ModelValidationEngine
          projectId={projectId}
          onClose={() => setShowValidation(false)}
        />
      )}

      {showImpactAnalysis && projectId && (
        <ImpactAnalysisView
          projectId={projectId}
          onClose={() => setShowImpactAnalysis(false)}
        />
      )}

      {showVerificationCoverage && projectId && (
        <VerificationCoverageDashboard
          projectId={projectId}
          onClose={() => setShowVerificationCoverage(false)}
        />
      )}

      {showTraceabilityMatrix && projectId && (
        <EnhancedTraceabilityMatrix
          projectId={projectId}
          onClose={() => setShowTraceabilityMatrix(false)}
        />
      )}

      {showDiagramEditor && projectId && (
        <DiagramEditor
          projectId={projectId}
          onClose={() => setShowDiagramEditor(false)}
        />
      )}

      {showExporter && projectId && (
        <StandardExporter
          projectId={projectId}
          onClose={() => setShowExporter(false)}
        />
      )}
    </div>
  )
}
