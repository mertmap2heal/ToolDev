import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, FileText, X } from 'lucide-react'
import CustomDropdown from './CustomDropdown'

export interface Component {
  id: string
  name: string
  type: string // Changed from union type to string to support custom options
  manufacturer?: string
  model?: string
  specifications?: string
  serialNumber?: string
  manual?: {
    fileName: string
    fileUrl: string
    fileSize?: number
    mimeType?: string
  }
  order: number
}

interface ComponentFormSectionProps {
  components: Component[]
  onChange: (components: Component[]) => void
  projectId: string
  setupId?: string // Optional, needed for manual upload
}

export default function ComponentFormSection({
  components,
  onChange,
  projectId,
  setupId,
}: ComponentFormSectionProps) {
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const addComponent = () => {
    const newComponent: Component = {
      id: Date.now().toString(),
      name: '',
      type: '',
      order: components.length,
    }
    onChange([...components, newComponent])
  }

  const removeComponent = (id: string) => {
    onChange(components.filter((c) => c.id !== id).map((c, idx) => ({ ...c, order: idx })))
  }

  const updateComponent = (id: string, updates: Partial<Component>) => {
    onChange(components.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const moveComponent = (index: number, direction: 'up' | 'down') => {
    const newComponents = [...components]
    if (direction === 'up' && index > 0) {
      ;[newComponents[index - 1], newComponents[index]] = [newComponents[index], newComponents[index - 1]]
      newComponents[index - 1].order = index - 1
      newComponents[index].order = index
    } else if (direction === 'down' && index < newComponents.length - 1) {
      ;[newComponents[index], newComponents[index + 1]] = [newComponents[index + 1], newComponents[index]]
      newComponents[index].order = index
      newComponents[index + 1].order = index + 1
    }
    onChange(newComponents)
  }

  const handleFileUpload = async (componentId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const fileData = e.target?.result as string
      const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData
      const dataUrl = `data:${file.type};base64,${base64Data}`

      // Update component with manual metadata (will be saved when setup is saved)
      updateComponent(componentId, {
        manual: {
          fileName: file.name,
          fileUrl: dataUrl,
          fileSize: file.size,
          mimeType: file.type,
        },
      })
    }
    reader.readAsDataURL(file)
  }

  const removeManual = (componentId: string) => {
    updateComponent(componentId, { manual: undefined })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Components</label>
        <button
          type="button"
          onClick={addComponent}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          <Plus size={14} />
          Add Component
        </button>
      </div>

      {components.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No components added yet</p>
      ) : (
        <div className="space-y-3">
          {components.map((component, index) => (
            <div
              key={component.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-2 mb-3">
                <GripVertical className="text-gray-400" size={16} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Component {index + 1}</span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => moveComponent(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveComponent(index, 'down')}
                    disabled={index === components.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeComponent(component.id)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Component Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={component.name}
                    onChange={(e) => updateComponent(component.id, { name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter component name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Component Type
                  </label>
                  <CustomDropdown
                    value={component.type}
                    onChange={(value) => updateComponent(component.id, { type: value })}
                    optionType="COMPONENT_TYPE"
                    projectId={projectId}
                    placeholder="Select component type"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={component.manufacturer || ''}
                    onChange={(e) => updateComponent(component.id, { manufacturer: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter manufacturer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
                  <input
                    type="text"
                    value={component.model || ''}
                    onChange={(e) => updateComponent(component.id, { model: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter model"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Serial Number/ID
                  </label>
                  <input
                    type="text"
                    value={component.serialNumber || ''}
                    onChange={(e) => updateComponent(component.id, { serialNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter serial number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Specifications
                  </label>
                  <textarea
                    value={component.specifications || ''}
                    onChange={(e) => updateComponent(component.id, { specifications: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Enter specifications"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Component Manual
                  </label>
                  {component.manual ? (
                    <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-600 rounded-lg">
                      <FileText size={16} className="text-gray-600 dark:text-gray-300" />
                      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                        {component.manual.fileName}
                        {component.manual.fileSize && (
                          <span className="text-gray-500 dark:text-gray-400 ml-2">
                            ({(component.manual.fileSize / 1024).toFixed(1)} KB)
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeManual(component.id)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remove manual"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input
                        ref={(el) => (fileInputRefs.current[component.id] = el)}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(component.id, file)
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[component.id]?.click()}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
                      >
                        <FileText size={14} />
                        <span>Upload Manual (PDF, DOC, DOCX)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
