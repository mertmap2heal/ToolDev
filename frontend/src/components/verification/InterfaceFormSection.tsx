import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'
import CustomDropdown from './CustomDropdown'

export interface Interface {
  id: string
  name: string
  type: string // Changed from union type to string to support custom options
  protocol?: string
  description?: string
  order: number
}

interface InterfaceFormSectionProps {
  interfaces: Interface[]
  onChange: (interfaces: Interface[]) => void
  projectId: string
}

export default function InterfaceFormSection({
  interfaces,
  onChange,
  projectId,
}: InterfaceFormSectionProps) {
  const addInterface = () => {
    const newInterface: Interface = {
      id: Date.now().toString(),
      name: '',
      type: '',
      order: interfaces.length,
    }
    onChange([...interfaces, newInterface])
  }

  const removeInterface = (id: string) => {
    onChange(interfaces.filter((i) => i.id !== id).map((i, idx) => ({ ...i, order: idx })))
  }

  const updateInterface = (id: string, updates: Partial<Interface>) => {
    onChange(interfaces.map((i) => (i.id === id ? { ...i, ...updates } : i)))
  }

  const moveInterface = (index: number, direction: 'up' | 'down') => {
    const newInterfaces = [...interfaces]
    if (direction === 'up' && index > 0) {
      [newInterfaces[index - 1], newInterfaces[index]] = [newInterfaces[index], newInterfaces[index - 1]]
      newInterfaces[index - 1].order = index - 1
      newInterfaces[index].order = index
    } else if (direction === 'down' && index < newInterfaces.length - 1) {
      [newInterfaces[index], newInterfaces[index + 1]] = [newInterfaces[index + 1], newInterfaces[index]]
      newInterfaces[index].order = index
      newInterfaces[index + 1].order = index + 1
    }
    onChange(newInterfaces)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Interfaces</label>
        <button
          type="button"
          onClick={addInterface}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          <Plus size={14} />
          Add Interface
        </button>
      </div>

      {interfaces.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No interfaces added yet</p>
      ) : (
        <div className="space-y-3">
          {interfaces.map((interface_, index) => (
            <div
              key={interface_.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-2 mb-3">
                <GripVertical className="text-gray-400" size={16} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Interface {index + 1}</span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => moveInterface(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveInterface(index, 'down')}
                    disabled={index === interfaces.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeInterface(interface_.id)}
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Interface Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={interface_.name}
                    onChange={(e) => updateInterface(interface_.id, { name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter interface name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Interface Type
                  </label>
                  <CustomDropdown
                    value={interface_.type}
                    onChange={(value) => updateInterface(interface_.id, { type: value })}
                    optionType="INTERFACE_TYPE"
                    projectId={projectId}
                    placeholder="Select interface type"
                    className="text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Protocol/Standard
                  </label>
                  <input
                    type="text"
                    value={interface_.protocol || ''}
                    onChange={(e) => updateInterface(interface_.id, { protocol: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., CAN, Ethernet, USB"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={interface_.description || ''}
                    onChange={(e) => updateInterface(interface_.id, { description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Enter interface description"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
