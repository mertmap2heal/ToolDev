import type { TraceLink } from '../../../shared/types/traceability.types'
import type {
  TraceabilityMatrixAxisItem,
  TraceabilityMatrixCells,
  TraceabilityMatrixCellEntry,
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
): TraceabilityMatrixCellEntry[] {
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
   * Each cell contains structured entries with relationship type and direction
   * arrows, consistent with INCOSE/SysML traceability conventions.
   */
  async buildMatrix(
    projectId: string,
    rowType: string,
    colType: string
  ): Promise<TraceabilityMatrixModel> {
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
      let arrow: '→' | '←' | '↔'

      if (link.sourceType === rowType && link.targetType === colType) {
        // Forward link: row → col
        rowId = link.sourceId
        colId = link.targetId
        colDisplayId = link.targetDisplayId
        arrow = '→'

        if (!rowMap.has(rowId)) {
          rowMap.set(
            rowId,
            buildAxisItem(rowId, rowType, link.sourceDisplayId, (link as any).sourceLabel ?? link.sourceTitle)
          )
        }
        if (!colMap.has(colId)) {
          colMap.set(
            colId,
            buildAxisItem(colId, colType, link.targetDisplayId, (link as any).targetLabel ?? link.targetTitle)
          )
        }
      } else if (link.sourceType === colType && link.targetType === rowType) {
        // Reverse link: col → row, so from the row's perspective the arrow is ←
        rowId = link.targetId
        colId = link.sourceId
        colDisplayId = link.sourceDisplayId
        arrow = '←'

        if (!rowMap.has(rowId)) {
          rowMap.set(
            rowId,
            buildAxisItem(rowId, rowType, link.targetDisplayId, (link as any).targetLabel ?? link.targetTitle)
          )
        }
        if (!colMap.has(colId)) {
          colMap.set(
            colId,
            buildAxisItem(colId, colType, link.sourceDisplayId, (link as any).sourceLabel ?? link.sourceTitle)
          )
        }
      } else {
        continue
      }

      if (!rowId || !colId) continue

      const cell = ensureCell(cells, rowId, colId)
      const entry: TraceabilityMatrixCellEntry = {
        displayId: colDisplayId || shortId(colId),
        linkType: link.linkType,
        arrow,
        isSuspect: link.isSuspect || false,
      }

      // Avoid duplicate entries for the same link type + direction
      const isDuplicate = cell.some(
        (e) => e.linkType === entry.linkType && e.arrow === entry.arrow && e.displayId === entry.displayId
      )
      if (!isDuplicate) {
        cell.push(entry)
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
