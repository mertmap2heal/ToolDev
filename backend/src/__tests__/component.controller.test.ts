/**
 * Tests for /api/v1/projects/:projectId/components — PBS / Component CRUD.
 *
 * Mounted at /projects via componentsRoutes; auth middleware enforces
 * authenticateToken + projectIdParam membership chain.
 *
 * Coverage:
 *   - 401 unauthenticated
 *   - 403 outsider (project member chain)
 *   - tree GET, root creation idempotency
 *   - component create with parent, with bad parent, root re-create blocked
 *   - update (rename), block changing root parent, prevent self-parent,
 *     reject circular reference
 *   - delete: cannot delete root, requires reassignTo when has children,
 *     reassign with target component
 *   - syncPBSToComponents: validation of parentId scoped to project
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Components controller — /api/v1/projects/:projectId/components', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `cmp-o-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `cmp-x-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `cmp-${stamp}`
    const p = await prisma.project.create({
      data: { name: `Cmp ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = p.id
  })

  afterAll(async () => {
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.component.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET tree without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/components`)
    expect(res.status).toBe(401)
  })

  it('GET tree by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET /components/root creates a root MPAC component when none exists', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/components/root`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.parentId).toBeNull()
    expect(res.body.data.isRoot).toBe(true)
    expect(res.body.data.name).toBe('MPAC')
  })

  it('GET /components/root is idempotent — returns the same root', async () => {
    const a = await request(app)
      .get(`/api/v1/projects/${projectId}/components/root`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    const b = await request(app)
      .get(`/api/v1/projects/${projectId}/components/root`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(a.body.data.id).toBe(b.body.data.id)
  })

  it('GET tree returns the root component', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0].isRoot).toBe(true)
  })

  it('POST without name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'no name' })
    expect(res.status).toBe(400)
  })

  it('POST without parentId after root exists returns 400 (only one root allowed)', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Second root ${stamp}` })
    expect(res.status).toBe(400)
  })

  it('POST with bad parentId returns 404', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: `Bad parent ${stamp}`,
        parentId: '00000000-0000-0000-0000-000000000000',
      })
    expect(res.status).toBe(404)
  })

  let childAId: string
  let childBId: string
  let rootId: string

  it('POST creates a child under the root', async () => {
    const root = await request(app)
      .get(`/api/v1/projects/${projectId}/components/root`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    rootId = root.body.data.id

    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Child A ${stamp}`, parentId: rootId, description: 'desc' })
    expect(res.status).toBe(201)
    expect(res.body.data.parentId).toBe(rootId)
    childAId = res.body.data.id

    const res2 = await request(app)
      .post(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Child B ${stamp}`, parentId: rootId })
    expect(res2.status).toBe(201)
    childBId = res2.body.data.id
  })

  it('PUT renames a component', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/components/${childAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Child A renamed ${stamp}` })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe(`Child A renamed ${stamp}`)
  })

  it('PUT cannot change root component parent to non-null', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/components/${rootId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ parentId: childAId })
    expect(res.status).toBe(400)
  })

  it('PUT cannot set component as its own parent', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/components/${childAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ parentId: childAId })
    expect(res.status).toBe(400)
  })

  it('PUT cannot create a circular reference (descendant as parent)', async () => {
    // Create grandchild under childA, then try to set childA's parent = grandchild
    const gc = await request(app)
      .post(`/api/v1/projects/${projectId}/components`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Grand ${stamp}`, parentId: childAId })
    expect(gc.status).toBe(201)
    const gcId = gc.body.data.id

    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/components/${childAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ parentId: gcId })
    expect(res.status).toBe(400)
  })

  it('DELETE on root component returns 400', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectId}/components/${rootId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
  })

  it('DELETE on a component with children without reassignTo returns 400', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectId}/components/${childAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
  })

  it('DELETE with reassignTo moves children and succeeds', async () => {
    const res = await request(app)
      .delete(`/api/v1/projects/${projectId}/components/${childAId}`)
      .query({ reassignTo: childBId })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const gone = await prisma.component.findUnique({ where: { id: childAId } })
    expect(gone).toBeNull()
  })

  it('GET /:componentId returns 404 for unknown component', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/components/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('POST /sync-pbs rejects when parentId is not in project (security #293)', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/components/sync-pbs`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        nodes: [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Bad', parentId: '99999999-9999-9999-9999-999999999999' },
        ],
      })
    expect(res.status).toBe(400)
  })

  it('POST /sync-pbs with non-array nodes returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/components/sync-pbs`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ nodes: 'not-an-array' })
    expect(res.status).toBe(400)
  })
})
