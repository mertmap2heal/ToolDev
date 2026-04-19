import Anthropic from '@anthropic-ai/sdk'
import type { AiProviderAdapter } from './index'

// Default model the product ships with. Overridable per-request via
// `model`. Keep to the latest Claude Opus 4.x family for aerospace
// reasoning quality; Sonnet 4.x is acceptable for bulk review tasks.
const DEFAULT_MODEL = 'claude-opus-4-7'
const DEFAULT_MAX_TOKENS = 2048

export function anthropicAdapter(apiKey: string): AiProviderAdapter {
  if (!apiKey) {
    throw new Error('Anthropic API key missing: set ANTHROPIC_API_KEY or provide via BYOK')
  }
  const client = new Anthropic({ apiKey })
  return {
    async chat(req) {
      const model = req.model ?? DEFAULT_MODEL
      const res = await client.messages.create({
        model,
        max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      })
      // Flatten text blocks into a single string. Most AI draft calls
      // return one text block; tool-use blocks are not used here.
      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => ('text' in b ? b.text : ''))
        .join('')
      return {
        text,
        tokensIn: res.usage.input_tokens,
        tokensOut: res.usage.output_tokens,
        model,
        modelVersion: res.model,
      }
    },
  }
}
