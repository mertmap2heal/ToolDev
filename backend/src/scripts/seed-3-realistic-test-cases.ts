/**
 * Seed 3 fully populated verification test cases (realistic user-like content).
 *
 * Usage:
 *   npm run seed:test-cases-3 -- [projectId]
 *
 * If projectId is omitted, uses the first project found.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SeedCase = {
  key: string
  title: string
  objective: string
  preconditions: string
  steps: string[]
  expectedResults: string[]
  passFailCriteria: string
  customSections?: Array<{ title: string; contentHtml: string; orderIndex: number }>
}

const SEED_CASES: SeedCase[] = [
  {
    key: 'TC-UAV-COMMS-001',
    title: 'Loss-of-link failsafe triggers Return-to-Home (RTH)',
    objective:
      'Verify that the vehicle detects command-link loss and transitions to the configured failsafe mode (Return-to-Home), maintaining safe flight behavior until link is restored or landing completes.',
    preconditions:
      '1. Vehicle firmware build is installed and parameters are at default except failsafe settings.\n' +
      '2. A mission with a valid home position is configured.\n' +
      '3. GNSS lock is established (HDOP within limits).\n' +
      '4. Command link is established via radio telemetry.\n' +
      '5. Test bench can simulate link loss (radio power toggle or shielding).',
    steps: [
      'Arm the vehicle and take off to 20 m AGL in a controlled environment (HIL or safe test field).',
      'Confirm vehicle is in AUTO mission mode and receiving telemetry.',
      'Induce command-link loss by powering off the telemetry radio for 15 seconds.',
      'Observe flight mode transition and record timestamps of: link-loss detection, failsafe mode entry, and first RTH navigation command.',
      'Restore telemetry radio power and verify the vehicle reports link restoration.',
      'If configured to continue mission after link restore, verify it resumes mission; otherwise verify it loiters and awaits operator action.',
    ],
    expectedResults: [
      'Vehicle detects link loss within the configured timeout (≤ 3 s) and logs an event.',
      'Vehicle transitions into Return-to-Home failsafe mode and begins navigation to home without unstable attitude or altitude excursions.',
      'On link restoration, telemetry status returns to normal and the system follows the configured post-restore behavior (resume mission or loiter).',
    ],
    passFailCriteria:
      'PASS if link loss is detected within timeout, RTH is entered reliably, and recovery behavior matches configuration. FAIL if failsafe does not trigger, triggers late, or produces unsafe flight behavior.',
    customSections: [
      {
        title: 'Test data / configuration',
        orderIndex: 0,
        contentHtml:
          '<ul><li>Failsafe: <b>Return-to-Home</b></li><li>Link-loss timeout: <b>3s</b></li><li>RTH altitude: <b>30m</b></li><li>GNSS: <b>3D fix</b></li></ul>',
      },
      {
        title: 'Notes',
        orderIndex: 1,
        contentHtml:
          '<p>Run in HIL first. In field tests, ensure geofence and kill-switch are available and a safety pilot is present.</p>',
      },
    ],
  },
  {
    key: 'TC-UAV-NAV-002',
    title: 'Waypoint navigation accuracy under nominal wind',
    objective:
      'Verify that the navigation controller reaches a waypoint within the specified position tolerance and holds within tolerance for a sustained period under nominal wind conditions.',
    preconditions:
      '1. Vehicle is configured with navigation gains per baseline.\n' +
      '2. Wind profile is nominal (≤ 5 m/s) or simulated in HIL.\n' +
      '3. Waypoints are loaded: WP1 (takeoff), WP2 (hold), WP3 (return).\n' +
      '4. Logging is enabled for position, velocity, and controller setpoints.',
    steps: [
      'Take off and transition to AUTO mission mode.',
      'Command vehicle to navigate to WP2 and hold for 60 seconds.',
      'Record GNSS position and EKF position estimate throughout the hold.',
      'Compute the 2D distance error to WP2 for each sample and the time spent within tolerance.',
      'Command return to WP3/home and land.',
    ],
    expectedResults: [
      'Vehicle reaches WP2 and enters hold without oscillations or overshoot beyond safety limits.',
      '2D position error remains within 2.0 m for ≥ 55 of 60 seconds during the hold.',
      'Logged setpoints and measured states show stable control (no divergence, no integrator windup).',
    ],
    passFailCriteria:
      'PASS if the vehicle reaches WP2 and holds within tolerance as specified. FAIL if tolerance is exceeded for > 5 seconds or unstable control is observed.',
    customSections: [
      {
        title: 'Acceptance metrics',
        orderIndex: 0,
        contentHtml:
          '<ul><li>Hold time: <b>60s</b></li><li>Tolerance: <b>≤ 2.0m (2D)</b></li><li>Required in-tolerance: <b>≥ 55s</b></li></ul>',
      },
    ],
  },
  {
    key: 'TC-UAV-PWR-003',
    title: 'Low-battery warning and automated RTL initiation',
    objective:
      'Verify that low-battery thresholds generate the correct warnings and that the vehicle initiates the configured automated Return-to-Launch (RTL) sequence before critical voltage is reached.',
    preconditions:
      '1. Battery model is configured (capacity, cell count, voltage thresholds).\n' +
      '2. Vehicle is flying a loiter pattern at 20 m AGL (HIL or field).\n' +
      '3. Battery discharge can be accelerated in HIL or by controlled load profile.\n' +
      '4. Audible/visual warnings and event logs are enabled.',
    steps: [
      'Start with a fully charged battery (or HIL initial SOC ≥ 80%).',
      'Enter loiter at 20 m AGL and maintain for 3 minutes.',
      'Induce battery discharge until the warning threshold is crossed.',
      'Verify warning is presented to operator and event is logged.',
      'Continue discharge until the RTL trigger threshold is crossed.',
      'Verify RTL is initiated automatically and vehicle proceeds to launch/home position and lands (or enters final loiter per configuration).',
    ],
    expectedResults: [
      'Low-battery warning is emitted at the configured warning threshold and appears in logs/telemetry.',
      'RTL is initiated at the configured trigger threshold without operator intervention.',
      'Vehicle reaches home and executes the configured landing/loiter behavior while maintaining stable flight.',
    ],
    passFailCriteria:
      'PASS if warning and RTL trigger thresholds are respected and the vehicle completes the RTL sequence safely. FAIL if warnings are missing/late or RTL does not initiate.',
    customSections: [
      {
        title: 'Battery thresholds',
        orderIndex: 0,
        contentHtml:
          '<ul><li>Warning: <b>3.6V/cell</b></li><li>RTL trigger: <b>3.5V/cell</b></li><li>Critical: <b>3.3V/cell</b></li></ul>',
      },
    ],
  },
]

async function main() {
  const projectIdArg = process.argv[2]

  const firstUser = await prisma.user.findFirst({ select: { id: true } })
  if (!firstUser) {
    console.error('No user found. Run `npm run seed:users` first.')
    process.exit(1)
  }

  let project: { id: string } | null
  if (projectIdArg) {
    project = await prisma.project.findUnique({
      where: { id: projectIdArg },
      select: { id: true },
    })
    if (!project) {
      console.error(`Project ${projectIdArg} not found.`)
      process.exit(1)
    }
  } else {
    project = await prisma.project.findFirst({ select: { id: true } })
    if (!project) {
      console.error('No project found. Create a project first or pass projectId as argument.')
      process.exit(1)
    }
    console.log(`Using first project: ${project.id}`)
  }

  const projectId = project.id

  // Ensure MoC code 3 (Test) exists (seed:mocs usually handles this).
  const moc = await prisma.verMoc.findUnique({ where: { code: 3 } })
  if (!moc) {
    console.log('MoC code 3 not found. Consider running `npm run seed:mocs`.')
  }

  // Method (used by drawers / dropdowns)
  let method = await prisma.verMethod.findFirst({
    where: { projectId, methodType: 'TEST' },
  })
  if (!method) {
    method = await prisma.verMethod.create({
      data: {
        projectId,
        name: 'Flight Test Procedure',
        methodType: 'TEST',
        description: 'User-created flight test procedure for system validation',
        linkedMocCode: 3,
        applicablePhases: ['QUALIFICATION', 'CERTIFICATION'],
        requiredEvidenceTypes: ['TEST_REPORT', 'TEST_RESULTS'],
        status: 'APPROVED',
      },
    })
    console.log(`Created method: ${method.name} (${method.id})`)
  }

  // Setup (so cases appear with linked setups like real usage)
  let setup = await prisma.verTestSetup.findFirst({ where: { projectId } })
  if (!setup) {
    setup = await prisma.verTestSetup.create({
      data: {
        projectId,
        name: 'HIL-Bench-FlightStack',
        description: 'HIL bench with vehicle flight stack + telemetry injection',
        environmentType: 'HIL',
        components: [
          { name: 'Autopilot', role: 'Controller' },
          { name: 'GNSS simulator', role: 'Navigation' },
          { name: 'Telemetry radio', role: 'Comms' },
          { name: 'Power analyzer', role: 'Power' },
        ],
        interfaces: ['Telemetry', 'GNSS', 'Power'],
        version: '1.0',
        status: 'APPROVED',
      },
    })
    console.log(`Created setup: ${setup.name} (${setup.id})`)
  }

  for (const payload of SEED_CASES) {
    const existing = await prisma.verTestCase.findFirst({
      where: { projectId, key: payload.key },
    })
    if (existing) {
      console.log(`Test case ${payload.key} already exists: ${existing.id}`)
      const linkExists = await prisma.verTestCaseSetup.findFirst({
        where: { testCaseId: existing.id, setupId: setup.id },
      })
      if (!linkExists) {
        await prisma.verTestCaseSetup.create({ data: { testCaseId: existing.id, setupId: setup.id } })
        console.log(`Linked setup ${setup.name} to test case ${payload.key}`)
      }
      continue
    }

    const testCase = await prisma.verTestCase.create({
      data: {
        projectId,
        key: payload.key,
        title: payload.title,
        objective: payload.objective,
        preconditions: payload.preconditions,
        steps: payload.steps as unknown as object,
        expectedResults: payload.expectedResults as unknown as object,
        passFailCriteria: payload.passFailCriteria,
        linkedMocCode: 3,
        linkedMethodId: method.id,
        ownerUserId: firstUser.id,
        status: 'READY',
        version: '1.0',
      },
    })
    console.log(`Created test case: ${testCase.key} - ${testCase.title} (${testCase.id})`)

    await prisma.verTestCaseSetup.create({ data: { testCaseId: testCase.id, setupId: setup.id } })

    if (payload.customSections?.length) {
      for (const s of payload.customSections) {
        await prisma.verTestCaseCustomSection.create({
          data: {
            projectId,
            testCaseId: testCase.id,
            title: s.title,
            content: s.contentHtml,
            orderIndex: s.orderIndex,
          },
        })
      }
    }
  }

  console.log('Seed complete. 3 fully populated test cases created (TC-UAV-*-001..003).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

