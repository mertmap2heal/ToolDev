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

/**
 * Evaluate a formula string that may contain {{param:ID}} references.
 *
 * @param formula    The raw formula string, e.g. "{{param:abc123}} * 2 + 1"
 * @param paramValues  Map of parameter ID -> numeric value
 * @returns FormulaEvalResult with result, error, and the list of referenced IDs
 */
export function evaluateFormula(
  formula: string,
  paramValues: Record<string, number>
): FormulaEvalResult {
  const usedParamIds: string[] = []

  // Collect all referenced param IDs
  const refPattern = /\{\{param:([a-z0-9]+)\}\}/gi
  let match: RegExpExecArray | null
  while ((match = refPattern.exec(formula)) !== null) {
    const id = match[1]
    if (!usedParamIds.includes(id)) usedParamIds.push(id)
  }

  // Substitute references with numeric values
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

  // Sanitise: only allow digits, arithmetic operators, parens, dots, spaces,
  // and e/E for scientific notation
  if (!/^[\d\s+\-*/^%().eE]+$/.test(expr)) {
    return {
      result: null,
      error: 'Invalid formula: unsupported characters',
      usedParamIds,
    }
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
