/**
 * Seed a fully populated test plan and add TC-SEED-001 to it.
 * Usage: npx tsx src/scripts/seed-test-plan.ts [projectId]
 * If projectId is omitted, uses the first project found.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FULLY_POPULATED_TEST_PLAN = {
  key: 'TP-SEED-001',
  name: 'HIL Qualification Test Plan – Phase 1',
  description:
    'Hardware-in-the-loop qualification test plan covering CAN bus functional tests for the DUT in accordance with DO-178C and project verification strategy.',
  scope:
    'This plan covers all functional test cases for the data acquisition subsystem. Scope includes CAN 2.0B interface validation, frame timing, and error handling under nominal and off-nominal conditions.',
  entryCriteria:
    '1. All test cases are approved and ready for execution.\n2. Test environment (HIL bench) is calibrated and validated.\n3. Software build under test is frozen and baseline established.\n4. Test data sets (TD-001, etc.) are available and verified.',
  exitCriteria:
    '1. All mandatory test cases executed and results recorded.\n2. All failures documented and dispositioned.\n3. Test report generated and reviewed.',
  phase: 'QUALIFICATION',
  status: 'ACTIVE',
}

async function main() {
  const projectId = process.argv[2]

  let project: { id: string } | null
  if (projectId) {
    project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })
    if (!project) {
      console.error(`Project ${projectId} not found.`)
      process.exit(1)
    }
  } else {
    project = await prisma.project.findFirst({
      select: { id: true },
    })
    if (!project) {
      console.error('No project found. Create a project first or pass projectId as argument.')
      process.exit(1)
    }
    console.log(`Using first project: ${project.id}`)
  }

  const pid = project.id

  // Find TC-SEED-001 test case
  const testCase = await prisma.verTestCase.findFirst({
    where: { projectId: pid, key: 'TC-SEED-001' },
  })
  if (!testCase) {
    console.error('Test case TC-SEED-001 not found. Run seed-test-case first.')
    process.exit(1)
  }
  console.log(`Found test case: ${testCase.key} (${testCase.id})`)

  // Check if test plan already exists
  let plan = await prisma.verTestPlan.findFirst({
    where: { projectId: pid, key: FULLY_POPULATED_TEST_PLAN.key },
    include: { planCases: true },
  })
  if (plan) {
    const alreadyLinked = plan.planCases.some((pc) => pc.testCaseId === testCase.id)
    if (alreadyLinked) {
      console.log(`Test plan ${FULLY_POPULATED_TEST_PLAN.key} already exists with TC-SEED-001.`)
      process.exit(0)
    }
    // Add test case to existing plan
    await prisma.verTestPlanCase.create({
      data: {
        testPlanId: plan.id,
        testCaseId: testCase.id,
        orderIndex: 0,
        isMandatory: true,
      },
    })
    console.log(`Added ${testCase.key} to existing test plan ${plan.key}`)
    process.exit(0)
  }

  // Create fully populated test plan
  plan = await prisma.verTestPlan.create({
    data: {
      projectId: pid,
      key: FULLY_POPULATED_TEST_PLAN.key,
      name: FULLY_POPULATED_TEST_PLAN.name,
      description: FULLY_POPULATED_TEST_PLAN.description,
      scope: FULLY_POPULATED_TEST_PLAN.scope,
      entryCriteria: FULLY_POPULATED_TEST_PLAN.entryCriteria,
      exitCriteria: FULLY_POPULATED_TEST_PLAN.exitCriteria,
      phase: FULLY_POPULATED_TEST_PLAN.phase,
      status: FULLY_POPULATED_TEST_PLAN.status,
    },
  })
  console.log(`Created test plan: ${plan.key} - ${plan.name} (${plan.id})`)

  // Add test case to plan
  await prisma.verTestPlanCase.create({
    data: {
      testPlanId: plan.id,
      testCaseId: testCase.id,
      orderIndex: 0,
      isMandatory: true,
      notes: 'Primary HIL functional test for data acquisition.',
    },
  })
  console.log(`Added ${testCase.key} to test plan`)

  console.log('Seed complete. Fully populated test plan created with TC-SEED-001.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
