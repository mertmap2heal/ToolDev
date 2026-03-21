import { prisma } from '../lib/prisma'
// @ts-ignore
import type { Requirement } from '../../../shared/types/engineering.types'


export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number // Quality score 0-100
}

export interface RequirementQualityCheck {
  requirementId: string
  title: string
  validation: ValidationResult
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
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    const projectId = options?.projectId ?? (requirement as any).projectId
    const strictLifecycleGates = options?.strictLifecycleGates ?? false
    const status = requirement.status || ''
    const isDraftOrProposed = /draft|proposed/i.test(status)
    const isInReviewOrBeyond = /in review|in_review|approved|baselined|verified/i.test(status)

    // Helper: add as error or warning based on lifecycle
    const addGateIssue = (check: boolean, msg: string, asErrorWhenStrict: boolean) => {
      if (check) return
      if (isDraftOrProposed) {
        warnings.push(msg)
      } else if (isInReviewOrBeyond && strictLifecycleGates && asErrorWhenStrict) {
        errors.push(msg)
      } else {
        warnings.push(msg)
      }
    }

    // Check for required fields
    if (!requirement.title || requirement.title.trim().length === 0) {
      errors.push('Title is required')
      score -= 20
    }

    if (!requirement.description || requirement.description.trim().length === 0) {
      errors.push('Description is required')
      score -= 20
    }

    // SMART Criteria Checks
    // Specific
    if (requirement.title && requirement.title.length < 10) {
      warnings.push('Title may be too vague. Consider making it more specific.')
      score -= 5
    }

    // Measurable - use acceptance criteria as primary indicator
    const hasAcceptanceCriteria = !!(requirement.acceptanceCriteria && requirement.acceptanceCriteria.trim().length > 0)
    const hasMeasurableTerms = /(shall|must|should|will|may|can|number|amount|percentage|rate|time|duration|speed|distance|weight|size)/i.test(
      requirement.description
    )
    if (!hasAcceptanceCriteria && !hasMeasurableTerms) {
      warnings.push('Description may lack measurable criteria. Consider adding acceptance criteria or quantifiable terms.')
      score -= 5
    }

    // Achievable - check complexity and risk
    const hasComplexityRisk = !!(requirement.complexity || requirement.risk)
    if (!hasComplexityRisk && requirement.priority === 'critical') {
      warnings.push('Critical priority without complexity/risk assessment. Consider documenting.')
      score -= 3
    }

    // Ambiguous language check
    const ambiguousTerms = /(maybe|perhaps|possibly|might|could|some|few|many|several|various)/i.test(
      requirement.description
    )
    if (ambiguousTerms) {
      warnings.push('Description contains ambiguous language. Consider being more specific.')
      score -= 5
    }

    // Time-bound - Check for temporal references
    const hasTimeReference = /(when|after|before|during|within|by|deadline|schedule|timeline)/i.test(
      requirement.description
    )
    if (!hasTimeReference && !requirement.stage) {
      warnings.push('Consider adding time-bound or stage information.')
      score -= 3
    }

    // Check for requirement ID uniqueness (would need to check against all requirements)
    if (!requirement.requirementId) {
      warnings.push('Requirement ID is missing. Auto-generated IDs may cause confusion.')
      score -= 2
    }

    // MoC validation: if MoC=Test, verification method required (gate)
    const mocName = (requirement as any).moc?.name
    if (mocName && /^Test$/i.test(mocName)) {
      addGateIssue(
        !!(requirement.verificationMethod && requirement.verificationMethod.trim().length > 0),
        'Verification method is required when MoC is Test.',
        true
      )
      if (!requirement.verificationMethod?.trim()) score -= 10
    }

    if (mocName && (/^Test$/i.test(mocName) || /^Analysis$/i.test(mocName))) {
      addGateIssue(
        !!(requirement.acceptanceCriteria && requirement.acceptanceCriteria.trim().length > 0),
        'Acceptance criteria recommended when MoC is Test or Analysis.',
        true
      )
      if (!requirement.acceptanceCriteria?.trim()) score -= 3
    }

    if (!requirement.verificationMethod && !mocName) {
      addGateIssue(false, 'Verification method is not specified.', true)
      score -= 5
    }

    if (!requirement.acceptanceCriteria?.trim() && !mocName) {
      addGateIssue(false, 'Acceptance criteria are not defined.', true)
      score -= 5
    }

    addGateIssue(!!requirement.owner?.trim(), 'No owner assigned to this requirement.', true)
    if (!requirement.owner) score -= 3

    if (!requirement.requirementType) {
      addGateIssue(false, 'Requirement type is not classified (MBSE best practice).', true)
      score -= 2
    }
    if (!requirement.requirementLevel) {
      addGateIssue(false, 'Requirement level is not specified (system, subsystem, component).', true)
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
      addGateIssue(!!allocatedLink, 'Requirement has no allocation link (allocated_to). Consider linking to PBS component.', isInReviewOrBeyond)
      if (!allocatedLink) score -= 5
    }

    if (isInReviewOrBeyond) {
      addGateIssue(
        !!(requirement.stakeholders && requirement.stakeholders.length > 0),
        'Stakeholder(s) should be specified for Approved/Baselined requirements.',
        true
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
        addGateIssue(false, 'Consider linking to document (documented_in) for traceability.', false)
      }
    }

    // Enterprise: has verification link if status beyond Proposed
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
      if (!verificationLink) {
        warnings.push('Requirement status is beyond Proposed but has no verification link.')
        score -= 5
      }
    }

    // Check for rationale
    if (!requirement.rationale) {
      warnings.push('Rationale is missing. Consider documenting why this requirement exists.')
      score -= 2
    }

    // Check for dependencies
    if (requirement.dependencies && requirement.dependencies.length > 0) {
      warnings.push(`Requirement has ${requirement.dependencies.length} dependency/dependencies. Ensure all dependencies are valid.`)
    }

    // Check for conflicts
    if (requirement.conflicts && requirement.conflicts.length > 0) {
      errors.push(`Requirement has ${requirement.conflicts.length} conflict(s) with other requirements.`)
      score -= 10
    }

    // Check description length (too short or too long)
    if (requirement.description) {
      const descLength = requirement.description.replace(/<[^>]*>/g, '').length
      if (descLength < 20) {
        warnings.push('Description is very short. Consider adding more detail.')
        score -= 3
      } else if (descLength > 2000) {
        warnings.push('Description is very long. Consider breaking into multiple requirements.')
        score -= 2
      }
    }

    score = Math.max(0, Math.min(100, score))

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
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
  async validateProjectRequirements(projectId: string): Promise<RequirementQualityCheck[]> {
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
      const validation = await this.validateRequirement(req as any, { projectId, strictLifecycleGates })
      results.push({
        requirementId: req.id,
        title: req.title,
        validation,
      })
    }

    return results
  },

  /**
   * Checks for circular dependencies
   */
  async checkCircularDependencies(projectId: string): Promise<string[][]> {
    const requirements = await prisma.requirement.findMany({
      where: { projectId },
      select: {
        id: true,
        dependencies: true,
      },
    })

    const circular: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const hasCycle = (reqId: string, path: string[]): boolean => {
      if (recursionStack.has(reqId)) {
        circular.push([...path, reqId])
        return true
      }

      if (visited.has(reqId)) {
        return false
      }

      visited.add(reqId)
      recursionStack.add(reqId)

      const req = requirements.find((r) => r.id === reqId)
      if (req && req.dependencies) {
        for (const depId of req.dependencies) {
          if (hasCycle(depId, [...path, reqId])) {
            return true
          }
        }
      }

      recursionStack.delete(reqId)
      return false
    }

    for (const req of requirements) {
      if (!visited.has(req.id)) {
        hasCycle(req.id, [])
      }
    }

    return circular
  },

  /**
   * Checks for duplicate requirement IDs
   */
  async checkDuplicateIds(projectId: string): Promise<string[]> {
    const requirements = await prisma.requirement.findMany({
      where: { projectId },
      select: {
        id: true,
        requirementId: true,
      },
    })

    const idMap = new Map<string, string[]>()
    requirements.forEach((req) => {
      if (req.requirementId) {
        if (!idMap.has(req.requirementId)) {
          idMap.set(req.requirementId, [])
        }
        idMap.get(req.requirementId)!.push(req.id)
      }
    })

    const duplicates: string[] = []
    idMap.forEach((ids, reqId) => {
      if (ids.length > 1) {
        duplicates.push(reqId)
      }
    })

    return duplicates
  },
}
