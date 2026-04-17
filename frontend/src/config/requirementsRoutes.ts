/** Canonical path segments and helpers for the Requirements module (client-side routing). */

export function requirementsBrowsePath(projectId: string): string {
  return `/projects/${projectId}/requirements/browse`
}

export function requirementsTraceabilityPath(projectId: string): string {
  return `/projects/${projectId}/requirements/traceability`
}
