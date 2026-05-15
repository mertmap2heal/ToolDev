/**
 * SEC-2 (#375) — tenant-scope regression tests for AutomationRule + TaskTemplate
 * + TaskTag + POST /tasks/bulk.
 *
 * Pre-fix: every endpoint below leaked across tenants.
 * Post-fix:
 *  - automation rule list/create/test/runs require project membership;
 *    `requireRuleProjectMember` resolves AutomationRule.projectId.
 *  - task-template GET/PATCH/DELETE pass through `requireTemplateProjectMember`
 *    which writes a tasks:tenant-scope-denied audit row for foreign tenants.
 *  - tags are project-scoped via @@unique([projectId, name]); same-name in
 *    two projects coexists.
 *  - /tasks/bulk asserts project_id at the route layer.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('SEC-2 (#375) — Tasks-domain tenant scope', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  let projectAId: string
  let projectBId: string

  let ruleAId: string
  let ruleBId: string
  let templateAId: string
  let templateBId: string
  let tagAId: string
  let tagBId: string
  let taskAId: string
  let taskBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const userA = await prisma.user.create({
      data: { email: `sec2-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `sec2-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const slugA = `sec2-a-${stamp}`
    const slugB = `sec2-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `SEC2 A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `SEC2 B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectAId, userId: userAId, role: 'owner', status: 'accepted' },
        { projectId: projectBId, userId: userBId, role: 'owner', status: 'accepted' },
      ],
    })

    // AutomationRules - one per project.
    const ruleA = await prisma.automationRule.create({
      data: {
        name: `rule-a-${stamp}`,
        triggerType: 'status_changed',
        conditionsJson: JSON.stringify({ operator: 'AND', conditions: [] }),
        actionsJson: '[]',
        projectId: projectAId,
      },
    })
    ruleAId = ruleA.id
    const ruleB = await prisma.automationRule.create({
      data: {
        name: `rule-b-${stamp}`,
        triggerType: 'status_changed',
        conditionsJson: JSON.stringify({ operator: 'AND', conditions: [] }),
        actionsJson: '[]',
        projectId: projectBId,
      },
    })
    ruleBId = ruleB.id

    // TaskTemplates - one per project.
    const tplA = await prisma.taskTemplate.create({
      data: { projectId: projectAId, name: `tpl-a-${stamp}`, title: 'A' },
    })
    templateAId = tplA.id
    const tplB = await prisma.taskTemplate.create({
      data: { projectId: projectBId, name: `tpl-b-${stamp}`, title: 'B' },
    })
    templateBId = tplB.id

    // TaskTags - one per project with intentionally the same name to prove
    // the @@unique([projectId, name]) lets them coexist.
    const tagA = await prisma.taskTag.create({
      data: { name: `shared-tag-${stamp}`, projectId: projectAId },
    })
    tagAId = tagA.id
    const tagB = await prisma.taskTag.create({
      data: { name: `shared-tag-${stamp}`, projectId: projectBId },
    })
    tagBId = tagB.id

    // Tasks - one per project.
    const taskA = await prisma.task.create({
      data: { projectId: projectAId, title: `task-a-${stamp}` },
    })
    taskAId = taskA.id
    const taskB = await prisma.task.create({
      data: { projectId: projectBId, title: `task-b-${stamp}` },
    })
    taskBId = taskB.id
  })

  afterAll(async () => {
    await prisma.auditLog
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.taskTagLink
      .deleteMany({ where: { tagId: { in: [tagAId, tagBId] } } })
      .catch(() => {})
    await prisma.taskTag
      .deleteMany({ where: { id: { in: [tagAId, tagBId] } } })
      .catch(() => {})
    await prisma.automationRun
      .deleteMany({ where: { ruleId: { in: [ruleAId, ruleBId] } } })
      .catch(() => {})
    await prisma.automationRule
      .deleteMany({ where: { id: { in: [ruleAId, ruleBId] } } })
      .catch(() => {})
    await prisma.taskTemplate
      .deleteMany({ where: { id: { in: [templateAId, templateBId] } } })
      .catch(() => {})
    await prisma.task
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.projectMember
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project
      .deleteMany({ where: { id: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [userAId, userBId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  // ---------- AutomationRule ----------

  it('GET /automation/rules without project_id returns 400 (route asserts scope)', async () => {
    const res = await request(app)
      .get('/api/v1/automation/rules')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(400)
  })

  it('User A cannot list project B rules via project_id=B (#375)', async () => {
    const res = await request(app)
      .get(`/api/v1/automation/rules?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('User A listing their own project returns only their own rules', async () => {
    const res = await request(app)
      .get(`/api/v1/automation/rules?project_id=${projectAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).toContain(ruleAId)
    expect(ids).not.toContain(ruleBId)
  })

  it('User A cannot test-run rule B (#375)', async () => {
    const res = await request(app)
      .post(`/api/v1/automation/rules/${ruleBId}/test`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ task_id: taskBId })
    expect(res.status).toBe(403)
  })

  it('User A cannot read runs of rule B via rule_id (#375)', async () => {
    const res = await request(app)
      .get(`/api/v1/automation/runs?project_id=${projectAId}&rule_id=${ruleBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    // rule_id belongs to a different project than the asserted project_id.
    expect([403, 404]).toContain(res.status)
  })

  it('a tenant-scope-denied audit row is written on a foreign rule probe with resource=automation-rule', async () => {
    await request(app)
      .post(`/api/v1/automation/rules/${ruleBId}/test`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ task_id: taskBId })
    const audit = await prisma.auditLog.findFirst({
      where: {
        projectId: projectBId,
        userId: userAId,
        action: 'tasks:tenant-scope-denied',
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).not.toBeNull()
    // SEC-2 review MEDIUM-1: per-route resource label flows into the audit row.
    const details = JSON.parse(audit!.details ?? '{}')
    expect(details.resource).toBe('automation-rule')
    expect(details.resourceId).toBe(ruleBId)
  })

  it('foreign rule-list probe writes audit row with resource=automation-rule (requireBodyProjectMember query)', async () => {
    // Clear any prior deny rows so we can assert on the newest write.
    await prisma.auditLog
      .deleteMany({
        where: {
          projectId: projectBId,
          userId: userAId,
          action: 'tasks:tenant-scope-denied',
        },
      })
      .catch(() => {})
    await request(app)
      .get(`/api/v1/automation/rules?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    const audit = await prisma.auditLog.findFirst({
      where: {
        projectId: projectBId,
        userId: userAId,
        action: 'tasks:tenant-scope-denied',
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).not.toBeNull()
    const details = JSON.parse(audit!.details ?? '{}')
    expect(details.resource).toBe('automation-rule')
  })

  // ---------- TaskTemplate ----------

  it('User A cannot GET project B template (returns 404 to avoid existence-leak) (#375)', async () => {
    const res = await request(app)
      .get(`/api/v1/task-templates/${templateBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })

  it('User A cannot PATCH project B template (#375)', async () => {
    const res = await request(app)
      .patch(`/api/v1/task-templates/${templateBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'pwned' })
    expect(res.status).toBe(404)
    const after = await prisma.taskTemplate.findUnique({ where: { id: templateBId } })
    expect(after!.name).not.toBe('pwned')
  })

  it('User A cannot DELETE project B template (#375)', async () => {
    const res = await request(app)
      .delete(`/api/v1/task-templates/${templateBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.taskTemplate.findUnique({ where: { id: templateBId } })
    expect(stillThere).not.toBeNull()
  })

  // ---------- TaskTag ----------

  it('GET /tags without project_id returns 400', async () => {
    const res = await request(app)
      .get('/api/v1/tags')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(400)
  })

  it('User A listing project A tags does NOT see project B tags', async () => {
    const res = await request(app)
      .get(`/api/v1/tags?project_id=${projectAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((t) => t.id)
    expect(ids).toContain(tagAId)
    expect(ids).not.toContain(tagBId)
  })

  it('User A cannot list project B tags (#375)', async () => {
    const res = await request(app)
      .get(`/api/v1/tags?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
  })

  it('Same-name tag in two projects coexists without P2002 (drops the global unique)', async () => {
    // Both tagAId and tagBId have the SAME name with different projectIds.
    // Verifies the @@unique([projectId, name]) replaces the global @unique.
    expect(tagAId).not.toBe(tagBId)
    // Create a fresh same-name tag in project A as user A - should fail
    // because (projectA, sharedName) already exists.
    const res = await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectAId, name: `shared-tag-${stamp}` })
    expect(res.status).toBe(400)
  })

  // ---------- /tasks/bulk ----------

  it('POST /tasks/bulk without project_id returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/tasks/bulk')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ task_ids: [taskAId], updates: { priority: 'HIGH' } })
    expect(res.status).toBe(400)
  })

  it('POST /tasks/bulk with foreign task_ids is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/tasks/bulk')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectAId, task_ids: [taskBId], updates: { priority: 'HIGH' } })
    // Controller-side check: tasks in projectB are not visible to A; the
    // membership check rejects with 403.
    expect([403, 404]).toContain(res.status)
  })

  // ---------- SEC-2 review MEDIUM-1: per-route resource label verification ----------
  //
  // Each consumer of `requireBodyProjectMember` passes a specific
  // resourceLabel option so the deny-audit row records the actual route
  // resource (e.g. task-tag, tasks-bulk, board) rather than the generic
  // 'project-scope-body'. The tests below assert one row per resource label
  // by triggering a foreign-tenant probe on each surface.

  async function clearDenyRows(): Promise<void> {
    await prisma.auditLog
      .deleteMany({
        where: {
          projectId: projectBId,
          userId: userAId,
          action: 'tasks:tenant-scope-denied',
        },
      })
      .catch(() => {})
  }

  async function findLatestDeny(): Promise<{ resource: string; resourceId: string | null } | null> {
    const audit = await prisma.auditLog.findFirst({
      where: {
        projectId: projectBId,
        userId: userAId,
        action: 'tasks:tenant-scope-denied',
      },
      orderBy: { createdAt: 'desc' },
    })
    if (!audit) return null
    const details = JSON.parse(audit.details ?? '{}')
    return { resource: details.resource, resourceId: details.resourceId ?? null }
  }

  it('foreign tag-list probe writes resource=task-tag', async () => {
    await clearDenyRows()
    await request(app)
      .get(`/api/v1/tags?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('task-tag')
  })

  it('foreign tag-create probe writes resource=task-tag', async () => {
    await clearDenyRows()
    await request(app)
      .post('/api/v1/tags')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId, name: `foreign-tag-${stamp}` })
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('task-tag')
  })

  it('foreign board-columns probe writes resource=board', async () => {
    await clearDenyRows()
    await request(app)
      .get(`/api/v1/board/columns?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('board')
  })

  it('foreign analytics probe writes resource=task-analytics', async () => {
    await clearDenyRows()
    await request(app)
      .get(`/api/v1/task-analytics/statistics?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('task-analytics')
  })

  it('foreign time-logs probe writes resource=time-log', async () => {
    await clearDenyRows()
    await request(app)
      .get(`/api/v1/time-tracking?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('time-log')
  })

  it('foreign import-export probe writes resource=task-import-export', async () => {
    await clearDenyRows()
    await request(app)
      .post('/api/v1/csv/export')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId, format: 'csv' })
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('task-import-export')
  })

  it('foreign /tasks/bulk probe writes resource=tasks-bulk', async () => {
    await clearDenyRows()
    await request(app)
      .post('/api/v1/tasks/bulk')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId, task_ids: [taskBId], updates: { priority: 'HIGH' } })
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('tasks-bulk')
  })

  it('foreign /tasks list probe writes resource=task-list', async () => {
    await clearDenyRows()
    await request(app)
      .get(`/api/v1/tasks?project_id=${projectBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('task-list')
  })

  it('foreign /tasks create probe writes resource=task-create', async () => {
    await clearDenyRows()
    await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId, title: 'foreign-create' })
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    expect(latest!.resource).toBe('task-create')
  })

  it('foreign template-create-task probe writes resource=task-template', async () => {
    await clearDenyRows()
    await request(app)
      .post(`/api/v1/task-templates/${templateBId}/create-task`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId })
    const latest = await findLatestDeny()
    expect(latest).not.toBeNull()
    // requireBodyProjectMember writes a row with resourceLabel 'task-template'
    // because POST /:id/create-task is wired with that label.
    expect(latest!.resource).toBe('task-template')
  })
})
