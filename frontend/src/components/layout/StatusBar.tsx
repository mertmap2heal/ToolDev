/**
 * StatusBar — the always-on bottom chrome strip.
 *
 * RF-1: re-skinned to the refresh `_chrome.css` `.statusbar` look — a 28px
 * strip on `--theme-surface`, a `Live` pill with a leading green dot, the
 * `b`-weight project name, and a right group.
 *
 * Data discipline (RF-1 / Architect): only cells with a real data source are
 * rendered — project, module, user, online indicator, theme toggle. The
 * `_chrome.html` prototype's baseline / branch+SHA / version cells have no
 * data source in the app today and are deliberately OMITTED, not fabricated.
 * It is a passive strip — its only control is the theme toggle (no focus trap).
 */
import { useLocation, useParams } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
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

  // Resolve project name from the store (the data source).
  const project =
    currentProject?.id === projectId
      ? currentProject
      : projects.find((p) => p.id === projectId)
  const projectName = project?.name ?? (projectId ? 'Project' : 'No project')

  // Derive the current module from the pathname.
  const matchedModule = MODULES.find((m) => {
    if (!projectId) return false
    return location.pathname.includes(`/${m.route}`)
  })
  const moduleName = matchedModule?.label ?? ''

  const barStyle: React.CSSProperties = {
    alignItems: 'center',
    height: 28,
    padding: '0 16px',
    gap: 16,
    flexShrink: 0,
    fontSize: 12,
    color: 'var(--theme-text-muted)',
    backgroundColor: 'var(--theme-surface)',
    borderTop: '1px solid var(--theme-border)',
    userSelect: 'none',
  }

  return (
    <div className="hidden sm:flex" style={barStyle}>
      {/* Live indicator — leading green dot (`.statusbar .live`) */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: 'var(--theme-teal)',
            display: 'inline-block',
          }}
        />
        Live
      </span>

      {/* Project name — `b`-weight per the refresh chrome */}
      <span>
        Project{' '}
        <b style={{ color: 'var(--theme-text)', fontWeight: 500 }}>{projectName}</b>
      </span>

      {/* Current module */}
      {moduleName && (
        <span
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            fontSize: 11.5,
          }}
        >
          {moduleName}
        </span>
      )}

      {/* Right group — user · online · theme toggle */}
      <span
        style={{
          marginLeft: 'auto',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
        }}
      >
        {user && <span>{user.name ?? user.email}</span>}

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: 'var(--theme-teal)',
              display: 'inline-block',
            }}
          />
          Online
        </span>

        <button
          onClick={toggleTheme}
          aria-label={
            theme === 'midnight' ? 'Switch to light theme' : 'Switch to dark theme'
          }
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
          {theme === 'midnight' ? <Sun size={12} /> : <Moon size={12} />}
        </button>
      </span>
    </div>
  )
}
