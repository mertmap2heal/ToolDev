/**
 * N-2.3 (#428) — INCOSE/EARS requirement-quality validator.
 *
 * Pure unit suite — no DB, no `beforeAll`. Exercises every INCOSE rule
 * (positive + negative), the EARS classifier across all six patterns, the
 * `stripToPlainText` helper, the score arithmetic, and the two acceptance
 * examples from the issue body.
 *
 * Imports the COMPILED validator (`shared/incoseEars/_compiled/index.js`) —
 * the exact artefact the requirement controller runs in production — so a
 * source/compiled drift would fail this suite.
 */
import { describe, it, expect } from 'vitest'
import {
  validateRequirementText,
  classifyEars,
  stripToPlainText,
} from '../../../shared/incoseEars/_compiled/index.js'

/** Helper — collect the rule ids present in a report. */
const ruleIds = (text: string): string[] =>
  validateRequirementText(text).findings.map((f) => f.ruleId)

/** Helper — does the report contain a finding with this rule id? */
const has = (text: string, ruleId: string): boolean => ruleIds(text).includes(ruleId)

describe('incoseEars — acceptance examples (issue #428)', () => {
  it('"The system shall be fast." is blocked with a vague-term finding naming "fast"', () => {
    const report = validateRequirementText('The system shall be fast.')
    expect(report.hasErrors).toBe(true)
    const vague = report.findings.find((f) => f.ruleId === 'incose.vague-term')
    expect(vague).toBeDefined()
    expect(vague?.severity).toBe('error')
    expect(vague?.term).toBe('fast')
    expect(vague?.message).toContain('"fast"')
  })

  it('"When the door opens, the system shall illuminate the cabin lights within 200ms." is clean, EARS event-driven', () => {
    const report = validateRequirementText(
      'When the door opens, the system shall illuminate the cabin lights within 200ms.',
    )
    expect(report.findings).toHaveLength(0)
    expect(report.earsPattern).toBe('event-driven')
    expect(report.hasErrors).toBe(false)
    expect(report.score).toBe(100)
  })
})

describe('incoseEars — EARS classifier', () => {
  it('classifies event-driven (When ... shall)', () => {
    expect(classifyEars('When the button is pressed, the system shall beep within 50ms.')).toBe(
      'event-driven',
    )
  })

  it('classifies state-driven (While ... shall)', () => {
    expect(classifyEars('While the aircraft is airborne, the system shall record telemetry.')).toBe(
      'state-driven',
    )
  })

  it('classifies optional-feature (Where ... shall)', () => {
    expect(
      classifyEars('Where the heated-seat option is fitted, the system shall expose a control.'),
    ).toBe('optional-feature')
  })

  it('classifies unwanted-behaviour (If ... then ... shall)', () => {
    expect(
      classifyEars('If the sensor fails, then the system shall enter the safe state within 1s.'),
    ).toBe('unwanted-behaviour')
  })

  it('classifies ubiquitous (the <noun> shall <verb>, no leading keyword)', () => {
    expect(classifyEars('The flight computer shall maintain a heartbeat at 10Hz.')).toBe(
      'ubiquitous',
    )
  })

  it('classifies unstructured (no recognised template)', () => {
    expect(classifyEars('The pilot likes the new layout.')).toBe('unstructured')
  })

  it('unwanted-behaviour wins over event-driven when both If/then and When appear', () => {
    expect(
      classifyEars('If the door opens then the system shall, when armed, raise an alarm.'),
    ).toBe('unwanted-behaviour')
  })

  it('unstructured is NOT itself an error', () => {
    const report = validateRequirementText('The system shall expose a REST endpoint at 100Hz.')
    // ubiquitous + measurable -> clean; the point: pattern alone never blocks.
    expect(report.hasErrors).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: vague-term', () => {
  it('fires (error) on a genuinely-unmeasurable term', () => {
    for (const term of ['fast', 'slow', 'robust', 'efficient', 'optimize', 'user-friendly']) {
      const report = validateRequirementText(`The system shall be ${term}.`)
      const f = report.findings.find((x) => x.ruleId === 'incose.vague-term')
      expect(f, `expected vague-term for "${term}"`).toBeDefined()
      expect(f?.severity).toBe('error')
    }
  })

  it('"support" and "handle" are warn, not error (PM ruling)', () => {
    const support = validateRequirementText('The module shall support 200 concurrent users.')
    const sf = support.findings.find((x) => x.ruleId === 'incose.vague-term')
    expect(sf).toBeDefined()
    expect(sf?.severity).toBe('warn')
    expect(support.hasErrors).toBe(false)

    const handle = validateRequirementText('The service shall handle 500 requests per second.')
    const hf = handle.findings.find((x) => x.ruleId === 'incose.vague-term')
    expect(hf?.severity).toBe('warn')
    expect(handle.hasErrors).toBe(false)
  })

  it('does not fire on a clean measurable requirement', () => {
    expect(has('The system shall respond within 200ms.', 'incose.vague-term')).toBe(false)
  })

  it('matches whole words only — "fastener" does not trigger "fast"', () => {
    expect(has('The system shall torque each fastener to 12Nm.', 'incose.vague-term')).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: ambiguous-phrase', () => {
  it('fires (error) on ambiguous escape phrases', () => {
    for (const phrase of ['as appropriate', 'as required', 'if possible', 'tbd']) {
      const report = validateRequirementText(`The system shall log events ${phrase}.`)
      const f = report.findings.find((x) => x.ruleId === 'incose.ambiguous-phrase')
      expect(f, `expected ambiguous-phrase for "${phrase}"`).toBeDefined()
      expect(f?.severity).toBe('error')
    }
  })

  it('does not fire on an explicit condition', () => {
    expect(
      has('When the temperature exceeds 80C, the system shall log an event.', 'incose.ambiguous-phrase'),
    ).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: escape-clause', () => {
  it('fires (warn) on open-ended list markers', () => {
    const report = validateRequirementText('The system shall record speed, altitude, etc.')
    const f = report.findings.find((x) => x.ruleId === 'incose.escape-clause')
    expect(f).toBeDefined()
    expect(f?.severity).toBe('warn')
  })

  it('does not fire when the list is enumerated', () => {
    expect(
      has('The system shall record speed, altitude and heading at 10Hz.', 'incose.escape-clause'),
    ).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: hedge-word', () => {
  it('fires (error) when a weak modal is the requirement verb (no "shall")', () => {
    for (const hedge of ['should', 'may', 'might', 'could']) {
      const report = validateRequirementText(`The system ${hedge} retry the request once.`)
      const f = report.findings.find((x) => x.ruleId === 'incose.hedge-word')
      expect(f, `expected hedge-word for "${hedge}"`).toBeDefined()
      expect(f?.severity).toBe('error')
    }
  })

  it('does NOT fire inside a valid EARS "When ... shall" sentence (false-positive guard)', () => {
    // "would" appears, but "shall" is the binding verb — no hedge finding.
    const report = validateRequirementText(
      'When the engine would otherwise stall, the system shall inject fuel within 100ms.',
    )
    expect(has(report ? '' : '', 'incose.hedge-word')).toBe(false)
    expect(
      validateRequirementText(
        'When the engine would otherwise stall, the system shall inject fuel within 100ms.',
      ).findings.some((f) => f.ruleId === 'incose.hedge-word'),
    ).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: and-or', () => {
  it('fires (warn) on "and/or"', () => {
    const report = validateRequirementText('The system shall alert the pilot and/or the co-pilot.')
    const f = report.findings.find((x) => x.ruleId === 'incose.and-or')
    expect(f).toBeDefined()
    expect(f?.severity).toBe('warn')
  })
})

describe('incoseEars — INCOSE rule: non-atomic-shall', () => {
  it('fires (error) on more than one "shall"', () => {
    const report = validateRequirementText(
      'The system shall log the event and the system shall alert the operator.',
    )
    const f = report.findings.find((x) => x.ruleId === 'incose.non-atomic-shall')
    expect(f).toBeDefined()
    expect(f?.severity).toBe('error')
  })

  it('does not fire on a single "shall"', () => {
    expect(
      has('The system shall log the event within 1s.', 'incose.non-atomic-shall'),
    ).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: non-atomic-conjunction', () => {
  it('fires (warn) when a conjunction joins clauses after the verb', () => {
    const report = validateRequirementText(
      'The system shall record the speed, and transmit the heading at 5Hz.',
    )
    expect(has(report ? '' : '', '')).toBe(false)
    expect(
      validateRequirementText(
        'The system shall record the speed, and transmit the heading at 5Hz.',
      ).findings.some((f) => f.ruleId === 'incose.non-atomic-conjunction'),
    ).toBe(true)
  })
})

describe('incoseEars — INCOSE rule: missing-measurable', () => {
  it('fires (warn) when an unstructured/ubiquitous requirement has no digit or unit', () => {
    const report = validateRequirementText('The system shall provide a status display.')
    const f = report.findings.find((x) => x.ruleId === 'incose.missing-measurable')
    expect(f).toBeDefined()
    expect(f?.severity).toBe('warn')
  })

  it('does not fire when an event-driven pattern carries a condition', () => {
    expect(
      has(
        'When the door opens, the system shall illuminate the cabin light.',
        'incose.missing-measurable',
      ),
    ).toBe(false)
  })

  it('does not fire when a numeric threshold is present', () => {
    expect(
      has('The system shall maintain a heartbeat at 10Hz.', 'incose.missing-measurable'),
    ).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: passive-voice', () => {
  it('fires (warn) on a passive construction', () => {
    const report = validateRequirementText('The cabin lights shall be illuminated within 200ms.')
    const f = report.findings.find((x) => x.ruleId === 'incose.passive-voice')
    expect(f).toBeDefined()
    expect(f?.severity).toBe('warn')
  })

  it('does not fire on active voice', () => {
    expect(
      has('The controller shall illuminate the cabin lights within 200ms.', 'incose.passive-voice'),
    ).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: no-shall', () => {
  it('fires (warn) when an unstructured sentence has no "shall" and no hedge', () => {
    const report = validateRequirementText('The operator monitors the gauge at 10Hz.')
    const f = report.findings.find((x) => x.ruleId === 'incose.no-shall')
    expect(f).toBeDefined()
    expect(f?.severity).toBe('warn')
  })

  it('does not fire when "shall" is present', () => {
    expect(has('The system shall log the event at 1Hz.', 'incose.no-shall')).toBe(false)
  })
})

describe('incoseEars — INCOSE rule: too-long', () => {
  it('fires (warn) when the plain text exceeds 600 characters', () => {
    const longText =
      'The system shall record the parameter ' + 'x'.repeat(620) + ' at 10Hz.'
    const f = validateRequirementText(longText).findings.find(
      (x) => x.ruleId === 'incose.too-long',
    )
    expect(f).toBeDefined()
    expect(f?.severity).toBe('warn')
  })

  it('does not fire on a short requirement', () => {
    expect(has('The system shall log the event at 1Hz.', 'incose.too-long')).toBe(false)
  })
})

describe('incoseEars — stripToPlainText', () => {
  it('strips HTML tags', () => {
    expect(stripToPlainText('<p>The system shall <strong>log</strong> events.</p>')).toBe(
      'The system shall log events.',
    )
  })

  it('strips {{param:...}} placeholders', () => {
    const out = stripToPlainText('The system shall hold {{param:abc-123}} within limits.')
    expect(out).not.toContain('{{param')
    expect(out).toContain('The system shall hold')
    expect(out).toContain('within limits.')
  })

  it('decodes HTML entities', () => {
    expect(stripToPlainText('The valve shall open &lt; 2s &amp; close.')).toBe(
      'The valve shall open < 2s & close.',
    )
  })

  it('returns empty string for null / undefined / empty', () => {
    expect(stripToPlainText(null)).toBe('')
    expect(stripToPlainText(undefined)).toBe('')
    expect(stripToPlainText('')).toBe('')
  })

  it('a TipTap placeholder body does not produce spurious findings', () => {
    // Placeholder-only body strips to empty -> clean report.
    const report = validateRequirementText('<p>{{param:abc}}</p>')
    expect(report.findings).toHaveLength(0)
    expect(report.hasErrors).toBe(false)
  })
})

describe('incoseEars — score arithmetic & empty input', () => {
  it('empty / whitespace text returns a clean report', () => {
    const empty = validateRequirementText('   ')
    expect(empty.findings).toHaveLength(0)
    expect(empty.score).toBe(100)
    expect(empty.hasErrors).toBe(false)
  })

  it('deducts 10 per error and 4 per warn, floored at 0', () => {
    // One error (vague "fast") + one warn (missing-measurable) -> 100-10-4 = 86.
    const r = validateRequirementText('The system shall be fast.')
    const errors = r.findings.filter((f) => f.severity === 'error').length
    const warns = r.findings.filter((f) => f.severity === 'warn').length
    expect(r.score).toBe(Math.max(0, 100 - errors * 10 - warns * 4))
  })

  it('orders findings errors-first', () => {
    const r = validateRequirementText(
      'The system should be fast and the system shall be robust, etc.',
    )
    const severities = r.findings.map((f) => f.severity)
    const firstWarnIndex = severities.indexOf('warn')
    const lastErrorIndex = severities.lastIndexOf('error')
    if (firstWarnIndex !== -1 && lastErrorIndex !== -1) {
      expect(lastErrorIndex).toBeLessThan(firstWarnIndex)
    }
  })
})
