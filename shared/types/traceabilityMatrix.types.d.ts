export type TraceabilityAxisType = 'requirement' | 'function' | 'parameter' | 'architecture' | 'verification' | string;
export interface TraceabilityMatrixAxisItem {
    id: string;
    key: string;
    label: string;
    type: TraceabilityAxisType;
    /** Optional long description for metadata-rich exports. */
    description?: string;
    /** Optional bag of metadata fields for export (e.g. owner, status). */
    meta?: Record<string, string>;
}
export interface TraceabilityMatrixCellEntry {
    /** Display ID of the column-side entity (e.g. TEST-001). */
    displayId: string;
    /** INCOSE/SysML relationship type (e.g. "verified_by", "satisfies"). */
    linkType: string;
    /** Arrow notation showing direction: "→" (row→col), "←" (col→row), or "↔". */
    arrow: '→' | '←' | '↔';
    /** True when the link is flagged as suspect. */
    isSuspect?: boolean;
}
export interface TraceabilityMatrixCells {
    [rowId: string]: {
        [colId: string]: TraceabilityMatrixCellEntry[];
    };
}
/**
 * Render a cell entry as a human-readable string with relationship arrow.
 * e.g. "→ verified_by" or "← derives_from"
 */
export declare function formatCellEntry(entry: TraceabilityMatrixCellEntry): string;
/**
 * Render all entries in a cell as a single string for export.
 * e.g. "→ verified_by, ← derives_from"
 */
export declare function formatCellEntries(entries: TraceabilityMatrixCellEntry[]): string;
export interface TraceabilityMatrixModel {
    projectId: string;
    rowType: string;
    colType: string;
    rows: TraceabilityMatrixAxisItem[];
    cols: TraceabilityMatrixAxisItem[];
    cells: TraceabilityMatrixCells;
}
//# sourceMappingURL=traceabilityMatrix.types.d.ts.map