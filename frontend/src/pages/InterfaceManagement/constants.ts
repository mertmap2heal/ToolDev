import type { InterfaceType, InterfaceStatus } from './mockInterfaces'

export const INTERFACE_TYPES: InterfaceType[] = ['Physical', 'Electrical', 'Data', 'Software', 'HMI']
export const INTERFACE_STATUSES: InterfaceStatus[] = ['Draft', 'Frozen', 'Released']

export const ARTIFACT_ROUTES: Record<string, string | null> = {
  Requirements: 'requirements',
  Functions: 'functions',
  'PBS Elements': 'product-breakdown-structure',
  'MBSE Models': 'mbse-models',
  Verification: 'verification',
  Issues: 'issues',
  'Change Requests': 'change-requests',
  'Configuration Management': 'configuration-management',
  Reports: 'reports',
  'Configuration baseline': null,
}

export const MOCK_ARTIFACT_COUNTS: Record<string, number> = {
  Requirements: 3,
  Functions: 2,
  'PBS Elements': 1,
  'MBSE Models': 2,
  Verification: 1,
  Issues: 0,
  'Change Requests': 1,
  'Configuration Management': 1,
  Reports: 0,
  'Configuration baseline': 0,
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Released':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'Frozen':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Draft':
    default:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
  }
}
