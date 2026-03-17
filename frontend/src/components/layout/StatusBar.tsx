import { useLocation, useParams } from 'react-router-dom'
import { FolderOpen, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useThemeStore } from '../../store/themeStore'
import { useProjectStore } from '../../store/projectStore'
import { MODULES } from '../../config/ModuleConfiguration'

export default function StatusBar() {
  const location = useLocation()
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { projects, currentProject } = useProjectStore()

  // Resolve project name
  const project =
    currentProject?.id === projectId
      ? currentProject
      : projects.find((p) => p.id === projectId)
  const projectName = project?.name ?? (projectId ? 'Project' : 'No project')

  // Derive current module from pathname
  const matchedModule = MODULES.find((m) => {
    if (!projectId) return false
    return location.pathname.includes(`/${m.route}`)
  })
  const moduleName = matchedModule?.label ?? ''

  const barStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: 24,
    padding: '0 12px',
    gap: 12,
    flexShrink: 0,
    fontSize: 11,
    color: 'var(--theme-text-muted)',
    backgroundColor: 'var(--theme-sidebar)',
    borderTop: '1px solid var(--theme-border)',
    userSelect: 'none',
  }

  return (
    <div style={barStyle}>
      {/* Left: project + module */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <FolderOpen size={11} />
        <span>{projectName}</span>
      </span>

      {moduleName && (
        <>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ fontFamily: 'monospace' }}>{moduleName}</span>
        </>
      )}

      {/* Stretch */}
      <span style={{ flex: 1 }} />

      {/* Right: user + online dot + theme toggle */}
      {user && (
        <span style={{ opacity: 0.8 }}>
          {user.name ?? user.email}
        </span>
      )}

      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: 'var(--theme-accent)',
          display: 'inline-block',
        }} />
        Online
      </span>

      <button
        onClick={toggleTheme}
        title={theme === 'midnight' ? 'Switch to light theme' : 'Switch to dark theme'}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--theme-text-muted)',
          padding: 0,
        }}
      >
        {theme === 'midnight' ? <Sun size={11} /> : <Moon size={11} />}
      </button>
    </div>
  )
}
