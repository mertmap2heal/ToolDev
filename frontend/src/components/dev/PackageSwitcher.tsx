import { useFeaturePackage } from '../../contexts/FeaturePackageContext'
import { type PackageId } from '../../config/packageConfig'

const PACKAGES: { id: PackageId; label: string }[] = [
  { id: 'core', label: 'Core' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'complete', label: 'Complete' },
]

export default function PackageSwitcher() {
  const { activePackage, setDevPackage } = useFeaturePackage()

  if (!import.meta.env.DEV) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      // z-index 40 keeps the switcher visible above page content but BELOW modal
      // overlays (which use z-50). Avoids intercepting clicks on modal action
      // buttons that render in the bottom-right corner (#243).
      zIndex: 40,
      background: 'var(--theme-surface)',
      border: '1px solid var(--theme-border)',
      borderRadius: 8,
      padding: '5px 7px',
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    }}>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--theme-text-muted)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginRight: 2,
      }}>
        Pkg:
      </span>
      {PACKAGES.map(pkg => (
        <button
          key={pkg.id}
          onClick={() => setDevPackage(pkg.id)}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            background: activePackage === pkg.id ? 'var(--theme-accent)' : 'var(--theme-sidebar-item-hover)',
            color: activePackage === pkg.id ? '#fff' : 'var(--theme-text-muted)',
            transition: 'background 0.1s, color 0.1s',
          }}
        >
          {pkg.label}
        </button>
      ))}
    </div>
  )
}
