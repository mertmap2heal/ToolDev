import { useState } from 'react'
import { X, Check } from 'lucide-react'

export type GridType = 'none' | 'dots' | 'lines' | 'cross'

export interface EditorSettings {
  backgroundColor: string
  gridType: GridType
  gridColor: string
  gridSize: number
  showGrid: boolean
}

export const defaultEditorSettings: EditorSettings = {
  backgroundColor: '#f3f4f6', // Light grey (gray-100)
  gridType: 'none',
  gridColor: '#d1d5db',
  gridSize: 20,
  showGrid: false,
}

const presetBackgroundColors = [
  { name: 'Light Grey', value: '#f3f4f6' },
  { name: 'White', value: '#ffffff' },
  { name: 'Dark Grey', value: '#374151' },
  { name: 'Light Blue', value: '#eff6ff' },
  { name: 'Light Green', value: '#f0fdf4' },
  { name: 'Light Yellow', value: '#fefce8' },
]

const gridTypes: { id: GridType; name: string }[] = [
  { id: 'none', name: 'None (Solid)' },
  { id: 'dots', name: 'Dots' },
  { id: 'lines', name: 'Lines' },
  { id: 'cross', name: 'Cross' },
]

interface EditorSettingsPanelProps {
  settings: EditorSettings
  onChange: (settings: EditorSettings) => void
  onClose: () => void
}

export default function EditorSettingsPanel({
  settings,
  onChange,
  onClose,
}: EditorSettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState<EditorSettings>(settings)

  const handleChange = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
  }

  const handleApply = () => {
    onChange(localSettings)
    onClose()
  }

  const handleReset = () => {
    setLocalSettings(defaultEditorSettings)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-96 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Canvas Settings</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Background Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Background Color
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {presetBackgroundColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleChange('backgroundColor', color.value)}
                  className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                    localSettings.backgroundColor === color.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded border border-gray-300"
                    style={{ backgroundColor: color.value }}
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{color.name}</span>
                  {localSettings.backgroundColor === color.value && (
                    <Check size={12} className="text-blue-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 dark:text-gray-400">Custom:</label>
              <input
                type="color"
                value={localSettings.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <input
                type="text"
                value={localSettings.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="#f3f4f6"
              />
            </div>
          </div>

          {/* Grid Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Grid Type
            </label>
            <div className="space-y-2">
              {gridTypes.map((grid) => (
                <label
                  key={grid.id}
                  className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                    localSettings.gridType === grid.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="gridType"
                    value={grid.id}
                    checked={localSettings.gridType === grid.id}
                    onChange={(e) => handleChange('gridType', e.target.value as GridType)}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{grid.name}</span>
                  {/* Grid preview */}
                  <div
                    className="ml-auto w-12 h-12 rounded border border-gray-300"
                    style={{
                      backgroundColor: '#f3f4f6',
                      backgroundImage:
                        grid.id === 'dots'
                          ? 'radial-gradient(circle, #9ca3af 1px, transparent 1px)'
                          : grid.id === 'lines'
                          ? 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)'
                          : grid.id === 'cross'
                          ? 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)'
                          : 'none',
                      backgroundSize:
                        grid.id === 'dots'
                          ? '8px 8px'
                          : grid.id === 'lines' || grid.id === 'cross'
                          ? '8px 8px'
                          : 'auto',
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Grid Settings (only show if grid is enabled) */}
          {localSettings.gridType !== 'none' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Grid Size
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={localSettings.gridSize}
                    onChange={(e) => handleChange('gridSize', parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                    {localSettings.gridSize}px
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Grid Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localSettings.gridColor}
                    onChange={(e) => handleChange('gridColor', e.target.value)}
                    className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localSettings.gridColor}
                    onChange={(e) => handleChange('gridColor', e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
