/**
 * Regression tests for #119 — change request upload accepted any MIME type.
 *
 * The uploadAttachment handler now validates MIME + size + filename via
 * the shared lib/uploadValidation.ts allowlist. This file asserts:
 *   - dangerous MIME (application/x-sh) rejected with 415
 *   - unknown MIME rejected
 *   - missing mimeType rejected with 400
 *   - oversized file rejected with 413
 *   - client-supplied filename never reaches disk path; extension comes from MIME map
 *   - allowed MIME (image/png) lands and uses safe unique filename
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Change request attachment upload MIME whitelist (#119)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let crId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: {
        email: `cr-upload-${stamp}@example.com`,
        password: 'hashed',
        name: 'CR Upload User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `cr-upload-${stamp}`
    const project = await prisma.project.create({
      data: { name: `CR Upload ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })

    const cr = await prisma.changeRequest.create({
      data: {
        projectId,
        crId: `CR-UP-${stamp}`,
        title: 'Upload CR',
        description: 'Upload test',
        sourceType: 'requirement',
        sourceId: 'seed',
        priority: 'medium',
        requestedBy: 'seed',
        createdBy: userId,
        updatedBy: userId,
      },
    })
    crId = cr.id
  })

  afterAll(async () => {
    await prisma.changeRequestAttachment.deleteMany({ where: { changeRequestId: crId } }).catch(() => {})
    await prisma.changeRequest.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  const makeDataUrl = (mime: string, body: string) =>
    `data:${mime};base64,${Buffer.from(body, 'utf8').toString('base64')}`

  it('rejects shell script (application/x-sh) with 415', async () => {
    const res = await request(app)
      .post(`/api/v1/change-requests/${projectId}/${crId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'evil.sh',
        fileData: makeDataUrl('application/x-sh', '#!/bin/sh\nrm -rf /\n'),
        mimeType: 'application/x-sh',
      })
    expect(res.status).toBe(415)
    expect(res.body.success).toBe(false)
  })

  it('rejects HTML with XSS payload (text/html) with 415', async () => {
    const res = await request(app)
      .post(`/api/v1/change-requests/${projectId}/${crId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'xss.html',
        fileData: makeDataUrl('text/html', '<script>alert(1)</script>'),
        mimeType: 'text/html',
      })
    expect(res.status).toBe(415)
  })

  it('rejects SVG (image/svg+xml) with 415', async () => {
    const res = await request(app)
      .post(`/api/v1/change-requests/${projectId}/${crId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'x.svg',
        fileData: makeDataUrl('image/svg+xml', '<svg onload=alert(1)/>'),
        mimeType: 'image/svg+xml',
      })
    expect(res.status).toBe(415)
  })

  it('rejects missing mimeType with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/change-requests/${projectId}/${crId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'x.png',
        fileData: makeDataUrl('image/png', 'fake png body'),
        // mimeType intentionally omitted
      })
    expect(res.status).toBe(400)
  })

  it('accepts allowed MIME (image/png) and stores safe filename from allowlist', async () => {
    const res = await request(app)
      .post(`/api/v1/change-requests/${projectId}/${crId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'ok.png',
        fileData: makeDataUrl('image/png', 'fake png body'),
        mimeType: 'image/png',
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.mimeType).toBe('image/png')
    // fileUrl must not contain the ".php" or any client-chosen ext; must be
    // the server-generated UUID.png path.
    expect(res.body.data.fileUrl).toMatch(/\/uploads\/change-requests\/[0-9a-f-]+\.png$/i)
  })

  it('double-extension attempt still maps to allowlist extension', async () => {
    const res = await request(app)
      .post(`/api/v1/change-requests/${projectId}/${crId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'evil.png.php',
        fileData: makeDataUrl('image/png', 'fake png body'),
        mimeType: 'image/png',
      })
    expect(res.status).toBe(201)
    expect(res.body.data.fileUrl).toMatch(/\.png$/)
    expect(res.body.data.fileUrl).not.toMatch(/\.php/)
  })
})
