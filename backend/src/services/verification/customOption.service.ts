export type CustomOptionType =
  | 'ENVIRONMENT_TYPE'
  | 'COMPONENT_TYPE'
  | 'INTERFACE_TYPE'
  | 'PHASE'
  | 'TESTING_TOOL'
  | 'REQUIREMENT_LEVEL'
  | 'RISK'
  | 'COMPLEXITY'
  | 'VERIFICATION_METHOD'
  | 'SOURCE'

export interface CustomOption {
  id: string
  projectId: string
  optionType: CustomOptionType
  value: string
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Capitalizes only the first letter of a string, making the rest lowercase
 * Examples: "BENCH" -> "Bench", "hardware-in-the-loop" -> "Hardware-in-the-loop"
 */
export function capitalizeFirstLetter(value: string): string {
  if (!value || value.length === 0) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

/**
 * Returns system default options for each option type
 * These are marked as isSystem=true and cannot be deleted
 */
export function getSystemDefaults(optionType: CustomOptionType): string[] {
  switch (optionType) {
    case 'ENVIRONMENT_TYPE':
      return ['Bench', 'Hil', 'Sil', 'Ground', 'Flight', 'Other']
    case 'COMPONENT_TYPE':
      return ['Equipment', 'Sensor', 'Dut', 'Power supply', 'Interface', 'Other']
    case 'INTERFACE_TYPE':
      return ['Port', 'Bus', 'Connector', 'Network', 'Other']
    case 'PHASE':
      return ['Srr', 'Pdr', 'Cdr', 'Trr', 'Qualification', 'Certification', 'Other']
    case 'TESTING_TOOL':
      return []
    case 'REQUIREMENT_LEVEL':
      return ['System', 'Subsystem', 'Component', 'Interface']
    case 'RISK':
      return ['Low', 'Medium', 'High', 'Critical']
    case 'COMPLEXITY':
      return ['Simple', 'Moderate', 'Complex']
    case 'VERIFICATION_METHOD':
      return ['Test', 'Analysis', 'Inspection', 'Demonstration', 'Review']
    case 'SOURCE':
      return ['Customer', 'Regulatory', 'Internal', 'Derived', 'Standard']
    default:
      return []
  }
}

/**
 * Normalizes option value for comparison (lowercase, trimmed)
 */
export function normalizeOptionValue(value: string): string {
  return value.trim().toLowerCase()
}
