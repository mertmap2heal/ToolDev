import type { EntityRef } from 'shared/types/linkage.types'
import { pbsAdapter } from './adapters/pbsAdapter'
import { interfaceAdapter } from './adapters/interfaceAdapter'
import { issueAdapter } from './adapters/issueAdapter'
import { changeRequestAdapter } from './adapters/changeRequestAdapter'
import { taskAdapter } from './adapters/taskAdapter'
import { verificationAdapter } from './adapters/verificationAdapter'
import { hazardAdapter } from './adapters/hazardAdapter'
import { riskAdapter } from './adapters/riskAdapter'
import { documentAdapter } from './adapters/documentAdapter'
import { stakeholderAdapter } from './adapters/stakeholderAdapter'
import { cmAdapter } from './adapters/cmAdapter'
import { complianceAdapter } from './adapters/complianceAdapter'
import { certificationAdapter } from './adapters/certificationAdapter'
import { archiveAdapter } from './adapters/archiveAdapter'
import { functionAdapter } from './adapters/functionAdapter'

const ADAPTER_MAP: Record<string, { buildDeepLink: (projectId: string, ref: EntityRef) => string }> = {
  function: functionAdapter,
  pbs_component: pbsAdapter,
  interface: interfaceAdapter,
  issue: issueAdapter,
  task: taskAdapter,
  change_request: changeRequestAdapter,
  test_plan: verificationAdapter,
  test_case: verificationAdapter,
  test_result: verificationAdapter,
  hazard: hazardAdapter,
  risk: riskAdapter,
  document: documentAdapter,
  evidence_pack: documentAdapter,
  ci: cmAdapter,
  baseline: cmAdapter,
  release: cmAdapter,
  deviation_waiver: cmAdapter,
  compliance_rule: complianceAdapter,
  compliance_run: complianceAdapter,
  compliance_finding: complianceAdapter,
  cert_objective: certificationAdapter,
  cert_moc: certificationAdapter,
  cert_evidence_index_item: certificationAdapter,
  stakeholder: stakeholderAdapter,
  requirement: {
    buildDeepLink: (projectId, ref) =>
      `/projects/${projectId}/requirements?focusType=requirement&focusId=${ref.id}`,
  },
}

/**
 * Build a deep link URL to open the target page with the entity in focus.
 */
export function buildDeepLink(projectId: string, ref: EntityRef): string {
  const adapter = ADAPTER_MAP[ref.type]
  if (adapter) {
    return adapter.buildDeepLink(projectId, ref)
  }
  return `/projects/${projectId}`
}
