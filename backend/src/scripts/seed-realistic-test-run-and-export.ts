/**
 * Seed a realistic test run for TP-UAV-QUAL-001 and export results into Test Results.
 *
 * Creates:
 *  - VerTestRun with per-test-case results
 *  - Rich actual result blocks + step outcomes (like a real user)
 *  - Exported VerTestResult linked to the plan and test cases (via TestExecutionService.completeAndExport)
 *
 * Usage:
 *   npm run seed:test-run-real -- [projectId]
 */
import { prisma } from '../lib/prisma'
import { createTestCycleBuilder } from '../services/verification/TestCycleBuilder'
import { testExecutionService } from '../services/verification/TestExecutionService'


const PLAN_KEY = 'TP-UAV-QUAL-001'
const RUN_NAME = 'Qualification Run – Build 2026.04.06-rc1'

const CASE_STATUS: Record<string, { status: string; note: string }> = {
  'TC-UAV-COMMS-001': {
    status: 'PASS',
    note: 'Failsafe entered within 2.1s. Mode transition and RTH track stable. Link restored and vehicle loitered as configured.',
  },
  'TC-UAV-NAV-002': {
    status: 'PASSED_WITH_ERRORS',
    note: 'Within tolerance for 58/60 seconds. Brief 2.3m excursion coincided with GNSS jitter spike; controller remained stable.',
  },
  'TC-UAV-PWR-003': {
    status: 'FAIL',
    note: 'Low-battery warning displayed, but RTL trigger occurred ~18s late (below configured threshold). Needs investigation.',
  },
}

function richText(html: string): string {
  return html
}

async function main() {
  const projectIdArg = process.argv[2]

  const user = await prisma.user.findFirst({ select: { id: true } })
  if (!user) {
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

  const plan = await prisma.verTestPlan.findFirst({
    where: { projectId, key: PLAN_KEY },
    select: { id: true, key: true },
  })
  if (!plan) {
    console.error(`Test plan ${PLAN_KEY} not found. Run \`npm run seed:test-plan-real\` first.`)
    process.exit(1)
  }

  const existingRun = await prisma.verTestRun.findFirst({
    where: { projectId, testPlanId: plan.id, runName: RUN_NAME, deletedAt: null },
    select: { id: true },
  })
  if (existingRun) {
    console.log(`Run "${RUN_NAME}" already exists: ${existingRun.id}`)
    console.log('Seed complete (idempotent).')
    return
  }

  // Build a run from the plan (creates run results per case).
  const builder = createTestCycleBuilder({
    projectId,
    runName: RUN_NAME,
    executedByUserId: user.id,
  })
  const run = await builder.forPlan(plan.id).build()
  console.log(`Created test run: ${run.runName} (${run.id})`)

  // Start timer (creates audit trail + segment)
  await testExecutionService.startTimer(projectId, run.id, user.id)

  const runWithResults = await prisma.verTestRun.findUnique({
    where: { id: run.id },
    include: {
      results: {
        include: { testCase: { select: { key: true, title: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!runWithResults) throw new Error('Run not found after creation')

  // Fill results like a real run: statuses, notes, rich actual blocks, step outcomes.
  const start = Date.now() - 8 * 60 * 1000
  for (let i = 0; i < runWithResults.results.length; i++) {
    const r = runWithResults.results[i]
    const key = r.testCase?.key ?? ''
    const desired = CASE_STATUS[key]
    if (!desired) continue

    // Stamp an execution time per scenario.
    await prisma.verTestRunResult.update({
      where: { id: r.id },
      data: { executedAt: new Date(start + (i + 1) * 60 * 1000) },
    })

    await testExecutionService.updateResultStatus(projectId, r.id, desired.status, user.id, 'Seeded execution')

    await testExecutionService.addActualResultBlock(projectId, r.id, {
      type: 'TEXT_RICH',
      textContent: richText(
        `<p><b>Observed:</b> ${desired.note}</p>` +
          `<ul>` +
          `<li>Operator: ${user.id.slice(0, 8)}</li>` +
          `<li>Run context: ${RUN_NAME}</li>` +
          `</ul>`
      ),
    })

    const stepOutcomes = [
      { stepIndex: 0, status: 'PASS', note: 'Setup and preconditions satisfied.' },
      { stepIndex: 1, status: desired.status === 'FAIL' ? 'PASS' : 'PASS', note: 'Procedure executed as written.' },
      {
        stepIndex: 2,
        status: desired.status === 'FAIL' ? 'FAIL' : desired.status === 'PASSED_WITH_ERRORS' ? 'PASS' : 'PASS',
        note: desired.status === 'FAIL'
          ? 'RTL initiation lag observed; see fail conditions.'
          : desired.status === 'PASSED_WITH_ERRORS'
            ? 'Minor excursion; see note.'
            : 'All checks within limits.',
      },
    ]

    const failConditions = desired.status === 'FAIL'
      ? 'RTL trigger occurred below configured threshold (late trigger).'
      : undefined

    await prisma.verTestRunResult.update({
      where: { id: r.id },
      data: {
        notes: desired.note,
        actualResults: { stepOutcomes, ...(failConditions ? { failConditions } : {}) } as any,
      },
    })
  }

  // Pause/stop timer to compute duration; then export to Test Results.
  await testExecutionService.pauseTimer(projectId, run.id, user.id).catch(() => {})
  await testExecutionService.stopTimer(projectId, run.id, user.id).catch(() => {})

  const exported = await testExecutionService.completeAndExport(projectId, run.id, user.id)
  console.log(`Exported to Test Result: ${exported.testResult.title} (${exported.testResult.id})`)

  console.log('Seed complete. Realistic test run results created and exported.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

