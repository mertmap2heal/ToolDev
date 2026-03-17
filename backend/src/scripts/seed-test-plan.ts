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

  const seedCaseKeys = ['TC-SEED-001', 'TC-SEED-002', 'TC-SEED-003', 'TC-SEED-004']
  const testCases = await prisma.verTestCase.findMany({
    where: { projectId: pid, key: { in: seedCaseKeys } },
    orderBy: { key: 'asc' },
  })
  if (testCases.length === 0) {
    console.error('No seed test cases found (TC-SEED-001 through TC-SEED-004). Run seed-test-case first.')
    process.exit(1)
  }
  console.log(`Found ${testCases.length} test case(s): ${testCases.map((tc) => tc.key).join(', ')}`)

  let plan = await prisma.verTestPlan.findFirst({
    where: { projectId: pid, key: FULLY_POPULATED_TEST_PLAN.key },
    include: { planCases: true },
  })

  if (!plan) {
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
      include: { planCases: true },
    })
    console.log(`Created test plan: ${plan.key} - ${plan.name} (${plan.id})`)
  } else {
    console.log(`Test plan ${plan.key} already exists.`)
  }

  const linkedCaseIds = new Set(plan.planCases.map((pc) => pc.testCaseId))
  let orderIndex = plan.planCases.length
  const notesByKey: Record<string, string> = {
    'TC-SEED-001': 'Primary HIL functional test for data acquisition.',
    'TC-SEED-002': 'CAN bus error handling and recovery.',
    'TC-SEED-003': 'Frame timing and jitter validation.',
    'TC-SEED-004': 'Off-nominal power cycle during transfer.',
  }
  for (const tc of testCases) {
    if (linkedCaseIds.has(tc.id)) {
      console.log(`${tc.key} already in plan.`)
      continue
    }
    await prisma.verTestPlanCase.create({
      data: {
        testPlanId: plan.id,
        testCaseId: tc.id,
        orderIndex,
        isMandatory: true,
        notes: notesByKey[tc.key] ?? undefined,
      },
    })
    console.log(`Added ${tc.key} to test plan`)
    linkedCaseIds.add(tc.id)
    orderIndex += 1
  }

  console.log('Seed complete. Test plan has all seed test cases (TC-SEED-001 through TC-SEED-004).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
