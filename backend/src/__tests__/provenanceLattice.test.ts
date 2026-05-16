import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'

/**
 * R-1 (#395) — universal AI-provenance lattice verification.
 *
 * R-1 added the 8-column provenance lattice (copied from `Parameter`) to 22
 * cert-relevant models. This suite proves the schema defaults backfill
 * correctly: a row created WITHOUT passing any provenance field must read
 * back `authorType = 'human'`, `provenanceReviewStatus = 'drafted'`, and the
 * five `authorAi*` / reviewer fields as `null` (AC #5 + #6).
 *
 * The lattice is identical across all 22 models, so a representative sample
 * spanning the model families is sufficient: Requirement (requirements),
 * VerTestCase (verification), CertObjective (certification), ValidationItem
 * (validation), Issue (issues), Task (tasks).
 *
 * Real DB, no mocks; isolated data with unique timestamps; afterAll cleanup
 * in reverse dependency order (per .claude/testing.md).
 */
describe('R-1 — AI-provenance lattice defaults', () => {
  const ts = Date.now()
  let userId: string
  let projectId: string

  // Created-row IDs, captured for afterAll cleanup.
  let requirementId: string
  let verTestCaseId: string
  let certObjectiveId: string
  let validationItemId: string
  let issueId: string
  let taskId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `provenance-test-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Provenance Test User',
      },
    })
    userId = user.id

    const slug = `provenance-test-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Provenance Test Project ${ts}`,
        domain: slug,
        slug,
        userId,
      },
    })
    projectId = project.id
  })

  afterAll(async () => {
    // Reverse dependency order — children before the project, project before user.
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.verTestCase.deleteMany({ where: { projectId } })
    await prisma.certObjective.deleteMany({ where: { projectId } })
    await prisma.validationItem.deleteMany({ where: { projectId } })
    await prisma.issue.deleteMany({ where: { projectId } })
    await prisma.task.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  /**
   * Shared assertion: every lattice field reads the documented default for a
   * row created with no provenance input.
   */
  const expectHumanDefaults = (row: {
    authorType: string
    authorAiModel: string | null
    authorAiVersion: string | null
    authorAiPromptId: string | null
    authorAiContextHash: string | null
    provenanceReviewStatus: string
    reviewerUserId: string | null
    reviewTimestamp: Date | null
  }) => {
    expect(row.authorType).toBe('human')
    expect(row.provenanceReviewStatus).toBe('drafted')
    expect(row.authorAiModel).toBeNull()
    expect(row.authorAiVersion).toBeNull()
    expect(row.authorAiPromptId).toBeNull()
    expect(row.authorAiContextHash).toBeNull()
    expect(row.reviewerUserId).toBeNull()
    expect(row.reviewTimestamp).toBeNull()
  }

  it('Requirement created without provenance fields gets human defaults', async () => {
    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: `Provenance Requirement ${ts}`,
        description: 'Created without any provenance field.',
        priority: 'medium',
        status: 'draft',
        stage: 'design',
      },
    })
    requirementId = req.id
    expectHumanDefaults(req)
  })

  it('VerTestCase created without provenance fields gets human defaults', async () => {
    const tc = await prisma.verTestCase.create({
      data: {
        projectId,
        key: `TC-PROV-${ts}`,
        title: `Provenance Test Case ${ts}`,
      },
    })
    verTestCaseId = tc.id
    expectHumanDefaults(tc)
  })

  it('CertObjective created without provenance fields gets human defaults', async () => {
    const obj = await prisma.certObjective.create({
      data: {
        projectId,
        objId: `OBJ-PROV-${ts}`,
        regRef: 'CS-25.1309',
        title: `Provenance Objective ${ts}`,
        moc: 'Test',
      },
    })
    certObjectiveId = obj.id
    expectHumanDefaults(obj)
  })

  it('ValidationItem created without provenance fields gets human defaults', async () => {
    const item = await prisma.validationItem.create({
      data: {
        projectId,
        key: `VAL-PROV-${ts}`,
        title: `Provenance Validation Item ${ts}`,
        createdById: userId,
      },
    })
    validationItemId = item.id
    expectHumanDefaults(item)
  })

  it('Issue created without provenance fields gets human defaults', async () => {
    const issue = await prisma.issue.create({
      data: {
        projectId,
        title: `Provenance Issue ${ts}`,
        description: 'Created without any provenance field.',
      },
    })
    issueId = issue.id
    expectHumanDefaults(issue)
  })

  it('Task created without provenance fields gets human defaults', async () => {
    const task = await prisma.task.create({
      data: {
        projectId,
        title: `Provenance Task ${ts}`,
      },
    })
    taskId = task.id
    expectHumanDefaults(task)
  })

  it('lattice fields are readable via an explicit select after creation', async () => {
    // Re-read a representative row through select to confirm the columns
    // exist on the persisted row, not just on the create() return value.
    const reread = await prisma.requirement.findUniqueOrThrow({
      where: { id: requirementId },
      select: {
        authorType: true,
        authorAiModel: true,
        authorAiVersion: true,
        authorAiPromptId: true,
        authorAiContextHash: true,
        provenanceReviewStatus: true,
        reviewerUserId: true,
        reviewTimestamp: true,
      },
    })
    expectHumanDefaults(reread)
  })

  // Reference the verification-domain IDs so an unused-variable lint rule does
  // not flag them — they are deleted by projectId in afterAll, but capturing
  // them documents what each test created.
  it('all sampled rows were created', () => {
    expect([
      requirementId,
      verTestCaseId,
      certObjectiveId,
      validationItemId,
      issueId,
      taskId,
    ].every(Boolean)).toBe(true)
  })
})
