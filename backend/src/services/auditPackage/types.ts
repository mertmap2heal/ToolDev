// N-2.2 (#425) — types for the opinionated audit-package composer.
//
// `ComposedAuditPackage` is the single structured value the composer emits and
// every renderer (DOCX / PDF / JSON / manifest) consumes. The composer does the
// artefact-graph walk once; the renderers never touch Prisma. Adding SDP / SVP /
// SAS / SCI / SECI is a new `*.sectionMap.ts` over this same structure — the
// graph walk is never duplicated.

/** The regulator artefacts the framework can produce. PSAC is built; the rest are follow-on tickets. */
export type AuditArtefactType = 'PSAC'

/** The set of artefact types the export endpoint accepts today. */
export const SUPPORTED_AUDIT_ARTEFACT_TYPES: readonly AuditArtefactType[] = ['PSAC'] as const

/** One electronic signature in a requirement's chain (R-3 SignatureEvent). */
export interface ComposedSignature {
  id: string
  signerUserId: string
  signerName: string | null
  meaningCode: string
  signedAt: string // ISO
  reauthAt: string // ISO
  contentHash: string
  superseded: boolean
}

/** One evidence artefact referenced by an objective (VerEvidence joined via VerEvidenceLink). */
export interface ComposedEvidence {
  id: string
  evidenceType: string
  title: string
  description: string | null
  storageRef: string
  checksum: string | null
  createdAt: string // ISO
}

/** One requirement satisfying an objective, with its signature chain. */
export interface ComposedRequirement {
  id: string
  requirementKey: string // the display key (requirementId) or the UUID fallback
  title: string
  description: string
  verificationMethod: string | null
  status: string
  /** Distinct PASS/FAIL/... statuses observed on linked VerTestResult rows. */
  testResultStatuses: string[]
  /** Signature chain, oldest-first. Empty where the requirement is unsigned. */
  signatureChain: ComposedSignature[]
}

/** One DO-178C objective, with its satisfying requirements and evidence index. */
export interface ComposedObjective {
  id: string
  objId: string
  regRef: string
  title: string
  moc: string
  status: string
  criticality: string
  notes: string
  requirements: ComposedRequirement[]
  evidence: ComposedEvidence[]
}

/** A certification milestone (CertMilestone) — feeds the PSAC Schedule section. */
export interface ComposedMilestone {
  name: string
  date: string // ISO
  type: string
  status: string
}

/** Aggregate counts from the graph walk — feeds the manifest and the appendix. */
export interface ComposedGraphCounts {
  objectives: number
  objectivesComplete: number
  objectivesPartial: number
  objectivesOpen: number
  requirements: number
  evidence: number
  signatures: number
}

/** The certification context — authority / cert basis / standards. */
export interface ComposedCertContext {
  authority: string
  certBasis: string
  standards: string[]
}

/** The whole composed structure — the renderers' sole input. */
export interface ComposedAuditPackage {
  artefactType: AuditArtefactType
  project: { id: string; name: string; description: string | null }
  certContext: ComposedCertContext
  objectives: ComposedObjective[]
  milestones: ComposedMilestone[]
  counts: ComposedGraphCounts
  composedAt: string // ISO
}

/** A single file inside the bundle, recorded in the manifest. */
export interface ManifestFile {
  name: string
  sha256: string
  bytes: number
}

/** The bundle manifest — written as manifest.json and rendered into PSAC Appendix B. */
export interface PackageManifest {
  artefactType: AuditArtefactType
  project: { id: string; name: string }
  generatedAt: string // ISO
  generatedBy: string // user id or display name
  files: ManifestFile[]
  graphCounts: ComposedGraphCounts
}
