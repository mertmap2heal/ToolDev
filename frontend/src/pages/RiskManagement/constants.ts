import type { RiskType, AffectedArea, RiskStatus, Classification } from './types'

export const RISK_TYPES: RiskType[] = ['Program', 'Technical', 'Safety', 'Compliance', 'Supplier']
export const AFFECTED_AREAS: AffectedArea[] = ['Subsystem', 'Interface', 'Requirement', 'Program']
export const RISK_STATUSES: RiskStatus[] = ['Open', 'Mitigating', 'Watch', 'Closed', 'Accepted']
export const CLASSIFICATIONS: Classification[] = ['Low', 'Medium', 'High', 'Critical']

export const ARTIFACT_ROUTES: Record<string, string | null> = {
  Requirements: 'requirements',
  Interfaces: 'interface-management',
  Issues: 'issues',
  'Change Requests': 'change-requests',
  'Verification Activities': 'verification',
  'Configuration Baseline': null,
}

export const MOCK_ARTIFACT_COUNTS: Record<string, number> = {
  Requirements: 2,
  Interfaces: 1,
  Issues: 0,
  'Change Requests': 1,
  'Verification Activities': 1,
  'Configuration Baseline': 0,
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Open':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'Mitigating':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Watch':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'Closed':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'Accepted':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getClassificationColor(classification: string): string {
  switch (classification) {
    case 'Critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'High':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
    case 'Medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'Low':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function exposureToClassification(likelihood: number, impact: number): Classification {
  const exposure = likelihood * impact
  if (exposure >= 20) return 'Critical'
  if (exposure >= 12) return 'High'
  if (exposure >= 6) return 'Medium'
  return 'Low'
}
