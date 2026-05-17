import type { Baseline, ReleasePackage, AuditEvent } from './types'

// NX-3 (#443): MOCK_CONFIGURATION_ITEMS / MOCK_CHANGE_REQUESTS /
// MOCK_DEVIATIONS_WAIVERS were removed — the Configuration Items, Changes
// (CCB), and Deviations & Waivers tabs are backed by real APIs now. The
// seeds below remain for the not-yet-migrated Baselines / Releases / Audit
// Trail tabs until their own tickets (CM-N4 / CM-N7 / CM-L6) land.

const now = new Date()
const iso = (d: Date) => d.toISOString()

export const MOCK_BASELINES: Baseline[] = [
  {
    baselineId: 'BL-2026-03-PDR',
    name: 'PDR Functional Baseline',
    type: 'Functional',
    phase: 'PDR',
    status: 'Frozen',
    createdBy: 'J. Smith',
    createdAt: iso(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    approvedBy: 'L. Davis',
    approvedAt: iso(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)),
    ciSnapshot: [
      { ciId: 'CI-REQ-014', version: '2.0.0', revision: 'Rev B' },
      { ciId: 'CI-DOC-101', version: '1.0.0', revision: 'Rev A' },
      { ciId: 'CI-PAR-007', version: '1.0.0', revision: 'Rev A' },
    ],
    notes: 'PDR baseline for flight control and design docs.',
    complianceFlags: { do178c: true, arp4754a: true, en9100: true },
  },
  {
    baselineId: 'BL-2026-05-CDR',
    name: 'CDR Allocated Baseline',
    type: 'Allocated',
    phase: 'CDR',
    status: 'Submitted',
    createdBy: 'A. Lee',
    createdAt: iso(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
    ciSnapshot: [
      { ciId: 'CI-REQ-014', version: '2.1.0', revision: 'Rev C' },
      { ciId: 'CI-SW-002', version: '1.4.0', revision: 'Rev B' },
      { ciId: 'CI-DOC-101', version: '1.0.0', revision: 'Rev A' },
      { ciId: 'CI-PAR-007', version: '1.0.0', revision: 'Rev A' },
      { ciId: 'CI-TC-022', version: '1.1.0', revision: 'Rev B' },
    ],
    notes: 'CDR allocated baseline including software and test cases.',
    complianceFlags: { do178c: true, arp4754a: true, en9100: true },
  },
  {
    baselineId: 'BL-2026-01-SRR',
    name: 'SRR Product Baseline',
    type: 'Product',
    phase: 'SRR',
    status: 'Superseded',
    createdBy: 'M. Chen',
    createdAt: iso(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)),
    approvedBy: 'L. Davis',
    approvedAt: iso(new Date(now.getTime() - 88 * 24 * 60 * 60 * 1000)),
    ciSnapshot: [
      { ciId: 'CI-REQ-014', version: '1.0.0', revision: 'Rev A' },
      { ciId: 'CI-DOC-101', version: '0.9.0', revision: 'Rev 0' },
    ],
    notes: 'Superseded by PDR baseline.',
    complianceFlags: { do178c: false, arp4754a: true, en9100: false },
  },
]

export const MOCK_RELEASES: ReleasePackage[] = [
  {
    releaseId: 'REL-2026.04',
    name: 'April 2026 internal build',
    target: 'Internal',
    status: 'Approved',
    baselineRef: 'BL-2026-03-PDR',
    includedItems: [
      { ciId: 'CI-REQ-014', version: '2.0.0', revision: 'Rev B' },
      { ciId: 'CI-DOC-101', version: '1.0.0', revision: 'Rev A' },
      { ciId: 'CI-PAR-007', version: '1.0.0', revision: 'Rev A' },
    ],
    releaseNotes:
      'PDR baseline release for internal testing.\n\n- Flight control requirements v2.0\n- System design document v1.0\n- Parameter set v1.0',
    approvals: [
      {
        role: 'Config Manager',
        name: 'L. Davis',
        signedAt: iso(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
      },
      {
        role: 'CCB Chair',
        name: 'J. Smith',
        signedAt: iso(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
      },
    ],
  },
  {
    releaseId: 'REL-2026.03',
    name: 'March 2026 customer delivery',
    target: 'Customer',
    status: 'Draft',
    baselineRef: 'BL-2026-05-CDR',
    includedItems: [],
    releaseNotes: '',
    approvals: [],
  },
]

export const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    eventId: 'EV-099',
    timestamp: iso(new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)),
    actor: 'L. Davis',
    action: 'APPROVE_RELEASE',
    objectRef: 'REL-2026.04',
    details: 'Release approved for internal delivery',
  },
  {
    eventId: 'EV-097',
    timestamp: iso(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)),
    actor: 'L. Davis',
    action: 'APPROVE_BASELINE',
    objectRef: 'BL-2026-03-PDR',
    details: 'PDR baseline approved',
  },
  {
    eventId: 'EV-096',
    timestamp: iso(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    actor: 'J. Smith',
    action: 'FREEZE_BASELINE',
    objectRef: 'BL-2026-03-PDR',
    details: 'PDR baseline frozen',
  },
]
