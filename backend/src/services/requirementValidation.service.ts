import { PrismaClient } from '@prisma/client'
import type { Requirement } from '../../../shared/types/engineering.types'

const prisma = new PrismaClient()

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
   * Validates a single requirement against quality criteria
   */
  async validateRequirement(requirement: Requirement): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

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

    // Measurable
    const hasMeasurableTerms = /(shall|must|should|will|may|can|number|amount|percentage|rate|time|duration|speed|distance|weight|size)/i.test(
      requirement.description
    )
    if (!hasMeasurableTerms) {
      warnings.push('Description may lack measurable criteria. Consider adding quantifiable terms.')
      score -= 5
    }

    // Achievable/Realistic - Check for impossible terms
    const impossibleTerms = /(impossible|never|always|perfect|infinite|unlimited)/i.test(requirement.description)
    if (impossibleTerms) {
      warnings.push('Description contains terms that may indicate unrealistic expectations.')
      score -= 5
    }

    // Time-bound - Check for temporal references
    const hasTimeReference = /(when|after|before|during|within|by|deadline|schedule|timeline)/i.test(
      requirement.description
    )
    if (!hasTimeReference && requirement.stage === '') {
      warnings.push('Consider adding time-bound or stage information.')
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

    // Check for requirement ID uniqueness (would need to check against all requirements)
    if (!requirement.requirementId) {
      warnings.push('Requirement ID is missing. Auto-generated IDs may cause confusion.')
      score -= 2
    }

    // Check for verification method
    if (!requirement.verificationMethod) {
      warnings.push('Verification method is not specified.')
      score -= 5
    }

    // Check for acceptance criteria
    if (!requirement.acceptanceCriteria) {
      warnings.push('Acceptance criteria are not defined.')
      score -= 5
    }

    // Check for owner assignment
    if (!requirement.owner) {
      warnings.push('No owner assigned to this requirement.')
      score -= 3
    }

    // Check for requirement type (MBSE)
    if (!requirement.requirementType) {
      warnings.push('Requirement type is not classified (MBSE best practice).')
      score -= 2
    }

    // Check for rationale
    if (!requirement.rationale) {
      warnings.push('Rationale is missing. Consider documenting why this requirement exists.')
      score -= 2
    }

    // Check for dependencies
    if (requirement.dependencies && requirement.dependencies.length > 0) {
      // Dependencies are good, but check if they're valid
      warnings.push(`Requirement has ${requirement.dependencies.length} dependency/dependencies. Ensure all dependencies are valid.`)
    }

    // Check for conflicts
    if (requirement.conflicts && requirement.conflicts.length > 0) {
      errors.push(`Requirement has ${requirement.conflicts.length} conflict(s) with other requirements.`)
      score -= 10
    }

    // Check description length (too short or too long)
    if (requirement.description) {
      const descLength = requirement.description.replace(/<[^>]*>/g, '').length // Strip HTML
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
   * Validates all requirements in a project
   */
  async validateProjectRequirements(projectId: string): Promise<RequirementQualityCheck[]> {
    const requirements = await prisma.requirement.findMany({
      where: { projectId },
    })

    const results: RequirementQualityCheck[] = []

    for (const req of requirements) {
      const validation = await this.validateRequirement(req as any)
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
