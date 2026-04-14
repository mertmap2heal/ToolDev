import coreJson from './packages/core.json'
import advancedJson from './packages/advanced.json'
import completeJson from './packages/complete.json'

export type PackageId = 'core' | 'advanced' | 'complete'

export interface PackageConfig {
  name: string
  modules: string[]
}

export const PACKAGE_CONFIGS: Record<PackageId, PackageConfig> = {
  core: coreJson,
  advanced: advancedJson,
  complete: completeJson,
}

export const PACKAGE_ORDER: PackageId[] = ['core', 'advanced', 'complete']

export function getPackageConfig(id: PackageId): PackageConfig {
  return PACKAGE_CONFIGS[id]
}

/** Returns the lowest-tier package that includes the given module, or null if none. */
export function getMinPackageForModule(moduleId: string): PackageId | null {
  return PACKAGE_ORDER.find(pkg => PACKAGE_CONFIGS[pkg].modules.includes(moduleId)) ?? null
}
