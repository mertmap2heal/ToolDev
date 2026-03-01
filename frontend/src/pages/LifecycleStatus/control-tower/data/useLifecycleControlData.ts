/**
 * ============================================================================
 * LIFECYCLE CONTROL TOWER — DATA HOOK
 * ============================================================================
 *
 * Isolated React Query hooks for the Lifecycle Control Tower.
 * Falls back to mock data when backend endpoints are not yet available.
 *
 * Aviation: All data fetching is wrapped in error boundaries with
 * fallback indicators so the dashboard never shows stale/incorrect
 * data without the operator knowing.
 * ============================================================================
 */

import { useQuery } from '@tanstack/react-query'
import { lifecycleControlService } from '../../../../services/lifecycleControl.service'
import {
  generateMockOverview,
  generateMockTrends,
  generateMockHeatmap,
  generateMockFunctionHealth,
  generateMockPBSHealth,
  generateMockTraceability,
  generateMockSlaBreaches,
  generateMockAnomalies,
  generateMockIntegrityViolations,
  generateMockReadiness,
  generateMockPendingApprovals,
  generateMockAuditEvents,
  generateMockBenchmarks,
} from './mockDataGenerator'

/** Stale time for dashboard data (30 seconds) */
const STALE_TIME = 30_000

/**
 * Helper: try the real API first, fallback to mock on failure.
 * Returns { data, isMock } so the UI can show a "mock data" indicator.
 */
async function withMockFallback<T>(
  apiFn: () => Promise<{ success: boolean; data?: T; error?: string }>,
  mockFn: () => T
): Promise<{ data: T; isMock: boolean }> {
  try {
    const res = await apiFn()
    if (res.success && res.data) {
      return { data: res.data, isMock: false }
    }
  } catch {
    // API not available — fall through to mock
  }
  return { data: mockFn(), isMock: true }
}

// ---------------------------------------------------------------------------
// HOOKS
// ---------------------------------------------------------------------------

export function useControlTowerOverview(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-overview', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getOverview(projectId!),
        generateMockOverview
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
    refetchInterval: 60_000,
  })
}

export function useControlTowerTrends(projectId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: ['control-tower-trends', projectId, days],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getTrends(projectId!, { days }),
        () => generateMockTrends(days)
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME * 2,
  })
}

export function useControlTowerHeatmap(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-heatmap', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getHeatmap(projectId!),
        generateMockHeatmap
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME * 2,
  })
}

export function useFunctionHealth(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-function-health', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getFunctionHealth(projectId!),
        generateMockFunctionHealth
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function usePBSHealth(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-pbs-health', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getPBSHealth(projectId!),
        generateMockPBSHealth
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function useTraceabilityTable(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-traceability', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getTraceabilityTable(projectId!).then(r => ({
          success: r.success,
          data: r.data?.data,
          error: r.error,
        })) as any,
        () => generateMockTraceability(50)
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function useSlaBreaches(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-sla-breaches', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getSlaBreaches(projectId!),
        generateMockSlaBreaches
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function useAnomalies(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-anomalies', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getAnomalies(projectId!),
        generateMockAnomalies
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function useIntegrityViolations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-integrity', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getIntegrityViolations(projectId!),
        generateMockIntegrityViolations
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function useReadinessScore(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-readiness', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getReadinessScore(projectId!),
        generateMockReadiness
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function usePendingApprovals(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-pending-approvals', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getPendingApprovals(projectId!),
        generateMockPendingApprovals
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function useAuditTrail(projectId: string | undefined) {
  return useQuery({
    queryKey: ['control-tower-audit', projectId],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getAuditTrail(projectId!).then(r => ({
          success: r.success,
          data: r.data?.data,
          error: r.error,
        })) as any,
        generateMockAuditEvents
      ),
    enabled: !!projectId,
    staleTime: STALE_TIME,
  })
}

export function useBenchmarks() {
  return useQuery({
    queryKey: ['control-tower-benchmarks'],
    queryFn: () =>
      withMockFallback(
        () => lifecycleControlService.getBenchmarks(),
        generateMockBenchmarks
      ),
    staleTime: STALE_TIME * 4,
  })
}
