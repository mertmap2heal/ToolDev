import { describe, it, expect } from 'vitest'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { TestCaseStatus, TestPlanStatus, EntityStatus } from '../../types/verification.types'

describe('Status Transition Service', () => {
  it('should allow valid test case transitions', () => {
    expect(statusTransitionService.isValidTransition('TEST_CASE', TestCaseStatus.DRAFT, TestCaseStatus.REVIEWED)).toBe(true)
    expect(statusTransitionService.isValidTransition('TEST_CASE', TestCaseStatus.REVIEWED, TestCaseStatus.APPROVED)).toBe(true)
    expect(statusTransitionService.isValidTransition('TEST_CASE', TestCaseStatus.APPROVED, TestCaseStatus.READY)).toBe(true)
  })

  it('should reject invalid test case transitions', () => {
    expect(statusTransitionService.isValidTransition('TEST_CASE', TestCaseStatus.DRAFT, TestCaseStatus.APPROVED)).toBe(false)
    expect(statusTransitionService.isValidTransition('TEST_CASE', TestCaseStatus.READY, TestCaseStatus.DRAFT)).toBe(false)
  })

  it('should validate transitions and throw on invalid', () => {
    expect(() => {
      statusTransitionService.validateTransition('TEST_CASE', TestCaseStatus.DRAFT, TestCaseStatus.APPROVED)
    }).toThrow()
  })
})
