import { createHash } from 'crypto'
import { prisma } from '../lib/prisma'
import type { McpAuthContext } from './auth'

/**
 * Every MCP tool call writes one AiInvocation row. The NDJSON export
 * (rest.ai.invocations.export) serves these for ISO/IEC 42001 Annex B
 * audits. Token counts are zero for tools that do not call an LLM
 * (e.g. list_parameters) - we still record the call so the user's
 * activity is traceable.
 */

export interface AuditCallArgs {
  ctx: McpAuthContext
  toolName: string // e.g. "mcp.list_parameters"
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4'
  input: unknown
  output: unknown
  success: boolean
  errorMessage?: string | null
  startedAt: number
  tokensIn?: number
  tokensOut?: number
  model?: string | null
  modelVersion?: string | null
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

export async function recordCall(args: AuditCallArgs): Promise<void> {
  const inputHash = sha256(JSON.stringify(args.input ?? {}))
  const outputHash = args.success ? sha256(JSON.stringify(args.output ?? {})) : null
  const contextHash = inputHash

  await prisma.aiInvocation.create({
    data: {
      projectId: args.ctx.projectId,
      userId: null,
      agentKeyId: args.ctx.keyId,
      toolName: args.toolName,
      tier: args.tier,
      model: args.model ?? null,
      modelVersion: args.modelVersion ?? null,
      promptId: null,
      contextHash,
      inputHash,
      outputHash,
      contextTokens: args.tokensIn ?? 0,
      outputTokens: args.tokensOut ?? 0,
      success: args.success,
      errorMessage: args.errorMessage ?? null,
      durationMs: Date.now() - args.startedAt,
    },
  })
}
