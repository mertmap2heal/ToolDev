import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'


describe('Requirement Soft Delete Workflow', () => {
    let projectId: string
    let userId: string
    let token: string
    let requirementId: string
    let requirementDbId: string

    beforeAll(async () => {
        // 1. Create a test user
        const user = await prisma.user.create({
            data: {
                email: `test-${Date.now()}@example.com`,
                password: 'hashedpassword',
                name: 'Test User',
            },
        })
        userId = user.id
        token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')

        // 2. Create a test project
        const slug = `test-project-${Date.now()}`
        const project = await prisma.project.create({
            data: {
                name: `Test Project ${Date.now()}`,
                domain: slug,
                slug,
                description: 'Test project for delete workflow',
                userId: userId,
            },
        })
        projectId = project.id

        await prisma.projectMember.create({
            data: { projectId, userId, role: 'owner', status: 'accepted' },
        })
    })

    afterAll(async () => {
        // Cleanup
        await prisma.requirement.deleteMany({ where: { projectId } })
        await prisma.projectMember.deleteMany({ where: { projectId } })
        await prisma.project.delete({ where: { id: projectId } })
        await prisma.user.delete({ where: { id: userId } })
        await prisma.$disconnect()
    })

    it('should create a requirement', async () => {
        const res = await request(app)
            .post(`/api/v1/requirements/${projectId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Requirement to be deleted',
                description: 'This requirement will be soft deleted',
                requirementId: 'REQ-DEL-001',
                priority: 'High',
                status: 'Draft',
                stage: 'Analysis',
            })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        requirementDbId = res.body.data.id
        requirementId = res.body.data.requirementId
    })

    it('should soft delete the requirement', async () => {
        const res = await request(app)
            .delete(`/api/v1/requirements/${projectId}/${requirementDbId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'Testing soft delete' })

        expect(res.status).toBe(200)
        expect(res.body.message).toContain('moved to trash')

        // Verify it is not in normal list
        const listRes = await request(app)
            .get(`/api/v1/requirements/${projectId}`)
            .set('Authorization', `Bearer ${token}`)

        expect(listRes.body.data.items.some((r: any) => r.id === requirementDbId)).toBe(false)
    })

    it('should appear in recently deleted list', async () => {
        const res2 = await request(app)
            .get(`/api/v1/requirements/${projectId}/archive/recently-deleted`)
            .set('Authorization', `Bearer ${token}`)

        expect(res2.status).toBe(200)
        expect(res2.body.data).toBeDefined()
        const item = res2.body.data.find((r: any) => r.id === requirementDbId)
        expect(item).toBeDefined()
        expect(item.deletedAt).not.toBeNull()
        expect(item.deleteReason).toBe('Testing soft delete')
    })

    it('should prevent reusing the Requirement ID while soft deleted', async () => {
        const res = await request(app)
            .post(`/api/v1/requirements/${projectId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Duplicate ID Attempt',
                description: 'Should fail',
                requirementId: 'REQ-DEL-001', // Same ID as deleted one
                priority: 'Medium',
                status: 'Draft',
                stage: 'Analysis',
            })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('reserved until the deleted item is restored')
    })

    it('should restore the requirement', async () => {
        const res = await request(app)
            .post(`/api/v1/requirements/${projectId}/${requirementDbId}/restore`)
            .set('Authorization', `Bearer ${token}`)
            .send()

        expect(res.status).toBe(200)
        expect(res.body.message).toContain('restored')

        // Verify it is back in normal list
        const listRes = await request(app)
            .get(`/api/v1/requirements/${projectId}`)
            .set('Authorization', `Bearer ${token}`)

        expect(listRes.body.data.items.some((r: any) => r.id === requirementDbId)).toBe(true)
    })

    it('should permanently delete the requirement', async () => {
        // First soft delete again
        await request(app)
            .delete(`/api/v1/requirements/${projectId}/${requirementDbId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'Deleting for good' })

        // Then permanent delete
        const res = await request(app)
            .delete(`/api/v1/requirements/${projectId}/${requirementDbId}/permanent`)
            .set('Authorization', `Bearer ${token}`)
            .send()

        expect(res.status).toBe(200)
        expect(res.body.message).toContain('permanently deleted')

        // Verify it is gone from recently deleted
        const res2 = await request(app)
            .get(`/api/v1/requirements/${projectId}/archive/recently-deleted`)
            .set('Authorization', `Bearer ${token}`)

        expect(res2.body.data.some((r: any) => r.id === requirementDbId)).toBe(false)
    })

    it('should allow reusing the Requirement ID after permanent delete', async () => {
        const res = await request(app)
            .post(`/api/v1/requirements/${projectId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Reusing ID Success',
                description: 'Should succeed now',
                requirementId: 'REQ-DEL-001',
                priority: 'Medium',
                status: 'Draft',
                stage: 'Analysis',
            })

        expect(res.status).toBe(201)

        // Cleanup this new one
        await request(app)
            .delete(`/api/v1/requirements/${projectId}/requirements/${res.body.data.id}/permanent`) // This path is actually wrong? 
        // Regular delete route: /:projectId/:requirementId
        // Permanent delete route: /:projectId/requirements/:requirementId/permanent
        // Let's use regular delete for cleanup if permissions allow?
        // Actually, my test setup deletes all at the end.
    })
})
