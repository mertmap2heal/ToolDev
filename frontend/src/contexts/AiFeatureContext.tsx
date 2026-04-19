import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../services/api'
import { useFeaturePackage } from './FeaturePackageContext'

/**
 * AI feature-flag hierarchy (ai-ready-vision.md §5, plan §7).
 *
 *   enabled = globalEnabled AND projectEnabled AND packageEnabled
 *
 * globalEnabled   - driven by the backend env FEATURES_AI_ENABLED;
 *                   surfaced via GET /parameters/:projectId/ai/ping
 *                   (200 = on; 403 AI_DISABLED_GLOBAL = off).
 * projectEnabled  - Project.aiEnabled, read from the same probe
 *                   (403 AI_DISABLED_PROJECT = off).
 * packageEnabled  - frontend package config lists the "ai" module.
 *
 * Any layer false => nothing AI renders. The UI never teases a feature
 * the user cannot use.
 */
interface AiFeatureContextType {
  enabled: boolean
  globalEnabled: boolean
  projectEnabled: boolean
  packageEnabled: boolean
  loading: boolean
  error: string | null
}

const AiFeatureContext = createContext<AiFeatureContextType | null>(null)

export function AiFeatureProvider({
  projectId,
  children,
}: {
  projectId: string | null
  children: ReactNode
}) {
  const { isEnabled } = useFeaturePackage()
  const packageEnabled = isEnabled('ai')

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-feature-flag', projectId],
    queryFn: async () => {
      if (!projectId) return { success: false, code: 'AI_MISSING_PROJECT_ID' }
      return apiClient.get<{ projectId: string; userId: string; ts: number }>(
        `/parameters/${projectId}/ai/ping`,
      )
    },
    enabled: !!projectId && packageEnabled,
    staleTime: 30_000,
    retry: false,
  })

  const state = useMemo<AiFeatureContextType>(() => {
    if (!packageEnabled) {
      return {
        enabled: false,
        globalEnabled: false,
        projectEnabled: false,
        packageEnabled: false,
        loading: false,
        error: null,
      }
    }
    if (isLoading) {
      return {
        enabled: false,
        globalEnabled: false,
        projectEnabled: false,
        packageEnabled,
        loading: true,
        error: null,
      }
    }
    if (!data) {
      return {
        enabled: false,
        globalEnabled: false,
        projectEnabled: false,
        packageEnabled,
        loading: false,
        error: error ? String(error) : null,
      }
    }
    if (data.success) {
      return {
        enabled: true,
        globalEnabled: true,
        projectEnabled: true,
        packageEnabled,
        loading: false,
        error: null,
      }
    }
    if (data.code === 'AI_DISABLED_PROJECT') {
      return {
        enabled: false,
        globalEnabled: true,
        projectEnabled: false,
        packageEnabled,
        loading: false,
        error: null,
      }
    }
    // Global disabled / project not found / any other failure -> treat as
    // completely off.
    return {
      enabled: false,
      globalEnabled: false,
      projectEnabled: false,
      packageEnabled,
      loading: false,
      error: null,
    }
  }, [data, isLoading, error, packageEnabled])

  return <AiFeatureContext.Provider value={state}>{children}</AiFeatureContext.Provider>
}

export function useAiFeature(): AiFeatureContextType {
  const ctx = useContext(AiFeatureContext)
  if (!ctx) {
    // Graceful fallback: components using the hook outside a provider
    // simply see AI as off rather than crashing.
    return {
      enabled: false,
      globalEnabled: false,
      projectEnabled: false,
      packageEnabled: false,
      loading: false,
      error: null,
    }
  }
  return ctx
}
