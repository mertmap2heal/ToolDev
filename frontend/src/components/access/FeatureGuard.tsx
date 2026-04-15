import { type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useFeaturePackage } from '../../contexts/FeaturePackageContext'

interface FeatureGuardProps {
  moduleId: string
  children: ReactNode
}

/**
 * Guards a route behind the active feature package config.
 * If the module is not enabled, redirects silently to the project overview.
 * No "upgrade" prompt is shown — disabled modules are simply absent.
 */
export default function FeatureGuard({ moduleId, children }: FeatureGuardProps) {
  const { isEnabled } = useFeaturePackage()
  const { projectId } = useParams<{ projectId: string }>()

  if (!isEnabled(moduleId)) {
    return <Navigate to={`/projects/${projectId}`} replace />
  }

  return <>{children}</>
}
