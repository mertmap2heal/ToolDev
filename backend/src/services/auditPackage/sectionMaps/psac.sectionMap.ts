// N-2.2 (#425) — the PSAC section map (the renderer's contract).
//
// The PSAC (Plan for Software Aspects of Certification) is the DO-178C 11.1
// regulator artefact — the planning document submitted at the start of a
// programme. It has a fixed, FAA/EASA-expected section order. The renderers
// (docxRenderer / pdfRenderer / jsonRenderer) emit sections in EXACTLY this
// order and NEVER omit a numbered section: a section with no composed data
// still renders, with its heading + an engineer-voice empty line. A regulator
// reads the PSAC by its fixed structure; a missing section 5 reads as an error.
//
// SDP / SVP / SAS / SCI / SECI are each a sibling `*.sectionMap.ts` in a
// follow-on ticket, reusing the same ComposedAuditPackage and renderers.

/** A logical PSAC section. `kind` drives which composed data the renderer pulls. */
export interface PsacSection {
  /** Display number as it appears in the document ('' for front matter). */
  number: string
  /** Section heading. */
  title: string
  /** One-line description of the section's purpose (rendered as a sub-line). */
  description: string
  /**
   * Stable key naming the renderer behaviour for this section. The renderer
   * switches on this to pull the right slice of ComposedAuditPackage.
   */
  kind: PsacSectionKind
}

export type PsacSectionKind =
  | 'titlePage'
  | 'introduction'
  | 'systemOverview'
  | 'softwareOverview'
  | 'certificationConsiderations'
  | 'certificationBasis'
  | 'softwareLevel'
  | 'softwareLifeCycle'
  | 'softwareLifeCycleData' // section 4 — the objective-satisfaction table
  | 'evidenceIndex'
  | 'schedule'
  | 'additionalConsiderations'
  | 'objectiveSatisfactionSummary' // Appendix A
  | 'packageManifest' // Appendix B

/**
 * The 14 PSAC sections, in regulator-expected order. The renderer iterates this
 * array start-to-finish — the array IS the document structure.
 */
export const PSAC_SECTION_MAP: readonly PsacSection[] = [
  {
    number: '',
    title: 'Title Page & Document Control',
    description:
      'Document title, project, applicant, authority, PSAC revision, generated-at, generated-by, status.',
    kind: 'titlePage',
  },
  {
    number: '1',
    title: 'Introduction',
    description:
      'Purpose of the PSAC, scope, the system it covers, and the intended certification authority.',
    kind: 'introduction',
  },
  {
    number: '1.1',
    title: 'System Overview',
    description:
      'The aircraft or system context — what the system does and where the software sits in it.',
    kind: 'systemOverview',
  },
  {
    number: '1.2',
    title: 'Software Overview',
    description:
      'The software function, architecture, partitioning, and the major components this plan covers.',
    kind: 'softwareOverview',
  },
  {
    number: '2',
    title: 'Certification Considerations',
    description:
      'The certification basis — the regulatory means of compliance, the software level, and the level rationale.',
    kind: 'certificationConsiderations',
  },
  {
    number: '2.1',
    title: 'Certification Basis',
    description:
      'The specific regulations and the means of compliance per objective — the explicit certification-basis statement.',
    kind: 'certificationBasis',
  },
  {
    number: '2.2',
    title: 'Software Level (DAL)',
    description:
      'The assigned Development Assurance Level and the failure-condition rationale that drives it.',
    kind: 'softwareLevel',
  },
  {
    number: '3',
    title: 'Software Life Cycle',
    description:
      'The life-cycle processes the applicant will follow and their transition criteria.',
    kind: 'softwareLifeCycle',
  },
  {
    number: '4',
    title: 'Software Life Cycle Data',
    description:
      'The objective-satisfaction table — every applicable objective, its MoC, satisfying requirements, signature chains, and linked evidence.',
    kind: 'softwareLifeCycleData',
  },
  {
    number: '4.1',
    title: 'Evidence Index',
    description:
      'The catalogue of every life-cycle data item referenced by section 4 — id, type, source, supported objective.',
    kind: 'evidenceIndex',
  },
  {
    number: '5',
    title: 'Schedule',
    description:
      'The certification milestones, review points, and the planned authority-engagement schedule.',
    kind: 'schedule',
  },
  {
    number: '6',
    title: 'Additional Considerations',
    description:
      'Previously-developed software, COTS, tool qualification, alternative methods, and deviations.',
    kind: 'additionalConsiderations',
  },
  {
    number: 'Appendix A',
    title: 'Objective Satisfaction Summary',
    description:
      'A condensed pass / partial / open completion table across all objectives — the at-a-glance readiness view.',
    kind: 'objectiveSatisfactionSummary',
  },
  {
    number: 'Appendix B',
    title: 'Package Manifest',
    description:
      'The bundle manifest — every file, per-file sha256, the composed-graph counts, and generated-at/by.',
    kind: 'packageManifest',
  },
] as const

/** Heading line — '4. Software Life Cycle Data' or 'Appendix A — Objective Satisfaction Summary'. */
export function psacHeading(section: PsacSection): string {
  if (!section.number) return section.title
  if (section.number.startsWith('Appendix')) return `${section.number} — ${section.title}`
  return `${section.number}. ${section.title}`
}
