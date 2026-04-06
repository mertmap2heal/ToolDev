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

