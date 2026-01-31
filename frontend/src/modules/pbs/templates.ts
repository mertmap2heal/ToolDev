/**
 * PBS Templates - Predefined structures for quick start
 */

import type { PBSNode } from './types'
import { generateId, nowISO } from './utils'

export interface PBSTemplate {
  id: string
  name: string
  description: string
  icon: string
  nodes: TemplateNode[]
}

interface TemplateNode {
  name: string
  type: PBSNode['type']
  children?: TemplateNode[]
}

// Helper to convert template structure to PBSNode array
function buildNodesFromTemplate(
  template: TemplateNode[],
  parentId: string | null = null,
  parentCode: string | null = null,
  startIndex: number = 0
): PBSNode[] {
  const nodes: PBSNode[] = []
  const now = nowISO()

  template.forEach((item, index) => {
    const id = generateId()
    const codeIndex = startIndex + index + 1
    const pbsCode = parentCode ? `${parentCode}.${codeIndex}` : `PBS-${codeIndex}`

    const node: PBSNode = {
      id,
      parentId,
      name: item.name,
      pbsCode,
      type: item.type,
      status: 'Draft',
      description: '',
      tags: [],
      attributes: [],
      relationships: [],
      attachments: [],
      orderIndex: index,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }

    nodes.push(node)

    if (item.children && item.children.length > 0) {
      const childNodes = buildNodesFromTemplate(item.children, id, pbsCode, 0)
      nodes.push(...childNodes)
    }
  })

  return nodes
}

export const PBS_TEMPLATES: PBSTemplate[] = [
  {
    id: 'vehicle',
    name: 'Vehicle System',
    description: 'Automotive or transportation vehicle breakdown',
    icon: '🚗',
    nodes: [
      {
        name: 'Vehicle',
        type: 'System',
        children: [
          {
            name: 'Powertrain',
            type: 'Subsystem',
            children: [
              { name: 'Engine', type: 'Assembly' },
              { name: 'Transmission', type: 'Assembly' },
              { name: 'Drivetrain', type: 'Assembly' },
            ],
          },
          {
            name: 'Chassis',
            type: 'Subsystem',
            children: [
              { name: 'Frame', type: 'Assembly' },
              { name: 'Suspension', type: 'Assembly' },
              { name: 'Steering', type: 'Assembly' },
              { name: 'Brakes', type: 'Assembly' },
            ],
          },
          {
            name: 'Body',
            type: 'Subsystem',
            children: [
              { name: 'Exterior', type: 'Assembly' },
              { name: 'Interior', type: 'Assembly' },
            ],
          },
          {
            name: 'Electrical',
            type: 'Subsystem',
            children: [
              { name: 'Power Distribution', type: 'Assembly' },
              { name: 'Lighting', type: 'Assembly' },
              { name: 'Infotainment', type: 'Assembly' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'software',
    name: 'Software Project',
    description: 'Software application architecture breakdown',
    icon: '💻',
    nodes: [
      {
        name: 'Application',
        type: 'System',
        children: [
          {
            name: 'Frontend',
            type: 'Subsystem',
            children: [
              { name: 'UI Components', type: 'Software' },
              { name: 'State Management', type: 'Software' },
              { name: 'API Client', type: 'Software' },
            ],
          },
          {
            name: 'Backend',
            type: 'Subsystem',
            children: [
              { name: 'API Layer', type: 'Software' },
              { name: 'Business Logic', type: 'Software' },
              { name: 'Data Access', type: 'Software' },
            ],
          },
          {
            name: 'Infrastructure',
            type: 'Subsystem',
            children: [
              { name: 'Database', type: 'Software' },
              { name: 'Cache', type: 'Software' },
              { name: 'Message Queue', type: 'Software' },
            ],
          },
          {
            name: 'Documentation',
            type: 'Document',
            children: [
              { name: 'API Docs', type: 'Document' },
              { name: 'User Guide', type: 'Document' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'electronics',
    name: 'Electronics System',
    description: 'Electronic device or PCB breakdown',
    icon: '🔌',
    nodes: [
      {
        name: 'Electronic Device',
        type: 'System',
        children: [
          {
            name: 'Power Supply',
            type: 'Subsystem',
            children: [
              { name: 'AC-DC Converter', type: 'Assembly' },
              { name: 'Voltage Regulators', type: 'Assembly' },
              { name: 'Battery Management', type: 'Assembly' },
            ],
          },
          {
            name: 'Processing Unit',
            type: 'Subsystem',
            children: [
              { name: 'MCU/CPU', type: 'Part' },
              { name: 'Memory', type: 'Part' },
              { name: 'Storage', type: 'Part' },
            ],
          },
          {
            name: 'I/O Interfaces',
            type: 'Subsystem',
            children: [
              { name: 'Communication', type: 'Assembly' },
              { name: 'Sensors', type: 'Assembly' },
              { name: 'Actuators', type: 'Assembly' },
            ],
          },
          {
            name: 'Enclosure',
            type: 'Assembly',
            children: [
              { name: 'Housing', type: 'Part' },
              { name: 'Connectors', type: 'Part' },
              { name: 'Thermal Management', type: 'Part' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'aerospace',
    name: 'Aerospace System',
    description: 'Aircraft or spacecraft breakdown',
    icon: '✈️',
    nodes: [
      {
        name: 'Aircraft',
        type: 'System',
        children: [
          {
            name: 'Airframe',
            type: 'Subsystem',
            children: [
              { name: 'Fuselage', type: 'Assembly' },
              { name: 'Wings', type: 'Assembly' },
              { name: 'Empennage', type: 'Assembly' },
              { name: 'Landing Gear', type: 'Assembly' },
            ],
          },
          {
            name: 'Propulsion',
            type: 'Subsystem',
            children: [
              { name: 'Engines', type: 'Assembly' },
              { name: 'Fuel System', type: 'Assembly' },
            ],
          },
          {
            name: 'Avionics',
            type: 'Subsystem',
            children: [
              { name: 'Flight Control', type: 'Software' },
              { name: 'Navigation', type: 'Assembly' },
              { name: 'Communication', type: 'Assembly' },
            ],
          },
          {
            name: 'Systems',
            type: 'Subsystem',
            children: [
              { name: 'Hydraulic', type: 'Assembly' },
              { name: 'Electrical', type: 'Assembly' },
              { name: 'Environmental Control', type: 'Assembly' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'medical',
    name: 'Medical Device',
    description: 'Medical equipment breakdown',
    icon: '🏥',
    nodes: [
      {
        name: 'Medical Device',
        type: 'System',
        children: [
          {
            name: 'Sensing Module',
            type: 'Subsystem',
            children: [
              { name: 'Sensors', type: 'Assembly' },
              { name: 'Signal Conditioning', type: 'Assembly' },
            ],
          },
          {
            name: 'Processing Module',
            type: 'Subsystem',
            children: [
              { name: 'Data Acquisition', type: 'Software' },
              { name: 'Signal Processing', type: 'Software' },
              { name: 'Algorithm Engine', type: 'Software' },
            ],
          },
          {
            name: 'User Interface',
            type: 'Subsystem',
            children: [
              { name: 'Display', type: 'Part' },
              { name: 'Controls', type: 'Part' },
              { name: 'Software UI', type: 'Software' },
            ],
          },
          {
            name: 'Compliance Docs',
            type: 'Document',
            children: [
              { name: 'FDA Submission', type: 'Document' },
              { name: 'Risk Analysis', type: 'Document' },
              { name: 'Test Reports', type: 'Document' },
            ],
          },
        ],
      },
    ],
  },
]

export function generateNodesFromTemplate(templateId: string): PBSNode[] {
  const template = PBS_TEMPLATES.find((t) => t.id === templateId)
  if (!template) return []
  return buildNodesFromTemplate(template.nodes)
}
