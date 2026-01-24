import { PrismaClient } from '@prisma/client'
import {
  EvidenceType,
  LinkedEntityType,
  EvidenceRelation,
} from '../../types/verification.types'

const prisma = new PrismaClient()

/**
 * Evidence service for managing evidence and validation rules
 */
export const evidenceService = {
  /**
   * Check if MoC requires justification
   */
  async requiresJustification(mocCode: number): Promise<boolean> {
    const moc = await prisma.verMoc.findUnique({
      where: { code: mocCode },
    })

    return moc?.requiresJustification || false
  },

  /**
   * Validate evidence requirements for MoC 5/6
   * MoC 5/6 require: test procedure, execution result, evidence attached
   */
  async validateMocEvidenceRequirements(params: {
    mocCode: number
    hasTestProcedure: boolean
    hasExecutionResult: boolean
    hasAttachedEvidence: boolean
  }): Promise<{ valid: boolean; errors: string[] }> {
    const { mocCode, hasTestProcedure, hasExecutionResult, hasAttachedEvidence } = params
    const errors: string[] = []

    // MoC 5 (Demonstration) and MoC 6 (Review) have specific requirements
    if (mocCode === 5 || mocCode === 6) {
      if (!hasTestProcedure) {
        errors.push('MoC 5/6 requires a test procedure (test case)')
      }
      if (!hasExecutionResult) {
        errors.push('MoC 5/6 requires an execution result')
      }
      if (!hasAttachedEvidence) {
        errors.push('MoC 5/6 requires evidence attached to execution')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Link evidence to an entity
   */
  async linkEvidence(params: {
    evidenceId: string
    linkedEntityType: LinkedEntityType
    linkedEntityId: string
    relation?: EvidenceRelation
  }): Promise<void> {
    const { evidenceId, linkedEntityType, linkedEntityId, relation = EvidenceRelation.PRIMARY } = params

    await prisma.verEvidenceLink.create({
      data: {
        evidenceId,
        linkedEntityType,
        linkedEntityId,
        relation,
      },
    })
  },

  /**
   * Unlink evidence from an entity
   */
  async unlinkEvidence(params: {
    evidenceId: string
    linkedEntityType: LinkedEntityType
    linkedEntityId: string
  }): Promise<void> {
    const { evidenceId, linkedEntityType, linkedEntityId } = params

    await prisma.verEvidenceLink.deleteMany({
      where: {
        evidenceId,
        linkedEntityType,
        linkedEntityId,
      },
    })
  },

  /**
   * Get evidence links for an entity
   */
  async getEntityEvidence(params: {
    linkedEntityType: LinkedEntityType
    linkedEntityId: string
  }): Promise<any[]> {
    const { linkedEntityType, linkedEntityId } = params

    const links = await prisma.verEvidenceLink.findMany({
      where: {
        linkedEntityType,
        linkedEntityId,
      },
      include: {
        evidence: true,
      },
    })

    return links
  },
}
