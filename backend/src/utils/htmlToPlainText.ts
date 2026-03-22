/** Strip simple HTML for short audit previews (mirrors frontend htmlToPlainText). */
export function htmlToPlainText(html: string | null | undefined): string {
  if (html == null || typeof html !== 'string') return ''
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/p>/gi, '\n')
  s = s.replace(/<\/div>/gi, '\n')
  s = s.replace(/<\/li>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  s = s.replace(/\n{3,}/g, '\n\n').trim()
  s = s.replace(/[ \t]+/g, ' ')
  return s
}

export function truncatePlainText(text: string, maxLen: number): string {
  const t = text.trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen)}…`
}
