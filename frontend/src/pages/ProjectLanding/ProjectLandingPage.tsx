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

// ---------------------------------------------------------------------------
// ModuleCard
// ---------------------------------------------------------------------------

interface ModuleCardProps {
  icon: LucideIcon
  label: string
  description: string
  to: string
  active: boolean
}

function ModuleCard({ icon: Icon, label, description, to, active }: ModuleCardProps) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '14px 16px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
        backgroundColor: active ? 'var(--theme-accent-subtle)' : 'var(--theme-surface)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.12s, box-shadow 0.12s, background-color 0.12s',
        width: '100%',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
        if (!active) el.style.borderColor = 'var(--theme-accent)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.boxShadow = 'none'
        if (!active) el.style.borderColor = 'var(--theme-border)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          backgroundColor: active ? 'var(--theme-accent)' : 'var(--theme-sidebar-item-active)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={15} style={{ color: active ? '#fff' : 'var(--theme-accent)' }} />
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--theme-text)',
          lineHeight: 1.3,
        }}>
          {label}
        </span>
      </div>
      <p style={{
        fontSize: 11,
        color: 'var(--theme-text-muted)',
        margin: 0,
        lineHeight: 1.5,
      }}>
        {description}
      </p>
    </button>
  )
}

// ---------------------------------------------------------------------------
// SectionGroup
// ---------------------------------------------------------------------------

interface SectionGroupProps {
  label: string
  modules: typeof MODULES
  projectId: string
  currentPath: string
}

function SectionGroup({ label, modules, projectId, currentPath }: SectionGroupProps) {
  return (
    <div>
      <h2 style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--theme-text-muted)',
        marginBottom: 10,
        marginTop: 0,
      }}>
        {label}
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 10,
      }}>
        {modules.map(m => (
          <ModuleCard
            key={m.id}
            icon={m.icon}
            label={m.label}
            description={MODULE_DESCRIPTIONS[m.id] ?? ''}
            to={`/projects/${projectId}/${m.route}`}
            active={currentPath.includes(`/${m.route}`)}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>

      {/* Project header */}
      {project && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 8,
          border: '1px solid var(--theme-border)',
          backgroundColor: 'var(--theme-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: statusDot, flexShrink: 0 }} />
              <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--theme-text)', margin: 0 }}>
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
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, maxWidth: 200, height: 4, backgroundColor: 'var(--theme-border)', borderRadius: 2 }}>
                <div style={{ height: 4, width: `${project.progress}%`, backgroundColor: 'var(--theme-accent)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>{project.progress}% complete</span>
              <span style={{
                fontSize: 11,
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
        </div>
      )}

      {/* Module sections */}
      {projectId && (
        <>
          <SectionGroup
            label={CATEGORIES.find(c => c.id === 'development')?.label ?? 'Development & Control'}
            modules={devModules}
            projectId={projectId}
            currentPath={location.pathname}
          />
          <SectionGroup
            label={CATEGORIES.find(c => c.id === 'system')?.label ?? 'System Definition'}
            modules={systemModules}
            projectId={projectId}
            currentPath={location.pathname}
          />
          <SectionGroup
            label={CATEGORIES.find(c => c.id === 'assurance')?.label ?? 'Assurance'}
            modules={assuranceModules}
            projectId={projectId}
            currentPath={location.pathname}
          />
        </>
      )}
    </div>
  )
}
