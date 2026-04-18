import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

/**
 * Shape of the user attached to a Socket after successful auth.
 * Intentionally compatible with AuthRequest.user in auth.middleware.
 */
export interface SocketUser {
  userId: string
  email: string | null
  role: string | null
  isAdmin: boolean
}

/** Result of running JWT verification on a socket handshake. */
export interface RealtimeAuthResult {
  ok: boolean
  user?: SocketUser
  error?: string
}

/**
 * Extracts a JWT token from a Socket.IO handshake.
 * Preferred location: handshake.auth.token (set via io(url, { auth: { token } })).
 * Falls back to Authorization header and query.token for compatibility.
 */
export function extractTokenFromHandshake(handshake: Socket['handshake']): string | null {
  const auth = (handshake.auth ?? {}) as Record<string, unknown>
  const authToken = typeof auth.token === 'string' ? auth.token : null
  if (authToken) return authToken

  const headerRaw = handshake.headers?.authorization
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7)
  }

  const queryToken = handshake.query?.token
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken
  }
  return null
}

/**
 * Verifies a JWT string using the server-configured secret and loads the user
 * record to determine admin status. Returns a pure result (no side effects).
 */
export async function verifySocketToken(
  token: string | null,
  secret: string | undefined,
  opts?: { adminEmails?: string }
): Promise<RealtimeAuthResult> {
  if (!secret) return { ok: false, error: 'Server not configured: JWT_SECRET missing' }
  if (!token) return { ok: false, error: 'Authentication required' }

  let decoded: unknown
  try {
    decoded = jwt.verify(token, secret)
  } catch {
    return { ok: false, error: 'Invalid or expired token' }
  }

  if (!decoded || typeof decoded !== 'object' || !('userId' in decoded)) {
    return { ok: false, error: 'Invalid token payload' }
  }

  const userId = (decoded as { userId: unknown }).userId
  if (typeof userId !== 'string' || userId.length === 0) {
    return { ok: false, error: 'Invalid token payload' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  const adminEmails = opts?.adminEmails ?? process.env.ADMIN_EMAILS
  const isAdmin = await resolveIsAdmin(user.email, user.role, adminEmails)

  return {
    ok: true,
    user: {
      userId: user.id,
      email: user.email,
      role: user.role ?? null,
      isAdmin,
    },
  }
}

/**
 * Admin resolution mirrors auth.middleware.requireAdmin:
 * - SUPERIOR_ADMIN / COMPANY_ADMIN role → admin
 * - ADMIN_EMAILS env var lists email → admin
 * - otherwise first-registered user is admin
 */
async function resolveIsAdmin(
  email: string | null,
  role: string | null,
  adminEmailsEnv: string | undefined
): Promise<boolean> {
  if (role === 'SUPERIOR_ADMIN' || role === 'COMPANY_ADMIN') return true
  if (!email) return false
  const lower = email.toLowerCase()
  if (adminEmailsEnv && adminEmailsEnv.trim().length > 0) {
    const allowed = adminEmailsEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    return allowed.includes(lower)
  }
  const first = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  })
  return first?.email?.toLowerCase() === lower
}

/**
 * Returns true if the given user is a member of the project (ProjectMember row).
 * Admin users bypass membership checks.
 */
export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId },
    select: { id: true },
  })
  return !!member
}

/**
 * Builds the list of allowed Socket.IO CORS origins.
 * - APP_URL (production front-end) when set
 * - localhost:3000 always (dev)
 * - Any additional URLs listed in SOCKET_IO_ALLOWED_ORIGINS (comma-separated)
 */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>()
  origins.add('http://localhost:3000')
  origins.add('http://127.0.0.1:3000')
  if (process.env.APP_URL) origins.add(process.env.APP_URL)
  if (process.env.SOCKET_IO_ALLOWED_ORIGINS) {
    for (const o of process.env.SOCKET_IO_ALLOWED_ORIGINS.split(',')) {
      const trimmed = o.trim()
      if (trimmed) origins.add(trimmed)
    }
  }
  return Array.from(origins)
}
