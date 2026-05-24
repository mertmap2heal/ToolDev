import { prisma } from '../lib/prisma'
// @ts-ignore
import type { Requirement } from '../../../shared/types/engineering.types'


export interface ValidationIssue {
  message: string
  severity: 'error' | 'warning'
  fixType: 'field' | 'trace' | 'info'
  fixField?: string
  fixLinkType?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  issues: ValidationIssue[]
  score: number // Quality score 0-100
}

export interface RequirementQualityCheck {
  requirementId: string
  displayId: string | null
  title: string
  validation: ValidationResult
}

export interface ProjectValidationResult {
  requirements: RequirementQualityCheck[]
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '')
}

/**
 * Requirement validation service provides quality checks based on
 * SMART criteria and industry best practices.
 */
export const requirementValidationService = {
  /**
   * Validates a single requirement against quality criteria.
   * Includes SMART criteria, MoC validation, and enterprise linkage checks.
   * Lifecycle-aware when options provided: Draft/Proposed = warnings only for gates;
   * In Review/Approved/Baselined + strictLifecycleGates = missing gates as errors.
   */
  async validateRequirement(
    requirement: Requirement & { moc?: { name: string } | null; projectId?: string },
    options?: { projectId?: string; strictLifecycleGates?: boolean }
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = []
    let score = 100

    const projectId = options?.projectId ?? (requirement as any).projectId
    const strictLifecycleGates = options?.strictLifecycleGates ?? false
    const status = requirement.status || ''
    const isDraftOrProposed = /draft|proposed/i.test(status)
    const isInReviewOrBeyond = /in review|in_review|approved|baselined|verified/i.test(status)

    const descPlainText = requirement.description ? stripHtml(requirement.description) : ''

    const addIssue = (
      severity: 'error' | 'warning',
      message: string,
      fixType: 'field' | 'trace' | 'info',
      fixField?: string,
      fixLinkType?: string,
    ) => {
      issues.push({ message, severity, fixType, fixField, fixLinkType })
    }

    const addGateIssue = (
      check: boolean,
      msg: string,
      asErrorWhenStrict: boolean,
      fixType: 'field' | 'trace' | 'info' = 'field',
      fixField?: string,
      fixLinkType?: string,
    ) => {
      if (check) return
      if (isDraftOrProposed) {
        addIssue('warning', msg, fixType, fixField, fixLinkType)
      } else if (isInReviewOrBeyond && strictLifecycleGates && asErrorWhenStrict) {
        addIssue('error', msg, fixType, fixField, fixLinkType)
      } else {
        addIssue('warning', msg, fixType, fixField, fixLinkType)
      }
    }

    if (!requirement.title || requirement.title.trim().length === 0) {
      addIssue('error', 'Title is required', 'field', 'title')
      score -= 20
    }

    if (!requirement.description || requirement.description.trim().length === 0) {
      addIssue('error', 'Description is required', 'field', 'description')
      score -= 20
    }

    if (requirement.title && requirement.title.length < 10) {
      addIssue('warning', 'Title may be too vague. Consider making it more specific.', 'field', 'title')
      score -= 5
    }

    const hasAcceptanceCriteria = !!(requirement.acceptanceCriteria && requirement.acceptanceCriteria.trim().length > 0)
    const hasMeasurableTerms = /(shall|must|should|will|may|can|number|amount|percentage|rate|time|duration|speed|distance|weight|size)/i.test(
      descPlainText
    )
    if (!hasAcceptanceCriteria && !hasMeasurableTerms) {
      addIssue('warning', 'Description may lack measurable criteria. Consider adding acceptance criteria or quantifiable terms.', 'field', 'acceptanceCriteria')
      score -= 5
    }

    const hasComplexityRisk = !!(requirement.complexity || requirement.risk)
    if (!hasComplexityRisk && requirement.priority === 'critical') {
      addIssue('warning', 'Critical priority without complexity/risk assessment. Consider documenting.', 'field', 'complexity')
      score -= 3
    }

    const ambiguousTerms = /(maybe|perhaps|possibly|might|could|some|few|many|several|various)/i.test(
      descPlainText
    )
    if (ambiguousTerms) {
      addIssue('warning', 'Description contains ambiguous language. Consider being more specific.', 'field', 'description')
      score -= 5
    }

    const hasTimeReference = /(when|after|before|during|within|by|deadline|schedule|timeline)/i.test(
      descPlainText
    )
    if (!hasTimeReference && !requirement.stage) {
      addIssue('warning', 'Consider adding time-bound or stage information.', 'field', 'description')
      score -= 3
    }

    if (!requirement.requirementId) {
      addIssue('warning', 'Requirement ID is missing. Auto-generated IDs may cause confusion.', 'info')
      score -= 2
    }

    const mocName = (requirement as any).moc?.name
    if (mocName && /^Test$/i.test(mocName)) {
      addGateIssue(
        !!(requirement.verificationMethod && requirement.verificationMethod.trim().length > 0),
        'Verification method is required when MoC is Test.',
        true,
        'field',
        'verificationMethod',
      )
      if (!requirement.verificationMethod?.trim()) score -= 10
    }

    if (mocName && (/^Test$/i.test(mocName) || /^Analysis$/i.test(mocName))) {
      addGateIssue(
        !!(requirement.acceptanceCriteria && requirement.acceptanceCriteria.trim().length > 0),
        'Acceptance criteria recommended when MoC is Test or Analysis.',
        true,
        'field',
        'acceptanceCriteria',
      )
      if (!requirement.acceptanceCriteria?.trim()) score -= 3
    }

    if (!requirement.verificationMethod && !mocName) {
      addGateIssue(false, 'Verification method is not specified.', true, 'field', 'verificationMethod')
      score -= 5
    }

    if (!requirement.acceptanceCriteria?.trim() && !mocName) {
      addGateIssue(false, 'Acceptance criteria are not defined.', true, 'field', 'acceptanceCriteria')
      score -= 5
    }

    addGateIssue(!!requirement.owner?.trim(), 'No owner assigned to this requirement.', true, 'field', 'owner')
    if (!requirement.owner) score -= 3

    if (!requirement.requirementType) {
      addGateIssue(false, 'Requirement type is not classified (MBSE best practice).', true, 'field', 'requirementType')
      score -= 2
    }
    if (!requirement.requirementLevel) {
      addGateIssue(false, 'Requirement level is not specified (system, subsystem, component).', true, 'field', 'requirementLevel')
      score -= 1
    }

    if (projectId && requirement.id) {
      const allocatedLink = await prisma.traceLink.findFirst({
        where: {
          projectId,
          sourceType: 'requirement',
          sourceId: requirement.id,
          linkType: { in: ['allocated_to', 'allocate'] },
        },
      })
      addGateIssue(!!allocatedLink, 'Requirement has no allocation link (allocated_to). Consider linking to PBS component.', isInReviewOrBeyond, 'trace', undefined, 'allocated_to')
      if (!allocatedLink) score -= 5
    }

    if (isInReviewOrBeyond) {
      addGateIssue(
        !!(requirement.stakeholders && requirement.stakeholders.length > 0),
        'Stakeholder(s) should be specified for Approved/Baselined requirements.',
        true,
        'field',
        'stakeholders',
      )
    }

    if (projectId && requirement.id && isInReviewOrBeyond) {
      const docLink = await prisma.traceLink.findFirst({
        where: {
          projectId,
          OR: [
            { sourceType: 'requirement', sourceId: requirement.id, linkType: 'documented_in' },
            { targetType: 'requirement', targetId: requirement.id, linkType: 'documented_in' },
          ],
        },
      })
      if (!docLink) {
        addGateIssue(false, 'Consider linking to document (documented_in) for traceability.', false, 'trace', undefined, 'documented_in')
      }
    }

    const isBeyondProposed = requirement.status && !/proposed|draft/i.test(requirement.status)
    if (projectId && requirement.id && isBeyondProposed) {
      const verificationLink = await prisma.traceLink.findFirst({
        where: {
          projectId,
          OR: [
            { sourceType: 'requirement', sourceId: requirement.id, linkType: { in: ['verified_by', 'verifies'] } },
            { targetType: 'requirement', targetId: requirement.id, linkType: { in: ['verified_by', 'verifies'] } },
          ],
        },
      })
      addGateIssue(!!verificationLink, 'Requirement status is beyond Proposed but has no verification link.', true, 'trace', undefined, 'verified_by')
      if (!verificationLink) score -= 5
    }

    if (!requirement.rationale) {
      addIssue('warning', 'Rationale is missing. Consider documenting why this requirement exists.', 'field', 'rationale')
      score -= 2
    }

    if (requirement.dependencies && requirement.dependencies.length > 0) {
      addIssue('warning', `Requirement has ${requirement.dependencies.length} dependency/dependencies. Ensure all dependencies are valid.`, 'info')
    }

    if (requirement.conflicts && requirement.conflicts.length > 0) {
      addIssue('error', `Requirement has ${requirement.conflicts.length} conflict(s) with other requirements.`, 'info')
      score -= 10
    }

    if (requirement.description) {
      const descLength = descPlainText.length
      if (descLength < 20) {
        addIssue('warning', 'Description is very short. Consider adding more detail.', 'field', 'description')
        score -= 3
      } else if (descLength > 2000) {
        addIssue('warning', 'Description is very long. Consider breaking into multiple requirements.', 'field', 'description')
        score -= 2
      }
    }

    score = Math.max(0, Math.min(100, score))

    const errors = issues.filter(i => i.severity === 'error').map(i => i.message)
    const warnings = issues.filter(i => i.severity === 'warning').map(i => i.message)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      issues,
      score,
    }
  },

  /**
   * Check lifecycle gates for a status transition.
   * Returns passed (true if no blockers), warnings, and blockers.
   * When strictLifecycleGates=true, warnings become blockers.
   */
  async checkLifecycleGates(
    requirement: Requirement & { moc?: { name: string } | null; projectId?: string },
    targetStatusName: string,
    strictMode: boolean
  ): Promise<{ passed: boolean; warnings: string[]; blockers: string[] }> {
    const warnings: string[] = []
    const blockers: string[] = []
    const projectId = (requirement as any).projectId

    const addGate = (check: boolean, message: string, isRequired: boolean) => {
      if (!check) {
        if (strictMode || isRequired) blockers.push(message)
        else warnings.push(message)
      }
    }

    // Gates for In Review: Owner, MoC
    if (/in review|in_review/i.test(targetStatusName)) {
      addGate(!!requirement.owner?.trim(), 'Owner is required to move to In Review', strictMode)
      addGate(!!(requirement as any).linkedMocCode, 'Means of Compliance (MoC) is required', strictMode)
    }

    // Gates for Approved: Acceptance Criteria, Verification Method, allocation or waiver
    if (/approved/i.test(targetStatusName)) {
      addGate(
        !!(requirement.acceptanceCriteria && requirement.acceptanceCriteria.trim()),
        'Acceptance criteria required for Approved',
        strictMode
      )
      const mocName = (requirement as any).moc?.name
      if (mocName && /^Test$/i.test(mocName)) {
        addGate(
          !!(requirement.verificationMethod && requirement.verificationMethod.trim()),
          'Verification method required when MoC is Test',
          true
        )
      }
      if (projectId && requirement.id) {
        const hasAllocation = await prisma.traceLink.findFirst({
          where: {
            projectId,
            sourceType: 'requirement',
            sourceId: requirement.id,
            linkType: { in: ['allocated_to', 'allocate'] },
          },
        })
        addGate(!!hasAllocation, 'Allocation to PBS (or waiver) required for Approved', !strictMode)
      }
    }

    // Gates for Baselined: must be Approved (we cannot easily check "in baseline" without baselineId - soft check)
    if (/baselined|baseline/i.test(targetStatusName)) {
      const statusOk = requirement.status && /approved/i.test(requirement.status)
      addGate(!!statusOk, 'Requirement must be Approved before Baselined', strictMode)
    }

    return {
      passed: blockers.length === 0,
      warnings,
      blockers,
    }
  },

  /**
   * Validates all requirements in a project.
   * Lifecycle-aware: Draft/Proposed → warnings only for gates; In Review+ with strictLifecycleGates → missing gates as errors.
   */
  async validateProjectRequirements(projectId: string): Promise<ProjectValidationResult> {
    const [requirements, project] = await Promise.all([
      prisma.requirement.findMany({
        where: { projectId },
        include: { moc: true },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { strictLifecycleGates: true },
      }),
    ])

    const strictLifecycleGates = project?.strictLifecycleGates ?? false
    const results: RequirementQualityCheck[] = []

    for (const req of requirements) {
      try {
        const validation = await this.validateRequirement(req as any, { projectId, strictLifecycleGates })
        results.push({
          requirementId: req.id,
          displayId: req.requirementId,
          title: req.title,
          validation,
        })
      } catch (_err) {
        results.push({
          requirementId: req.id,
          displayId: req.requirementId,
          title: req.title,
          validation: {
            isValid: false,
            errors: ['Validation failed: internal error'],
            warnings: [],
            issues: [{ message: 'Validation failed: internal error', severity: 'error', fixType: 'info' }],
            score: 0,
          },
        })
      }
    }

    return { requirements: results }
  },
}
