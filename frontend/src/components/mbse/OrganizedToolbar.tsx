import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Map,
  Shield,
  Zap,
  BarChart3,
  Table,
  Link,
  Download,
  FileText,
  Code,
  Image,
  Edit3,
  LayoutGrid,
  Sidebar,
  PanelRight,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { useMBSEStore } from '../../store/mbseStore'
import clsx from 'clsx'

interface OrganizedToolbarProps {
  onValidation: () => void
  onImpactAnalysis: () => void
  onVerificationCoverage: () => void
  onTraceabilityMatrix: () => void
  onDiagramEditor: () => void
  onExporter: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
  onToggleGrid?: () => void
  onToggleMinimap?: () => void
  onRefresh?: () => void
  className?: string
}

interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'left' | 'right'
}

/**
 * DropdownMenu provides a collapsible menu container
 */
function DropdownMenu({ trigger, children, align = 'left' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
          isOpen
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        )}
      >
        {trigger}
        <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          className={clsx(
            'absolute top-full mt-1 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[180px]',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
}

/**
 * MenuItem represents a single action item within a dropdown
 */
function MenuItem({ icon, label, shortcut, onClick, disabled }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
        disabled
          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{shortcut}</span>
      )}
    </button>
  )
}

/**
 * MenuDivider creates a visual separator between menu items
 */
function MenuDivider() {
  return <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
}

/**
 * OrganizedToolbar provides grouped dropdown menus for MBSE tools
 * organized into View, Analysis, Traceability, and Export categories
 */
export default function OrganizedToolbar({
  onValidation,
  onImpactAnalysis,
  onVerificationCoverage,
  onTraceabilityMatrix,
  onDiagramEditor,
  onExporter,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleGrid,
  onToggleMinimap,
  onRefresh,
  className,
}: OrganizedToolbarProps) {
  const { 
    panelVisibility, 
    toggleModelBrowser, 
    togglePropertiesPanel 
  } = useMBSEStore()

  return (
    <div className={clsx(
      'overflow-x-auto bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700',
      className
    )}>
    <div className="flex items-center gap-1 px-4 py-2 min-w-max">
      {/* View Menu */}
      <DropdownMenu
        trigger={
          <>
            <Eye size={14} />
            <span>View</span>
          </>
        }
      >
        <MenuItem
          icon={<Sidebar size={14} />}
          label="Model Browser"
          onClick={toggleModelBrowser}
          shortcut={panelVisibility.modelBrowser ? '✓' : ''}
        />
        <MenuItem
          icon={<PanelRight size={14} />}
          label="Properties Panel"
          onClick={togglePropertiesPanel}
          shortcut={panelVisibility.propertiesPanel ? '✓' : ''}
        />
        <MenuDivider />
        <MenuItem
          icon={<ZoomIn size={14} />}
          label="Zoom In"
          onClick={() => onZoomIn?.()}
          shortcut="Ctrl++"
        />
        <MenuItem
          icon={<ZoomOut size={14} />}
          label="Zoom Out"
          onClick={() => onZoomOut?.()}
          shortcut="Ctrl+-"
        />
        <MenuItem
          icon={<Maximize2 size={14} />}
          label="Fit to View"
          onClick={() => onFitView?.()}
          shortcut="Ctrl+0"
        />
        <MenuDivider />
        <MenuItem
          icon={<Grid size={14} />}
          label="Toggle Grid"
          onClick={() => onToggleGrid?.()}
        />
        <MenuItem
          icon={<Map size={14} />}
          label="Toggle Minimap"
          onClick={() => onToggleMinimap?.()}
        />
        <MenuDivider />
        <MenuItem
          icon={<RefreshCw size={14} />}
          label="Refresh"
          onClick={() => onRefresh?.()}
          shortcut="F5"
        />
      </DropdownMenu>

      {/* Analysis Menu */}
      <DropdownMenu
        trigger={
          <>
            <BarChart3 size={14} />
            <span>Analysis</span>
          </>
        }
      >
        <MenuItem
          icon={<Shield size={14} className="text-blue-500" />}
          label="Model Validation"
          onClick={onValidation}
        />
        <MenuItem
          icon={<Zap size={14} className="text-amber-500" />}
          label="Impact Analysis"
          onClick={onImpactAnalysis}
        />
        <MenuItem
          icon={<BarChart3 size={14} className="text-green-500" />}
          label="Verification Coverage"
          onClick={onVerificationCoverage}
        />
      </DropdownMenu>

      {/* Traceability Menu */}
      <DropdownMenu
        trigger={
          <>
            <Link size={14} />
            <span>Traceability</span>
          </>
        }
      >
        <MenuItem
          icon={<Table size={14} className="text-purple-500" />}
          label="Traceability Matrix"
          onClick={onTraceabilityMatrix}
        />
        <MenuDivider />
        <MenuItem
          icon={<Link size={14} />}
          label="Manage Links"
          onClick={() => {}}
          disabled
        />
      </DropdownMenu>

      {/* Edit Menu */}
      <DropdownMenu
        trigger={
          <>
            <Edit3 size={14} />
            <span>Edit</span>
          </>
        }
      >
        <MenuItem
          icon={<Edit3 size={14} className="text-indigo-500" />}
          label="Diagram Editor"
          onClick={onDiagramEditor}
        />
        <MenuDivider />
        <MenuItem
          icon={<LayoutGrid size={14} />}
          label="Auto Layout"
          onClick={() => {}}
          disabled
        />
      </DropdownMenu>

      {/* Export Menu */}
      <DropdownMenu
        trigger={
          <>
            <Download size={14} />
            <span>Export</span>
          </>
        }
        align="right"
      >
        <MenuItem
          icon={<FileText size={14} className="text-cyan-500" />}
          label="Export ReqIF"
          onClick={onExporter}
        />
        <MenuItem
          icon={<Code size={14} className="text-orange-500" />}
          label="Export XMI"
          onClick={onExporter}
        />
        <MenuDivider />
        <MenuItem
          icon={<Image size={14} />}
          label="Export as PNG"
          onClick={onExporter}
        />
        <MenuItem
          icon={<FileText size={14} />}
          label="Export as PDF"
          onClick={onExporter}
        />
      </DropdownMenu>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick action buttons */}
      <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-3">
        <button
          onClick={onValidation}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Model Validation"
        >
          <Shield size={16} className="text-blue-500" />
        </button>
        <button
          onClick={onImpactAnalysis}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Impact Analysis"
        >
          <Zap size={16} className="text-amber-500" />
        </button>
        <button
          onClick={onTraceabilityMatrix}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Traceability Matrix"
        >
          <Table size={16} className="text-purple-500" />
        </button>
        <button
          onClick={onExporter}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Export"
        >
          <Download size={16} className="text-cyan-500" />
        </button>
      </div>
    </div>
    </div>
  )
}
