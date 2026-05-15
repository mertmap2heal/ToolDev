/**
 * SEC-3 (#376) round-2 polish - HTML-escape regression for reviewer-invite
 * email body. Three user-supplied fields (`reviewerName`, `requirementKey`,
 * `requirementTitle`) interpolate into the HTML twin of the invite email
 * and must be HTML-entity-escaped before send to prevent stored-XSS-style
 * injection in mail clients that render HTML.
 *
 * The plain-text twin needs no escape (no HTML to break out of).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { escapeHtml } from '../lib/htmlEscape'

// Capture sendMail invocations across the test suite. `vi.mock` is hoisted
// by Vitest so the factory runs before the static `import` below picks up
// the email service. The factory closes over `captures` via
// `vi.hoisted(...)` so the mock body can mutate the same array the tests
// inspect.
const { captures } = vi.hoisted(() => ({
  captures: [] as { html: string; text: string; subject: string; to: string }[],
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (opts: {
        html: string
        text: string
        subject: string
        to: string
      }) => {
        captures.push({
          html: opts.html,
          text: opts.text,
          subject: opts.subject,
          to: opts.to,
        })
      },
    }),
  },
}))

import { sendReviewInviteEmail } from '../services/email.service'

describe('SEC-3 (#376) round-2 - escapeHtml helper unit tests', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('encodes ampersand first to avoid double-encoding', () => {
    // If `&` were escaped after `<`, `<` would already have become `&lt;`
    // and the ampersand-in-`&lt;` would get re-escaped to `&amp;lt;`.
    expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;')
  })

  it('returns identical output for a string with no special chars', () => {
    expect(escapeHtml('REQ-0042')).toBe('REQ-0042')
    expect(escapeHtml('Plain Reviewer Name')).toBe('Plain Reviewer Name')
  })
})

describe('SEC-3 (#376) round-2 - sendReviewInviteEmail HTML escape', () => {
  beforeEach(() => {
    captures.length = 0
  })

  afterEach(() => {
    captures.length = 0
  })

  it('escapes a `<` in reviewerName so it does not break out of the HTML body', async () => {
    await sendReviewInviteEmail({
      to: 'external@example.test',
      reviewerName: 'Mallory <script>alert(1)</script>',
      requirementKey: 'REQ-0001',
      requirementTitle: 'Brake actuator power-on test',
      approvalUrl: 'https://example.test/approve?token=abc',
    })
    expect(captures).toHaveLength(1)
    const html = captures[0].html
    // The HTML twin must contain the entity-encoded form...
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    // ...and must NOT contain the raw tag.
    expect(html).not.toMatch(/<script>alert\(1\)<\/script>/)
  })

  it('escapes `&` and `<` in requirementKey and requirementTitle', async () => {
    await sendReviewInviteEmail({
      to: 'external@example.test',
      reviewerName: 'A',
      requirementKey: 'REQ-<bad>',
      requirementTitle: 'Cabin lighting & door interlock',
      approvalUrl: 'https://example.test/approve?token=abc',
    })
    expect(captures).toHaveLength(1)
    const html = captures[0].html
    expect(html).toContain('REQ-&lt;bad&gt;')
    expect(html).toContain('Cabin lighting &amp; door interlock')
    expect(html).not.toMatch(/REQ-<bad>/)
  })

  it('leaves the plain-text twin untouched (no HTML escape applied to text body)', async () => {
    await sendReviewInviteEmail({
      to: 'external@example.test',
      reviewerName: 'A & B',
      requirementKey: 'REQ-<x>',
      requirementTitle: 'T & T',
      approvalUrl: 'https://example.test/approve?token=abc',
    })
    expect(captures).toHaveLength(1)
    const text = captures[0].text
    // Plain text body shows the raw input - no entity encoding required.
    expect(text).toContain('A & B')
    expect(text).toContain('REQ-<x>')
    expect(text).toContain('T & T')
  })
})
