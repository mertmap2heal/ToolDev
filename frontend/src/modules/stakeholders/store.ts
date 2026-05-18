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
  StakeholderRole,
  RequestComment,
} from './types'
import {
  MOCK_STAKEHOLDERS,
  MOCK_COMMITTEES,
  MOCK_RACI,
  MOCK_APPROVAL_RULES,
  MOCK_REQUESTS,
  MOCK_COMMUNICATION_LOG,
} from './mockData'

// NX-8 (#463): the Committees, RACI, and Audit Trail tabs are now backed by
// the real /projects/:projectId/committees|raci endpoints and central
// AuditLog (via React Query). The mock `AuditEvent` interface, the
// `auditEvents` state slice, `nextEventId`, and the `appendAudit` reducer
// helper were deleted. `committees` / `raci` remain in state only because the
// still-mock Approval Rules / Requests / Communication tabs read them; the
// rewritten Committees / RACI tabs no longer consult this store.

export interface StakeholdersState {
  projectId: string
  stakeholders: Stakeholder[]
  committees: Committee[]
  raci: RaciEntry[]
  approvalRules: ApprovalRule[]
  requests: Request[]
  requestComments: RequestComment[]
  communicationLog: CommunicationLogEntry[]
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

type StakeholdersAction =
  | { type: 'SET_PROJECT'; payload: string }
  | { type: 'SET_ROLE'; payload: StakeholderRole }
  | { type: 'SET_STRICT_MODE'; payload: boolean }
  | { type: 'SET_READ_ONLY_MODE'; payload: boolean }
  | { type: 'CREATE_STAKEHOLDER'; payload: Stakeholder }
  | { type: 'UPDATE_STAKEHOLDER'; payload: Stakeholder }
  | { type: 'CREATE_RULE'; payload: ApprovalRule }
  | { type: 'UPDATE_RULE'; payload: ApprovalRule }
  | { type: 'CREATE_REQUEST'; payload: Request }
  | { type: 'UPDATE_REQUEST'; payload: Request }
  | { type: 'ADD_REQUEST_COMMENT'; payload: RequestComment }
  | { type: 'CREATE_COMM'; payload: CommunicationLogEntry }

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
    case 'CREATE_STAKEHOLDER':
      return { ...state, stakeholders: [...state.stakeholders, action.payload] }
    case 'UPDATE_STAKEHOLDER':
      return {
        ...state,
        stakeholders: state.stakeholders.map((s) =>
          s.stakeholderId === action.payload.stakeholderId ? action.payload : s
        ),
      }
    case 'CREATE_RULE':
      return { ...state, approvalRules: [...state.approvalRules, action.payload] }
    case 'UPDATE_RULE':
      return {
        ...state,
        approvalRules: state.approvalRules.map((r) =>
          r.ruleId === action.payload.ruleId ? action.payload : r
        ),
      }
    case 'CREATE_REQUEST':
      return { ...state, requests: [...state.requests, action.payload] }
    case 'UPDATE_REQUEST':
      return {
        ...state,
        requests: state.requests.map((r) =>
          r.requestId === action.payload.requestId ? action.payload : r
        ),
      }
    case 'ADD_REQUEST_COMMENT':
      return { ...state, requestComments: [...state.requestComments, action.payload] }
    case 'CREATE_COMM':
      return { ...state, communicationLog: [...state.communicationLog, action.payload] }
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
  role: 'Engineer',
  strictMode: false,
  readOnlyMode: false,
}

const StakeholdersStoreContext = createContext<{
  state: StakeholdersState
  dispatch: React.Dispatch<StakeholdersAction>
  nextStakeholderId: () => string
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
