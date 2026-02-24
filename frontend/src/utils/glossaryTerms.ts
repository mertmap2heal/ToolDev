/**
 * Injects glossary/abbreviation term spans into HTML for underline + tooltip.
 * Only replaces in text content (between tags), not inside attribute values.
 * Matching is case-insensitive so "test" in text matches a glossary term "Test".
 */

export interface DefinitionForInject {
  id: string
  term: string
  definition: string
  notes?: string | null
  /** 'glossary' | 'abbreviation' for tooltip label */
  type?: 'glossary' | 'abbreviation'
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Strip HTML for plain-text tooltip. */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

/**
 * Build tooltip text: Term (type), Definition, Notes.
 * Keeps under ~500 chars for native title attribute.
 */
function buildTooltipTitle(def: DefinitionForInject): string {
  const typeLabel = def.type === 'abbreviation' ? 'Abbreviation' : 'Glossary'
  const defPlain = stripHtml(def.definition).slice(0, 400)
  const parts: string[] = [`${typeLabel}: ${def.term}`, defPlain]
  if (def.notes) parts.push(stripHtml(def.notes).slice(0, 100))
  return escapeAttr(parts.join('\n\n'))
}

/**
 * Wraps each definition term found in text content (between > and <) with a span
 * that has class "glossary-term" (highlight + underline), and title tooltip with Term, Definition, Notes.
 */
function injectIntoText(text: string, sorted: DefinitionForInject[]): string {
  let out = text
  for (const def of sorted) {
    if (!def.term) continue
    const re = new RegExp(escapeRegex(def.term), 'gi')
    const title = buildTooltipTitle(def)
    out = out.replace(re, (match) =>
      `<span class="glossary-term" data-definition-id="${def.id}" title="${title}">${match}</span>`
    )
  }
  return out
}

export function injectGlossaryTerms(
  html: string,
  definitions: DefinitionForInject[]
): string {
  if (!html || definitions.length === 0) return html
  const sorted = [...definitions].sort((a, b) => b.term.length - a.term.length)
  // Plain text (no HTML tags): process the whole string
  if (!html.includes('<')) return injectIntoText(html, sorted)
  // HTML: only replace in text nodes (between > and <)
  return html.replace(/>([^<]+)</g, (_, textSegment: string) =>
    '>' + injectIntoText(textSegment, sorted) + '<'
  )
}
