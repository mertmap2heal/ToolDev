import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  createCredential,
  listCredentialsForUser,
  revokeCredential,
} from '../services/aiCredentials.service'

/**
 * BYOK credential CRUD. All routes are user-scoped: the authenticated
 * user can only see / create / revoke their own credentials. Admins do
 * NOT get elevated access to other users' plaintext keys - the key is
 * encrypted at rest and decrypted only for the single request that
 * needs it.
 */

export async function list(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'unauthenticated' })
      return
    }
    const data = await listCredentialsForUser(userId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'unauthenticated' })
      return
    }
    const { provider, label, plaintextKey, scopes } = req.body as {
      provider?: string
      label?: string
      plaintextKey?: string
      scopes?: string[]
    }
    if (!provider || !label || !plaintextKey) {
      res.status(400).json({ success: false, error: 'provider, label, plaintextKey required' })
      return
    }
    const data = await createCredential({ userId, provider, label, plaintextKey, scopes })
    res.status(201).json({ success: true, data })
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message })
  }
}

export async function revoke(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'unauthenticated' })
      return
    }
    const data = await revokeCredential(userId, req.params.id)
    res.json({ success: true, data })
  } catch (e) {
    res.status(404).json({ success: false, error: (e as Error).message })
  }
}
