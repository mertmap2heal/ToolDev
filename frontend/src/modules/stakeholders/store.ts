import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Reducer,
} from 'react'
import type {
  Stakeholder,
  Committee,
  RaciEntry,
  ApprovalRule,
  Request,
  CommunicationLogEntry,
  AuditEvent,
  StakeholderRole,
  RequestComment,
  AuditAction,
  CommAudience,
} from './types'
import {
  MOCK_STAKEHOLDERS,
  MOCK_COMMITTEES,
  MOCK_RACI,
  MOCK_APPROVAL_RULES,
  MOCK_REQUESTS,
  MOCK_COMMUNICATION_LOG,
  MOCK_AUDIT_EVENTS,
} from './mockData'

export interface StakeholdersState {
  projectId: string
  stakeholders: Stakeholder[]
  committees: Committee[]
  raci: RaciEntry[]
  approvalRules: ApprovalRule[]
  requests: Request[]
  requestComments: RequestComment[]
  communicationLog: CommunicationLogEntry[]
  auditEvents: AuditEvent[]
  role: StakeholderRole
  strictMode: boolean
  readOnlyMode: boolean
}

function nextId<T>(prefix: string, items: T[], idKey: string): string {
  const nums = (items as Record<string, unknown>[])
    .map((item) => {
      const id = String(item[idKey] ?? '')
      const m = id.match(new RegExp(`${prefix}-?(\\d+)`, 'i'))
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  const num = max + 1
  const pad = prefix === 'SH' ? 4 : prefix === 'REQ-ACT' ? 3 : 3
  return prefix === 'REQ-ACT' ? `REQ-ACT-${String(num).padStart(3, '0')}` : `${prefix}-${String(num).padStart(pad, '0')}`
}

function nextEventId(events: AuditEvent[]): string {
  const nums = events
    .map((e) => {
      const m = e.eventId.match(/EVT-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `EVT-${String(max + 1).padStart(3, '0')}`
}

type StakeholdersAction =
  | { type: 'SET_PROJECT'; payload: string }
  | { type: 'SET_ROLE'; payload: StakeholderRole }
  | { type: 'SET_STRICT_MODE'; payload: boolean }
  | { type: 'SET_READ_ONLY_MODE'; payload: boolean }
  | { type: 'APPEND_AUDIT'; payload: Omit<AuditEvent, 'eventId'> }
  | { type: 'CREATE_STAKEHOLDER'; payload: Stakeholder }
  | { type: 'UPDATE_STAKEHOLDER'; payload: Stakeholder }
  | { type: 'CREATE_GROUP'; payload: Committee }
  | { type: 'UPDATE_GROUP'; payload: Committee }
  | { type: 'ADD_MEMBER'; payload: { groupId: string; stakeholderId: string } }
  | { type: 'REMOVE_MEMBER'; payload: { groupId: string; stakeholderId: string } }
  | { type: 'CREATE_RACI'; payload: RaciEntry }
  | { type: 'UPDATE_RACI'; payload: RaciEntry }
  | { type: 'CREATE_RULE'; payload: ApprovalRule }
  | { type: 'UPDATE_RULE'; payload: ApprovalRule }
  | { type: 'CREATE_REQUEST'; payload: Request }
  | { type: 'UPDATE_REQUEST'; payload: Request }
  | { type: 'ADD_REQUEST_COMMENT'; payload: RequestComment }
  | { type: 'CREATE_COMM'; payload: CommunicationLogEntry }

function appendAudit(state: StakeholdersState, entry: Omit<AuditEvent, 'eventId'>): AuditEvent[] {
  const eventId = nextEventId(state.auditEvents)
  return [...state.auditEvents, { ...entry, eventId }]
}

function reducer(state: StakeholdersState, action: StakeholdersAction): StakeholdersState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, projectId: action.payload }
    case 'SET_ROLE':
      return { ...state, role: action.payload }
    case 'SET_STRICT_MODE':
      return { ...state, strictMode: action.payload }
    case 'SET_READ_ONLY_MODE':
      return { ...state, readOnlyMode: action.payload }
    case 'APPEND_AUDIT':
      return {
        ...state,
        auditEvents: appendAudit(state, action.payload),
      }
    case 'CREATE_STAKEHOLDER': {
      const audit: AuditAction = 'CREATE_STAKEHOLDER'
      return {
        ...state,
        stakeholders: [...state.stakeholders, action.payload],
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Stakeholder', id: action.payload.stakeholderId },
          details: `Stakeholder ${action.payload.displayName} created`,
        }),
      }
    }
    case 'UPDATE_STAKEHOLDER': {
      const audit: AuditAction = 'UPDATE_STAKEHOLDER'
      return {
        ...state,
        stakeholders: state.stakeholders.map((s) =>
          s.stakeholderId === action.payload.stakeholderId ? action.payload : s
        ),
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Stakeholder', id: action.payload.stakeholderId },
          details: `Stakeholder ${action.payload.displayName} updated`,
        }),
      }
    }
    case 'CREATE_GROUP': {
      const audit: AuditAction = 'CREATE_GROUP'
      return {
        ...state,
        committees: [...state.committees, action.payload],
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Group', id: action.payload.groupId },
          details: `Committee ${action.payload.name} created`,
        }),
      }
    }
    case 'UPDATE_GROUP': {
      const audit: AuditAction = 'UPDATE_GROUP'
      return {
        ...state,
        committees: state.committees.map((c) =>
          c.groupId === action.payload.groupId ? action.payload : c
        ),
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Group', id: action.payload.groupId },
          details: `Committee ${action.payload.name} updated`,
        }),
      }
    }
    case 'ADD_MEMBER': {
      const committee = state.committees.find((c) => c.groupId === action.payload.groupId)
      if (!committee || committee.members.includes(action.payload.stakeholderId))
        return state
      const updated: Committee = {
        ...committee,
        members: [...committee.members, action.payload.stakeholderId],
      }
      return {
        ...state,
        committees: state.committees.map((c) => (c.groupId === updated.groupId ? updated : c)),
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: 'ADD_MEMBER',
          objectRef: { kind: 'Group', id: action.payload.groupId },
          details: `Member ${action.payload.stakeholderId} added`,
        }),
      }
    }
    case 'REMOVE_MEMBER': {
      const committee = state.committees.find((c) => c.groupId === action.payload.groupId)
      if (!committee) return state
      const updated: Committee = {
        ...committee,
        members: committee.members.filter((id) => id !== action.payload.stakeholderId),
        chair: committee.chair === action.payload.stakeholderId ? undefined : committee.chair,
      }
      return {
        ...state,
        committees: state.committees.map((c) => (c.groupId === updated.groupId ? updated : c)),
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: 'REMOVE_MEMBER',
          objectRef: { kind: 'Group', id: action.payload.groupId },
          details: `Member ${action.payload.stakeholderId} removed`,
        }),
      }
    }
    case 'CREATE_RACI': {
      const audit: AuditAction = 'CREATE_RACI'
      return {
        ...state,
        raci: [...state.raci, action.payload],
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'RACI', id: action.payload.raciId },
          details: `RACI ${action.payload.subjectRef} created`,
        }),
      }
    }
    case 'UPDATE_RACI': {
      const audit: AuditAction = 'UPDATE_RACI'
      return {
        ...state,
        raci: state.raci.map((r) => (r.raciId === action.payload.raciId ? action.payload : r)),
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'RACI', id: action.payload.raciId },
          details: `RACI ${action.payload.subjectRef} updated`,
        }),
      }
    }
    case 'CREATE_RULE': {
      const audit: AuditAction = 'CREATE_RULE'
      return {
        ...state,
        approvalRules: [...state.approvalRules, action.payload],
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Rule', id: action.payload.ruleId },
          details: `Rule ${action.payload.ruleId} created`,
        }),
      }
    }
    case 'UPDATE_RULE': {
      const audit: AuditAction = 'UPDATE_RULE'
      return {
        ...state,
        approvalRules: state.approvalRules.map((r) =>
          r.ruleId === action.payload.ruleId ? action.payload : r
        ),
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Rule', id: action.payload.ruleId },
          details: `Rule ${action.payload.ruleId} updated`,
        }),
      }
    }
    case 'CREATE_REQUEST': {
      const audit: AuditAction = 'CREATE_REQUEST'
      return {
        ...state,
        requests: [...state.requests, action.payload],
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Request', id: action.payload.requestId },
          details: `Request ${action.payload.title} created`,
        }),
      }
    }
    case 'UPDATE_REQUEST': {
      const audit: AuditAction = 'UPDATE_REQUEST'
      return {
        ...state,
        requests: state.requests.map((r) =>
          r.requestId === action.payload.requestId ? action.payload : r
        ),
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Request', id: action.payload.requestId },
          details: `Request ${action.payload.requestId} updated`,
        }),
      }
    }
    case 'ADD_REQUEST_COMMENT':
      return {
        ...state,
        requestComments: [...state.requestComments, action.payload],
      }
    case 'CREATE_COMM': {
      const audit: AuditAction = 'CREATE_COMM'
      return {
        ...state,
        communicationLog: [...state.communicationLog, action.payload],
        auditEvents: appendAudit(state, {
          timestamp: new Date().toISOString(),
          actor: state.role,
          action: audit,
          objectRef: { kind: 'Comm', id: action.payload.commId },
          details: `Communication ${action.payload.type} posted`,
        }),
      }
    }
    default:
      return state
  }
}

const initialState: StakeholdersState = {
  projectId: '',
  stakeholders: [...MOCK_STAKEHOLDERS],
  committees: [...MOCK_COMMITTEES],
  raci: [...MOCK_RACI],
  approvalRules: [...MOCK_APPROVAL_RULES],
  requests: [...MOCK_REQUESTS],
  requestComments: [],
  communicationLog: [...MOCK_COMMUNICATION_LOG],
  auditEvents: [...MOCK_AUDIT_EVENTS],
  role: 'Engineer',
  strictMode: false,
  readOnlyMode: false,
}

const StakeholdersStoreContext = createContext<{
  state: StakeholdersState
  dispatch: React.Dispatch<StakeholdersAction>
  nextStakeholderId: () => string
  nextGroupId: () => string
  nextRaciId: () => string
  nextRuleId: () => string
  nextRequestId: () => string
  nextCommId: () => string
  nextCommentId: () => string
} | null>(null)

export function StakeholdersStoreProvider({
  children,
  projectId,
}: {
  children: ReactNode
  projectId?: string
}) {
  const [state, dispatch] = useReducer<Reducer<StakeholdersState, StakeholdersAction>>(
    reducer,
    initialState
  )

  const nextStakeholderId = () => nextId('SH', state.stakeholders, 'stakeholderId')
  const nextGroupId = () => nextId('GR', state.committees, 'groupId')
  const nextRaciId = () => nextId('RACI', state.raci, 'raciId')
  const nextRuleId = () => nextId('RULE', state.approvalRules, 'ruleId')
  const nextRequestId = () => nextId('REQ-ACT', state.requests, 'requestId')
  const nextCommId = () => nextId('COMM', state.communicationLog, 'commId')
  const nextCommentId = () => {
    const nums = state.requestComments.map((c) => {
      const m = c.id.match(/comment-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    const max = nums.length ? Math.max(...nums) : 0
    return `comment-${max + 1}`
  }

  React.useEffect(() => {
    if (projectId) dispatch({ type: 'SET_PROJECT', payload: projectId })
  }, [projectId])

  return React.createElement(
    StakeholdersStoreContext.Provider,
    {
      value: {
        state,
        dispatch,
        nextStakeholderId,
        nextGroupId,
        nextRaciId,
        nextRuleId,
        nextRequestId,
        nextCommId,
        nextCommentId,
      },
    },
    children
  )
}

export function useStakeholdersStore() {
  const ctx = useContext(StakeholdersStoreContext)
  if (!ctx) throw new Error('useStakeholdersStore must be used within StakeholdersStoreProvider')
  return ctx
}
