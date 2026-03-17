import { useState } from 'react'
import {
  X,
  Save,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react'
import type { Component, Interface } from './ComponentFormSection'
import { useDrawIO, getDrawIOUrl, prepareXml, EMPTY_DIAGRAM } from './useDrawIO'

interface TestSetupEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { diagramData: any }) => void
  formData: {
    name: string
    components: Component[]
    interfaces: Interface[]
  }
  initialDiagramData?: any
}

export default function TestSetupEditor({
  isOpen,
  onClose,
  onSave,
  formData,
  initialDiagramData,
}: TestSetupEditorProps) {
  const [loadError, setLoadError] = useState<string | null>(null)

  // Prepare initial XML from data
  const initialXml = prepareXml(initialDiagramData)

  // Use custom draw.io hook
  const {
    iframeRef,
    isReady,
    currentXml,
    error: drawioError,
  } = useDrawIO({
    initialXml,
    onSave: (xml) => {
      console.log('[TestSetupEditor] Draw.io save event received')
    },
    onAutoSave: (xml) => {
      console.log('[TestSetupEditor] Draw.io autosave event received')
    },
  })

  // Main save handler - saves diagram
  const handleSave = () => {
    // Store raw XML string
    const diagramData = {
      xml: currentXml || EMPTY_DIAGRAM,
      format: 'drawio',
    }
    console.log('[TestSetupEditor] Saving diagram, XML length:', diagramData.xml.length)
    onSave({ diagramData })
  }

  // Get the error to display (either from hook or local check)
  const displayError = loadError || drawioError

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-800 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Test Setup Editor</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{formData.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Form
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save Setup
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Components & Interfaces (only show if there are components or interfaces) */}
          {(formData.components.length > 0 || formData.interfaces.length > 0) && (
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {/* Components List (display only) */}
                {formData.components.length > 0 && (
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Components
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Use draw.io tools to add these to your diagram
                    </p>
                    <div className="space-y-2">
                      {formData.components.map((component) => (
                        <div
                          key={component.id}
                          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {component.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {component.type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interfaces List (display only) */}
                {formData.interfaces.length > 0 && (
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Interfaces
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Use draw.io tools to add these to your diagram
                    </p>
                    <div className="space-y-2">
                      {formData.interfaces.map((interface_) => (
                        <div
                          key={interface_.id}
                          className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="text-xs font-medium text-gray-900 dark:text-white">
                            {interface_.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {interface_.type}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col relative">
            {/* Error Banner */}
            {displayError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{displayError}</span>
              </div>
            )}

            {/* Draw.io Canvas - Custom iframe integration */}
            <div className="flex-1 relative z-10">
              <iframe
                ref={iframeRef}
                src={getDrawIOUrl({ noExitBtn: true })}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                title="Draw.io Editor"
              />
              {/* Loading indicator */}
              {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-75">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Loading draw.io editor...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
