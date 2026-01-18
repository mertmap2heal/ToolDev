import { useState } from 'react'
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Grid3X3, 
  Eye, 
  EyeOff,
  Undo,
  Redo,
  Lock,
  Unlock,
  Layers
} from 'lucide-react'
import { useReactFlow } from 'reactflow'

interface DiagramToolbarProps {
  onFitView?: () => void
  showGrid?: boolean
  onToggleGrid?: () => void
  showMinimap?: boolean
  onToggleMinimap?: () => void
  isLocked?: boolean
  onToggleLock?: () => void
}

/**
 * DiagramToolbar provides common toolbar controls for all MBSE diagrams
 * including zoom, pan, grid toggle, and minimap controls.
 */
export default function DiagramToolbar({
  onFitView,
  showGrid = true,
  onToggleGrid,
  showMinimap = true,
  onToggleMinimap,
  isLocked = false,
  onToggleLock,
}: DiagramToolbarProps) {
  const { zoomIn, zoomOut, fitView, getZoom } = useReactFlow()
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = () => {
    zoomIn()
    setZoom(getZoom())
  }

  const handleZoomOut = () => {
    zoomOut()
    setZoom(getZoom())
  }

  const handleFitView = () => {
    fitView({ padding: 0.2 })
    setZoom(getZoom())
    onFitView?.()
  }

  return (
    <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1">
      {/* Zoom Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-200 dark:border-gray-700">
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleFitView}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
          title="Fit to View"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* View Controls */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-200 dark:border-gray-700">
        {onToggleGrid && (
          <button
            onClick={onToggleGrid}
            className={`p-1.5 rounded ${showGrid ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title={showGrid ? 'Hide Grid' : 'Show Grid'}
          >
            <Grid3X3 size={16} />
          </button>
        )}
        {onToggleMinimap && (
          <button
            onClick={onToggleMinimap}
            className={`p-1.5 rounded ${showMinimap ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title={showMinimap ? 'Hide Minimap' : 'Show Minimap'}
          >
            <Layers size={16} />
          </button>
        )}
      </div>

      {/* Lock Control */}
      {onToggleLock && (
        <div className="flex items-center gap-1 pl-2">
          <button
            onClick={onToggleLock}
            className={`p-1.5 rounded ${isLocked ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
            title={isLocked ? 'Unlock Diagram' : 'Lock Diagram'}
          >
            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </div>
      )}
    </div>
  )
}
