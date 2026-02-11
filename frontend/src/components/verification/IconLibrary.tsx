import { useState, useRef } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Zap,
  Battery,
  PlugZap,
  Cable,
  Thermometer,
  Gauge,
  Activity,
  Radio,
  Cpu,
  Monitor,
  Server,
  HardDrive,
  Cog,
  Fan,
  CircleDot,
  Square,
  Circle,
  Triangle,
  Hexagon,
  Star,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface IconDefinition {
  id: string
  name: string
  category: string
  icon?: LucideIcon
  svg?: string
  isCustom?: boolean
}

// Predefined icons using Lucide and custom SVGs
export const iconLibrary: Record<string, IconDefinition[]> = {
  electrical: [
    { id: 'power-supply', name: 'Power Supply', category: 'electrical', icon: Zap },
    { id: 'battery', name: 'Battery', category: 'electrical', icon: Battery },
    { id: 'ground', name: 'Ground', category: 'electrical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="10"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="10" y1="18" x2="14" y2="18"/></svg>` },
    { id: 'switch', name: 'Switch', category: 'electrical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><line x1="8" y1="12" x2="16" y2="6"/></svg>` },
    { id: 'fuse', name: 'Fuse', category: 'electrical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="16" height="8" rx="1"/><line x1="12" y1="8" x2="12" y2="16"/></svg>` },
    { id: 'resistor', name: 'Resistor', category: 'electrical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="6" y2="12"/><polyline points="6,12 7,8 9,16 11,8 13,16 15,8 17,16 18,12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>` },
    { id: 'capacitor', name: 'Capacitor', category: 'electrical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="10" y2="12"/><line x1="10" y1="6" x2="10" y2="18"/><line x1="14" y1="6" x2="14" y2="18"/><line x1="14" y1="12" x2="22" y2="12"/></svg>` },
    { id: 'inductor', name: 'Inductor', category: 'electrical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="5" y2="12"/><path d="M5,12 Q7,6 9,12 Q11,18 13,12 Q15,6 17,12 Q19,18 19,12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>` },
  ],
  sensors: [
    { id: 'temperature', name: 'Temperature Sensor', category: 'sensors', icon: Thermometer },
    { id: 'pressure', name: 'Pressure Sensor', category: 'sensors', icon: Gauge },
    { id: 'accelerometer', name: 'Accelerometer', category: 'sensors', icon: Activity },
    { id: 'strain-gauge', name: 'Strain Gauge', category: 'sensors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8,8 L8,16 L10,16 L10,8 L12,8 L12,16 L14,16 L14,8 L16,8"/></svg>` },
    { id: 'voltage-sensor', name: 'Voltage Sensor', category: 'sensors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">V</text></svg>` },
    { id: 'current-sensor', name: 'Current Sensor', category: 'sensors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">A</text></svg>` },
    { id: 'proximity', name: 'Proximity Sensor', category: 'sensors', icon: Radio },
    { id: 'flow-sensor', name: 'Flow Sensor', category: 'sensors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M8,12 L16,12 M14,9 L16,12 L14,15"/></svg>` },
  ],
  connectors: [
    { id: 'cable', name: 'Cable', category: 'connectors', icon: Cable },
    { id: 'port', name: 'Port', category: 'connectors', icon: PlugZap },
    { id: 'plug', name: 'Plug', category: 'connectors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="8" height="12" rx="1"/><line x1="10" y1="14" x2="10" y2="18"/><line x1="14" y1="14" x2="14" y2="18"/><line x1="6" y1="18" x2="18" y2="18"/><line x1="6" y1="18" x2="6" y2="22"/><line x1="18" y1="18" x2="18" y2="22"/></svg>` },
    { id: 'junction', name: 'Junction', category: 'connectors', icon: CircleDot },
    { id: 'terminal', name: 'Terminal Block', category: 'connectors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/><line x1="8" y1="6" x2="8" y2="2"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="16" y1="6" x2="16" y2="2"/><line x1="8" y1="18" x2="8" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="16" y1="18" x2="16" y2="22"/></svg>` },
    { id: 'bus', name: 'Bus', category: 'connectors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12" stroke-width="4"/><line x1="6" y1="12" x2="6" y2="6"/><line x1="10" y1="12" x2="10" y2="6"/><line x1="14" y1="12" x2="14" y2="6"/><line x1="18" y1="12" x2="18" y2="6"/></svg>` },
    { id: 'db-connector', name: 'DB Connector', category: 'connectors', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6,4 L18,4 L20,8 L20,16 L18,20 L6,20 L4,16 L4,8 Z"/><circle cx="8" cy="9" r="1" fill="currentColor"/><circle cx="12" cy="9" r="1" fill="currentColor"/><circle cx="16" cy="9" r="1" fill="currentColor"/><circle cx="10" cy="15" r="1" fill="currentColor"/><circle cx="14" cy="15" r="1" fill="currentColor"/></svg>` },
  ],
  equipment: [
    { id: 'computer', name: 'Computer', category: 'equipment', icon: Monitor },
    { id: 'daq', name: 'DAQ System', category: 'equipment', icon: Server },
    { id: 'oscilloscope', name: 'Oscilloscope', category: 'equipment', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M5,14 L8,8 L11,14 L14,6 L17,14 L19,10"/><line x1="6" y1="20" x2="6" y2="22"/><line x1="18" y1="20" x2="18" y2="22"/></svg>` },
    { id: 'controller', name: 'Controller', category: 'equipment', icon: Cpu },
    { id: 'plc', name: 'PLC', category: 'equipment', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="4" width="12" height="6" rx="1"/><circle cx="8" cy="14" r="1" fill="currentColor"/><circle cx="12" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/><circle cx="8" cy="18" r="1" fill="currentColor"/><circle cx="12" cy="18" r="1" fill="currentColor"/><circle cx="16" cy="18" r="1" fill="currentColor"/></svg>` },
    { id: 'hdd', name: 'Storage/HDD', category: 'equipment', icon: HardDrive },
    { id: 'signal-gen', name: 'Signal Generator', category: 'equipment', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6,12 Q8,6 10,12 Q12,18 14,12 Q16,6 18,12"/></svg>` },
    { id: 'power-unit', name: 'Power Unit', category: 'equipment', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>` },
  ],
  mechanical: [
    { id: 'motor', name: 'Motor', category: 'mechanical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="20"/><line x1="4" y1="12" x2="2" y2="12"/></svg>` },
    { id: 'actuator', name: 'Actuator', category: 'mechanical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="10" height="8" rx="1"/><line x1="14" y1="12" x2="22" y2="12"/><polygon points="20,10 22,12 20,14" fill="currentColor"/></svg>` },
    { id: 'valve', name: 'Valve', category: 'mechanical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="8" y2="12"/><polygon points="8,8 16,12 8,16" fill="none"/><polygon points="16,8 8,12 16,16" fill="none"/><line x1="16" y1="12" x2="22" y2="12"/></svg>` },
    { id: 'pump', name: 'Pump', category: 'mechanical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12,4 L12,8 M8,6 L12,8 L16,6"/><line x1="4" y1="12" x2="2" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>` },
    { id: 'gear', name: 'Gear', category: 'mechanical', icon: Cog },
    { id: 'fan', name: 'Fan', category: 'mechanical', icon: Fan },
    { id: 'cylinder', name: 'Cylinder', category: 'mechanical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="12" height="16" rx="1"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="2" y1="7" x2="6" y2="7"/></svg>` },
    { id: 'bearing', name: 'Bearing', category: 'mechanical', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>` },
  ],
  shapes: [
    { id: 'square', name: 'Square', category: 'shapes', icon: Square },
    { id: 'circle', name: 'Circle', category: 'shapes', icon: Circle },
    { id: 'triangle', name: 'Triangle', category: 'shapes', icon: Triangle },
    { id: 'hexagon', name: 'Hexagon', category: 'shapes', icon: Hexagon },
    { id: 'star', name: 'Star', category: 'shapes', icon: Star },
  ],
}

const categoryLabels: Record<string, string> = {
  electrical: 'Electrical',
  sensors: 'Sensors',
  connectors: 'Connectors',
  equipment: 'Equipment',
  mechanical: 'Mechanical',
  shapes: 'Shapes',
}

interface IconLibraryProps {
  onSelectIcon: (icon: IconDefinition) => void
  customIcons: IconDefinition[]
  onUploadCustomIcon: (icon: IconDefinition) => void
  onDeleteCustomIcon: (iconId: string) => void
}

export default function IconLibrary({
  onSelectIcon,
  customIcons,
  onUploadCustomIcon,
  onDeleteCustomIcon,
}: IconLibraryProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    electrical: true,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const customIcon: IconDefinition = {
        id: `custom-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        category: 'custom',
        svg: reader.result as string,
        isCustom: true,
      }
      onUploadCustomIcon(customIcon)
    }

    if (file.type === 'image/svg+xml') {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const renderIcon = (icon: IconDefinition, size: number = 20) => {
    if (icon.icon) {
      const IconComponent = icon.icon
      return <IconComponent size={size} className="text-gray-700 dark:text-gray-200" />
    }
    if (icon.svg) {
      if (icon.svg.startsWith('data:')) {
        return <img src={icon.svg} alt={icon.name} width={size} height={size} />
      }
      // Replace currentColor with a specific color for better visibility
      const coloredSvg = icon.svg.replace(/currentColor/g, '#374151')
      return (
        <div
          dangerouslySetInnerHTML={{ __html: coloredSvg }}
          style={{ width: size, height: size }}
          className="[&>svg]:w-full [&>svg]:h-full dark:[&>svg]:stroke-gray-200"
        />
      )
    }
    return <Square size={size} className="text-gray-700 dark:text-gray-200" />
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 px-4 pt-4">Icons</h3>

      <div className="flex-1 overflow-y-auto px-4">
        {Object.entries(iconLibrary).map(([category, icons]) => (
          <div key={category} className="mb-2">
            <button
              onClick={() => toggleCategory(category)}
              className="flex items-center gap-2 w-full text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {expandedCategories[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {categoryLabels[category]}
            </button>

            {expandedCategories[category] && (
              <div className="grid grid-cols-3 gap-1 ml-4 mb-2">
                {icons.map((icon) => (
                  <button
                    key={icon.id}
                    onClick={() => onSelectIcon(icon)}
                    className="p-2 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center justify-center text-gray-700 dark:text-gray-200"
                    title={icon.name}
                  >
                    {renderIcon(icon, 18)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Custom Icons */}
        <div className="mb-2">
          <button
            onClick={() => toggleCategory('custom')}
            className="flex items-center gap-2 w-full text-left py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            {expandedCategories['custom'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Custom Icons
          </button>

          {expandedCategories['custom'] && (
            <div className="ml-4 mb-2">
              {customIcons.length > 0 ? (
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {customIcons.map((icon) => (
                    <div key={icon.id} className="relative group">
                      <button
                        onClick={() => onSelectIcon(icon)}
                        className="w-full p-2 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center justify-center text-gray-700 dark:text-gray-200"
                        title={icon.name}
                      >
                        {renderIcon(icon, 18)}
                      </button>
                      <button
                        onClick={() => onDeleteCustomIcon(icon.id)}
                        className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">No custom icons</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-center justify-center gap-2 w-full p-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
          <Upload size={16} className="text-gray-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400">Upload Icon</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,image/svg+xml,image/png,image/jpeg"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}

// Export helper to render icons in nodes
export function renderIconSvg(icon: IconDefinition, size: number = 24, color?: string): React.ReactNode {
  if (icon.icon) {
    const IconComponent = icon.icon
    return <IconComponent size={size} className={color || 'text-gray-700 dark:text-gray-200'} />
  }
  if (icon.svg) {
    if (icon.svg.startsWith('data:')) {
      return <img src={icon.svg} alt={icon.name} width={size} height={size} />
    }
    // Replace currentColor with a specific color for better visibility
    const coloredSvg = icon.svg.replace(/currentColor/g, '#374151')
    return (
      <div
        dangerouslySetInnerHTML={{ __html: coloredSvg }}
        style={{ width: size, height: size }}
        className="[&>svg]:w-full [&>svg]:h-full"
      />
    )
  }
  return null
}
