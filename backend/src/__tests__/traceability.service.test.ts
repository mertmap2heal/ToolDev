/**
 * Direct tests for traceabilityService methods (#Batch8).
 *
 * Exercises the service helpers that power /traceability/* endpoints:
 *   - createTraceLink (idempotent, validates change_request / issue ownership)
 *   - clearSuspectLink
 *   - markDownstreamLinksSuspect
 *   - markLinksSuspectByMeaningfulChange (filter by MEANINGFUL_FIELDS / link types)
 *   - getSuspectLinks (filters)
 *   - getTraceabilityGraph (assembles nodes/edges)
 *   - deleteTraceLink (TraceLink branch + idempotency)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { traceabilityService } from '../services/traceability.service'
import { prisma } from '../lib/prisma'

describe('traceabilityService — direct service-layer tests', () => {
  const stamp = Date.now()
  let userId: string
  let projectId: string
  let reqAId: string
  let reqBId: string
  let reqCId: string
  let issueId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `trace-svc-${stamp}@example.com`,
        password: 'hashed',
        name: 'Trace User',
      },
    })
    userId = user.id

    const slug = `trace-svc-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Trace Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    const a = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Source Req',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `TRC-${stamp}-A`,
      },
    })
    reqAId = a.id

    const b = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Target Req',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `TRC-${stamp}-B`,
      },
    })
    reqBId = b.id

    const c = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Other Target',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `TRC-${stamp}-C`,
      },
    })
    reqCId = c.id

    // Get an unique issueKey
    const issue = await prisma.issue.create({
      data: {
        projectId,
        issueKey: `TRC-ISS-${stamp}`,
        title: 'Trace test issue',
        description: '',
        status: 'open',
        priority: 'medium',
        issueType: 'other',
      },
    })
    issueId = issue.id
  })

  afterAll(async () => {
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.verAuditEvent.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.issueLink.deleteMany({ where: { issueId } }).catch(() => {})
    await prisma.issue.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('createTraceLink creates a TraceLink and returns its DTO', async () => {
    const link = await traceabilityService.createTraceLink(
      projectId,
      'requirement',
      reqAId,
      'requirement',
      reqBId,
      'derives_from',
      undefined,
      'Direct service test',
      userId
    )
    expect(link.id).toBeDefined()
    expect(link.sourceId).toBe(reqAId)
    expect(link.targetId).toBe(reqBId)
    expect(link.linkType).toBe('derives_from')
  })

  it('createTraceLink is idempotent — second call returns existing edge', async () => {
    const link1 = await traceabilityService.createTraceLink(
      projectId,
      'requirement',
      reqAId,
      'requirement',
      reqBId,
      'derives_from',
      undefined,
      'duplicate',
      userId
    )
    const all = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceId: reqAId,
        targetId: reqBId,
        linkType: 'derives_from',
      },
    })
    expect(all.length).toBe(1)
    expect(link1.id).toBe(all[0].id)
  })

  it('createTraceLink rejects unknown change_request source', async () => {
    await expect(
      traceabilityService.createTraceLink(
        projectId,
        'change_request',
        '00000000-0000-0000-0000-000000000000',
        'requirement',
        reqAId,
        'derives_from'
      )
    ).rejects.toThrow(/change request/i)
  })

  it('createTraceLink rejects unknown issue target', async () => {
    await expect(
      traceabilityService.createTraceLink(
        projectId,
        'requirement',
        reqAId,
        'issue',
        '00000000-0000-0000-0000-000000000000',
        'mitigates'
      )
    ).rejects.toThrow(/issue/i)
  })

  it('markDownstreamLinksSuspect flags all outgoing links from a source', async () => {
    // Add a second link to a different target so we have 2 distinct edges from reqA
    await traceabilityService.createTraceLink(
      projectId,
      'requirement',
      reqAId,
      'requirement',
      reqCId,
      'verifies',
      undefined,
      undefined,
      userId
    )
    const count = await traceabilityService.markDownstreamLinksSuspect(projectId, reqAId)
    expect(count).toBeGreaterThanOrEqual(2) // both links from reqAId
    const flagged = await prisma.traceLink.findMany({
      where: { projectId, sourceId: reqAId, isSuspect: true },
    })
    expect(flagged.length).toBeGreaterThanOrEqual(2)
  })

  it('clearSuspectLink resets isSuspect on a single link', async () => {
    const a = await prisma.traceLink.findFirst({
      where: { projectId, sourceId: reqAId, isSuspect: true },
    })
    expect(a).not.toBeNull()
    const dto = await traceabilityService.clearSuspectLink(projectId, a!.id, userId, 'reviewed')
    expect(dto.isSuspect).toBe(false)
    const reloaded = await prisma.traceLink.findUnique({ where: { id: a!.id } })
    expect(reloaded?.isSuspect).toBe(false)
  })

  it('markLinksSuspectByMeaningfulChange skips when no MEANINGFUL_FIELDS changed', async () => {
    // Reset suspect flag on all
    await prisma.traceLink.updateMany({
      where: { projectId },
      data: { isSuspect: false },
    })
    const count = await traceabilityService.markLinksSuspectByMeaningfulChange(
      projectId,
      reqAId,
      ['updatedAt'] // not a meaningful field
    )
    expect(count).toBe(0)
  })

  it('markLinksSuspectByMeaningfulChange marks rows with MEANINGFUL_LINK_TYPES when title changes', async () => {
    // Both 'derives_from' and 'verifies' are in MEANINGFUL_LINK_TYPES.
    // After markDownstreamLinksSuspect + clearSuspectLink in earlier tests,
    // we expect at least 2 outgoing links from reqA.
    const before = await prisma.traceLink.findMany({
      where: { projectId, sourceId: reqAId },
    })
    expect(before.length).toBeGreaterThanOrEqual(2)

    const count = await traceabilityService.markLinksSuspectByMeaningfulChange(
      projectId,
      reqAId,
      ['title']
    )
    expect(count).toBeGreaterThanOrEqual(2)

    // All meaningful-type links from reqA should now be suspect
    const after = await prisma.traceLink.findMany({
      where: { projectId, sourceId: reqAId },
    })
    for (const link of after) {
      expect(link.isSuspect).toBe(true)
    }
  })

  it('getSuspectLinks returns only suspect rows', async () => {
    const all = await traceabilityService.getSuspectLinks(projectId)
    expect(Array.isArray(all)).toBe(true)
    for (const l of all) {
      expect(l.isSuspect).toBe(true)
    }
  })

  it('getSuspectLinks excludeFunctions filters out function targets', async () => {
    const links = await traceabilityService.getSuspectLinks(projectId, { excludeFunctions: true })
    for (const l of links) {
      expect(String(l.targetType)).not.toBe('function')
    }
  })

  it('getTraceabilityGraph assembles nodes and edges', async () => {
    const graph = await traceabilityService.getTraceabilityGraph(projectId)
    expect(Array.isArray(graph.nodes)).toBe(true)
    expect(Array.isArray(graph.edges)).toBe(true)
    // At least 2 requirement nodes
    const reqNodes = graph.nodes.filter((n: any) => n.type === 'requirement')
    expect(reqNodes.length).toBeGreaterThanOrEqual(2)
    // At least 1 edge between them
    const reqEdges = graph.edges.filter(
      (e: any) => e.source === reqAId && e.target === reqBId
    )
    expect(reqEdges.length).toBeGreaterThanOrEqual(1)
  })

  it('deleteTraceLink removes the row; second call throws "Link not found"', async () => {
    const candidate = await prisma.traceLink.findFirst({
      where: { projectId, sourceId: reqAId, targetId: reqBId },
    })
    expect(candidate).not.toBeNull()
    await traceabilityService.deleteTraceLink(projectId, candidate!.id, userId)
    const after = await prisma.traceLink.findUnique({ where: { id: candidate!.id } })
    expect(after).toBeNull()
    // Service throws when the linkId is no longer present in any of the three sources
    await expect(
      traceabilityService.deleteTraceLink(projectId, candidate!.id, userId)
    ).rejects.toThrow(/link not found/i)
  })
})
