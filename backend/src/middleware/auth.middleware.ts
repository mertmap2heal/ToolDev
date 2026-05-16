import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { resolveIsAdmin } from '../lib/adminAuth'

export interface AuthRequest extends Request {
  userId?: string
  user?: { id: string; userId?: string; name?: string; email?: string }
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server configuration error' })
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid token' })
    }

    // R-2 hardening: a reauth token (purpose: 'reauth', 60s TTL, minted by
    // POST /auth/reauth) must never be accepted as a session token. Without
    // this guard a short-lived reauth token would pass as a 7-day session
    // credential. Session tokens carry no `purpose` claim, so this rejects
    // only reauth tokens and leaves existing sessions unaffected.
    if (decoded && typeof decoded === 'object' && (decoded as { purpose?: string }).purpose === 'reauth') {
      return res.status(403).json({ success: false, error: 'Invalid token' })
    }

    if (decoded && typeof decoded === 'object' && 'userId' in decoded) {
      req.userId = decoded.userId as string
      req.user = { id: decoded.userId as string, userId: decoded.userId as string }
    }
    next()
  })
}

/** Requires authenticated user with role SUPERIOR_ADMIN. Use after authenticateToken. */
export const requireSuperiorAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user || user.role !== 'SUPERIOR_ADMIN') {
    return res.status(403).json({ success: false, error: 'Platform admin access required' })
  }
  next()
}

/** Requires admin (SUPERIOR_ADMIN, COMPANY_ADMIN, ADMIN_EMAILS, or first user). Use after authenticateToken. */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  })
  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found' })
  }
  const isAdmin =
    user.role === 'SUPERIOR_ADMIN' ||
    user.role === 'COMPANY_ADMIN' ||
    (await resolveIsAdmin(user.email))
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' })
  }
  next()
}

/**
 * Requires a valid reauthentication token (R-2, CFR 21 Part 11 §11.200(a)(1)).
 *
 * Consumer modules attach this AFTER `authenticateToken` to a sign-off
 * endpoint: the caller must have proved password possession within the last
 * 60 seconds via `POST /api/v1/auth/reauth`, then present the minted token
 * in the `X-Reauth-Token` header.
 *
 * Each failure mode returns 401 with a distinct message. On success: next().
 */
export const requireReauth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server configuration error' })
  }

  const reauthToken = req.headers['x-reauth-token']
  const token = Array.isArray(reauthToken) ? reauthToken[0] : reauthToken
  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: 'Reauthentication required' })
  }

  let decoded: jwt.JwtPayload
  try {
    // Pin HS256 (SEC-3 hardening posture): refuse any other algorithm,
    // including the `alg: none` downgrade.
    const verified = jwt.verify(token, secret, { algorithms: ['HS256'] })
    if (typeof verified !== 'object' || verified === null) {
      return res
        .status(401)
        .json({ success: false, error: 'Invalid reauth token' })
    }
    decoded = verified as jwt.JwtPayload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Reauth token expired - re-enter your password',
      })
    }
    return res
      .status(401)
      .json({ success: false, error: 'Invalid reauth token' })
  }

  if (decoded.purpose !== 'reauth') {
    return res
      .status(401)
      .json({ success: false, error: 'Not a reauth token' })
  }

  if (decoded.userId !== req.userId) {
    return res.status(401).json({
      success: false,
      error: 'Reauth token does not match the authenticated user',
    })
  }

  next()
}

/**
 * Discipline-gated sign-off authorisation chokepoint (R-7).
 *
 * A middleware FACTORY: call it with the engineering-role names that may
 * perform the action, get back an Express middleware. Attach AFTER
 * `authenticateToken` to a sign-off endpoint so the caller must hold one of
 * the named disciplines (e.g. `Verification Engineer`) on the route's
 * project via `ProjectUserEngineeringRole`.
 *
 * `EngineeringRole` gates sign-off authorisation; `AdminRole` gates whether
 * the endpoint can be called at all — they are different primitives.
 *
 * Project-id resolution: `req.params[opts.projectIdParam]` if given, else
 * `req.params.projectId`, else `req.params.id` (the engineering-role routes
 * in projects.routes.ts use `:id`).
 *
 * Bypass policy:
 *   - Platform admin (SUPERIOR_ADMIN / COMPANY_ADMIN / ADMIN_EMAILS)
 *     bypasses — break-glass, consistent with the other middleware here.
 *   - A project OWNER does NOT bypass. Ownership is a management capability,
 *     not an engineering discipline; a lead who legitimately signs holds the
 *     discipline role explicitly. This is the CFR 21 Part 11 posture.
 *
 * Fails closed: a DB error returns 500 and the request does not proceed.
 *
 * R-7 ships this middleware UNUSED. Consumer tickets (V-N1 validation
 * sign-off, and the certification / CM equivalents) wire it to endpoints.
 */
export const requireEngineeringRole =
  (roleNames: string[], opts?: { projectIdParam?: string }) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const projectId =
      req.params[opts?.projectIdParam ?? 'projectId'] ?? req.params.id
    if (!projectId) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: project id not found in route',
      })
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true },
      })
      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found' })
      }

      // Platform-admin break-glass bypass (project owner is intentionally not bypassed).
      const isPlatformAdmin =
        user.role === 'SUPERIOR_ADMIN' ||
        user.role === 'COMPANY_ADMIN' ||
        (await resolveIsAdmin(user.email))
      if (isPlatformAdmin) {
        return next()
      }

      const roles = await prisma.engineeringRole.findMany({
        where: { name: { in: roleNames } },
        select: { id: true },
      })
      const roleIds = roles.map((r) => r.id)

      const held =
        roleIds.length > 0 &&
        (await prisma.projectUserEngineeringRole.findFirst({
          where: { projectId, userId, roleId: { in: roleIds } },
          select: { id: true },
        }))
      if (held) {
        return next()
      }

      return res.status(403).json({
        success: false,
        error: 'You do not hold an engineering role permitted to perform this action',
      })
    } catch (err) {
      console.error('requireEngineeringRole:', err)
      return res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }

