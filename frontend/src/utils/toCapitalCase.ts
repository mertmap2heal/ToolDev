/** Capital-case: first letter of each word uppercase, rest lowercase. */
export function toCapitalCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
