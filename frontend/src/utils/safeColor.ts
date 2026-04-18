/**
 * CSS colour sanitiser.
 *
 * #268: Issues (and any other surface that renders user/backend-supplied
 * colour values inline) must reject anything that is not a strict
 * #RRGGBB / #RRGGBBAA hex literal. Without this guard a backend column
 * that stores free-form text lets `style={{ color: value }}` render
 * \`background:url(...)\` exfiltration payloads or CSS import attacks.
 */

const HEX_RE = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

const DEFAULT_SAFE_COLOR = '#3B82F6' // Tailwind blue-500

export function safeHexColor(input: unknown, fallback: string = DEFAULT_SAFE_COLOR): string {
  if (typeof input === 'string' && HEX_RE.test(input)) return input
  return fallback
}

/** For translucent-background chips: appends the 20% alpha suffix. */
export function safeHexColorTint(input: unknown, fallback: string = DEFAULT_SAFE_COLOR): string {
  const base = safeHexColor(input, fallback)
  // base is always 6 or 8 hex digits plus #; append 20 only when length is
  // exactly 7 (#RRGGBB) to get #RRGGBB20.
  return base.length === 7 ? `${base}20` : base
}
