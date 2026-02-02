import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
  type Reducer,
} from 'react'
import type {
  CertificationContext,
  CertificationObjective,
  ComplianceMatrixRow,
  EvidenceItem,
  Finding,
  ReviewLogEntry,
  ActivityLogEntry,
  CertRole,
  Authority,
  CertBasis,
  StandardId,
  BaselineRef,
  ReleaseRef,
  ReadinessGate,
} from './types'
import {
  MOCK_BASELINES,
  MOCK_RELEASES,
  MOCK_OBJECTIVES,
  MOCK_COMPLIANCE_MATRIX,
  MOCK_EVIDENCE,
  MOCK_FINDINGS,
  MOCK_REVIEW_LOG,
  MOCK_ACTIVITY_LOG,
  MOCK_READINESS_GATES,
} from './mockData'
import type { CertificationStateFromApi } from '../../services/certification.service'

export interface CertificationState {
  context: CertificationContext
  baselines: BaselineRef[]
  releases: ReleaseRef[]
  objectives: CertificationObjective[]
  complianceMatrix: ComplianceMatrixRow[]
  evidence: EvidenceItem[]
  findings: Finding[]
  reviewLog: ReviewLogEntry[]
  activityLog: ActivityLogEntry[]
  readinessGates: ReadinessGate[]
  role: CertRole
  strictAuditMode: boolean
  readOnlyMode: boolean
}

type CertAction =
  | { type: 'SET_CONTEXT'; payload: Partial<CertificationContext> }
  | { type: 'SET_BASELINE'; payload: BaselineRef | null }
  | { type: 'SET_RELEASE'; payload: ReleaseRef | null }
  | { type: 'SET_AUTHORITY'; payload: Authority }
  | { type: 'SET_CERT_BASIS'; payload: CertBasis }
  | { type: 'SET_STANDARDS'; payload: StandardId[] }
  | { type: 'UPDATE_OBJECTIVE'; payload: CertificationObjective }
  | { type: 'MARK_OBJECTIVES_REVIEWED'; payload: string[] }
  | { type: 'ADD_FINDING'; payload: Finding }
  | { type: 'UPDATE_FINDING'; payload: Finding }
  | { type: 'ADD_REVIEW_ENTRY'; payload: ReviewLogEntry }
  | { type: 'UPDATE_REVIEW_ENTRY'; payload: ReviewLogEntry }
  | { type: 'SET_ROLE'; payload: CertRole }
  | { type: 'SET_STRICT_AUDIT_MODE'; payload: boolean }
  | { type: 'SET_READ_ONLY_MODE'; payload: boolean }
  | { type: 'APPEND_ACTIVITY'; payload: Omit<ActivityLogEntry, 'id'> }
  | { type: 'HYDRATE'; payload: CertificationStateFromApi }

function nextActivityId(log: ActivityLogEntry[]): string {
  const nums = log
    .map((e) => {
      const m = e.id.match(/act-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `act-${max + 1}`
}

function reducer(state: CertificationState, action: CertAction): CertificationState {
  const appendActivity = (entry: Omit<ActivityLogEntry, 'id'>): ActivityLogEntry[] => {
    const id = nextActivityId(state.activityLog)
    return [...state.activityLog, { ...entry, id }]
  }

  switch (action.type) {
    case 'SET_CONTEXT': {
      const nextContext = { ...state.context, ...action.payload }
      return {
        ...state,
        context: nextContext,
        activityLog: appendActivity({
          timestamp: new Date().toISOString(),
          action: 'CONTEXT_CHANGE',
          details: 'Certification context updated',
          actor: state.role,
        }),
      }
    }
    case 'SET_BASELINE':
      return {
        ...state,
        context: { ...state.context, selectedBaseline: action.payload },
        activityLog: appendActivity({
          timestamp: new Date().toISOString(),
          action: 'CONTEXT_CHANGE',
          details: action.payload ? `Baseline ${action.payload.name} selected` : 'Baseline cleared',
          actor: state.role,
        }),
      }
    case 'SET_RELEASE':
      return {
        ...state,
        context: { ...state.context, selectedRelease: action.payload },
        activityLog: appendActivity({
          timestamp: new Date().toISOString(),
          action: 'CONTEXT_CHANGE',
          details: action.payload ? `Release ${action.payload.name} selected` : 'Release cleared',
          actor: state.role,
        }),
      }
    case 'SET_AUTHORITY':
      return { ...state, context: { ...state.context, authority: action.payload } }
    case 'SET_CERT_BASIS':
      return { ...state, context: { ...state.context, certBasis: action.payload } }
    case 'SET_STANDARDS':
      return { ...state, context: { ...state.context, standards: action.payload } }
    case 'UPDATE_OBJECTIVE': {
      const activity = appendActivity({
        timestamp: new Date().toISOString(),
        action: 'OBJECTIVE_UPDATED',
        details: `Objective ${action.payload.objId} updated`,
        actor: state.role,
      })
      return {
        ...state,
        objectives: state.objectives.map((o) =>
          o.objId === action.payload.objId ? action.payload : o
        ),
        activityLog: activity,
      }
    }
    case 'MARK_OBJECTIVES_REVIEWED': {
      const ids = new Set(action.payload)
      const activity = appendActivity({
        timestamp: new Date().toISOString(),
        action: 'OBJECTIVES_REVIEWED',
        details: `${ids.size} objective(s) marked as reviewed`,
        actor: state.role,
      })
      return {
        ...state,
        objectives: state.objectives.map((o) =>
          ids.has(o.objId) ? { ...o, reviewed: true } : o
        ),
        activityLog: activity,
      }
    }
    case 'ADD_FINDING': {
      const activity = appendActivity({
        timestamp: new Date().toISOString(),
        action: 'FINDING_CREATED',
        details: `Finding ${action.payload.findingId} created`,
        actor: state.role,
      })
      return {
        ...state,
        findings: [action.payload, ...state.findings],
        activityLog: activity,
      }
    }
    case 'UPDATE_FINDING': {
      const activity = appendActivity({
        timestamp: new Date().toISOString(),
        action: 'FINDING_UPDATED',
        details: `Finding ${action.payload.findingId} updated`,
        actor: state.role,
      })
      return {
        ...state,
        findings: state.findings.map((f) =>
          f.findingId === action.payload.findingId ? action.payload : f
        ),
        activityLog: activity,
      }
    }
    case 'ADD_REVIEW_ENTRY': {
      const activity = appendActivity({
        timestamp: new Date().toISOString(),
        action: 'REVIEW_STARTED',
        details: `Review ${action.payload.reviewId} added`,
        actor: state.role,
      })
      return {
        ...state,
        reviewLog: [action.payload, ...state.reviewLog],
        activityLog: activity,
      }
    }
    case 'UPDATE_REVIEW_ENTRY':
      return {
        ...state,
        reviewLog: state.reviewLog.map((r) =>
          r.reviewId === action.payload.reviewId ? action.payload : r
        ),
      }
    case 'SET_ROLE':
      return { ...state, role: action.payload }
    case 'SET_STRICT_AUDIT_MODE':
      return { ...state, strictAuditMode: action.payload }
    case 'SET_READ_ONLY_MODE':
      return { ...state, readOnlyMode: action.payload }
    case 'APPEND_ACTIVITY':
      return {
        ...state,
        activityLog: appendActivity(action.payload),
      }
    case 'HYDRATE': {
      const payload = action.payload
      return {
        ...state,
        context: payload.context,
        baselines: payload.baselines,
        releases: payload.releases,
        objectives: payload.objectives.map((o) => ({
          id: o.id,
          objId: o.objId,
          regRef: o.regRef,
          title: o.title,
          moc: o.moc as CertificationObjective['moc'],
          status: o.status as CertificationObjective['status'],
          criticality: o.criticality as CertificationObjective['criticality'],
          linkedEvidenceCount: o.linkedEvidenceCount,
          linkedCiCount: o.linkedCiCount,
          notes: o.notes,
          reviewed: o.reviewed,
          linkedRequirements: o.linkedRequirements,
        })),
        complianceMatrix: payload.complianceMatrix,
        findings: payload.findings.map((f) => ({
          id: f.id,
          findingId: f.findingId,
          title: f.title,
          severity: f.severity as Finding['severity'],
          status: f.status as Finding['status'],
          linkedRegRef: f.linkedRegRef,
          linkedObjectives: f.linkedObjectives,
          linkedEvidence: f.linkedEvidence,
          assignedTo: f.assignedTo,
          dueDate: f.dueDate,
          notes: f.notes,
          safetyRelated: f.safetyRelated,
          safetyNcrRef: f.safetyNcrRef,
          createdAt: f.createdAt,
        })),
        reviewLog: payload.reviewLog.map((e) => ({
          id: e.id,
          reviewId: e.reviewId,
          date: e.date,
          reviewType: e.reviewType as ReviewLogEntry['reviewType'],
          scopeSummary: e.scopeSummary,
          findingsRaised: e.findingsRaised,
          findingsClosed: e.findingsClosed,
          notes: e.notes,
          status: e.status,
        })),
        activityLog: payload.activityLog.map((a) => ({
          id: a.id,
          timestamp: a.timestamp,
          action: a.action,
          details: a.details,
          actor: a.actor,
        })),
        readinessGates: payload.readinessGates ?? state.readinessGates,
      }
    }
    default:
      return state
  }
}

const defaultContext: CertificationContext = {
  projectId: '',
  projectName: 'Project',
  authority: 'EASA',
  certBasis: 'CS-25',
  standards: ['ARP4754A', 'DO-178C', 'DO-254'],
  selectedBaseline: null,
  selectedRelease: null,
}

const initialState: CertificationState = {
  context: defaultContext,
  baselines: [...MOCK_BASELINES],
  releases: [...MOCK_RELEASES],
  objectives: [...MOCK_OBJECTIVES],
  complianceMatrix: [...MOCK_COMPLIANCE_MATRIX],
  evidence: [...MOCK_EVIDENCE],
  findings: [...MOCK_FINDINGS],
  reviewLog: [...MOCK_REVIEW_LOG],
  activityLog: [...MOCK_ACTIVITY_LOG],
  readinessGates: [...MOCK_READINESS_GATES],
  role: 'CertificationManager',
  strictAuditMode: false,
  readOnlyMode: false,
}

const CertificationStoreContext = createContext<{
  state: CertificationState
  dispatch: React.Dispatch<CertAction>
  refetch: (() => Promise<void>) | null
} | null>(null)

export function CertificationStoreProvider({
  children,
  projectId,
}: {
  children: ReactNode
  projectId?: string
}) {
  const [state, dispatch] = useReducer<Reducer<CertificationState, CertAction>>(
    reducer,
    initialState
  )

  const refetch = useCallback(async () => {
    if (!projectId) return
    const { getCertificationState } = await import('../../services/certification.service')
    const res = await getCertificationState(projectId)
    if (res.success && res.data) {
      dispatch({ type: 'HYDRATE', payload: res.data })
    }
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    refetch()
  }, [projectId, refetch])

  return React.createElement(
    CertificationStoreContext.Provider,
    { value: { state, dispatch, refetch: projectId ? refetch : null } },
    children
  )
}

export function useCertificationStore() {
  const ctx = useContext(CertificationStoreContext)
  if (!ctx) throw new Error('useCertificationStore must be used within CertificationStoreProvider')
  return ctx
}

export function useNextFindingId() {
  const { state } = useCertificationStore()
  return useCallback(() => {
    const nums = state.findings
      .map((f) => {
        const m = f.findingId.match(/FND-(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !Number.isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `FND-${String(max + 1).padStart(3, '0')}`
  }, [state.findings])
}

export function useNextReviewId() {
  const { state } = useCertificationStore()
  return useCallback(() => {
    const nums = state.reviewLog
      .map((r) => {
        const m = r.reviewId.match(/REV-(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !Number.isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `REV-${String(max + 1).padStart(3, '0')}`
  }, [state.reviewLog])
}
