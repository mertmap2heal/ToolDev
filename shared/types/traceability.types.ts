export type ArtifactType =
  | 'requirement'
  | 'function'
  | 'parameter'
  | 'architecture'
  | 'verification'

export type LinkType =
  | 'satisfies'
  | 'satisfied_by'
  | 'implements'
  | 'implemented_by'
  | 'verifies'
  | 'verified_by'
  | 'derives'
  | 'derived_from' // SysML: deriveReqt (source is derived from target)
  | 'derived_to'   // Inverse of derived_from
  | 'refines'
  | 'refined_by'
  | 'copy'
  | 'copied_from'
  | 'trace'
  | 'traced_from' // Inverse of trace
  | 'traced_to'
  | 'allocate'
  | 'allocated_to'
  | 'parent_of'
  | 'child_of'
  | 'depends_on'
  | 'required_by'
  | 'constrains'
  | 'constrained_by'
  | 'conflicts_with'
  | 'mitigates'      // ARP4754A Safety
  | 'mitigated_by'
  | 'supports'
  | 'supported_by'
  | 'supersedes'
  | 'superseded_by'
  | 'related_to'

export interface TraceLink {
  id: string
  projectId: string
  sourceType: ArtifactType
  sourceId: string
  targetType: ArtifactType
  targetId: string
  linkType: LinkType
  direction?: string // source → target relationship direction (for clarity)
  rationale?: string // why this relationship exists
  confidence?: number
  isAuto: boolean
  isSuspect?: boolean
  lastChecked?: string
  createdAt: string
  targetTitle?: string
  targetDescription?: string
  targetDisplayId?: string
  sourceTitle?: string
  sourceDescription?: string
  sourceDisplayId?: string
}

export interface CreateTraceLinkDto {
  sourceType: ArtifactType
  sourceId: string
  targetType: ArtifactType
  targetId: string
  linkType: LinkType
  direction?: string
  rationale?: string
}

export interface TraceabilityGraph {
  nodes: TraceabilityNode[]
  edges: TraceabilityEdge[]
}

export interface TraceabilityNode {
  id: string
  type: ArtifactType
  label: string
  data: any
}

export interface TraceabilityEdge {
  id: string
  source: string
  target: string
  type: LinkType
  confidence?: number
}
