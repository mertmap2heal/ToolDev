import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Reducer,
} from 'react'
import type {
  ConfigurationItem,
  Baseline,
  ChangeRequest,
  ReleasePackage,
  DeviationWaiver,
  AuditEvent,
  CMRole,
} from './types'
import {
  MOCK_CONFIGURATION_ITEMS,
  MOCK_BASELINES,
  MOCK_CHANGE_REQUESTS,
  MOCK_RELEASES,
  MOCK_DEVIATIONS_WAIVERS,
  MOCK_AUDIT_EVENTS,
} from './mockData'

export interface CMState {
  configurationItems: ConfigurationItem[]
  baselines: Baseline[]
  changeRequests: ChangeRequest[]
  releases: ReleasePackage[]
  deviationsWaivers: DeviationWaiver[]
  auditLog: AuditEvent[]
  currentRole: CMRole
  strictMode: boolean
  auditMode: boolean
}

type CMAction =
  | { type: 'ADD_CI'; payload: ConfigurationItem }
  | { type: 'UPDATE_CI'; payload: ConfigurationItem }
  | { type: 'DELETE_CI'; payload: string }
  | { type: 'SET_CI_LOCK'; payload: { ciId: string; lockState: ConfigurationItem['lockState'] } }
  | { type: 'ADD_BASELINE'; payload: Baseline }
  | { type: 'UPDATE_BASELINE'; payload: Baseline }
  | { type: 'APPROVE_BASELINE'; payload: { baselineId: string; approvedBy: string } }
  | { type: 'FREEZE_BASELINE'; payload: string }
  | { type: 'ADD_CR'; payload: ChangeRequest }
  | { type: 'UPDATE_CR'; payload: ChangeRequest }
  | { type: 'APPROVE_CR'; payload: { crId: string; decisionBy: string } }
  | { type: 'REJECT_CR'; payload: { crId: string; decisionBy: string } }
  | { type: 'APPLY_CR_VERSIONS'; payload: string }
  | { type: 'ADD_RELEASE'; payload: ReleasePackage }
  | { type: 'UPDATE_RELEASE'; payload: ReleasePackage }
  | { type: 'APPROVE_RELEASE'; payload: { releaseId: string } }
  | { type: 'ADD_DW'; payload: DeviationWaiver }
  | { type: 'UPDATE_DW'; payload: DeviationWaiver }
  | { type: 'APPROVE_DW'; payload: { dwId: string } }
  | { type: 'REJECT_DW'; payload: { dwId: string } }
  | { type: 'ADD_AUDIT'; payload: Omit<AuditEvent, 'eventId'> }
  | { type: 'SET_ROLE'; payload: CMRole }
  | { type: 'SET_STRICT_MODE'; payload: boolean }
  | { type: 'SET_AUDIT_MODE'; payload: boolean }

function nextEventId(log: AuditEvent[]): string {
  const nums = log
    .map((e) => {
      const m = e.eventId.match(/EV-(\d+)/)
      return m ? parseInt(m[1], 10) : 0
    })
    .filter((n) => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `EV-${String(max + 1).padStart(3, '0')}`
}

function reducer(state: CMState, action: CMAction): CMState {
  const addAudit = (e: Omit<AuditEvent, 'eventId'>): AuditEvent[] => {
    const eventId = nextEventId(state.auditLog)
    return [...state.auditLog, { ...e, eventId }]
  }

  switch (action.type) {
    case 'ADD_CI': {
      const audit = addAudit({
        timestamp: new Date().toISOString(),
        actor: state.currentRole,
        action: 'CREATE_CI',
        objectRef: action.payload.ciId,
        details: `Created ${action.payload.name}`,
      })
      return {
        ...state,
        configurationItems: [action.payload, ...state.configurationItems],
        auditLog: audit,
      }
    }
    case 'UPDATE_CI': {
      const audit = addAudit({
        timestamp: new Date().toISOString(),
        actor: state.currentRole,
        action: 'UPDATE_CI',
        objectRef: action.payload.ciId,
        details: `Updated ${action.payload.name}`,
      })
      return {
        ...state,
        configurationItems: state.configurationItems.map((c) =>
          c.ciId === action.payload.ciId ? action.payload : c
        ),
        auditLog: audit,
      }
    }
    case 'DELETE_CI': {
      const audit = addAudit({
        timestamp: new Date().toISOString(),
        actor: state.currentRole,
        action: 'UPDATE_CI',
        objectRef: action.payload,
        details: 'CI deleted',
      })
      return {
        ...state,
        configurationItems: state.configurationItems.filter((c) => c.ciId !== action.payload),
        auditLog: audit,
      }
    }
    case 'SET_CI_LOCK': {
      const audit = addAudit({
        timestamp: new Date().toISOString(),
        actor: state.currentRole,
        action: action.payload.lockState === 'Unlocked' ? 'UNLOCK_CI' : 'LOCK_CI',
        objectRef: action.payload.ciId,
        details: `Lock state set to ${action.payload.lockState}`,
      })
      return {
        ...state,
        configurationItems: state.configurationItems.map((c) =>
          c.ciId === action.payload.ciId ? { ...c, lockState: action.payload.lockState } : c
        ),
        auditLog: audit,
      }
    }
    case 'ADD_BASELINE':
      return { ...state, baselines: [action.payload, ...state.baselines] }
    case 'UPDATE_BASELINE':
      return {
        ...state,
        baselines: state.baselines.map((b) =>
          b.baselineId === action.payload.baselineId ? action.payload : b
        ),
      }
    case 'APPROVE_BASELINE': {
      const now = new Date().toISOString()
      const audit = addAudit({
        timestamp: now,
        actor: action.payload.approvedBy,
        action: 'APPROVE_BASELINE',
        objectRef: action.payload.baselineId,
        details: 'Baseline approved',
      })
      return {
        ...state,
        baselines: state.baselines.map((b) =>
          b.baselineId === action.payload.baselineId
            ? { ...b, status: 'Approved' as const, approvedBy: action.payload.approvedBy, approvedAt: now }
            : b
        ),
        auditLog: audit,
      }
    }
    case 'FREEZE_BASELINE': {
      const audit = addAudit({
        timestamp: new Date().toISOString(),
        actor: state.currentRole,
        action: 'FREEZE_BASELINE',
        objectRef: action.payload,
        details: 'Baseline frozen',
      })
      return {
        ...state,
        baselines: state.baselines.map((b) =>
          b.baselineId === action.payload ? { ...b, status: 'Frozen' as const } : b
        ),
        auditLog: audit,
      }
    }
    case 'ADD_CR':
      return { ...state, changeRequests: [action.payload, ...state.changeRequests] }
    case 'UPDATE_CR':
      return {
        ...state,
        changeRequests: state.changeRequests.map((r) =>
          r.crId === action.payload.crId ? action.payload : r
        ),
      }
    case 'APPROVE_CR': {
      const now = new Date().toISOString()
      const audit = addAudit({
        timestamp: now,
        actor: action.payload.decisionBy,
        action: 'APPROVE_CR',
        objectRef: action.payload.crId,
        details: 'Change request approved',
      })
      return {
        ...state,
        changeRequests: state.changeRequests.map((r) =>
          r.crId === action.payload.crId
            ? { ...r, status: 'Approved', decisionBy: action.payload.decisionBy, decisionAt: now }
            : r
        ),
        auditLog: audit,
      }
    }
    case 'REJECT_CR': {
      const now = new Date().toISOString()
      const audit = addAudit({
        timestamp: now,
        actor: action.payload.decisionBy,
        action: 'REJECT_CR',
        objectRef: action.payload.crId,
        details: 'Change request rejected',
      })
      return {
        ...state,
        changeRequests: state.changeRequests.map((r) =>
          r.crId === action.payload.crId
            ? { ...r, status: 'Rejected', decisionBy: action.payload.decisionBy, decisionAt: now }
            : r
        ),
        auditLog: audit,
      }
    }
    case 'APPLY_CR_VERSIONS': {
      const cr = state.changeRequests.find((r) => r.crId === action.payload)
      if (!cr || cr.status !== 'Approved') return state
      const nextVersion = (v: string): string => {
        const parts = v.split('.')
        if (parts.length >= 2) {
          const minor = parseInt(parts[parts.length - 1], 10)
          if (!Number.isNaN(minor)) {
            parts[parts.length - 1] = String(minor + 1)
            return parts.join('.')
          }
        }
        return `${v}.1`
      }
      const nextRevision = (rev: string): string => {
        const m = rev.match(/Rev\s*([A-Z])/i)
        if (m) {
          const letter = m[1].toUpperCase()
          const code = letter.charCodeAt(0)
          return code >= 90 ? 'Rev A' : `Rev ${String.fromCharCode(code + 1)}`
        }
        return 'Rev A'
      }
      const now = new Date().toISOString()
      const updatedCIs = state.configurationItems.map((c) => {
        if (!cr.impactedCIs.includes(c.ciId)) return c
        return {
          ...c,
          version: nextVersion(c.version),
          revision: nextRevision(c.revision),
          lastModified: now,
        }
      })
      const audit = addAudit({
        timestamp: now,
        actor: state.currentRole,
        action: 'APPLY_CR_VERSIONS',
        objectRef: action.payload,
        details: 'Version updates applied to impacted CIs',
      })
      return {
        ...state,
        configurationItems: updatedCIs,
        changeRequests: state.changeRequests.map((r) =>
          r.crId === action.payload ? { ...r, status: 'Implemented' as const } : r
        ),
        auditLog: audit,
      }
    }
    case 'ADD_RELEASE':
      return { ...state, releases: [action.payload, ...state.releases] }
    case 'UPDATE_RELEASE':
      return {
        ...state,
        releases: state.releases.map((r) =>
          r.releaseId === action.payload.releaseId ? action.payload : r
        ),
      }
    case 'APPROVE_RELEASE': {
      const release = state.releases.find((r) => r.releaseId === action.payload.releaseId)
      if (!release) return state
      const now = new Date().toISOString()
      const audit = addAudit({
        timestamp: now,
        actor: state.currentRole,
        action: 'CREATE_RELEASE',
        objectRef: action.payload.releaseId,
        details: 'Release approved',
      })
      return {
        ...state,
        releases: state.releases.map((r) =>
          r.releaseId === action.payload.releaseId
            ? {
                ...r,
                status: 'Approved',
                approvals: [
                  ...r.approvals,
                  { role: 'Config Manager', name: state.currentRole, signedAt: now },
                ],
              }
            : r
        ),
        auditLog: audit,
      }
    }
    case 'ADD_DW':
      return { ...state, deviationsWaivers: [action.payload, ...state.deviationsWaivers] }
    case 'UPDATE_DW':
      return {
        ...state,
        deviationsWaivers: state.deviationsWaivers.map((d) =>
          d.dwId === action.payload.dwId ? action.payload : d
        ),
      }
    case 'APPROVE_DW': {
      const audit = addAudit({
        timestamp: new Date().toISOString(),
        actor: state.currentRole,
        action: 'APPROVE_DW',
        objectRef: action.payload.dwId,
        details: 'Deviation/Waiver approved',
      })
      return {
        ...state,
        deviationsWaivers: state.deviationsWaivers.map((d) =>
          d.dwId === action.payload.dwId ? { ...d, status: 'Approved' as const } : d
        ),
        auditLog: audit,
      }
    }
    case 'REJECT_DW':
      return {
        ...state,
        deviationsWaivers: state.deviationsWaivers.map((d) =>
          d.dwId === action.payload.dwId ? { ...d, status: 'Rejected' as const } : d
        ),
      }
    case 'ADD_AUDIT': {
      const eventId = nextEventId(state.auditLog)
      return {
        ...state,
        auditLog: [...state.auditLog, { ...action.payload, eventId }],
      }
    }
    case 'SET_ROLE':
      return { ...state, currentRole: action.payload }
    case 'SET_STRICT_MODE':
      return { ...state, strictMode: action.payload }
    case 'SET_AUDIT_MODE':
      return { ...state, auditMode: action.payload }
    default:
      return state
  }
}

const initialState: CMState = {
  configurationItems: [...MOCK_CONFIGURATION_ITEMS],
  baselines: [...MOCK_BASELINES],
  changeRequests: [...MOCK_CHANGE_REQUESTS],
  releases: [...MOCK_RELEASES],
  deviationsWaivers: [...MOCK_DEVIATIONS_WAIVERS],
  auditLog: [...MOCK_AUDIT_EVENTS],
  currentRole: 'ConfigManager',
  strictMode: false,
  auditMode: false,
}

const CMStoreContext = createContext<{ state: CMState; dispatch: React.Dispatch<CMAction> } | null>(
  null
)

export function CMStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer<Reducer<CMState, CMAction>>(reducer, initialState)
  return React.createElement(CMStoreContext.Provider, { value: { state, dispatch } }, children)
}

export function useCMStore() {
  const ctx = useContext(CMStoreContext)
  if (!ctx) throw new Error('useCMStore must be used within CMStoreProvider')
  return ctx
}

// Helpers for ID generation (used by modals/wizards)
export function useNextIds() {
  const { state } = useCMStore()
  const nextCiId = useCallback(() => {
    const nums = state.configurationItems
      .map((c) => {
        const m = c.ciId.match(/CI-[A-Z]+-(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !Number.isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    const prefix = 'CI-REQ-'
    return `${prefix}${String(max + 1).padStart(3, '0')}`
  }, [state.configurationItems])
  const nextBaselineId = useCallback(() => {
    const nums = state.baselines
      .map((b) => {
        const m = b.baselineId.match(/BL-(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !Number.isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    const y = new Date().getFullYear()
    const m = new Date().getMonth() + 1
    return `BL-${y}-${String(m).padStart(2, '0')}-${max + 1}`
  }, [state.baselines])
  const nextCRId = useCallback(() => {
    const nums = state.changeRequests
      .map((r) => {
        const m = r.crId.match(/CR-(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !Number.isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `CR-${String(max + 1).padStart(3, '0')}`
  }, [state.changeRequests])
  const nextReleaseId = useCallback(() => {
    const y = new Date().getFullYear()
    const m = new Date().getMonth() + 1
    return `REL-${y}.${String(m).padStart(2, '0')}`
  }, [])
  const nextDWId = useCallback(() => {
    const nums = state.deviationsWaivers
      .map((d) => {
        const m = d.dwId.match(/DW-(\d+)/)
        return m ? parseInt(m[1], 10) : 0
      })
      .filter((n) => !Number.isNaN(n))
    const max = nums.length ? Math.max(...nums) : 0
    return `DW-${String(max + 1).padStart(3, '0')}`
  }, [state.deviationsWaivers])
  return { nextCiId, nextBaselineId, nextCRId, nextReleaseId, nextDWId }
}
