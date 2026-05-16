// N-2.2 (#425) — the audit-package manifest builder.
//
// Builds the PackageManifest: project, artefact type, generated-at/by, a
// per-file sha256 + byte count, and the composed-graph counts. The manifest is
// written as manifest.json AND rendered into PSAC Appendix B.
import { createHash } from 'crypto'
import type {
  ComposedAuditPackage,
  ManifestFile,
  PackageManifest,
} from '../types'

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** Describe one bundle file (name + content) as a ManifestFile. */
export function manifestFileOf(name: string, content: Buffer): ManifestFile {
  return { name, sha256: sha256(content), bytes: content.byteLength }
}

/**
 * Build the manifest from the composed package and the list of files that will
 * go in the bundle (manifest.json itself is not in the list — it cannot hash
 * itself).
 */
export function buildManifest(
  composed: ComposedAuditPackage,
  generatedBy: string,
  files: ManifestFile[],
): PackageManifest {
  return {
    artefactType: composed.artefactType,
    project: { id: composed.project.id, name: composed.project.name },
    generatedAt: new Date().toISOString(),
    generatedBy,
    files,
    graphCounts: composed.counts,
  }
}
