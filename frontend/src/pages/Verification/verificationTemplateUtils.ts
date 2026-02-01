/**
 * Section blueprint for Verification templates (Documentation-style builder).
 * Serialized to/from contentJson (ProseMirror doc) so existing API is unchanged.
 */
export interface VerificationTemplateSection {
  id: string
  title: string
  orderIndex: number
  type: 'text' | 'table' | 'placeholder'
  placeholderValue?: string
}

const SECTION_ATTR = 'data-section-type'
const PLACEHOLDER_ATTR = 'data-placeholder'

interface ProseMirrorNode {
  type: string
  attrs?: Record<string, unknown>
  content?: ProseMirrorNode[]
  text?: string
}

interface ProseMirrorDoc {
  type: string
  content?: ProseMirrorNode[]
}

/**
 * Parse contentJson (ProseMirror doc) into a section list.
 * Convention: each section = one heading (level 2) with optional data-section-type and data-placeholder attrs,
 * followed by one paragraph or table. If structure doesn't match, returns empty array.
 */
export function contentJsonToSections(contentJson: unknown): VerificationTemplateSection[] {
  if (!contentJson || typeof contentJson !== 'object') return []
  const doc = contentJson as ProseMirrorDoc
  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return []

  const sections: VerificationTemplateSection[] = []
  let orderIndex = 0

  for (let i = 0; i < doc.content.length; i++) {
    const node = doc.content[i] as ProseMirrorNode
    if (node.type === 'heading') {
      const level = (node.attrs?.level as number) ?? 2
      const title = getTextContent(node)
      const type = ((node.attrs?.[SECTION_ATTR] as string) ?? 'text') as VerificationTemplateSection['type']
      const placeholderValue = node.attrs?.[PLACEHOLDER_ATTR] as string | undefined

      sections.push({
        id: `sec-${orderIndex}-${i}`,
        title: title || 'Untitled Section',
        orderIndex,
        type: type === 'table' || type === 'placeholder' ? type : 'text',
        placeholderValue: placeholderValue || undefined,
      })
      orderIndex++
      // Skip the following paragraph/table (section body)
      const next = doc.content[i + 1]
      if (next && (next.type === 'paragraph' || next.type === 'table')) {
        i++
      }
    }
  }

  return sections
}

function getTextContent(node: ProseMirrorNode): string {
  if (node.text) return node.text
  if (!Array.isArray(node.content)) return ''
  return node.content.map(getTextContent).join('')
}

/**
 * Build contentJson (ProseMirror doc) from section list for save.
 */
export function sectionsToContentJson(sections: VerificationTemplateSection[]): object {
  const content: ProseMirrorNode[] = []

  sections
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .forEach((sec) => {
      const attrs: Record<string, unknown> = { level: 2 }
      attrs[SECTION_ATTR] = sec.type
      if (sec.type === 'placeholder' && sec.placeholderValue) {
        attrs[PLACEHOLDER_ATTR] = sec.placeholderValue
      }

      content.push({
        type: 'heading',
        attrs,
        content: [{ type: 'text', text: sec.title }],
      })

      content.push({
        type: 'paragraph',
        content: [],
      })
    })

  if (content.length === 0) {
    content.push({ type: 'paragraph', content: [] })
  }

  return { type: 'doc', content }
}

/**
 * Detect if contentJson follows our section-based convention (at least one heading with data-section-type or consistent heading+paragraph pattern).
 */
export function isSectionBasedContentJson(contentJson: unknown): boolean {
  const sections = contentJsonToSections(contentJson)
  return sections.length > 0
}
