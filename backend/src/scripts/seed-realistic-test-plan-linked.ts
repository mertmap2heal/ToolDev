/**
 * Seed a fully populated, realistic verification test plan and link it to:
 *  - 3 realistic test cases (TC-UAV-COMMS-001, TC-UAV-NAV-002, TC-UAV-PWR-003)
 *  - an existing test setup (first setup in the project)
 *
 * Notes:
 * - There is no direct TestPlan<->TestSetup relation in Prisma schema; the UI generally infers setup usage via linked test cases.
 * - This script ensures each seeded test case is linked to the selected setup so the plan shows setup usage naturally.
 *
 * Usage:
 *   npm run seed:test-plan-real -- [projectId]
 */
import { prisma } from '../lib/prisma'


const formatDate = (date: Date) => date.toISOString().slice(0, 10)

const PLAN = {
  key: 'TP-UAV-QUAL-001',
  name: 'Qualification Flight Test Plan – Comms, Nav & Power',
  description:
    'User-created qualification plan focused on comms failsafes, navigation accuracy, and power/battery behaviors. Intended for repeated execution across builds during QUALIFICATION and early CERTIFICATION readiness.',
  scope:
    'Covers end-to-end behaviors for (1) command-link loss failsafe and recovery, (2) waypoint navigation accuracy/hold stability, and (3) low-battery warning + automated RTL initiation. Includes HIL execution and field execution where applicable.',
  entryCriteria:
    '1. Target firmware build is deployed and version recorded.\n' +
    '2. GNSS and telemetry are operational (or simulated) and vehicle can arm.\n' +
    '3. Test setup is approved and calibrated.\n' +
    '4. Safety constraints reviewed (geofence, kill switch, safety pilot).\n' +
    '5. Logging enabled (position, mode transitions, battery metrics).',
  exitCriteria:
    '1. All mandatory test cases executed and results recorded.\n' +
    '2. All failures triaged with NC/issue links and dispositions.\n' +
    '3. Evidence exported (reports/logs) and reviewed.\n' +
    '4. Plan status updated to APPROVED/ACTIVE per review outcome.',
  phase: 'QUALIFICATION' as const,
  status: 'ACTIVE' as const,
}

const CASE_KEYS = ['TC-UAV-COMMS-001', 'TC-UAV-NAV-002', 'TC-UAV-PWR-003'] as const

async function main() {
  const projectIdArg = process.argv[2]

  const owner = await prisma.user.findFirst({ select: { id: true } })
  if (!owner) {
    console.error('No user found. Run `npm run seed:users` first.')
    process.exit(1)
  }

  const project =
    projectIdArg
      ? await prisma.project.findUnique({ where: { id: projectIdArg }, select: { id: true } })
      : await prisma.project.findFirst({ select: { id: true } })

  if (!project) {
    console.error('No project found. Create a project first or pass projectId as argument.')
    process.exit(1)
  }

  const projectId = project.id
  if (!projectIdArg) console.log(`Using first project: ${projectId}`)

  // Pick an existing setup (requested). If none exist, fail loudly (so user knows to create/seed one).
  const setup = await prisma.verTestSetup.findFirst({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!setup) {
    console.error('No test setup found in this project. Create one in the UI or run a setup seed first.')
    process.exit(1)
  }

  // Find the 3 realistic test cases (created by previous seed script).
  const testCases = await prisma.verTestCase.findMany({
    where: { projectId, key: { in: [...CASE_KEYS] } },
    select: { id: true, key: true, title: true },
    orderBy: { key: 'asc' },
  })
  if (testCases.length !== CASE_KEYS.length) {
    const found = new Set(testCases.map((c) => c.key))
    const missing = CASE_KEYS.filter((k) => !found.has(k))
    console.error(`Missing seeded test case(s): ${missing.join(', ')}. Run \`npm run seed:test-cases-3\` first.`)
    process.exit(1)
  }

  // Ensure each seeded test case is linked to the chosen setup (so plan setup usage is visible in UI via cases).
  for (const tc of testCases) {
    const existingLink = await prisma.verTestCaseSetup.findFirst({
      where: { testCaseId: tc.id, setupId: setup.id },
      select: { id: true },
    })
    if (!existingLink) {
      await prisma.verTestCaseSetup.create({ data: { testCaseId: tc.id, setupId: setup.id } })
      console.log(`Linked setup "${setup.name}" to test case ${tc.key}`)
    }
  }

  let plan = await prisma.verTestPlan.findFirst({
    where: { projectId, key: PLAN.key },
    include: { planCases: true, planSetups: true },
  })

  if (!plan) {
    plan = await prisma.verTestPlan.create({
      data: {
        projectId,
        key: PLAN.key,
        name: PLAN.name,
        description: PLAN.description,
        scope: PLAN.scope,
        entryCriteria: PLAN.entryCriteria,
        exitCriteria: PLAN.exitCriteria,
        phase: PLAN.phase,
        ownerUserId: owner.id,
        status: PLAN.status,
        // NOTE: do not seed any real document identifiers/labels; keep placeholders only.
        docNumber: PLAN.key,
        docConfidentiality: 'INTERNAL',
        docProjectCode: null,
        docRevision: '1.0',
        docPlanDate: new Date(),
        docPreparedByName: 'Test Engineer',
        docQaByName: 'QA Engineer',
        docApprovedByName: 'Verification Lead',
        docApprovedAt: null,
        docPurpose: 'Define the qualification test strategy and detailed procedures for comms failsafe, navigation accuracy, and power/battery behaviors.',
        docOverview: 'This test plan covers a combination of HIL and field validations and defines the tools, setup, and evidence capture requirements.',
        docStatementOfConformity: 'The test cases herein demonstrate compliance to the linked requirements when executed with a controlled and approved setup.',
        docChangesPolicy: 'Changes to this document shall be recorded in revision control and reviewed prior to execution.',
        docDistribution: 'Internal distribution to engineering, QA, and verification stakeholders.',
        docAcronymsNote: 'UAV: Unmanned Aerial Vehicle; GNSS: Global Navigation Satellite System; RTL: Return-To-Launch; HIL: Hardware-In-The-Loop.',
        docApplicableDocuments: [
          { title: 'Requirements Specification', revision: 'A', date: formatDate(new Date()) },
          { title: 'Safety & Operations Manual', revision: '1.2' },
        ] as any,
        docGeneralPrecautions:
          'Ensure a safety pilot is present for field testing. Verify geofence and kill switch. Maintain safe separation distance and clear the test area prior to arming.',
        docTools: [
          { name: 'Ground Control Station', manufacturer: 'QGC', partNumber: '', serialNumber: '', calibrationValidTill: '' },
          { name: 'Telemetry Radio', manufacturer: 'Generic', partNumber: '', serialNumber: '', calibrationValidTill: '' },
        ] as any,
        docTestSetupNotes: 'Use the linked setup(s) for all executions unless an approved deviation is documented in the revision control.',
      },
      include: { planCases: true, planSetups: true },
    })
    console.log(`Created test plan: ${plan.key} - ${plan.name} (${plan.id})`)
  } else {
    console.log(`Test plan ${plan.key} already exists: ${plan.id}`)
    // Backfill document metadata for existing plan (so exports look like the reference)
    plan = await prisma.verTestPlan.update({
      where: { id: plan.id },
      data: {
        docNumber: plan.docNumber ?? PLAN.key,
        docConfidentiality: plan.docConfidentiality ?? 'INTERNAL',
        docProjectCode: plan.docProjectCode ?? null,
        docRevision: plan.docRevision ?? '1.0',
        docPlanDate: plan.docPlanDate ?? new Date(),
        docPreparedByName: plan.docPreparedByName ?? 'Test Engineer',
        docQaByName: plan.docQaByName ?? 'QA Engineer',
        docApprovedByName: plan.docApprovedByName ?? 'Verification Lead',
        docPurpose:
          plan.docPurpose ??
          'Define the qualification test strategy and detailed procedures for comms failsafe, navigation accuracy, and power/battery behaviors.',
        docOverview:
          plan.docOverview ??
          'This test plan covers a combination of HIL and field validations and defines the tools, setup, and evidence capture requirements.',
        docStatementOfConformity:
          plan.docStatementOfConformity ??
          'The test cases herein demonstrate compliance to the linked requirements when executed with a controlled and approved setup.',
        docChangesPolicy: plan.docChangesPolicy ?? 'Changes to this document shall be recorded in revision control and reviewed prior to execution.',
        docDistribution: plan.docDistribution ?? 'Internal distribution to engineering, QA, and verification stakeholders.',
        docAcronymsNote:
          plan.docAcronymsNote ??
          'UAV: Unmanned Aerial Vehicle; GNSS: Global Navigation Satellite System; RTL: Return-To-Launch; HIL: Hardware-In-The-Loop.',
        docApplicableDocuments:
          (plan.docApplicableDocuments as any) ??
          ([
            { title: 'Requirements Specification', revision: 'A', date: formatDate(new Date()) },
            { title: 'Safety & Operations Manual', revision: '1.2' },
          ] as any),
        docGeneralPrecautions:
          plan.docGeneralPrecautions ??
          'Ensure a safety pilot is present for field testing. Verify geofence and kill switch. Maintain safe separation distance and clear the test area prior to arming.',
        docTools:
          (plan.docTools as any) ??
          ([
            { name: 'Ground Control Station', manufacturer: 'QGC', partNumber: '', serialNumber: '', calibrationValidTill: '' },
            { name: 'Telemetry Radio', manufacturer: 'Generic', partNumber: '', serialNumber: '', calibrationValidTill: '' },
          ] as any),
        docTestSetupNotes:
          plan.docTestSetupNotes ??
          'Use the linked setup(s) for all executions unless an approved deviation is documented in the revision control.',
      },
      include: { planCases: true, planSetups: true },
    })
  }

  // Ensure at least one revision control entry exists for export
  const revExists = await prisma.verTestPlanRevision.findFirst({
    where: { projectId, testPlanId: plan.id, revisionNumber: '1.0' },
    select: { id: true },
  })
  if (!revExists) {
    await prisma.verTestPlanRevision.create({
      data: {
        projectId,
        testPlanId: plan.id,
        revisionNumber: '1.0',
        revisionDate: new Date(),
        editedByName: 'Test Engineer',
        approvedByName: '',
        approvedAt: null,
        summaryOfChanges: 'Initial release.',
      },
    })
  }

  // Link the chosen setup directly to the plan (requested).
  const existingPlanSetup = await prisma.verTestPlanSetup.findFirst({
    where: { testPlanId: plan.id, setupId: setup.id },
    select: { id: true },
  })
  if (!existingPlanSetup) {
    await prisma.verTestPlanSetup.create({
      data: { testPlanId: plan.id, setupId: setup.id },
    })
    console.log(`Linked setup "${setup.name}" to test plan ${plan.key}`)
  }

  const linkedCaseIds = new Set(plan.planCases.map((pc) => pc.testCaseId))
  let orderIndex = plan.planCases.length
  const notesByKey: Record<string, string> = {
    'TC-UAV-COMMS-001': 'Comms failsafe validation with telemetry drop + recovery.',
    'TC-UAV-NAV-002': 'Navigation accuracy/hold stability; include log post-processing.',
    'TC-UAV-PWR-003': 'Low-battery warning + RTL threshold behavior; verify logs and UI warnings.',
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
    console.log(`Added ${tc.key} to plan ${plan.key}`)
    linkedCaseIds.add(tc.id)
    orderIndex += 1
  }

  console.log(`Seed complete. Plan ${PLAN.key} is linked to ${CASE_KEYS.length} test cases and uses setup "${setup.name}" via test-case links.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

