/**
 * Engineering-role seed idempotency tests (R-7, issue #407).
 *
 * Covers `seedEngineeringRoles()` from scripts/seed-engineering-roles.ts:
 *   - AC#1: running it seeds every predefined role incl. `CCB Member`;
 *           a second run is a no-op (no duplicates).
 *   - AC#2: an already-populated catalogue is not mutated by a re-run —
 *           verified by SNAPSHOT-COMPARE (snapshot a predefined row, run the
 *           seed, snapshot again, deep-equal). The test itself never mutates
 *           the shared catalogue.
 *
 * Real DB, no mocks (.claude/testing.md).
 *
 * IMPORTANT: the 17 predefined `EngineeringRole` rows are shared global data.
 * Other suites and the running app depend on them. This suite must NOT delete
 * predefined rows in afterAll — it only seeds (idempotently) and reads.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import { PREDEFINED_ENGINEERING_ROLES } from '../lib/engineeringRoles'
import { seedEngineeringRoles } from '../scripts/seed-engineering-roles'

describe('seedEngineeringRoles — idempotent catalogue seed (R-7)', () => {
  beforeAll(async () => {
    // Establish a known-good baseline: the catalogue is fully seeded once.
    await seedEngineeringRoles()
  })

  it('AC#1: seeds every predefined role, each present exactly once', async () => {
    // Run a second time — must be a no-op.
    await seedEngineeringRoles()

    for (const name of PREDEFINED_ENGINEERING_ROLES) {
      const count = await prisma.engineeringRole.count({ where: { name } })
      expect(count, `role "${name}" should be present exactly once`).toBe(1)
    }
  })

  it('AC#1: `CCB Member` is present exactly once', async () => {
    const count = await prisma.engineeringRole.count({
      where: { name: 'CCB Member' },
    })
    expect(count).toBe(1)
  })

  it('AC#1: no duplicate names exist in the catalogue', async () => {
    const all = await prisma.engineeringRole.findMany({ select: { name: true } })
    const names = all.map((r) => r.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })

  it('AC#2: a re-run does not mutate an existing row (snapshot-compare)', async () => {
    // Snapshot a predefined row in full BEFORE the re-run. The test does not
    // mutate this row — it only observes it across a seed invocation.
    const sampleName = 'Verification Engineer'
    const before = await prisma.engineeringRole.findUnique({
      where: { name: sampleName },
    })
    expect(before, `predefined role "${sampleName}" must already exist`).not.toBeNull()

    // Run the seed again.
    await seedEngineeringRoles()

    // Snapshot again and assert the row is byte-for-byte unchanged.
    const after = await prisma.engineeringRole.findUnique({
      where: { name: sampleName },
    })
    expect(after).toEqual(before)
  })

  it('AC#2: catalogue row count is stable across repeated runs', async () => {
    const countBefore = await prisma.engineeringRole.count()
    await seedEngineeringRoles()
    const countAfter = await prisma.engineeringRole.count()
    expect(countAfter).toBe(countBefore)
  })

  afterAll(async () => {
    // Deliberately NO cleanup: the predefined catalogue is shared global data.
    // This suite created no throwaway rows of its own.
    await prisma.$disconnect()
  })
})
