/**
 * INCOSE / EARS requirement-quality validator.
 *
 * Pure, deterministic, dependency-free. No DB, no I/O, no React, no async.
 * The frontend editor pre-check and the backend write-time gate import the
 * SAME code so the two can never drift.
 *
 * - The frontend imports the source directly via the Vite `shared` alias
 *   (`import { validateRequirementText } from 'shared/incoseEars'`).
 * - The backend imports the committed compiled output
 *   (`import { validateRequirementText } from '../../../shared/incoseEars/_compiled/index.js'`).
 *   The backend `tsconfig.json` has `rootDir: ./src`, so it cannot compile a
 *   `.ts` outside `src/`; and Node ESM cannot do a relative directory import.
 *   `_compiled/` is this file's build output, regenerated with `tsc` and
 *   committed (the same pattern as `shared/types/*.js`).
 *
 * Ruling applied (issue #428, Architecture PM gate): `support` and `handle`
 * are `warn` severity, not `error`. The `error` block-list is reserved for
 * genuinely-unmeasurable terms so a block stays credible.
 */

export type FindingSeverity = 'error' | 'warn'

export type EarsPattern =
  | 'ubiquitous'
  | 'event-driven'
  | 'state-driven'
  | 'optional-feature'
  | 'unwanted-behaviour'
  | 'unstructured'

export interface QualityFinding {
  /** Stable rule identifier, e.g. `incose.vague-term`. */
  ruleId: string
  /** `error` blocks the save; `warn` advises only. */
  severity: FindingSeverity
  /** Engineer-voice message: the offending token in quotes + one concrete fix. */
  message: string
  /** The offending substring, when the finding is term-scoped. */
  term?: string
  /** Char offsets [start, end) into the validated plain text, when term-scoped. */
  span?: [number, number]
}

export interface RequirementQualityReport {
  findings: QualityFinding[]
  /** 0-100, advisory only. The block is driven by `hasErrors`, never the score. */
  score: number
  earsPattern: EarsPattern
  /** True when any finding is `error` severity. Drives the write-time block. */
  hasErrors: boolean
}

// ---------------------------------------------------------------------------
// Plain-text extraction
// ---------------------------------------------------------------------------

/**
 * Strip TipTap rich-text HTML and `{{param:...}}` placeholders to plain text.
 * Validation runs on the plain text so markup tokens never cause spurious
 * findings. Mirrors `backend/src/utils/htmlToPlainText.ts`, plus the
 * parameter-placeholder strip the requirements editor needs.
 */
export function stripToPlainText(html: string | null | undefined): string {
  if (html == null || typeof html !== 'string') return ''
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, ' ')
  s = s.replace(/<\/p>/gi, ' ')
  s = s.replace(/<\/div>/gi, ' ')
  s = s.replace(/<\/li>/gi, ' ')
  s = s.replace(/<[^>]+>/g, '')
  // Inline parameter references — `{{param:<id>}}` placeholder form, and the
  // editor span form `<span data-param-id="...">name</span>` (the tags are
  // already gone above, leaving the visible name, which is intended text).
  s = s.replace(/\{\{param:[^}]*\}\}/gi, ' ')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

// ---------------------------------------------------------------------------
// EARS classifier
// ---------------------------------------------------------------------------

/**
 * Classify a requirement against the EARS templates. First match wins.
 * `unstructured` is NOT itself a fault (gap-summary #3 — some requirements
 * legitimately do not fit EARS); it only downgrades the measurable / no-shall
 * heuristics. The block always comes from `error`-severity findings.
 */
export function classifyEars(text: string): EarsPattern {
  const t = text.trim()
  if (!t) return 'unstructured'

  // Unwanted behaviour: `If <condition>, then <system> shall <action>`.
  // Checked before event-driven so an `If ... then ... shall` is not
  // mis-bucketed.
  if (/^\s*if\b[\s\S]*?\bthen\b[\s\S]*?\bshall\b/i.test(t)) {
    return 'unwanted-behaviour'
  }
  // Event-driven: `When <trigger>, the <system> shall <action>`.
  if (/^\s*when\b[\s\S]*?\bshall\b/i.test(t)) {
    return 'event-driven'
  }
  // State-driven: `While <state>, the <system> shall <action>`.
  if (/^\s*while\b[\s\S]*?\bshall\b/i.test(t)) {
    return 'state-driven'
  }
  // Optional feature: `Where <feature>, the <system> shall <action>`.
  if (/^\s*where\b[\s\S]*?\bshall\b/i.test(t)) {
    return 'optional-feature'
  }
  // Ubiquitous: no leading keyword, `the <noun> shall <verb>`.
  if (/\bthe\b[\s\S]*?\bshall\b\s+\w+/i.test(t)) {
    return 'ubiquitous'
  }
  return 'unstructured'
}

// ---------------------------------------------------------------------------
// INCOSE rule set
// ---------------------------------------------------------------------------

interface TermRule {
  ruleId: string
  severity: FindingSeverity
  /** Whole-word terms / phrases matched case-insensitively. */
  terms: string[]
  /** Builds the engineer-voice message for a matched term. */
  message: (term: string) => string
}

/**
 * Genuinely-unmeasurable adjectives and verbs. `error` severity — these block.
 * `support` / `handle` are deliberately NOT here (PM ruling: they are `warn`).
 */
const VAGUE_ERROR_TERMS = [
  'fast',
  'slow',
  'robust',
  'user-friendly',
  'efficient',
  'flexible',
  'minimize',
  'maximize',
  'optimize',
  'optimise',
  'adequate',
  'sufficient',
  'reasonable',
  'quick',
  'easy',
  'seamless',
  'intuitive',
]

/**
 * Vague terms downgraded to `warn` per the PM ruling — common English, and
 * occasionally the correct verb in a high-level requirement. Advise, do not
 * block.
 */
const VAGUE_WARN_TERMS = ['support', 'handle']

/** Ambiguous escape phrases — no explicit condition. `error` severity. */
const AMBIGUOUS_PHRASES = [
  'as appropriate',
  'as required',
  'as needed',
  'if possible',
  'where applicable',
  'to be determined',
  'tbd',
]

/** Open-ended list markers. `warn` severity. */
const ESCAPE_CLAUSES = ['etc', 'and so on', 'including but not limited to']

/** Weak modal verbs — only flagged when used AS the requirement verb. */
const HEDGE_WORDS = ['should', 'may', 'might', 'could', 'would', 'can', 'ought to']

/** Escape a string for use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find every whole-word, case-insensitive occurrence of `term` in `text`.
 * For multi-word phrases, the `\b` boundaries sit at the ends of the phrase.
 */
function findTermSpans(text: string, term: string): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    spans.push([m.index, m.index + m[0].length])
    if (m.index === re.lastIndex) re.lastIndex++ // guard against zero-width
  }
  return spans
}

const TERM_RULES: TermRule[] = [
  {
    ruleId: 'incose.vague-term',
    severity: 'error',
    terms: VAGUE_ERROR_TERMS,
    message: (t) =>
      `"${t}" is not measurable. State a quantified threshold, e.g. a maximum response time or a numeric limit.`,
  },
  {
    ruleId: 'incose.vague-term',
    severity: 'warn',
    terms: VAGUE_WARN_TERMS,
    message: (t) =>
      `"${t}" is vague. Name the specific behaviour the requirement covers, with a measurable criterion.`,
  },
  {
    ruleId: 'incose.ambiguous-phrase',
    severity: 'error',
    terms: AMBIGUOUS_PHRASES,
    message: (t) => `"${t}" is ambiguous. State the explicit condition instead.`,
  },
  {
    ruleId: 'incose.escape-clause',
    severity: 'warn',
    terms: ESCAPE_CLAUSES,
    message: (t) => `"${t}" leaves the list open. Enumerate the items the requirement covers.`,
  },
]

/**
 * Validate a single requirement's description.
 *
 * @param text  The requirement description. May be raw TipTap HTML or plain
 *              text; HTML and `{{param:...}}` placeholders are stripped first.
 */
export function validateRequirementText(text: string): RequirementQualityReport {
  const plain = stripToPlainText(text)
  const earsPattern = classifyEars(plain)

  // Empty / whitespace-only text -> clean report. The existing
  // `description` required-400 already covers emptiness.
  if (!plain) {
    return { findings: [], score: 100, earsPattern, hasErrors: false }
  }

  const findings: QualityFinding[] = []
  const lower = plain.toLowerCase()

  // --- Term-based rules (vague, ambiguous, escape clause) ------------------
  for (const rule of TERM_RULES) {
    for (const term of rule.terms) {
      for (const span of findTermSpans(plain, term)) {
        findings.push({
          ruleId: rule.ruleId,
          severity: rule.severity,
          message: rule.message(term),
          term,
          span,
        })
      }
    }
  }

  // --- and/or --------------------------------------------------------------
  for (const span of findTermSpans(plain, 'and/or')) {
    findings.push({
      ruleId: 'incose.and-or',
      severity: 'warn',
      message: `"and/or" is ambiguous. Choose "and" or "or".`,
      term: 'and/or',
      span,
    })
  }

  // --- Non-atomic: more than one `shall` ----------------------------------
  const shallSpans = findTermSpans(plain, 'shall')
  if (shallSpans.length > 1) {
    findings.push({
      ruleId: 'incose.non-atomic-shall',
      severity: 'error',
      message: `This requirement has more than one "shall". Split it into one requirement per "shall".`,
      term: 'shall',
    })
  }

  // --- Non-atomic conjunction joining clauses after the verb --------------
  // A `, and ` / `, or ` / `; ` that appears after the requirement verb.
  const verbAnchor = lower.search(/\bshall\b/)
  if (verbAnchor !== -1) {
    const afterVerb = lower.slice(verbAnchor)
    if (/,\s+and\s+|,\s+or\s+|;\s+/.test(afterVerb)) {
      findings.push({
        ruleId: 'incose.non-atomic-conjunction',
        severity: 'warn',
        message: `A conjunction joins multiple clauses after the verb. Consider splitting into separate requirements.`,
      })
    }
  }

  // --- Hedge word used as the requirement verb ----------------------------
  // Only an error when the sentence has NO `shall` (so the hedge IS the
  // binding verb). A valid EARS `When ... shall ...` is never flagged.
  if (shallSpans.length === 0) {
    for (const hedge of HEDGE_WORDS) {
      const spans = findTermSpans(plain, hedge)
      if (spans.length > 0) {
        findings.push({
          ruleId: 'incose.hedge-word',
          severity: 'error',
          message: `"${hedge}" is a weak modal. Use "shall" for a binding requirement.`,
          term: hedge,
          span: spans[0],
        })
        break // one hedge finding is enough; do not stack
      }
    }
  }

  // --- No `shall` at all on an unstructured sentence ----------------------
  if (shallSpans.length === 0 && earsPattern === 'unstructured') {
    findings.push({
      ruleId: 'incose.no-shall',
      severity: 'warn',
      message: `No "shall" found. A binding requirement uses "the <system> shall <action>".`,
    })
  }

  // --- Missing measurable criterion ---------------------------------------
  // A quantified threshold is keyed on a digit. Single-letter unit tokens
  // (a, n, m, g, c, v, w) collide with common English words and the article
  // "a", so a bare-unit scan is unsafe — a digit is the reliable signal, and
  // `200ms` / `10 Hz` / `5kg` all contain one. The check is suppressed for
  // patterns that themselves carry a condition (event / state / unwanted).
  const hasDigit = /\d/.test(plain)
  const patternCarriesCondition =
    earsPattern === 'event-driven' ||
    earsPattern === 'state-driven' ||
    earsPattern === 'unwanted-behaviour'
  if (!hasDigit && !patternCarriesCondition) {
    findings.push({
      ruleId: 'incose.missing-measurable',
      severity: 'warn',
      message: `No measurable criterion found. Add a quantified threshold or an explicit acceptance condition.`,
    })
  }

  // --- Passive voice heuristic --------------------------------------------
  // `(is|are|be|been|being) <word>ed` — names no actor. Heuristic, hence warn.
  if (/\b(is|are|be|been|being)\s+\w+ed\b/i.test(plain)) {
    findings.push({
      ruleId: 'incose.passive-voice',
      severity: 'warn',
      message: `This requirement may be in passive voice. Name the actor that performs the action.`,
    })
  }

  // --- Over-long requirement ----------------------------------------------
  if (plain.length > 600) {
    findings.push({
      ruleId: 'incose.too-long',
      severity: 'warn',
      message: `This requirement is long (${plain.length} characters). Consider splitting it into smaller, atomic requirements.`,
    })
  }

  // --- Score (advisory only) ----------------------------------------------
  let score = 100
  for (const f of findings) {
    score -= f.severity === 'error' ? 10 : 4
  }
  if (score < 0) score = 0

  // Errors first, then warns — the blocking items always lead the list.
  findings.sort((a, b) => {
    if (a.severity === b.severity) return 0
    return a.severity === 'error' ? -1 : 1
  })

  const hasErrors = findings.some((f) => f.severity === 'error')

  return { findings, score, earsPattern, hasErrors }
}
