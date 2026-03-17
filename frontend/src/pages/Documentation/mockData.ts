import type {
  Document,
  Template,
  EvidencePack,
  ExportProfile,
  ExportHistoryItem,
} from './types'

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'DOC-001',
    title: 'System Requirements Specification',
    type: 'SRS',
    status: 'Approved',
    version: 'v1.0',
    owner: 'J. Smith',
    lastUpdated: '2025-01-15',
    source: 'Manual',
    tags: ['core', 'baseline'],
    sections: [
      {
        id: 'sec-1',
        title: 'Introduction',
        content: '<p>System overview and scope.</p>',
        orderIndex: 0,
        type: 'text',
        status: 'Complete',
      },
      {
        id: 'sec-2',
        title: 'Functional Requirements',
        content: '<p>Requirements list placeholder.</p>',
        orderIndex: 1,
        type: 'text',
        status: 'Draft',
      },
    ],
    linkedArtifacts: { requirements: 24, interfaces: 8, verification: 12 },
  },
  {
    id: 'DOC-002',
    title: 'Interface Control Document',
    type: 'ICD',
    status: 'In Review',
    version: 'v0.2',
    owner: 'A. Jones',
    lastUpdated: '2025-01-20',
    source: 'Mixed',
    tags: ['interfaces'],
    sections: [
      {
        id: 'sec-1',
        title: 'Interface Definitions',
        content: '<p>Interface list.</p>',
        orderIndex: 0,
        type: 'table',
        status: 'Complete',
      },
    ],
    linkedArtifacts: { interfaces: 15 },
  },
]

export const MOCK_TEMPLATES: Template[] = [
  {
    id: 'TPL-001',
    name: 'SRS Template',
    docType: 'SRS',
    scope: 'Company',
    sectionBlueprint: [
      { id: 'bp-1', title: 'Introduction', orderIndex: 0, type: 'text' },
      { id: 'bp-2', title: 'Scope', orderIndex: 1, type: 'text' },
      { id: 'bp-3', title: 'Requirements', orderIndex: 2, type: 'artifact_block' },
    ],
    lastUpdated: '2025-01-10',
  },
  {
    id: 'TPL-002',
    name: 'Test Report Template',
    docType: 'Test Report',
    scope: 'Project',
    sectionBlueprint: [
      { id: 'bp-1', title: 'Summary', orderIndex: 0, type: 'text' },
      { id: 'bp-2', title: 'Results', orderIndex: 1, type: 'table' },
    ],
    lastUpdated: '2025-01-12',
  },
]

export const MOCK_EVIDENCE_PACKS: EvidencePack[] = [
  {
    id: 'PACK-001',
    title: 'PDR Evidence Pack',
    purpose: 'PDR',
    status: 'Prepared',
    items: [
      { documentId: 'DOC-001', documentTitle: 'System Requirements Specification', version: 'v1.0', status: 'Approved' },
    ],
    lastUpdated: '2025-01-18',
  },
]

export const MOCK_EXPORT_PROFILES: ExportProfile[] = [
  {
    id: 'EXP-001',
    name: 'Standard PDF',
    format: 'PDF',
    headerFooter: true,
    numbering: true,
    includeManifest: true,
    watermark: 'None',
    defaultDocTypes: ['SRS', 'ICD'],
  },
  {
    id: 'EXP-002',
    name: 'Draft Package',
    format: 'ZIP',
    headerFooter: false,
    numbering: false,
    includeManifest: true,
    watermark: 'Draft',
    defaultDocTypes: [],
  },
]

export const MOCK_EXPORT_HISTORY: ExportHistoryItem[] = [
  {
    id: 'hist-001',
    timestamp: '2025-01-18T14:30:00',
    exportedBy: 'J. Smith',
    exportProfileName: 'Standard PDF',
    itemsCount: 2,
    outputLabel: 'documentation-export-20250118',
    notes: 'PDR prep',
    itemIds: ['DOC-001', 'DOC-002'],
    profileId: 'EXP-001',
  },
]

export const DOC_TYPES: { value: Document['type']; label: string }[] = [
  { value: 'SRS', label: 'SRS' },
  { value: 'ICD', label: 'ICD' },
  { value: 'VVP', label: 'VVP' },
  { value: 'Test Report', label: 'Test Report' },
  { value: 'Safety Plan', label: 'Safety Plan' },
  { value: 'Compliance Matrix', label: 'Compliance Matrix' },
  { value: 'Release Notes', label: 'Release Notes' },
  { value: 'ConOps', label: 'ConOps' },
]

export const DOC_STATUSES: Document['status'][] = ['Draft', 'In Review', 'Approved', 'Released']

export const EVIDENCE_PACK_PURPOSES: EvidencePack['purpose'][] = [
  'PDR',
  'CDR',
  'Certification',
  'Supplier Delivery',
  'Internal Review',
]

export const EXPORT_FORMATS: ExportProfile['format'][] = ['PDF', 'DOCX', 'ZIP']

export const WATERMARK_OPTIONS: ExportProfile['watermark'][] = ['None', 'Draft', 'Confidential']

export const TEMPLATE_SCOPES: Template['scope'][] = ['Company', 'Project', 'Personal']
