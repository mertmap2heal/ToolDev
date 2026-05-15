/**
 * SEC-2 (#375) — Backfill AutomationRule.projectId from AutomationRun history.
 *
 * Pre-fix: AutomationRule had no projectId column. Now nullable column exists;
 * this script resolves each legacy rule's projectId via its AutomationRun
 * history (inputJson stores `{ taskId }` per automation.service.ts:150).
 *
 * Defense-in-depth: rules with no resolvable projectId stay projectId=null
 * AND are forcibly set isActive=false so they cannot fire against unintended
 * projects during the admin-review window. Each orphan is logged so ops can
 * triage.
 *
 * Idempotent: rules that already have projectId set are skipped. Safe to
 * re-run.
 *
 * Run: tsx backend/src/scripts/backfillAutomationRuleProjectId.ts
 */
import { prisma } from '../lib/prisma'

interface BackfillStats {
  totalSeen: number
  alreadyBackfilled: number
  backfilledViaRuns: number
  orphanDeactivated: number
}

async function resolveProjectIdForRule(ruleId: string): Promise<string | null> {
  const runs = await prisma.automationRun.findMany({
    where: { ruleId },
    orderBy: { triggeredAt: 'desc' },
    select: { inputJson: true },
  })

  // Tally projectIds across run history; pick the most frequent.
  const tally = new Map<string, number>()

  for (const run of runs) {
    if (!run.inputJson) continue
    let taskId: string | undefined
    try {
      const parsed = JSON.parse(run.inputJson) as { taskId?: string }
      taskId = parsed?.taskId
    } catch {
      continue
    }
    if (!taskId) continue
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    })
    if (!task?.projectId) continue
    tally.set(task.projectId, (tally.get(task.projectId) ?? 0) + 1)
  }

  if (tally.size === 0) return null

  let best: { id: string; count: number } | null = null
  for (const [id, count] of tally.entries()) {
    if (!best || count > best.count) best = { id, count }
  }
  return best?.id ?? null
}

async function main(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    totalSeen: 0,
    alreadyBackfilled: 0,
    backfilledViaRuns: 0,
    orphanDeactivated: 0,
  }

  const rules = await prisma.automationRule.findMany({
    select: { id: true, name: true, projectId: true, isActive: true },
  })

  stats.totalSeen = rules.length

  for (const rule of rules) {
    if (rule.projectId) {
      stats.alreadyBackfilled += 1
      continue
    }

    const projectId = await resolveProjectIdForRule(rule.id)

    if (projectId) {
      await prisma.$transaction([
        prisma.automationRule.update({
          where: { id: rule.id },
          data: { projectId },
        }),
      ])
      stats.backfilledViaRuns += 1
      console.log(`[backfill] AutomationRule ${rule.id} ("${rule.name}") -> projectId=${projectId}`)
    } else {
      await prisma.$transaction([
        prisma.automationRule.update({
          where: { id: rule.id },
          data: { isActive: false },
        }),
      ])
      stats.orphanDeactivated += 1
      console.warn(
        `[backfill] ORPHAN AutomationRule ${rule.id} ("${rule.name}") - no AutomationRun history with a resolvable Task.projectId. Marked isActive=false; projectId remains NULL for admin review.`,
      )
    }
  }

  return stats
}

main()
  .then((stats) => {
    console.log('[backfill] AutomationRule backfill complete:', stats)
    return prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('[backfill] FAILED:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
