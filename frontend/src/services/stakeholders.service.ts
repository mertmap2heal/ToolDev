/**
 * NX-8 (#463) — Stakeholders governance API: Committees + RACI.
 *
 * Talks to the project-scoped /projects/:projectId/committees and
 * /projects/:projectId/raci endpoints, plus the extended audit-logs endpoint
 * and the four subject-picker endpoints the RACI matrix needs. All requests go
 * through `apiClient` (axios + the Vite proxy).
 */

import { apiClient } from './api'

// --- Provenance lattice (R-1) — present on every governance row -------------

export interface ProvenanceFields {
  authorType: string
  authorAiModel: string | null
  authorAiVersion: string | null
  authorAiPromptId: string | null
  authorAiContextHash: string | null
  provenanceReviewStatus: string
  reviewerUserId: string | null
  reviewTimestamp: string | null
}

// --- Committee --------------------------------------------------------------

export type CommitteeKind =
  | 'CCB'
  | 'ReviewBoard'
  | 'AuthorityInterface'
  | 'SupplierPanel'
  | 'ProgramGovernance'

export type CommitteeRole =
  | 'Chair'
  | 'Voting'
  | 'NonVoting'
  | 'Observer'
  | 'Secretary'
  | 'Auditor'

export type BaselineKind = 'VER' | 'CERT' | 'PARAM' | 'VALIDATION' | 'CM'

export interface CommitteeMember extends ProvenanceFields {
  id: string
  committeeId: string
  userId: string
  committeeRole: CommitteeRole
  validFrom: string | null
  validUntil: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CommitteeDefaultReviewer extends ProvenanceFields {
  id: string
  committeeId: string
  baselineKind: BaselineKind
  createdAt: string
}

export interface Committee extends ProvenanceFields {
  id: string
  projectId: string
  name: string
  kind: CommitteeKind
  meetingFrequency: string | null
  nextMeetingAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  members: CommitteeMember[]
  defaultReviewers: CommitteeDefaultReviewer[]
}

export interface CreateCommitteeInput {
  name: string
  kind: CommitteeKind
  meetingFrequency?: string | null
  nextMeetingAt?: string | null
  notes?: string | null
}

export type UpdateCommitteeInput = Partial<CreateCommitteeInput>

export interface AddCommitteeMemberInput {
  userId: string
  committeeRole: CommitteeRole
  validFrom?: string | null
  validUntil?: string | null
}

// --- RACI -------------------------------------------------------------------

export type RaciSubjectType =
  | 'SystemFunction'
  | 'Requirement'
  | 'CertObjective'
  | 'Component'
  | 'Deliverable'

export type RaciLetter = 'R' | 'A' | 'C' | 'I'

export interface RaciAssignment extends ProvenanceFields {
  id: string
  raciId: string
  userId: string
  letter: RaciLetter
  createdAt: string
}

export interface RaciEntry extends ProvenanceFields {
  id: string
  projectId: string
  subjectType: RaciSubjectType
  subjectId: string
  riskFlag: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  assignments: RaciAssignment[]
}

export interface RaciAssignmentInput {
  userId: string
  letter: RaciLetter
}

export interface CreateRaciEntryInput {
  subjectType: RaciSubjectType
  subjectId: string
  riskFlag?: boolean
  notes?: string | null
  assignments: RaciAssignmentInput[]
}

/** A RACI write returns the entry plus any soft doctrine `warnings[]`. */
export interface RaciWriteResult {
  entry: RaciEntry
  warnings: string[]
}

// --- Audit ------------------------------------------------------------------

export interface AuditLogRow {
  id: string
  projectId: string
  userId: string
  action: string
  details: string | null
  detailsJson: unknown
  createdAt: string
  user?: { id: string; name: string; email: string } | null
}

export interface AuditLogPage {
  rows: AuditLogRow[]
  pagination?: { page: number; pageSize: number; total: number; totalPages: number }
}

// --- Subject picker ---------------------------------------------------------

export interface SubjectOption {
  id: string
  label: string
}

function enc(s: string): string {
  return encodeURIComponent(s)
}

// =============================================================================
// Committees
// =============================================================================

export async function listCommittees(projectId: string): Promise<Committee[]> {
  const res = await apiClient.get<Committee[]>(`/projects/${enc(projectId)}/committees`)
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load committees')
  }
  return res.data
}

export async function createCommittee(
  projectId: string,
  input: CreateCommitteeInput,
): Promise<Committee> {
  const res = await apiClient.post<Committee>(`/projects/${enc(projectId)}/committees`, input)
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to create committee')
  return res.data
}

export async function updateCommittee(
  projectId: string,
  committeeId: string,
  input: UpdateCommitteeInput,
): Promise<Committee> {
  const res = await apiClient.put<Committee>(
    `/projects/${enc(projectId)}/committees/${enc(committeeId)}`,
    input,
  )
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to update committee')
  return res.data
}

export async function deleteCommittee(projectId: string, committeeId: string): Promise<void> {
  const res = await apiClient.delete(`/projects/${enc(projectId)}/committees/${enc(committeeId)}`)
  if (!res.success) throw new Error(res.error ?? 'Failed to delete committee')
}

export async function addCommitteeMember(
  projectId: string,
  committeeId: string,
  input: AddCommitteeMemberInput,
): Promise<CommitteeMember> {
  const res = await apiClient.post<CommitteeMember>(
    `/projects/${enc(projectId)}/committees/${enc(committeeId)}/members`,
    input,
  )
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to add member')
  return res.data
}

export async function removeCommitteeMember(
  projectId: string,
  committeeId: string,
  memberId: string,
): Promise<void> {
  const res = await apiClient.delete(
    `/projects/${enc(projectId)}/committees/${enc(committeeId)}/members/${enc(memberId)}`,
  )
  if (!res.success) throw new Error(res.error ?? 'Failed to remove member')
}

export async function setDefaultReviewer(
  projectId: string,
  committeeId: string,
  baselineKind: BaselineKind,
): Promise<CommitteeDefaultReviewer> {
  const res = await apiClient.post<CommitteeDefaultReviewer>(
    `/projects/${enc(projectId)}/committees/${enc(committeeId)}/default-reviewers`,
    { baselineKind },
  )
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to set default reviewer')
  return res.data
}

export async function unsetDefaultReviewer(
  projectId: string,
  committeeId: string,
  reviewerId: string,
): Promise<void> {
  const res = await apiClient.delete(
    `/projects/${enc(projectId)}/committees/${enc(committeeId)}/default-reviewers/${enc(reviewerId)}`,
  )
  if (!res.success) throw new Error(res.error ?? 'Failed to unset default reviewer')
}

// =============================================================================
// RACI
// =============================================================================

export async function listRaciEntries(projectId: string): Promise<RaciEntry[]> {
  const res = await apiClient.get<RaciEntry[]>(`/projects/${enc(projectId)}/raci`)
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load the RACI matrix')
  }
  return res.data
}

export async function createRaciEntry(
  projectId: string,
  input: CreateRaciEntryInput,
): Promise<RaciWriteResult> {
  const res = await apiClient.post<RaciEntry>(`/projects/${enc(projectId)}/raci`, input)
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to create RACI entry')
  return {
    entry: res.data,
    warnings: Array.isArray((res as { warnings?: string[] }).warnings)
      ? ((res as { warnings?: string[] }).warnings as string[])
      : [],
  }
}

export async function updateRaciEntry(
  projectId: string,
  raciId: string,
  input: { riskFlag?: boolean; notes?: string | null },
): Promise<RaciEntry> {
  const res = await apiClient.put<RaciEntry>(
    `/projects/${enc(projectId)}/raci/${enc(raciId)}`,
    input,
  )
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to update RACI entry')
  return res.data
}

export async function deleteRaciEntry(projectId: string, raciId: string): Promise<void> {
  const res = await apiClient.delete(`/projects/${enc(projectId)}/raci/${enc(raciId)}`)
  if (!res.success) throw new Error(res.error ?? 'Failed to delete RACI entry')
}

export async function setRaciAssignments(
  projectId: string,
  raciId: string,
  assignments: RaciAssignmentInput[],
): Promise<RaciWriteResult> {
  const res = await apiClient.put<RaciEntry>(
    `/projects/${enc(projectId)}/raci/${enc(raciId)}/assignments`,
    { assignments },
  )
  if (!res.success || !res.data) throw new Error(res.error ?? 'Failed to update RACI assignments')
  return {
    entry: res.data,
    warnings: Array.isArray((res as { warnings?: string[] }).warnings)
      ? ((res as { warnings?: string[] }).warnings as string[])
      : [],
  }
}

// =============================================================================
// Audit log (extended GET /projects/:id/audit-logs)
// =============================================================================

export async function getAuditLog(
  projectId: string,
  opts: { modules?: string[]; page?: number; pageSize?: number } = {},
): Promise<AuditLogPage> {
  const params: Record<string, unknown> = {}
  if (opts.modules && opts.modules.length > 0) params.modules = opts.modules.join(',')
  if (opts.page) params.page = opts.page
  if (opts.pageSize) params.pageSize = opts.pageSize
  const res = await apiClient.get<AuditLogRow[]>(`/projects/${enc(projectId)}/audit-logs`, {
    params,
  })
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(res.error ?? 'Failed to load audit events')
  }
  return {
    rows: res.data,
    pagination: (res as { pagination?: AuditLogPage['pagination'] }).pagination,
  }
}

// =============================================================================
// Subject picker — flat lists for the four model-backed RACI subject types
// =============================================================================

interface TreeNode {
  id: string
  name?: string
  title?: string
  children?: TreeNode[]
}

/** Depth-first flatten of a tree of {id, name/title, children}. */
function flattenTree(nodes: TreeNode[]): SubjectOption[] {
  const out: SubjectOption[] = []
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push({ id: n.id, label: n.title ?? n.name ?? n.id })
      if (Array.isArray(n.children)) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export async function listSubjectOptions(
  projectId: string,
  subjectType: RaciSubjectType,
): Promise<SubjectOption[]> {
  if (subjectType === 'Deliverable') return []
  const pid = enc(projectId)

  if (subjectType === 'SystemFunction') {
    const res = await apiClient.get<TreeNode[]>(`/functions/${pid}`)
    if (!res.success || !Array.isArray(res.data)) return []
    return flattenTree(res.data)
  }
  if (subjectType === 'Requirement') {
    const res = await apiClient.get<{ items?: Array<{ id: string; title?: string; key?: string }> }>(
      `/requirements/${pid}`,
      { params: { pageSize: 200 } },
    )
    const items = res.success && res.data && Array.isArray(res.data.items) ? res.data.items : []
    return items.map((r) => ({ id: r.id, label: r.key ? `${r.key} — ${r.title ?? ''}` : (r.title ?? r.id) }))
  }
  if (subjectType === 'CertObjective') {
    const res = await apiClient.get<Array<{ id: string; objId?: string; title?: string }>>(
      `/certification/${pid}/objectives`,
    )
    if (!res.success || !Array.isArray(res.data)) return []
    return res.data.map((o) => ({
      id: o.id,
      label: o.objId ? `${o.objId} — ${o.title ?? ''}` : (o.title ?? o.id),
    }))
  }
  // Component
  const res = await apiClient.get<TreeNode[]>(`/projects/${pid}/components`)
  if (!res.success || !Array.isArray(res.data)) return []
  return flattenTree(res.data)
}
