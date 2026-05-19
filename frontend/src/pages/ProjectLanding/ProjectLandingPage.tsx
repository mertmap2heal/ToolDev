/**
 * Project Landing page — RF-3 (#487).
 *
 * Restyled to `improvements/verum-design-system/project/refresh/02-project-landing-A.html`
 * (variant A): a hero card carrying the project identity, a metadata grid, and
 * five discipline progress bars; below it the 3-column V-model navigator the
 * page has always had — enriched, not replaced — with per-module health
 * sub-rows.
 *
 * Built on the RF-1 `@/components/ui` primitives + `--theme-*` tokens — no raw
 * hex, no `blue-*`/`indigo-*`/`purple-*`. Data source: the RF-3 aggregate
 * `GET /api/v1/projects/:id/landing-summary` (membership-scoped server-side).
 *
 * Every pre-existing behaviour is preserved: `useFeaturePackage().isEnabled()`
 * per-module filtering, module navigation/routing, the `MODULES` / `CATEGORIES`
 * config, and deep links. The legacy bare `location.pathname` reference is
 * fixed to `useLocation()`.
 */
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { MODULES, CATEGORIES, type ModuleCategory } from '../../config/ModuleConfiguration'
import { useFeaturePackage } from '../../contexts/FeaturePackageContext'
import { projectService } from '../../services/project.service'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import ErrorMessage from '../../components/common/ErrorMessage'
import { Card, Avatar, DalChip, MonoChip, Button, MONO_FONT, FOCUS_RING } from '../../components/ui'
import type { Dal } from '../../components/ui'
import type {
  ProjectLandingSummary,
  DisciplineProgress,
  ModuleHealthRow,
  HealthLevel,
  GateState,
} from 'shared/types/dashboard/index'

// ---------------------------------------------------------------------------
// Module metadata — terse engineer-voice phrases for the card sub-line.
// ---------------------------------------------------------------------------

const MODULE_DESCRIPTIONS: Record<string, string> = {
  'requirements': 'define · trace · review',
  'tasks': 'backlog · in progress',
  'change-requests': 'propose · review',
  'issues': 'defects · blockers',
  'documentation': 'SDP · SVP · evidence packs',
  'lifecycle-status': 'phase gates · transitions',
  'configuration-management': 'baselines · CIs · releases',
  'archive': 'archived items · retention',
  'stakeholder': 'RACI · roles',
  'product-breakdown-structure': 'PBS · sub-systems',
  'mbse-models': 'SysML · diagrams',
  'functions': 'behaviour · allocation',
  'interface-management': 'ICDs · contracts',
  'parameters': 'numeric inputs · formulas',
  'verification': 'A/T/I/D · test runs',
  'validation': 'objectives · sign-off',
  'safety-analysis': 'FHA · FTA · Markov',
  'risk-management': '5×5 · ALARP',
  'compliance-check': 'standards objectives',
  'certification': 'objectives · evidence',
  'audit': 'project audit log',
}

// ---------------------------------------------------------------------------
// Category accent tokens — V-model column tones (no raw hex, R-9).
// ---------------------------------------------------------------------------

interface CategoryTone {
  accent: string
  accentTint: string
}

const CATEGORY_TONE: Record<ModuleCategory, CategoryTone> = {
  development: { accent: 'var(--theme-accent)', accentTint: 'var(--theme-info-tint)' },
  system: { accent: 'var(--theme-purple)', accentTint: 'var(--theme-purple-tint)' },
  assurance: { accent: 'var(--theme-teal)', accentTint: 'var(--theme-teal-tint)' },
}

// ---------------------------------------------------------------------------
// Page-local presentational helpers.
// ---------------------------------------------------------------------------

/** Health verdict -> a discipline-bar / sub-row text colour token. */
function healthInk(health: HealthLevel): string {
  if (health === 'warn') return 'var(--theme-warning-ink)'
  if (health === 'danger') return 'var(--status-danger)'
  return 'var(--theme-teal)'
}

/** Health verdict -> a progress-bar FILL colour token. */
function barFill(health: HealthLevel): string {
  if (health === 'warn') return 'var(--theme-warning-ink)'
  if (health === 'danger') return 'var(--status-danger)'
  return 'var(--theme-accent)'
}

/** Health verdict -> a module-card stats-value colour token. */
function statsInk(health: HealthLevel): string {
  if (health === 'warn') return 'var(--theme-warning-ink)'
  if (health === 'danger') return 'var(--status-danger)'
  return 'var(--theme-text)'
}

/** A status string -> the hero status-dot colour. */
function statusDotColor(status: string): string {
  if (status === 'active') return 'var(--theme-teal)'
  if (status === 'planning') return 'var(--theme-warning-ink)'
  return 'var(--theme-text-muted)'
}

/** Gate state -> the `MonoChip` tint for the "Next gate" metadata chip. */
function gateChipTint(state: GateState['state']): 'default' | 'green' | 'amber' | 'red' {
  if (state === 'released' || state === 'cleared') return 'green'
  if (state === 'at-risk') return 'red'
  if (state === 'current') return 'amber'
  return 'default'
}

/** A compact relative-time string for the "Last sync" metadata cell. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d} d ago`
  return new Date(iso).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// ProgressBar — page-local, health-tinted, null-aware.
//
// NOT the RF-2 `atRisk` ProgressBar — a discipline percentage can be `null`
// (no real signal yet), which renders an em-dash and an empty track. Kept
// page-local per the visual spec; do not promote to `components/ui/`.
// ---------------------------------------------------------------------------

function ProgressBar({
  pct,
  health,
  label,
}: {
  pct: number | null
  health: HealthLevel
  label: string
}) {
  const known = pct !== null
  const clamped = known ? Math.max(0, Math.min(100, pct)) : 0
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      {...(known
        ? { 'aria-valuenow': clamped }
        : { 'aria-label': `${label} progress — no data` })}
      style={{
        width: 160,
        height: 5,
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
        display: 'inline-block',
        background: known ? 'var(--theme-surface)' : 'var(--theme-neutral-tint)',
      }}
    >
      {known && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${clamped}%`,
            borderRadius: 3,
            background: barFill(health),
          }}
        />
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// ModuleCard — a plain bordered card with a tinted icon tile + optional
// per-module health sub-row.
// ---------------------------------------------------------------------------

interface ModuleCardProps {
  icon: LucideIcon
  label: string
  description: string
  to: string
  accent: string
  accentTint: string
  /** The module-health row for this module, when one exists. */
  health?: ModuleHealthRow
}

function ModuleCard({
  icon: Icon,
  label,
  description,
  to,
  accent,
  accentTint,
  health,
}: ModuleCardProps) {
  const navigate = useNavigate()
  const segments = health?.segments ?? []
  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(to)}
        aria-label={`Open ${label}`}
        onMouseEnter={(e) => {
          const el = e.currentTarget
          el.style.background = 'var(--theme-surface)'
          el.style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget
          el.style.background = 'var(--theme-bg)'
          el.style.borderColor = 'var(--theme-border)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = FOCUS_RING
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none'
        }}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 12px',
          border: '1px solid var(--theme-border)',
          borderRadius: 6,
          background: 'var(--theme-bg)',
          cursor: 'pointer',
          transition: 'background-color 80ms ease-out, border-color 80ms ease-out',
        }}
      >
        {/* Tinted icon tile */}
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 5,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: accentTint,
          }}
        >
          <Icon size={15} color={accent} strokeWidth={1.75} />
        </span>
        {/* Body */}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--theme-text)',
              lineHeight: 1.3,
            }}
          >
            {label}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--theme-text-muted)',
              lineHeight: 1.4,
            }}
          >
            {description}
          </span>
        </span>
        {/* Stats — headline value (only when the module has a real signal) + chevron */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {health?.headline != null && (
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 11,
                color: statsInk(health.headlineHealth),
              }}
            >
              {health.headline}
            </span>
          )}
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            color="var(--theme-text-muted)"
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Per-module health sub-row — only when the module has segments. */}
      {segments.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
            marginTop: 4,
            paddingLeft: 38,
            fontFamily: MONO_FONT,
            fontSize: 10.5,
          }}
        >
          {segments.map((seg, i) => (
            <span key={`${seg.text}-${i}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {i > 0 && (
                <span style={{ color: 'var(--theme-text-muted)', marginRight: 6 }}>·</span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', color: healthInk(seg.health) }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: 'currentColor',
                    marginRight: 4,
                    display: 'inline-block',
                  }}
                />
                {seg.text}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column — one vertical V-model category column.
// ---------------------------------------------------------------------------

interface ColumnProps {
  label: string
  modules: typeof MODULES
  projectId: string
  tone: CategoryTone
  /** moduleId -> ModuleHealthRow lookup. */
  healthByModule: Map<string, ModuleHealthRow>
}

function Column({ label, modules, projectId, tone, healthByModule }: ColumnProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 6,
          background: 'var(--theme-bg)',
          border: '1px solid var(--theme-border)',
          borderTop: `2px solid ${tone.accent}`,
          marginBottom: 4,
        }}
      >
        <span
          aria-hidden="true"
          style={{ width: 10, height: 10, borderRadius: 2, background: tone.accent }}
        />
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--theme-text)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: MONO_FONT,
            fontSize: 11,
            color: 'var(--theme-text-muted)',
            background: 'var(--theme-neutral-tint)',
            padding: '1px 7px',
            borderRadius: 999,
          }}
        >
          {modules.length}
        </span>
      </div>

      {/* Module cards */}
      {modules.map((m) => (
        <ModuleCard
          key={m.id}
          icon={m.icon}
          label={m.label}
          description={MODULE_DESCRIPTIONS[m.id] ?? ''}
          to={`/projects/${projectId}/${m.route}`}
          accent={tone.accent}
          accentTint={tone.accentTint}
          health={healthByModule.get(m.id)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero — project identity + metadata grid + 5 discipline progress bars.
// ---------------------------------------------------------------------------

function HeroCard({ summary }: { summary: ProjectLandingSummary }) {
  return (
    <Card>
      <div
        style={{
          padding: '18px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
        }}
      >
        {/* LEFT — identity + metadata */}
        <div>
          <h2
            style={{
              margin: '0 0 4px',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.012em',
              color: 'var(--theme-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            title={`Status: ${summary.status}`}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                flexShrink: 0,
                background: statusDotColor(summary.status),
              }}
            />
            {summary.name}
          </h2>

          {/* Mono sub-line: domain · DAL · phase */}
          <div
            style={{
              fontFamily: MONO_FONT,
              fontSize: 12,
              color: 'var(--theme-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <span>{summary.domain}</span>
            <span style={{ color: 'var(--theme-text-muted)' }}>·</span>
            {summary.dal ? (
              <DalChip dal={summary.dal as Dal} />
            ) : (
              <span style={{ color: 'var(--theme-text-muted)' }}>DAL —</span>
            )}
          </div>

          {/* Metadata grid */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 14,
              paddingTop: 14,
              borderTop: '1px solid var(--theme-border)',
              flexWrap: 'wrap',
            }}
          >
            <MetaCell label="Owner">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {summary.owner ? (
                  <>
                    <Avatar name={summary.owner.name} size={18} />
                    {summary.owner.name}
                  </>
                ) : (
                  '—'
                )}
              </span>
            </MetaCell>
            <MetaCell label="Phase">{summary.phase ?? '—'}</MetaCell>
            <MetaCell label="Next gate">
              <MonoChip tint={gateChipTint(summary.gate.state)}>{summary.gate.code}</MonoChip>
            </MetaCell>
            <MetaCell label="Last sync">{relativeTime(summary.updatedAt)}</MetaCell>
            <MetaCell label="Team">
              {summary.teamMembers.length} member{summary.teamMembers.length === 1 ? '' : 's'}
            </MetaCell>
          </div>
        </div>

        {/* RIGHT — 5 discipline progress bars */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            minWidth: 220,
          }}
        >
          {summary.disciplines.map((d: DisciplineProgress) => (
            <div
              key={d.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: MONO_FONT,
                fontSize: 11,
              }}
            >
              <span style={{ width: 88, color: 'var(--theme-text-muted)' }}>{d.label}</span>
              <ProgressBar pct={d.pct} health={d.health} label={d.label} />
              <span
                style={{
                  minWidth: 38,
                  textAlign: 'right',
                  fontWeight: 500,
                  color: 'var(--theme-text)',
                }}
              >
                {d.pct === null ? '—' : `${d.pct}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/** A single label/value cell in the hero metadata grid. */
function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span
        style={{
          fontSize: 11,
          color: 'var(--theme-text-muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--theme-text)', fontFamily: MONO_FONT }}>
        {children}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectLandingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  // Fixes the legacy bare `location.pathname` reference — `useLocation` is the
  // React-Router hook; a free `location` was the global `window.location`.
  useLocation()
  const { isEnabled } = useFeaturePackage()

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['project-landing-summary', projectId],
    queryFn: async () => {
      const response = await projectService.getProjectLandingSummary(projectId!)
      if (!response.success) {
        throw new Error(response.error || 'Failed to load project')
      }
      return response.data ?? null
    },
    enabled: Boolean(projectId),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  // moduleId -> ModuleHealthRow lookup for the per-module sub-rows.
  const healthByModule = new Map<string, ModuleHealthRow>(
    (summary?.moduleHealth ?? []).map((row) => [row.moduleId, row]),
  )

  // --- States — gate the whole body on the summary query ---

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <LoadingSpinner label="Loading project…" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ padding: 16 }}>
            <ErrorMessage
              message={error instanceof Error ? error.message : 'Error loading project.'}
              inline
            />
            <p style={{ color: 'var(--theme-text-muted)', fontSize: 12, marginBottom: 12 }}>
              Check that the backend is running, the database is connected, and you are logged
              in.
            </p>
            <Button variant="primary" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!summary) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--theme-text-muted)', fontSize: 13, marginBottom: 12 }}>
              Project not found. It may have been deleted, or the link is wrong.
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Back to portfolio
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // --- Body — hero + 3-column V-model navigator ---

  const devModules = MODULES.filter((m) => m.category === 'development' && isEnabled(m.id))
  const systemModules = MODULES.filter((m) => m.category === 'system' && isEnabled(m.id))
  const assuranceModules = MODULES.filter((m) => m.category === 'assurance' && isEnabled(m.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeroCard summary={summary} />

      {projectId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
          <Column
            label={CATEGORIES.find((c) => c.id === 'development')?.label ?? 'Development & Control'}
            modules={devModules}
            projectId={projectId}
            tone={CATEGORY_TONE.development}
            healthByModule={healthByModule}
          />
          <Column
            label={CATEGORIES.find((c) => c.id === 'system')?.label ?? 'System Definition'}
            modules={systemModules}
            projectId={projectId}
            tone={CATEGORY_TONE.system}
            healthByModule={healthByModule}
          />
          <Column
            label={CATEGORIES.find((c) => c.id === 'assurance')?.label ?? 'Assurance'}
            modules={assuranceModules}
            projectId={projectId}
            tone={CATEGORY_TONE.assurance}
            healthByModule={healthByModule}
          />
        </div>
      )}
    </div>
  )
}
