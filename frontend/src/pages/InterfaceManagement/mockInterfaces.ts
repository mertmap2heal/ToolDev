export type InterfaceType = 'Physical' | 'Electrical' | 'Data' | 'Software' | 'HMI'
export type InterfaceStatus = 'Draft' | 'Frozen' | 'Released'

export interface TechnicalCharacteristics {
  protocol?: string
  rate?: string
  latency?: string
  voltage?: string
  current?: string
  dimensions?: string
}

export interface TimelineEntry {
  label: string
  date: string
  user: string
}

export interface Interface {
  id: string
  name: string
  type: InterfaceType
  sourceElement: string
  targetElement: string
  status: InterfaceStatus
  owner: string
  lastUpdated: string
  description?: string
  constraints?: string[]
  technicalCharacteristics?: TechnicalCharacteristics
  customFields?: Record<string, string>
  timeline?: TimelineEntry[]
}

export const MOCK_INTERFACES: Interface[] = [
  {
    id: 'IF-001',
    name: 'FCS to Actuator CAN Bus',
    type: 'Data',
    sourceElement: 'FCS Controller',
    targetElement: 'Actuator Unit',
    status: 'Released',
    owner: 'Avionics',
    lastUpdated: '2025-01-28T14:30:00Z',
    description: 'CAN 2.0B interface for flight control commands.',
    constraints: ['Max 1 Mbps', 'Redundant path required'],
    technicalCharacteristics: { protocol: 'CAN 2.0B', rate: '1 Mbps', latency: '< 5 ms' },
    timeline: [
      { label: 'Created', date: '2025-01-15T09:00:00Z', user: 'System' },
      { label: 'Updated', date: '2025-01-20T14:30:00Z', user: 'J. Smith' },
      { label: 'Status set to Released', date: '2025-01-28T14:30:00Z', user: 'J. Smith' },
    ],
  },
  {
    id: 'IF-002',
    name: 'Sensor Power Supply',
    type: 'Electrical',
    sourceElement: 'Power Distribution Unit',
    targetElement: 'IMU Sensor',
    status: 'Frozen',
    owner: 'Power Systems',
    lastUpdated: '2025-01-27T09:15:00Z',
    description: '28V DC power feed to inertial measurement unit.',
    constraints: ['Voltage tolerance ±5%'],
    technicalCharacteristics: { voltage: '28V DC', current: '2A max' },
    timeline: [
      { label: 'Created', date: '2025-01-10T09:00:00Z', user: 'System' },
      { label: 'Status set to Frozen', date: '2025-01-27T09:15:00Z', user: 'A. Doe' },
    ],
  },
  {
    id: 'IF-003',
    name: 'Hatch Mechanical Interface',
    type: 'Physical',
    sourceElement: 'Fuselage',
    targetElement: 'Access Hatch',
    status: 'Draft',
    owner: 'Structures',
    lastUpdated: '2025-01-26T16:45:00Z',
    description: 'Mechanical mounting and seal interface for service hatch.',
    constraints: ['IP67 seal', 'Quick-release pins'],
    technicalCharacteristics: { dimensions: '600mm x 400mm' },
    timeline: [
      { label: 'Created', date: '2025-01-26T16:45:00Z', user: 'J. Smith' },
      { label: 'Description revised', date: '2025-01-26T17:00:00Z', user: 'J. Smith' },
    ],
  },
  {
    id: 'IF-004',
    name: 'Ground Station Telemetry',
    type: 'Software',
    sourceElement: 'Flight Computer',
    targetElement: 'Ground Control Station',
    status: 'Released',
    owner: 'Software',
    lastUpdated: '2025-01-25T11:00:00Z',
    description: 'UDP telemetry stream to GCS.',
    constraints: ['Encrypted channel'],
    technicalCharacteristics: { protocol: 'UDP', rate: '100 Hz' },
    timeline: [
      { label: 'Created', date: '2025-01-20T09:00:00Z', user: 'System' },
      { label: 'Updated', date: '2025-01-25T11:00:00Z', user: 'A. Doe' },
    ],
  },
  {
    id: 'IF-005',
    name: 'Cockpit Display Interface',
    type: 'HMI',
    sourceElement: 'Display Controller',
    targetElement: 'Primary Flight Display',
    status: 'Frozen',
    owner: 'Human Factors',
    lastUpdated: '2025-01-24T08:30:00Z',
    description: 'ARINC 661 display interface for PFD.',
    constraints: ['Min 60 fps'],
    timeline: [
      { label: 'Created', date: '2025-01-22T09:00:00Z', user: 'System' },
      { label: 'Status set to Frozen', date: '2025-01-24T08:30:00Z', user: 'J. Smith' },
    ],
  },
  {
    id: 'IF-006',
    name: 'Hydraulic Pump Drive',
    type: 'Physical',
    sourceElement: 'Engine Accessory Gearbox',
    targetElement: 'Hydraulic Pump',
    status: 'Draft',
    owner: 'Propulsion',
    lastUpdated: '2025-01-23T14:20:00Z',
    description: 'Spline drive interface for hydraulic pump.',
    technicalCharacteristics: { dimensions: 'Spline 10T, 20mm' },
    timeline: [
      { label: 'Created', date: '2025-01-23T14:20:00Z', user: 'System' },
    ],
  },
  {
    id: 'IF-007',
    name: 'Ethernet Avionics Backbone',
    type: 'Data',
    sourceElement: 'Avionics Switch',
    targetElement: 'Mission Computer',
    status: 'Released',
    owner: 'Avionics',
    lastUpdated: '2025-01-22T10:00:00Z',
    description: 'Gigabit Ethernet AFDX for avionics network.',
    constraints: ['Deterministic latency', 'Dual redundant'],
    technicalCharacteristics: { protocol: 'AFDX', rate: '1 Gbps', latency: '< 1 ms' },
    timeline: [
      { label: 'Created', date: '2025-01-18T09:00:00Z', user: 'System' },
      { label: 'Updated', date: '2025-01-22T10:00:00Z', user: 'A. Doe' },
    ],
  },
]
