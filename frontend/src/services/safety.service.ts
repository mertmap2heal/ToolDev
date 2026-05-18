// NX-9 (#466) — Safety Analysis: frontend API client.
//
// Hazard + FMEA. All calls go through the shared axios client; the Vite proxy
// routes /api to the backend (never hardcode localhost). The backend derives
// hazard.dal from severity and fmeaRow.rpn from severity*occurrence*detection
// server-side — the client never sends `dal` or `rpn`.
//
// apiClient.{get,post,patch,delete}<T> returns the unwrapped ApiResponse<T>
// server body — `unwrap` below pulls `data` and surfaces a server error as a
// thrown Error so React Query's isError path fires.
import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

const BASE = '/safety-analysis/projects'

/** Pull `data` off an ApiResponse, throwing on a non-success body. */
function unwrap<T>(res: ApiResponse<T>): T {
  if (res.success === false || res.data === undefined) {
    throw new Error(res.error ?? 'Request failed')
  }
  return res.data
}

// --- Controlled vocabularies (mirror backend safety.service.ts) -------------

export const HAZARD_SEVERITIES = [
  'Catastrophic',
  'Hazardous',
  'Major',
  'Minor',
  'NoSafetyEffect',
] as const
export type HazardSeverity = (typeof HAZARD_SEVERITIES)[number]

export const HAZARD_STATUSES = ['Open', 'Mitigated', 'Verified', 'Closed'] as const
export type HazardStatus = (typeof HAZARD_STATUSES)[number]

// --- API types --------------------------------------------------------------

export interface SafetyHazard {
  id: string
  projectId: string
  identifier: string
  title: string
  description: string
  severity: HazardSeverity
  /** Server-derived from severity (DO-178C §6.3). Read-only. */
  dal: string | null
  status: string
  failureRateTargetPerHr: number | null
  rationale: string | null
  createdAt: string
  updatedAt: string
}

export interface SafetyFmea {
  id: string
  projectId: string
  title: string
  description: string | null
  status: string
  systemRef: string | null
  createdAt: string
  updatedAt: string
}

export interface SafetyFmeaRow {
  id: string
  projectId: string
  fmeaId: string
  component: string
  failureMode: string
  effect: string
  cause: string | null
  severity: number
  occurrence: number
  detection: number
  /** Server-computed: severity * occurrence * detection. Read-only. */
  rpn: number
  mitigation: string | null
  orderIndex: number
  createdAt: string
  updatedAt: string
}

// --- Hazard input DTOs ------------------------------------------------------

export interface CreateHazardInput {
  identifier?: string
  title: string
  description: string
  severity: HazardSeverity
  status?: HazardStatus
  failureRateTargetPerHr?: number | null
  rationale?: string | null
}

export type UpdateHazardInput = Partial<CreateHazardInput>

// --- FMEA / FMEA-row input DTOs ---------------------------------------------

export interface CreateFmeaInput {
  title: string
  description?: string | null
  status?: string
  systemRef?: string | null
}

export interface CreateFmeaRowInput {
  component: string
  failureMode: string
  effect: string
  cause?: string | null
  severity: number
  occurrence: number
  detection: number
  mitigation?: string | null
  orderIndex?: number
}

export type UpdateFmeaRowInput = Partial<CreateFmeaRowInput>

// --- Hazard -----------------------------------------------------------------

export async function listHazards(
  projectId: string,
  filters: { severity?: string; status?: string; search?: string } = {},
): Promise<SafetyHazard[]> {
  const params = new URLSearchParams()
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  const qs = params.toString()
  const res = await apiClient.get<SafetyHazard[]>(
    `${BASE}/${projectId}/hazards${qs ? `?${qs}` : ''}`,
  )
  return unwrap(res)
}

export async function createHazard(
  projectId: string,
  input: CreateHazardInput,
): Promise<SafetyHazard> {
  const res = await apiClient.post<SafetyHazard>(`${BASE}/${projectId}/hazards`, input)
  return unwrap(res)
}

export async function updateHazard(
  projectId: string,
  id: string,
  input: UpdateHazardInput,
): Promise<SafetyHazard> {
  const res = await apiClient.patch<SafetyHazard>(
    `${BASE}/${projectId}/hazards/${id}`,
    input,
  )
  return unwrap(res)
}

export async function deleteHazard(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${projectId}/hazards/${id}`)
}

// --- FMEA -------------------------------------------------------------------

export async function listFmeas(projectId: string): Promise<SafetyFmea[]> {
  const res = await apiClient.get<SafetyFmea[]>(`${BASE}/${projectId}/fmea`)
  return unwrap(res)
}

export async function createFmea(
  projectId: string,
  input: CreateFmeaInput,
): Promise<SafetyFmea> {
  const res = await apiClient.post<SafetyFmea>(`${BASE}/${projectId}/fmea`, input)
  return unwrap(res)
}

// --- FMEA rows --------------------------------------------------------------

export async function listFmeaRows(
  projectId: string,
  fmeaId: string,
): Promise<SafetyFmeaRow[]> {
  const res = await apiClient.get<SafetyFmeaRow[]>(
    `${BASE}/${projectId}/fmea/${fmeaId}/rows`,
  )
  return unwrap(res)
}

export async function createFmeaRow(
  projectId: string,
  fmeaId: string,
  input: CreateFmeaRowInput,
): Promise<SafetyFmeaRow> {
  const res = await apiClient.post<SafetyFmeaRow>(
    `${BASE}/${projectId}/fmea/${fmeaId}/rows`,
    input,
  )
  return unwrap(res)
}

export async function updateFmeaRow(
  projectId: string,
  fmeaId: string,
  id: string,
  input: UpdateFmeaRowInput,
): Promise<SafetyFmeaRow> {
  const res = await apiClient.patch<SafetyFmeaRow>(
    `${BASE}/${projectId}/fmea/${fmeaId}/rows/${id}`,
    input,
  )
  return unwrap(res)
}

export async function deleteFmeaRow(
  projectId: string,
  fmeaId: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`${BASE}/${projectId}/fmea/${fmeaId}/rows/${id}`)
}
