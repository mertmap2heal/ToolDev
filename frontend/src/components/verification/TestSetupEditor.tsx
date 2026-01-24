import { useState, useCallback, useRef } from 'react'
import {
  X,
  Upload,
  Save,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react'
import type { Component, Interface } from './ComponentFormSection'
import { useDrawIO, getDrawIOUrl, prepareXml, EMPTY_DIAGRAM } from './useDrawIO'

interface TestSetupEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { diagramData: any; photos: any[] }) => void
  formData: {
    name: string
    components: Component[]
    interfaces: Interface[]
  }
  initialDiagramData?: any
  initialPhotos?: any[]
}

export default function TestSetupEditor({
  isOpen,
  onClose,
  onSave,
  formData,
  initialDiagramData,
  initialPhotos = [],
}: TestSetupEditorProps) {
  const [photos, setPhotos] = useState<any[]>(initialPhotos)
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Check for load errors
  const checkLoadErrors = useCallback((data: any) => {
    if (!data) return

    // Check for HTML response (auth redirect)
    if (typeof data === 'string' && data.includes('<!DOCTYPE') || data.includes('<html')) {
      setLoadError('Server returned HTML instead of diagram data. You may need to re-authenticate.')
      return
    }

    // Check for escaped XML
    if (typeof data === 'string' && data.includes('&lt;mxfile')) {
      setLoadError('Diagram data is HTML-escaped. Please report this issue.')
      return
    }

    setLoadError(null)
  }, [])

  // Check for errors on initial load
  useState(() => {
    checkLoadErrors(initialDiagramData)
  })

  // Handle file upload for photos
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const photoData = {
          id: Date.now().toString() + Math.random(),
          fileName: file.name,
          fileUrl: reader.result as string,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        }
        setPhotos((prev) => [...prev, photoData])
        if (selectedPhoto === null) {
          setSelectedPhoto(0)
        }
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const photoData = {
          id: Date.now().toString() + Math.random(),
          fileName: file.name,
          fileUrl: reader.result as string,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        }
        setPhotos((prev) => [...prev, photoData])
        if (selectedPhoto === null) {
          setSelectedPhoto(0)
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
    if (selectedPhoto === index) {
      setSelectedPhoto(null)
    } else if (selectedPhoto !== null && selectedPhoto > index) {
      setSelectedPhoto(selectedPhoto - 1)
    }
  }

  // Main save handler - saves diagram and photos
  const handleSave = () => {
    // Store raw XML string
    const diagramData = {
      xml: currentXml || EMPTY_DIAGRAM,
      format: 'drawio',
    }
    console.log('[TestSetupEditor] Saving diagram, XML length:', diagramData.xml.length)
    onSave({ diagramData, photos })
  }

  // Get the error to display (either from hook or local check)
  const displayError = loadError || drawioError

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] h-[95vh] flex flex-col">
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
          {/* Left Sidebar - Components & Photos */}
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {/* Photo Upload */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Reference Photos
                </h3>
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-3"
                >
                  <label className="flex flex-col items-center justify-center cursor-pointer">
                    <Upload className="text-gray-400 mb-1" size={20} />
                    <span className="text-xs text-gray-600 dark:text-gray-400 text-center">
                      Drop or click
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {photos.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    <button
                      onClick={() => setSelectedPhoto(null)}
                      className={`w-full p-2 text-left border rounded-lg transition-colors text-xs ${
                        selectedPhoto === null
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      No background
                    </button>
                    {photos.map((photo, idx) => (
                      <div
                        key={photo.id}
                        className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                          selectedPhoto === idx
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setSelectedPhoto(idx)}
                      >
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                          {photo.fileName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {(photo.fileSize / 1024).toFixed(1)} KB
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removePhoto(idx)
                          }}
                          className="mt-1 text-xs text-red-600 hover:text-red-800 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col relative">
            {/* Error Banner */}
            {displayError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{displayError}</span>
              </div>
            )}

            {/* Background Photo (if selected) */}
            {selectedPhoto !== null && photos[selectedPhoto] && (
              <div className="absolute inset-0 z-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                <img
                  src={photos[selectedPhoto].fileUrl}
                  alt={photos[selectedPhoto].fileName}
                  className="max-w-full max-h-full object-contain opacity-30"
                />
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
    </div>
  )
}
