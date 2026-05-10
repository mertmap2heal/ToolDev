import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { issueKey } from '../mcp/auth'

/**
 * Admin-only controller for issuing / listing / revoking MCP keys
 * on a project. Routes are guarded upstream with `requireAdmin` so
 * only SUPERIOR_ADMIN / COMPANY_ADMIN / ADMIN_EMAILS reach the
 * handlers below. Plaintext is returned ONCE on create and never
 * again - the caller must copy it or lose it.
 */

export async function list(req: AuthRequest, res: Response) {
  try {
    const keys = await prisma.parameterMcpKey.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        scopes: true,
        itarScope: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
      },
    })
    res.json({ success: true, data: keys })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'unauthenticated' })
      return
    }
    const { name, scopes, itarScope, expiresAt } = req.body as {
      name?: string
      scopes?: string[]
      itarScope?: boolean
      expiresAt?: string
    }
    if (!name || !Array.isArray(scopes) || scopes.length === 0) {
      res.status(400).json({ success: false, error: 'name + scopes[] required' })
      return
    }
    const { plaintext, id } = await issueKey({
      projectId: req.params.projectId,
      issuedById: userId,
      name: name.trim(),
      scopes,
      itarScope: !!itarScope,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    res.status(201).json({ success: true, data: { id, plaintext } })
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message })
  }
}

export async function revoke(req: AuthRequest, res: Response) {
  try {
    const existing = await prisma.parameterMcpKey.findFirst({
      where: { id: req.params.keyId, projectId: req.params.projectId, revokedAt: null },
    })
    if (!existing) {
      res.status(404).json({ success: false, error: 'key not found' })
      return
    }
    const userId = req.userId ?? null
    const updated = await prisma.parameterMcpKey.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), revokedBy: userId },
      select: { id: true, revokedAt: true },
    })
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
