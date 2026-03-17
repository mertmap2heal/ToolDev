/**
 * ============================================================================
 * LIFECYCLE CONTROL TOWER — FRONTEND API SERVICE
 * ============================================================================
 *
 * Isolated service for the Lifecycle Control Tower.
 * Does NOT import from lifecycle.service.ts or any Zustand store.
 *
 * Pattern: mirrors compliance.service.ts and certification.service.ts.
 * Uses React Query compatible return types (ApiResponse<T>).
 *
 * Aviation: All mutating endpoints include actor + rationale metadata
 * to satisfy audit trail requirements (DO-178C, EN9100).
 * ============================================================================
 */

import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'
import type {
  ControlTowerOverview,
  EntityTrend,
  HeatmapCell,
  EntityHealthSummary,
  TraceabilityRow,
  TransitionRequest,
  TransitionResult,
  ApprovalRecord,
  SlaRule,
  SlaBreach,
  LifecycleAnomaly,
  IntegrityViolation,
  ReadinessScore,
  SimulationRequest,
  SimulationResult,
  LifecycleAuditEvent,
  ControlTowerFilters,
  PlaybookAction,
  BenchmarkSnapshot,
} from '../pages/LifecycleStatus/control-tower/types/contracts'

const BASE = '/lifecycle/control-tower'

/**
 * Lifecycle Control Tower API service.
 * All endpoints are prefixed with /api/v1/lifecycle/control-tower.
 */
export const lifecycleControlService = {
  // -------------------------------------------------------------------------
  // OVERVIEW & MONITORING
  // -------------------------------------------------------------------------

  /** Get the global overview snapshot (KPIs, distributions, health) */
  async getOverview(projectId: string): Promise<ApiResponse<ControlTowerOverview>> {
    return apiClient.get<ControlTowerOverview>(`${BASE}/${projectId}/overview`)
  },

  /** Get trend data over a time range for one or more entity types */
  async getTrends(
    projectId: string,
    params?: { entityTypes?: string[]; days?: number }
  ): Promise<ApiResponse<EntityTrend[]>> {
    const q = new URLSearchParams()
    if (params?.entityTypes) q.set('entityTypes', params.entityTypes.join(','))
    if (params?.days) q.set('days', String(params.days))
    const query = q.toString()
    return apiClient.get<EntityTrend[]>(`${BASE}/${projectId}/trends${query ? `?${query}` : ''}`)
  },

  /** Get heatmap data (bottleneck analysis) */
  async getHeatmap(projectId: string): Promise<ApiResponse<HeatmapCell[]>> {
    return apiClient.get<HeatmapCell[]>(`${BASE}/${projectId}/heatmap`)
  },

  // -------------------------------------------------------------------------
  // FUNCTION & PBS HEALTH
  // -------------------------------------------------------------------------

  /** Get health summaries for Functions */
  async getFunctionHealth(
    projectId: string,
    filters?: ControlTowerFilters
  ): Promise<ApiResponse<EntityHealthSummary[]>> {
    const q = this._buildFilterParams(filters)
    return apiClient.get<EntityHealthSummary[]>(
      `${BASE}/${projectId}/health/functions${q ? `?${q}` : ''}`
    )
  },

  /** Get health summaries for PBS Components */
  async getPBSHealth(
    projectId: string,
    filters?: ControlTowerFilters
  ): Promise<ApiResponse<EntityHealthSummary[]>> {
    const q = this._buildFilterParams(filters)
    return apiClient.get<EntityHealthSummary[]>(
      `${BASE}/${projectId}/health/pbs${q ? `?${q}` : ''}`
    )
  },

  // -------------------------------------------------------------------------
  // TRACEABILITY
  // -------------------------------------------------------------------------

  /** Get traceability propagation table */
  async getTraceabilityTable(
    projectId: string,
    filters?: ControlTowerFilters
  ): Promise<ApiResponse<{ data: TraceabilityRow[]; total: number }>> {
    const q = this._buildFilterParams(filters)
    return apiClient.get<{ data: TraceabilityRow[]; total: number }>(
      `${BASE}/${projectId}/traceability${q ? `?${q}` : ''}`
    )
  },

  // -------------------------------------------------------------------------
  // GOVERNANCE & TRANSITIONS
  // -------------------------------------------------------------------------

  /**
   * Evaluate a single transition (dry-run policy check).
   * Aviation: Returns explainable policy trace for audit.
   */
  async evaluateTransition(
    projectId: string,
    request: TransitionRequest
  ): Promise<ApiResponse<TransitionResult>> {
    return apiClient.post<TransitionResult>(
      `${BASE}/${projectId}/transitions/evaluate`,
      request
    )
  },

  /**
   * Execute a batch of transitions.
   * Aviation: Each transition is individually audited.
   */
  async executeBatchTransition(
    projectId: string,
    request: { transitions: TransitionRequest[]; batchRationale: string }
  ): Promise<ApiResponse<{ succeeded: number; failed: number; results: TransitionResult[] }>> {
    return apiClient.post<{ succeeded: number; failed: number; results: TransitionResult[] }>(
      `${BASE}/${projectId}/transitions/batch`,
      request
    )
  },

  // -------------------------------------------------------------------------
  // APPROVALS & SIGNATURES
  // -------------------------------------------------------------------------

  /** Request approval for a transition */
  async requestApproval(
    projectId: string,
    request: TransitionRequest
  ): Promise<ApiResponse<ApprovalRecord>> {
    return apiClient.post<ApprovalRecord>(
      `${BASE}/${projectId}/approvals/request`,
      request
    )
  },

  /** Get pending approvals */
  async getPendingApprovals(projectId: string): Promise<ApiResponse<ApprovalRecord[]>> {
    return apiClient.get<ApprovalRecord[]>(`${BASE}/${projectId}/approvals/pending`)
  },

  /**
   * Submit an approval decision.
   * TODO: Integrate e-signature provider for Released transitions.
   * Aviation: 21 CFR Part 11 / EASA Part 21 electronic signature.
   */
  async submitApprovalDecision(
    projectId: string,
    approvalId: string,
    body: { decision: 'approve' | 'reject'; comment?: string; eSignatureRef?: string }
  ): Promise<ApiResponse<ApprovalRecord>> {
    return apiClient.post<ApprovalRecord>(
      `${BASE}/${projectId}/approvals/${approvalId}/decide`,
      body
    )
  },

  // -------------------------------------------------------------------------
  // SLA ENGINE
  // -------------------------------------------------------------------------

  /** Get SLA rules */
  async getSlaRules(projectId: string): Promise<ApiResponse<SlaRule[]>> {
    return apiClient.get<SlaRule[]>(`${BASE}/${projectId}/sla/rules`)
  },

  /** Create or update an SLA rule */
  async upsertSlaRule(projectId: string, rule: Omit<SlaRule, 'id'> & { id?: string }): Promise<ApiResponse<SlaRule>> {
    return apiClient.post<SlaRule>(`${BASE}/${projectId}/sla/rules`, rule)
  },

  /** Get current SLA breaches */
  async getSlaBreaches(projectId: string): Promise<ApiResponse<SlaBreach[]>> {
    return apiClient.get<SlaBreach[]>(`${BASE}/${projectId}/sla/breaches`)
  },

  // -------------------------------------------------------------------------
  // ANOMALY DETECTION
  // -------------------------------------------------------------------------

  /** Get detected anomalies */
  async getAnomalies(projectId: string): Promise<ApiResponse<LifecycleAnomaly[]>> {
    return apiClient.get<LifecycleAnomaly[]>(`${BASE}/${projectId}/anomalies`)
  },

  // -------------------------------------------------------------------------
  // INTEGRITY & DIGITAL THREAD
  // -------------------------------------------------------------------------

  /**
   * Get digital thread integrity violations.
   * Aviation: DO-178C traceability completeness.
   */
  async getIntegrityViolations(projectId: string): Promise<ApiResponse<IntegrityViolation[]>> {
    return apiClient.get<IntegrityViolation[]>(`${BASE}/${projectId}/integrity`)
  },

  // -------------------------------------------------------------------------
  // READINESS SCORING
  // -------------------------------------------------------------------------

  /** Get current readiness score with decomposition */
  async getReadinessScore(projectId: string): Promise<ApiResponse<ReadinessScore>> {
    return apiClient.get<ReadinessScore>(`${BASE}/${projectId}/readiness`)
  },

  // -------------------------------------------------------------------------
  // SIMULATION (WHAT-IF)
  // -------------------------------------------------------------------------

  /**
   * Run a what-if simulation.
   * Aviation: Impact assessment before baseline-affecting changes.
   */
  async runSimulation(
    projectId: string,
    request: SimulationRequest
  ): Promise<ApiResponse<SimulationResult>> {
    return apiClient.post<SimulationResult>(
      `${BASE}/${projectId}/simulation/run`,
      request
    )
  },

  // -------------------------------------------------------------------------
  // AUDIT TRAIL
  // -------------------------------------------------------------------------

  /**
   * Get audit trail events (append-only, immutable).
   * Aviation: Full governance history for certification audits.
   */
  async getAuditTrail(
    projectId: string,
    params?: { page?: number; pageSize?: number; action?: string }
  ): Promise<ApiResponse<{ data: LifecycleAuditEvent[]; total: number }>> {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.pageSize) q.set('pageSize', String(params.pageSize))
    if (params?.action) q.set('action', params.action)
    const query = q.toString()
    return apiClient.get<{ data: LifecycleAuditEvent[]; total: number }>(
      `${BASE}/${projectId}/audit${query ? `?${query}` : ''}`
    )
  },

  // -------------------------------------------------------------------------
  // PLAYBOOKS
  // -------------------------------------------------------------------------

  /** Get available playbook actions */
  async getPlaybooks(projectId: string): Promise<ApiResponse<PlaybookAction[]>> {
    return apiClient.get<PlaybookAction[]>(`${BASE}/${projectId}/playbooks`)
  },

  /** Execute a playbook */
  async executePlaybook(
    projectId: string,
    playbook: PlaybookAction
  ): Promise<ApiResponse<{ success: boolean; message: string; auditEventId?: string }>> {
    return apiClient.post<{ success: boolean; message: string; auditEventId?: string }>(
      `${BASE}/${projectId}/playbooks/execute`,
      playbook
    )
  },

  // -------------------------------------------------------------------------
  // BENCHMARKING
  // -------------------------------------------------------------------------

  /** Get benchmark snapshots for comparison */
  async getBenchmarks(): Promise<ApiResponse<BenchmarkSnapshot[]>> {
    return apiClient.get<BenchmarkSnapshot[]>(`${BASE}/benchmarks`)
  },

  // -------------------------------------------------------------------------
  // HELPERS (PRIVATE)
  // -------------------------------------------------------------------------

  _buildFilterParams(filters?: ControlTowerFilters): string {
    if (!filters) return ''
    const q = new URLSearchParams()
    if (filters.entityTypes?.length) q.set('entityTypes', filters.entityTypes.join(','))
    if (filters.statuses?.length) q.set('statuses', filters.statuses.join(','))
    if (filters.search) q.set('search', filters.search)
    if (filters.page) q.set('page', String(filters.page))
    if (filters.pageSize) q.set('pageSize', String(filters.pageSize))
    return q.toString()
  },
}
