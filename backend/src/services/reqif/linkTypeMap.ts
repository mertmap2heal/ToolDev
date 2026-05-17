/**
 * Bidirectional map between ReqIF SPEC-RELATION-TYPE LONG-NAMEs and the
 * `TraceLink.linkType` vocabulary (NX-1).
 *
 * The legacy `reqifParser.ts` collapsed *every* SPEC-RELATION to `'trace'`.
 * NX-1 resolves the relation's SPEC-RELATION-TYPE LONG-NAME onto the existing
 * `TraceLink.linkType` vocabulary so a typed link round-trips, falling back to
 * `'trace'` only when no semantic match exists — and the importer surfaces a
 * warning when it does, so the lossy mapping is visible.
 *
 * `TraceLink.linkType` vocabulary (schema.prisma:671):
 *   satisfies | implements | verifies | derives | refines | copy | trace | allocate
 */

/** The canonical TraceLink link-type vocabulary. */
export const TRACE_LINK_TYPES = [
  'satisfies',
  'implements',
  'verifies',
  'derives',
  'refines',
  'copy',
  'trace',
  'allocate',
] as const

export type TraceLinkType = (typeof TRACE_LINK_TYPES)[number]

/**
 * Synonym table: a normalised (lower-case, non-alphanumeric stripped) token
 * from a ReqIF SPEC-RELATION-TYPE LONG-NAME -> a TraceLink linkType.
 *
 * Covers the standard DOORS / Polarion / Jama relation-type names plus the
 * common OSLC-derived spellings ("satisfiedBy", "verifiedBy", ...).
 */
const SYNONYM_TO_LINK_TYPE: Record<string, TraceLinkType> = {
  // satisfies
  satisfies: 'satisfies',
  satisfiedby: 'satisfies',
  satisfy: 'satisfies',
  satisfaction: 'satisfies',
  // implements
  implements: 'implements',
  implementedby: 'implements',
  implement: 'implements',
  implementation: 'implements',
  realizes: 'implements',
  realises: 'implements',
  // verifies
  verifies: 'verifies',
  verifiedby: 'verifies',
  verify: 'verifies',
  verification: 'verifies',
  validates: 'verifies',
  validatedby: 'verifies',
  tests: 'verifies',
  testedby: 'verifies',
  // derives
  derives: 'derives',
  derivedfrom: 'derives',
  derive: 'derives',
  derivation: 'derives',
  derivedrequirement: 'derives',
  // refines
  refines: 'refines',
  refinedby: 'refines',
  refine: 'refines',
  refinement: 'refines',
  decomposes: 'refines',
  decomposedby: 'refines',
  elaborates: 'refines',
  // copy
  copy: 'copy',
  copyof: 'copy',
  copies: 'copy',
  duplicate: 'copy',
  // allocate
  allocates: 'allocate',
  allocatedto: 'allocate',
  allocate: 'allocate',
  allocation: 'allocate',
  // trace (explicit)
  trace: 'trace',
  traces: 'trace',
  tracedto: 'trace',
  tracedfrom: 'trace',
  relatesto: 'trace',
  related: 'trace',
  reference: 'trace',
  references: 'trace',
}

/** Normalise a LONG-NAME token: lower-case, drop everything non-alphanumeric. */
function normalise(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface LinkTypeResolution {
  /** The resolved TraceLink linkType. */
  linkType: TraceLinkType
  /** True when the resolution fell back to the generic `'trace'`. */
  fellBack: boolean
}

/**
 * Resolve a ReqIF SPEC-RELATION-TYPE LONG-NAME onto the TraceLink vocabulary.
 *
 * - An exact vocabulary word (e.g. "satisfies") maps directly.
 * - A known synonym (e.g. "Satisfied By", "verifiedBy") maps semantically.
 * - Anything unrecognised falls back to `'trace'` with `fellBack: true` so the
 *   caller can warn about the lossy mapping.
 * - An empty / missing LONG-NAME falls back to `'trace'` but does NOT flag
 *   `fellBack` — an untyped relation legitimately has no semantic to lose.
 */
export function resolveLinkType(longName: string | undefined | null): LinkTypeResolution {
  if (!longName || !longName.trim()) {
    return { linkType: 'trace', fellBack: false }
  }
  const key = normalise(longName)
  const direct = SYNONYM_TO_LINK_TYPE[key]
  if (direct) {
    return { linkType: direct, fellBack: direct === 'trace' && key !== 'trace' && !key.startsWith('trace') }
  }
  // Substring scan — handles "Requirement Satisfies Link" style compound names.
  for (const [syn, lt] of Object.entries(SYNONYM_TO_LINK_TYPE)) {
    if (key.includes(syn)) {
      return { linkType: lt, fellBack: false }
    }
  }
  return { linkType: 'trace', fellBack: true }
}

/**
 * The export-direction LONG-NAME for a TraceLink linkType. Used by the
 * serializer to emit a SPEC-RELATION-TYPE per distinct linkType so a re-import
 * of our own export reconstructs the same typed link.
 */
const LINK_TYPE_TO_LONG_NAME: Record<TraceLinkType, string> = {
  satisfies: 'Satisfies',
  implements: 'Implements',
  verifies: 'Verifies',
  derives: 'Derives',
  refines: 'Refines',
  copy: 'Copy',
  trace: 'Trace',
  allocate: 'Allocates',
}

/** The ReqIF SPEC-RELATION-TYPE LONG-NAME to emit for a given linkType. */
export function linkTypeToLongName(linkType: string): string {
  return LINK_TYPE_TO_LONG_NAME[linkType as TraceLinkType] ?? 'Trace'
}

/** A stable SPEC-RELATION-TYPE IDENTIFIER for a given linkType (export side). */
export function linkTypeToRelationTypeId(linkType: string): string {
  const lt = (TRACE_LINK_TYPES as readonly string[]).includes(linkType) ? linkType : 'trace'
  return `RT-${lt.toUpperCase()}`
}
