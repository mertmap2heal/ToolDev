import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onOpenManual: () => void
}

const SHORTCUTS: Array<{ keys: string; label: string; group: string }> = [
  { group: 'Navigation', keys: '?', label: 'Open this shortcuts overlay' },
  { group: 'Navigation', keys: 'Esc', label: 'Close drawer / overlay' },
  { group: 'Navigation', keys: 'j', label: 'Select next row' },
  { group: 'Navigation', keys: 'k', label: 'Select previous row' },
  { group: 'Navigation', keys: 'Enter', label: 'Open selected (or first) row' },
  { group: 'Search & Filter', keys: '⌘ / Ctrl + F', label: 'Focus search input' },
  { group: 'Create', keys: '⌘ / Ctrl + N', label: 'New validation item' },
  { group: 'Create', keys: '⌘ / Ctrl + ⇧ + F', label: 'New from requirements' },
  { group: 'Drawer', keys: '⌘ / Ctrl + S', label: 'Save drawer changes' },
  { group: 'Drawer', keys: '⌘ / Ctrl + Enter', label: 'Save drawer changes' },
]

export default function ValidationShortcutsOverlay({ isOpen, onClose, onOpenManual }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const groups = SHORTCUTS.reduce<Record<string, typeof SHORTCUTS>>((acc, s) => {
    acc[s.group] = acc[s.group] ?? []
    acc[s.group].push(s)
    return acc
  }, {})

  return (
    <div
      className="fixed inset-0"
      style={{
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--pv-bg)',
          color: 'var(--pv-fg)',
          border: '1px solid var(--pv-line)',
          borderRadius: 6,
          padding: 20,
          width: 'min(540px, 92vw)',
          maxHeight: '80vh',
          overflowY: 'auto',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 id="validation-shortcuts-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts"
            style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--pv-fg-3)', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--pv-fg-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 6,
              }}
            >
              {group}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {items.map((s) => (
                  <tr key={s.keys + s.label}>
                    <td style={{ padding: '4px 0', width: 160, color: 'var(--pv-fg-2)' }}>
                      <kbd
                        style={{
                          background: 'var(--pv-surface-soft)',
                          border: '1px solid var(--pv-line)',
                          borderRadius: 3,
                          padding: '1px 6px',
                          fontFamily: 'var(--pv-font-mono)',
                          fontSize: 11,
                        }}
                      >
                        {s.keys}
                      </kbd>
                    </td>
                    <td style={{ padding: '4px 0', color: 'var(--pv-fg)' }}>{s.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div
          style={{
            marginTop: 8,
            paddingTop: 12,
            borderTop: '1px solid var(--pv-line)',
            fontSize: 11,
            color: 'var(--pv-fg-3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Looking for the user manual instead?</span>
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenManual()
            }}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              color: 'var(--pv-blue)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'inherit',
            }}
          >
            Open the Validation help →
          </button>
        </div>
      </div>
    </div>
  )
}
