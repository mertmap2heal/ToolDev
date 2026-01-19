import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  Box, 
  Layers, 
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Sidebar,
  PanelRight,
} from 'lucide-react'
import { useMBSEStore, useActiveTab } from '../../store/mbseStore'
import { DiagramType, DIAGRAM_INFO } from '../../components/mbse/MBSEDiagramMenu'
import ModelBrowser from '../../components/mbse/ModelBrowser'
import DiagramTabs from '../../components/mbse/DiagramTabs'
import PropertiesPanel from '../../components/mbse/PropertiesPanel'
import OrganizedToolbar from '../../components/mbse/OrganizedToolbar'
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
} from '../../components/mbse/diagrams'
import { ModelValidationEngine } from '../../components/mbse/validation'
import { ImpactAnalysisView, VerificationCoverageDashboard, EnhancedTraceabilityMatrix } from '../../components/mbse/analysis'
import { StandardExporter } from '../../components/mbse/export'
import { DiagramEditor } from '../../components/mbse/editing'
import clsx from 'clsx'

/**
 * MBSEModelsPage provides a comprehensive MBSE modeling environment
 * with a three-panel layout: Model Browser, Tabbed Diagram Workspace, and Properties Panel.
 * Follows industry-standard MBSE tool patterns (Cameo, Rhapsody, Enterprise Architect).
 */
export default function MBSEModelsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  
  // Get store state and actions
  const { 
    panelVisibility, 
    panelWidths,
    openTab,
    toggleModelBrowser,
    togglePropertiesPanel,
  } = useMBSEStore()
  
  const activeTab = useActiveTab()
  
  // Modal states for industrial compliance tools
  const [showValidation, setShowValidation] = useState(false)
  const [showImpactAnalysis, setShowImpactAnalysis] = useState(false)
  const [showVerificationCoverage, setShowVerificationCoverage] = useState(false)
  const [showExporter, setShowExporter] = useState(false)
  const [showDiagramEditor, setShowDiagramEditor] = useState(false)
  const [showTraceabilityMatrix, setShowTraceabilityMatrix] = useState(false)

  // Resizable panel states
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(panelWidths.modelBrowser)
  const [rightPanelWidth, setRightPanelWidth] = useState(panelWidths.propertiesPanel)

  // Handle opening a diagram from the Model Browser
  const handleOpenDiagram = useCallback((diagramType: DiagramType, diagramId: string, name: string) => {
    openTab({
      id: diagramId,
      type: diagramType,
      name: name,
    })
  }, [openTab])

  // Handle opening tools from the Model Browser
  const handleOpenTool = useCallback((toolId: string) => {
    switch (toolId) {
      case 'verification-coverage':
        setShowVerificationCoverage(true)
        break
      case 'verification-matrix':
        setShowVerificationCoverage(true)
        break
      case 'model-validation':
        setShowValidation(true)
        break
      case 'traceability-matrix':
        setShowTraceabilityMatrix(true)
        break
      case 'impact-analysis':
        setShowImpactAnalysis(true)
        break
      case 'suspect-links':
        setShowTraceabilityMatrix(true) // Uses traceability matrix with suspect filter
        break
      case 'coverage-reports':
        setShowVerificationCoverage(true)
        break
      default:
        console.warn('Unknown tool:', toolId)
    }
  }, [])

  // Get the active diagram info
  const activeDiagramInfo = useMemo(() => {
    if (!activeTab) return null
    return DIAGRAM_INFO.find((d) => d.type === activeTab.type) || null
  }, [activeTab])

  // Render the selected diagram component based on active tab
  const renderDiagram = () => {
    if (!projectId || !activeTab) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900">
          <Box size={64} className="mb-4 opacity-30" />
          <p className="text-lg">No diagram open</p>
          <p className="text-sm mt-2">Double-click a diagram in the Model Browser to open it</p>
          <p className="text-xs mt-1 text-gray-400">or use the + button in the tabs bar</p>
        </div>
      )
    }

    switch (activeTab.type) {
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
          <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-100 dark:bg-gray-900">
            <p className="text-lg">Diagram type not implemented yet</p>
          </div>
        )
    }
  }

  // Handle panel resize
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isResizingLeft) {
      const newWidth = Math.max(200, Math.min(400, e.clientX))
      setLeftPanelWidth(newWidth)
    }
    if (isResizingRight) {
      const newWidth = Math.max(250, Math.min(450, window.innerWidth - e.clientX))
      setRightPanelWidth(newWidth)
    }
  }, [isResizingLeft, isResizingRight])

  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false)
    setIsResizingRight(false)
  }, [])

  return (
    <div 
      className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Page Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}/requirements`)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Back to Project"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
          <div className="flex items-center gap-2">
            <Layers className="text-blue-500" size={22} />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              MBSE Models
            </h1>
          </div>
        </div>
        
        {/* Current diagram indicator */}
        {activeDiagramInfo && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-900/50 rounded-md">
            <div
              className="p-1.5 rounded"
              style={{ backgroundColor: activeDiagramInfo.color + '20' }}
            >
              {(() => {
                const Icon = activeDiagramInfo.icon
                return <Icon size={16} style={{ color: activeDiagramInfo.color }} />
              })()}
            </div>
            <div className="hidden md:block">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {activeTab?.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {activeDiagramInfo.name}
              </div>
            </div>
          </div>
        )}

        {/* Panel toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleModelBrowser}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              panelVisibility.modelBrowser
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
            title={panelVisibility.modelBrowser ? 'Hide Model Browser' : 'Show Model Browser'}
          >
            <Sidebar size={18} />
          </button>
          <button
            onClick={togglePropertiesPanel}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              panelVisibility.propertiesPanel
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
            title={panelVisibility.propertiesPanel ? 'Hide Properties' : 'Show Properties'}
          >
            <PanelRight size={18} />
          </button>
        </div>
      </div>

      {/* Organized Toolbar */}
      <OrganizedToolbar
        onValidation={() => setShowValidation(true)}
        onImpactAnalysis={() => setShowImpactAnalysis(true)}
        onVerificationCoverage={() => setShowVerificationCoverage(true)}
        onTraceabilityMatrix={() => setShowTraceabilityMatrix(true)}
        onDiagramEditor={() => setShowDiagramEditor(true)}
        onExporter={() => setShowExporter(true)}
      />

      {/* Main Content - Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Model Browser */}
        {panelVisibility.modelBrowser && (
          <>
            <div
              className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
              style={{ width: leftPanelWidth }}
            >
              {projectId && (
                <ModelBrowser
                  projectId={projectId}
                  onOpenDiagram={handleOpenDiagram}
                  onOpenTool={handleOpenTool}
                  className="h-full"
                />
              )}
            </div>
            
            {/* Left resize handle */}
            <div
              className="w-1 cursor-col-resize bg-transparent hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors"
              onMouseDown={() => setIsResizingLeft(true)}
            />
          </>
        )}

        {/* Left panel collapse button (when collapsed) */}
        {!panelVisibility.modelBrowser && (
          <button
            onClick={toggleModelBrowser}
            className="flex-shrink-0 w-6 flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 transition-colors"
            title="Show Model Browser"
          >
            <ChevronRight size={16} className="text-gray-500" />
          </button>
        )}

        {/* Center Panel - Diagram Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Diagram Tabs */}
          <DiagramTabs
            onNewDiagram={() => {
              // Open the first diagram type as default
              if (DIAGRAM_INFO.length > 0) {
                const firstDiagram = DIAGRAM_INFO[0]
                handleOpenDiagram(firstDiagram.type, `diagram-${firstDiagram.type}`, firstDiagram.name)
              }
            }}
          />

          {/* Diagram Canvas */}
          <div className="flex-1 overflow-hidden">
            {renderDiagram()}
          </div>
        </div>

        {/* Right panel collapse button (when collapsed) */}
        {!panelVisibility.propertiesPanel && (
          <button
            onClick={togglePropertiesPanel}
            className="flex-shrink-0 w-6 flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border-l border-gray-200 dark:border-gray-700 transition-colors"
            title="Show Properties Panel"
          >
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
        )}

        {/* Right Panel - Properties Panel */}
        {panelVisibility.propertiesPanel && (
          <>
            {/* Right resize handle */}
            <div
              className="w-1 cursor-col-resize bg-transparent hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors"
              onMouseDown={() => setIsResizingRight(true)}
            />
            
            <div
              className="flex-shrink-0 border-l border-gray-200 dark:border-gray-700 overflow-hidden"
              style={{ width: rightPanelWidth }}
            >
              {projectId && (
                <PropertiesPanel
                  projectId={projectId}
                  className="h-full"
                />
              )}
            </div>
          </>
        )}
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
