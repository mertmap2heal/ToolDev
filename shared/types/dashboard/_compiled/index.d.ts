/**
 * Dashboard portfolio aggregate — RF-2 (#484).
 *
 * The shape returned by `GET /api/v1/projects/dashboard-summary` — one
 * composed, visibility-scoped payload for the Verum-refresh Dashboard
 * (`01-dashboard-B.html`). The endpoint is a no-N+1 batched aggregate; this
 * file is the contract between `dashboardSummary.service.ts` and the
 * `DashboardPage` consumer.
 *
 * Reuse / extension points (deliberate — keep these stable):
 *  - RF-3 (Project landing) shares the same aggregate; `projectRollups` is
 *    the per-project surface it reads.
 *  - WF-1 ("Today" inbox) consumes `myQueue`; a future filtered variant of
 *    the endpoint can return the same `QueueItem[]` shape.
 *  - WF-5 (audit-pack readiness) extends `ProjectRollup` with an additive
 *    `auditReadiness` field — do not reshape the existing rollup fields.
 *
 * Type-only — no runtime code, no imports of non-type-only names.
 *
 * Build note: this directory follows the `_compiled/` pattern (see
 * `kb/infrastructure.md` and `shared/incoseEars/`). This `index.ts` is the
 * single source of truth; the frontend imports it directly via the Vite
 * `shared` alias, while the backend imports `_compiled/index.js` (the backend
 * tsconfig has `rootDir=./src` and cannot compile a `.ts` outside `src/`).
 * Regenerate after editing: `cd shared/types/dashboard && npx tsc`.
 */
/** A module-health verdict — drives the tinted `MonoChip` in the table. */
export type HealthLevel = 'ok' | 'warn' | 'danger';
/** A single module-health metric: a count (or null) plus its derived verdict. */
export interface ModuleHealthMetric {
    /** The raw metric value. `null` means "not applicable" (e.g. no test runs). */
    count: number | null;
    /** Service-derived verdict — the frontend renders the tint, derives nothing. */
    health: HealthLevel;
}
/** Lifecycle-gate chip — derived from `Project.currentPhaseId` -> `LifecyclePhase`. */
export interface GateState {
    /** Display code, e.g. `SRR`, `PDR`, `CDR`, `pre-SRR`, `released`. */
    code: string;
    /**
     * Gate disposition. `cleared` = phase entered and progressing; `current` =
     * the active phase; `at-risk` = a blocked/overdue phase; `none` = no phase
     * set (pre-lifecycle); `released` = terminal.
     */
    state: 'cleared' | 'current' | 'at-risk' | 'none' | 'released';
}
/** A team-member summary embedded in a project roll-up (Avatar stack). */
export interface RollupTeamMember {
    userId: string;
    name: string;
    avatarUrl: string | null;
}
/**
 * One row of the dashboard project table — a per-project roll-up over the
 * caller's visible projects. Every module-health field carries a derived
 * `health` so the table is purely presentational.
 */
export interface ProjectRollup {
    projectId: string;
    /** Route key — the project slug, falling back to the id. */
    slug: string;
    name: string;
    /** Free-text business descriptor (`Project.domain`). */
    domain: string;
    status: string;
    /**
     * Project Development Assurance Level, derived from the highest-DAL hazard
     * (`A` highest). `null` when the project has no DAL-bearing hazard.
     */
    dal: string | null;
    /** Completion percentage (`Project.progress`, 0-100). */
    progress: number;
    /** Owner (the project's `userId`) resolved to a display summary. */
    owner: RollupTeamMember | null;
    /** Accepted + pending team members (for the Avatar stack). */
    teamMembers: RollupTeamMember[];
    /** ISO timestamp — `Project.updatedAt`. */
    updatedAt: string;
    /** REQ — count of non-deleted requirements. */
    reqCount: ModuleHealthMetric;
    /**
     * VER — verification coverage percentage. `count` is null when the project
     * has no test-run results (renders the `VER —` cell).
     */
    verCoverage: ModuleHealthMetric;
    /** SUS — count of suspect trace links. */
    suspectCount: ModuleHealthMetric;
    /** ISS — count of open issues. */
    issueCount: ModuleHealthMetric;
    /** HAZ — count of open (non-deleted) hazards. */
    hazardCount: ModuleHealthMetric;
    /** Lifecycle-gate chip. */
    gate: GateState;
}
/** The 6 portfolio KPI cells (`01-dashboard-B.html` lines 189-220). */
export interface DashboardKpis {
    /** Active projects + a delta for the current quarter. */
    activeProjects: {
        count: number;
        deltaThisQuarter: number;
    };
    /** Sign-offs awaiting action across the portfolio. */
    signOffsPending: {
        total: number;
        overdue: number;
        mine: number;
    };
    /** Portfolio-wide verification coverage. */
    verificationCoverage: {
        pct: number;
        deltaPpWeek: number;
    };
    /** Open requirements + the released share + the in-review count. */
    openRequirements: {
        open: number;
        releasedPct: number;
        inReview: number;
    };
    /** Open hazards banded by severity. */
    openHazards: {
        open: number;
        catastrophic: number;
        hazardous: number;
    };
    /** Open issues + the critical count + a weekly delta. */
    openIssues: {
        open: number;
        critical: number;
        deltaWeek: number;
    };
}
/**
 * One item in the caller's "My queue" — something awaiting their action.
 * (WF-1 "Today" inbox consumes this shape.)
 */
export interface QueueItem {
    /** Source artefact kind — `requirement` | `change-request` | `task`. */
    entityType: 'requirement' | 'change-request' | 'task';
    /** Human-readable reference, e.g. `REQ-1024`, `CR-0142`, `TSK-0488`. */
    entityRef: string;
    /** One-line description of the pending action. */
    label: string;
    /** Priority — drives the queue-row dot. */
    priority: 'critical' | 'high' | 'medium';
    /** Age of the item in milliseconds (now - createdAt). */
    ageMs: number;
    /** The owning project id (for deep-linking + scoping). */
    projectId: string;
}
/** One row of the cross-project Activity feed (recent `AuditLog`). */
export interface ActivityItem {
    /** Acting user's display name (falls back to a generic label). */
    actor: string;
    /** The raw audit action string. */
    action: string;
    /** A human-readable summary of what happened. */
    summary: string;
    /** Owning project id + name. */
    projectId: string;
    projectName: string;
    /** Visual tone — mapped from the action verb. */
    tone: 'success' | 'warn' | 'danger' | 'info' | 'neutral';
    /** ISO timestamp — `AuditLog.createdAt`. */
    timestamp: string;
}
/** The full dashboard-summary payload. */
export interface DashboardSummary {
    kpis: DashboardKpis;
    /** One roll-up per visible project, newest-updated first. */
    projectRollups: ProjectRollup[];
    /** The caller's pending sign-offs / reviews / assignments. */
    myQueue: QueueItem[];
    /** Recent activity across the caller's visible projects. */
    activityFeed: ActivityItem[];
}
/**
 * One of the five discipline progress bars in the project-landing hero.
 *
 * `pct` is `null` when the discipline has no real signal yet (e.g. a project
 * with zero requirements has no Requirements completion percentage) — the
 * frontend renders an em-dash, NEVER `0%`. The bands are documented in the
 * service; the frontend renders the tint, derives nothing.
 */
export interface DisciplineProgress {
    /** Discipline key, fixed identity. */
    key: 'overall' | 'requirements' | 'verification' | 'safety' | 'certification';
    /** Display label, e.g. `Requirements`. */
    label: string;
    /** Completion percentage 0-100, or `null` when there is no real signal. */
    pct: number | null;
    /** Service-derived verdict — drives the bar tint. */
    health: HealthLevel;
}
/**
 * A per-module health sub-row on a `ModuleCard`. `moduleId` matches the
 * `ModuleConfiguration` `ModuleDefinition.id`. A module with no real signal is
 * simply absent from `ProjectLandingSummary.moduleHealth` — the card then
 * renders no stats value and no sub-row (the deliberately asymmetric card set).
 * `segments` empty likewise renders no sub-row.
 */
export interface ModuleHealthRow {
    /** Module id — matches `ModuleConfiguration` `ModuleDefinition.id`. */
    moduleId: string;
    /**
     * The headline stat value rendered in the card's stats slot (e.g. `1247`,
     * `72%`, `6`). `null` -> the card renders no stats value.
     */
    headline: string | null;
    /** Health verdict of the headline value — drives the stats-value tint. */
    headlineHealth: HealthLevel;
    /** The sub-row segments. Empty -> no sub-row. */
    segments: {
        text: string;
        health: HealthLevel;
    }[];
}
/** The full project-landing-summary payload. */
export interface ProjectLandingSummary {
    projectId: string;
    /** Route key — the project slug, falling back to the id. */
    slug: string;
    name: string;
    /** Free-text business descriptor (`Project.domain`). */
    domain: string;
    status: string;
    /**
     * Project Development Assurance Level, derived from the highest-DAL hazard
     * (`A` highest). `null` when the project has no DAL-bearing hazard.
     */
    dal: string | null;
    /** Current lifecycle-phase name, or `null` when no phase is set. */
    phase: string | null;
    /** Lifecycle-gate chip. */
    gate: GateState;
    /** Project owner resolved to a display summary. */
    owner: RollupTeamMember | null;
    /** Accepted + pending team members. */
    teamMembers: RollupTeamMember[];
    /** ISO timestamp — `Project.updatedAt`. */
    updatedAt: string;
    /** The five discipline progress bars, fixed order. */
    disciplines: DisciplineProgress[];
    /** Per-module health rows — only for modules with a real signal. */
    moduleHealth: ModuleHealthRow[];
}
