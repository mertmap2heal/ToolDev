import { X } from 'lucide-react'

export const PLATFORM_OPTIONS = [
  { key: 'c_header',   label: 'C Header',        group: 'Native' },
  { key: 'cpp_header', label: 'C++ Header',       group: 'Native' },
  { key: 'matlab',     label: 'MATLAB',           group: 'Math' },
  { key: 'simulink',   label: 'Simulink',         group: 'Math' },
  { key: 'python',     label: 'Python',           group: 'Script' },
  { key: 'ros',        label: 'ROS / ROS2',       group: 'Robotics' },
  { key: 'dds',        label: 'DDS / RTPS',       group: 'Middleware' },
  { key: 'can',        label: 'CAN / DBC',        group: 'Bus' },
  { key: 'autosar',    label: 'AUTOSAR',          group: 'Bus' },
  { key: 'mavlink',    label: 'MAVLink',          group: 'Protocol' },
  { key: 'xtce',       label: 'XTCE',             group: 'Protocol' },
  { key: 'mqtt',       label: 'MQTT',             group: 'Protocol' },
  { key: 'json_schema',label: 'JSON Schema',      group: 'Data' },
  { key: 'protobuf',   label: 'Protobuf',         group: 'Data' },
] as const

export type PlatformKey = (typeof PLATFORM_OPTIONS)[number]['key']

interface PlatformPickerProps {
  value: string[] | null | undefined
  onChange: (v: string[] | null) => void
}

export function PlatformPicker({ value, onChange }: PlatformPickerProps) {
  const selected = value ?? []

  function toggle(key: string) {
    if (selected.includes(key)) {
      const next = selected.filter(k => k !== key)
      onChange(next.length ? next : null)
    } else {
      onChange([...selected, key])
    }
  }

  // group options
  const groups: Record<string, typeof PLATFORM_OPTIONS[number][]> = {}
  for (const opt of PLATFORM_OPTIONS) {
    if (!groups[opt.group]) groups[opt.group] = []
    groups[opt.group].push(opt)
  }

  return (
    <div className="space-y-2">
      {/* selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(k => {
            const opt = PLATFORM_OPTIONS.find(o => o.key === k)
            return (
              <span
                key={k}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
              >
                {opt?.label ?? k}
                <button
                  type="button"
                  onClick={() => toggle(k)}
                  className="hover:text-blue-600 dark:hover:text-blue-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* grouped toggles */}
      <div className="flex flex-col gap-2">
        {Object.entries(groups).map(([group, opts]) => (
          <div key={group} className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-gray-400 dark:text-gray-500 w-16 shrink-0">{group}</span>
            {opts.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggle(opt.key)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  selected.includes(opt.key)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline"
        >
          Clear (available on all platforms)
        </button>
      )}
    </div>
  )
}
