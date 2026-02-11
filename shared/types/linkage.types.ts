/**
 * Enterprise linkage types for Requirements module.
 * Excludes function and parameter per spec.
 */

export type EntityType =
  | 'requirement'
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
  | 'implements'
  | 'verifies'
  | 'derives'
  | 'refines'
  | 'trace'
  | 'allocate'

export type LinkStatus = 'active' | 'suspect' | 'removed'

export interface Link {
  id: string
  projectId: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  linkType: string
  status: LinkStatus
  rationale?: string
  createdBy?: string
  createdAt: string
  updatedBy?: string
  updatedAt?: string
  isSuspect?: boolean
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
  rationale?: string
}

export interface LinkFilters {
  sourceType?: string
  targetType?: string
  status?: LinkStatus
  sourceId?: string
  targetId?: string
}
