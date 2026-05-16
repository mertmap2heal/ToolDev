/**
 * requireEngineeringRole middleware tests (R-7, issue #407).
 *
 * Covers the discipline-gated sign-off authorisation chokepoint
 * `requireEngineeringRole` in auth.middleware.ts:
 *   - AC#4: 401 (no auth), 403 (authenticated but holds none of the named
 *           roles), next() (holds at least one named role).
 *   - platform-admin break-glass bypass.
 *   - project owner WITHOUT an engineering role is still 403 (owner does not
 *     bypass — the deliberate decision-2 posture).
 *   - unresolved project id -> 500 (a route wiring bug).
 *
 * Real DB fixtures, no mocks (.claude/testing.md). Isolated data with unique
 * timestamps; full afterAll cleanup in reverse dependency order. The fixture
 * uses a uniquely-named throwaway EngineeringRole so cleanup is fully
 * self-contained — the predefined catalogue is never touched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Response } from 'express'
import { prisma } from '../lib/prisma'
import {
  requireEngineeringRole,
  type AuthRequest,
} from '../middleware/auth.middleware'

const stamp = Date.now()
const suiteTag = `req-eng-role-${stamp}`

const createdAssignmentIds: string[] = []
const createdProjectIds: string[] = []
const createdUserIds: string[] = []
let throwawayRoleId: string | undefined

function uniqueEmail(prefix: string): string {
  return `${suiteTag}-${prefix}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

/**
 * Invoke a `requireEngineeringRole` middleware instance directly with crafted
 * req/res/next; resolve the result. Mirrors the runRequireReauth harness in
 * auth.reauth.test.ts.
 */
function runMiddleware(
  middleware: ReturnType<typeof requireEngineeringRole>,
  opts: { userId?: string; params?: Record<string, string> }
): Promise<{ status: number; body: unknown; nextCalled: boolean }> {
  return new Promise((resolve) => {
    let nextCalled = false
    const req = {
      headers: {},
      params: opts.params ?? {},
      userId: opts.userId,
      user: opts.userId
        ? { id: opts.userId, userId: opts.userId }
        : undefined,
    } as unknown as AuthRequest
    let statusCode = 200
    const res = {
      status(code: number) {
        statusCode = code
        return res
      },
      json(payload: unknown) {
        resolve({ status: statusCode, body: payload, nextCalled })
        return res
      },
    } as unknown as Response
    const next = () => {
      nextCalled = true
      resolve({ status: 200, body: null, nextCalled })
    }
    void middleware(req, res, next)
  })
}

describe('requireEngineeringRole middleware (R-7)', () => {
  // The discipline this fixture's middleware will require.
  const requiredRoleName = `${suiteTag}-Verification-Engineer`
  // A discipline the role-holder does NOT have — for the 403 case.
  const otherRoleName = `${suiteTag}-Safety-Engineer`

  let holderUserId: string // holds requiredRoleName on the project
  let ownerUserId: string // owns the project, holds NO engineering role
  let platformAdminUserId: string // SUPERIOR_ADMIN, holds NO engineering role
  let projectId: string

  beforeAll(async () => {
    // The project is owned by `ownerUser`; the role is held by a DIFFERENT
    // user (`holderUser`) — this proves authorisation is the assignment, not
    // ownership.
    const ownerUser = await prisma.user.create({
      data: {
        email: uniqueEmail('owner'),
        password: 'x',
        name: 'Owner User',
      },
    })
    ownerUserId = ownerUser.id
    createdUserIds.push(ownerUserId)

    const holderUser = await prisma.user.create({
      data: {
        email: uniqueEmail('holder'),
        password: 'x',
        name: 'Role Holder',
      },
    })
    holderUserId = holderUser.id
    createdUserIds.push(holderUserId)

    const adminUser = await prisma.user.create({
      data: {
        email: uniqueEmail('admin'),
        password: 'x',
        name: 'Platform Admin',
        role: 'SUPERIOR_ADMIN',
      },
    })
    platformAdminUserId = adminUser.id
    createdUserIds.push(platformAdminUserId)

    const slug = `${suiteTag}-project`
    const project = await prisma.project.create({
      data: {
        name: `R-7 MW Project ${stamp}`,
        domain: slug,
        slug,
        userId: ownerUserId,
      },
    })
    projectId = project.id
    createdProjectIds.push(projectId)

    // Uniquely-named throwaway role so cleanup never touches the catalogue.
    const role = await prisma.engineeringRole.create({
      data: { name: requiredRoleName, isSystem: false },
    })
    throwawayRoleId = role.id

    // Assign the required role to the holder on this project.
    const assignment = await prisma.projectUserEngineeringRole.create({
      data: {
        projectId,
        userId: holderUserId,
        roleId: role.id,
      },
    })
    createdAssignmentIds.push(assignment.id)
  })

  it('AC#4: returns 401 when the request is unauthenticated', async () => {
    const mw = requireEngineeringRole([requiredRoleName])
    const result = await runMiddleware(mw, { params: { projectId } })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(401)
    expect((result.body as { success: boolean }).success).toBe(false)
  })

  it('AC#4: returns 403 when the user holds none of the named roles', async () => {
    // Require a role the holder does NOT have.
    const mw = requireEngineeringRole([otherRoleName])
    const result = await runMiddleware(mw, {
      userId: holderUserId,
      params: { projectId },
    })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(403)
    expect((result.body as { error: string }).error).toMatch(
      /do not hold an engineering role/i
    )
  })

  it('AC#4: calls next() when the user holds a named role', async () => {
    const mw = requireEngineeringRole([requiredRoleName])
    const result = await runMiddleware(mw, {
      userId: holderUserId,
      params: { projectId },
    })
    expect(result.nextCalled).toBe(true)
  })

  it('calls next() for a platform admin even with no engineering role (bypass)', async () => {
    const mw = requireEngineeringRole([requiredRoleName])
    const result = await runMiddleware(mw, {
      userId: platformAdminUserId,
      params: { projectId },
    })
    expect(result.nextCalled).toBe(true)
  })

  it('returns 403 for the project owner who holds no engineering role (owner does not bypass)', async () => {
    const mw = requireEngineeringRole([requiredRoleName])
    const result = await runMiddleware(mw, {
      userId: ownerUserId,
      params: { projectId },
    })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(403)
  })

  it('resolves the project id from req.params.id when projectId is absent', async () => {
    // The engineering-role routes in projects.routes.ts use `:id`.
    const mw = requireEngineeringRole([requiredRoleName])
    const result = await runMiddleware(mw, {
      userId: holderUserId,
      params: { id: projectId },
    })
    expect(result.nextCalled).toBe(true)
  })

  it('honours an explicit projectIdParam override', async () => {
    const mw = requireEngineeringRole([requiredRoleName], {
      projectIdParam: 'pid',
    })
    const result = await runMiddleware(mw, {
      userId: holderUserId,
      params: { pid: projectId },
    })
    expect(result.nextCalled).toBe(true)
  })

  it('returns 500 when no project id can be resolved from the route', async () => {
    const mw = requireEngineeringRole([requiredRoleName])
    const result = await runMiddleware(mw, {
      userId: holderUserId,
      params: {},
    })
    expect(result.nextCalled).toBe(false)
    expect(result.status).toBe(500)
  })

  afterAll(async () => {
    // Reverse dependency order. The throwaway role is uniquely named and
    // created by this suite — safe to delete. The predefined catalogue is
    // never touched.
    if (createdAssignmentIds.length) {
      await prisma.projectUserEngineeringRole
        .deleteMany({ where: { id: { in: createdAssignmentIds } } })
        .catch(() => {})
    }
    if (createdProjectIds.length) {
      await prisma.project
        .deleteMany({ where: { id: { in: createdProjectIds } } })
        .catch(() => {})
    }
    if (createdUserIds.length) {
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => {})
    }
    if (throwawayRoleId) {
      await prisma.engineeringRole
        .delete({ where: { id: throwawayRoleId } })
        .catch(() => {})
    }
    await prisma.$disconnect()
  })
})
