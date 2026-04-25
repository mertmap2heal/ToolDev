import { anthropicAdapter } from './anthropic.adapter'
import { resolveUserKey } from '../aiCredentials.service'

/**
 * Shared provider interface. Every adapter exposes a single `chat`
 * method so the caller never branches on provider-specific SDK shape.
 * The `system` + `user` pair keeps the call independent of any
 * conversation history -- AI draft / review / impact in the
 * parameters pipeline are stateless one-shots.
 */
export interface AiProviderAdapter {
  chat(req: {
    system: string
    user: string
    maxTokens?: number
    model?: string
  }): Promise<{
    text: string
    tokensIn: number
    tokensOut: number
    model: string
    modelVersion: string
  }>
}

/**
 * Resolve a provider adapter for the current request.
 *
 * Precedence (plan §2.5):
 *   1. Future: per-request BYOK header → provider + decrypted key
 *   2. Future: user's stored UserAiCredential → provider + key
 *   3. Project's self-hosted URL override → self-hosted adapter
 *   4. Global env AI_DEFAULT_PROVIDER + operator-provisioned key
 *
 * Phase 1c (a): only paths 3 and 4 are live. The operator sets
 * ANTHROPIC_API_KEY (or future OPENAI_API_KEY / etc.) and the
 * hosted default adapter serves every request.
 */
export function resolveProvider(opts: {
  provider?: string
  apiKey?: string
}): AiProviderAdapter {
  const provider = opts.provider ?? process.env.AI_DEFAULT_PROVIDER ?? 'anthropic'
  switch (provider) {
    case 'anthropic':
      return anthropicAdapter(opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '')
    // openai / azure / google / selfHosted adapters land in follow-up PRs
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

/**
 * Async resolver that consults the user's BYOK UserAiCredential first
 * (Option B in plan §2.5) and falls back to env defaults (Option C).
 *
 * Routes that have an authenticated user should prefer this over
 * `resolveProvider`. The returned object carries the provider id so
 * the caller can record which path was taken in the audit row.
 */
export async function resolveProviderForUser(args: {
  userId: string | null
  projectId: string | null
}): Promise<{ adapter: AiProviderAdapter; provider: string; source: 'byok' | 'env-default' }> {
  if (args.userId) {
    const byokProvider = process.env.AI_DEFAULT_PROVIDER ?? 'anthropic'
    const key = await resolveUserKey(args.userId, byokProvider)
    if (key) {
      return {
        adapter: resolveProvider({ provider: byokProvider, apiKey: key }),
        provider: byokProvider,
        source: 'byok',
      }
    }
  }
  const provider = process.env.AI_DEFAULT_PROVIDER ?? 'anthropic'
  return {
    adapter: resolveProvider({ provider }),
    provider,
    source: 'env-default',
  }
}
