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
