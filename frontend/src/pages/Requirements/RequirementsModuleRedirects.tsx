import { Navigate, useParams, useLocation } from 'react-router-dom'

/** Redirects /projects/:projectId/requirements → .../requirements/browse preserving query. */
export function RequirementsModuleRootRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  if (!projectId) return null
  return (
    <Navigate
      to={`/projects/${projectId}/requirements/browse${location.search}`}
      replace
    />
  )
}

/** Redirects legacy .../requirements/traceability-views → .../requirements/traceability */
export function TraceabilityViewsLegacyRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  const location = useLocation()
  if (!projectId) return null
  return (
    <Navigate
      to={`/projects/${projectId}/requirements/traceability${location.search}`}
      replace
    />
  )
}
