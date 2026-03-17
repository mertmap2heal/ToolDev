import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { evidenceService } from '../../services/verification/evidence.service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Evidence Rules', () => {
  beforeAll(async () => {
    await prisma.verMoc.upsert({
      where: { code: 5 },
      update: {},
      create: { code: 5, name: 'Demo', requiresJustification: false, isActive: true },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('should validate MoC 5/6 requirements', async () => {
    const result = await evidenceService.validateMocEvidenceRequirements({
      mocCode: 5,
      hasTestProcedure: true,
      hasExecutionResult: true,
      hasAttachedEvidence: true,
    })
    expect(result.valid).toBe(true)
  })
})
