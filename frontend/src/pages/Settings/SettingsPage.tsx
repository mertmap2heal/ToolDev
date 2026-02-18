import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore, type Theme } from '../../store/themeStore'

const themeOptions: { value: Theme; label: string; description: string; preview: { bg: string; surface: string; sidebar: string; text: string } }[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Bright white background',
    preview: { bg: '#ffffff', surface: '#f9fafb', sidebar: '#f3f4f6', text: '#1f2937' },
  },
  {
    value: 'midnight',
    label: 'Midnight Blue',
    description: 'Deep navy/slate background',
    preview: { bg: '#0f172a', surface: '#1e293b', sidebar: '#0c1425', text: '#cbd5e1' },
  },
]

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Settings</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Manage your application preferences</p>

      {/* Appearance Section */}
      <section className="rounded-xl border p-6" style={{ backgroundColor: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Monitor size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Choose how the application looks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`group relative rounded-xl border-2 transition-all text-left overflow-hidden ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                {/* Mini Preview */}
                <div className="h-24 flex" style={{ backgroundColor: opt.preview.bg }}>
                  {/* Mini sidebar */}
                  <div className="w-6 h-full flex flex-col items-center gap-1 pt-2" style={{ backgroundColor: opt.preview.sidebar }}>
                    <div className="w-3 h-3 rounded-sm opacity-40" style={{ backgroundColor: opt.preview.text }} />
                    <div className="w-3 h-3 rounded-sm opacity-40" style={{ backgroundColor: opt.preview.text }} />
                    <div className="w-3 h-3 rounded-sm opacity-40" style={{ backgroundColor: opt.preview.text }} />
                  </div>
                  {/* Mini content */}
                  <div className="flex-1 p-2">
                    {/* Mini header */}
                    <div className="h-3 rounded mb-2" style={{ backgroundColor: opt.preview.surface }} />
                    {/* Mini content blocks */}
                    <div className="flex gap-1">
                      <div className="flex-1 h-10 rounded" style={{ backgroundColor: opt.preview.surface }} />
                      <div className="flex-1 h-10 rounded" style={{ backgroundColor: opt.preview.surface }} />
                    </div>
                  </div>
                </div>

                {/* Label */}
                <div className="px-3 py-3" style={{ backgroundColor: 'var(--theme-surface)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-gray-900 dark:text-white">{opt.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
