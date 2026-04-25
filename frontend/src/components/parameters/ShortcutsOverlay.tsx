import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * Keyboard cheatsheet overlay. Press `?` on the Parameters page to
 * open. Pure presentational — list lives in `SHORTCUTS` below; add a
 * row when you wire a new keyboard handler.
 */

const SHORTCUTS: Array<{ keys: string[]; action: string; group: string }> = [
  { group: 'Search & navigation', keys: ['Ctrl', 'F'], action: 'Focus the search box' },
  { group: 'Search & navigation', keys: ['Ctrl', '/'], action: 'Open the command palette' },
  { group: 'Search & navigation', keys: ['?'], action: 'Open this cheatsheet' },
  { group: 'Search & navigation', keys: ['Esc'], action: 'Close any modal, drawer, palette, or this overlay' },
  { group: 'Selection & list', keys: ['↑', '↓'], action: 'Move selection in palette / dropdowns' },
  { group: 'Selection & list', keys: ['Enter'], action: 'Activate / commit inline edit' },
  { group: 'Tabs', keys: ['Ctrl', '1'], action: 'Switch to List view' },
  { group: 'Tabs', keys: ['Ctrl', '2'], action: 'Switch to Board view' },
  { group: 'Tabs', keys: ['Ctrl', '3'], action: 'Switch to Graph view' },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  )
}

export default function ShortcutsOverlay({ open, onClose }: Props) {
  if (!open) return null
  // Group by section.
  const groups = new Map<string, typeof SHORTCUTS>()
  for (const s of SHORTCUTS) {
    if (!groups.has(s.group)) groups.set(s.group, [])
    groups.get(s.group)!.push(s)
  }
  return (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Keyboard shortcuts
          </h2>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {Array.from(groups.entries()).map(([group, items]) => (
            <div key={group}>
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 font-semibold mb-2">
                {group}
              </p>
              <ul className="space-y-1.5">
                {items.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{s.action}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      {s.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && <span className="text-[10px] text-gray-400">+</span>}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-5 py-2.5 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 flex justify-between">
          <span>Press <Kbd>?</Kbd> anywhere on this page to reopen.</span>
          <span>
            <Kbd>Esc</Kbd> to close.
          </span>
        </div>
      </div>
    </div>
  )
}
