/**
 * Seed a project with a large parameter set so the virtualised table
 * (phase 2c-iii) can be tested at realistic aerospace scale.
 *
 * Usage:
 *   npx tsx backend/src/scripts/seed-scale-params.ts
 *   npx tsx backend/src/scripts/seed-scale-params.ts 5000            # 5k params
 *   npx tsx backend/src/scripts/seed-scale-params.ts 10000 owner@x   # 10k, pick owner
 *
 * Idempotent: re-running finds the existing project by slug and
 * top-ups parameters until the target count is reached.
 */
import { prisma } from '../lib/prisma'

const SCALE_SLUG = 'scale-test-params'
const SCALE_NAME = 'Scale Test - Parameters'
const SCALE_DOMAIN = 'aerospace'

const DATA_TYPES = ['float', 'int', 'double', 'uint8', 'uint16', 'bool', 'string']
const UNITS = ['kg', 'm', 's', 'K', 'A', 'V', 'W', 'N', 'Pa', 'rpm', 'deg', 'rad/s', null]
const STATUSES = ['draft', 'approved', 'obsolete']

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length]
}

async function main() {
  const targetCount = parseInt(process.argv[2] ?? '10000', 10)
  const ownerEmail = process.argv[3] ?? null

  if (!Number.isFinite(targetCount) || targetCount < 1) {
    throw new Error(`Invalid count: ${process.argv[2]}`)
  }

  // Resolve owner.
  let ownerId: string
  if (ownerEmail) {
    const u = await prisma.user.findUnique({ where: { email: ownerEmail } })
    if (!u) throw new Error(`No user with email ${ownerEmail}`)
    ownerId = u.id
  } else {
    const u = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!u) throw new Error('No users in DB; run `npm run seed:users` first')
    ownerId = u.id
    console.log(`[scale-params] using owner: ${u.email}`)
  }

  // Find-or-create project.
  const existingProject = await prisma.project.findUnique({ where: { slug: SCALE_SLUG } })
  const project =
    existingProject ??
    (await prisma.project.create({
      data: {
        name: SCALE_NAME,
        slug: SCALE_SLUG,
        domain: SCALE_DOMAIN,
        userId: ownerId,
        aiEnabled: true,
      },
    }))
  if (!existingProject) console.log(`[scale-params] created project ${project.id}`)
  else console.log(`[scale-params] reusing project ${project.id}`)

  // Ensure owner is a project member so requireProjectMember passes.
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: ownerId } },
    create: { userId: ownerId, projectId: project.id, role: 'owner', status: 'accepted' },
    update: {},
  })

  // Seed ~50 folders in a 3-level tree (root: 10, sub-per-root: 3, sub-sub-per-sub: 1)
  // Find-or-create each so re-runs don't duplicate.
  const existingFolders = await prisma.parameterFolder.findMany({
    where: { projectId: project.id },
  })
  const folderByName = new Map(existingFolders.map((f) => [f.name, f]))

  async function ensureFolder(
    name: string,
    color: string,
    parentId: string | null,
    order: number,
  ) {
    const found = folderByName.get(name)
    if (found) return found
    const created = await prisma.parameterFolder.create({
      data: { projectId: project.id, name, color, parentId, order },
    })
    folderByName.set(name, created)
    return created
  }

  const colors = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']
  const allFolderIds: (string | null)[] = [null] // null = ungrouped bucket too
  for (let r = 0; r < 10; r++) {
    const root = await ensureFolder(`Subsystem ${r + 1}`, pick(colors, r), null, r)
    allFolderIds.push(root.id)
    for (let s = 0; s < 3; s++) {
      const sub = await ensureFolder(
        `Subsystem ${r + 1} / Module ${s + 1}`,
        pick(colors, r + s + 1),
        root.id,
        s,
      )
      allFolderIds.push(sub.id)
      const subSub = await ensureFolder(
        `Subsystem ${r + 1} / Module ${s + 1} / Channel 1`,
        pick(colors, r + s + 2),
        sub.id,
        0,
      )
      allFolderIds.push(subSub.id)
    }
  }
  console.log(`[scale-params] folders: ${allFolderIds.length - 1} (+ ungrouped)`)

  // Count existing params, top up to target.
  const existing = await prisma.parameter.count({ where: { projectId: project.id } })
  const toCreate = Math.max(0, targetCount - existing)
  console.log(
    `[scale-params] existing params: ${existing}; target: ${targetCount}; creating: ${toCreate}`,
  )
  if (toCreate === 0) {
    console.log('[scale-params] already at target; done')
    return
  }

  const batchSize = 500
  const started = Date.now()
  for (let start = 0; start < toCreate; start += batchSize) {
    const count = Math.min(batchSize, toCreate - start)
    const rows = Array.from({ length: count }, (_, i) => {
      const globalIndex = existing + start + i
      return {
        projectId: project.id,
        name: `param_${String(globalIndex).padStart(6, '0')}`,
        description:
          globalIndex % 4 === 0
            ? `Synthetic parameter #${globalIndex} used for scale testing`
            : null,
        dataType: pick(DATA_TYPES, globalIndex),
        defaultValue: `${((globalIndex * 37) % 1000) / 10}`,
        unit: pick(UNITS, globalIndex),
        status: pick(STATUSES, globalIndex),
        folderId: allFolderIds[globalIndex % allFolderIds.length],
        authorType: 'human',
        classification: 'internal',
      }
    })
    await prisma.parameter.createMany({ data: rows, skipDuplicates: true })
    const done = Math.min(start + batchSize, toCreate)
    const elapsed = Math.round((Date.now() - started) / 1000)
    console.log(`[scale-params] ${done}/${toCreate}  (${elapsed}s)`)
  }

  const final = await prisma.parameter.count({ where: { projectId: project.id } })
  const elapsed = Math.round((Date.now() - started) / 1000)
  console.log(`[scale-params] done; final count ${final}; ${elapsed}s`)
  console.log(`[scale-params] open: /projects/${project.slug}/parameters`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
