// T1 criterion suggestion (per ai-ready-vision.md §5 — draft generation).
//
// Deterministic rule-engine seed extraction from a requirement's title +
// description. Returns candidate criterion strings the human reviews before
// any save. Per the AI-readiness contract every seed is a *proposal* — the
// caller does NOT auto-apply them.
//
// AI tier mapping:
//   tier:           T1 (Draft generation)
//   level:          EASA Level 1 (advisory) / Level 2A (review-pending)
//   provenance:
//     model:         rule-engine
//     model_version: 1
//     prompt_id:     criterion-seed-v1
//     deterministic: true

import { checkAmbiguity } from './ambiguityCheck'

export interface CriterionSuggestion {
  /** The proposed criterion text. */
  text: string
  /** Short reason — surfaced in UI to explain why the seed was generated. */
  reason: string
}

const NORMATIVE_VERBS = ['shall', 'must', 'will']
// Units / measurable tokens commonly appearing in verifiable requirement text.
const MEASURE_TOKENS = [
  '\\b\\d+\\s*(?:ms|s|sec|min|hr|hour|h|day|days|wk|week|month|year)\\b',
  '\\b\\d+\\s*(?:Hz|kHz|MHz|GHz)\\b',
  '\\b\\d+\\s*(?:V|mV|A|mA|W|kW)\\b',
  '\\b\\d+\\s*(?:bit|byte|kb|mb|gb|tb|kB|MB|GB|TB)\\b',
  '\\b\\d+\\s*(?:%|percent)\\b',
  '\\b\\d+\\s*(?:kg|g|mg|t|N|kN|Nm)\\b',
  '\\b\\d+\\s*(?:m|cm|mm|km|in|ft|mi)\\b',
  '\\b\\d+\\s*(?:°C|°F|K)\\b',
  '\\b(?:less than|more than|at least|at most|no more than|within|under|over)\\s+\\d+\\b',
]
const MEASURE_RE = new RegExp(MEASURE_TOKENS.join('|'), 'i')
const NORMATIVE_RE = new RegExp(`\\b(?:${NORMATIVE_VERBS.join('|')})\\b`, 'i')

function splitSentences(text: string): string[] {
  if (!text) return []
  // Split on bullets, newlines, periods/semicolons. Keep stop-words intact.
  return text
    .replace(/\r\n/g, '\n')
    .split(/(?<=[.;])\s+|[\n•\-]\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export function suggestCriteriaFromRequirement(input: {
  title?: string | null
  description?: string | null
}): CriterionSuggestion[] {
  const text = `${input.title ?? ''}\n${input.description ?? ''}`
  const sentences = splitSentences(text)
  const seen = new Set<string>()
  const out: CriterionSuggestion[] = []

  for (const sRaw of sentences) {
    const s = normalise(sRaw)
    if (s.length < 8 || s.length > 300) continue
    // Skip seeds that themselves carry a high-severity hedge — T1 + T2 are
    // complementary; we do not draft something the ambiguity check would
    // immediately flag.
    const hedge = checkAmbiguity(s)
    if (hedge.some((h) => h.severity === 'high')) continue

    const hasMeasure = MEASURE_RE.test(s)
    const hasNormative = NORMATIVE_RE.test(s)
    if (!hasMeasure && !hasNormative) continue

    // Turn normative requirement language into criterion language: "the X
    // shall do Y" -> "The system does Y". Trim leading articles / subjects
    // very conservatively so engineers can tweak. We do not attempt deep
    // grammar — that is a model job, not a rule job.
    const text = s.replace(/^\s*(?:the\s+)?system\s+(?:shall|must|will)\s+/i, 'The system ')
    const dedupeKey = text.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const reason = hasMeasure && hasNormative
      ? 'normative + measurable'
      : hasMeasure
      ? 'contains measurable threshold'
      : 'normative verb (shall/must/will)'

    out.push({ text, reason })
    if (out.length >= 8) break
  }
  return out
}

export const CRITERION_SEED_PROVENANCE = {
  author_type: 'ai_suggestion' as const,
  author_ai_model: 'rule-engine',
  author_ai_version: '1',
  author_ai_prompt_id: 'criterion-seed-v1',
  deterministic: true,
}
