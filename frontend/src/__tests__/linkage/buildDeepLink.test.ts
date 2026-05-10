import { describe, it, expect } from 'vitest'
import { buildDeepLink } from '@/linkage/buildDeepLink'
import type { EntityRef } from 'shared/types/linkage.types'

const PROJECT_ID = 'proj-123'
const ENTITY_ID = 'entity-456'

function ref(type: EntityRef['type']): EntityRef {
  return { type, id: ENTITY_ID }
}

describe('buildDeepLink', () => {
  it('routes requirement to /requirements with focus params', () => {
    expect(buildDeepLink(PROJECT_ID, ref('requirement'))).toBe(
      `/projects/${PROJECT_ID}/requirements?focusType=requirement&focusId=${ENTITY_ID}`
    )
  })

  it('routes function via functionAdapter', () => {
    expect(buildDeepLink(PROJECT_ID, ref('function'))).toBe(
      `/projects/${PROJECT_ID}/functions?selectedId=${ENTITY_ID}`
    )
  })

  it('routes pbs_component via pbsAdapter', () => {
    expect(buildDeepLink(PROJECT_ID, ref('pbs_component'))).toBe(
      `/projects/${PROJECT_ID}/product-breakdown-structure?focusType=pbs_component&focusId=${ENTITY_ID}`
    )
  })

  it('routes issue via issueAdapter', () => {
    expect(buildDeepLink(PROJECT_ID, ref('issue'))).toBe(
      `/projects/${PROJECT_ID}/issues/${ENTITY_ID}`
    )
  })

  it('routes task via taskAdapter', () => {
    expect(buildDeepLink(PROJECT_ID, ref('task'))).toBe(
      `/projects/${PROJECT_ID}/tasks?focusType=task&focusId=${ENTITY_ID}`
    )
  })

  it('routes hazard via hazardAdapter', () => {
    expect(buildDeepLink(PROJECT_ID, ref('hazard'))).toBe(
      `/projects/${PROJECT_ID}/safety-analysis/hazards?focusType=hazard&focusId=${ENTITY_ID}`
    )
  })

  it('routes verification entity types via verificationAdapter', () => {
    expect(buildDeepLink(PROJECT_ID, ref('test_plan'))).toBe(
      `/projects/${PROJECT_ID}/verification?focusType=test_plan&focusId=${ENTITY_ID}`
    )
    expect(buildDeepLink(PROJECT_ID, ref('test_case'))).toBe(
      `/projects/${PROJECT_ID}/verification?focusType=test_case&focusId=${ENTITY_ID}`
    )
    expect(buildDeepLink(PROJECT_ID, ref('test_result'))).toBe(
      `/projects/${PROJECT_ID}/verification?focusType=test_result&focusId=${ENTITY_ID}`
    )
  })

  it('falls back to project home for parameter (adapter exists but is not registered)', () => {
    // The parameterAdapter file exists at src/linkage/adapters/parameterAdapter.ts
    // but is NOT inserted into ADAPTER_MAP — current behaviour falls through
    // to the project landing page. This test pins that behaviour so a future
    // wire-up does not silently change the URL shape without updating this
    // test.
    expect(buildDeepLink(PROJECT_ID, ref('parameter'))).toBe(
      `/projects/${PROJECT_ID}`
    )
  })

  it('falls back to project home for an unregistered entity type', () => {
    expect(buildDeepLink(PROJECT_ID, ref('lifecycle_status'))).toBe(
      `/projects/${PROJECT_ID}`
    )
  })

  it('preserves projectId and id in the constructed URL', () => {
    const url = buildDeepLink('special-proj', { type: 'task', id: 'special-id' })
    expect(url).toContain('special-proj')
    expect(url).toContain('special-id')
  })
})
