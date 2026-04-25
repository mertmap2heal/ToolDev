import type { AiProviderAdapter } from './index'

/**
 * OpenAI-compatible self-hosted endpoint adapter.
 *
 * Most on-prem inference runtimes (vLLM, llama.cpp's server, LM Studio,
 * Azure OpenAI in-tenant, Ollama with the openai-compat shim) expose
 * `POST <baseUrl>/chat/completions` with the request shape:
 *   { model, messages: [{role, content}, ...], max_tokens }
 * and a response of:
 *   { choices: [{ message: { content } }], usage: { prompt_tokens, completion_tokens } }
 *
 * `apiKey` is optional — local llama.cpp does not require auth, while
 * Azure does. When set we forward it as a Bearer header.
 */
export function selfHostedAdapter(baseUrl: string, apiKey?: string): AiProviderAdapter {
  const stripped = baseUrl.replace(/\/+$/, '')
  return {
    async chat({ system, user, maxTokens = 1024, model = 'gpt-4o-mini' }) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
      const res = await fetch(`${stripped}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: maxTokens,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Self-hosted endpoint ${res.status}: ${body.slice(0, 500)}`)
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
        model?: string
      }
      const text = json.choices?.[0]?.message?.content ?? ''
      return {
        text,
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        model: json.model ?? model,
        modelVersion: json.model ?? model,
      }
    },
  }
}
