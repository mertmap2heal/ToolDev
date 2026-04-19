import type { ReactNode } from 'react'
import { useAiFeature } from '../../contexts/AiFeatureContext'

/**
 * Render children only when all three AI flags clear (global env +
 * per-project toggle + sold package). The wrapper is the single
 * place every AI button / panel should live behind; if any flag
 * flips, every AI affordance disappears.
 *
 * Optional fallback is rendered when AI is off (e.g. a "coming soon"
 * pill for sales-driven tiers). Default: nothing -- invisible when off.
 */
export default function AiFeatureGuard({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const { enabled } = useAiFeature()
  if (!enabled) return <>{fallback}</>
  return <>{children}</>
}
