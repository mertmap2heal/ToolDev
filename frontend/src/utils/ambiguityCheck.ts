// Ambiguity check (T2 advisory per ai-ready-vision.md §5).
//
// Pure, frontend-only static rule engine. Returns findings for hedge / vague
// terms commonly seen in unverifiable requirements and acceptance criteria.
// The intent is to surface a warning the engineer can choose to accept or
// dismiss — NOT to block save. AI tier mapping:
//
//   tier:      T2 (Review / critique)
//   level:     EASA Level 1 (human assistance) — advisory only, no auto-fix
//   provenance:
//     model:        rule-engine
//     model_version: 1
//     prompt_id:     hedge-v1
//     deterministic: true
//
// The provenance shape mirrors the field-level provenance schema from
// ai-ready-vision.md §6.1 so a future migration to a real model keeps the
// audit chain coherent.

export interface AmbiguityFinding {
  term: string
  /** Character offset into the source text where the term starts. */
  index: number
  /** One-sentence engineer-facing advice. */
  advice: string
  /** Severity hint for UI emphasis. */
  severity: 'low' | 'medium' | 'high'
}

interface HedgeRule {
  /** Word boundary regex source (case-insensitive). */
  pattern: string
  advice: string
  severity: 'low' | 'medium' | 'high'
}

// Curated hedge list. Multi-word patterns include the space; single-word
// patterns are matched on word boundaries so e.g. "shouldn't" does not
// trigger on "should".
const HEDGE_RULES: HedgeRule[] = [
  {
    pattern: 'should',
    advice: 'Use "shall" for normative requirements; "should" reads as optional.',
    severity: 'high',
  },
  {
    pattern: 'may',
    advice: '"May" is permissive. Confirm this is genuinely optional, otherwise use "shall".',
    severity: 'medium',
  },
  {
    pattern: 'might',
    advice: '"Might" is unverifiable. Replace with a concrete behaviour the system "shall" perform.',
    severity: 'medium',
  },
  {
    pattern: 'as appropriate',
    advice: '"As appropriate" leaves the criterion to the reader. Name the condition.',
    severity: 'high',
  },
  {
    pattern: 'as required',
    advice: '"As required" is a circular reference. Name what triggers the requirement.',
    severity: 'high',
  },
  {
    pattern: 'where applicable',
    advice: '"Where applicable" leaves applicability undefined. Name the scope.',
    severity: 'high',
  },
  {
    pattern: 'if possible',
    advice: '"If possible" makes the requirement unverifiable.',
    severity: 'high',
  },
  {
    pattern: 'when possible',
    advice: '"When possible" makes the requirement unverifiable.',
    severity: 'high',
  },
  {
    pattern: 'etc\\.?',
    advice: '"Etc." hides scope. List the cases explicitly.',
    severity: 'medium',
  },
  {
    pattern: 'tbd',
    advice: '"TBD" means this is not yet a requirement. Finalise or mark Draft.',
    severity: 'medium',
  },
  {
    pattern: 'tbc',
    advice: '"TBC" means this is not yet a requirement. Finalise or mark Draft.',
    severity: 'medium',
  },
  {
    pattern: 'robust',
    advice: '"Robust" is subjective. Replace with a measurable threshold.',
    severity: 'medium',
  },
  {
    pattern: 'user-friendly',
    advice: '"User-friendly" is subjective. Replace with a usability metric or task-completion target.',
    severity: 'medium',
  },
  {
    pattern: 'efficient',
    advice: '"Efficient" is subjective. State the throughput, latency, or resource bound.',
    severity: 'medium',
  },
  {
    pattern: 'quickly',
    advice: '"Quickly" is unverifiable. State a time bound (ms, s).',
    severity: 'high',
  },
  {
    pattern: 'slow',
    advice: '"Slow" is unverifiable. State a measurable threshold.',
    severity: 'medium',
  },
  {
    pattern: 'usually',
    advice: '"Usually" cannot be tested. Use a probabilistic threshold or specify always/conditional.',
    severity: 'high',
  },
  {
    pattern: 'sometimes',
    advice: '"Sometimes" cannot be tested. Name the condition.',
    severity: 'high',
  },
  {
    pattern: 'minimize',
    advice: '"Minimize" is open-ended. Set the target value.',
    severity: 'low',
  },
  {
    pattern: 'maximize',
    advice: '"Maximize" is open-ended. Set the target value.',
    severity: 'low',
  },
  {
    pattern: 'minimise',
    advice: '"Minimise" is open-ended. Set the target value.',
    severity: 'low',
  },
  {
    pattern: 'maximise',
    advice: '"Maximise" is open-ended. Set the target value.',
    severity: 'low',
  },
]

// Build a single combined regex for one-pass scanning. Each rule's pattern is
// wrapped in word-boundary anchors. The alternation preserves the order so
// the engine reports the longest match by ordering multi-word entries first.
const SORTED_RULES = [...HEDGE_RULES].sort((a, b) => b.pattern.length - a.pattern.length)
const COMBINED = new RegExp(
  '\\b(?:' + SORTED_RULES.map((r) => `(?:${r.pattern})`).join('|') + ')\\b',
  'gi',
)

export function checkAmbiguity(text: string): AmbiguityFinding[] {
  if (!text) return []
  const findings: AmbiguityFinding[] = []
  COMBINED.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = COMBINED.exec(text)) !== null) {
    const matched = m[0]
    const lower = matched.toLowerCase().replace(/\.$/, '')
    const rule =
      SORTED_RULES.find((r) => {
        const re = new RegExp('^' + r.pattern + '$', 'i')
        return re.test(matched)
      }) ?? null
    if (!rule) continue
    findings.push({
      term: matched,
      index: m.index,
      advice: rule.advice,
      severity: rule.severity,
    })
    // Avoid infinite loop on zero-width matches (none expected, but defensive).
    if (m.index === COMBINED.lastIndex) COMBINED.lastIndex++
    // ESLint: lower is intentionally unused but retained for future grouping
    void lower
  }
  return findings
}

// Provenance fingerprint for any field whose ambiguity check was acknowledged
// — useful when the value flows into an audit export later. Mirrors §6.1.
export const AMBIGUITY_PROVENANCE = {
  author_type: 'ai_suggestion' as const,
  author_ai_model: 'rule-engine',
  author_ai_version: '1',
  author_ai_prompt_id: 'hedge-v1',
  deterministic: true,
}
