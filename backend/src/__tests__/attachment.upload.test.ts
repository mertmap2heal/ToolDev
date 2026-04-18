import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

// Minimal valid PNG as base64 data URL (1x1 transparent pixel)
const VALID_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

describe('Attachment upload — MIME type and filename validation (#27)', () => {
  let userId: string
  let projectId: string
  let token: string
  let taskId: string

  beforeAll(async () => {
    const ts = Date.now()

    const user = await prisma.user.create({
      data: {
        email: `test-upload-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Upload Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const project = await prisma.project.create({
      data: {
        name: `upload-test-project-${ts}`,
        domain: 'test',
        slug: `upload-test-${ts}`,
        userId,
      },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner' },
    })

    const task = await prisma.task.create({
      data: { title: `upload-test-task-${ts}`, projectId },
    })
    taskId = task.id
  })

  afterAll(async () => {
    await prisma.taskAttachment.deleteMany({ where: { taskId } })
    await prisma.task.delete({ where: { id: taskId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post(`/api/v1/tasks/${taskId}/attachments`)
    expect(res.status).toBe(401)
  })

  it('rejects upload when mimeType is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fileName: 'test.png', fileData: VALID_PNG_DATA_URL })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('File type not permitted')
  })

  it('rejects upload of an executable MIME type', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'malware.exe',
        fileData: VALID_PNG_DATA_URL,
        mimeType: 'application/x-msdownload',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('File type not permitted')
  })

  it('rejects upload of text/html MIME type', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'page.html',
        fileData: VALID_PNG_DATA_URL,
        mimeType: 'text/html',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('File type not permitted')
  })

  it('rejects upload of image/svg+xml MIME type (XSS vector)', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'icon.svg',
        fileData: VALID_PNG_DATA_URL,
        mimeType: 'image/svg+xml',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('File type not permitted')
  })

  it('rejects upload with a filename containing path traversal characters', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: '../../../etc/passwd',
        fileData: VALID_PNG_DATA_URL,
        mimeType: 'image/png',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid file name')
  })

  it('rejects upload with a filename exceeding 255 characters', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'a'.repeat(256) + '.png',
        fileData: VALID_PNG_DATA_URL,
        mimeType: 'image/png',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid file name')
  })

  it('accepts a valid PNG upload and returns 201', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        fileName: 'screenshot.png',
        fileData: VALID_PNG_DATA_URL,
        mimeType: 'image/png',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.taskId).toBe(taskId)
    expect(res.body.data.fileName).toBe('screenshot.png')
    expect(res.body.data.mimeType).toBe('image/png')
  })
})
