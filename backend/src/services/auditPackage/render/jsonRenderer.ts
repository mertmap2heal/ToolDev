// N-2.2 (#425) — the PSAC JSON renderer.
//
// Emits the machine-readable form of the PSAC, keyed by section number, 1:1
// with the Word/PDF structure. A consumer can read PSAC.json and reconstruct
// the same 14-section document. A section with no composed data is still
// present, carrying its `empty` reason — the structure is never truncated.
import type { ComposedAuditPackage, PackageManifest } from '../types'
import { buildPsacRenderSections } from './psacContent'

/**
 * Render the PSAC as a JSON buffer. The `sections` array is the same ordered
 * 14-section structure the DOCX/PDF render; `composed` is the full graph for a
 * consumer that wants the raw composed data.
 */
export function renderPsacJson(
  composed: ComposedAuditPackage,
  manifest: PackageManifest,
): Buffer {
  const sections = buildPsacRenderSections(composed, manifest)
  const payload = {
    artefactType: composed.artefactType,
    project: composed.project,
    certContext: composed.certContext,
    composedAt: composed.composedAt,
    counts: composed.counts,
    sections: sections.map((s) => ({
      number: s.number,
      title: s.title,
      heading: s.heading,
      description: s.description,
      blocks: s.blocks,
    })),
    objectives: composed.objectives,
    milestones: composed.milestones,
  }
  return Buffer.from(JSON.stringify(payload, null, 2), 'utf8')
}
