import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import {
  linkInvocationToArtefact,
  getArtefactsForInvocation,
  getInvocationsForArtefact,
} from '../services/aiInvocationLink.service'

/**
 * R-5 (#404) — AiInvocationLink invocation-to-artefact join.
 *
 * Covers AC #5:
 *  - linkInvocationToArtefact links an AiInvocation to one or more artefacts.
 *  - getArtefactsForInvocation returns those links (invocation -> artefacts).
 *  - getInvocationsForArtefact returns the invocation from the artefact side
 *    (artefact -> invocations), with the joined invocation included.
 *  - the credentialId link resolves: an AiInvocation created with credentialId
 *    set has its `credential` relation populated.
 *
 * Real DB, no mocks; isolated data with unique timestamps. AiInvocationLink is
 * not append-only-guarded, so afterAll cleans rows with ordinary Prisma
 * deleteMany in reverse-FK order: links -> invocations -> credential ->
 * projectMember -> project -> user.
 */
describe('R-5 — AiInvocationLink invocation-to-artefact join', () => {
  const ts = Date.now()
  let userId: string
  let projectId: string
  let credentialId: string
  const createdInvocationIds: string[] = []

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `ai-link-test-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'AI Link Test User',
      },
    })
    userId = user.id

    const project = await prisma.project.create({
      data: {
        name: `AI Link Project ${ts}`,
        domain: `ai-link-${ts}`,
        slug: `ai-link-${ts}`,
        userId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner' },
    })

    // A BYOK credential — used to exercise the AiInvocation.credentialId link.
    const credential = await prisma.userAiCredential.create({
      data: {
        userId,
        provider: 'anthropic',
        label: `Test key ${ts}`,
        keyCiphertext: 'base64-aes-gcm-envelope-placeholder',
        maskedTail: 'WXYZ',
      },
    })
    credentialId = credential.id
  })

  afterAll(async () => {
    // Reverse-FK order: links -> invocations -> credential -> member -> project -> user.
    if (createdInvocationIds.length > 0) {
      await prisma.aiInvocationLink.deleteMany({
        where: { invocationId: { in: createdInvocationIds } },
      })
      await prisma.aiInvocation.deleteMany({
        where: { id: { in: createdInvocationIds } },
      })
    }
    await prisma.userAiCredential.deleteMany({ where: { id: credentialId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  /** Helper — creates an AiInvocation row and records its id for cleanup. */
  async function createInvocation(
    overrides: { credentialId?: string } = {},
  ): Promise<string> {
    const inv = await prisma.aiInvocation.create({
      data: {
        projectId,
        userId,
        toolName: 'rest.ai.draft',
        tier: 'T1',
        inputHash: `hash-${ts}-${createdInvocationIds.length}`,
        success: true,
        ...overrides,
      },
    })
    createdInvocationIds.push(inv.id)
    return inv.id
  }

  it('linkInvocationToArtefact links an invocation to a single artefact', async () => {
    const invocationId = await createInvocation()
    const artefactId = `req-${ts}-single`

    const link = await linkInvocationToArtefact(
      invocationId,
      'Requirement',
      artefactId,
    )

    expect(link.id).toBeDefined()
    expect(link.invocationId).toBe(invocationId)
    expect(link.artefactType).toBe('Requirement')
    expect(link.artefactId).toBe(artefactId)
    expect(link.createdAt).toBeInstanceOf(Date)
  })

  it('getArtefactsForInvocation returns all artefacts linked to one invocation', async () => {
    const invocationId = await createInvocation()
    await linkInvocationToArtefact(invocationId, 'Requirement', `req-a-${ts}`)
    await linkInvocationToArtefact(invocationId, 'VerTestCase', `tc-b-${ts}`)
    await linkInvocationToArtefact(invocationId, 'Parameter', `prm-c-${ts}`)

    const artefacts = await getArtefactsForInvocation(invocationId)

    expect(artefacts.length).toBe(3)
    expect(artefacts.every((a) => a.invocationId === invocationId)).toBe(true)
    const types = artefacts.map((a) => a.artefactType)
    expect(types).toContain('Requirement')
    expect(types).toContain('VerTestCase')
    expect(types).toContain('Parameter')
  })

  it('getArtefactsForInvocation returns an empty array for an invocation with no links', async () => {
    const invocationId = await createInvocation()
    const artefacts = await getArtefactsForInvocation(invocationId)
    expect(artefacts).toEqual([])
  })

  it('getInvocationsForArtefact returns the invocation from the artefact side', async () => {
    const invocationId = await createInvocation()
    const artefactId = `req-${ts}-reverse`
    await linkInvocationToArtefact(invocationId, 'Requirement', artefactId)

    const invocations = await getInvocationsForArtefact('Requirement', artefactId)

    expect(invocations.length).toBe(1)
    expect(invocations[0].invocationId).toBe(invocationId)
    // The joined invocation is included so the consumer gets projectId etc.
    expect(invocations[0].invocation).toBeDefined()
    expect(invocations[0].invocation.id).toBe(invocationId)
    expect(invocations[0].invocation.projectId).toBe(projectId)
    expect(invocations[0].invocation.toolName).toBe('rest.ai.draft')
  })

  it('round-trips: the same link is visible from both directions', async () => {
    const invocationId = await createInvocation()
    const artefactId = `tc-${ts}-roundtrip`
    const created = await linkInvocationToArtefact(
      invocationId,
      'VerTestCase',
      artefactId,
    )

    // invocation -> artefact
    const forward = await getArtefactsForInvocation(invocationId)
    expect(forward.some((l) => l.id === created.id)).toBe(true)

    // artefact -> invocation
    const reverse = await getInvocationsForArtefact('VerTestCase', artefactId)
    expect(reverse.some((l) => l.id === created.id)).toBe(true)
    expect(reverse[0].invocation.id).toBe(invocationId)
  })

  it('getInvocationsForArtefact returns every invocation that touched one artefact', async () => {
    const artefactId = `req-${ts}-multi-touch`
    const firstInvocation = await createInvocation()
    const secondInvocation = await createInvocation()
    await linkInvocationToArtefact(firstInvocation, 'Requirement', artefactId)
    await linkInvocationToArtefact(secondInvocation, 'Requirement', artefactId)

    const invocations = await getInvocationsForArtefact('Requirement', artefactId)

    expect(invocations.length).toBe(2)
    const ids = invocations.map((l) => l.invocationId)
    expect(ids).toContain(firstInvocation)
    expect(ids).toContain(secondInvocation)
  })

  it('getInvocationsForArtefact returns an empty array for an unknown artefact', async () => {
    const invocations = await getInvocationsForArtefact(
      'Requirement',
      `nonexistent-${ts}`,
    )
    expect(invocations).toEqual([])
  })

  it('an AiInvocation created with credentialId set resolves its credential relation', async () => {
    const invocationId = await createInvocation({ credentialId })

    const fetched = await prisma.aiInvocation.findUnique({
      where: { id: invocationId },
      include: { credential: true },
    })

    expect(fetched).not.toBeNull()
    expect(fetched!.credentialId).toBe(credentialId)
    expect(fetched!.credential).not.toBeNull()
    expect(fetched!.credential!.id).toBe(credentialId)
    expect(fetched!.credential!.provider).toBe('anthropic')

    // The reverse relation: the credential lists the invocation.
    const credWithInvocations = await prisma.userAiCredential.findUnique({
      where: { id: credentialId },
      include: { invocations: true },
    })
    expect(credWithInvocations!.invocations.some((i) => i.id === invocationId)).toBe(
      true,
    )
  })

  it('credentialId is nullable — an AiInvocation without a credential has credentialId null', async () => {
    const invocationId = await createInvocation()
    const fetched = await prisma.aiInvocation.findUnique({
      where: { id: invocationId },
      include: { credential: true },
    })
    expect(fetched!.credentialId).toBeNull()
    expect(fetched!.credential).toBeNull()
  })
})
