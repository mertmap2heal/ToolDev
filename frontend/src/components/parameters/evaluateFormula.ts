/**
 * Parses {{param:ID}} references, substitutes numeric values, and evaluates
 * a mathematical expression safely using the Function constructor.
 *
 * Security: the expression is sanitised to only allow digits, standard
 * arithmetic operators, parentheses, decimal points, and scientific-notation
 * characters before evaluation.
 */

export interface FormulaEvalResult {
  result: number | null
  error: string | null
  usedParamIds: string[]
}

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

/**
 * Extract all {{param:ID}} references from a formula string.
 */
export function extractParamRefs(formula: string): string[] {
  const ids: string[] = []
  const re = /\{\{param:([a-z0-9]+)\}\}/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(formula)) !== null) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

/**
 * Detect circular formula dependencies across a set of parameters.
 *
 * @param params  Array of objects with `id` and optional `formula`.
 *                Accepts any shape that has those two fields.
 * @returns Array of cycle descriptions, e.g. ["A → B → A"].
 *          Empty array means no cycles.
 */
export function detectCycles(
  params: Array<{ id: string; formula?: string | null }>
): string[] {
  // Build adjacency map: id -> list of referenced param ids
  const deps = new Map<string, string[]>()
  const idToName = new Map<string, string>()
  for (const p of params) {
    const refs = p.formula ? extractParamRefs(p.formula) : []
    deps.set(p.id, refs)
    idToName.set(p.id, (p as { id: string; name?: string }).name ?? p.id)
  }

  const cycles: string[] = []
  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(id: string, path: string[]): void {
    if (inStack.has(id)) {
      // Found a cycle — extract the loop portion
      const cycleStart = path.indexOf(id)
      const loop = path.slice(cycleStart).concat(id)
      const label = loop.map(i => idToName.get(i) ?? i).join(' → ')
      if (!cycles.some(c => c === label)) cycles.push(label)
      return
    }
    if (visited.has(id)) return
    visited.add(id)
    inStack.add(id)
    for (const dep of deps.get(id) ?? []) {
      dfs(dep, [...path, id])
    }
    inStack.delete(id)
  }

  for (const id of deps.keys()) {
    dfs(id, [])
  }
  return cycles
}

// ---------------------------------------------------------------------------
// Named engineering constants — available in every formula
// ---------------------------------------------------------------------------
export const FORMULA_CONSTANTS: Record<string, number> = {
  pi:    Math.PI,
  PI:    Math.PI,
  e:     Math.E,
  E:     Math.E,
  g:     9.80665,   // standard gravity (m/s²)
  G:     6.674e-11, // gravitational constant (N·m²/kg²)
  c:     299792458, // speed of light (m/s)
  R:     8.314462,  // ideal gas constant (J/(mol·K))
  k:     1.380649e-23, // Boltzmann constant (J/K)
  h:     6.626070e-34, // Planck constant (J·s)
  eps0:  8.854188e-12, // vacuum permittivity (F/m)
  mu0:   1.256637e-6,  // vacuum permeability (H/m)
  N_A:   6.022141e23,  // Avogadro constant (mol⁻¹)
  atm:   101325,    // standard atmosphere (Pa)
  deg:   Math.PI / 180, // 1 degree in radians
  rad:   180 / Math.PI, // 1 radian in degrees
}

/** Pattern that matches a named constant in a formula expression */
const CONSTANT_RE = new RegExp(
  `\\b(${Object.keys(FORMULA_CONSTANTS).join('|')})\\b`,
  'g'
)

/**
 * Evaluate a formula string that may contain:
 * - {{param:ID}} references (canonical form stored in DB)
 * - bare parameter names (e.g. base_mass * 2) when paramValuesByName is provided
 * - named engineering constants (pi, g, R, c, …)
 *
 * @param formula          The raw formula string
 * @param paramValues      Map of parameter ID -> numeric value
 * @param paramValuesByName  Optional map of parameter NAME -> numeric value (for name-based refs)
 */
export function evaluateFormula(
  formula: string,
  paramValues: Record<string, number>,
  paramValuesByName?: Record<string, number>
): FormulaEvalResult {
  const usedParamIds: string[] = []

  // Collect all referenced param IDs
  const refPattern = /\{\{param:([a-z0-9-]+)\}\}/gi
  let match: RegExpExecArray | null
  while ((match = refPattern.exec(formula)) !== null) {
    const id = match[1]
    if (!usedParamIds.includes(id)) usedParamIds.push(id)
  }

  // Substitute {{param:ID}} references with numeric values
  let expr = formula
  for (const id of usedParamIds) {
    if (!(id in paramValues)) {
      return { result: null, error: `Unknown parameter: ${id}`, usedParamIds }
    }
    expr = expr.replace(
      new RegExp(`\\{\\{param:${id}\\}\\}`, 'gi'),
      String(paramValues[id])
    )
  }

  // Substitute named constants (pi, g, R, …) with their numeric values
  expr = expr.replace(CONSTANT_RE, (name) => String(FORMULA_CONSTANTS[name]))

  // Substitute bare parameter name references if a name→value map is provided.
  // Sort by descending length to avoid partial replacement (e.g. "mass" inside "total_mass").
  if (paramValuesByName && Object.keys(paramValuesByName).length > 0) {
    const sortedNames = Object.keys(paramValuesByName).sort((a, b) => b.length - a.length)
    for (const pName of sortedNames) {
      const escaped = pName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const nameRe = new RegExp(`\\b${escaped}\\b`, 'g')
      if (nameRe.test(expr)) {
        expr = expr.replace(new RegExp(`\\b${escaped}\\b`, 'g'), String(paramValuesByName[pName]))
        // Track that this was referenced (we don't have the ID, so skip ID tracking)
      }
    }
  }

  // Sanitise: only allow digits, arithmetic operators, parens, dots, spaces,
  // and e/E for scientific notation (constants are already substituted to numbers)
  if (!/^[\d\s+\-*/^%().eE]+$/.test(expr)) {
    // Provide a more helpful error if identifiers remain (unresolved names)
    const unresolvedMatch = expr.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/)
    const error = unresolvedMatch
      ? `Unknown identifier: "${unresolvedMatch[0]}" — use {{param:ID}} or a recognised constant (pi, g, R…)`
      : 'Invalid formula: unsupported characters after constant substitution'
    return { result: null, error, usedParamIds }
  }

  try {
    const result = new Function(`return (${expr})`)() as number
    if (typeof result !== 'number' || !isFinite(result)) {
      return { result: null, error: 'Result is not a finite number', usedParamIds }
    }
    return { result, error: null, usedParamIds }
  } catch {
    return { result: null, error: 'Invalid formula expression', usedParamIds }
  }
}
