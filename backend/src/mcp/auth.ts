import { createHash, timingSafeEqual } from 'crypto'
import { prisma } from '../lib/prisma'

/**
 * Scoped API key auth for the MCP server. The MCP client
 * (Claude Desktop, claude-code, custom agent) presents a bearer token
 * that maps to a `ParameterMcpKey` row. The plaintext key is shown to
 * the admin exactly once at issuance; only the SHA-256 hash is stored.
 *
 * OAuth 2.1 + PKCE is the fast-follow; the scoped-API-key path covers
 * internal trusted agents while we build the OAuth layer.
 */

export interface McpAuthContext {
  keyId: string
  projectId: string
  issuedById: string
  scopes: string[]
  itarScope: boolean
}

function hash(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Verify an incoming bearer token. Returns the auth context or null.
 * Uses a constant-time compare on the hash to avoid timing leaks.
 */
export async function verifyMcpKey(token: string): Promise<McpAuthContext | null> {
  if (!token) return null
  const candidate = hash(token)
  const rows = await prisma.parameterMcpKey.findMany({
    where: { revokedAt: null },
    select: {
      id: true,
      keyHash: true,
      projectId: true,
      issuedById: true,
      scopes: true,
      itarScope: true,
      expiresAt: true,
    },
  })
  const candBuf = Buffer.from(candidate, 'hex')
  for (const r of rows) {
    const stored = Buffer.from(r.keyHash, 'hex')
    if (stored.length !== candBuf.length) continue
    if (!timingSafeEqual(stored, candBuf)) continue
    if (r.expiresAt && r.expiresAt < new Date()) return null
    await prisma.parameterMcpKey.update({
      where: { id: r.id },
      data: { lastUsedAt: new Date() },
    })
    return {
      keyId: r.id,
      projectId: r.projectId,
      issuedById: r.issuedById,
      scopes: r.scopes,
      itarScope: r.itarScope,
    }
  }
  return null
}

/**
 * Scope check. Tools declare which scope they need. Keys issued
 * without that scope cannot invoke the tool.
 */
export function hasScope(ctx: McpAuthContext, required: string): boolean {
  return ctx.scopes.includes(required)
}

/** Issue a new key. Returns the plaintext + row; plaintext is shown once. */
export async function issueKey(opts: {
  projectId: string
  issuedById: string
  name: string
  scopes: string[]
  itarScope?: boolean
  expiresAt?: Date | null
}): Promise<{ plaintext: string; id: string }> {
  const { randomBytes } = await import('crypto')
  const plaintext = 'mcp_' + randomBytes(32).toString('hex')
  const keyHash = hash(plaintext)
  const row = await prisma.parameterMcpKey.create({
    data: {
      projectId: opts.projectId,
      issuedById: opts.issuedById,
      name: opts.name,
      keyHash,
      scopes: opts.scopes,
      itarScope: opts.itarScope ?? false,
      expiresAt: opts.expiresAt ?? null,
    },
    select: { id: true },
  })
  return { plaintext, id: row.id }
}
