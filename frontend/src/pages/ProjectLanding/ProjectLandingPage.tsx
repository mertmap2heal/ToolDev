import { useNavigate, useParams } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'
import { MODULES, CATEGORIES } from '../../config/ModuleConfiguration'
import { useProjectStore } from '../../store/projectStore'

// ---------------------------------------------------------------------------
// Short descriptions per module
// ---------------------------------------------------------------------------

const MODULE_DESCRIPTIONS: Record<string, string> = {
  'requirements':               'Define, trace and manage requirements',
  'tasks':                      'Track work items and assignments',
  'change-requests':            'Propose and review change requests',
  'issues':                     'Capture and resolve project issues',
  'documentation':              'Author and manage documents',
  'lifecycle-status':           'Monitor phase gates and lifecycle state',
  'configuration-management':   'Manage baselines, releases and CIs',
  'archive':                    'Browse archived items',
  'stakeholder':                'Manage stakeholders and RACI matrix',
  'product-breakdown-structure':'Define and navigate product structure',
  'mbse-models':                'MBSE models, diagrams and use cases',
  'functions':                  'Define system and sub-system functions',
  'interface-management':       'Manage internal and external interfaces',
  'parameters':                 'Define and track system parameters',
  'verification':               'Plan and execute verification activities',
  'validation':                 'Validate system against objectives',
  'safety-analysis':            'Identify and analyse safety hazards',
  'risk-management':            'Track and mitigate project risks',
  'compliance-check':           'Verify compliance against standards',
  'certification':              'Manage certification objectives and evidence',
  'audit':                      'Browse the full project audit log',
}

// Column accent colors per category
const CATEGORY_ACCENT: Record<string, string> = {
  development: 'var(--theme-accent)',
  system:      '#8b5cf6',
  assurance:   '#10b981',
}

// ---------------------------------------------------------------------------
// ModuleCard — compact row style for columns
// ---------------------------------------------------------------------------

interface ModuleCardProps {
  icon: LucideIcon
  label: string
  description: string
  to: string
  active: boolean
  accent: string
}

function ModuleCard({ icon: Icon, label, description, to, active, accent }: ModuleCardProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 6,
        border: '1px solid var(--theme-border)',
        borderLeft: `3px solid ${active ? accent : 'var(--theme-border)'}`,
        backgroundColor: active ? 'var(--theme-accent-subtle)' : 'var(--theme-surface)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'border-left-color 0.12s, box-shadow 0.12s, background-color 0.12s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.10)'
        el.style.borderLeftColor = accent
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = 'none'
        el.style.borderLeftColor = active ? accent : 'var(--theme-border)'
      }}
    >
      <div style={{
        width: 26,
        height: 26,
        borderRadius: 5,
        backgroundColor: active ? accent : 'var(--theme-sidebar-item-active)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}>
        <Icon size={13} style={{ color: active ? '#fff' : accent }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text)', lineHeight: 1.3, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--theme-text-muted)', lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Column — one vertical category column
// ---------------------------------------------------------------------------

interface ColumnProps {
  categoryId: string
  label: string
  modules: typeof MODULES
  projectId: string
  accent: string
}

function Column({ categoryId, label, modules, projectId, accent }: ColumnProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      minWidth: 0,
    }}>
      {/* Column header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: '8px 8px 0 0',
        backgroundColor: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        borderBottom: `2px solid ${accent}`,
        marginBottom: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: accent, flexShrink: 0 }} />
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--theme-text)',
        }}>
          {label}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: 'var(--theme-text-muted)',
          backgroundColor: 'var(--theme-sidebar-item-active)',
          borderRadius: 10,
          padding: '1px 7px',
        }}>
          {modules.length}
        </span>
      </div>

      {/* Module cards stacked vertically */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {modules.map(m => (
          <ModuleCard
            key={m.id}
            icon={m.icon}
            label={m.label}
            description={MODULE_DESCRIPTIONS[m.id] ?? ''}
            to={`/projects/${projectId}/${m.route}`}
            active={location.pathname.includes(`/${m.route}`)}
            accent={accent}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectLandingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { projects } = useProjectStore()
  const project = projects.find(p => p.id === projectId)

  const devModules       = MODULES.filter(m => m.category === 'development')
  const systemModules    = MODULES.filter(m => m.category === 'system')
  const assuranceModules = MODULES.filter(m => m.category === 'assurance')

  const statusColors: Record<string, string> = {
    active:    '#22c55e',
    completed: 'var(--theme-accent)',
    archived:  'var(--theme-text-muted)',
    planning:  '#f59e0b',
  }
  const statusDot = statusColors[project?.status ?? ''] ?? 'var(--theme-text-muted)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Project header */}
      {project && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 8,
          border: '1px solid var(--theme-border)',
          backgroundColor: 'var(--theme-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: statusDot, flexShrink: 0 }} />
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>
            {project.name}
          </h1>
          {project.domain && (
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 10,
              backgroundColor: 'var(--theme-sidebar-item-active)',
              color: 'var(--theme-text-muted)',
            }}>
              {project.domain}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <div style={{ width: 120, height: 4, backgroundColor: 'var(--theme-border)', borderRadius: 2 }}>
              <div style={{ height: 4, width: `${project.progress}%`, backgroundColor: 'var(--theme-accent)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', whiteSpace: 'nowrap' }}>
              {project.progress}% complete
            </span>
            <span style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 10,
              textTransform: 'capitalize',
              backgroundColor: project.status === 'active' ? 'rgba(34,197,94,0.12)' : 'var(--theme-sidebar-item-active)',
              color: project.status === 'active' ? '#22c55e' : 'var(--theme-text-muted)',
            }}>
              {project.status}
            </span>
          </div>
        </div>
      )}

      {/* Three-column V-model style layout */}
      {projectId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Column
            categoryId="development"
            label={CATEGORIES.find(c => c.id === 'development')?.label ?? 'Development & Control'}
            modules={devModules}
            projectId={projectId}
            accent={CATEGORY_ACCENT.development}
          />
          <Column
            categoryId="system"
            label={CATEGORIES.find(c => c.id === 'system')?.label ?? 'System Definition'}
            modules={systemModules}
            projectId={projectId}
            accent={CATEGORY_ACCENT.system}
          />
          <Column
            categoryId="assurance"
            label={CATEGORIES.find(c => c.id === 'assurance')?.label ?? 'Assurance'}
            modules={assuranceModules}
            projectId={projectId}
            accent={CATEGORY_ACCENT.assurance}
          />
        </div>
      )}
    </div>
  )
}
