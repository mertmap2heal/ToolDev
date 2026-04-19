/**
 * Seed a test run from the seed test plan (TP-SEED-001) with run results for each test case.
 * Run after seed-test-case and seed-test-plan.
 * Usage: npx tsx src/scripts/seed-test-run.ts [projectId]
 * If projectId is omitted, uses the first project found.
 */
import { prisma } from '../lib/prisma'
import { createTestCycleBuilder } from '../services/verification/TestCycleBuilder'


const SEED_RUN_NAME = 'Seed Run 1'

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

  const plan = await prisma.verTestPlan.findFirst({
    where: { projectId: pid, key: 'TP-SEED-001' },
    include: { planCases: { orderBy: { orderIndex: 'asc' } } },
  })
  if (!plan) {
    console.error('Test plan TP-SEED-001 not found. Run seed-test-plan first.')
    process.exit(1)
  }
  if (plan.planCases.length === 0) {
    console.error('Test plan has no test cases. Run seed-test-plan to add cases.')
    process.exit(1)
  }
  console.log(`Found test plan: ${plan.key} (${plan.id}) with ${plan.planCases.length} case(s)`)

  const existingRun = await prisma.verTestRun.findFirst({
    where: { projectId: pid, testPlanId: plan.id, runName: SEED_RUN_NAME, deletedAt: null },
  })
  if (existingRun) {
    console.log(`Seed run "${SEED_RUN_NAME}" already exists: ${existingRun.id}`)
    console.log('Seed complete (idempotent).')
    return
  }

  const builder = createTestCycleBuilder({
    projectId: pid,
    runName: SEED_RUN_NAME,
    executedByUserId: null,
  })
  const testRun = await builder.forPlan(plan.id).build()
  console.log(`Created test run: ${testRun.runName} (${testRun.id})`)

  const results = await prisma.verTestRunResult.findMany({
    where: { testRunId: testRun.id },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Created ${results.length} run result(s)`)

  await prisma.verTestRun.update({
    where: { id: testRun.id },
    data: {
      status: 'COMPLETED',
      actualDurationSeconds: 120,
      startedAt: new Date(Date.now() - 130000),
      endedAt: new Date(),
    },
  })
  console.log('Updated run to COMPLETED with duration 120s')

  const statuses = ['PASS', 'PASS', 'FAIL', 'PASS']
  for (let i = 0; i < results.length && i < statuses.length; i++) {
    await prisma.verTestRunResult.update({
      where: { id: results[i].id },
      data: { resultStatus: statuses[i] },
    })
    console.log(`Set run result ${i + 1} to ${statuses[i]}`)
  }

  console.log('Seed complete. Test run and run results created.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
