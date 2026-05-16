import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import {
  createBaselineRoot,
  addBaselineItem,
  freezeBaselineRoot,
  getBaselineRoot,
  listBaselineRoots,
  compareBaselineRoots,
} from '../services/baseline.service'

/**
 * R-4 (#401) — unified baseline primitive (BaselineRoot / BaselineRootItem).
 *
 * Covers AC #7:
 *  - createBaselineRoot creates a root; an invalid kind is rejected.
 *  - addBaselineItem adds items; getBaselineRoot returns the root + its items.
 *  - listBaselineRoots filters by projectId and by kind.
 *  - freezeBaselineRoot sets status='frozen'; a subsequent addBaselineItem on
 *    that root throws.
 *  - compareBaselineRoots reports added / removed / changed correctly.
 *
 * Real DB, no mocks; isolated data with unique timestamped names. BaselineRoot
 * and BaselineRootItem are NOT append-only-guarded, so afterAll cleans them with
 * ordinary Prisma deleteMany in reverse-FK order.
 */
describe('R-4 — BaselineRoot unified baseline primitive', () => {
  const ts = Date.now()
  let userId: string
  let projectId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `baseline-test-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Baseline Test User',
      },
    })
    userId = user.id

    const project = await prisma.project.create({
      data: {
        name: `Baseline Project ${ts}`,
        domain: `baseline-${ts}`,
        slug: `baseline-${ts}`,
        userId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner' },
    })
  })

  afterAll(async () => {
    // Reverse-FK order: items -> roots -> projectMember -> project -> user.
    const roots = await prisma.baselineRoot.findMany({
      where: { projectId },
      select: { id: true },
    })
    const rootIds = roots.map((r) => r.id)
    if (rootIds.length > 0) {
      await prisma.baselineRootItem.deleteMany({
        where: { baselineRootId: { in: rootIds } },
      })
      await prisma.baselineRoot.deleteMany({ where: { projectId } })
    }
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('createBaselineRoot creates a root in draft status', async () => {
    const root = await createBaselineRoot({
      projectId,
      kind: 'VER',
      name: `Root create ${ts}`,
      description: 'a verification baseline',
      createdByUserId: userId,
    })

    expect(root.id).toBeDefined()
    expect(root.projectId).toBe(projectId)
    expect(root.kind).toBe('VER')
    expect(root.name).toBe(`Root create ${ts}`)
    expect(root.description).toBe('a verification baseline')
    expect(root.status).toBe('draft')
    expect(root.createdByUserId).toBe(userId)
  })

  it('createBaselineRoot rejects an invalid kind', async () => {
    await expect(
      createBaselineRoot({
        projectId,
        kind: 'BOGUS',
        name: `Root bad kind ${ts}`,
        createdByUserId: userId,
      }),
    ).rejects.toThrow(/invalid baseline kind/i)

    // No row was written for the rejected call.
    const roots = await prisma.baselineRoot.findMany({
      where: { projectId, kind: 'BOGUS' },
    })
    expect(roots.length).toBe(0)
  })

  it('addBaselineItem adds items and getBaselineRoot returns the root + items', async () => {
    const root = await createBaselineRoot({
      projectId,
      kind: 'PARAM',
      name: `Root with items ${ts}`,
      createdByUserId: userId,
    })

    const item1 = await addBaselineItem({
      baselineRootId: root.id,
      linkedEntityType: 'Parameter',
      linkedEntityId: `param-1-${ts}`,
      payload: JSON.stringify({ value: 42 }),
    })
    await addBaselineItem({
      baselineRootId: root.id,
      linkedEntityType: 'Parameter',
      linkedEntityId: `param-2-${ts}`,
      payload: JSON.stringify({ value: 99 }),
    })

    // contentHash is a deterministic sha256 hex digest of the payload.
    expect(item1.contentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(item1.baselineRootId).toBe(root.id)

    const fetched = await getBaselineRoot(root.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.id).toBe(root.id)
    expect(fetched!.items.length).toBe(2)
    const ids = fetched!.items.map((i) => i.linkedEntityId)
    expect(ids).toContain(`param-1-${ts}`)
    expect(ids).toContain(`param-2-${ts}`)
  })

  it('addBaselineItem computes the same contentHash for the same payload', async () => {
    const root = await createBaselineRoot({
      projectId,
      kind: 'CERT',
      name: `Root hash ${ts}`,
      createdByUserId: userId,
    })
    const payload = JSON.stringify({ artefact: 'deterministic' })
    const a = await addBaselineItem({
      baselineRootId: root.id,
      linkedEntityType: 'CertObjective',
      linkedEntityId: `obj-a-${ts}`,
      payload,
    })
    const b = await addBaselineItem({
      baselineRootId: root.id,
      linkedEntityType: 'CertObjective',
      linkedEntityId: `obj-b-${ts}`,
      payload,
    })
    expect(a.contentHash).toBe(b.contentHash)
  })

  it('getBaselineRoot returns null for a non-existent root', async () => {
    const fetched = await getBaselineRoot(`nonexistent-${ts}`)
    expect(fetched).toBeNull()
  })

  it('listBaselineRoots filters by projectId and by kind', async () => {
    // A second project — its roots must not leak into the first project's list.
    const otherProject = await prisma.project.create({
      data: {
        name: `Other Baseline Project ${ts}`,
        domain: `baseline-other-${ts}`,
        slug: `baseline-other-${ts}`,
        userId,
      },
    })
    try {
      await createBaselineRoot({
        projectId: otherProject.id,
        kind: 'VALIDATION',
        name: `Other-project root ${ts}`,
        createdByUserId: userId,
      })

      const allForProject = await listBaselineRoots(projectId)
      expect(allForProject.length).toBeGreaterThan(0)
      expect(allForProject.every((r) => r.projectId === projectId)).toBe(true)

      // kind filter narrows to a single kind.
      const verOnly = await listBaselineRoots(projectId, 'VER')
      expect(verOnly.every((r) => r.kind === 'VER')).toBe(true)
      expect(verOnly.length).toBeGreaterThan(0)

      const paramOnly = await listBaselineRoots(projectId, 'PARAM')
      expect(paramOnly.every((r) => r.kind === 'PARAM')).toBe(true)

      // The other project's VALIDATION root is not in this project's list.
      const validationForProject = await listBaselineRoots(projectId, 'VALIDATION')
      expect(validationForProject.length).toBe(0)
    } finally {
      await prisma.baselineRoot.deleteMany({ where: { projectId: otherProject.id } })
      await prisma.project.delete({ where: { id: otherProject.id } })
    }
  })

  it('freezeBaselineRoot sets status=frozen and blocks further addBaselineItem', async () => {
    const root = await createBaselineRoot({
      projectId,
      kind: 'CM',
      name: `Root to freeze ${ts}`,
      createdByUserId: userId,
    })

    // An item can be added while draft.
    await addBaselineItem({
      baselineRootId: root.id,
      linkedEntityType: 'ConfigItem',
      linkedEntityId: `ci-1-${ts}`,
      payload: JSON.stringify({ rev: 'A' }),
    })

    const frozen = await freezeBaselineRoot(root.id)
    expect(frozen.status).toBe('frozen')

    // A subsequent addBaselineItem on the frozen root throws.
    await expect(
      addBaselineItem({
        baselineRootId: root.id,
        linkedEntityType: 'ConfigItem',
        linkedEntityId: `ci-2-${ts}`,
        payload: JSON.stringify({ rev: 'B' }),
      }),
    ).rejects.toThrow(/frozen/i)

    // No second item was written.
    const fetched = await getBaselineRoot(root.id)
    expect(fetched!.items.length).toBe(1)
  })

  it('freezeBaselineRoot throws for a non-existent root', async () => {
    await expect(freezeBaselineRoot(`nonexistent-${ts}`)).rejects.toThrow(/not found/i)
  })

  it('compareBaselineRoots reports added / removed / changed correctly', async () => {
    // Root A: shared-unchanged, shared-rehashed, A-only.
    const rootA = await createBaselineRoot({
      projectId,
      kind: 'VER',
      name: `Compare A ${ts}`,
      createdByUserId: userId,
    })
    await addBaselineItem({
      baselineRootId: rootA.id,
      linkedEntityType: 'Requirement',
      linkedEntityId: `shared-unchanged-${ts}`,
      payload: JSON.stringify({ text: 'identical in both' }),
    })
    await addBaselineItem({
      baselineRootId: rootA.id,
      linkedEntityType: 'Requirement',
      linkedEntityId: `shared-rehashed-${ts}`,
      payload: JSON.stringify({ text: 'version one' }),
    })
    await addBaselineItem({
      baselineRootId: rootA.id,
      linkedEntityType: 'Requirement',
      linkedEntityId: `a-only-${ts}`,
      payload: JSON.stringify({ text: 'only in A' }),
    })

    // Root B: shared-unchanged (same hash), shared-rehashed (different hash), B-only.
    const rootB = await createBaselineRoot({
      projectId,
      kind: 'VER',
      name: `Compare B ${ts}`,
      createdByUserId: userId,
    })
    await addBaselineItem({
      baselineRootId: rootB.id,
      linkedEntityType: 'Requirement',
      linkedEntityId: `shared-unchanged-${ts}`,
      payload: JSON.stringify({ text: 'identical in both' }),
    })
    await addBaselineItem({
      baselineRootId: rootB.id,
      linkedEntityType: 'Requirement',
      linkedEntityId: `shared-rehashed-${ts}`,
      payload: JSON.stringify({ text: 'version two' }),
    })
    await addBaselineItem({
      baselineRootId: rootB.id,
      linkedEntityType: 'Requirement',
      linkedEntityId: `b-only-${ts}`,
      payload: JSON.stringify({ text: 'only in B' }),
    })

    const diff = await compareBaselineRoots(rootA.id, rootB.id)

    // added = in B, not in A.
    expect(diff.added.length).toBe(1)
    expect(diff.added[0].linkedEntityId).toBe(`b-only-${ts}`)

    // removed = in A, not in B.
    expect(diff.removed.length).toBe(1)
    expect(diff.removed[0].linkedEntityId).toBe(`a-only-${ts}`)

    // changed = same entity key, different contentHash.
    expect(diff.changed.length).toBe(1)
    expect(diff.changed[0].a.linkedEntityId).toBe(`shared-rehashed-${ts}`)
    expect(diff.changed[0].b.linkedEntityId).toBe(`shared-rehashed-${ts}`)
    expect(diff.changed[0].a.contentHash).not.toBe(diff.changed[0].b.contentHash)
  })

  it('compareBaselineRoots reports empty buckets for two identical roots', async () => {
    const rootA = await createBaselineRoot({
      projectId,
      kind: 'PARAM',
      name: `Identical A ${ts}`,
      createdByUserId: userId,
    })
    const rootB = await createBaselineRoot({
      projectId,
      kind: 'PARAM',
      name: `Identical B ${ts}`,
      createdByUserId: userId,
    })
    const payload = JSON.stringify({ value: 'same' })
    for (const root of [rootA, rootB]) {
      await addBaselineItem({
        baselineRootId: root.id,
        linkedEntityType: 'Parameter',
        linkedEntityId: `identical-item-${ts}`,
        payload,
      })
    }

    const diff = await compareBaselineRoots(rootA.id, rootB.id)
    expect(diff.added.length).toBe(0)
    expect(diff.removed.length).toBe(0)
    expect(diff.changed.length).toBe(0)
  })

  it('compareBaselineRoots handles empty roots', async () => {
    const emptyA = await createBaselineRoot({
      projectId,
      kind: 'CERT',
      name: `Empty A ${ts}`,
      createdByUserId: userId,
    })
    const emptyB = await createBaselineRoot({
      projectId,
      kind: 'CERT',
      name: `Empty B ${ts}`,
      createdByUserId: userId,
    })

    const diff = await compareBaselineRoots(emptyA.id, emptyB.id)
    expect(diff.added.length).toBe(0)
    expect(diff.removed.length).toBe(0)
    expect(diff.changed.length).toBe(0)
  })
})
