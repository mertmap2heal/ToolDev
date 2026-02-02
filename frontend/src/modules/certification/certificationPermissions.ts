import type { CertificationState } from './store'
import type { CertRole } from './types'

const ROLE_PERMISSIONS: Record<CertRole, Record<string, boolean>> = {
  CertificationManager: {
    createFinding: true,
    closeFinding: true,
    generatePackage: true,
    editObjectiveStatus: true,
    startReview: true,
    closeReview: true,
  },
  ComplianceEngineer: {
    createFinding: true,
    closeFinding: true,
    generatePackage: false,
    editObjectiveStatus: true,
    startReview: true,
    closeReview: false,
  },
  SystemEngineer: {
    createFinding: true,
    closeFinding: false,
    generatePackage: false,
    editObjectiveStatus: true,
    startReview: false,
    closeReview: false,
  },
  VerificationEngineer: {
    createFinding: true,
    closeFinding: false,
    generatePackage: false,
    editObjectiveStatus: true,
    startReview: true,
    closeReview: false,
  },
  SafetyEngineer: {
    createFinding: true,
    closeFinding: false,
    generatePackage: false,
    editObjectiveStatus: true,
    startReview: false,
    closeReview: false,
  },
  Auditor: {
    createFinding: false,
    closeFinding: false,
    generatePackage: false,
    editObjectiveStatus: false,
    startReview: false,
    closeReview: false,
  },
}

function can(state: CertificationState, action: keyof (typeof ROLE_PERMISSIONS)[CertRole]): boolean {
  if (state.readOnlyMode) return false
  const rolePerms = ROLE_PERMISSIONS[state.role]
  return rolePerms[action] === true
}

export function isReadOnly(state: CertificationState): boolean {
  return state.readOnlyMode || state.role === 'Auditor'
}

export function canCreateFinding(state: CertificationState): boolean {
  return can(state, 'createFinding')
}

export function canCloseFinding(state: CertificationState): boolean {
  return can(state, 'closeFinding')
}

export function canGeneratePackage(state: CertificationState): boolean {
  return can(state, 'generatePackage')
}

export function canEditObjectiveStatus(state: CertificationState): boolean {
  return can(state, 'editObjectiveStatus')
}

export function canStartReview(state: CertificationState): boolean {
  return can(state, 'startReview')
}

export function canCloseReview(state: CertificationState): boolean {
  return can(state, 'closeReview')
}
