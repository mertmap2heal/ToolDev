import type { Node, Edge, MarkerType } from 'reactflow'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'

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
 * Build ReactFlow nodes + edges from parameters, optionally grouped
 * by folder (plan Phase 3).
 *
 * When `folders` is provided and non-empty, each folder gets a
 * `folderGroup` container node; child parameters carry parentId +
 * extent='parent' and are packed in a sqrt(n) x sqrt(n) grid inside
 * their group. Sub-folders are rendered as flattened top-level groups
 * labelled "Parent / Child" (v1 simplification - nested groups tend to
 * freeze ReactFlow's layout engine on dense graphs).
 *
 * When `folders` is missing or empty, the classic dependency-column
 * layout is used for backward compat.
 */
export function buildParameterGraph(
  parameters: Parameter[],
  folders?: ParameterFolder[],
): { nodes: Node[]; edges: Edge[] } {
  if (parameters.length === 0) return { nodes: [], edges: [] }

  const paramMap = new Map<string, Parameter>(parameters.map((p) => [p.id, p]))
  const edges = buildEdges(parameters, paramMap)

  if (folders && folders.length > 0) {
    return buildGroupedLayout(parameters, paramMap, folders, edges)
  }
  return { nodes: buildDependencyLayout(parameters, paramMap, edges), edges }
}

function buildEdges(
  parameters: Parameter[],
  paramMap: Map<string, Parameter>,
): Edge[] {
  const edges: Edge[] = []
  for (const param of parameters) {
    if (!param.formula) continue
    for (const refId of extractRefs(param.formula)) {
      if (!paramMap.has(refId)) continue
      edges.push({
        id: `e-${refId}-${param.id}`,
        source: refId,
        target: param.id,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 1.5 },
        markerEnd: { type: 'arrowclosed' as MarkerType, color: '#6366f1' },
      })
    }
  }
  return edges
}

// ---------------------------------------------------------------------------
// Grouped-by-folder layout (Phase 3)
// ---------------------------------------------------------------------------

function folderLabel(folder: ParameterFolder, all: ParameterFolder[]): string {
  if (!folder.parentId) return folder.name
  const parent = all.find((f) => f.id === folder.parentId)
  return parent ? `${parent.name} / ${folder.name}` : folder.name
}

function buildGroupedLayout(
  parameters: Parameter[],
  paramMap: Map<string, Parameter>,
  folders: ParameterFolder[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const CHILD_W = 170
  const CHILD_H = 70
  const CHILD_GAP_X = 14
  const CHILD_GAP_Y = 10
  const HEADER_H = 30
  const PADDING = 12
  const GROUP_GAP = 40

  // Bucket parameters by folder. Ungrouped falls into a synthetic
  // `__ungrouped__` folder. Folders with zero rows are shown empty.
  const byFolder = new Map<string, Parameter[]>()
  for (const f of folders) byFolder.set(f.id, [])
  const ungrouped: Parameter[] = []
  for (const p of parameters) {
    if (p.folderId && byFolder.has(p.folderId)) byFolder.get(p.folderId)!.push(p)
    else ungrouped.push(p)
  }
  if (ungrouped.length > 0) byFolder.set('__ungrouped__', ungrouped)

  // Sort so deeper folders render below their parents (stable layout)
  const orderedIds = [
    ...folders.filter((f) => !f.parentId).map((f) => f.id),
    ...folders.filter((f) => f.parentId).map((f) => f.id),
    ...(ungrouped.length > 0 ? ['__ungrouped__'] : []),
  ]

  let cursorY = 0
  const nodes: Node[] = []

  for (const folderId of orderedIds) {
    const children = byFolder.get(folderId) ?? []
    const folder = folders.find((f) => f.id === folderId)
    const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, children.length))))
    const rows = Math.max(1, Math.ceil(children.length / cols))
    const innerW = cols * CHILD_W + (cols - 1) * CHILD_GAP_X
    const innerH = rows * CHILD_H + (rows - 1) * CHILD_GAP_Y
    const groupW = innerW + PADDING * 2
    const groupH = HEADER_H + innerH + PADDING

    nodes.push({
      id: `group-${folderId}`,
      type: 'folderGroup',
      position: { x: 0, y: cursorY },
      data: {
        name: folder ? folderLabel(folder, folders) : 'Ungrouped',
        count: children.length,
        color: folder?.color ?? undefined,
        depth: folder?.parentId ? 1 : 0,
      },
      style: { width: groupW, height: groupH },
      draggable: false,
      selectable: false,
    })

    children.forEach((param, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      nodes.push({
        id: param.id,
        type: 'paramNode',
        parentNode: `group-${folderId}`,
        extent: 'parent',
        position: {
          x: PADDING + col * (CHILD_W + CHILD_GAP_X),
          y: HEADER_H + row * (CHILD_H + CHILD_GAP_Y),
        },
        data: { param: paramMap.get(param.id)! },
        style: { width: CHILD_W, height: CHILD_H },
      })
    })

    cursorY += groupH + GROUP_GAP
  }

  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Classic dependency-column layout (used when no folders provided)
// ---------------------------------------------------------------------------

function buildDependencyLayout(
  parameters: Parameter[],
  paramMap: Map<string, Parameter>,
  edges: Edge[],
): Node[] {
  const dependants = new Map<string, Set<string>>()
  const connected = new Set<string>()
  for (const p of parameters) dependants.set(p.id, new Set())
  for (const e of edges) {
    connected.add(e.source)
    connected.add(e.target)
    dependants.get(e.source)!.add(e.target)
  }

  const inDegree = new Map<string, number>()
  for (const p of parameters) inDegree.set(p.id, 0)
  for (const e of edges) inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)

  const column = new Map<string, number>()
  const queue: string[] = []
  for (const p of parameters) {
    if (connected.has(p.id) && inDegree.get(p.id) === 0) {
      column.set(p.id, 0)
      queue.push(p.id)
    }
  }
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    const curCol = column.get(cur) ?? 0
    for (const depId of dependants.get(cur) ?? []) {
      const existing = column.get(depId)
      const candidate = curCol + 1
      if (existing === undefined || candidate > existing) column.set(depId, candidate)
      if (!queue.includes(depId)) queue.push(depId)
    }
  }

  const isolated = parameters.filter((p) => !connected.has(p.id))
  const byColumn = new Map<number, string[]>()
  for (const [id, col] of column.entries()) {
    if (!byColumn.has(col)) byColumn.set(col, [])
    byColumn.get(col)!.push(id)
  }

  const COL_WIDTH = 200
  const ROW_HEIGHT = 90
  const ISOLATED_COL_START_X =
    (byColumn.size > 0 ? byColumn.size : 1) * COL_WIDTH + COL_WIDTH
  const nodes: Node[] = []

  for (const [col, ids] of byColumn.entries()) {
    ids.forEach((id, rowIndex) => {
      const param = paramMap.get(id)!
      nodes.push({
        id: param.id,
        type: 'paramNode',
        position: { x: col * COL_WIDTH, y: rowIndex * ROW_HEIGHT },
        data: { param },
      })
    })
  }

  const ISOLATED_COLS = 3
  isolated.forEach((param, i) => {
    const col = i % ISOLATED_COLS
    const row = Math.floor(i / ISOLATED_COLS)
    nodes.push({
      id: param.id,
      type: 'paramNode',
      position: { x: ISOLATED_COL_START_X + col * COL_WIDTH, y: row * ROW_HEIGHT },
      data: { param },
    })
  })

  return nodes
}
