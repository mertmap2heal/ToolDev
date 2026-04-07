import type { Node, Edge, MarkerType } from 'reactflow'
import type { Parameter } from 'shared/types/engineering.types'

const FORMULA_REF_RE = /\{\{param:([a-z0-9_-]+)\}\}/gi

/** Extract all parameter IDs referenced in a formula string. */
function extractRefs(formula: string): string[] {
  const ids: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(FORMULA_REF_RE.source, 'gi')
  while ((match = re.exec(formula)) !== null) {
    ids.push(match[1])
  }
  return ids
}

/**
 * Build ReactFlow nodes and edges from a parameter list.
 *
 * Layout strategy:
 *  - Build a dependency graph: edge from referenced param -> param that uses it.
 *  - BFS from root params (those not referenced by any formula) to assign column depth.
 *  - Isolated params (no formula, not referenced) are placed in a rightmost cluster.
 *  - Horizontal spacing: 200px per column. Vertical: 90px per row within a column.
 */
export function buildParameterGraph(
  parameters: Parameter[],
): { nodes: Node[]; edges: Edge[] } {
  if (parameters.length === 0) return { nodes: [], edges: [] }

  const paramMap = new Map<string, Parameter>(parameters.map((p) => [p.id, p]))

  // Build adjacency: referencedId -> set of dependant IDs
  const dependants = new Map<string, Set<string>>() // referenced -> users
  const dependencies = new Map<string, Set<string>>() // user -> its refs

  for (const param of parameters) {
    dependencies.set(param.id, new Set())
    if (!dependants.has(param.id)) dependants.set(param.id, new Set())
  }

  const allEdges: Edge[] = []

  for (const param of parameters) {
    if (!param.formula) continue
    const refs = extractRefs(param.formula)
    for (const refId of refs) {
      if (!paramMap.has(refId)) continue // skip dangling refs
      dependencies.get(param.id)!.add(refId)
      if (!dependants.has(refId)) dependants.set(refId, new Set())
      dependants.get(refId)!.add(param.id)
      allEdges.push({
        id: `e-${refId}-${param.id}`,
        source: refId,
        target: param.id,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 1.5 },
        markerEnd: { type: 'arrowclosed' as MarkerType, color: '#6366f1' },
      })
    }
  }

  // Determine which params are "connected" (have at least one edge)
  const connected = new Set<string>()
  for (const e of allEdges) {
    connected.add(e.source)
    connected.add(e.target)
  }

  // BFS column assignment for connected nodes
  // Root = connected params with no incoming edges (nothing references them)
  const inDegree = new Map<string, number>()
  for (const param of parameters) inDegree.set(param.id, 0)
  for (const e of allEdges) inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)

  const column = new Map<string, number>()
  const queue: string[] = []

  for (const param of parameters) {
    if (connected.has(param.id) && inDegree.get(param.id) === 0) {
      column.set(param.id, 0)
      queue.push(param.id)
    }
  }

  // BFS
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    const curCol = column.get(cur) ?? 0
    for (const depId of dependants.get(cur) ?? []) {
      const existing = column.get(depId)
      const candidate = curCol + 1
      if (existing === undefined || candidate > existing) {
        column.set(depId, candidate)
      }
      if (!queue.includes(depId)) queue.push(depId)
    }
  }

  // Isolated: params with no edges at all
  const isolated = parameters.filter((p) => !connected.has(p.id))

  // Group connected params by column
  const byColumn = new Map<number, string[]>()
  for (const [id, col] of column.entries()) {
    if (!byColumn.has(col)) byColumn.set(col, [])
    byColumn.get(col)!.push(id)
  }

  const COL_WIDTH = 200
  const ROW_HEIGHT = 90
  const ISOLATED_COL_START_X = (byColumn.size > 0 ? byColumn.size : 1) * COL_WIDTH + COL_WIDTH

  const allNodes: Node[] = []

  // Place connected nodes
  for (const [col, ids] of byColumn.entries()) {
    ids.forEach((id, rowIndex) => {
      const param = paramMap.get(id)!
      allNodes.push({
        id: param.id,
        type: 'paramNode',
        position: { x: col * COL_WIDTH, y: rowIndex * ROW_HEIGHT },
        data: { param },
      })
    })
  }

  // Place isolated nodes in a separate cluster on the right
  const ISOLATED_COLS = 3
  isolated.forEach((param, i) => {
    const col = i % ISOLATED_COLS
    const row = Math.floor(i / ISOLATED_COLS)
    allNodes.push({
      id: param.id,
      type: 'paramNode',
      position: { x: ISOLATED_COL_START_X + col * COL_WIDTH, y: row * ROW_HEIGHT },
      data: { param },
    })
  })

  return { nodes: allNodes, edges: allEdges }
}
