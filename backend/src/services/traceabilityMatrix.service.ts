import type { TraceLink } from '../../../shared/types/traceability.types'
import type {
  TraceabilityMatrixAxisItem,
  TraceabilityMatrixCells,
  TraceabilityMatrixModel,
} from '../../../shared/types/traceabilityMatrix.types'
import { traceabilityService } from './traceability.service'

function shortId(id: string): string {
  return id.length > 8 ? id.substring(0, 8) : id
}

function buildAxisItem(
  id: string,
  type: string,
  displayId?: string,
  label?: string
): TraceabilityMatrixAxisItem {
  const key = displayId || shortId(id)
  const effectiveLabel = label || key
  return {
    id,
    key,
    label: effectiveLabel,
    type,
  }
}

function ensureCell(
  cells: TraceabilityMatrixCells,
  rowId: string,
  colId: string
): string[] {
  if (!cells[rowId]) {
    cells[rowId] = {}
  }
  if (!cells[rowId][colId]) {
    cells[rowId][colId] = []
  }
  return cells[rowId][colId]
}

export const traceabilityMatrixService = {
  /**
   * Build a generic traceability matrix for the given project and axis types.
   *
   * Rows and columns are logical artifact types (e.g. "requirement", "verification").
   * Cells contain lists of IDs for the column-side artifacts (e.g. TEST-001, COMP-005).
   */
  async buildMatrix(
    projectId: string,
    rowType: string,
    colType: string
  ): Promise<TraceabilityMatrixModel> {
    // Fetch links in both directions so that the matrix is insensitive to how
    // the underlying link was created (source vs target).
    const [forward, reverse] = await Promise.all([
      traceabilityService.getTraceLinks(projectId, { sourceType: rowType, targetType: colType }),
      traceabilityService.getTraceLinks(projectId, { sourceType: colType, targetType: rowType }),
    ])

    const links: TraceLink[] = [...forward, ...reverse]

    const rowMap = new Map<string, TraceabilityMatrixAxisItem>()
    const colMap = new Map<string, TraceabilityMatrixAxisItem>()
    const cells: TraceabilityMatrixCells = {}

    for (const link of links) {
      let rowId: string | null = null
      let colId: string | null = null
      let colDisplayId: string | undefined

      if (link.sourceType === rowType && link.targetType === colType) {
        rowId = link.sourceId
        colId = link.targetId
        colDisplayId = link.targetDisplayId

        if (!rowMap.has(rowId)) {
          rowMap.set(
            rowId,
            buildAxisItem(rowId, rowType, link.sourceDisplayId, link.sourceLabel ?? link.sourceTitle)
          )
        }
        if (!colMap.has(colId)) {
          colMap.set(
            colId,
            buildAxisItem(colId, colType, link.targetDisplayId, link.targetLabel ?? link.targetTitle)
          )
        }
      } else if (link.sourceType === colType && link.targetType === rowType) {
        rowId = link.targetId
        colId = link.sourceId
        colDisplayId = link.sourceDisplayId

        if (!rowMap.has(rowId)) {
          rowMap.set(
            rowId,
            buildAxisItem(rowId, rowType, link.targetDisplayId, link.targetLabel ?? link.targetTitle)
          )
        }
        if (!colMap.has(colId)) {
          colMap.set(
            colId,
            buildAxisItem(colId, colType, link.sourceDisplayId, link.sourceLabel ?? link.sourceTitle)
          )
        }
      } else {
        // Link not relevant for this axis combination.
        continue
      }

      if (!rowId || !colId) continue

      const cell = ensureCell(cells, rowId, colId)
      const value = colDisplayId || shortId(colId)
      if (!cell.includes(value)) {
        cell.push(value)
      }
    }

    return {
      projectId,
      rowType,
      colType,
      rows: Array.from(rowMap.values()),
      cols: Array.from(colMap.values()),
      cells,
    }
  },
}

