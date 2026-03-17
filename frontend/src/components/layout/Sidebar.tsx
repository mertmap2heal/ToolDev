import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  type LucideIcon,
} from 'lucide-react'
import { MODULES, CATEGORIES } from '../../config/ModuleConfiguration'
import { useAuthStore } from '../../store/authStore'
import Logo from '../Logo'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sidebar-collapsed'

function getCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function setCollapsed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NavItemProps {
  icon: LucideIcon
  label: string
  to: string
  collapsed: boolean
  active: boolean
}

function NavItem({ icon: Icon, label, to, collapsed, active }: NavItemProps) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 8,
        padding: collapsed ? '6px 0' : '5px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        textDecoration: 'none',
        position: 'relative',
        color: active ? 'var(--theme-text)' : 'var(--theme-text-muted)',
        backgroundColor: active
          ? 'var(--theme-sidebar-item-active)'
          : 'transparent',
        borderLeft: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
        transition: 'background-color 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--theme-sidebar-item-hover)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
        }
      }}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
    </Link>
  )
}

interface SectionLabelProps {
  label: string
  collapsed: boolean
}

function SectionLabel({ label, collapsed }: SectionLabelProps) {
  if (collapsed) {
    return (
      <div style={{
        height: 1,
        margin: '6px 8px',
        backgroundColor: 'var(--theme-border)',
      }} />
    )
  }
  return (
    <div style={{
      padding: '10px 10px 3px',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--theme-text-muted)',
      opacity: 0.7,
    }}>
      {label}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const [collapsed, setCollapsedState] = useState(getCollapsed)
  const location = useLocation()
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuthStore()

  // Ctrl+B to toggle collapse (VS Code convention)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setCollapsedState((prev) => {
          const next = !prev
          setCollapsed(next)
          return next
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggle = () => {
    setCollapsedState((prev) => {
      const next = !prev
      setCollapsed(next)
      return next
    })
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  // ---- Project context navigation ----
  const systemModules = MODULES.filter((m) => m.category === 'system')
  const assuranceModules = MODULES.filter((m) => m.category === 'assurance')
  const devModules = MODULES.filter((m) => m.category === 'development')

  const sidebarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: '100%',
    width: collapsed ? 48 : 220,
    minWidth: collapsed ? 48 : 220,
    borderRight: '1px solid var(--theme-border)',
    backgroundColor: 'var(--theme-sidebar)',
    transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out',
    overflow: 'hidden',
  }

  const collapseBtn = (
    <button
      onClick={toggle}
      title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '8px 0',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--theme-text-muted)',
      }}
    >
      {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
    </button>
  )

  // ---- Project sidebar ----
  if (projectId) {
    return (
      <aside style={sidebarStyle}>
        {/* Header area */}
        <div style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0' : '0 12px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid var(--theme-border)',
          flexShrink: 0,
        }}>
          {collapsed ? (
            <Home size={16} style={{ color: 'var(--theme-text-muted)' }} />
          ) : (
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--theme-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              Project
            </span>
          )}
        </div>

        {/* Scrollable nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
          <NavItem icon={Home} label="Overview" to={`/projects/${projectId}`} collapsed={collapsed} active={location.pathname === `/projects/${projectId}`} />

          <SectionLabel label="Development" collapsed={collapsed} />
          {devModules.map((m) => (
            <NavItem
              key={m.id}
              icon={m.icon}
              label={m.label}
              to={`/projects/${projectId}/${m.route}`}
              collapsed={collapsed}
              active={isActive(`/projects/${projectId}/${m.route}`)}
            />
          ))}

          <SectionLabel label={CATEGORIES.find(c => c.id === 'system')?.label ?? 'System'} collapsed={collapsed} />
          {systemModules.map((m) => (
            <NavItem
              key={m.id}
              icon={m.icon}
              label={m.label}
              to={`/projects/${projectId}/${m.route}`}
              collapsed={collapsed}
              active={isActive(`/projects/${projectId}/${m.route}`)}
            />
          ))}

          <SectionLabel label={CATEGORIES.find(c => c.id === 'assurance')?.label ?? 'Assurance'} collapsed={collapsed} />
          {assuranceModules.map((m) => (
            <NavItem
              key={m.id}
              icon={m.icon}
              label={m.label}
              to={`/projects/${projectId}/${m.route}`}
              collapsed={collapsed}
              active={isActive(`/projects/${projectId}/${m.route}`)}
            />
          ))}
        </div>

        {/* Bottom pinned */}
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid var(--theme-border)',
          padding: '4px 6px',
        }}>
          <NavItem icon={Settings} label="Settings" to="/settings" collapsed={collapsed} active={isActive('/settings')} />
          {collapseBtn}
        </div>
      </aside>
    )
  }

  // ---- Global sidebar ----
  return (
    <aside style={sidebarStyle}>
      {/* Logo */}
      <div style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        padding: collapsed ? '0' : '0 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid var(--theme-border)',
        flexShrink: 0,
      }}>
        {collapsed ? (
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Logo size="sm" showText={false} />
          </Link>
        ) : (
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Logo size="sm" showText={true} />
          </Link>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
        <NavItem icon={LayoutDashboard} label="Dashboard" to="/" collapsed={collapsed} active={location.pathname === '/'} />
        <NavItem icon={Package} label="Inventory" to="/inventory/items" collapsed={collapsed} active={isActive('/inventory')} />
      </div>

      {/* Bottom */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--theme-border)',
        padding: '4px 6px',
      }}>
        <NavItem icon={Settings} label="Settings" to="/settings" collapsed={collapsed} active={isActive('/settings')} />
        {!collapsed && user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            fontSize: 11,
            color: 'var(--theme-text-muted)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: 'var(--theme-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              flexShrink: 0,
            }}>
              {(user.name ?? user.email ?? '?')[0].toUpperCase()}
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name ?? user.email}
            </span>
          </div>
        )}
        {collapseBtn}
      </div>
    </aside>
  )
}
