/**
 * OE-7 (#494) — unit tests for the pure `deriveGate` helper in
 * dashboardSummary.service.ts.
 *
 * Covers all five `GateState.state` values — `none`, `released`, `at-risk`,
 * `cleared`, `current` — and the `released` / `at-risk` precedence rules. The
 * RF-2 dashboard gate chip (DashboardPage.tsx) renders red for `at-risk` and
 * green for `cleared` / `released`; before this fix `deriveGate` never emitted
 * `at-risk` or `cleared`, leaving those chip branches dead.
 *
 * Pure function — no DB, no mocks.
 */
import { describe, it, expect } from 'vitest'
import { deriveGate } from '../services/dashboardSummary.service'
import type { GateSignal } from '../services/dashboardSummary.service'

/** A healthy, on-track signal — overridden per case. */
const HEALTHY: GateSignal = {
  hasDangerHealth: false,
  hasWarnHealth: false,
  overdueSignOffs: 0,
  progress: 50,
}

/** A non-terminal lifecycle phase row. */
const phase = (name: string, orderIndex = 1, isInitial = false) => ({
  name,
  orderIndex,
  isInitial,
})

describe('OE-7 deriveGate — all five GateState.state values', () => {
  it('state "none" — no lifecycle phase set', () => {
    const gate = deriveGate(null, HEALTHY)
    expect(gate.state).toBe('none')
    expect(gate.code).toBe('pre-SRR')
  })

  it('state "released" — a terminal release/closed/complete phase', () => {
    expect(deriveGate(phase('Release'), HEALTHY).state).toBe('released')
    expect(deriveGate(phase('Closed'), HEALTHY).state).toBe('released')
    expect(deriveGate(phase('Complete'), HEALTHY).state).toBe('released')
  })

  it('state "at-risk" — an active phase with a danger module-health verdict', () => {
    const gate = deriveGate(phase('CDR'), { ...HEALTHY, hasDangerHealth: true })
    expect(gate.state).toBe('at-risk')
    expect(gate.code).toBe('CDR')
  })

  it('state "at-risk" — an active phase with overdue sign-offs', () => {
    const gate = deriveGate(phase('PDR'), { ...HEALTHY, overdueSignOffs: 3 })
    expect(gate.state).toBe('at-risk')
  })

  it('state "cleared" — an active phase, healthy and fully progressed', () => {
    const gate = deriveGate(phase('CDR'), { ...HEALTHY, progress: 100 })
    expect(gate.state).toBe('cleared')
    expect(gate.code).toBe('CDR')
  })

  it('state "current" — an active phase, in progress, neither at-risk nor cleared', () => {
    const gate = deriveGate(phase('SRR'), HEALTHY)
    expect(gate.state).toBe('current')
    expect(gate.code).toBe('SRR')
  })
})

describe('OE-7 deriveGate — precedence rules', () => {
  it('a terminal phase is "released" even with a danger health / overdue sign-offs', () => {
    // released takes precedence — a delivered project is not "at-risk".
    const gate = deriveGate(phase('Release'), {
      hasDangerHealth: true,
      hasWarnHealth: true,
      overdueSignOffs: 5,
      progress: 100,
    })
    expect(gate.state).toBe('released')
  })

  it('"at-risk" beats "cleared" — a fully progressed but danger-health project is at-risk', () => {
    const gate = deriveGate(phase('CDR'), {
      ...HEALTHY,
      hasDangerHealth: true,
      progress: 100,
    })
    expect(gate.state).toBe('at-risk')
  })

  it('a warn-health project at 100% progress is "current", not "cleared"', () => {
    // `cleared` requires NO warn-level health — a project still showing a warn
    // chip has not cleanly met its exit criteria.
    const gate = deriveGate(phase('CDR'), {
      ...HEALTHY,
      hasWarnHealth: true,
      progress: 100,
    })
    expect(gate.state).toBe('current')
  })

  it('a healthy project below 100% progress is "current", not "cleared"', () => {
    const gate = deriveGate(phase('CDR'), { ...HEALTHY, progress: 99 })
    expect(gate.state).toBe('current')
  })
})

describe('OE-7 deriveGate — code truncation', () => {
  it('a phase name longer than 12 chars is truncated for the chip code', () => {
    const gate = deriveGate(phase('Preliminary Design Review'), HEALTHY)
    expect(gate.code).toBe('Preliminary ')
    expect(gate.code.length).toBe(12)
  })

  it('a short phase name is used verbatim', () => {
    expect(deriveGate(phase('PDR'), HEALTHY).code).toBe('PDR')
  })
})
