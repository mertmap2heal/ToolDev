/**
 * Injects glossary/abbreviation term spans into HTML for underline + tooltip.
 * Only replaces in text content (between tags), not inside attribute values.
 * Case-sensitive exact match per spec.
 */

export interface DefinitionForInject {
  id: string
  term: string
  definition: string
  notes?: string | null
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

/**
 * Wraps each definition term found in text content (between > and <) with a span
 * that has class "glossary-term", underline styling, and title tooltip.
 */
export function injectGlossaryTerms(
  html: string,
  definitions: DefinitionForInject[]
): string {
  if (!html || definitions.length === 0) return html
  // Sort by term length descending so "Maximum Takeoff Weight" is matched before "Takeoff"
  const sorted = [...definitions].sort((a, b) => b.term.length - a.term.length)
  return html.replace(/>([^<]+)</g, (_, textSegment: string) => {
    let out = textSegment
    for (const def of sorted) {
      if (!def.term) continue
      const re = new RegExp(escapeRegex(def.term), 'g')
      const tooltip = [def.definition, def.notes].filter(Boolean).join('\n\n')
      const title = escapeAttr(tooltip.replace(/<[^>]*>/g, '').trim().slice(0, 500))
      out = out.replace(re, (match) =>
        `<span class="glossary-term underline cursor-help" data-definition-id="${def.id}" title="${title}">${match}</span>`
      )
    }
    return '>' + out + '<'
  })
}
