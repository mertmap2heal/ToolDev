import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  ChevronDown,
  ChevronRight,
  Code2,
  Boxes,
  ShieldCheck,
  X,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react'
import { MODULES, CATEGORIES } from '../../config/ModuleConfiguration'
import { useAuthStore } from '../../store/authStore'
import { useProjectStore } from '../../store/projectStore'
import { useThemeStore } from '../../store/themeStore'
import Logo from '../Logo'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLLAPSED_KEY = 'sidebar-collapsed'
const SECTIONS_KEY = 'sidebar-sections'

type SectionId = 'development' | 'system' | 'assurance'
type SectionState = Record<SectionId, boolean>

function getCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === 'true' } catch { return false }
}
function saveCollapsed(v: boolean) {
  try { localStorage.setItem(COLLAPSED_KEY, String(v)) } catch { /* ignore */ }
}

function getSectionState(): SectionState {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY)
    if (raw) return { development: true, system: true, assurance: true, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { development: true, system: true, assurance: true }
}
function saveSectionState(s: SectionState) {
  try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

interface NavItemProps {
  icon: LucideIcon
  label: string
  to: string
  collapsed: boolean
  active: boolean
}

function NavItem({ icon: Icon, label, to, collapsed, active }: NavItemProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: collapsed ? '8px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 5,
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        textDecoration: 'none',
        color: active
          ? 'var(--theme-text)'
          : hovered
          ? 'var(--theme-text)'
          : 'var(--theme-text-muted)',
        backgroundColor: active
          ? 'var(--theme-sidebar-item-active)'
          : hovered
          ? 'var(--theme-sidebar-item-hover)'
          : 'transparent',
        borderLeft: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
        transition: 'background-color 0.1s, color 0.1s',
        flexShrink: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon size={15} style={{ flexShrink: 0, opacity: active ? 1 : 0.75 }} />
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.3' }}>
          {label}
        </span>
      )}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// SectionLabel (accordion header)
// ---------------------------------------------------------------------------

interface SectionLabelProps {
  label: string
  sectionKey: SectionId
  collapsed: boolean
  open: boolean
  onToggle: (key: SectionId) => void
}

function SectionLabel({ label, sectionKey, collapsed, open, onToggle }: SectionLabelProps) {
  const [hovered, setHovered] = useState(false)
  if (collapsed) {
    return (
      <div style={{
        height: 1,
        margin: '8px 10px',
        backgroundColor: 'var(--theme-border)',
        opacity: 0.6,
      }} />
    )
  }
  return (
    <button
      onClick={() => onToggle(sectionKey)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 10px 4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: hovered ? 'var(--theme-text)' : 'var(--theme-text-muted)',
        textAlign: 'left',
        transition: 'color 0.1s',
      }}
    >
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {open
        ? <ChevronDown size={10} style={{ opacity: 0.6, flexShrink: 0 }} />
        : <ChevronRight size={10} style={{ opacity: 0.6, flexShrink: 0 }} />
      }
    </button>
  )
}

// ---------------------------------------------------------------------------
// CategoryIcon — used in collapsed project sidebar only
// ---------------------------------------------------------------------------

interface CategoryIconProps {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}

function CategoryIcon({ icon: Icon, label, active, onClick }: CategoryIconProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '7px 0',
        borderRadius: 5,
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--theme-accent)' : hovered ? 'var(--theme-text)' : 'var(--theme-text-muted)',
        backgroundColor: active
          ? 'var(--theme-sidebar-item-active)'
          : hovered
          ? 'var(--theme-sidebar-item-hover)'
          : 'transparent',
        borderLeft: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
        transition: 'background-color 0.1s, color 0.1s',
        flexShrink: 0,
      }}
    >
      <Icon size={16} style={{ opacity: active ? 1 : 0.7 }} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// CollapseButton
// ---------------------------------------------------------------------------

function CollapseBtn({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 6px',
        background: hovered ? 'var(--theme-sidebar-item-hover)' : 'none',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        color: hovered ? 'var(--theme-text)' : 'var(--theme-text-muted)',
        flexShrink: 0,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsedState] = useState(getCollapsed)
  const [sections, setSections] = useState<SectionState>(getSectionState)
  const [highlighted, setHighlighted] = useState<SectionId | null>(null)
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    development: null,
    system: null,
    assurance: null,
  })
  const location = useLocation()
  const { projectId } = useParams<{ projectId: string }>()
  const prevPath = useRef(location.pathname)

  // Close mobile nav on route change
  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname
      onMobileClose()
    }
  }, [location.pathname, onMobileClose])
  const { user } = useAuthStore()
  const { projects } = useProjectStore()
  const { theme, toggleTheme } = useThemeStore()

  const project = projects.find(p => p.id === projectId)
  const projectName = project?.name ?? (projectId ? 'Project' : null)

  // Ctrl+B keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggle = () => {
    setCollapsedState(prev => {
      const next = !prev
      saveCollapsed(next)
      return next
    })
  }

  // Expand sidebar, open the section, scroll to it, and briefly highlight it
  const expandToSection = (key: SectionId) => {
    saveCollapsed(false)
    setCollapsedState(false)
    setSections(prev => {
      const next = { ...prev, [key]: true }
      saveSectionState(next)
      return next
    })
    setHighlighted(key)
    // Wait for sidebar transition (200ms) then scroll
    setTimeout(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 220)
    // Clear highlight after 1.4s
    setTimeout(() => setHighlighted(null), 1400)
  }

  const toggleSection = (key: SectionId) => {
    setSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveSectionState(next)
      return next
    })
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  // Which category is currently active (for collapsed state highlighting)
  const activeCategory = MODULES.find(m =>
    location.pathname.includes(`/${m.route}`)
  )?.category ?? null

  const systemModules  = MODULES.filter(m => m.category === 'system')
  const devModules     = MODULES.filter(m => m.category === 'development')
  const assuranceModules = MODULES.filter(m => m.category === 'assurance')

  // On mobile the sidebar is always full expanded (no collapsed icon mode)
  const effectiveCollapsed = mobileOpen ? false : collapsed
  const desktopWidth = collapsed ? 48 : 220
  const sidebarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    height: '100%',
    width: mobileOpen ? 280 : desktopWidth,
    minWidth: mobileOpen ? 280 : desktopWidth,
    borderRight: '1px solid var(--theme-border)',
    backgroundColor: 'var(--theme-sidebar)',
    transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out, transform 0.2s ease-in-out',
    overflow: 'hidden',
  }

  const mobileCloseBtn = (
    <button
      onClick={onMobileClose}
      className="md:hidden p-1 rounded"
      style={{ color: 'var(--theme-text-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
      aria-label="Close navigation"
    >
      <X size={16} />
    </button>
  )

  // ---- Shared bottom area ----
  const bottomArea = (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--theme-border)',
      padding: '4px 6px',
    }}>
      <NavItem icon={Settings} label="Settings" to="/settings" collapsed={effectiveCollapsed} active={isActive('/settings')} />
      {!effectiveCollapsed && user && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px 6px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: 'var(--theme-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            {(user.name ?? user.email ?? '?')[0].toUpperCase()}
          </div>
          <span style={{
            fontSize: 11,
            color: 'var(--theme-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {user.name ?? user.email}
          </span>
          {/* Theme toggle — visible in sidebar on mobile since StatusBar is hidden */}
          {mobileOpen && (
            <button
              onClick={toggleTheme}
              title={theme === 'midnight' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                background: 'none',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--theme-text-muted)',
                flexShrink: 0,
              }}
            >
              {theme === 'midnight' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          )}
        </div>
      )}
    </div>
  )

  const asideClassName = [
    'fixed inset-y-0 left-0 z-50',
    mobileOpen ? 'translate-x-0' : '-translate-x-full',
    'md:relative md:inset-auto md:translate-x-0 md:z-auto',
  ].join(' ')

  // ---- Project sidebar ----
  if (projectId) {
    return (
      <aside className={asideClassName} style={sidebarStyle}>
        {/* Header */}
        <div style={{
          height: '2.75rem',
          display: 'flex',
          alignItems: 'center',
          padding: effectiveCollapsed ? '0 8px' : '0 6px 0 12px',
          justifyContent: effectiveCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--theme-border)',
          flexShrink: 0,
          gap: 6,
        }}>
          {effectiveCollapsed ? (
            <>
              <CollapseBtn collapsed={effectiveCollapsed} onToggle={toggle} />
              {mobileCloseBtn}
            </>
          ) : (
            <>
              <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', minWidth: 0, flex: 1 }}>
                <Logo size="sm" showText={true} />
              </Link>
              <CollapseBtn collapsed={effectiveCollapsed} onToggle={toggle} />
              {mobileCloseBtn}
            </>
          )}
        </div>

        {/* Nav — collapsed shows 3 category icons only; expanded shows full accordion */}
        {effectiveCollapsed ? (
          <div style={{ flex: 1, padding: '4px 6px', display: 'flex', flexDirection: 'column' }}>
            <NavItem
              icon={Home}
              label="Overview"
              to={`/projects/${projectId}`}
              collapsed={true}
              active={location.pathname === `/projects/${projectId}`}
            />
            <CategoryIcon
              icon={Code2}
              label={CATEGORIES.find(c => c.id === 'development')?.label ?? 'Development'}
              active={activeCategory === 'development'}
              onClick={() => expandToSection('development')}
            />
            <CategoryIcon
              icon={Boxes}
              label={CATEGORIES.find(c => c.id === 'system')?.label ?? 'System Definition'}
              active={activeCategory === 'system'}
              onClick={() => expandToSection('system')}
            />
            <CategoryIcon
              icon={ShieldCheck}
              label={CATEGORIES.find(c => c.id === 'assurance')?.label ?? 'Assurance'}
              active={activeCategory === 'assurance'}
              onClick={() => expandToSection('assurance')}
            />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 6px' }}>
            <NavItem
              icon={Home}
              label="Overview"
              to={`/projects/${projectId}`}
              collapsed={false}
              active={location.pathname === `/projects/${projectId}`}
            />

            {/* Development */}
            <div
              ref={el => { sectionRefs.current.development = el }}
              style={{
                borderRadius: 6,
                backgroundColor: highlighted === 'development' ? 'var(--theme-accent-subtle)' : 'transparent',
                transition: 'background-color 0.6s ease',
              }}
            >
              <SectionLabel
                label={CATEGORIES.find(c => c.id === 'development')?.label ?? 'Development'}
                sectionKey="development"
                collapsed={false}
                open={sections.development}
                onToggle={toggleSection}
              />
              {sections.development && devModules.map(m => (
                <NavItem
                  key={m.id}
                  icon={m.icon}
                  label={m.label}
                  to={`/projects/${projectId}/${m.route}`}
                  collapsed={false}
                  active={isActive(`/projects/${projectId}/${m.route}`)}
                />
              ))}
            </div>

            {/* System Definition */}
            <div
              ref={el => { sectionRefs.current.system = el }}
              style={{
                borderRadius: 6,
                backgroundColor: highlighted === 'system' ? 'var(--theme-accent-subtle)' : 'transparent',
                transition: 'background-color 0.6s ease',
              }}
            >
              <SectionLabel
                label={CATEGORIES.find(c => c.id === 'system')?.label ?? 'System Definition'}
                sectionKey="system"
                collapsed={false}
                open={sections.system}
                onToggle={toggleSection}
              />
              {sections.system && systemModules.map(m => (
                <NavItem
                  key={m.id}
                  icon={m.icon}
                  label={m.label}
                  to={`/projects/${projectId}/${m.route}`}
                  collapsed={false}
                  active={isActive(`/projects/${projectId}/${m.route}`)}
                />
              ))}
            </div>

            {/* Assurance */}
            <div
              ref={el => { sectionRefs.current.assurance = el }}
              style={{
                borderRadius: 6,
                backgroundColor: highlighted === 'assurance' ? 'var(--theme-accent-subtle)' : 'transparent',
                transition: 'background-color 0.6s ease',
              }}
            >
              <SectionLabel
                label={CATEGORIES.find(c => c.id === 'assurance')?.label ?? 'Assurance'}
                sectionKey="assurance"
                collapsed={false}
                open={sections.assurance}
                onToggle={toggleSection}
              />
              {sections.assurance && assuranceModules.map(m => (
                <NavItem
                  key={m.id}
                  icon={m.icon}
                  label={m.label}
                  to={`/projects/${projectId}/${m.route}`}
                  collapsed={false}
                  active={isActive(`/projects/${projectId}/${m.route}`)}
                />
              ))}
            </div>
          </div>
        )}

        {bottomArea}
      </aside>
    )
  }

  // ---- Global sidebar ----
  return (
    <aside className={asideClassName} style={sidebarStyle}>
      {/* Header */}
      <div style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        padding: effectiveCollapsed ? '0 8px' : '0 6px 0 12px',
        justifyContent: effectiveCollapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--theme-border)',
        flexShrink: 0,
        gap: 6,
      }}>
        {effectiveCollapsed ? (
          <>
            <CollapseBtn collapsed={effectiveCollapsed} onToggle={toggle} />
            {mobileCloseBtn}
          </>
        ) : (
          <>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', minWidth: 0 }}>
              <Logo size="sm" showText={true} />
            </Link>
            <CollapseBtn collapsed={effectiveCollapsed} onToggle={toggle} />
            {mobileCloseBtn}
          </>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 6px' }}>
        <NavItem icon={LayoutDashboard} label="Dashboard" to="/" collapsed={effectiveCollapsed} active={location.pathname === '/'} />
        <NavItem icon={Package} label="Inventory" to="/inventory/items" collapsed={effectiveCollapsed} active={isActive('/inventory')} />
      </div>

      {bottomArea}
    </aside>
  )
}
