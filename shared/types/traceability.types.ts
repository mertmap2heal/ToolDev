export type ArtifactType =
  | 'requirement'
  | 'function'
  | 'parameter'
  | 'architecture'
  | 'verification'

export type LinkType =
  | 'satisfies'
  | 'implements'
  | 'verifies'
  | 'derives'
  | 'refines'
  | 'copy'
  | 'trace'
  | 'allocate'
  | 'parent_of'
  | 'child_of'
  | 'derives_from'
  | 'derived_to'
  | 'refined_by'
  | 'depends_on'
  | 'required_by'
  | 'constrains'
  | 'constrained_by'
  | 'conflicts_with'
  | 'supports'
  | 'supported_by'
  | 'supersedes'
  | 'superseded_by'

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
