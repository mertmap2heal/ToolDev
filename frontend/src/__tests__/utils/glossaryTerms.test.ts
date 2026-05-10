import { describe, it, expect } from 'vitest'
import { injectGlossaryTerms, type DefinitionForInject } from '@/utils/glossaryTerms'

const def = (overrides: Partial<DefinitionForInject>): DefinitionForInject => ({
  id: 'def-1',
  term: 'API',
  definition: 'Application Programming Interface',
  ...overrides,
})

describe('injectGlossaryTerms', () => {
  it('returns html unchanged when there are no definitions', () => {
    expect(injectGlossaryTerms('hello world', [])).toBe('hello world')
  })

  it('returns html unchanged when html is empty', () => {
    expect(injectGlossaryTerms('', [def({})])).toBe('')
  })

  it('wraps a matched term in plain text with a glossary-term span', () => {
    const out = injectGlossaryTerms('We expose an API endpoint', [def({})])
    expect(out).toContain('class="glossary-term"')
    expect(out).toContain('data-definition-id="def-1"')
    expect(out).toContain('>API</span>')
  })

  it('matches case-insensitively but preserves the matched casing', () => {
    const out = injectGlossaryTerms('use the api', [def({ term: 'API' })])
    // The wrap preserves the original casing of the match
    expect(out).toMatch(/>api<\/span>/)
  })

  it('only wraps in text content, not inside attributes (HTML mode)', () => {
    // The implementation uses a regex of the form `>([^<]+)<` to find text
    // segments — it requires text to be bounded by both `>` and `<`. So we
    // wrap the trailing text in a paragraph element so it has a closing tag.
    const html =
      '<a href="http://api.example.com">click</a><p>uses the API today</p>'
    const out = injectGlossaryTerms(html, [def({ term: 'API' })])
    // Inside the href value: "api" should not be wrapped
    expect(out).toContain('href="http://api.example.com"')
    // The href value itself must not have been mutated.
    expect(out).not.toContain('href="http://<span')
    // In the paragraph text "API" should be wrapped.
    expect(out).toMatch(/>API<\/span>/)
  })

  it('processes longest term first when multiple definitions overlap', () => {
    const html = 'Application Programming Interface'
    const defs: DefinitionForInject[] = [
      def({ id: 'short', term: 'API', definition: 'short' }),
      def({ id: 'long', term: 'Application Programming Interface', definition: 'long' }),
    ]
    const out = injectGlossaryTerms(html, defs)
    expect(out).toContain('data-definition-id="long"')
    // The long match consumed the entire phrase, so 'API' must not have been
    // wrapped in addition.
    expect(out).not.toContain('data-definition-id="short"')
  })

  it('builds the title with type label and stripped definition', () => {
    const out = injectGlossaryTerms('the API today', [
      def({
        type: 'abbreviation',
        definition: '<p>Application Programming Interface</p>',
      }),
    ])
    expect(out).toContain('Abbreviation: API')
    expect(out).toContain('Application Programming Interface')
    // HTML in the definition is stripped before being placed in the title
    expect(out).not.toContain('<p>Application')
  })

  it('defaults to "Glossary" type label when type is not provided', () => {
    const out = injectGlossaryTerms('the API today', [def({})])
    expect(out).toContain('Glossary: API')
  })

  it('escapes quote and ampersand in title attributes (HTML safety)', () => {
    // The title is built by stripHtml() FIRST (which removes any <tags>),
    // then escapeAttr() runs on the result. So <tag> is stripped, not
    // escaped — verify the surviving characters are properly escaped.
    const out = injectGlossaryTerms('see API', [
      def({ definition: 'a "quoted" & raw' }),
    ])
    expect(out).toContain('&quot;')
    expect(out).toContain('&amp;')
  })

  it('strips HTML tags from definition before placing in title', () => {
    const out = injectGlossaryTerms('see API', [
      def({ definition: '<script>bad()</script>safe' }),
    ])
    // The raw <script>...</script> must not appear unescaped in the output.
    expect(out).not.toContain('<script>')
    expect(out).toContain('safe')
  })

  it('skips definitions with empty term', () => {
    const out = injectGlossaryTerms('hello world', [def({ term: '' })])
    expect(out).toBe('hello world')
  })

  it('escapes regex special characters in term', () => {
    const html = 'Use C++ for systems work'
    const out = injectGlossaryTerms(html, [
      def({ id: 'cpp', term: 'C++', definition: 'lang' }),
    ])
    expect(out).toContain('data-definition-id="cpp"')
    expect(out).toMatch(/>C\+\+<\/span>/)
  })

  it('appends notes (truncated) to the tooltip when present', () => {
    const out = injectGlossaryTerms('API', [
      def({ notes: 'Useful note about the API' }),
    ])
    expect(out).toContain('Useful note about the API')
  })
})
