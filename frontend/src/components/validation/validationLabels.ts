import type {
  ValidationMethodType,
  ValidationMilestone,
  ValidationStatus,
  CriterionOutcome,
} from '../../services/validation.service'

export const METHOD_LABEL: Record<ValidationMethodType, string> = {
  DEMONSTRATION: 'Demonstration',
  OPERATIONAL_TEST: 'Operational Test',
  SIMULATION: 'Simulation',
  ANALYSIS: 'Analysis',
  STAKEHOLDER_ACCEPTANCE: 'Stakeholder Acceptance',
}

export const METHOD_TOOLTIP: Record<ValidationMethodType, string> = {
  DEMONSTRATION: 'Show the system performing the activity in a relevant environment.',
  OPERATIONAL_TEST: 'Run the system in its real operational context to gather evidence.',
  SIMULATION: 'Use a certified model or simulator to predict effectiveness.',
  ANALYSIS: 'Mathematical or logical reasoning. Prefer Verification for low-level requirement checks.',
  STAKEHOLDER_ACCEPTANCE: 'Stakeholder reviews artefacts/demos and accepts the result.',
}

export const MILESTONE_LABEL: Record<ValidationMilestone, string> = {
  PDR: 'PDR — Preliminary Design Review',
  CDR: 'CDR — Critical Design Review',
  FAT: 'FAT — Factory Acceptance Test',
  SAT: 'SAT — Site Acceptance Test',
  EIS: 'EIS — Entry Into Service',
  OTHER: 'Other / unscheduled',
}

export const MILESTONE_TOOLTIP: Record<ValidationMilestone, string> = {
  PDR:
    'Preliminary Design Review — early in the lifecycle; the design approach is shown to meet stakeholder needs in principle.',
  CDR:
    'Critical Design Review — the detailed design is mature; validation activities for this milestone confirm the build will satisfy intent.',
  FAT:
    'Factory Acceptance Test — built system is demonstrated at the supplier site before shipping.',
  SAT:
    'Site Acceptance Test — system is demonstrated in the customer’s actual environment.',
  EIS:
    'Entry Into Service — final acceptance before operational use.',
  OTHER: 'No specific lifecycle milestone.',
}

export const STATUS_LABEL: Record<ValidationStatus, string> = {
  PLANNED: 'Planned',
  EXECUTED: 'Executed',
  VALIDATED: 'Validated',
  BLOCKED: 'Blocked',
  OBSOLETE: 'Obsolete',
}

export const STATUS_COLOR: Record<ValidationStatus, string> = {
  PLANNED: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  EXECUTED: 'bg-blue-200 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  VALIDATED: 'bg-green-200 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  BLOCKED: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  OBSOLETE: 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
}

export const OUTCOME_LABEL: Record<CriterionOutcome, string> = {
  PENDING: 'Pending',
  MET: 'Met',
  PARTIAL: 'Partial',
  NOT_MET: 'Not Met',
}

export const OUTCOME_COLOR: Record<CriterionOutcome, string> = {
  PENDING: 'text-gray-500',
  MET: 'text-green-700 dark:text-green-400',
  PARTIAL: 'text-amber-700 dark:text-amber-400',
  NOT_MET: 'text-red-700 dark:text-red-400',
}
