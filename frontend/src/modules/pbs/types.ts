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

// ── Shared node-type styling constants ──
// Used by PBSTree.tsx and available for RequirementsPBSTree / FunctionsPBSTree if needed.
import { Box, Layers, Settings, Package, Cpu, FileText as FileTextIcon, type LucideIcon } from 'lucide-react'

export const PBS_TYPE_BADGE_CLASS: Record<string, string> = {
  System: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
  Subsystem: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200',
  Assembly: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
  Part: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  Software: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
  Document: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
}

export const PBS_TYPE_ICON_CLASS: Record<string, string> = {
  System: 'text-blue-600 dark:text-blue-400',
  Subsystem: 'text-indigo-600 dark:text-indigo-400',
  Assembly: 'text-amber-600 dark:text-amber-400',
  Part: 'text-gray-600 dark:text-gray-400',
  Software: 'text-green-600 dark:text-green-400',
  Document: 'text-purple-600 dark:text-purple-400',
}

export const PBS_TYPE_ICONS: Record<string, LucideIcon> = {
  System: Box,
  Subsystem: Layers,
  Assembly: Settings,
  Part: Package,
  Software: Cpu,
  Document: FileTextIcon,
}

export const PBS_STATUS_DOT_CLASS: Record<string, string> = {
  Draft: 'bg-gray-400',
  'In Work': 'bg-yellow-500',
  Released: 'bg-green-500',
  Obsolete: 'bg-red-500',
}
