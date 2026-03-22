import type { EntitySummary } from 'shared/types/linkage.types'
import {
  pbsAdapter,
  interfaceAdapter,
  issueAdapter,
  changeRequestAdapter,
  verificationAdapter,
  hazardAdapter,
  riskAdapter,
  documentAdapter,
  functionAdapter,
  parameterAdapter,
  requirementAdapter,
} from './adapters'

export type LinkageTargetType =
  | 'pbs_component'
  | 'function'
  | 'parameter'
  | 'interface'
  | 'issue'
  | 'change_request'
  | 'test_case'
  | 'hazard'
  | 'risk'
  | 'document'
  | 'requirement'

export const LINKAGE_TARGET_OPTIONS: {
  value: LinkageTargetType
  label: string
  adapter: { search: (q: string, pid: string) => Promise<EntitySummary[]> }
}[] = [
  { value: 'pbs_component', label: 'PBS Components', adapter: pbsAdapter },
  { value: 'function', label: 'Functions', adapter: functionAdapter },
  { value: 'requirement', label: 'Requirements', adapter: requirementAdapter },
  { value: 'parameter', label: 'Parameters', adapter: parameterAdapter },
  { value: 'interface', label: 'Interfaces', adapter: interfaceAdapter },
  { value: 'test_case', label: 'Test Cases', adapter: verificationAdapter },
  { value: 'hazard', label: 'Hazards', adapter: hazardAdapter },
  { value: 'risk', label: 'Risks', adapter: riskAdapter },
  { value: 'document', label: 'Documents', adapter: documentAdapter },
  { value: 'change_request', label: 'Change Requests', adapter: changeRequestAdapter },
  { value: 'issue', label: 'Issues', adapter: issueAdapter },
]

export const LINK_TYPE_MAP: Record<LinkageTargetType, string> = {
  pbs_component: 'allocated_to',
  function: 'allocated_to',
  requirement: 'derives',
  parameter: 'constrains',
  interface: 'related_interface',
  issue: 'tracked_by',
  change_request: 'changes_via',
  test_case: 'verified_by',
  hazard: 'mitigates',
  risk: 'mitigates',
  document: 'documented_in',
}

export function linkageTargetOptionFor(value: LinkageTargetType) {
  return LINKAGE_TARGET_OPTIONS.find((o) => o.value === value)
}
