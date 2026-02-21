/**
 * Seed a fully populated test case for verification testing.
 * Usage: npx tsx src/scripts/seed-test-case.ts [projectId]
 * If projectId is omitted, uses the first project found.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FULLY_POPULATED_TEST_CASE = {
  key: 'TC-SEED-001',
  title: 'Functional Test – Data Acquisition Over CAN',
  objective:
    'Verify that the system correctly acquires and processes CAN bus data from the DUT under nominal operating conditions.',
  preconditions:
    '1. DUT is powered and in operational mode.\n2. CAN bus is configured and connected.\n3. Test setup HIL-Bench-01 is calibrated and ready.',
  steps: [
    'Power on the DUT and allow it to enter operational mode.',
    'Start the CAN message generator and inject test vectors per test data set TD-001.',
    'Monitor the system output for 60 seconds and record all received frames.',
    'Compare recorded frames against expected results in ER-001.',
  ],
  expectedResults: [
    'DUT enters operational mode within 5 seconds of power-on.',
    'All test vectors are received and acknowledged without errors.',
    'Recorded frame count matches expected count (256 frames).',
    'No bus errors or frame loss detected during the test.',
  ],
  passFailCriteria:
    'PASS if all expected results are met. FAIL if any frame loss, bus error, or deviation from expected results occurs.',
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

  // Ensure MoC code 3 (Test) exists
  const moc = await prisma.verMoc.findUnique({ where: { code: 3 } })
  if (!moc) {
    console.log('MoC code 3 not found. Run seed-verification.ts first.')
  }

  // Create or find a verification method
  let method = await prisma.verMethod.findFirst({
    where: { projectId: pid, methodType: 'TEST' },
  })
  if (!method) {
    method = await prisma.verMethod.create({
      data: {
        projectId: pid,
        name: 'HIL Functional Test',
        methodType: 'TEST',
        description: 'Hardware-in-the-loop functional testing per DO-178C',
        linkedMocCode: 3,
        applicablePhases: ['QUALIFICATION', 'CERTIFICATION'],
        requiredEvidenceTypes: ['TEST_REPORT', 'TEST_RESULTS'],
        status: 'APPROVED',
      },
    })
    console.log(`Created method: ${method.name} (${method.id})`)
  }

  // Create or find a test setup
  let setup = await prisma.verTestSetup.findFirst({
    where: { projectId: pid },
  })
  if (!setup) {
    setup = await prisma.verTestSetup.create({
      data: {
        projectId: pid,
        name: 'HIL-Bench-01',
        description: 'Hardware-in-the-loop test bench for CAN bus validation',
        environmentType: 'HIL',
        components: [
          { name: 'DUT', role: 'Device Under Test' },
          { name: 'CAN Analyzer', role: 'Interface' },
          { name: 'Power Supply', role: 'Power' },
        ],
        interfaces: ['CAN 2.0B', 'Power', 'Ethernet'],
        version: '1.0',
        status: 'APPROVED',
      },
    })
    console.log(`Created setup: ${setup.name} (${setup.id})`)
  }

  // Check if test case already exists
  const existing = await prisma.verTestCase.findFirst({
    where: { projectId: pid, key: FULLY_POPULATED_TEST_CASE.key },
  })
  if (existing) {
    console.log(`Test case ${FULLY_POPULATED_TEST_CASE.key} already exists: ${existing.id}`)
    process.exit(0)
  }

  // Create fully populated test case
  const testCase = await prisma.verTestCase.create({
    data: {
      projectId: pid,
      key: FULLY_POPULATED_TEST_CASE.key,
      title: FULLY_POPULATED_TEST_CASE.title,
      objective: FULLY_POPULATED_TEST_CASE.objective,
      preconditions: FULLY_POPULATED_TEST_CASE.preconditions,
      steps: FULLY_POPULATED_TEST_CASE.steps as unknown as object,
      expectedResults: FULLY_POPULATED_TEST_CASE.expectedResults as unknown as object,
      passFailCriteria: FULLY_POPULATED_TEST_CASE.passFailCriteria,
      linkedMocCode: 3,
      linkedMethodId: method.id,
      status: 'READY',
      version: '1.0',
    },
    include: { moc: true, method: true },
  })
  console.log(`Created test case: ${testCase.key} - ${testCase.title} (${testCase.id})`)

  // Link setup to test case
  await prisma.verTestCaseSetup.create({
    data: {
      testCaseId: testCase.id,
      setupId: setup.id,
    },
  })
  console.log(`Linked setup ${setup.name} to test case`)

  console.log('Seed complete. Fully populated test case created.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
