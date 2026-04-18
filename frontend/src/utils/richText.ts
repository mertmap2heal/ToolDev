import DOMPurify from 'dompurify'

export function decodeHtmlEntities(input: string): string {
  const withNamed = input
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return withNamed.replace(/&#(\d+);/g, (m, code) => {
    const n = Number(code)
    return Number.isFinite(n) ? String.fromCharCode(n) : m
  })
}

export function plainTextFromRichText(input: string): string {
  const decoded = decodeHtmlEntities(input ?? '')
  return decoded.replace(/<[^>]*>/g, '').trim()
}

/**
 * Attributes used by glossary term highlighting (injectGlossaryTerms)
 * and inline parameter references (ParameterRefNode). Must be allowed
 * through DOMPurify so the highlight and tooltip still work.
 */
const ALLOWED_DATA_ATTRS = ['data-definition-id', 'data-param-id', 'data-param-name']

/**
 * Sanitize HTML produced by the TipTap rich text editor (or any stored
 * HTML from the database) before rendering via dangerouslySetInnerHTML.
 *
 * Strips <script>, <iframe>, event handlers (onclick=, onerror=, ...),
 * javascript: URLs, and any other known XSS vectors. Preserves the tags
 * and attributes that TipTap actually emits plus the glossary/parameter
 * span attributes used by this codebase.
 */
export function sanitizeHtml(raw: string | null | undefined): string {
  if (!raw) return ''
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ALLOWED_DATA_ATTRS,
    // Disallow form controls - not used by TipTap output and pure XSS vectors
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
    FORBID_ATTR: ['style'],
  })
}

/**
 * Sanitize an SVG document loaded from a user-uploaded file.
 * More permissive than sanitizeHtml - allows SVG-specific elements and
 * attributes such as viewBox, stroke, fill, d, transform, etc., but still
 * blocks <script>, foreignObject, and event handlers that can execute JS.
 */
export function sanitizeSvg(raw: string | null | undefined): string {
  if (!raw) return ''
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
  })
}

