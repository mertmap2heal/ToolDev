import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

/**
 * Regression tests for
 *   #159 - Task module project-membership enforcement
 *   #160 - Task comment author impersonation
 *
 * Every test creates isolated data (unique timestamp) and cleans up afterwards.
 */
describe('Tasks - security (#159, #160)', () => {
  const ts = Date.now()
  let memberId: string
  let memberToken: string
  let memberName: string
  let outsiderId: string
  let outsiderToken: string
  let otherUserId: string
  let projectId: string
  let otherProjectId: string
  let taskId: string
  let otherTaskId: string

  beforeAll(async () => {
    const member = await prisma.user.create({
      data: {
        email: `task-sec-member-${ts}@example.com`,
        password: 'x',
        name: `Task Member ${ts}`,
      },
    })
    memberId = member.id
    memberName = member.name || ''
    memberToken = jwt.sign({ userId: memberId }, process.env.JWT_SECRET || 'secret')

    const outsider = await prisma.user.create({
      data: {
        email: `task-sec-outsider-${ts}@example.com`,
        password: 'x',
        name: `Task Outsider ${ts}`,
      },
    })
    outsiderId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderId }, process.env.JWT_SECRET || 'secret')

    const other = await prisma.user.create({
      data: {
        email: `task-sec-other-${ts}@example.com`,
        password: 'x',
        name: `Other User ${ts}`,
      },
    })
    otherUserId = other.id

    const slug = `task-sec-${ts}`
    const project = await prisma.project.create({
      data: {
        name: `Task Sec ${ts}`,
        domain: slug,
        slug,
        userId: memberId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'owner', status: 'accepted' },
    })

    const otherSlug = `task-sec-other-${ts}`
    const otherProject = await prisma.project.create({
      data: {
        name: `Other Project ${ts}`,
        domain: otherSlug,
        slug: otherSlug,
        userId: outsiderId,
      },
    })
    otherProjectId = otherProject.id
    await prisma.projectMember.create({
      data: { projectId: otherProjectId, userId: outsiderId, role: 'owner', status: 'accepted' },
    })

    const task = await prisma.task.create({
      data: { projectId, title: `Task in member's project ${ts}` },
    })
    taskId = task.id

    const otherTask = await prisma.task.create({
      data: { projectId: otherProjectId, title: `Task in OTHER project ${ts}` },
    })
    otherTaskId = otherTask.id
  })

  afterAll(async () => {
    await prisma.activityFeed.deleteMany({
      where: { taskId: { in: [taskId, otherTaskId] } },
    })
    await prisma.taskComment.deleteMany({
      where: { taskId: { in: [taskId, otherTaskId] } },
    })
    await prisma.taskAuditLog.deleteMany({
      where: { entityId: { in: [taskId, otherTaskId] } },
    })
    await prisma.task.deleteMany({
      where: { id: { in: [taskId, otherTaskId] } },
    })
    await prisma.boardColumn.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.projectMember.deleteMany({
      where: { projectId: { in: [projectId, otherProjectId] } },
    })
    await prisma.project.deleteMany({
      where: { id: { in: [projectId, otherProjectId] } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [memberId, outsiderId, otherUserId] } },
    })
    await prisma.$disconnect()
  })

  describe('GET /api/v1/tasks/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/tasks/${taskId}`)
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-member (cross-project IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
    })

    it('returns 200 for the project member', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('returns 404 for an unknown task id', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/00000000-0000-4000-8000-000000000000`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/v1/tasks/:id', () => {
    it('rejects a non-member trying to modify another project\'s task', async () => {
      const res = await request(app)
        .patch(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Hijack attempt' })
      expect(res.status).toBe(403)

      const fresh = await prisma.task.findUnique({ where: { id: taskId } })
      expect(fresh?.title).not.toBe('Hijack attempt')
    })
  })

  describe('DELETE /api/v1/tasks/:id', () => {
    it('rejects a non-member trying to delete another project\'s task', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/${taskId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)

      // Task must still exist
      const fresh = await prisma.task.findUnique({ where: { id: taskId } })
      expect(fresh).not.toBeNull()
    })
  })

  describe('GET /api/v1/tasks', () => {
    it('401 without auth', async () => {
      const res = await request(app).get('/api/v1/tasks?project_id=' + projectId)
      expect(res.status).toBe(401)
    })

    it('400 without project_id (unscoped listing is forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(400)
    })

    it('403 when listing tasks in a project the user does not belong to', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks?project_id=${otherProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/tasks', () => {
    it('403 when creating a task in a project the user does not belong to', async () => {
      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ project_id: projectId, title: 'Cross-project injection' })
      expect(res.status).toBe(403)

      const injected = await prisma.task.findFirst({
        where: { projectId, title: 'Cross-project injection' },
      })
      expect(injected).toBeNull()
    })
  })

  describe('POST /api/v1/tasks/:id/comments - #160 impersonation', () => {
    it('ignores client-supplied author_name and stores the authenticated user', async () => {
      const bogusName = 'CEO of the Company'
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          body_rich: 'This is a test comment.',
          author_name: bogusName,
        })
      expect(res.status).toBe(201)

      const stored = await prisma.taskComment.findUnique({
        where: { id: res.body.data.id },
      })
      expect(stored?.authorName).not.toBe(bogusName)
      expect(stored?.authorName).toBe(memberName)
      expect(stored?.authorId).toBe(memberId)
    })

    it('rejects non-member commenters (cross-project IDOR)', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${taskId}/comments`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ body_rich: 'unauthorized comment' })
      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/v1/tasks/bulk', () => {
    it('403 if the bulk batch contains a task from another project', async () => {
      const res = await request(app)
        .post('/api/v1/tasks/bulk')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          task_ids: [taskId, otherTaskId],
          updates: { status: 'DONE' },
        })
      expect(res.status).toBe(403)

      // Neither task should have been updated
      const t1 = await prisma.task.findUnique({ where: { id: taskId } })
      const t2 = await prisma.task.findUnique({ where: { id: otherTaskId } })
      expect(t1?.status).not.toBe('DONE')
      expect(t2?.status).not.toBe('DONE')
    })
  })

  describe('/attachments/:id', () => {
    it('DELETE returns 403 when the caller is not a project member', async () => {
      const att = await prisma.taskAttachment.create({
        data: {
          taskId,
          fileName: `sec-${ts}.txt`,
          storageKey: `sec/${ts}.txt`,
          fileUrl: `data:text/plain;base64,dGVzdA==`,
          sizeBytes: 4,
          mimeType: 'text/plain',
        },
      })

      try {
        const res = await request(app)
          .delete(`/api/v1/attachments/${att.id}`)
          .set('Authorization', `Bearer ${outsiderToken}`)
        expect(res.status).toBe(403)

        const still = await prisma.taskAttachment.findUnique({ where: { id: att.id } })
        expect(still).not.toBeNull()
      } finally {
        await prisma.taskAttachment.deleteMany({ where: { id: att.id } })
      }
    })
  })

  describe('/relations/:id', () => {
    it('DELETE returns 403 when the caller is not a project member', async () => {
      // Need a second task in the same project so we can create a relation
      const buddyTask = await prisma.task.create({
        data: { projectId, title: `relation buddy ${ts}` },
      })
      const rel = await prisma.taskRelation.create({
        data: {
          fromTaskId: taskId,
          toTaskId: buddyTask.id,
          relationType: 'RELATES',
        },
      })

      try {
        const res = await request(app)
          .delete(`/api/v1/relations/${rel.id}`)
          .set('Authorization', `Bearer ${outsiderToken}`)
        expect(res.status).toBe(403)

        const still = await prisma.taskRelation.findUnique({ where: { id: rel.id } })
        expect(still).not.toBeNull()
      } finally {
        await prisma.taskRelation.deleteMany({ where: { id: rel.id } })
        await prisma.task.delete({ where: { id: buddyTask.id } })
      }
    })
  })

  describe('/board/move-task', () => {
    it('returns 403 when the task belongs to another project', async () => {
      const res = await request(app)
        .post('/api/v1/board/move-task')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ task_id: otherTaskId, target_status: 'DONE' })
      expect(res.status).toBe(403)
    })
  })

  describe('/task-analytics/statistics', () => {
    it('returns 400 without project_id', async () => {
      const res = await request(app)
        .get('/api/v1/task-analytics/statistics')
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(400)
    })

    it('returns 403 when querying stats for a project the user does not belong to', async () => {
      const res = await request(app)
        .get(`/api/v1/task-analytics/statistics?project_id=${otherProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(403)
    })
  })
})
