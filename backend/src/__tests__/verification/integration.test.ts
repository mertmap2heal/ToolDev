import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { TestPlanStatus } from '../../types/verification.types'

const prisma = new PrismaClient()

describe('Verification Workflow Integration', () => {
  let projectId: string
  let testPlanId: string
  let testCaseId: string

  beforeAll(async () => {
    const project = await prisma.project.create({
      data: { name: 'Integration Test', domain: 'test', slug: 'integration-test', userId: 'test-user' },
    })
    projectId = project.id
    await prisma.verMoc.upsert({
      where: { code: 3 },
      update: {},
      create: { code: 3, name: 'Test', requiresJustification: false, isActive: true },
    })
  })

  afterAll(async () => {
    await prisma.verTestPlanCase.deleteMany({ where: { testPlan: { projectId } } })
    await prisma.verTestCase.deleteMany({ where: { projectId } })
    await prisma.verTestPlan.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.$disconnect()
  })

  it('should complete basic verification workflow', async () => {
    const plan = await prisma.verTestPlan.create({
      data: { projectId, key: 'TP-INT-001', name: 'Test Plan', status: TestPlanStatus.DRAFT },
    })
    testPlanId = plan.id
    const testCase = await prisma.verTestCase.create({
      data: { projectId, key: 'TC-INT-001', title: 'Test Case', status: 'READY', version: '1.0', linkedMocCode: 3 },
    })
    testCaseId = testCase.id
    await prisma.verTestPlanCase.create({
      data: { testPlanId, testCaseId, orderIndex: 1, isMandatory: true },
    })
    expect(testCase).toBeDefined()
    expect(plan).toBeDefined()
  })
})
