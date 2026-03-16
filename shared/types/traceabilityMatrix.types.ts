export type TraceabilityAxisType =
  | 'requirement'
  | 'function'
  | 'parameter'
  | 'architecture'
  | 'verification'
  | string

export interface TraceabilityMatrixAxisItem {
  id: string
  key: string
  label: string
  type: TraceabilityAxisType
}

export interface TraceabilityMatrixCells {
  [rowId: string]: {
    [colId: string]: string[]
  }
}

export interface TraceabilityMatrixModel {
  projectId: string
  rowType: string
  colType: string
  rows: TraceabilityMatrixAxisItem[]
  cols: TraceabilityMatrixAxisItem[]
  /**
   * Cell values are lists of IDs to display in the matrix,
   * typically the display IDs of column-side entities
   * (e.g. TEST-001, COMP-005).
   */
  cells: TraceabilityMatrixCells
}

