import type { StakeholderRole } from './types'

export function canEditStakeholders(role: StakeholderRole, readOnlyMode: boolean): boolean {
  if (readOnlyMode) return false
  return role === 'Admin' || role === 'ProgramManager' || role === 'Engineer'
}

export function canEditGovernance(role: StakeholderRole, strictMode: boolean, readOnlyMode: boolean): boolean {
  if (readOnlyMode) return false
  if (strictMode) return role === 'Admin' || role === 'ProgramManager'
  return role !== 'Auditor'
}

export function canEditAny(role: StakeholderRole, readOnlyMode: boolean): boolean {
  if (readOnlyMode) return false
  return role !== 'Auditor'
}
