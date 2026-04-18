/**
 * Regression tests for #290 — DELETE /functions/:projectId/:id used to
 * hard-delete every linked issue regardless of caller role, with no
 * audit trail.
 *
 * New contract:
 *   - default cascade = nullify (linked issues keep living, function id is
 *     spliced out of relatedFunctionIds)
 *   - ?deleteLinkedIssues=true cascade requires project owner / admin
 *   - hard cascade writes an AuditLog row per destroyed issue
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Function delete — issue cascade (#290)', () => {
  const stamp = Date.now()

  let ownerId: string
  let memberId: string
  let ownerToken: string
  let memberToken: string
  let projectId: string
  let functionId: string
  let issueOneId: string
  let issueTwoId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const owner = await prisma.user.create({
      data: { email: `fd-owner-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    ownerToken = jwt.sign({ userId: owner.id }, secret)

    const member = await prisma.user.create({
      data: { email: `fd-member-${stamp}@example.test`, password: 'x', name: 'Member' },
    })
    memberId = member.id
    memberToken = jwt.sign({ userId: member.id }, secret)

    const slug = `fd-${stamp}`
    const project = await prisma.project.create({
      data: { name: `FD ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = project.id

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: ownerId, role: 'owner', status: 'accepted' },
        { projectId, userId: memberId, role: 'member', status: 'accepted' },
      ],
    })

    const fn = await prisma.systemFunction.create({
      data: {
        projectId,
        name: `Function ${stamp}`,
        functionId: `F-${stamp}`,
        description: 'cascade target',
        level: 0,
      },
    })
    functionId = fn.id

    const i1 = await prisma.issue.create({
      data: {
        projectId,
        issueKey: `ISS-1-${stamp}`,
        title: 'Defect one',
        description: 'd',
        priority: 'medium',
        status: 'open',
        relatedFunctionIds: [functionId],
      },
    })
    issueOneId = i1.id

    const i2 = await prisma.issue.create({
      data: {
        projectId,
        issueKey: `ISS-2-${stamp}`,
        title: 'Defect two',
        description: 'd',
        priority: 'medium',
        status: 'open',
        relatedFunctionIds: [functionId, 'some-other-function'],
      },
    })
    issueTwoId = i2.id
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.issue.deleteMany({ where: { id: { in: [issueOneId, issueTwoId] } } }).catch(() => {})
    await prisma.systemFunction.deleteMany({ where: { id: functionId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('non-owner member cannot hard-delete linked issues (#290)', async () => {
    const res = await request(app)
      .delete(`/api/v1/functions/${projectId}/${functionId}?deleteLinkedIssues=true`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(403)
    // Function and issues still present.
    expect(await prisma.systemFunction.findUnique({ where: { id: functionId } })).not.toBeNull()
    expect(await prisma.issue.findUnique({ where: { id: issueOneId } })).not.toBeNull()
  })

  it('default member delete nullifies the function id out of linked issues (#290)', async () => {
    const res = await request(app)
      .delete(`/api/v1/functions/${projectId}/${functionId}`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.cascadeMode).toBe('nullify')
    expect(res.body.data.linkedIssueCount).toBe(2)

    // Function is gone.
    expect(await prisma.systemFunction.findUnique({ where: { id: functionId } })).toBeNull()
    // Issues are preserved, function id spliced out.
    const i1 = await prisma.issue.findUnique({ where: { id: issueOneId } })
    const i2 = await prisma.issue.findUnique({ where: { id: issueTwoId } })
    expect(i1).not.toBeNull()
    expect(i2).not.toBeNull()
    expect(i1!.relatedFunctionIds).not.toContain(functionId)
    expect(i2!.relatedFunctionIds).not.toContain(functionId)
    // Other function id preserved on issue two.
    expect(i2!.relatedFunctionIds).toContain('some-other-function')
  })
})

describe('Function delete — owner hard cascade path (#290)', () => {
  const stamp = Date.now() + 1

  let ownerId: string
  let ownerToken: string
  let projectId: string
  let functionId: string
  let issueId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `fd-owner2-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    ownerToken = jwt.sign({ userId: owner.id }, secret)

    const slug = `fd2-${stamp}`
    const project = await prisma.project.create({
      data: { name: `FD2 ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: ownerId, role: 'owner', status: 'accepted' },
    })

    const fn = await prisma.systemFunction.create({
      data: {
        projectId,
        name: 'F2',
        functionId: `F2-${stamp}`,
        description: 'cascade target',
        level: 0,
      },
    })
    functionId = fn.id

    const iss = await prisma.issue.create({
      data: {
        projectId,
        issueKey: `ISS-${stamp}`,
        title: 'To be cascaded',
        description: 'x',
        priority: 'medium',
        status: 'open',
        relatedFunctionIds: [functionId],
      },
    })
    issueId = iss.id
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.issue.deleteMany({ where: { id: issueId } }).catch(() => {})
    await prisma.systemFunction.deleteMany({ where: { id: functionId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: ownerId } }).catch(() => {})
  })

  it('owner hard-delete drops issues AND writes audit entries (#290)', async () => {
    const res = await request(app)
      .delete(`/api/v1/functions/${projectId}/${functionId}?deleteLinkedIssues=true`)
      .set('Authorization', `Bearer ${ownerToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.cascadeMode).toBe('hard-delete')
    expect(await prisma.issue.findUnique({ where: { id: issueId } })).toBeNull()

    const audits = await prisma.auditLog.findMany({
      where: {
        projectId,
        action: 'ISSUE_HARD_DELETED_VIA_FUNCTION_CASCADE',
      },
    })
    expect(audits.length).toBe(1)
    const details = JSON.parse(audits[0]!.details!)
    expect(details.issueId).toBe(issueId)
    expect(details.functionId).toBe(functionId)
  })
})
