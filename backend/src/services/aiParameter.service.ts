import { createHash } from 'crypto'
import { prisma } from '../lib/prisma'
import { resolveProvider } from './aiProvider'

const DRAFT_PROMPT_ID = 'prompt_v1_parameter_draft'
const DRAFT_SYSTEM = `You are an aerospace / automotive requirements engineer drafting parameters for a safety-critical engineering lifecycle tool.

Given a short natural-language description, produce a parameter definition as strict JSON:
{
  "name": "snake_case_identifier (short, descriptive)",
  "description": "one or two sentences",
  "dataType": "float | int | double | uint8 | uint16 | bool | string",
  "defaultValue": "string representation of the numeric default, if applicable",
  "unit": "SI unit symbol (kg, m, s, K, A, V, W, N, Pa, rpm, deg, rad/s) or empty",
  "minValue": "optional lower bound",
  "maxValue": "optional upper bound",
  "formula": "optional -- leave empty unless clearly derivable"
}

Never add commentary outside the JSON object. If a field is unknown, omit it. Prefer physical SI units.`

export interface DraftParameterResult {
  draft: {
    name: string
    description?: string
    dataType?: string
    defaultValue?: string
    unit?: string
    minValue?: string
    maxValue?: string
    formula?: string
  }
  provenance: {
    model: string
    modelVersion: string
    promptId: string
    contextHash: string
    tokensIn: number
    tokensOut: number
  }
  invocationId: string
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function parseJson<T>(s: string): T | null {
  // Tolerate model responses that wrap JSON in a code fence.
  const trimmed = s.trim()
  const candidate = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    : trimmed
  try {
    return JSON.parse(candidate) as T
  } catch {
    return null
  }
}

/**
 * Draft a parameter definition from a natural-language description.
 * Writes an AiInvocation audit row + returns the draft fields the
 * caller can turn into a real Parameter row (or present for human
 * review as authorType='ai_suggestion').
 */
export async function draftParameter(args: {
  projectId: string
  userId: string | null
  description: string
  contextText?: string
}): Promise<DraftParameterResult> {
  const user = args.description + (args.contextText ? `\n\nContext:\n${args.contextText}` : '')
  const contextHash = sha256(user)
  const inputHash = sha256(JSON.stringify({ prompt: DRAFT_PROMPT_ID, user }))
  const started = Date.now()
  const adapter = resolveProvider({})
  let success = true
  let errorMessage: string | null = null
  let text = ''
  let tokensIn = 0
  let tokensOut = 0
  let model = 'unknown'
  let modelVersion = 'unknown'

  try {
    const res = await adapter.chat({ system: DRAFT_SYSTEM, user, maxTokens: 1024 })
    text = res.text
    tokensIn = res.tokensIn
    tokensOut = res.tokensOut
    model = res.model
    modelVersion = res.modelVersion
  } catch (e) {
    success = false
    errorMessage = (e as Error).message
  }

  const outputHash = success ? sha256(text) : null
  const inv = await prisma.aiInvocation.create({
    data: {
      projectId: args.projectId,
      userId: args.userId,
      toolName: 'rest.ai.draft',
      tier: 'T1',
      model,
      modelVersion,
      promptId: DRAFT_PROMPT_ID,
      contextHash,
      inputHash,
      outputHash,
      contextTokens: tokensIn,
      outputTokens: tokensOut,
      success,
      errorMessage,
      durationMs: Date.now() - started,
    },
  })

  if (!success) {
    throw new Error(errorMessage ?? 'AI draft failed')
  }

  const draft = parseJson<DraftParameterResult['draft']>(text) ?? {
    name: 'ai_draft_failed',
    description: `Model returned non-JSON: ${text.slice(0, 200)}`,
  }

  return {
    draft,
    provenance: {
      model,
      modelVersion,
      promptId: DRAFT_PROMPT_ID,
      contextHash,
      tokensIn,
      tokensOut,
    },
    invocationId: inv.id,
  }
}
