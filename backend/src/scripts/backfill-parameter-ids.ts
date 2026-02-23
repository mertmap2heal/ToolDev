/**
 * One-time backfill: assign readable parameterId (PARAM-001, PARAM-002, ...)
 * to all parameters that don't have one yet.
 * Run with: npx tsx src/scripts/backfill-parameter-ids.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const withoutId = await prisma.parameter.findMany({
    where: { parameterId: null },
    select: { id: true, projectId: true, name: true, createdAt: true },
    orderBy: [{ projectId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  })

  if (withoutId.length === 0) {
    console.log('No parameters missing parameterId. Nothing to do.')
    return
  }

  // Group by project and assign PARAM-001, PARAM-002, ... per project
  const byProject = new Map<string, typeof withoutId>()
  for (const p of withoutId) {
    const list = byProject.get(p.projectId) ?? []
    list.push(p)
    byProject.set(p.projectId, list)
  }

  let updated = 0
  for (const [projectId, params] of byProject) {
    const existing = await prisma.parameter.findMany({
      where: { projectId, parameterId: { not: null } },
      select: { parameterId: true },
    })
    let maxNum = 0
    for (const p of existing) {
      if (p.parameterId && /^PARAM-\d+$/.test(p.parameterId)) {
        const m = p.parameterId.match(/-(\d+)$/)
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10))
      }
    }
    for (const p of params) {
      maxNum += 1
      const parameterId = `PARAM-${maxNum.toString().padStart(3, '0')}`
      await prisma.parameter.update({
        where: { id: p.id },
        data: { parameterId },
      })
      console.log(`  ${parameterId}  ${p.name} (${p.id.slice(0, 8)})`)
      updated += 1
    }
  }

  console.log(`\nDone. Assigned readable IDs to ${updated} parameter(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
