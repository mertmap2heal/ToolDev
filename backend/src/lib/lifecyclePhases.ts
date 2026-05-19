/**
 * Standard lifecycle catalogue (ROADMAP NX-11; issue #474).
 *
 * The single source of truth for the seeded `standard` lifecycle catalogue.
 * Mirrors the `standards` array that the frontend `LifecycleManagementPage`
 * previously lazy-seeded into the localStorage-backed Zustand store — that
 * lazy-seed is removed; this catalogue is seeded server-side instead.
 *
 * Consumed by `seed-lifecycle-phases.ts`. Each phase carries a stable
 * `seedKey` (`<lifecycleKey>::<name>`) so the seed is idempotent
 * (upsert-by-seedKey). `lifecycleKey` groups phases into one ordered
 * lifecycle; `orderIndex` is the sequence; `isInitial` marks the entry phase.
 *
 * Transitions: each catalogue lifecycle is a linear chain plus the explicit
 * branch edges (e.g. Verified -> Fail). `allowedEngineeringRoleIds` is left
 * empty for the standard catalogue — a project layers role gating onto its
 * own custom lifecycles.
 */

export interface StandardLifecyclePhaseSeed {
  /** Phase display name; also the second half of the stable seedKey. */
  name: string
  /** statusId — loose FK into the status catalogue (kept loose per NX-11). */
  statusId: string
  /** Entry phase of the lifecycle. Exactly one per lifecycle. */
  isInitial?: boolean
}

export interface StandardLifecycleSeed {
  /** Stable lifecycle identity — the store's `Lifecycle.id`. */
  lifecycleKey: string
  name: string
  description: string
  version: string
  applicableItemTypes: string[]
  phases: StandardLifecyclePhaseSeed[]
  /**
   * Extra (non-sequential) transition edges by phase name. The linear
   * chain phase[i] -> phase[i+1] is generated automatically; list only the
   * branch / back edges here.
   */
  extraTransitions?: Array<{ from: string; to: string }>
}

export const STANDARD_LIFECYCLES: StandardLifecycleSeed[] = [
  {
    lifecycleKey: 'std-arp4754a',
    name: 'ARP4754A System Development',
    description:
      'Aircraft system development lifecycle per SAE ARP4754A. Covers system requirements, architecture, implementation, verification and validation.',
    version: '1.0',
    applicableItemTypes: ['Requirement', 'Function', 'Task'],
    phases: [
      { name: 'Proposed', statusId: 'proposed', isInitial: true },
      { name: 'Draft', statusId: 'draft' },
      { name: 'In Review', statusId: 'in-review' },
      { name: 'Approved', statusId: 'approved' },
      { name: 'Baselined', statusId: 'baselined' },
      { name: 'In Implementation', statusId: 'in-implementation' },
      { name: 'Verified', statusId: 'verified' },
      { name: 'Validated', statusId: 'validated' },
      { name: 'Released', statusId: 'released' },
    ],
  },
  {
    lifecycleKey: 'std-do178c',
    name: 'DO-178C Software Development',
    description:
      'Software development lifecycle for airborne systems per RTCA DO-178C. Covers planning, requirements, design, coding, integration and verification.',
    version: '1.0',
    applicableItemTypes: ['Requirement', 'Task', 'Issue'],
    phases: [
      { name: 'Planning', statusId: 'planning', isInitial: true },
      { name: 'Requirements', statusId: 'requirements' },
      { name: 'Design', statusId: 'design' },
      { name: 'Implementation', statusId: 'implementation' },
      { name: 'Integration', statusId: 'integration' },
      { name: 'Verification', statusId: 'verification' },
      { name: 'Certification', statusId: 'certification' },
      { name: 'Released', statusId: 'released' },
    ],
  },
  {
    lifecycleKey: 'std-do254',
    name: 'DO-254 Hardware Development',
    description:
      'Hardware development assurance lifecycle for airborne electronic systems per RTCA DO-254.',
    version: '1.0',
    applicableItemTypes: ['Requirement', 'Task'],
    phases: [
      { name: 'Concept', statusId: 'concept', isInitial: true },
      { name: 'Requirements', statusId: 'requirements' },
      { name: 'Design', statusId: 'design' },
      { name: 'Implementation', statusId: 'implementation' },
      { name: 'Production Transition', statusId: 'production-transition' },
      { name: 'Verification', statusId: 'verification' },
      { name: 'Acceptance', statusId: 'acceptance' },
    ],
  },
  {
    lifecycleKey: 'std-requirement',
    name: 'Requirements Lifecycle',
    description:
      'Standard lifecycle for engineering requirements management - from elicitation through baselined approval and obsolescence.',
    version: '1.0',
    applicableItemTypes: ['Requirement'],
    phases: [
      { name: 'Proposed', statusId: 'proposed', isInitial: true },
      { name: 'Draft', statusId: 'draft' },
      { name: 'In Review', statusId: 'in-review' },
      { name: 'Approved', statusId: 'approved' },
      { name: 'Baselined', statusId: 'baselined' },
      { name: 'Obsolete', statusId: 'obsolete' },
    ],
  },
  {
    lifecycleKey: 'std-verification',
    name: 'Verification & Test Lifecycle',
    description:
      'Lifecycle for test cases, test plans and verification activities covering definition through closure.',
    version: '1.0',
    applicableItemTypes: ['Task', 'Issue'],
    phases: [
      { name: 'Draft', statusId: 'draft', isInitial: true },
      { name: 'Ready', statusId: 'ready' },
      { name: 'In Execution', statusId: 'in-execution' },
      { name: 'Pass', statusId: 'pass' },
      { name: 'Fail', statusId: 'fail' },
      { name: 'Closed', statusId: 'closed' },
    ],
    extraTransitions: [
      { from: 'In Execution', to: 'Fail' },
      { from: 'Fail', to: 'In Execution' },
      { from: 'Pass', to: 'Closed' },
    ],
  },
  {
    lifecycleKey: 'std-change-request',
    name: 'Change Request Lifecycle',
    description:
      'Lifecycle for engineering change requests from submission through disposition and implementation.',
    version: '1.0',
    applicableItemTypes: ['Change Request'],
    phases: [
      { name: 'Submitted', statusId: 'submitted', isInitial: true },
      { name: 'Under Review', statusId: 'under-review' },
      { name: 'Impact Assessment', statusId: 'impact-assessment' },
      { name: 'Approved', statusId: 'approved' },
      { name: 'In Implementation', statusId: 'in-implementation' },
      { name: 'Verified', statusId: 'verified' },
      { name: 'Closed', statusId: 'closed' },
      { name: 'Rejected', statusId: 'rejected' },
    ],
    extraTransitions: [
      { from: 'Under Review', to: 'Rejected' },
      { from: 'Impact Assessment', to: 'Rejected' },
    ],
  },
]

/** Build the stable per-phase seed key: `<lifecycleKey>::<phaseName>`. */
export function phaseSeedKey(lifecycleKey: string, phaseName: string): string {
  return `${lifecycleKey}::${phaseName}`
}
