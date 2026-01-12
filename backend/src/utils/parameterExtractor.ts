/**
 * Extracts parameter names from text using the pattern @parameterName@
 * @param text - The text to extract parameters from
 * @returns Array of unique parameter names found in the text
 */
export function extractParameters(text: string): string[] {
  if (!text) return []

  // Match pattern: @parameterName@
  // This regex matches @ followed by one or more word characters, then @
  const regex = /@(\w+)@/g
  const matches = text.matchAll(regex)
  const parameters = new Set<string>()

  for (const match of matches) {
    if (match[1]) {
      parameters.add(match[1])
    }
  }

  return Array.from(parameters)
}
