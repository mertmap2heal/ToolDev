/**
 * Seed a fully populated test case for verification testing.
 * Usage: npx tsx src/scripts/seed-test-case.ts [projectId]
 * If projectId is omitted, uses the first project found.
 */
import { prisma } from '../lib/prisma'


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

const ADDITIONAL_TEST_CASES = [
  {
    key: 'TC-SEED-002',
    title: 'Functional Test – CAN Bus Error Handling',
    objective: 'Verify that the system correctly detects and reports CAN bus errors (e.g. bit errors, form errors) and enters safe state per safety requirements.',
    preconditions:
      '1. DUT is powered and HIL-Bench-01 is connected.\n2. CAN analyzer is configured to inject error frames.\n3. Test case TC-SEED-001 has been executed successfully.',
    steps: [
      'Configure CAN analyzer to inject a single bit error at a defined frame index.',
      'Run the data acquisition sequence for 30 seconds.',
      'Verify error counters and system response (e.g. error passive, bus-off).',
      'Clear errors and verify recovery to normal operation.',
    ],
    expectedResults: [
      'Bit error is detected and error counter increments.',
      'System logs the error and does not corrupt application data.',
      'Recovery procedure completes within 100 ms of error clearance.',
    ],
    passFailCriteria: 'PASS if error detection and recovery behave per specification. FAIL if undetected errors or data corruption.',
  },
  {
    key: 'TC-SEED-003',
    title: 'Functional Test – Frame Timing and Jitter',
    objective: 'Verify that CAN frame reception timing and jitter are within specified limits for the data acquisition subsystem.',
    preconditions:
      '1. HIL-Bench-01 is calibrated. DUT and CAN generator are synchronized.\n2. Test data set TD-002 (timing vectors) is loaded.',
    steps: [
      'Start periodic transmission from CAN generator at 10 ms period.',
      'Record timestamps of first 100 received frames on DUT.',
      'Compute inter-frame intervals and jitter (max deviation from nominal).',
      'Compare against limits: period 10 ms ± 0.5 ms, jitter ≤ 0.2 ms.',
    ],
    expectedResults: [
      'All 100 frames received within timeout.',
      'Mean period within 10 ms ± 0.3 ms.',
      'Jitter does not exceed 0.2 ms.',
    ],
    passFailCriteria: 'PASS if timing and jitter are within limits. FAIL otherwise.',
  },
  {
    key: 'TC-SEED-004',
    title: 'Functional Test – Off-Nominal Power Cycle During Transfer',
    objective: 'Verify system behavior when power is cycled during an active CAN data transfer (graceful degradation and recovery).',
    preconditions:
      '1. DUT connected to HIL-Bench-01 with controllable power supply.\n2. Data acquisition is running (as in TC-SEED-001).',
    steps: [
      'Start data acquisition and allow 5 seconds of normal operation.',
      'Remove power from DUT for 2 seconds.',
      'Restore power and monitor startup sequence.',
      'Verify that no partial/corrupt frames are forwarded after recovery.',
      'Confirm full re-sync within 10 seconds.',
    ],
    expectedResults: [
      'DUT enters low-power or safe state during power loss.',
      'On restore, DUT completes initialization without errors.',
      'Data acquisition resumes and next frame received is valid (no carry-over of pre-power-loss state).',
    ],
    passFailCriteria: 'PASS if recovery is clean and no data corruption. FAIL if corrupt data or failure to re-sync.',
  },
]

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

  const allCases = [FULLY_POPULATED_TEST_CASE, ...ADDITIONAL_TEST_CASES]

  for (const payload of allCases) {
    const existing = await prisma.verTestCase.findFirst({
      where: { projectId: pid, key: payload.key },
    })
    if (existing) {
      console.log(`Test case ${payload.key} already exists: ${existing.id}`)
      const linkExists = await prisma.verTestCaseSetup.findFirst({
        where: { testCaseId: existing.id, setupId: setup.id },
      })
      if (!linkExists) {
        await prisma.verTestCaseSetup.create({
          data: { testCaseId: existing.id, setupId: setup.id },
        })
        console.log(`Linked setup ${setup.name} to test case ${payload.key}`)
      }
      continue
    }

    const testCase = await prisma.verTestCase.create({
      data: {
        projectId: pid,
        key: payload.key,
        title: payload.title,
        objective: payload.objective,
        preconditions: payload.preconditions,
        steps: payload.steps as unknown as object,
        expectedResults: payload.expectedResults as unknown as object,
        passFailCriteria: payload.passFailCriteria,
        linkedMocCode: 3,
        linkedMethodId: method.id,
        status: 'READY',
        version: '1.0',
      },
      include: { moc: true, method: true },
    })
    console.log(`Created test case: ${testCase.key} - ${testCase.title} (${testCase.id})`)

    await prisma.verTestCaseSetup.create({
      data: { testCaseId: testCase.id, setupId: setup.id },
    })
    console.log(`Linked setup ${setup.name} to test case`)
  }

  console.log('Seed complete. Fully populated test cases created (TC-SEED-001 through TC-SEED-004).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
