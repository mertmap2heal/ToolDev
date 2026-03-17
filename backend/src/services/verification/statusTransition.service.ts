import {
  TestCaseStatus,
  TestPlanStatus,
  ReviewStatus,
  NonconformityStatus,
  EntityStatus,
  ReverifyTaskStatus,
} from '../../types/verification.types'

/**
 * Status transition validation service
 * Enforces valid state transitions for verification entities
 */

type StatusTransitionMap = Record<string, string[]>

const TEST_CASE_TRANSITIONS: StatusTransitionMap = {
  [TestCaseStatus.DRAFT]: [TestCaseStatus.REVIEWED],
  [TestCaseStatus.REVIEWED]: [TestCaseStatus.APPROVED, TestCaseStatus.DRAFT], // Can go back to draft
  [TestCaseStatus.APPROVED]: [TestCaseStatus.READY],
  [TestCaseStatus.READY]: [], // Terminal state
}

const TEST_PLAN_TRANSITIONS: StatusTransitionMap = {
  [TestPlanStatus.DRAFT]: [TestPlanStatus.REVIEWED],
  [TestPlanStatus.REVIEWED]: [TestPlanStatus.APPROVED, TestPlanStatus.DRAFT],
  [TestPlanStatus.APPROVED]: [TestPlanStatus.ACTIVE],
  [TestPlanStatus.ACTIVE]: [TestPlanStatus.CLOSED],
  [TestPlanStatus.CLOSED]: [], // Terminal state
}

const ENTITY_STATUS_TRANSITIONS: StatusTransitionMap = {
  [EntityStatus.DRAFT]: [EntityStatus.APPROVED],
  [EntityStatus.APPROVED]: [EntityStatus.DEPRECATED],
  [EntityStatus.DEPRECATED]: [], // Terminal state
}

const REVIEW_TRANSITIONS: StatusTransitionMap = {
  [ReviewStatus.PLANNED]: [ReviewStatus.IN_PROGRESS],
  [ReviewStatus.IN_PROGRESS]: [ReviewStatus.CLOSED],
  [ReviewStatus.CLOSED]: [], // Terminal state
}

const NONCONFORMITY_TRANSITIONS: StatusTransitionMap = {
  [NonconformityStatus.OPEN]: [NonconformityStatus.INVESTIGATING],
  [NonconformityStatus.INVESTIGATING]: [
    NonconformityStatus.FIXED,
    NonconformityStatus.OPEN,
  ],
  [NonconformityStatus.FIXED]: [
    NonconformityStatus.REVERIFY_REQUIRED,
    NonconformityStatus.CLOSED,
  ],
  [NonconformityStatus.REVERIFY_REQUIRED]: [
    NonconformityStatus.CLOSED,
    NonconformityStatus.INVESTIGATING,
  ],
  [NonconformityStatus.CLOSED]: [], // Terminal state
}

const REVERIFY_TASK_TRANSITIONS: StatusTransitionMap = {
  [ReverifyTaskStatus.PENDING]: [ReverifyTaskStatus.COMPLETED],
  [ReverifyTaskStatus.COMPLETED]: [], // Terminal state
}

export const statusTransitionService = {
  /**
   * Validate if a status transition is allowed
   */
  isValidTransition(
    entityType: string,
    currentStatus: string,
    newStatus: string
  ): boolean {
    let transitions: StatusTransitionMap

    switch (entityType) {
      case 'TEST_CASE':
        transitions = TEST_CASE_TRANSITIONS
        break
      case 'TEST_PLAN':
        transitions = TEST_PLAN_TRANSITIONS
        break
      case 'METHOD':
      case 'SETUP':
        transitions = ENTITY_STATUS_TRANSITIONS
        break
      case 'REVIEW':
        transitions = REVIEW_TRANSITIONS
        break
      case 'NONCONFORMITY':
        transitions = NONCONFORMITY_TRANSITIONS
        break
      case 'REVERIFY_TASK':
        transitions = REVERIFY_TASK_TRANSITIONS
        break
      default:
        return false
    }

    const allowedTransitions = transitions[currentStatus] || []
    return allowedTransitions.includes(newStatus)
  },

  /**
   * Get allowed transitions for a status
   */
  getAllowedTransitions(entityType: string, currentStatus: string): string[] {
    let transitions: StatusTransitionMap

    switch (entityType) {
      case 'TEST_CASE':
        transitions = TEST_CASE_TRANSITIONS
        break
      case 'TEST_PLAN':
        transitions = TEST_PLAN_TRANSITIONS
        break
      case 'METHOD':
      case 'SETUP':
        transitions = ENTITY_STATUS_TRANSITIONS
        break
      case 'REVIEW':
        transitions = REVIEW_TRANSITIONS
        break
      case 'NONCONFORMITY':
        transitions = NONCONFORMITY_TRANSITIONS
        break
      case 'REVERIFY_TASK':
        transitions = REVERIFY_TASK_TRANSITIONS
        break
      default:
        return []
    }

    return transitions[currentStatus] || []
  },

  /**
   * Validate and throw if invalid
   */
  validateTransition(
    entityType: string,
    currentStatus: string,
    newStatus: string
  ): void {
    if (!this.isValidTransition(entityType, currentStatus, newStatus)) {
      throw new Error(
        `Invalid status transition for ${entityType}: ${currentStatus} -> ${newStatus}. ` +
          `Allowed transitions: ${this.getAllowedTransitions(entityType, currentStatus).join(', ')}`
      )
    }
  },
}
