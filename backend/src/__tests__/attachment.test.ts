import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UPLOADS_BASE = path.resolve(__dirname, '../../uploads')

describe('Attachment DELETE — path traversal protection (#26)', () => {
  let userId: string
  let token: string
  let taskId: string

  beforeAll(async () => {
    const ts = Date.now()

    const user = await prisma.user.create({
      data: {
        email: `test-attach-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Attach Test User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

    const task = await prisma.task.create({
      data: { title: `attach-test-task-${ts}` },
    })
    taskId = task.id
  })

  afterAll(async () => {
    await prisma.taskAttachment.deleteMany({ where: { taskId } })
    await prisma.task.delete({ where: { id: taskId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/v1/attachments/nonexistent-id')
    expect(res.status).toBe(401)
  })

  it('blocks deletion when fileUrl contains a path traversal sequence', async () => {
    const traversalAttachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: 'evil.txt',
        storageKey: 'tasks/evil.txt',
        fileUrl: '/uploads/tasks/../../../../package.json',
        sizeBytes: 10,
      },
    })

    const res = await request(app)
      .delete(`/api/v1/attachments/${traversalAttachment.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toBe('Invalid attachment path')

    // DB record must NOT have been deleted — no inconsistent state
    const still = await prisma.taskAttachment.findUnique({ where: { id: traversalAttachment.id } })
    expect(still).not.toBeNull()

    // Cleanup
    await prisma.taskAttachment.delete({ where: { id: traversalAttachment.id } })
  })

  it('deletes the DB record and the physical file for a valid attachment', async () => {
    // Create a real file inside UPLOADS_BASE/tasks/
    const tasksDir = path.join(UPLOADS_BASE, 'tasks')
    if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true })

    const testFileName = `test-attach-${Date.now()}.txt`
    const testFilePath = path.join(tasksDir, testFileName)
    fs.writeFileSync(testFilePath, 'test content')

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: testFileName,
        storageKey: `tasks/${testFileName}`,
        fileUrl: `/uploads/tasks/${testFileName}`,
        sizeBytes: 12,
      },
    })

    const res = await request(app)
      .delete(`/api/v1/attachments/${attachment.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    // Physical file must be gone
    expect(fs.existsSync(testFilePath)).toBe(false)

    // DB record must be gone
    const gone = await prisma.taskAttachment.findUnique({ where: { id: attachment.id } })
    expect(gone).toBeNull()
  })

  it('returns 404 for a non-existent attachment id', async () => {
    const res = await request(app)
      .delete('/api/v1/attachments/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })
})
