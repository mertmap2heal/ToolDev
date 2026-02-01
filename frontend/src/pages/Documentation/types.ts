export type DocumentType =
  | 'SRS'
  | 'ICD'
  | 'VVP'
  | 'Test Report'
  | 'Safety Plan'
  | 'Compliance Matrix'
  | 'Release Notes'
  | 'ConOps'

export type DocumentStatus = 'Draft' | 'In Review' | 'Approved' | 'Released'

export type DocumentSource = 'Manual' | 'Generated' | 'Mixed'

export type SectionType = 'text' | 'table' | 'image' | 'artifact_block' | 'generated_block'

export type SectionStatus = 'Draft' | 'Complete'

export interface LinkedArtifacts {
  requirements?: number
  interfaces?: number
  verification?: number
  risks?: number
  issues?: number
  changeRequests?: number
}

export interface DocumentSection {
  id: string
  title: string
  content: string
  orderIndex: number
  type: SectionType
  status: SectionStatus
}

export interface Document {
  id: string
  title: string
  type: DocumentType
  status: DocumentStatus
  version: string
  owner: string
  lastUpdated: string
  source: DocumentSource
  tags: string[]
  sections: DocumentSection[]
  linkedArtifacts?: LinkedArtifacts
}

export type TemplateScope = 'Company' | 'Project' | 'Personal'

export interface TemplateSection {
  id: string
  title: string
  orderIndex: number
  type: SectionType
}

export interface Template {
  id: string
  name: string
  docType: DocumentType
  scope: TemplateScope
  sectionBlueprint: TemplateSection[]
  lastUpdated: string
}

export type EvidencePackPurpose =
  | 'PDR'
  | 'CDR'
  | 'Certification'
  | 'Supplier Delivery'
  | 'Internal Review'

export type EvidencePackStatus = 'Draft' | 'Prepared' | 'Exported'

export interface EvidencePackItem {
  documentId: string
  documentTitle: string
  version?: string
  status?: DocumentStatus
}

export interface EvidencePack {
  id: string
  title: string
  purpose: EvidencePackPurpose
  status: EvidencePackStatus
  items: EvidencePackItem[]
  lastUpdated: string
}

export type ExportFormat = 'PDF' | 'DOCX' | 'ZIP'

export type WatermarkOption = 'None' | 'Draft' | 'Confidential'

export interface ExportProfile {
  id: string
  name: string
  format: ExportFormat
  headerFooter: boolean
  numbering: boolean
  includeManifest: boolean
  watermark: WatermarkOption
  defaultDocTypes: DocumentType[]
}

export interface ExportHistoryItem {
  id: string
  timestamp: string
  exportedBy: string
  exportProfileName: string
  itemsCount: number
  outputLabel: string
  notes?: string
  itemIds?: string[]
  profileId?: string
}

export interface ArtifactReferenceBlock {
  type: 'artifact_reference'
  artifactType: string
  artifactId: string
  sourceModule: string
}

export interface GeneratedSectionBlock {
  type: 'generated_section'
  sourceLabel: string
}
