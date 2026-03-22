/**
 * Render a cell entry as a human-readable string with relationship arrow.
 * e.g. "→ verified_by" or "← derives_from"
 */
export function formatCellEntry(entry) {
    return `${entry.arrow} ${entry.linkType}${entry.isSuspect ? ' (?)' : ''}`;
}
/**
 * Render all entries in a cell as a single string for export.
 * e.g. "→ verified_by, ← derives_from"
 */
export function formatCellEntries(entries) {
    return entries.map(formatCellEntry).join(', ');
}
//# sourceMappingURL=traceabilityMatrix.types.js.map