/**
 * PBS (Product Breakdown Structure) — isolated module types.
 * All data is local to this module; no integration with other modules.
 */

export type PBSType =
  | 'System'
  | 'Subsystem'
  | 'Assembly'
  | 'Part'
  | 'Software'
  | 'Document'

export type PBSStatus = 'Draft' | 'In Work' | 'Released' | 'Obsolete'

export interface PBSAttribute {
  key: string
  value: string
  unit?: string
}

export type PBSRelationType =
  | 'depends_on'      // This item depends on the target
  | 'interfaces_with' // This item interfaces with the target
  | 'is_part_of'      // This item is part of the target (logical, not hierarchical)
  | 'verifies'        // This item verifies the target
  | 'related_to'      // Generic relationship

export interface PBSRelationship {
  id: string
  targetId: string
  type: PBSRelationType
  description?: string
}

export const PBS_RELATION_TYPES: { value: PBSRelationType; label: string }[] = [
  { value: 'depends_on', label: 'Depends on' },
  { value: 'interfaces_with', label: 'Interfaces with' },
  { value: 'is_part_of', label: 'Is part of' },
  { value: 'verifies', label: 'Verifies' },
  { value: 'related_to', label: 'Related to' },
]

export interface PBSAttachment {
  id: string
  name: string
  mimeType: string
  size: number         // Original file size in bytes
  dataUrl: string      // Base64 data URL
  addedAt: string      // ISO timestamp
}

// Attachment size limits (localStorage is typically ~5MB total)
export const ATTACHMENT_MAX_FILE_SIZE = 512 * 1024  // 512 KB per file
export const ATTACHMENT_MAX_TOTAL_SIZE = 2 * 1024 * 1024  // 2 MB total per node

export interface PBSNode {
  id: string
  parentId: string | null
  name: string
  pbsCode: string
  type: PBSType
  status: PBSStatus
  description: string
  tags: string[]
  attributes: PBSAttribute[]
  relationships: PBSRelationship[]
  attachments: PBSAttachment[]
  orderIndex: number
  revision: number
  createdAt: string
  updatedAt: string
}

export interface PBSChangeLogEntry {
  id: string
  nodeId: string
  action: 'created' | 'updated' | 'moved' | 'deleted'
  timestamp: string
  details?: string
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

export const PBS_TYPES: PBSType[] = [
  'System',
  'Subsystem',
  'Assembly',
  'Part',
  'Software',
  'Document',
]

export const PBS_STATUSES: PBSStatus[] = [
  'Draft',
  'In Work',
  'Released',
  'Obsolete',
]

export const PREDEFINED_ATTRIBUTE_KEYS = [
  'Manufacturer',
  'Part Number',
  'Material',
  'Weight',
  'Dimensions',
]
