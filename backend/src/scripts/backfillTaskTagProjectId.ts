/**
 * SEC-2 (#375) — Backfill TaskTag.projectId from TaskTagLink usage.
 *
 * Pre-fix: TaskTag.name was globally @unique. The fix drops the global unique
 * and adds @@unique([projectId, name]). Two scenarios:
 *
 *   1. Tag used by tasks in a single project -> set projectId to that project.
 *   2. Tag used by tasks in multiple projects -> duplicate the tag per-project
 *      and rewrite TaskTagLink rows to point at the per-project copies. The
 *      original row keeps projectId=null and (typically) ends up with zero
 *      links - it stays for the admin to review.
 *   3. Tag with zero usage -> projectId stays NULL (Postgres treats NULL as
 *      distinct under the composite unique, so multiple NULL rows with the
 *      same name coexist).
 *
 * Idempotent: tags that already have projectId set are skipped. Safe to
 * re-run.
 *
 * Run: tsx backend/src/scripts/backfillTaskTagProjectId.ts
 */
import { prisma } from '../lib/prisma'

interface BackfillStats {
  totalSeen: number
  alreadyBackfilled: number
  singleProjectAssigned: number
  splitMultiProject: number
  unusedNullKept: number
}

async function main(): Promise<BackfillStats> {
  const stats: BackfillStats = {
    totalSeen: 0,
    alreadyBackfilled: 0,
    singleProjectAssigned: 0,
    splitMultiProject: 0,
    unusedNullKept: 0,
  }

  // Pre-scan duplicate-name detection (informational only - the new schema
  // permits same-name-different-project so duplicates after backfill are
  // allowed).
  const tagsByName = await prisma.taskTag.groupBy({
    by: ['name'],
    _count: { name: true },
  })
  const dupes = tagsByName.filter((g) => g._count.name > 1)
  if (dupes.length > 0) {
    console.log(
      `[backfill] Found ${dupes.length} name(s) shared across multiple tag rows (pre-existing duplicates retained):`,
      dupes.map((d) => `${d.name} (${d._count.name})`).join(', '),
    )
  }

  const tags = await prisma.taskTag.findMany({
    select: { id: true, name: true, color: true, projectId: true },
  })

  stats.totalSeen = tags.length

  for (const tag of tags) {
    if (tag.projectId) {
      stats.alreadyBackfilled += 1
      continue
    }

    // Find which projects the tag is in use by (via TaskTagLink -> Task).
    const usage = await prisma.taskTagLink.findMany({
      where: { tagId: tag.id },
      select: { taskId: true, task: { select: { projectId: true } } },
    })

    const projectIds = Array.from(
      new Set(usage.map((u) => u.task?.projectId).filter((p): p is string => Boolean(p))),
    )

    if (projectIds.length === 0) {
      console.warn(
        `[backfill] TaskTag ${tag.id} ("${tag.name}") has no task usage. projectId remains NULL for admin review.`,
      )
      stats.unusedNullKept += 1
      continue
    }

    if (projectIds.length === 1) {
      // Single-project case: assign the projectId to the existing tag.
      const projectId = projectIds[0]
      await prisma.taskTag.update({
        where: { id: tag.id },
        data: { projectId },
      })
      console.log(
        `[backfill] TaskTag ${tag.id} ("${tag.name}") -> projectId=${projectId}`,
      )
      stats.singleProjectAssigned += 1
      continue
    }

    // Multi-project case: create per-project copies and rewrite links.
    console.log(
      `[backfill] SPLIT TaskTag ${tag.id} ("${tag.name}") across ${projectIds.length} projects: ${projectIds.join(', ')}`,
    )

    for (const projectId of projectIds) {
      await prisma.$transaction(async (tx) => {
        // Upsert the per-project tag (idempotent on re-run).
        const perProjectTag = await tx.taskTag.upsert({
          where: { projectId_name: { projectId, name: tag.name } },
          create: {
            name: tag.name,
            color: tag.color ?? null,
            projectId,
          },
          update: {},
        })

        if (perProjectTag.id === tag.id) {
          // Already pointing at this row; no-op.
          return
        }

        // Rewrite TaskTagLink rows for tasks in this project from the old
        // unscoped tag to the per-project copy.
        const tasksInProject = await tx.taskTagLink.findMany({
          where: {
            tagId: tag.id,
            task: { projectId },
          },
          select: { taskId: true },
        })

        for (const link of tasksInProject) {
          // Delete the old link.
          await tx.taskTagLink.delete({
            where: { taskId_tagId: { taskId: link.taskId, tagId: tag.id } },
          })
          // Create the new link to the per-project tag (upsert-style — skip
          // if a link to the per-project copy already exists, e.g. partial
          // re-run).
          const existing = await tx.taskTagLink.findUnique({
            where: { taskId_tagId: { taskId: link.taskId, tagId: perProjectTag.id } },
            select: { taskId: true },
          })
          if (!existing) {
            await tx.taskTagLink.create({
              data: { taskId: link.taskId, tagId: perProjectTag.id },
            })
          }
        }
      })
    }

    stats.splitMultiProject += 1
    console.warn(
      `[backfill] Original TaskTag ${tag.id} ("${tag.name}") kept with projectId=NULL after split; admin may delete if no longer referenced.`,
    )
  }

  return stats
}

main()
  .then((stats) => {
    console.log('[backfill] TaskTag backfill complete:', stats)
    return prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error('[backfill] FAILED:', err)
    await prisma.$disconnect()
    process.exit(1)
  })
