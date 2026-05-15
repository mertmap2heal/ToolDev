/**
 * SEC-3 (#376) round-2 polish - HTML-context escaping for outbound emails.
 *
 * Defence-in-depth helper for any user-supplied string interpolated into the
 * HTML body of an email. The plain-text twin of an email body never needs
 * escaping; only the HTML twin does, and only for fields under user control
 * (entity titles, reviewer display names, requirement keys, etc.).
 *
 * Escapes the five HTML-significant characters per OWASP "HTML entity
 * encoding" guidance. Numeric reference for the apostrophe (`&#39;`) is
 * used because `&apos;` is not defined in HTML4 contexts.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
