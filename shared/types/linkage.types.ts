/**
 * Enterprise linkage types for Requirements module.
 * Now includes function for full cross-module traceability.
 */

export type EntityType =
  | 'requirement'
  | 'function'
  | 'parameter'
  | 'pbs_component'
  | 'interface'
  | 'issue'
  | 'task'
  | 'change_request'
  | 'test_plan'
  | 'test_case'
  | 'test_result'
  | 'validation_plan'
  | 'validation_case'
  | 'validation_result'
  | 'hazard'
  | 'safety_requirement'
  | 'safety_analysis'
  | 'safety_evidence'
  | 'risk'
  | 'document'
  | 'evidence_pack'
  | 'ci'
  | 'baseline'
  | 'release'
  | 'deviation_waiver'
  | 'compliance_rule'
  | 'compliance_run'
  | 'compliance_finding'
  | 'cert_objective'
  | 'cert_moc'
  | 'cert_evidence_index_item'
  | 'stakeholder'
  | 'user_group'
  | 'lifecycle'
  | 'lifecycle_status'
  | 'verification'
  | 'architecture'

export interface EntityRef {
  type: EntityType
  id: string
}

export type LinkType =
  | 'derived_from'
  | 'allocated_to'
  | 'related_interface'
  | 'implemented_by'
  | 'verified_by'
  | 'validated_by'
  | 'mitigates'
  | 'mitigated_by'
  | 'documented_in'
  | 'changes_via'
  | 'tracked_by'
  | 'complies_with'
  | 'cert_objective'
  | 'archived_as'
  // Legacy compatibility
  | 'satisfies'
  | 'satisfied_by'
  | 'implements'
  | 'verifies'
  | 'derives'
  | 'refines'
  | 'trace'
  | 'allocate'
  | 'copy'
  | 'copied_from'
  | 'derived_to'
  | 'refined_by'
  | 'traced_from'
  | 'traced_to'
  | 'parent_of'
  | 'child_of'
  | 'depends_on'
  | 'required_by'
  | 'constrains'
  | 'constrained_by'
  | 'conflicts_with'
  | 'supports'
  | 'supported_by'
  | 'supersedes'
  | 'superseded_by'
  | 'related_to'

export type LinkStatus = 'active' | 'suspect' | 'removed'

export interface Link {
  id: string
  projectId: string
  sourceType: EntityType
  sourceId: string
  targetType: EntityType
  targetId: string
  linkType: LinkType
  status: 'active' | 'suspect'
  rationale?: string
  createdAt: string
  isSuspect?: boolean
  targetTitle?: string
  targetDescription?: string
  targetDisplayId?: string
  targetLabel?: string
  sourceTitle?: string
  sourceDescription?: string
  sourceDisplayId?: string
  sourceLabel?: string
}

export interface EntitySummary {
  id: string
  type: EntityType
  label: string
  description?: string
}

export interface CreateLinkDto {
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  linkType: string
  direction?: string
  rationale?: string
}

export interface LinkFilters {
  sourceType?: string
  targetType?: string
  status?: LinkStatus
  sourceId?: string
  targetId?: string
}
